# Windows 正式安装包打包要求

本文是 Codex Dream Skin Windows 正式安装包的强制打包规范。以后生成可交给用户安装的
`Setup.exe`，必须按照本文执行并保留验证证据；浏览器测试入口、源码安装流程和 macOS
菜单栏应用不适用本文的安装步骤。

当前正式包的唯一构建入口是：

```text
windows/installer/build-release.ps1
```

不得通过手工复制目录、压缩源码、修改旧安装包、只改扩展名或直接运行浏览器启动脚本来
代替正式打包。

## 1. 三类入口必须隔离

项目始终保持三条独立入口：

1. Windows 原生程序：`CodexDreamSkin.Client.exe`，控制中心必须显示在客户端内的 WebView2
   窗口中，不得打开系统浏览器。
2. macOS 原生程序：`macos/` 下的菜单栏应用和脚本，使用 macOS 自己的构建链路。
3. 浏览器测试入口：根目录的 `control-codex-skin.cmd` 和 `start-codex-skin.cmd`，只用于
   开发测试和诊断。

Windows 正式安装器：

- 不得调用 `windows/scripts/install-dream-skin.ps1` 浏览器/源码安装流程。
- 首次安装不得因为部署客户端而要求退出 Codex，也不得在安装阶段修改 Codex 的
  `config.toml`。
- 不得修改官方 `WindowsApps`、`app.asar`、代码签名或系统 ACL。
- 用户点击客户端中的“启动 / 重新应用 Codex”后，才由客户端动作链路处理配置变更和必要
  的 Codex 重启。
- Windows 打包或安装器的修改不得反向改变浏览器测试入口和 macOS 入口。

## 2. 版本和源代码要求

### 2.1 版本矩阵

发布版本必须先确定一个合法的三段式版本 `X.Y.Z`，并同步以下六处版本源：

```text
windows/VERSION
macos/VERSION
macos/package.json                         version
macos/scripts/common-macos.sh              SKIN_VERSION
macos/scripts/injector.mjs                  SKIN_VERSION
windows/scripts/injector.mjs               SKIN_VERSION
```

共享兼容性文件和平台生成副本必须通过现有同步工具更新，不得只手工修改 Windows 或
macOS 的某一份副本：

```powershell
node tools/sync-runtime-assets.mjs --check
```

版本发生变化时，更新绑定旧版本的测试断言、变更日志和发布说明。构建器至少会校验
`windows/VERSION`、`macos/VERSION` 和 `macos/package.json` 一致；其他版本源也必须在提交
前核对。

### 2.2 构建来源

- 正式包必须从待发布的准确 Git 提交或 tag 构建；不能从未记录的临时目录、旧 staging
  目录或修改过的旧 Setup.exe 生成。
- 构建前检查工作树和当前提交，保留用户已有改动，不使用 `git reset --hard`、强推或覆盖
  已公开 tag。
- 共享 renderer、Safe CSS、主题校验和媒体元数据优先从 `runtime/` 同步生成 Windows
  资产，不直接制造 Windows/macOS 漂移。
- 构建输出、临时 staging、缓存和校验日志必须能对应到本次源码提交；不得把密钥、用户
  数据、个人状态文件或本机 Codex 配置打进包内。

## 3. 必须内置和必须排除的内容

### 3.1 必须内置

正式 Windows 包必须由构建脚本校验并包含：

- 自包含 `.NET 8` `win-x64` 客户端：
  `CodexDreamSkin.Client.exe`、`hostfxr.dll`、`hostpolicy.dll`、`coreclr.dll`。
- 固定版本、固定架构的 Node.js 运行时，当前锁定为 Node.js `22.23.1` `win-x64`，包含
  `node.exe` 和对应 `LICENSE`。
- `control-center/` 的服务端、前端和主题导出资源。
- Windows 脚本、共享 runtime、Safe CSS 策略、主题包校验器、图标、许可证和 NOTICE。
- Microsoft WebView2 Evergreen Bootstrapper：必须是微软签名的
  `MicrosoftEdgeWebView2Setup.exe`，仅用于目标机器缺少 WebView2 Runtime 时补装。
- 公开内置预设：
  - `preset-gothic-void-crusade`：图片和 `theme.json`；
  - `preset-video-fox-spirit`：`background.png`、`background.mp4`、`theme.css`、
    `theme.json`。

视频主题的四个文件必须成套存在，且 `theme.json` 的视频引用必须指向包内固定文件名。
所有受审查的预设和发布资源必须使用构建脚本中的 SHA-256 校验，素材发生变化时先更新
审查记录和测试契约，不能静默替换。

