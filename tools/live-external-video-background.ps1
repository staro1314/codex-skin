param(
  [Parameter(Mandatory = $true)][string]$VideoPath,
  [ValidateRange(0, 2000)][int]$RightInset = 0
)

$ErrorActionPreference = 'Stop'
$resolvedVideo = (Resolve-Path -LiteralPath $VideoPath).Path

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName WindowsBase
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class DreamSkinNativeWindow {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
}
'@

$codex = Get-Process ChatGPT -ErrorAction Stop |
  Where-Object { $_.MainWindowHandle -ne 0 } |
  Sort-Object StartTime -Descending |
  Select-Object -First 1
if (-not $codex) { throw 'No visible Codex window was found.' }

$window = [System.Windows.Window]::new()
$window.WindowStyle = [System.Windows.WindowStyle]::None
$window.ResizeMode = [System.Windows.ResizeMode]::NoResize
$window.ShowInTaskbar = $false
$window.ShowActivated = $false
$window.Topmost = $false
$window.Background = [System.Windows.Media.Brushes]::Black

$media = [System.Windows.Controls.MediaElement]::new()
$media.LoadedBehavior = [System.Windows.Controls.MediaState]::Manual
$media.UnloadedBehavior = [System.Windows.Controls.MediaState]::Manual
$media.Stretch = [System.Windows.Media.Stretch]::UniformToFill
$media.IsMuted = $true
$media.Source = [Uri]::new($resolvedVideo)
$media.Add_MediaEnded({ $media.Position = [TimeSpan]::Zero; $media.Play() })
$window.Content = $media

$window.Add_SourceInitialized({
  $helper = [System.Windows.Interop.WindowInteropHelper]::new($window)
  $script:backgroundHandle = $helper.Handle
})
$window.Add_Loaded({ $media.Play() })

$timer = [System.Windows.Threading.DispatcherTimer]::new()
$timer.Interval = [TimeSpan]::FromMilliseconds(80)
$timer.Add_Tick({
  try {
    $codex.Refresh()
    if ($codex.HasExited -or $codex.MainWindowHandle -eq 0) { $window.Close(); return }
    $rect = [DreamSkinNativeWindow+RECT]::new()
    if ([DreamSkinNativeWindow]::GetWindowRect($codex.MainWindowHandle, [ref]$rect)) {
      [void][DreamSkinNativeWindow]::SetWindowPos(
        $script:backgroundHandle,
        $codex.MainWindowHandle,
        $rect.Left,
        $rect.Top,
        [Math]::Max(1, $rect.Right - $rect.Left - $RightInset),
        $rect.Bottom - $rect.Top,
        0x0010
      )
    }
  } catch { $window.Close() }
})
$window.Add_Closed({ $timer.Stop(); $media.Stop() })
$timer.Start()
[void]$window.Show()
[void][System.Windows.Threading.Dispatcher]::Run()
