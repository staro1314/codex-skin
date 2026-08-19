[CmdletBinding()]
param(
  [switch]$Install,
  [switch]$LaunchTray,
  [switch]$Uninstall,
  [switch]$Silent,
  [string]$CompletionFile
)

$ErrorActionPreference = 'Stop'
$payloadRoot = Join-Path $PSScriptRoot 'payload'
$payloadScripts = Join-Path $payloadRoot 'scripts'
$commonPath = Join-Path $payloadScripts 'common-windows.ps1'
$themePath = Join-Path $payloadScripts 'theme-windows.ps1'
$stateRoot = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
$startupShortcut = Join-Path ([Environment]::GetFolderPath('Startup')) 'Codex Dream Skin.lnk'

function Show-DreamSkinBootstrapMessage {
  param(
    [Parameter(Mandatory = $true)][string]$Message,
    [ValidateSet('Info', 'Error')][string]$Kind = 'Info'
  )
  if ($Silent) { return }
  Add-Type -AssemblyName System.Windows.Forms
  $icon = if ($Kind -eq 'Error') {
    [System.Windows.Forms.MessageBoxIcon]::Error
  } else {
    [System.Windows.Forms.MessageBoxIcon]::Information
  }
  [void][System.Windows.Forms.MessageBox]::Show(
    $Message,
    'Codex Dream Skin',
    [System.Windows.Forms.MessageBoxButtons]::OK,
    $icon
  )
}

function Write-DreamSkinBootstrapCompletion {
  param([Parameter(Mandatory = $true)][int]$ExitCode)
  if ([string]::IsNullOrWhiteSpace($CompletionFile)) { return }
  $path = [System.IO.Path]::GetFullPath($CompletionFile)
  [System.IO.File]::WriteAllText(
    $path,
    "$ExitCode`r`n",
    [System.Text.UTF8Encoding]::new($false)
  )
}

function Test-DreamSkinWebView2RuntimeInstalled {
  $clientId = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
  $registryPaths = @(
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\$clientId",
    "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\$clientId",
    "HKCU:\Software\Microsoft\EdgeUpdate\Clients\$clientId"
  )
  foreach ($registryPath in $registryPaths) {
    try {
      $version = (Get-ItemProperty -LiteralPath $registryPath -Name pv -ErrorAction Stop).pv
      if ($version -and [version]$version -gt [version]'0.0.0.0') { return $true }
    } catch { }
  }
  return $false
}

