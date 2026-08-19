using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace CodexDreamSkin.Client;

internal sealed class ClientWindow : Form
{
    private readonly ClientOptions _options;
    private readonly RuntimeSupervisor _runtime;
    private readonly WebView2 _webView = new() { Dock = DockStyle.Fill };
    private bool _allowClose;

    public ClientWindow(ClientOptions options, RuntimeSupervisor runtime)
    {
        _options = options;
        _runtime = runtime;
        Text = "Codex Dream Skin";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(1080, 720);
        ClientSize = new Size(1440, 920);
        Controls.Add(_webView);
        FormClosing += OnFormClosing;
    }

    public async Task InitializeAsync()
    {
        Directory.CreateDirectory(_options.WebViewUserData);
        var fixedRuntime = Path.Combine(_options.RuntimeRoot, "runtime", "webview2");
        var browserExecutableFolder = Directory.Exists(fixedRuntime) ? fixedRuntime : null;

        var environment = await CoreWebView2Environment.CreateAsync(
            browserExecutableFolder: browserExecutableFolder,
            userDataFolder: _options.WebViewUserData);
        await _webView.EnsureCoreWebView2Async(environment);
        var core = _webView.CoreWebView2;
        core.Settings.AreDefaultContextMenusEnabled = false;
        core.Settings.AreDevToolsEnabled = _options.AllowEvergreenWebView2;
        core.NavigationStarting += OnNavigationStarting;
        core.NewWindowRequested += OnNewWindowRequested;
        core.DownloadStarting += OnDownloadStarting;
        core.Navigate(_runtime.LaunchUrl);
    }

    public void ShowClient()
    {
        if (IsDisposed) return;
        Show();
        WindowState = FormWindowState.Normal;
        BringToFront();
        Activate();
    }

    public void ClosePermanently()
    {
        _allowClose = true;
        Close();
    }

    private void OnFormClosing(object? sender, FormClosingEventArgs e)
    {
        if (_allowClose) return;
        e.Cancel = true;
        Hide();
    }

    private void OnNavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var target) || !IsLocalControlCenter(target))
            e.Cancel = true;
    }

    private void OnNewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
        => e.Handled = true;

    private void OnDownloadStarting(object? sender, CoreWebView2DownloadStartingEventArgs e)
    {
        var suggested = Path.GetFileName(e.ResultFilePath);
        if (string.IsNullOrWhiteSpace(suggested))
        {
            e.Cancel = true;
            return;
        }
        var downloads = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
        Directory.CreateDirectory(downloads);
        e.ResultFilePath = Path.Combine(downloads, suggested);
    }

    private bool IsLocalControlCenter(Uri target)
        => target.Scheme == Uri.UriSchemeHttp &&
           target.Host == _runtime.Origin.Host &&
           target.Port == _runtime.Origin.Port;
}
