using System.Diagnostics;

namespace CodexDreamSkin.Client;

internal sealed record ClientOptions(
    string ServerRoot,
    string RuntimeRoot,
    string StateRoot,
    bool ShowWindow,
    bool AllowEvergreenWebView2)
{
    public string ServerScript => Path.Combine(ServerRoot, "control-center", "server.mjs");
    public string StateFile => Path.Combine(StateRoot, "control-center.json");
    public string WebViewUserData => Path.Combine(StateRoot, "client", "webview2");

    public static ClientOptions Parse(string[] args)
    {
        string? serverRoot = null;
        string? runtimeRoot = null;
        string? stateRoot = null;
        var showWindow = true;
        var allowEvergreen = false;

        for (var index = 0; index < args.Length; index++)
        {
            switch (args[index])
            {
                case "--background":
                    showWindow = false;
                    break;
                case "--show":
                    showWindow = true;
                    break;
                case "--allow-evergreen-webview2":
                    allowEvergreen = true;
                    break;
                case "--server-root":
                    serverRoot = ReadValue(args, ref index);
                    break;
                case "--runtime-root":
                    runtimeRoot = ReadValue(args, ref index);
                    break;
                case "--state-root":
                    stateRoot = ReadValue(args, ref index);
                    break;
                default:
                    throw new ArgumentException($"Unknown client argument: {args[index]}");
            }
        }

        serverRoot ??= FindServerRoot();
        runtimeRoot ??= FindRuntimeRoot(serverRoot);
        stateRoot ??= Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "CodexDreamSkin");

        var options = new ClientOptions(
            Path.GetFullPath(serverRoot),
            Path.GetFullPath(runtimeRoot),
            Path.GetFullPath(stateRoot),
            showWindow,
            allowEvergreen);
        if (!File.Exists(options.ServerScript))
            throw new FileNotFoundException("The embedded Control Center server is missing.", options.ServerScript);
        Directory.CreateDirectory(options.StateRoot);
        return options;
    }

    public string ResolveNodePath()
    {
        var bundled = Path.Combine(RuntimeRoot, "runtime", "node", "node.exe");
        if (File.Exists(bundled)) return bundled;

        var sourceBundled = Path.Combine(ServerRoot, "windows", "runtime", "node", "node.exe");
        if (File.Exists(sourceBundled)) return sourceBundled;

        if (Debugger.IsAttached || AllowEvergreenWebView2)
        {
            var path = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
            foreach (var directory in path.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
            {
                var candidate = Path.Combine(directory.Trim(), "node.exe");
                if (File.Exists(candidate)) return candidate;
            }
        }

        throw new FileNotFoundException(
            "The bundled Node.js runtime is missing. Development builds may use PATH Node.js only when explicitly enabled.");
    }

    private static string ReadValue(string[] args, ref int index)
    {
        if (++index >= args.Length || string.IsNullOrWhiteSpace(args[index]))
            throw new ArgumentException($"Missing value for {args[index - 1]}");
        return args[index];
    }

    private static string FindServerRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, "control-center", "server.mjs")))
                return directory.FullName;
        }

        throw new DirectoryNotFoundException(
            "The project root containing control-center/server.mjs could not be located. Pass --server-root explicitly.");
    }

    private static string FindRuntimeRoot(string serverRoot)
    {
        var installed = Path.Combine(serverRoot, "scripts");
        if (Directory.Exists(installed) && Directory.Exists(Path.Combine(serverRoot, "assets")))
            return serverRoot;

        var source = Path.Combine(serverRoot, "windows");
        if (Directory.Exists(Path.Combine(source, "scripts")) && Directory.Exists(Path.Combine(source, "assets")))
            return source;

        throw new DirectoryNotFoundException(
            "The Windows Dream Skin runtime root could not be located. Pass --runtime-root explicitly.");
    }
}