function Ensure-DreamSkinWebView2Runtime {
  param([Parameter(Mandatory = $true)][string]$BootstrapperPath)
  if (Test-DreamSkinWebView2RuntimeInstalled) { return }
  if (-not (Test-Path -LiteralPath $BootstrapperPath -PathType Leaf)) {
    throw 'The installer payload is missing the Microsoft WebView2 Evergreen Bootstrapper. Re-download Setup.exe.'
  }
  $process = Start-Process -FilePath $BootstrapperPath -ArgumentList @('/silent', '/install') `
    -Wait -PassThru -WindowStyle Hidden
  if ($process.ExitCode -notin @(0, 3010) -or -not (Test-DreamSkinWebView2RuntimeInstalled)) {
    throw "Microsoft WebView2 Runtime installation failed (exit code $($process.ExitCode)). Connect to the internet and retry Setup.exe."
  }
}

try {
  if ($Install -and ($LaunchTray -or $Uninstall)) {
    throw 'Choose exactly one installer bootstrap action.'
  }
  if (-not (Test-Path -LiteralPath $commonPath -PathType Leaf) -or
    -not (Test-Path -LiteralPath $themePath -PathType Leaf)) {
    throw 'The installer payload is incomplete.'
  }
  . $commonPath
  . $themePath

  $engine = Get-DreamSkinRuntimeEnginePaths -StateRoot $stateRoot
  if ($Uninstall) {
    Stop-DreamSkinClientProcess -ClientPath $engine.Client -RequireStopped
    Stop-DreamSkinTrayProcess -ScriptPaths @($engine.Tray) -RequireStopped
    Stop-DreamSkinRuntimeNodeProcess -NodePath $engine.Node -RequireStopped
    $restoreRequired = (Test-Path -LiteralPath $engine.Root -PathType Container) -or
      (Test-Path -LiteralPath (Join-Path $stateRoot 'config.before-dream-skin.toml') -PathType Leaf)
    if ($restoreRequired -and -not (Test-Path -LiteralPath $engine.Restore -PathType Leaf)) {
      throw 'The installed restore engine is missing. Reinstall Codex Dream Skin, then uninstall again so Codex can be restored safely.'
    }
    if ($restoreRequired) {
      $restoreParameters = @{
        Uninstall = $true
        ForceRestart = $true
        NoRelaunch = $true
      }
      if (Test-Path -LiteralPath (Join-Path $stateRoot 'config.before-dream-skin.toml') -PathType Leaf) {
        $restoreParameters.RestoreBaseTheme = $true
      }
      & $engine.Restore @restoreParameters
    }
    if (Test-Path -LiteralPath $engine.Root -PathType Container) {
      Remove-DreamSkinRuntimeTree -Path $engine.Root -StateRoot $stateRoot
    }
    Remove-Item -LiteralPath $startupShortcut -Force -ErrorAction SilentlyContinue
    Write-DreamSkinBootstrapCompletion -ExitCode 0
    exit 0
  }

  $payloadNode = Join-Path $payloadRoot 'runtime\node\node.exe'
  $payloadNodeLicense = Join-Path $payloadRoot 'runtime\node\LICENSE'
  if (-not (Test-Path -LiteralPath $payloadNode -PathType Leaf) -or
    -not (Test-Path -LiteralPath $payloadNodeLicense -PathType Leaf)) {
    throw 'The installer payload is missing its bundled Node.js runtime. Re-download Setup.exe.'
  }
  Ensure-DreamSkinWebView2Runtime -BootstrapperPath (
    Join-Path $payloadRoot 'dependencies\MicrosoftEdgeWebView2Setup.exe'
  )
  $payloadVersion = ([System.IO.File]::ReadAllText((Join-Path $payloadRoot 'VERSION'))).Trim()
  if ($payloadVersion -cnotmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$') {
    throw "The installer payload version is invalid: $payloadVersion"
  }
  $installedVersion = if (Test-Path -LiteralPath $engine.Version -PathType Leaf) {
    ([System.IO.File]::ReadAllText($engine.Version)).Trim()
  } else { '' }
  if ($installedVersion -cmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$' -and
    ([version]$installedVersion) -gt ([version]$payloadVersion)) {
    throw "A newer Codex Dream Skin v$installedVersion is already installed. Download that version or newer instead of downgrading to v$payloadVersion."
  }
  $requiredEngineFiles = @(
    'VERSION',
    'assets\codex-dream-skin.ico',
    'assets\dream-reference.jpg',
    'assets\dream-skin.css',
    'assets\renderer-inject.js',
    'assets\compatibility.json',
    'assets\safe-css-policy.json',
    'assets\safe-css-validator.mjs',
    'assets\selectors.json',
    'assets\theme-package-validator.mjs',
    'assets\theme.json',
    'presets\preset-gothic-void-crusade\background.jpg',
    'presets\preset-gothic-void-crusade\theme.json',
    'scripts\apply-community-theme.ps1',
    'scripts\check-update.ps1',
    'scripts\common-windows.ps1',
    'scripts\config-utf8.ps1',
    'scripts\doctor-dream-skin.ps1',
    'scripts\image-metadata.mjs',
    'scripts\injector.mjs',
    'scripts\install-dream-skin.ps1',
    'scripts\restore-dream-skin.ps1',
    'scripts\runtime-doctor.mjs',
    'scripts\start-dream-skin.ps1',
    'scripts\theme-windows.ps1',
    'scripts\tray-dream-skin.ps1',
    'scripts\validate-safe-css-file.mjs',
    'scripts\verify-dream-skin.ps1',
    'runtime\node\node.exe',
    'runtime\node\LICENSE'
  )
  if (Test-Path -LiteralPath (Join-Path $payloadRoot 'control-center') -PathType Container) {
    $requiredEngineFiles += @(
      'control-center\server.mjs',
      'control-center\theme-store.mjs',
      'control-center\theme-exporter.mjs',
      'control-center\zip-writer.mjs',
      'control-center\public\index.html',
      'control-center\public\app.js',
      'control-center\public\styles.css',
      'control-center\public\video-theme-cover.png'
    )
  }
  if (Test-Path -LiteralPath (Join-Path $payloadRoot 'client\CodexDreamSkin.Client.exe') -PathType Leaf) {
    $requiredEngineFiles += 'client\CodexDreamSkin.Client.exe'
  }
  $missingEngineFiles = @($requiredEngineFiles | Where-Object {
    -not (Test-Path -LiteralPath (Join-Path $engine.Root $_) -PathType Leaf)
  })
  $engineComplete = $missingEngineFiles.Count -eq 0
  # The packaged client install is deployment-only. It must not touch Codex's
  # config.toml or require Codex to exit; the client action owns apply/restart.
  $needsInstall = $Install -or $payloadVersion -cne $installedVersion -or
    -not $engineComplete

  if ($needsInstall) {
    Stop-DreamSkinClientProcess -ClientPath $engine.Client -RequireStopped
    Stop-DreamSkinTrayProcess -ScriptPaths @($engine.Tray) -RequireStopped
    Stop-DreamSkinRuntimeNodeProcess -NodePath $engine.Node -RequireStopped
    $engine = Install-DreamSkinRuntimeEngine -SkillRoot $payloadRoot -StateRoot $stateRoot
    $null = Initialize-DreamSkinThemeStore -SkillRoot $engine.Root -StateRoot $stateRoot
    $engine = Get-DreamSkinRuntimeEnginePaths -StateRoot $stateRoot
    $committedVersion = if (Test-Path -LiteralPath $engine.Version -PathType Leaf) {
      ([System.IO.File]::ReadAllText($engine.Version)).Trim()
    } else { '' }
    $missingEngineFiles = @($requiredEngineFiles | Where-Object {
      -not (Test-Path -LiteralPath (Join-Path $engine.Root $_) -PathType Leaf)
    })
    if ($committedVersion -cne $payloadVersion -or $missingEngineFiles.Count -gt 0) {
      throw 'Runtime installation did not commit a complete managed engine.'
    }
  }

  $clientPath = $engine.Client
  if ($LaunchTray -and (Test-Path -LiteralPath $clientPath -PathType Leaf)) {
    Start-Process -FilePath $clientPath -ArgumentList @(
      '--background',
      '--server-root', $engine.Root,
      '--runtime-root', $engine.Root
    ) -WindowStyle Hidden | Out-Null
  } elseif ($LaunchTray -and -not (Test-DreamSkinTrayActive)) {
    $powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
    $argumentLine = '-NoProfile -STA -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File ' +
      (ConvertTo-DreamSkinProcessArgument -Value $engine.Tray)
    Start-Process -FilePath $powershell -ArgumentList $argumentLine -WindowStyle Hidden | Out-Null
  }
} catch {
  Show-DreamSkinBootstrapMessage -Message $_.Exception.Message -Kind Error
  Write-DreamSkinBootstrapCompletion -ExitCode 1
  Write-Error $_ -ErrorAction Continue
  exit 1
}
Write-DreamSkinBootstrapCompletion -ExitCode 0
