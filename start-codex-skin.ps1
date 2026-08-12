[CmdletBinding()]
param(
  [int]$Port = 9335,
  [switch]$RestartExisting,
  [switch]$PromptRestart,
  [string]$ProfilePath,
  [switch]$ForegroundInjector,
  [ValidateRange(0, 300000)][int]$OperationLockTimeoutMilliseconds = 0,
  [switch]$RequireUnpaused,
  [switch]$Capture,
  [switch]$Watch,
  [string]$CaptureOutput,
  [ValidateRange(0, 600)][int]$CaptureWaitSeconds = 30
)

$ErrorActionPreference = 'Stop'
$portExplicit = $PSBoundParameters.ContainsKey('Port')

if ($Capture -and $Watch) {
  throw 'Use either -Capture or -Watch, not both.'
}

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$startScript = Join-Path $projectRoot 'windows\scripts\start-dream-skin.ps1'
$captureScript = Join-Path $projectRoot 'tools\capture-dom-fixture.mjs'
$statePath = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin\state.json'

if (-not (Test-Path -LiteralPath $startScript -PathType Leaf)) {
  throw "Dream Skin start script was not found: $startScript"
}
if (($Capture -or $Watch) -and -not (Test-Path -LiteralPath $captureScript -PathType Leaf)) {
  throw "DOM capture tool was not found: $captureScript"
}

$startArguments = @(
  '-NoProfile',
  '-ExecutionPolicy', 'RemoteSigned',
  '-File', $startScript
)
if ($portExplicit) { $startArguments += @('-Port', "$Port") }
if ($RestartExisting) { $startArguments += '-RestartExisting' }
if ($PromptRestart) { $startArguments += '-PromptRestart' }
if ($ForegroundInjector) { $startArguments += '-ForegroundInjector' }
if ($RequireUnpaused) { $startArguments += '-RequireUnpaused' }
if ($ProfilePath) { $startArguments += @('-ProfilePath', $ProfilePath) }
if ($OperationLockTimeoutMilliseconds -gt 0) {
  $startArguments += @('-OperationLockTimeoutMilliseconds', "$OperationLockTimeoutMilliseconds")
}

Write-Host "Starting Codex Dream Skin from $projectRoot ..."
& powershell.exe @startArguments
if ($LASTEXITCODE -ne 0) {
  throw "Dream Skin startup failed with exit code $LASTEXITCODE."
}

if (-not ($Capture -or $Watch)) {
  Write-Host 'Codex Dream Skin is running. Use -Capture for one redacted snapshot or -Watch for state sampling.'
  exit 0
}

$activePort = $Port
if (Test-Path -LiteralPath $statePath -PathType Leaf) {
  try {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    if ($state.port) { $activePort = [int]$state.port }
  } catch {
    Write-Warning "Could not read the active Dream Skin state; using requested port $Port."
  }
}

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if ($null -eq $node) { throw 'Node.js 22+ is required for the redacted DOM capture tool.' }

$captureArguments = @(
  $captureScript,
  '--port', "$activePort",
  '--wait', "$CaptureWaitSeconds"
)
if ($Watch) { $captureArguments += '--watch' }
if ($CaptureOutput) {
  $captureArguments += @('--out', [System.IO.Path]::GetFullPath($CaptureOutput))
}

Write-Host "Starting redacted DOM capture on loopback port $activePort ..."
& $node.Source @captureArguments
if ($LASTEXITCODE -ne 0) {
  throw "DOM capture exited with code $LASTEXITCODE."
}
