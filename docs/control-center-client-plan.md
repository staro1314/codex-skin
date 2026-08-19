# Codex Dream Skin 控制中心客户端化方案

日期：2026-08-18
范围：Windows 控制中心客户端化；macOS 菜单栏应用暂不改造。项目入口分为三类并严格隔离：Windows 原生程序、macOS 原生程序、浏览器测试入口。

## 目标

现有浏览器只是开发测试载体，最终产品不再打开系统浏览器。

正式客户端流程：

1. 双击 `CodexDreamSkin.Client.exe`。
2. 客户端启动隐藏的本地服务和后台托盘。
3. 在客户端窗口内显示现有控制中心界面。
4. 用户在客户端内完成主题预览、编辑、上传、保存、应用、暂停、恢复、导出和启动 Codex。
5. 点击窗口关闭时隐藏到托盘，不退出后台服务。
6. 托盘菜单可以重新显示客户端或退出客户端。

客户端使用嵌入式 WebView2 承载现有 HTML/CSS/JS，但不会启动外部浏览器。

## 客户端架构

新增 .NET 8 Windows 客户端：

```text
CodexDreamSkin.Client.exe
├── 主窗口
├── WebView2 控制中心
├── Windows 托盘图标
├── Node 控制中心服务生命周期管理
├── PowerShell 启动/换肤调用
└── 安装目录与进程身份校验
```

客户端职责：

- 启动或复用内置 Node 服务。
- 将控制中心页面加载到 WebView2。
- 禁止 WebView2 跳转到外部页面。
- 拦截文件上传、主题 ZIP 导出和下载。
- 窗口关闭时隐藏到托盘。
- 托盘菜单提供“显示客户端、启动 Codex、暂停/继续、完全恢复、退出”。
- 退出时只关闭客户端服务和托盘，不改变当前 Codex 皮肤；“完全恢复 Codex”仍是独立的明确操作。
- 使用单实例 Mutex，避免多个客户端和多个控制中心服务同时运行。

客户端使用系统安装的 WebView2 Evergreen Runtime；Setup 只携带 Microsoft WebView2 Evergreen Bootstrapper，在运行时缺少依赖时按用户权限补装。这样不会把整套固定版浏览器运行时复制进 Dream Skin 安装包，也不会打开外部浏览器。

## 控制中心改造

现有控制中心的功能整体迁移到嵌入式客户端中，保留现有界面和业务能力：

- 主题库、搜索和筛选。
- 图片/视频预览。
- 构图、安全区、玻璃表面和状态特效编辑。
- 新建、上传、保存、删除和应用主题。
- 暂停与继续显示皮肤。
- Windows/macOS 分享包导出。
- 启动或重新应用 Codex。

增加内部客户端动作：

```http
POST /api/action
{
  "action": "start"
}
```

该动作只调用受校验的 `start-dream-skin.ps1 -PromptRestart`，不接收任意脚本路径、命令参数或外部 URL。

Node 服务仍作为客户端内部后台引擎存在，但用户不会看到服务窗口，也不会直接接触服务端口。生产模式增加 `--embedded` 和 `--runtime-root` 参数；开发模式继续允许浏览器访问，供测试使用。

## 打包与入口

安装阶段只属于 Windows 原生程序链路：它复制客户端和受管运行时，不调用
`windows/scripts/install-dream-skin.ps1`，不修改 Codex `config.toml`，也不要求
Codex 退出。用户在客户端中点击启动皮肤后，才由客户端动作链路负责配置变更和
必要的 Codex 重启。

浏览器测试入口（仓库根目录 `control-codex-skin.cmd`、
`start-codex-skin.cmd`）继续保留原有外部浏览器和源码脚本流程；macOS 入口继续
使用 `macos/` 自己的菜单栏/脚本流程。Windows 打包流程的变化不得反向修改这两类入口。

安装包继续使用现有 Inno Setup：

```text
CodexDreamSkin-Setup-vX.Y.Z.exe
```

安装后的目录增加：

```text
engine/
├── CodexDreamSkin.Client.exe
├── control-center/
├── runtime/
├── scripts/
├── assets/
├── presets/
└── VERSION
```

安装器快捷方式统一指向客户端：

- “Codex Dream Skin”：打开客户端窗口。
- 登录启动：以后台托盘模式启动，不自动显示窗口。
- 安装完成后：启动客户端窗口。

现有两个 `.cmd` 不再是最终用户入口：

- `control-codex-skin.cmd`：保留为浏览器测试工具。
- `start-codex-skin.cmd`：保留为底层启动诊断工具。

README 和安装文档需要明确标注：正式用户使用安装后的客户端，浏览器启动脚本只用于开发测试。

## 验收与测试

必须验证：

- 客户端启动后不调用系统浏览器。
- WebView2 能加载控制中心并完成所有现有操作。
- 窗口关闭后客户端隐藏到托盘，Node 服务和换肤服务不被误停。
- 从托盘重新打开客户端时复用原控制中心服务。
- “启动 Codex”行为与原 `start-codex-skin.cmd` 一致。
- 图片、视频、ZIP 上传和导出在 WebView2 中正常工作。
- 客户端单实例、服务复用和异常服务重启。
- 缺失 WebView2、损坏运行时、异常 PID、路径穿越和非本程序进程均 fail closed。
- 完整恢复、卸载和升级仍保留原有回滚与主题数据。
- 浏览器测试入口继续可用，但不作为正式产品验收依据。
- 运行 .NET 客户端测试、Node 控制中心测试、Windows PowerShell 测试和最终 Setup.exe Windows 构建验证。

## 约束

- 不修改官方 Codex、`app.asar`、WindowsApps 或签名。
- CDP 继续只绑定 `127.0.0.1`。
- 继续使用现有主题校验、Safe CSS、回滚和运行时完整性检查。
- 本阶段只改造 Windows 控制中心客户端，macOS 菜单栏应用不纳入范围。
