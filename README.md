# Codex Dream Skin

Codex Dream Skin 是一个面向官方 Codex Desktop 的外部主题与换肤工具。它通过本机回环 CDP 连接 Codex 的渲染进程，注入受控的 CSS 和装饰 DOM，在不修改官方安装包、`app.asar` 或代码签名的前提下，给 Codex 增加可替换的背景、透明层和主题视觉。

它保留 Codex 原生的侧栏、项目选择、建议卡、任务内容、输入框和菜单交互，不使用整窗截图覆盖，也不改写 API Key、Base URL 或模型供应商配置。

当前代码版本：`1.5.12`。项目同时包含 Windows 和 macOS 实现，并将共享渲染逻辑、主题校验和媒体元数据处理收敛在 `runtime/`。

## 能力概览

- 本机 CDP 注入：启动并验证官方 Codex 渲染页，再注入主题运行时。
- 原生界面保留：装饰层使用 `pointer-events: none`，不遮挡真实控件。
- 自适应背景：根据图片亮度、焦点、左右安全区和宽高比生成可读性层。
- 主题包导入：支持受校验的 `.zip` 主题包和可信的本地简化主题目录。
- 安全 CSS：主题 CSS 经过本地策略校验，只能作用于注册的主题部件。
- 主题管理：支持导入、保存、切换、暂停、重新应用和完整恢复官方外观。
- 双平台运行：Windows 托盘与 PowerShell 流程，macOS 原生菜单栏与脚本流程。
- 安装与恢复：提供安装器、运行时复制、进程身份校验、日志和回滚路径。
- 自动化验证：覆盖主题包、渲染注入、选择器、窗口可见性、恢复和发布资产。

## 工作原理

```text
Dream Skin 启动器 / 托盘 / 菜单栏
        |
        | 启动官方 Codex，并将 CDP 限制到 127.0.0.1
        v
官方 Codex Desktop
        |
        | CDP WebSocket：发现 renderer、注入 CSS + JavaScript、验证结果
        v
原生 Codex 控件 + 主题背景 / 透明层 / 装饰效果
```

主题图片和 CSS 在本机读取、校验并注入，不上传到外部 API。启动器会检查目标进程是否属于当前注册的官方 Codex 包，注入器会检查 CDP 端口、浏览器身份和预期 renderer 标记。

## 平台

| 平台 | 入口 | 主要能力 |
|---|---|---|
| Windows | [`windows/README.md`](./windows/README.md) | Store 包发现、PowerShell 安装器、系统托盘、CDP 启动/验证/恢复 |
| macOS | [`macos/README.md`](./macos/README.md) | 原生菜单栏应用、签名运行时校验、DMG、主题编辑和恢复 |
| Shared | [`runtime/`](./runtime/) | 渲染注入、Safe CSS、主题包、图片元数据和跨平台同步源 |

