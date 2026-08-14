[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverScript = Join-Path $projectRoot 'control-center\server.mjs'
$stateRoot = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin'
$stateFile = Join-Path $stateRoot 'control-center.json'

function Test-ControlCenterState {
  param([Parameter(Mandatory = $true)]$State)
  if (-not $State.pid -or -not $State.origin -or -not $State.url -or -not $State.token) { return $false }
  if (-not (Get-Process -Id ([int]$State.pid) -ErrorAction SilentlyContinue)) { return $false }
  try {
    $headers = @{ 'X-DreamSkin-Token' = "$($State.token)" }
    $null = Invoke-RestMethod -UseBasicParsing -Uri "$($State.origin)/api/bootstrap" -Headers $headers -TimeoutSec 2
    return $true
  } catch {
    return $false
  }
}

function Stop-ControlCenterState {
  param([Parameter(Mandatory = $true)]$State)

  $processId = 0
  try { $processId = [int]$State.pid } catch {}
  if ($processId -le 0) {
    Remove-Item -LiteralPath $stateFile -Force -ErrorAction SilentlyContinue
    return
  }

  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if ($null -eq $process) {
    Remove-Item -LiteralPath $stateFile -Force -ErrorAction SilentlyContinue
    return
  }

  Write-Host "Existing Control Center detected (PID $processId). Stopping it before restart..."
  try {
    Stop-Process -Id $processId -ErrorAction Stop
  } catch {
    if (Get-Process -Id $processId -ErrorAction SilentlyContinue) {
      Stop-Process -Id $processId -Force -ErrorAction Stop
    }
  }

  $deadline = [DateTime]::UtcNow.AddSeconds(8)
  while ($null -ne (Get-Process -Id $processId -ErrorAction SilentlyContinue) -and [DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 150
  }
  if (Get-Process -Id $processId -ErrorAction SilentlyContinue) {
    Stop-Process -Id $processId -Force -ErrorAction Stop
    Start-Sleep -Milliseconds 250
  }
  if (Get-Process -Id $processId -ErrorAction SilentlyContinue) {
    throw "Existing Control Center process $processId could not be stopped."
  }
  Remove-Item -LiteralPath $stateFile -Force -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Force -Path $stateRoot | Out-Null
$existing = $null
try { $existing = Get-Content -LiteralPath $stateFile -Raw -Encoding UTF8 | ConvertFrom-Json } catch {}
if ($null -ne $existing -and (Test-ControlCenterState -State $existing)) {
  Stop-ControlCenterState -State $existing
} else {
  Remove-Item -LiteralPath $stateFile -Force -ErrorAction SilentlyContinue
}

$managedScriptRoot = Join-Path $projectRoot 'windows\scripts'
if (-not (Test-Path -LiteralPath $managedScriptRoot -PathType Container)) {
  throw "Managed Windows script directory was not found: $managedScriptRoot"
}
foreach ($managedScript in @(Get-ChildItem -LiteralPath $managedScriptRoot -Filter '*.ps1' -File -Recurse)) {
  try {
    Unblock-File -LiteralPath $managedScript.FullName -ErrorAction Stop
  } catch {
    throw "Could not unblock the local Dream Skin script $($managedScript.FullName): $($_.Exception.Message)"
  }
}

. (Join-Path $projectRoot 'windows\scripts\common-windows.ps1')
$node = Get-DreamSkinNodeRuntime
Remove-Item -LiteralPath $stateFile -Force -ErrorAction SilentlyContinue
$arguments = @(
  $serverScript,
  '--state-file', $stateFile,
  '--state-root', $stateRoot
)
$argumentLine = ($arguments | ForEach-Object {
    '"' + ([string]$_).Replace('"', '\"') + '"'
  }) -join ' '
$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = $node.Path
$startInfo.Arguments = $argumentLine
$startInfo.WorkingDirectory = $projectRoot
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$process = [System.Diagnostics.Process]::Start($startInfo)
if ($null -eq $process) { throw 'Control Center Node process could not be started.' }

$deadline = [DateTime]::UtcNow.AddSeconds(12)
do {
  Start-Sleep -Milliseconds 150
  if ($process.HasExited) { throw "Control Center stopped with exit code $($process.ExitCode)." }
  $state = $null
  try { $state = Get-Content -LiteralPath $stateFile -Raw -Encoding UTF8 | ConvertFrom-Json } catch {}
  if ($null -ne $state -and [int]$state.pid -eq $process.Id -and (Test-ControlCenterState -State $state)) {
    Start-Process -FilePath "$($state.url)"
    exit 0
  }
} while ([DateTime]::UtcNow -lt $deadline)

throw 'Control Center did not become ready within 12 seconds.'