### 3.2 必须排除

- 不打包完整固定版 WebView2 浏览器运行时；只携带 Evergreen Bootstrapper。
- 不打包全局 Node.js、开发机 PATH 依赖、源码 checkout、`node_modules`、测试缓存或
  浏览器测试服务。
- 不把 `control-codex-skin.cmd`、`start-codex-skin.cmd` 当作正式客户端启动器。
- 不把用户主题库、用户图片、`%LOCALAPPDATA%\CodexDreamSkin` 状态和 Codex 配置复制进
  安装包。
- 不把无关项目、调试截图、PDB、日志或临时 staging 作为额外安装内容发布。客户端发布
  目录中的文件必须经过最终 payload allowlist 审查；不能因为递归复制整个目录而把调试
  文件或其他无关文件带入安装包。

## 4. 安装器行为要求

### 4.1 安装阶段

- 使用现有 Inno Setup 6 脚本 `windows/installer/codex-dream-skin.iss`。
- 使用 `PrivilegesRequired=lowest` 和 x64 目标；Windows 最低版本保持安装器声明的
  Windows 10。
- 安装快捷方式必须直接指向：
  `CodexDreamSkin.Client.exe`，不能通过 PowerShell 或浏览器启动正式客户端。
- 安装过程必须使用临时 bootstrap 和 completion marker，界面保持可取消；初始化失败时
  必须在复制新文件前报告失败，不能留下半安装状态。
- 首次安装不修改 Codex 配置，不要求关闭 Codex；只有客户端明确执行启动/应用操作时才
  进入 Codex 生命周期。
- 安装完成后默认创建客户端快捷方式；登录启动任务默认不勾选，避免未经同意开机驻留。

### 4.2 更新、重新安装和自定义目录

- 固定 `AppId`、`UsePreviousAppDir=yes` 和 `Uninstallable=yes` 必须保留。
- 同一安装目录更新或重装时，先使用新包携带的 bootstrap 处理旧运行时，再复制新 payload。
- 选择不同安装目录时，必须调用已登记旧目录的卸载程序，不能留下两份安装。
- 旧卸载器损坏时，优先使用新包的修复路径；恢复失败必须停止安装，不能靠删除目录掩盖
  问题。
- 卸载/升级只清理安装程序自己的 `{app}` 和受管 engine；用户主题、图片和状态目录
  `%LOCALAPPDATA%\CodexDreamSkin` 必须保留。
- 卸载需要恢复官方 Codex 外观时，可以按受控流程关闭 Codex；恢复失败必须 fail closed，
  在确认恢复成功前不得删除运行文件。
- 必须验证默认目录和类似 `D:\Program Files\CodexDreamSkin` 的自定义目录，不能假设安装
  目录只有 `LocalAppData` 一种情况。

## 5. 可复现构建流程

### 5.1 构建机前置条件

构建机必须具备：

- Windows PowerShell 5.1 或更高版本；
- .NET 8 SDK，可发布 `win-x64` 自包含客户端；
- Inno Setup 6 `ISCC.exe`；
- 可访问官方 Node.js 下载源和 Microsoft WebView2 下载源，或提供已下载且通过校验的
  本地文件。

构建脚本会校验 Inno Setup 简体中文语言文件、Inno Setup 许可证、Node.js 压缩包、
WebView2 签名、预设资源和客户端发布结果。任一校验失败都必须停止，不得使用“差不多”的
缓存文件继续打包。

### 5.2 推荐命令

从仓库根目录运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned `
  -File .\windows\installer\build-release.ps1 `
  -OutputDirectory .\release\windows-X.Y.Z
```

如果使用本地缓存，必须先校验后显式传入：

```powershell
$node = '.\cache\node-v22.23.1-win-x64.zip'
$webview2 = '.\cache\MicrosoftEdgeWebView2Setup.exe'

Get-FileHash -LiteralPath $node -Algorithm SHA256
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned `
  -File .\windows\installer\build-release.ps1 `
  -OutputDirectory .\release\windows-X.Y.Z `
  -NodeArchivePath $node `
  -WebView2BootstrapperPath $webview2
