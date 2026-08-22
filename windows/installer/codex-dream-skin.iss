#ifndef AppVersion
  #error AppVersion must be supplied by build-release.ps1
#endif
#ifndef StageRoot
  #error StageRoot must be supplied by build-release.ps1
#endif
#ifndef OutputDir
  #error OutputDir must be supplied by build-release.ps1
#endif

#define AppName "Codex-Skin"
#define AppPublisher "Codex-Skin contributors"
#define AppUrl "https://dreamskin.cc"
#define PowerShellPath "{sysnative}\WindowsPowerShell\v1.0\powershell.exe"
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
DefaultDirName={localappdata}\Programs\CodexDreamSkin
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
OutputBaseFilename=Codex-Skin-Setup-v{#AppVersion}
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
english.ConfirmUninstall=Uninstall will close Codex, restore its original appearance, remove the Dream Skin runtime, and keep saved themes and images.%n%nContinue?
chinesesimplified.ConfirmUninstall=卸载将关闭 Codex、恢复官方外观并移除 Dream Skin 运行时；已保存主题和图片会保留。%n%n是否继续？

[Tasks]
Name: "startup"; Description: "Start Codex-Skin when I sign in"; GroupDescription: "Additional options:"; Flags: unchecked

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
Name: "{group}\Codex-Skin"; Filename: "{localappdata}\CodexDreamSkin\engine\client\CodexDreamSkin.Client.exe"; Parameters: "--show --server-root ""{localappdata}\CodexDreamSkin\engine"" --runtime-root ""{localappdata}\CodexDreamSkin\engine"""; WorkingDir: "{localappdata}\CodexDreamSkin\engine"; IconFilename: "{app}\payload\assets\codex-dream-skin.ico"
Name: "{userdesktop}\Codex-Skin"; Filename: "{localappdata}\CodexDreamSkin\engine\client\CodexDreamSkin.Client.exe"; Parameters: "--show --server-root ""{localappdata}\CodexDreamSkin\engine"" --runtime-root ""{localappdata}\CodexDreamSkin\engine"""; WorkingDir: "{localappdata}\CodexDreamSkin\engine"; IconFilename: "{app}\payload\assets\codex-dream-skin.ico"
Name: "{userstartup}\Codex-Skin"; Filename: "{localappdata}\CodexDreamSkin\engine\client\CodexDreamSkin.Client.exe"; Parameters: "--background --server-root ""{localappdata}\CodexDreamSkin\engine"" --runtime-root ""{localappdata}\CodexDreamSkin\engine"""; WorkingDir: "{localappdata}\CodexDreamSkin\engine"; IconFilename: "{app}\payload\assets\codex-dream-skin.ico"; Tasks: startup

[Registry]
Root: HKCU; Subkey: "Software\Classes\dreamskin"; ValueType: string; ValueName: ""; ValueData: "URL:DreamSkin Protocol"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\dreamskin"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\dreamskin\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\payload\assets\codex-dream-skin.ico"
Root: HKCU; Subkey: "Software\Classes\dreamskin\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{#PersistentPowerShellPath}"" -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File ""{localappdata}\CodexDreamSkin\engine\scripts\apply-community-theme.ps1"" ""%1"""

[Run]
Filename: "{#PowerShellPath}"; Parameters: "-NoProfile -STA -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File ""{app}\setup-bootstrap.ps1"" -LaunchTray"; WorkingDir: "{app}"; Description: "Launch Codex-Skin"; Flags: nowait postinstall skipifsilent

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
begin
  if IsUninstaller or Silent then
  begin
    Result := Exec(
      ExpandConstant('{#PowerShellPath}'),
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
    ExpandConstant('{#PowerShellPath}'),
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
    '正在初始化 Codex-Skin，请稍候。'
  );
  ProgressPage.Show;
  try
    ProgressPage.SetText('正在初始化 Codex-Skin', '正在准备运行时和客户端文件。');
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
  Result := 'Codex-Skin could not be initialized (exit code ' +
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

  { When the selected directory is the registered old directory, use the
    current package's bootstrap. This repairs an old/broken bootstrap before
    Inno replaces its payload. A different selected directory must use the
    registered uninstaller so the old directory is not orphaned. }
  if CompareText(PreviousInstallDir, ExpandConstant('{app}')) = 0 then
  begin
    ExtractTemporaryFiles('{tmp}\setup-bootstrap.ps1');
    ExtractTemporaryFiles('{tmp}\payload\*');
    TemporaryBootstrap := ExpandConstant('{tmp}\setup-bootstrap.ps1');
    if not RunBootstrap(TemporaryBootstrap, '-Uninstall', WizardSilent, ExitCode) then
    begin
      Result := '无法卸载当前 Codex-Skin 安装，安装过程未修改文件。请关闭 Dream Skin 后重试。';
      exit;
    end;
    if ExitCode <> 0 then
      Result := '无法卸载当前 Codex-Skin 安装（退出码 ' +
        IntToStr(ExitCode) + '），安装过程未修改文件。';
    exit;
  end;

  if not Exec(
    PreviousUninstaller,
    '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART',
    PreviousInstallDir,
    SW_HIDE,
    ewWaitUntilTerminated,
    ExitCode
  ) then
  begin
    Result := '无法启动旧版 Codex-Skin 卸载程序，安装过程未修改文件。';
    exit;
  end;
  if ExitCode <> 0 then
    Result := '旧版 Codex-Skin 卸载失败（退出码 ' +
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
    RaiseException('Codex-Skin initialization could not be started.');
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
    RaiseException('Codex-Skin restoration could not be started. No installed files were removed.');
  if ExitCode <> 0 then
    RaiseException(
      'Codex-Skin could not restore Codex (exit code ' +
      IntToStr(ExitCode) + '). No installed files were removed.'
    );
end;