普通用户应优先使用 [GitHub Releases](https://github.com/Fei-Away/Codex-Dream-Skin/releases) 中对应平台的安装包。源码安装和诊断流程请分别阅读平台 README。

## 从源码运行

### Windows

关闭 Codex 后，在 `windows/` 目录运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\scripts\install-dream-skin.ps1
```

安装后通过 `Codex Dream Skin` 快捷方式启动，或运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\scripts\start-dream-skin.ps1 -PromptRestart
```

也可以从仓库根目录使用快捷启动入口：

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\start-codex-skin.ps1
```

启动并执行一次脱敏 DOM/视觉状态快照：

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\start-codex-skin.ps1 -Capture
```

启动后持续采集首页、会话页、菜单和状态变化：

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\start-codex-skin.ps1 -Watch
```

该入口只调用 `windows/scripts/start-dream-skin.ps1`，不会修改官方 Codex 文件；采集器只记录脱敏 DOM 结构、固定状态枚举和布尔信号，不记录消息文本。

验证当前窗口：

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\scripts\verify-dream-skin.ps1 `
  -ScreenshotPath "$env:TEMP\codex-dream-skin.png"
```

### macOS

macOS 的源码入口、DMG 安装和菜单栏流程见 [`macos/README.md`](./macos/README.md)。源码测试入口为：

```bash
cd macos
./tests/run-tests.sh
```

## Phase 1 Doctor

Doctor 会检查平台运行时文件、版本矩阵、共享契约同步状态和可选的活跃会话。JSON 输出包含稳定的 `schema`、`status`、`checks`、错误码和 `nextAction`：

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\windows\scripts\doctor-dream-skin.ps1 -Json
```

```bash
./macos/scripts/doctor-macos.sh --json
./macos/scripts/doctor-macos.sh --json --require-live
```

共享兼容性矩阵位于 [`runtime/compatibility.json`](./runtime/compatibility.json)，平台副本由 `tools/sync-runtime-assets.mjs` 生成；源码维护者可运行 `node tools/sync-runtime-assets.mjs --check` 验证同步状态。

## 主题包

正式主题包包含：

```text
manifest.json
theme.json
theme.css
background.webp | background.jpg | background.png
background.mp4 | background.webm # 可选；必须配合背景图作为封面
LICENSE.txt                 # 可选
manifest.sig                # 预留字段
```

本地简化主题至少包含非空的 `theme.json`、非空的 `theme.css` 和 `theme.json` 引用的背景图；需要动态背景时可再加入一个 `background.mp4` 或 `background.webm`。导入器会拒绝路径穿越、链接/reparse、嵌套压缩包、未注册文件、超限资源和不符合主题契约的内容。

图片主题应是纯背景，不应把 Codex 窗口、侧栏、输入框、按钮、文字或截图直接烘焙进图片。主题元数据可以控制：

- `appearance`：跟随系统、浅色或深色。
- `art.focusX` / `art.focusY`：图片焦点位置。
- `art.safeArea`：原生内容应避让的安全区。
- `art.taskMode`：任务页使用环境、横幅、全强度或关闭模式。

### 动态视频背景

视频背景是图片主题的可选增强层，图片始终是必需的封面和降级路径：

```json
{
  "image": "background.jpg",
  "video": {
    "src": "background.mp4",
    "performance": "balanced",
    "muted": true,
    "loop": true
  }
}
```

视频只允许使用主题包内固定文件名的 MP4/WebM，大小上限为 32 MiB；视频字节不会编码进注入 payload，只通过受控本地文件 URL 加载。`eco` 只显示封面，`balanced` 使用元数据预加载，`immersive` 允许自动预加载。页面隐藏、窗口失焦、系统偏好减少动态效果、电量过低或播放错误时会自动暂停并回退到封面；视频始终静音、循环且不拦截原生控件交互。

### Codex 状态视觉桥

渲染器会把路由、受限 DOM 语义信号和可选事件桥归一化为 `data-dream-visual-state`：
`unknown`、`home`、`idle`、`thinking`、`executing`、`approval`、`success`、`error`、`settings`、`overlay`。路由状态优先，未识别的任务状态安全回退到 `idle`；状态特效只作用于装饰视频层，不修改原生控件的交互。

未来的 Codex 事件适配层可以在页面内发送：

```js
window.dispatchEvent(new CustomEvent("codex-dream-skin:visual-state", {
  detail: { state: "executing" },
}));
```

清除显式状态覆盖使用 `window.__CODEX_DREAM_SKIN_STATE__.clearVisualState()`。非法状态会被拒绝，事件桥不会接受远程 URL、脚本或其他执行指令。

## 安全边界

- 不修改官方 `.app`、`app.asar`、`WindowsApps` 或代码签名。
- CDP 只绑定 `127.0.0.1`，不对局域网开放。
- CDP 本身没有同用户身份认证；主题运行时只应和可信的本机软件一起使用。
- 主题导入、图片处理、Safe CSS 和社区主题下载均采用 fail-closed 校验。
- 安装、启动、切换、暂停、恢复和卸载使用受控状态与进程身份检查。
- 完整恢复会关闭已保存的 CDP 会话，并从官方普通入口重新打开 Codex。
- 图片、视频、字体和人物素材需要单独确认版权、商标和再分发许可。

详细威胁模型和操作边界见 [`SECURITY.md`](./SECURITY.md)。

## 仓库结构

```text
codex-skin/
├── docs/       项目记录、平台路径、安装和素材说明
├── macos/      macOS 菜单栏、安装、主题和测试
├── runtime/    跨平台共享渲染与主题校验源
├── tools/      选择器、运行时同步和诊断工具
├── windows/    Windows 安装、托盘、CDP 注入、验证和测试
├── AGENTS.md   维护、安全和发布约束
└── SECURITY.md 威胁模型与安全边界
```

修改 `runtime/` 共享源后，应使用现有同步工具生成平台资产，不要只改某一个平台的生成副本。

## 验证

Node 便携回归：

```powershell
node --test macos/tests/*.test.mjs windows/tests/*.test.mjs tools/*.test.mjs
```

Windows 回归：

```powershell
powershell -NoProfile -File windows\tests\run-tests.ps1
```

macOS 回归：

```bash
bash macos/tests/run-tests.sh
```

真实平台验证还需要对应的官方 Codex、系统运行时和图形环境。截图检查、首页/任务页交互和恢复流程以 [`windows/references/qa-inventory.md`](./windows/references/qa-inventory.md) 及 macOS 对应文档为准。

## 分阶段路线

当前仓库已经具备稳定的 CDP 换肤、主题包、安全校验、双平台安装、恢复基础和受控视频背景运行时。后续扩展按以下顺序推进：

1. 固化当前版本的跨平台基线和文档。
2. 完善视频背景在真实 macOS/Windows Codex 环境中的播放验证和性能采样。
3. 将 Codex 页面状态归一化为可驱动视觉的状态事件。
4. 扩展主题协议和主题编辑能力，保持 Safe CSS 和资源校验。
5. 完善版本兼容矩阵、诊断、回滚、安装器和发布验证。

详细计划见 [`task_plan.md`](./task_plan.md)，当前事实和风险见 [`findings.md`](./findings.md)。

## 许可

软件代码使用 MIT，详见 [`LICENSE`](./LICENSE)。第三方运行时、主题图片、赞助素材、人物/IP 素材和其他资产以各自的 NOTICE、LICENSE 或来源说明为准。项目不是 OpenAI 官方产品。