```

Node.js 压缩包必须与 `windows/installer/node-runtime.json` 完全一致。当前要求为：

```text
URL:    https://nodejs.org/dist/v22.23.1/node-v22.23.1-win-x64.zip
SHA256: 7df0bc9375723f4a86b3aa1b7cc73342423d9677a8df4538aca31a049e309c29
```

SHA-256 不一致时必须重新下载正确版本，不得改 manifest 迎合本地缓存。

### 5.3 输出命名

每次构建使用新的输出目录或确认旧目录中没有同名旧包。正式产物命名固定为：

```text
release/Codex-Skin-Setup-vX.Y.Z.exe
release/SHA256SUMS.txt
```

同一版本的普通重试必须使用同一源码提交和同一版本语义；不能通过重复使用旧版本号
覆盖已经公开的 Release。版本未变化的普通合并不得自动制造新的公开 Release。

## 6. 打包后验收清单

### 6.1 自动测试

至少执行以下检查，并保存输出：

```powershell
node tools/release-doctor.mjs
node tools/sync-runtime-assets.mjs --check
node --test macos/tests/*.test.mjs windows/tests/*.test.mjs tools/*.test.mjs

powershell.exe -NoProfile -ExecutionPolicy RemoteSigned `
  -File .\windows\tests\installer-static.tests.ps1
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned `
  -File .\windows\tests\run-tests.ps1 -EngineOnly
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned `
  -File .\windows\tests\run-tests.ps1

git diff --check
```

只有在准确的发布 tag 已创建或正在验证 tag 对应提交时，才追加
`node tools/release-doctor.mjs --tag vX.Y.Z`；未创建 tag 的本地验证不能伪造 tag 参数。

如果完整 Windows 测试受本机文件系统、权限或外部环境影响失败，必须记录具体失败用例和
原因；不能把 `-EngineOnly` 通过描述成完整回归通过，也不能把失败测试改成无条件跳过。

### 6.2 产物核对

构建日志必须出现 Inno Setup 的：

```text
Successful compile
```

并核对：

- Setup.exe 非空、文件名和版本正确；
- `SHA256SUMS.txt` 与实际 Setup.exe 摘要完全一致；
- staging 中的 bootstrap、客户端、控制中心、动作/导入脚本和视频预设与源码哈希一致；
- Node.js、客户端自包含运行时、WebView2 Bootstrapper 和许可证文件都存在；
- payload 没有完整固定版 WebView2、开发 checkout 或用户数据；
- 版本文件、安装器显示版本、payload `VERSION` 和包文件名一致。

### 6.3 真实 Windows smoke test

在至少一台干净的 Windows x64 环境，以及一台已有旧版和自定义安装目录的环境分别验证：

1. 安装时 Codex 已运行，首次安装不被无关地要求退出 Codex。
2. 桌面/开始菜单快捷方式启动的是客户端，不打开外部浏览器。
3. 客户端能加载控制中心，控制中心能创建、保存、导入、导出和应用主题。
4. 内置“视频狐妖主题”存在，应用后视频、封面和参数生效。
5. 启动/重新应用、暂停、继续显示、完全恢复和托盘流程有真实结果，不停留在加载状态。
6. 中文成功/失败提示不乱码，安装窗口可以拖动。
7. WebView2 缺失时安装器能补装；Node.js 不在系统 PATH 时客户端仍能运行。
8. 同目录升级、不同目录重装、卸载和卸载失败回滚都符合第 4 节要求。
9. 升级/卸载后 `%LOCALAPPDATA%\CodexDreamSkin\themes` 中的用户主题和图片仍在。
10. 关闭客户端窗口只隐藏到托盘；退出客户端后没有遗留其内部服务和测试浏览器进程。

## 7. 提交、推送和发布边界

提交前必须区分以下事实，不得混用：

```text
源码已修改 != 已测试 != 已提交 != 已推送 != Release 已发布 != 用户已可下载
```

推荐顺序：

1. 先完成版本同步、代码和文档审查；
2. 运行自动测试和真实 smoke test；
3. 只 stage 本次打包范围，审查 `git diff --cached`；
4. 提交并推送到目标分支；
5. 从推送后的准确提交创建 tag，并让发布流水线构建 Setup.exe/DMG；
6. 发布前核对 tag、提交、版本、Setup.exe、DMG 和 `SHA256SUMS.txt`；
7. 发布后再次确认 Release 是公开状态且资产可下载。

没有完成 tag、Release 资产和公开状态核对时，只能说“本地包已生成”或“提交已推送”，
不能说“已发布”。

## 8. 发现问题时的处理原则

- 先保留安装包、SHA-256、构建日志、运行时 Doctor 输出和错误截图。
- 先定位实际失败阶段：下载校验、.NET 发布、staging、Inno 编译、安装、启动、应用、
  恢复、卸载或升级；拒绝根据单个退出码猜测。
- 修复后重新运行对应自动测试和真实路径验证，不能只重打包不验证。
- 任何涉及安装、升级、卸载、主题导入或共享 renderer 的修改，都必须检查其他入口和
  既有功能没有被打包流程污染。
