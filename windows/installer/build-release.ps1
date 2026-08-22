[CmdletBinding()]
param(
  [string]$OutputDirectory,
  [string]$IsccPath,
  [string]$NodeArchivePath,
  [string]$DotnetPath,
  [string]$WebView2BootstrapperPath,
  [string]$WorkingDirectory,
  [switch]$KeepWorkingDirectory
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$installerRoot = $PSScriptRoot
$windowsRoot = Split-Path -Parent $installerRoot
$repositoryRoot = Split-Path -Parent $windowsRoot
$manifestPath = Join-Path $installerRoot 'node-runtime.json'
$definitionPath = Join-Path $installerRoot 'codex-dream-skin.iss'
$bootstrapPath = Join-Path $installerRoot 'setup-bootstrap.ps1'
$versionPath = Join-Path $windowsRoot 'VERSION'
$macosVersionPath = Join-Path (Join-Path $repositoryRoot 'macos') 'VERSION'
$macosPackagePath = Join-Path (Join-Path $repositoryRoot 'macos') 'package.json'
$licensePath = Join-Path (Join-Path $repositoryRoot 'macos') 'LICENSE'
$noticePath = Join-Path (Join-Path $repositoryRoot 'macos') 'NOTICE.md'
$innoLanguageRoot = Join-Path $installerRoot 'languages'
$innoChineseLanguagePath = Join-Path $innoLanguageRoot 'ChineseSimplified.isl'
$innoSetupLicensePath = Join-Path $innoLanguageRoot 'Inno-Setup-License.txt'
$innoChineseLanguageSha256 = '7d544b9bb1d142cfa11f2e5d3cc8abe2e55f8e066c5124e3772675aa236e1278'
$innoSetupLicenseSha256 = '0c81595601bce47eeef8d865d5da7f9ca2c6a12235b7482b29f5ab23ed02ee5a'
$publicPresetRoot = Join-Path (Join-Path (Join-Path $repositoryRoot 'macos') 'presets') `
  'preset-gothic-void-crusade'
$publicPresetImagePath = Join-Path $publicPresetRoot 'background.jpg'
$publicPresetThemePath = Join-Path $publicPresetRoot 'theme.json'
$publicPresetImageSha256 = 'b76a7cbe2ff9d923846e931984d243a7ba1f25de8d190b5c6412c809c41aee42'
$publicPresetThemeSha256 = 'aab3fa23ccd623b67a3e30af074098595d0e3683cf12ee31a011c050cc48a54c'
$videoFoxPresetRoot = Join-Path (Join-Path (Join-Path $repositoryRoot 'macos') 'presets') `
  'preset-video-fox-spirit'
$videoFoxPresetThemePath = Join-Path $videoFoxPresetRoot 'theme.json'
$videoFoxPresetImagePath = Join-Path $videoFoxPresetRoot 'background.png'
$videoFoxPresetVideoPath = Join-Path $videoFoxPresetRoot 'background.mp4'
$videoFoxPresetCssPath = Join-Path $videoFoxPresetRoot 'theme.css'
$videoFoxPresetThemeSha256 = 'ec131c521f505d685aeddfdbf43070e06e96735cb6ec3b291e74ce13cdf4f5bd'
$videoFoxPresetImageSha256 = 'fc60a66e55b9f8242e6b7aee75216d005878830b960f079c798835fbac7294fa'
$videoFoxPresetVideoSha256 = '339a85205ddb9c66aad4b4613b8a37c30b50e4af90ead6dd7138790e789424cb'
$videoFoxPresetCssSha256 = 'afdd1692b3666bab37f912cabb91aa494c64f967aed5c018b3cb12a05fb43065'
$webView2BootstrapperUrl = 'https://go.microsoft.com/fwlink/?linkid=2124703'

function Read-ReleaseTextFile {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Required release input does not exist: $Path"
  }
  return [System.IO.File]::ReadAllText($Path, [System.Text.UTF8Encoding]::new($false))
}

function Resolve-ReleasePath {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$BasePath
  )
  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }
  return [System.IO.Path]::GetFullPath((Join-Path $BasePath $Path))
}

