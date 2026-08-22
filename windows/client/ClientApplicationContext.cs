using System.Drawing;

namespace CodexDreamSkin.Client;

internal sealed class ClientApplicationContext : ApplicationContext
{
    private readonly ClientOptions _options;
    private readonly RuntimeSupervisor _runtime;
    private readonly NotifyIcon _tray;
    private readonly ToolStripMenuItem _showItem;
    private readonly ToolStripMenuItem _pauseItem;
    private readonly ToolStripMenuItem _resumeItem;
    private ClientWindow? _window;
    private bool _ready;

    public ClientApplicationContext(ClientOptions options)
    {
        _options = options;
        _runtime = new RuntimeSupervisor(options);
        _showItem = new ToolStripMenuItem("显示控制中心") { Enabled = false };
        _pauseItem = new ToolStripMenuItem("暂停皮肤") { Enabled = false };
        _resumeItem = new ToolStripMenuItem("继续显示") { Enabled = false };
        var startItem = new ToolStripMenuItem("启动 / 重新应用 Codex") { Enabled = false };
        var restoreItem = new ToolStripMenuItem("完整恢复官方外观") { Enabled = false };
        var exitItem = new ToolStripMenuItem("退出客户端");

        _showItem.Click += (_, _) => _window?.ShowClient();
        _pauseItem.Click += async (_, _) => await RunActionAsync("pause", _pauseItem);
        _resumeItem.Click += async (_, _) => await RunActionAsync("resume", _resumeItem);
        startItem.Click += async (_, _) => await RunActionAsync("start", startItem);
        restoreItem.Click += async (_, _) => await RunActionAsync("restore", restoreItem);
        exitItem.Click += (_, _) => ExitClient();

        var menu = new ContextMenuStrip();
        menu.Items.Add(_showItem);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(_pauseItem);
        menu.Items.Add(_resumeItem);
        menu.Items.Add(startItem);
        menu.Items.Add(restoreItem);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(exitItem);

        _tray = new NotifyIcon
        {
            Text = "Codex-Skin",
            Visible = true,
            ContextMenuStrip = menu,
            Icon = LoadIcon(options),
        };
        _tray.DoubleClick += (_, _) => _window?.ShowClient();
        _ = InitializeAsync(startItem, restoreItem);
    }

    private async Task InitializeAsync(ToolStripMenuItem startItem, ToolStripMenuItem restoreItem)
    {
        try
        {
            await _runtime.StartAsync();
            _window = new ClientWindow(_options, _runtime);
            MainForm = _window;
            await _window.InitializeAsync();
            _ready = true;
            _showItem.Enabled = true;
            _pauseItem.Enabled = true;
            _resumeItem.Enabled = true;
            startItem.Enabled = true;
            restoreItem.Enabled = true;
            if (_options.ShowWindow) _window.ShowClient();
        }
        catch (Exception error)
        {
            MessageBox.Show(error.Message, "Codex-Skin 客户端无法启动", MessageBoxButtons.OK, MessageBoxIcon.Error);
            ExitClient();
        }
    }

    private async Task RunActionAsync(string action, ToolStripMenuItem source)
    {
        if (!_ready) return;
        source.Enabled = false;
        try
        {
            using var result = await _runtime.PostActionAsync(action);
            var message = result.RootElement.TryGetProperty("message", out var value)
                ? value.GetString() : "操作已完成";
            if (!string.IsNullOrWhiteSpace(message)) _tray.BalloonTipText = message;
            _tray.ShowBalloonTip(1800);
        }
        catch (Exception error)
        {
            MessageBox.Show(error.Message, "Codex-Skin", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
        finally
        {
            source.Enabled = true;
        }
    }

    private void ExitClient()
    {
        if (MainForm is not null) ((ClientWindow)MainForm).ClosePermanently();
        _tray.Visible = false;
        _tray.Dispose();
        _runtime.Dispose();
        ExitThread();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _tray.Visible = false;
            _tray.Dispose();
            _runtime.Dispose();
        }
        base.Dispose(disposing);
    }

    private static Icon LoadIcon(ClientOptions options)
    {
        var path = Path.Combine(options.RuntimeRoot, "assets", "codex-dream-skin.ico");
        return File.Exists(path) ? new Icon(path) : SystemIcons.Application;
    }
}
