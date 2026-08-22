using System.Security.Principal;

namespace CodexDreamSkin.Client;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        try
        {
            var options = ClientOptions.Parse(args);
            var sid = WindowsIdentity.GetCurrent().User?.Value ?? Environment.UserName;
            using var mutex = new Mutex(true, $"Local\\CodexDreamSkin.Client.{sid}", out var createdNew);
            if (!createdNew)
            {
                MessageBox.Show("Codex-Skin 客户端已经在运行。请从系统托盘打开控制中心。", "Codex-Skin", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            ApplicationConfiguration.Initialize();
            Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
            Application.Run(new ClientApplicationContext(options));
        }
        catch (Exception error)
        {
            MessageBox.Show(error.Message, "Codex-Skin 客户端启动失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