function Assert-NodeRuntimeManifest {
  param([Parameter(Mandatory = $true)][object]$Manifest)
  $expectedVersion = '22.23.1'
  $expectedArchive = "node-v$expectedVersion-win-x64.zip"
  $expectedRoot = "node-v$expectedVersion-win-x64"
  $expectedUrl = "https://nodejs.org/dist/v$expectedVersion/$expectedArchive"
  $expectedHash = '7df0bc9375723f4a86b3aa1b7cc73342423d9677a8df4538aca31a049e309c29'

  if ("$($Manifest.version)" -cne $expectedVersion -or
    "$($Manifest.platform)" -cne 'win' -or
    "$($Manifest.architecture)" -cne 'x64' -or
    "$($Manifest.archive)" -cne $expectedArchive -or
    "$($Manifest.url)" -cne $expectedUrl -or
    "$($Manifest.sha256)" -cne $expectedHash -or
    "$($Manifest.nodeEntry)" -cne "$expectedRoot/node.exe" -or
    "$($Manifest.licenseEntry)" -cne "$expectedRoot/LICENSE") {
    throw 'The pinned Node.js runtime manifest differs from the reviewed v22.23.1 win-x64 release.'
  }
}

function Resolve-IsccExecutable {
  param([string]$RequestedPath)
  $candidates = @()
  if ($RequestedPath) { $candidates += $RequestedPath }
  if (${env:ProgramFiles(x86)}) {
    $candidates += Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'
  }
  if ($env:ProgramFiles) {
    $candidates += Join-Path $env:ProgramFiles 'Inno Setup 6\ISCC.exe'
  }
  if ($env:ChocolateyInstall) {
    $candidates += Join-Path $env:ChocolateyInstall 'bin\iscc.exe'
  }
  $command = Get-Command 'ISCC.exe' -ErrorAction SilentlyContinue
  if ($command) { $candidates += $command.Source }

  foreach ($candidate in $candidates) {
    if (-not $candidate) { continue }
    $resolved = Resolve-ReleasePath -Path $candidate -BasePath $repositoryRoot
    if (Test-Path -LiteralPath $resolved -PathType Leaf) { return $resolved }
  }
  throw 'Inno Setup 6 compiler (ISCC.exe) was not found. Install Inno Setup 6 or pass -IsccPath.'
}

function Resolve-DotnetExecutable {
  param([string]$RequestedPath)
  if ($RequestedPath) {
    $resolved = Resolve-ReleasePath -Path $RequestedPath -BasePath $repositoryRoot
    if (Test-Path -LiteralPath $resolved -PathType Leaf) { return $resolved }
    throw "The requested dotnet executable does not exist: $resolved"
  }
  $command = Get-Command 'dotnet.exe' -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $candidates = @(
    (Join-Path $env:ProgramFiles 'dotnet\dotnet.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'dotnet\dotnet.exe')
  )
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { return $candidate }
  }
  throw 'The .NET SDK executable was not found. Install the .NET 8 SDK or pass -DotnetPath.'
}

function Copy-ReleaseDirectory {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
  )
  if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
    throw "Required release directory does not exist: $Source"
  }
  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  foreach ($item in Get-ChildItem -LiteralPath $Source -Force) {
    Copy-Item -LiteralPath $item.FullName -Destination $Destination -Recurse -Force -ErrorAction Stop
  }
}

function Copy-ZipEntry {
  param(
    [Parameter(Mandatory = $true)][object]$Archive,
    [Parameter(Mandatory = $true)][string]$EntryName,
    [Parameter(Mandatory = $true)][string]$Destination
  )
  $entry = $Archive.GetEntry($EntryName)
  if ($null -eq $entry -or $entry.Length -le 0) {
    throw "The Node.js archive is missing a non-empty entry: $EntryName"
  }
  $parent = Split-Path -Parent $Destination
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  $input = $entry.Open()
  try {
    $output = [System.IO.File]::Open(
      $Destination,
      [System.IO.FileMode]::CreateNew,
      [System.IO.FileAccess]::Write,
      [System.IO.FileShare]::None
    )
    try { $input.CopyTo($output) } finally { $output.Dispose() }
  } finally {
    $input.Dispose()
  }
}

