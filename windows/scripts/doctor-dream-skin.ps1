[CmdletBinding()]
param(
  [switch]$Json,
  [switch]$RequireLive,
  [switch]$CheckSync
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common-windows.ps1')

$node = Get-DreamSkinNodeRuntime
$platformRoot = Split-Path -Parent $PSScriptRoot
$projectRoot = Split-Path -Parent $platformRoot
$stateFile = Join-Path $env:LOCALAPPDATA 'CodexDreamSkin\state.json'
$arguments = @(
  (Join-Path $PSScriptRoot 'runtime-doctor.mjs'),
  '--platform', 'windows',
  '--platform-root', $platformRoot,
  '--state-file', $stateFile
)
if (Test-Path -LiteralPath (Join-Path $projectRoot 'tools\sync-runtime-assets.mjs') -PathType Leaf) {
  $arguments += @('--project-root', $projectRoot)
}
if ($Json) { $arguments += '--json' }
if ($RequireLive) { $arguments += '--require-live' }
if ($CheckSync) { $arguments += '--check-sync' }

& $node.Path @arguments
exit $LASTEXITCODE
