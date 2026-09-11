#ifndef AppVersion
  #error AppVersion must be supplied by build-release.ps1
#endif
#ifndef StageRoot
  #error StageRoot must be supplied by build-release.ps1
#endif
#ifndef OutputDir
  #error OutputDir must be supplied by build-release.ps1
#endif
#ifndef AppName
  #error AppName must be supplied by build-release.ps1
#endif
#ifndef AppPublisher
  #error AppPublisher must be supplied by build-release.ps1
#endif
#ifndef PackageStem
  #error PackageStem must be supplied by build-release.ps1
#endif
#ifndef InstallDirectory
  #error InstallDirectory must be supplied by build-release.ps1
#endif

#define AppUrl "https://dreamskin.cc"
#define PowerShellPath "{sys}\WindowsPowerShell\v1.0\powershell.exe"
#define PersistentPowerShellPath "{win}\System32\WindowsPowerShell\v1.0\powershell.exe"

[Setup]
AppId={{DCCDAF1A-9ACD-4AAB-B55B-DF17EB2CDA2E}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppUrl}
AppSupportURL={#AppUrl}
AppUpdatesURL=https://github.com/staro1314/codex-skin/releases
DefaultDirName={localappdata}\Programs\{#InstallDirectory}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
UsePreviousAppDir=yes
Uninstallable=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
WizardStyle=modern
Compression=lzma2/ultra64
SolidCompression=yes
OutputDir={#OutputDir}
OutputBaseFilename={#PackageStem}-Setup-v{#AppVersion}
SetupIconFile={#StageRoot}\payload\assets\codex-dream-skin.ico
UninstallDisplayIcon={app}\payload\assets\codex-dream-skin.ico
UninstallDisplayName={#AppName}
VersionInfoVersion={#AppVersion}.0
VersionInfoCompany={#AppPublisher}
VersionInfoDescription={#AppName} installer
VersionInfoProductName={#AppName}
VersionInfoProductVersion={#AppVersion}
CloseApplications=no
RestartApplications=no
RestartIfNeededByRun=no
ChangesAssociations=yes
ChangesEnvironment=no
UsePreviousTasks=yes
SetupLogging=yes
MinVersion=10.0

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "chinesesimplified"; MessagesFile: "{#StageRoot}\languages\ChineseSimplified.isl"

[Messages]
english.ConfirmUninstall=Uninstall will stop {#AppName}'s own runtime, restore its saved Codex configuration, remove the {#AppName} runtime, and keep saved themes and images. Codex does not need to be open.%n%nContinue?
chinesesimplified.ConfirmUninstall=卸载将停止 {#AppName} 自身运行时、恢复已保存的 Codex 配置并移除 {#AppName} 运行时；Codex 无需打开，已保存主题和图片会保留。%n%n是否继续？

[Tasks]
Name: "startup"; Description: "Start {#AppName} when I sign in"; GroupDescription: "Additional options:"; Flags: unchecked

[Files]
; Keep a second, temporary copy so initialization runs before Inno starts
; copying/registering the installed application files. The bootstrap is
; launched with a completion marker so Setup can keep its window responsive
; while still aborting before any installed application files are changed.
Source: "{#StageRoot}\setup-bootstrap.ps1"; DestDir: "{tmp}"; Flags: dontcopy noencryption
Source: "{#StageRoot}\payload\*"; DestDir: "{tmp}\payload"; Flags: dontcopy noencryption recursesubdirs createallsubdirs
Source: "{#StageRoot}\setup-bootstrap.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageRoot}\LICENSE.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageRoot}\NOTICE.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageRoot}\payload\*"; DestDir: "{app}\payload"; Flags: ignoreversion recursesubdirs createallsubdirs

[InstallDelete]
; A same-directory reinstall first removes the old managed payload. The
; user-owned theme library is outside {app} and is intentionally preserved.
Type: filesandordirs; Name: "{app}\payload"

[Icons]
Name: "{group}\{#AppName}"; Filename: "{localappdata}\CodexDreamSkin\engine\client\CodexDreamSkin.Client.exe"; Parameters: "--show --server-root ""{localappdata}\CodexDreamSkin\engine"" --runtime-root ""{localappdata}\CodexDreamSkin\engine"""; WorkingDir: "{localappdata}\CodexDreamSkin\engine"; IconFilename: "{app}\payload\assets\codex-dream-skin.ico"
Name: "{userdesktop}\{#AppName}"; Filename: "{localappdata}\CodexDreamSkin\engine\client\CodexDreamSkin.Client.exe"; Parameters: "--show --server-root ""{localappdata}\CodexDreamSkin\engine"" --runtime-root ""{localappdata}\CodexDreamSkin\engine"""; WorkingDir: "{localappdata}\CodexDreamSkin\engine"; IconFilename: "{app}\payload\assets\codex-dream-skin.ico"
Name: "{userstartup}\{#AppName}"; Filename: "{localappdata}\CodexDreamSkin\engine\client\CodexDreamSkin.Client.exe"; Parameters: "--background --server-root ""{localappdata}\CodexDreamSkin\engine"" --runtime-root ""{localappdata}\CodexDreamSkin\engine"""; WorkingDir: "{localappdata}\CodexDreamSkin\engine"; IconFilename: "{app}\payload\assets\codex-dream-skin.ico"; Tasks: startup

[Registry]
Root: HKCU; Subkey: "Software\Classes\dreamskin"; ValueType: string; ValueName: ""; ValueData: "URL:DreamSkin Protocol"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\dreamskin"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\dreamskin\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\payload\assets\codex-dream-skin.ico"
Root: HKCU; Subkey: "Software\Classes\dreamskin\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{#PersistentPowerShellPath}"" -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File ""{localappdata}\CodexDreamSkin\engine\scripts\apply-community-theme.ps1"" ""%1"""

[Run]
Filename: "{#PowerShellPath}"; Parameters: "-NoProfile -STA -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File ""{app}\setup-bootstrap.ps1"" -LaunchTray"; WorkingDir: "{app}"; Description: "Launch {#AppName}"; Flags: nowait postinstall skipifsilent

[Code]
var
  BootstrapInProgress: Boolean;
  PreviousInstallHandled: Boolean;

const
  DreamSkinUninstallKey =
    'Software\Microsoft\Windows\CurrentVersion\Uninstall\{DCCDAF1A-9ACD-4AAB-B55B-DF17EB2CDA2E}_is1';

function ExtractExecutablePath(const CommandLine: String): String;
var
  QuotePosition: Integer;
  SpacePosition: Integer;
begin
  Result := Trim(CommandLine);
  if Result = '' then
    exit;

  if Result[1] = '"' then
  begin
    Delete(Result, 1, 1);
    QuotePosition := Pos('"', Result);
    if QuotePosition <= 0 then
      Result := ''
    else
      SetLength(Result, QuotePosition - 1);
  end
  else
  begin
    SpacePosition := Pos(' ', Result);
    if SpacePosition > 0 then
      SetLength(Result, SpacePosition - 1);
  end;
end;

function GetPreviousUninstaller(
  var UninstallerPath: String;
  var PreviousInstallDir: String
): Boolean;
var
  CommandLine: String;
  Candidate: String;
begin
  Result := False;
  UninstallerPath := '';
  PreviousInstallDir := '';
  CommandLine := '';

  if not RegQueryStringValue(
    HKEY_CURRENT_USER,
    DreamSkinUninstallKey,
    'UninstallString',
    CommandLine
  ) then
    RegQueryStringValue(
      HKEY_LOCAL_MACHINE,
      DreamSkinUninstallKey,
      'UninstallString',
      CommandLine
    );

  Candidate := ExtractExecutablePath(CommandLine);
  if Candidate = '' then
    exit;
  if CompareText(ExtractFileExt(Candidate), '.exe') <> 0 then
    exit;
  if CompareText(Copy(ExtractFileName(Candidate), 1, 4), 'unin') <> 0 then
    exit;
  if not FileExists(Candidate) then
    exit;

  UninstallerPath := Candidate;
  PreviousInstallDir := ExtractFileDir(Candidate);
  Result := PreviousInstallDir <> '';
end;

function PowerShellArguments(
  const ScriptPath: String;
  const ActionArguments: String;
  const CompletionFile: String;
  const Silent: Boolean
): String;
begin
  Result := '-NoProfile -STA -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File ' +
    AddQuotes(ScriptPath) + ' ' + ActionArguments;
  if CompletionFile <> '' then
    Result := Result + ' -CompletionFile ' + AddQuotes(CompletionFile);
  if Silent then
    Result := Result + ' -Silent';
end;

function GetBootstrapPowerShellPath(): String;
begin
  { Prefer the native PowerShell path for the 32-bit Inno Setup build. On
    systems/installers where the Sysnative alias is unavailable, use the
    redirected system directory that contains the 32-bit Windows PowerShell. }
  Result := ExpandConstant('{sysnative}\WindowsPowerShell\v1.0\powershell.exe');
  if not FileExists(Result) then
    Result := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
end;

function RunBootstrap(
  const ScriptPath: String;
  const ActionArguments: String;
  const Silent: Boolean;
  var ExitCode: Integer
): Boolean;
var
  CompletionFile: String;
  LaunchCode: Integer;
  CompletionData: AnsiString;
  ProgressPage: TOutputProgressWizardPage;
  ProgressPosition: Integer;
  PowerShellPath: String;
begin
  PowerShellPath := GetBootstrapPowerShellPath();
  if IsUninstaller or Silent then
  begin
    Result := Exec(
      PowerShellPath,
      PowerShellArguments(ScriptPath, ActionArguments, '', Silent),
      ExtractFileDir(ScriptPath),
      SW_HIDE,
      ewWaitUntilTerminated,
      ExitCode
    );
    exit;
  end;

  CompletionFile := ExpandConstant('{tmp}\codex-dream-skin-bootstrap.complete');
  DeleteFile(CompletionFile);
  if not Exec(
    PowerShellPath,
    PowerShellArguments(ScriptPath, ActionArguments, CompletionFile, False),
    ExtractFileDir(ScriptPath),
    SW_HIDE,
    ewNoWait,
    LaunchCode
  ) then
  begin
    ExitCode := LaunchCode;
    Result := False;
    exit;
  end;

  BootstrapInProgress := True;
  WizardForm.CancelButton.Enabled := False;
  ProgressPage := CreateOutputProgressPage(
    '正在准备安装',
    '正在初始化 {#AppName}，请稍候。'
  );
  ProgressPage.Show;
  try
    ProgressPage.SetText('正在初始化 {#AppName}', '正在准备运行时和客户端文件。');
    ProgressPosition := 0;
    while not FileExists(CompletionFile) do
    begin
      { SetProgress keeps the Inno wizard message loop active while PowerShell runs. }
      ProgressPage.SetProgress(ProgressPosition, 100);
      ProgressPosition := (ProgressPosition + 5) mod 100;
      Sleep(50);
    end;
    if not LoadStringFromFile(CompletionFile, CompletionData) then
    begin
      ExitCode := 1;
      Result := False;
      exit;
    end;
    ExitCode := StrToIntDef(Trim(CompletionData), -1);
    Result := (ExitCode >= 0);
  finally
    ProgressPage.Hide;
    WizardForm.CancelButton.Enabled := True;
    BootstrapInProgress := False;
    DeleteFile(CompletionFile);
  end;
end;

procedure CancelButtonClick(CurPageID: Integer; var Cancel, Confirm: Boolean);
begin
  if BootstrapInProgress then
  begin
    Cancel := False;
    Confirm := False;
  end;
end;

function InstallInitializationFailureMessage(const ExitCode: Integer): String;
begin
  Result := '{#AppName} could not be initialized (exit code ' +
    IntToStr(ExitCode) + '). No installed application files were changed.';
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  PreviousUninstaller: String;
  PreviousInstallDir: String;
  TemporaryBootstrap: String;
  ExitCode: Integer;
begin
  Result := '';
  if PreviousInstallHandled then
    exit;
  PreviousInstallHandled := True;

  if not GetPreviousUninstaller(PreviousUninstaller, PreviousInstallDir) then
    exit;

  { The managed engine is outside the Inno application directory. Before
    replacing an existing install, release only {#AppName}-owned processes;
    do not invoke an uninstaller or restore/inspect Codex. }
  ExtractTemporaryFiles('{tmp}\setup-bootstrap.ps1');
  ExtractTemporaryFiles('{tmp}\payload\*');
  TemporaryBootstrap := ExpandConstant('{tmp}\setup-bootstrap.ps1');
  if not RunBootstrap(
    TemporaryBootstrap,
    '-PrepareInstall -InstalledAppRoot ' + AddQuotes(PreviousInstallDir),
    WizardSilent,
    ExitCode
  ) then
  begin
    Result := '无法准备旧版 {#AppName} 运行时，安装过程未修改文件。';
    exit;
  end;
  if ExitCode <> 0 then
    Result := '无法准备旧版 {#AppName} 运行时（退出码 ' +
      IntToStr(ExitCode) + '），安装过程未修改文件。';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ExitCode: Integer;
  TemporaryBootstrap: String;
begin
  if CurStep <> ssInstall then
    exit;

  ExtractTemporaryFiles('{tmp}\setup-bootstrap.ps1');
  ExtractTemporaryFiles('{tmp}\payload\*');
  TemporaryBootstrap := ExpandConstant('{tmp}\setup-bootstrap.ps1');
  if not RunBootstrap(TemporaryBootstrap, '-Install', WizardSilent, ExitCode) then
    RaiseException('{#AppName} initialization could not be started (PowerShell error ' +
      IntToStr(ExitCode) + ': ' + SysErrorMessage(ExitCode) + ').');
  if ExitCode <> 0 then
    RaiseException(InstallInitializationFailureMessage(ExitCode));
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ExitCode: Integer;
begin
  if CurUninstallStep <> usUninstall then
    exit;

  { The standard Inno confirmation has completed before usUninstall. }
  if not RunBootstrap(ExpandConstant('{app}\setup-bootstrap.ps1'), '-Uninstall', True, ExitCode) then
    RaiseException('{#AppName} restoration could not be started. No installed files were removed.');
  if ExitCode <> 0 then
    RaiseException(
      '{#AppName} could not restore Codex (exit code ' +
      IntToStr(ExitCode) + '). No installed files were removed.'
    );
end;