function Write-DreamSkinIcon {
  param([Parameter(Mandatory = $true)][string]$Path)
  $sizes = @(16, 24, 32, 48, 64, 256)
  $images = New-Object System.Collections.Generic.List[byte[]]
  $rotationCos = 0.974370
  $rotationSin = 0.224951

  foreach ($size in $sizes) {
    $pixelBytes = $size * $size * 4
    $maskStride = [int]([Math]::Ceiling($size / 32.0) * 4)
    $stream = [System.IO.MemoryStream]::new()
    $writer = [System.IO.BinaryWriter]::new($stream)
    try {
      $writer.Write([uint32]40)
      $writer.Write([int32]$size)
      $writer.Write([int32]($size * 2))
      $writer.Write([uint16]1)
      $writer.Write([uint16]32)
      $writer.Write([uint32]0)
      $writer.Write([uint32]$pixelBytes)
      $writer.Write([int32]3780)
      $writer.Write([int32]3780)
      $writer.Write([uint32]0)
      $writer.Write([uint32]0)

      $alphaRows = New-Object 'byte[][]' $size
      for ($row = $size - 1; $row -ge 0; $row--) {
        $alphaRow = New-Object byte[] $size
        for ($column = 0; $column -lt $size; $column++) {
          $coverage = 0
          $red = 0.0
          $green = 0.0
          $blue = 0.0
          foreach ($sampleY in @(0.125, 0.375, 0.625, 0.875)) {
            foreach ($sampleX in @(0.125, 0.375, 0.625, 0.875)) {
              # Plum Glass：深色圆角底、莓紫玻璃面板、倾斜的主题纸张。
              $x = ($column + $sampleX) / $size
              $y = ($row + $sampleY) / $size

              $outerDx = [Math]::Max([Math]::Abs($x - 0.5) - 0.32, 0.0)
              $outerDy = [Math]::Max([Math]::Abs($y - 0.5) - 0.32, 0.0)
              $outerDistance = [Math]::Sqrt($outerDx * $outerDx + $outerDy * $outerDy)
              if ($outerDistance -le 0.10) {
                $coverage++

                $shade = [Math]::Max(0.0, [Math]::Min(1.0, $y))
                $red = 11.0 + (10.0 * $shade)
                $green = 16.0 + (7.0 * $shade)
                $blue = 32.0 + (15.0 * $shade)

                $glassDx = [Math]::Max([Math]::Abs($x - 0.5) - 0.21, 0.0)
                $glassDy = [Math]::Max([Math]::Abs($y - 0.5) - 0.21, 0.0)
                $glassDistance = [Math]::Sqrt($glassDx * $glassDx + $glassDy * $glassDy)
                if ($glassDistance -le 0.09) {
                  $glassT = [Math]::Max(0.0, [Math]::Min(1.0, (($x + $y) - 0.32) / 1.36))
                  $red = 75.0 + ((33.0 - 75.0) * $glassT)
                  $green = 45.0 + ((23.0 - 45.0) * $glassT)
                  $blue = 88.0 + ((55.0 - 88.0) * $glassT)

                  $glassMargin = 0.09 - $glassDistance
                  $rimBlend = [Math]::Max(0.0, [Math]::Min(1.0, (0.035 - $glassMargin) / 0.035)) * 0.44
                  $rimT = [Math]::Max(0.0, [Math]::Min(1.0, ($x + $y - 0.72) / 0.64))
                  $rimRed = 235.0 + ((133.0 - 235.0) * $rimT)
                  $rimGreen = 160.0 + ((226.0 - 160.0) * $rimT)
                  $rimBlue = 158.0 + ((211.0 - 158.0) * $rimT)
                  $red = ($red * (1.0 - $rimBlend)) + ($rimRed * $rimBlend)
                  $green = ($green * (1.0 - $rimBlend)) + ($rimGreen * $rimBlend)
                  $blue = ($blue * (1.0 - $rimBlend)) + ($rimBlue * $rimBlend)

                  $globalX = $x - 0.5
                  $globalY = $y - 0.5
                  $localX = ($globalX * $rotationCos) + ($globalY * $rotationSin)
                  $localY = (-$globalX * $rotationSin) + ($globalY * $rotationCos)
                  $pageDx = [Math]::Max([Math]::Abs($localX) - 0.18, 0.0)
                  $pageDy = [Math]::Max([Math]::Abs($localY) - 0.26, 0.0)
                  $pageDistance = [Math]::Sqrt($pageDx * $pageDx + $pageDy * $pageDy)
                  if ($pageDistance -le 0.04) {
                    $pageT = [Math]::Max(0.0, [Math]::Min(1.0, (($localX + (0.75 * $localY)) + 0.45) / 0.90))
                    $red = 244.0 + ((124.0 - 244.0) * $pageT)
                    $green = 193.0 + ((103.0 - 193.0) * $pageT)
                    $blue = 183.0 + ((207.0 - 183.0) * $pageT)

                    $pageMargin = 0.04 - $pageDistance
                    $paperEdgeBlend = [Math]::Max(0.0, [Math]::Min(1.0, (0.018 - $pageMargin) / 0.018)) * 0.55
                    $red = ($red * (1.0 - $paperEdgeBlend)) + (247.0 * $paperEdgeBlend)
                    $green = ($green * (1.0 - $paperEdgeBlend)) + (199.0 * $paperEdgeBlend)
                    $blue = ($blue * (1.0 - $paperEdgeBlend)) + (193.0 * $paperEdgeBlend)

                    $line = $false
                    foreach ($lineY in @(-0.12, 0.0, 0.12)) {
                      if (($localX -ge -0.14) -and ($localX -le 0.15) -and ([Math]::Abs($localY - $lineY) -le 0.018)) {
                        $line = $true
                      }
                    }
                    if ($line) {
                      $red = 94.0
                      $green = 62.0
                      $blue = 109.0
                    } elseif (($localX -gt 0.12) -and ($localY -gt 0.20) -and (($localX + $localY) -gt 0.32)) {
                      $red = 169.0
                      $green = 231.0
                      $blue = 220.0
                    }
                  }
                }
              }
            }
          }

          $alpha = [int][Math]::Round(255.0 * $coverage / 16.0)
          $alphaRow[$column] = [byte]$alpha
          $writer.Write([byte][int][Math]::Round([Math]::Max(0.0, [Math]::Min(255.0, $blue))))
          $writer.Write([byte][int][Math]::Round([Math]::Max(0.0, [Math]::Min(255.0, $green))))
          $writer.Write([byte][int][Math]::Round([Math]::Max(0.0, [Math]::Min(255.0, $red))))
          $writer.Write([byte]$alpha)
        }
        $alphaRows[$row] = $alphaRow
      }

      for ($row = $size - 1; $row -ge 0; $row--) {
        $maskRow = New-Object byte[] $maskStride
        for ($column = 0; $column -lt $size; $column++) {
          if ($alphaRows[$row][$column] -eq 0) {
            $byteIndex = [int][Math]::Floor($column / 8.0)
            $maskRow[$byteIndex] = $maskRow[$byteIndex] -bor (0x80 -shr ($column % 8))
          }
        }
        $writer.Write($maskRow)
      }
      $writer.Flush()
      $images.Add($stream.ToArray())
    } finally {
      $writer.Dispose()
      $stream.Dispose()
    }
  }

  $parent = Split-Path -Parent $Path
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  $iconStream = [System.IO.File]::Open(
    $Path,
    [System.IO.FileMode]::Create,
    [System.IO.FileAccess]::Write,
    [System.IO.FileShare]::None
  )
  $iconWriter = [System.IO.BinaryWriter]::new($iconStream)
  try {
    $iconWriter.Write([uint16]0)
    $iconWriter.Write([uint16]1)
    $iconWriter.Write([uint16]$sizes.Count)
    $offset = 6 + (16 * $sizes.Count)
    for ($index = 0; $index -lt $sizes.Count; $index++) {
      $dimension = if ($sizes[$index] -eq 256) { 0 } else { $sizes[$index] }
      $iconWriter.Write([byte]$dimension)
      $iconWriter.Write([byte]$dimension)
      $iconWriter.Write([byte]0)
      $iconWriter.Write([byte]0)
      $iconWriter.Write([uint16]1)
      $iconWriter.Write([uint16]32)
      $iconWriter.Write([uint32]$images[$index].Length)
      $iconWriter.Write([uint32]$offset)
      $offset += $images[$index].Length
    }
    foreach ($image in $images) { $iconWriter.Write($image) }
  } finally {
    $iconWriter.Dispose()
    $iconStream.Dispose()
  }
}

