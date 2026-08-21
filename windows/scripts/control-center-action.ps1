[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('apply', 'pause', 'resume', 'start', 'restore')]
  [string]$Action,

  [Parameter(Mandatory = $true)]
  [string]$StateRoot,

  [string]$ThemeId
)

# Windows PowerShell 5.1 writes redirected stdout using the active system
# code page by default. The Node host reads this stream as UTF-8.
$utf8 = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = $utf8
[Console]::OutputEncoding = $utf8

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common-windows.ps1')
. (Join-Path $PSScriptRoot 'theme-windows.ps1')

$StateRoot = [System.IO.Path]::GetFullPath($StateRoot)
$paths = Get-DreamSkinThemePaths -StateRoot $StateRoot

if ($Action -in @('start', 'restore')) {
  $scriptName = if ($Action -eq 'start') { 'start-dream-skin.ps1' } else { 'restore-dream-skin.ps1' }
  $script = Join-Path $PSScriptRoot $scriptName
  if (-not (Test-Path -LiteralPath $script -PathType Leaf)) {
    throw "The verified Codex $Action script is missing."
  }
  $scriptOutput = @()
  if ($Action -eq 'start') {
    # The native button is the explicit restart authorization. Do not wait on
    # a hidden WScript confirmation dialog owned by the background service.
    $scriptOutput = @(& $script -RestartExisting 2>&1)
  } else {
    $scriptOutput = @(& $script -RestoreBaseTheme -PromptRestart 2>&1)
  }
  $cancelled = [bool]($scriptOutput | Where-Object { "$($_)" -match 'cancelled' })
  if ($cancelled) {
    $message = 'Operation cancelled; Codex was not changed.'
  } elseif ($Action -eq 'start') {
    $message = 'Codex started and the active theme was rendered.'
  } else {
    $message = 'Codex was restored to its official appearance.'
  }
  [pscustomobject]@{
    ok = -not $cancelled
    action = $Action
    message = $message
  } | ConvertTo-Json -Compress
  exit 0
}

$operationLock = Enter-DreamSkinOperationLock -TimeoutMilliseconds 10000
$result = $null
try {
  Ensure-DreamSkinManagedDirectory -Path $paths.Root -Root $paths.Root
  switch ($Action) {
    'apply' {
      if (-not $ThemeId -or $ThemeId -cnotmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$') {
        throw 'A valid saved theme id is required.'
      }
      Ensure-DreamSkinManagedDirectory -Path $paths.Saved -Root $paths.Root
      $themeDirectory = Join-Path $paths.Saved $ThemeId
      if (-not (Test-DreamSkinThemePathWithin -Path $themeDirectory -Root $paths.Saved)) {
        throw 'Saved theme path is invalid.'
      }
      $null = Use-DreamSkinSavedTheme -ThemeDirectory $themeDirectory -StateRoot $StateRoot
      $null = Set-DreamSkinPaused -Paused $false -StateRoot $StateRoot
      $apply = Invoke-DreamSkinLiveApply -StateRoot $StateRoot
      $result = [pscustomobject]@{
        ok = [bool]$apply.Applied
        action = $Action
        themeId = $ThemeId
        attempted = [bool]$apply.Attempted
        applied = [bool]$apply.Applied
        message = "$($apply.Message)"
      }
    }
    'pause' {
      $null = Set-DreamSkinPaused -Paused $true -StateRoot $StateRoot
      $removal = Invoke-DreamSkinLiveRemove -StateRoot $StateRoot
      $result = [pscustomobject]@{
        ok = $true
        action = $Action
        attempted = [bool]$removal.Attempted
        removed = [bool]$removal.Removed
        message = "$($removal.Message)"
      }
    }
    'resume' {
      # Do not report success merely because the marker was deleted. Reapply
      # once against the verified live session first, then let the watcher
      # resume maintaining that already-verified theme.
      $resume = Invoke-DreamSkinLiveApply -StateRoot $StateRoot
      if ($resume.Attempted -and -not $resume.Applied) {
        $null = Set-DreamSkinPaused -Paused $true -StateRoot $StateRoot
      } else {
        $null = Set-DreamSkinPaused -Paused $false -StateRoot $StateRoot
      }
      $result = [pscustomobject]@{
        ok = [bool](-not $resume.Attempted -or $resume.Applied)
        action = $Action
        attempted = [bool]$resume.Attempted
        applied = [bool]$resume.Applied
        message = "$($resume.Message)"
      }
    }
  }
} finally {
  Exit-DreamSkinOperationLock -Mutex $operationLock
}
$result | ConvertTo-Json -Compress
