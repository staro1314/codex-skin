using System.Diagnostics;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace CodexDreamSkin.Client;

internal sealed class RuntimeSupervisor : IDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly ClientOptions _options;
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(2) };
    private Process? _ownedProcess;
    private bool _disposed;

    public RuntimeSupervisor(ClientOptions options) => _options = options;

    public ServiceState State { get; private set; } = null!;
    public Uri Origin => new(State.Origin, UriKind.Absolute);
    public string LaunchUrl => State.Url;

    public async Task StartAsync(CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        var existing = await TryReuseExistingAsync(cancellationToken);
        if (existing is not null)
        {
            State = existing;
            return;
        }

        TryDeleteStateFile();
        var nodePath = _options.ResolveNodePath();
        var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = nodePath,
                WorkingDirectory = _options.ServerRoot,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardError = true,
                RedirectStandardOutput = true,
            },
            EnableRaisingEvents = true,
        };
        process.StartInfo.ArgumentList.Add(_options.ServerScript);
        process.StartInfo.ArgumentList.Add("--embedded");
        process.StartInfo.ArgumentList.Add("--runtime-root");
        process.StartInfo.ArgumentList.Add(_options.RuntimeRoot);
        process.StartInfo.ArgumentList.Add("--state-file");
        process.StartInfo.ArgumentList.Add(_options.StateFile);
        process.StartInfo.ArgumentList.Add("--state-root");
        process.StartInfo.ArgumentList.Add(_options.StateRoot);
        process.ErrorDataReceived += (_, _) => { };
        process.OutputDataReceived += (_, _) => { };
        if (!process.Start()) throw new InvalidOperationException("The embedded Node.js service could not be started.");
        process.BeginErrorReadLine();
        process.BeginOutputReadLine();
        _ownedProcess = process;

        var deadline = DateTime.UtcNow.AddSeconds(12);
        while (DateTime.UtcNow < deadline)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (process.HasExited)
                throw new InvalidOperationException($"The embedded Control Center service stopped with exit code {process.ExitCode}.");

            var state = await ReadStateAsync(cancellationToken);
            if (state is not null && IsCompatibleState(state) && state.Pid == process.Id && await IsHealthyAsync(state, cancellationToken))
            {
                State = state;
                return;
            }
            await Task.Delay(150, cancellationToken);
        }

        throw new TimeoutException("The embedded Control Center service did not become ready within 12 seconds.");
    }

    public async Task<JsonDocument> PostActionAsync(string action, string? themeId = null, CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        if (State is null) throw new InvalidOperationException("The embedded service is not ready.");
        var body = JsonSerializer.Serialize(new { action, themeId }, JsonOptions);
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(Origin, "/api/action"));
        request.Headers.Add("X-DreamSkin-Token", State.Token);
        request.Headers.TryAddWithoutValidation("Origin", Origin.ToString().TrimEnd('/'));
        request.Content = new StringContent(body, Encoding.UTF8, "application/json");
        using var response = await _http.SendAsync(request, cancellationToken);
        var text = await response.Content.ReadAsStringAsync(cancellationToken);
        using var document = JsonDocument.Parse(text);
        if (!response.IsSuccessStatusCode)
        {
            var message = document.RootElement.TryGetProperty("error", out var error)
                ? error.GetString() ?? $"HTTP {(int)response.StatusCode}"
                : $"HTTP {(int)response.StatusCode}";
            throw new InvalidOperationException(message);
        }
        return JsonDocument.Parse(document.RootElement.GetRawText());
    }

    public async Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default)
        => State is not null && await IsHealthyAsync(State, cancellationToken);

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _http.Dispose();
        if (_ownedProcess is { HasExited: false })
        {
            try
            {
                _ownedProcess.Kill(entireProcessTree: true);
                _ownedProcess.WaitForExit(5000);
            }
            catch { }
        }
        _ownedProcess?.Dispose();
        _ownedProcess = null;
        TryDeleteStateFile();
    }

    private async Task<ServiceState?> TryReuseExistingAsync(CancellationToken cancellationToken)
    {
        var state = await ReadStateAsync(cancellationToken);
        if (state is null || !IsCompatibleState(state) || !IsLiveNodeProcess(state.Pid)) return null;
        return await IsHealthyAsync(state, cancellationToken) ? state : null;
    }

    private async Task<ServiceState?> ReadStateAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var stream = File.OpenRead(_options.StateFile);
            return await JsonSerializer.DeserializeAsync<ServiceState>(stream, JsonOptions, cancellationToken);
        }
        catch (IOException) { return null; }
        catch (UnauthorizedAccessException) { return null; }
        catch (JsonException) { return null; }
    }

    private bool IsCompatibleState(ServiceState state)
    {
        if (state.Pid <= 0 || string.IsNullOrWhiteSpace(state.Token)) return false;
        if (!Uri.TryCreate(state.Origin, UriKind.Absolute, out var origin) ||
            origin.Scheme != Uri.UriSchemeHttp || origin.Host != IPAddress.Loopback.ToString() || origin.Port is < 1 or > 65535)
            return false;
        if (!Uri.TryCreate(state.Url, UriKind.Absolute, out var url) ||
            url.Scheme != Uri.UriSchemeHttp || url.Host != origin.Host || url.Port != origin.Port)
            return false;
        try
        {
            return state.Embedded && PathsEqual(state.StateRoot, _options.StateRoot) && PathsEqual(state.RuntimeRoot, _options.RuntimeRoot);
        }
        catch (ArgumentException) { return false; }
        catch (NotSupportedException) { return false; }
    }

    private async Task<bool> IsHealthyAsync(ServiceState state, CancellationToken cancellationToken)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(new Uri(state.Origin), "/api/bootstrap"));
            request.Headers.Add("X-DreamSkin-Token", state.Token);
            using var response = await _http.SendAsync(request, cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (HttpRequestException) { return false; }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested) { return false; }
    }

    private bool IsLiveNodeProcess(int pid)
    {
        try
        {
            using var process = Process.GetProcessById(pid);
            if (process.HasExited) return false;
            var expected = _options.ResolveNodePath();
            var actual = process.MainModule?.FileName;
            return !string.IsNullOrWhiteSpace(actual) && PathsEqual(actual, expected);
        }
        catch (Exception) { return false; }
    }

    private void TryDeleteStateFile()
    {
        try { File.Delete(_options.StateFile); } catch { }
    }

    private static bool PathsEqual(string? left, string right)
        => !string.IsNullOrWhiteSpace(left) &&
           string.Equals(Path.GetFullPath(left).TrimEnd(Path.DirectorySeparatorChar),
               Path.GetFullPath(right).TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase);

    private void ThrowIfDisposed()
    {
        if (_disposed) throw new ObjectDisposedException(nameof(RuntimeSupervisor));
    }
}

internal sealed record ServiceState(
    [property: JsonPropertyName("pid")] int Pid,
    [property: JsonPropertyName("origin")] string Origin,
    [property: JsonPropertyName("url")] string Url,
    [property: JsonPropertyName("token")] string Token,
    [property: JsonPropertyName("stateRoot")] string StateRoot,
    [property: JsonPropertyName("runtimeRoot")] string RuntimeRoot,
    [property: JsonPropertyName("embedded")] bool Embedded);