$version = (Read-ReleaseTextFile -Path $versionPath).Trim()
if ($version -cnotmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$') {
  throw "windows/VERSION must contain a three-part semantic version: $version"
}
$macosVersion = (Read-ReleaseTextFile -Path $macosVersionPath).Trim()
$macosPackage = (Read-ReleaseTextFile -Path $macosPackagePath) | ConvertFrom-Json
if ($macosVersion -cne $version -or "$($macosPackage.version)" -cne $version) {
  throw "Release versions differ: windows=$version macOS=$macosVersion package=$($macosPackage.version)"
}

$manifest = (Read-ReleaseTextFile -Path $manifestPath) | ConvertFrom-Json
Assert-NodeRuntimeManifest -Manifest $manifest
$null = Read-ReleaseTextFile -Path $definitionPath
$null = Read-ReleaseTextFile -Path $bootstrapPath
$null = Read-ReleaseTextFile -Path $licensePath
$null = Read-ReleaseTextFile -Path $noticePath
$null = Read-ReleaseTextFile -Path $innoChineseLanguagePath
$null = Read-ReleaseTextFile -Path $innoSetupLicensePath
$innoChineseLanguageHash = (Get-FileHash -LiteralPath $innoChineseLanguagePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($innoChineseLanguageHash -cne $innoChineseLanguageSha256) {
  throw "The pinned Inno Setup Simplified Chinese messages changed. Expected $innoChineseLanguageSha256, found $innoChineseLanguageHash."
}
$innoSetupLicenseHash = (Get-FileHash -LiteralPath $innoSetupLicensePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($innoSetupLicenseHash -cne $innoSetupLicenseSha256) {
  throw "The pinned Inno Setup license changed. Expected $innoSetupLicenseSha256, found $innoSetupLicenseHash."
}
$publicPresetTheme = (Read-ReleaseTextFile -Path $publicPresetThemePath) | ConvertFrom-Json
if ("$($publicPresetTheme.id)" -cne 'preset-gothic-void-crusade' -or
  "$($publicPresetTheme.image)" -cne 'background.jpg') {
  throw 'The public Windows release preset metadata is unexpected.'
}
if (-not (Test-Path -LiteralPath $publicPresetImagePath -PathType Leaf)) {
  throw "The public Windows release preset image is missing: $publicPresetImagePath"
}
$publicPresetImageHash = (Get-FileHash -LiteralPath $publicPresetImagePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($publicPresetImageHash -cne $publicPresetImageSha256) {
  throw "The reviewed public preset image changed. Expected $publicPresetImageSha256, found $publicPresetImageHash."
}
$publicPresetThemeHash = (Get-FileHash -LiteralPath $publicPresetThemePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($publicPresetThemeHash -cne $publicPresetThemeSha256) {
  throw "The reviewed public preset metadata changed. Expected $publicPresetThemeSha256, found $publicPresetThemeHash."
}
$videoFoxPresetTheme = (Read-ReleaseTextFile -Path $videoFoxPresetThemePath) | ConvertFrom-Json
if ("$($videoFoxPresetTheme.id)" -cne 'preset-video-fox-spirit' -or
  "$($videoFoxPresetTheme.name)" -cne '视频狐妖' -or
  "$($videoFoxPresetTheme.image)" -cne 'background.png' -or
  "$($videoFoxPresetTheme.video.src)" -cne 'background.mp4') {
  throw 'The bundled video fox preset metadata is unexpected.'
}
foreach ($videoFoxFile in @(
  @{ Path = $videoFoxPresetImagePath; Hash = $videoFoxPresetImageSha256 },
  @{ Path = $videoFoxPresetVideoPath; Hash = $videoFoxPresetVideoSha256 },
  @{ Path = $videoFoxPresetCssPath; Hash = $videoFoxPresetCssSha256 },
  @{ Path = $videoFoxPresetThemePath; Hash = $videoFoxPresetThemeSha256 }
)) {
  if (-not (Test-Path -LiteralPath $videoFoxFile.Path -PathType Leaf)) {
    throw "The bundled video fox preset file is missing: $($videoFoxFile.Path)"
  }
  $actualHash = (Get-FileHash -LiteralPath $videoFoxFile.Path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualHash -cne $videoFoxFile.Hash) {
    throw "The bundled video fox preset file changed: $($videoFoxFile.Path)"
  }
}
$compiler = Resolve-IsccExecutable -RequestedPath $IsccPath
$dotnet = Resolve-DotnetExecutable -RequestedPath $DotnetPath
$clientProjectPath = Join-Path (Join-Path $windowsRoot 'client') 'CodexDreamSkin.Client.csproj'
if (-not (Test-Path -LiteralPath $clientProjectPath -PathType Leaf)) {
  throw "The Windows client project is missing: $clientProjectPath"
}
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $repositoryRoot 'release' }
$OutputDirectory = Resolve-ReleasePath -Path $OutputDirectory -BasePath $repositoryRoot
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

if ($WorkingDirectory) {
  $WorkingDirectory = Resolve-ReleasePath -Path $WorkingDirectory -BasePath $repositoryRoot
  if (Test-Path -LiteralPath $WorkingDirectory) {
    throw "The requested working directory already exists: $WorkingDirectory"
  }
  New-Item -ItemType Directory -Path $WorkingDirectory | Out-Null
} else {
  $WorkingDirectory = Join-Path ([System.IO.Path]::GetTempPath()) (
    'codex-dream-skin-windows-release-' + [guid]::NewGuid().ToString('N')
  )
  New-Item -ItemType Directory -Path $WorkingDirectory | Out-Null
}

try {
  $webView2Bootstrapper = if ($WebView2BootstrapperPath) {
    Resolve-ReleasePath -Path $WebView2BootstrapperPath -BasePath $repositoryRoot
  } else {
    $downloadedBootstrapper = Join-Path $WorkingDirectory 'MicrosoftEdgeWebView2Setup.exe'
    Write-Host 'Downloading the small Microsoft WebView2 Evergreen Bootstrapper...'
    Invoke-WebRequest -UseBasicParsing -Uri $webView2BootstrapperUrl -OutFile $downloadedBootstrapper
    $downloadedBootstrapper
  }
  if (-not (Test-Path -LiteralPath $webView2Bootstrapper -PathType Leaf)) {
    throw "The WebView2 Evergreen Bootstrapper does not exist: $webView2Bootstrapper"
  }
  $webView2Signature = Get-AuthenticodeSignature -LiteralPath $webView2Bootstrapper
  if ($webView2Signature.Status -ne 'Valid' -or
    $webView2Signature.SignerCertificate.Subject -notmatch '(?i)Microsoft') {
    throw 'The WebView2 Evergreen Bootstrapper is not signed by Microsoft.'
  }

  $archivePath = if ($NodeArchivePath) {
    Resolve-ReleasePath -Path $NodeArchivePath -BasePath $repositoryRoot
  } else {
    Join-Path $WorkingDirectory "$($manifest.archive)"
  }
  if (-not $NodeArchivePath) {
    $previousProtocol = [Net.ServicePointManager]::SecurityProtocol
    try {
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      Write-Host "Downloading pinned Node.js v$($manifest.version) runtime..."
      Invoke-WebRequest -UseBasicParsing -Uri "$($manifest.url)" -OutFile $archivePath
    } finally {
      [Net.ServicePointManager]::SecurityProtocol = $previousProtocol
    }
  }
  if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
    throw "Node.js archive does not exist: $archivePath"
  }
  $archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($archiveHash -cne "$($manifest.sha256)") {
    throw "Node.js archive SHA-256 mismatch. Expected $($manifest.sha256), found $archiveHash."
  }

  $stageRoot = Join-Path $WorkingDirectory 'stage'
  $payloadRoot = Join-Path $stageRoot 'payload'
  $nodeRoot = Join-Path (Join-Path $payloadRoot 'runtime') 'node'
  $dependencyRoot = Join-Path $payloadRoot 'dependencies'
  $clientRoot = Join-Path $payloadRoot 'client'
  $languageRoot = Join-Path $stageRoot 'languages'
  New-Item -ItemType Directory -Path $payloadRoot | Out-Null
  New-Item -ItemType Directory -Path $languageRoot | Out-Null
  New-Item -ItemType Directory -Path $dependencyRoot | Out-Null
  Copy-ReleaseDirectory -Source (Join-Path $windowsRoot 'assets') -Destination (Join-Path $payloadRoot 'assets')
  Copy-ReleaseDirectory -Source (Join-Path $windowsRoot 'scripts') -Destination (Join-Path $payloadRoot 'scripts')
  Copy-ReleaseDirectory -Source (Join-Path $repositoryRoot 'control-center') -Destination (Join-Path $payloadRoot 'control-center')
  Copy-ReleaseDirectory -Source (Join-Path $repositoryRoot 'runtime') -Destination (Join-Path $payloadRoot 'runtime')
  Copy-Item -LiteralPath $webView2Bootstrapper -Destination (Join-Path $dependencyRoot 'MicrosoftEdgeWebView2Setup.exe') -Force
  Copy-ReleaseDirectory -Source $publicPresetRoot `
    -Destination (Join-Path $payloadRoot 'presets\preset-gothic-void-crusade')
  Copy-ReleaseDirectory -Source $videoFoxPresetRoot `
    -Destination (Join-Path $payloadRoot 'presets\preset-video-fox-spirit')
  Copy-Item -LiteralPath $publicPresetImagePath `
    -Destination (Join-Path (Join-Path $payloadRoot 'assets') 'dream-reference.jpg') -Force
  $publicPresetTheme.image = 'dream-reference.jpg'
  [System.IO.File]::WriteAllText(
    (Join-Path (Join-Path $payloadRoot 'assets') 'theme.json'),
    (($publicPresetTheme | ConvertTo-Json -Depth 8) + "`r`n"),
    [System.Text.UTF8Encoding]::new($false)
  )
  [System.IO.File]::WriteAllText(
    (Join-Path $payloadRoot 'VERSION'),
    "$version`r`n",
    [System.Text.UTF8Encoding]::new($false)
  )
  Copy-Item -LiteralPath $bootstrapPath -Destination (Join-Path $stageRoot 'setup-bootstrap.ps1') -Force
  Copy-Item -LiteralPath $licensePath -Destination (Join-Path $stageRoot 'LICENSE.txt') -Force
  Copy-Item -LiteralPath $noticePath -Destination (Join-Path $stageRoot 'NOTICE.md') -Force
  Copy-Item -LiteralPath $innoChineseLanguagePath `
    -Destination (Join-Path $languageRoot 'ChineseSimplified.isl') -Force

  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
  try {
    Copy-ZipEntry -Archive $zip -EntryName "$($manifest.nodeEntry)" `
      -Destination (Join-Path $nodeRoot 'node.exe')
    Copy-ZipEntry -Archive $zip -EntryName "$($manifest.licenseEntry)" `
      -Destination (Join-Path $nodeRoot 'LICENSE')
  } finally {
    $zip.Dispose()
  }
  Write-DreamSkinIcon -Path (Join-Path (Join-Path $payloadRoot 'assets') 'codex-dream-skin.ico')

  $clientPublishRoot = Join-Path $WorkingDirectory 'client-publish'
  & $dotnet publish $clientProjectPath --configuration Release --runtime win-x64 `
    --self-contained true --output $clientPublishRoot --nologo `
    -p:DebugType=None -p:DebugSymbols=false
  if ($LASTEXITCODE -ne 0) { throw ".NET client publish failed with exit code $LASTEXITCODE." }
  $debugSymbols = @(Get-ChildItem -LiteralPath $clientPublishRoot -File -Recurse |
      Where-Object { $_.Extension -ieq '.pdb' })
  if ($debugSymbols.Count -gt 0) {
    throw "Release client publish contains debug symbol files: $($debugSymbols.FullName -join ', ')"
  }
  foreach ($runtimeFile in @('hostfxr.dll', 'hostpolicy.dll', 'coreclr.dll')) {
    if (-not (Test-Path -LiteralPath (Join-Path $clientPublishRoot $runtimeFile) -PathType Leaf)) {
      throw ".NET client publish did not produce the self-contained runtime file: $runtimeFile"
    }
  }
  Copy-ReleaseDirectory -Source $clientPublishRoot -Destination $clientRoot

  $expectedPayloadFiles = @(
    'VERSION',
    'dependencies\MicrosoftEdgeWebView2Setup.exe',
    'assets\dream-reference.jpg',
    'assets\dream-skin.css',
    'assets\renderer-inject.js',
    'assets\compatibility.json',
    'assets\safe-css-policy.json',
    'assets\safe-css-validator.mjs',
    'assets\selectors.json',
    'assets\theme-package-validator.mjs',
    'assets\theme.json',
    'assets\codex-dream-skin.ico',
    'presets\preset-gothic-void-crusade\background.jpg',
    'presets\preset-gothic-void-crusade\theme.json',
    'presets\preset-video-fox-spirit\background.png',
    'presets\preset-video-fox-spirit\background.mp4',
    'presets\preset-video-fox-spirit\theme.css',
    'presets\preset-video-fox-spirit\theme.json',
    'scripts\apply-community-theme.ps1',
    'scripts\check-update.ps1',
    'scripts\common-windows.ps1',
    'scripts\control-center-import.ps1',
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
    'control-center\server.mjs',
    'control-center\theme-store.mjs',
    'control-center\theme-exporter.mjs',
    'control-center\zip-writer.mjs',
    'control-center\public\index.html',
    'control-center\public\app.js',
    'control-center\public\styles.css',
    'control-center\public\video-theme-cover.png',
    'runtime\image-metadata.mjs',
    'runtime\safe-css-validator.mjs',
    'runtime\theme-package-validator.mjs',
    'client\CodexDreamSkin.Client.exe',
    'client\hostfxr.dll',
    'client\hostpolicy.dll',
    'client\coreclr.dll',
    'runtime\node\node.exe',
    'runtime\node\LICENSE'
  )
  foreach ($relative in $expectedPayloadFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $payloadRoot $relative) -PathType Leaf)) {
      throw "Staged installer payload is incomplete: $relative"
    }
  }
  $stagedPublicImage = Join-Path (Join-Path $payloadRoot 'assets') 'dream-reference.jpg'
  $stagedPublicImageHash = (Get-FileHash -LiteralPath $stagedPublicImage -Algorithm SHA256).Hash.ToLowerInvariant()
  $stagedPublicThemePath = Join-Path (Join-Path $payloadRoot 'presets') `
    'preset-gothic-void-crusade\theme.json'
  $stagedPublicThemeHash = (Get-FileHash -LiteralPath $stagedPublicThemePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $stagedPublicTheme = (Read-ReleaseTextFile `
    -Path (Join-Path (Join-Path $payloadRoot 'assets') 'theme.json')) | ConvertFrom-Json
  if ($stagedPublicImageHash -cne $publicPresetImageSha256 -or
    $stagedPublicThemeHash -cne $publicPresetThemeSha256 -or
    "$($stagedPublicTheme.id)" -cne 'preset-gothic-void-crusade' -or
    "$($stagedPublicTheme.image)" -cne 'dream-reference.jpg') {
    throw 'Staged installer payload did not retain the reviewed public release theme.'
  }
  $stagedVideoFoxRoot = Join-Path (Join-Path $payloadRoot 'presets') 'preset-video-fox-spirit'
  foreach ($videoFoxFile in @(
    @{ Name = 'background.png'; Hash = $videoFoxPresetImageSha256 },
    @{ Name = 'background.mp4'; Hash = $videoFoxPresetVideoSha256 },
    @{ Name = 'theme.css'; Hash = $videoFoxPresetCssSha256 },
    @{ Name = 'theme.json'; Hash = $videoFoxPresetThemeSha256 }
  )) {
    $stagedPath = Join-Path $stagedVideoFoxRoot $videoFoxFile.Name
    $stagedHash = (Get-FileHash -LiteralPath $stagedPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($stagedHash -cne $videoFoxFile.Hash) {
      throw "Staged installer payload changed the bundled video fox preset: $($videoFoxFile.Name)"
    }
  }
  $stagedVideoFoxTheme = (Read-ReleaseTextFile -Path (Join-Path $stagedVideoFoxRoot 'theme.json')) | ConvertFrom-Json
  if ("$($stagedVideoFoxTheme.id)" -cne 'preset-video-fox-spirit' -or
    "$($stagedVideoFoxTheme.video.src)" -cne 'background.mp4') {
    throw 'Staged installer payload did not retain the bundled video fox theme contract.'
  }

  $arguments = @(
    "/DAppVersion=$version",
    "/DStageRoot=$stageRoot",
    "/DOutputDir=$OutputDirectory",
    $definitionPath
  )
  Write-Host "Building CodexDreamSkin-Setup-v$version.exe..."
  & $compiler @arguments
  if ($LASTEXITCODE -ne 0) { throw "ISCC.exe failed with exit code $LASTEXITCODE." }

  $artifactPath = Join-Path $OutputDirectory "CodexDreamSkin-Setup-v$version.exe"
  if (-not (Test-Path -LiteralPath $artifactPath -PathType Leaf)) {
    throw "Inno Setup did not create the expected artifact: $artifactPath"
  }
  Write-Host "Windows release created: $artifactPath"
} finally {
  if (-not $KeepWorkingDirectory -and (Test-Path -LiteralPath $WorkingDirectory)) {
    Remove-Item -LiteralPath $WorkingDirectory -Recurse -Force -ErrorAction SilentlyContinue
  } elseif ($KeepWorkingDirectory) {
    Write-Host "Windows release working directory preserved at: $WorkingDirectory"
  }
}
