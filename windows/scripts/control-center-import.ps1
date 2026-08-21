[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ArchivePath,
  [Parameter(Mandatory = $true)][string]$StateRoot
)

$utf8 = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'common-windows.ps1')
. (Join-Path $PSScriptRoot 'theme-windows.ps1')

$StateRoot = [System.IO.Path]::GetFullPath($StateRoot)
$ArchivePath = [System.IO.Path]::GetFullPath($ArchivePath)
$statePrefix = $StateRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
if (-not $ArchivePath.StartsWith($statePrefix, [System.StringComparison]::OrdinalIgnoreCase) -or
  -not (Test-Path -LiteralPath $ArchivePath -PathType Leaf)) {
  throw 'The staged theme ZIP is outside the managed state directory.'
}
Assert-DreamSkinNoReparseComponents -Path $ArchivePath
$archive = Get-Item -LiteralPath $ArchivePath -Force
if ($archive.Length -le 0 -or $archive.Length -gt 32MB) {
  throw 'Theme ZIP must be non-empty and no larger than 32 MiB.'
}
$digest = (Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
$imported = Import-DreamSkinThemeZip -ArchivePath $ArchivePath -StateRoot $StateRoot `
  -ExpectedArchiveBytes $archive.Length -ExpectedArchiveSha256 $digest
$duplicate = "$($imported.Status)" -ceq 'Duplicate'
[pscustomobject]@{
  ok = $true
  status = "$($imported.Status)"
  themeId = "$($imported.Id)"
  name = "$($imported.Name)"
  message = if ($duplicate) { 'Theme already exists in the saved library.' } else { 'Theme imported into the saved library without applying it.' }
} | ConvertTo-Json -Compress
