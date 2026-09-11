[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$windowsRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = Split-Path -Parent $windowsRoot
$installerBootstrap = Join-Path $windowsRoot 'installer\setup-bootstrap.ps1'
$restoreScript = Join-Path $windowsRoot 'scripts\restore-dream-skin.ps1'
$commonScript = Join-Path $windowsRoot 'scripts\common-windows.ps1'
$themeScript = Join-Path $windowsRoot 'scripts\theme-windows.ps1'
$configScript = Join-Path $windowsRoot 'scripts\config-utf8.ps1'
$productJson = Join-Path $windowsRoot 'assets\product.json'
$productModule = Join-Path $windowsRoot 'assets\product.mjs'

foreach ($path in @(
  $installerBootstrap,$restoreScript,$commonScript,$themeScript,$configScript,$productJson,$productModule
)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Installer closed-Codex fixture is missing: $path"
  }
}

$bootstrapText = [System.IO.File]::ReadAllText($installerBootstrap)
$restoreText = [System.IO.File]::ReadAllText($restoreScript)
foreach ($contract in @(
  '[switch]$PrepareInstall',
  '[string]$InstalledAppRoot',
  'if ($PrepareInstall)',
  "Join-Path `$InstalledAppRoot 'payload\client\CodexDreamSkin.Client.exe'",
  "Join-Path `$InstalledAppRoot 'payload\scripts\tray-dream-skin.ps1'",
  "Join-Path `$InstalledAppRoot 'payload\runtime\node\node.exe'",
  'DeploymentOnly = $true'
)) {
  if (-not $bootstrapText.Contains($contract)) {
    throw "Installer closed-Codex contract is missing from setup bootstrap: $contract"
  }
}
if (-not $restoreText.Contains('[switch]$DeploymentOnly') -or
  -not $restoreText.Contains('if (-not $DeploymentOnly)')) {
  throw 'Restore script has no deployment-only path that bypasses Codex discovery.'
}

$fixtureRoot = Join-Path ([System.IO.Path]::GetTempPath()) `
  ('codex-dream-skin-closed-codex-' + [guid]::NewGuid().ToString('N'))
$payloadRoot = Join-Path $fixtureRoot 'payload'
$payloadScripts = Join-Path $payloadRoot 'scripts'
$payloadAssets = Join-Path $payloadRoot 'assets'
$stateRoot = Join-Path $fixtureRoot 'state'
$codexStateRoot = Join-Path $stateRoot 'CodexDreamSkin'
$homeRoot = Join-Path $fixtureRoot 'home'
$engineScripts = Join-Path $codexStateRoot 'engine\scripts'
$engineAssets = Join-Path $codexStateRoot 'engine\assets'
New-Item -ItemType Directory -Path `
  $payloadScripts,$payloadAssets,$engineScripts,$engineAssets,(Join-Path $homeRoot '.codex') -Force | Out-Null

function Invoke-IsolatedPowerShell {
  param(
    [Parameter(Mandatory = $true)][string]$ScriptPath,
    [Parameter(Mandatory = $true)][string]$LocalAppData,
    [Parameter(Mandatory = $true)][string]$HomePath,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [switch]$UseTemporaryUserProfile
  )

  $powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
  $previousLocalAppData = $env:LOCALAPPDATA
  $previousHome = $env:HOME
  $previousUserProfile = $env:USERPROFILE
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $env:LOCALAPPDATA = $LocalAppData
    $env:HOME = $HomePath
    if ($UseTemporaryUserProfile) { $env:USERPROFILE = $HomePath }
    $output = @(& $powershell -NoProfile -STA -ExecutionPolicy RemoteSigned -File $ScriptPath @Arguments 2>&1)
    return [pscustomobject]@{
      ExitCode = $LASTEXITCODE
      Output = $output
    }
  } finally {
    $env:LOCALAPPDATA = $previousLocalAppData
    $env:HOME = $previousHome
    $env:USERPROFILE = $previousUserProfile
    $ErrorActionPreference = $previousErrorActionPreference
  }
}

try {
  Copy-Item -LiteralPath $installerBootstrap -Destination (Join-Path $fixtureRoot 'setup-bootstrap.ps1') -Force
  foreach ($source in @($commonScript,$themeScript,$configScript)) {
    Copy-Item -LiteralPath $source -Destination $payloadScripts -Force
    Copy-Item -LiteralPath $source -Destination $engineScripts -Force
  }
  foreach ($source in @($productJson,$productModule)) {
    Copy-Item -LiteralPath $source -Destination $payloadAssets -Force
    Copy-Item -LiteralPath $source -Destination $engineAssets -Force
  }
  Copy-Item -LiteralPath $restoreScript -Destination $engineScripts -Force

  $bootstrapResult = Invoke-IsolatedPowerShell `
    -ScriptPath (Join-Path $fixtureRoot 'setup-bootstrap.ps1') `
    -LocalAppData $stateRoot `
    -HomePath $homeRoot `
    -Arguments @('-PrepareInstall', '-Silent')
  if ($bootstrapResult.ExitCode -ne 0) {
    throw "Prepare-install failed with Codex closed: $($bootstrapResult.Output -join "`n")"
  }

  $restoreResult = Invoke-IsolatedPowerShell `
    -ScriptPath (Join-Path $engineScripts 'restore-dream-skin.ps1') `
    -LocalAppData $stateRoot `
    -HomePath $homeRoot `
    -Arguments @('-DeploymentOnly', '-NoRelaunch') `
    -UseTemporaryUserProfile
  if ($restoreResult.ExitCode -ne 0) {
    throw "Deployment-only restore failed with Codex closed: $($restoreResult.Output -join "`n")"
  }

  Write-Host 'PASS: packaged install preparation and uninstall restore succeed with Codex closed.'
} finally {
  if (Test-Path -LiteralPath $fixtureRoot) {
    Remove-Item -LiteralPath $fixtureRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
