[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('apply', 'pause', 'resume')]
  [string]$Action,

  [Parameter(Mandatory = $true)]
  [string]$StateRoot,

  [string]$ThemeId
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common-windows.ps1')
. (Join-Path $PSScriptRoot 'theme-windows.ps1')

$StateRoot = [System.IO.Path]::GetFullPath($StateRoot)
$paths = Get-DreamSkinThemePaths -StateRoot $StateRoot
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
      $result = [pscustomobject]@{ ok = $true; action = $Action; themeId = $ThemeId; message = 'Theme activated.' }
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
      $null = Set-DreamSkinPaused -Paused $false -StateRoot $StateRoot
      $result = [pscustomobject]@{
        ok = $true
        action = $Action
        message = 'Pause cleared. A running watcher will reapply the active theme.'
      }
    }
  }
} finally {
  Exit-DreamSkinOperationLock -Mutex $operationLock
}
$result | ConvertTo-Json -Compress
