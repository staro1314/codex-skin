# Codex 客户端升级跟随改造手册

本手册用于 Codex Desktop 客户端升级后，按证据让 Codex Dream Skin 跟随升级。它是执行清单，不是“看到界面变化就猜 selector、改 CSS”的快速修复指南。

## 0. 当前基线

- 项目版本：`1.5.12`
- Injector protocol：`3`
- 共享源：`runtime/`
- 双端生成资产：`macos/assets/`、`windows/assets/`
- 选择器契约：`tools/selectors.json`
- 兼容矩阵：`runtime/compatibility.json`
- 未知 Codex 版本：必须按 `conservative` 处理

当前选择器矩阵有 macOS Codex `26.727.40816` 的真实 renderer 证据；历史 `26.715` 只有快照证据，Windows 对应版本仍需真实 renderer 验收。fixture 不能替代真实客户端证据。

## 1. 不可改变的项目边界

### 1.1 运行方式

项目只通过本机回环 CDP 连接官方 Codex renderer，注入 CSS、受控装饰 DOM 和本地媒体。不得修改官方 Codex、`app.asar`、代码签名、WindowsApps ACL 或官方安装文件。

CDP 必须：

- 只监听 `127.0.0.1`；
- 校验目标属于当前注册的官方 Codex 安装；
- 校验同端口、同页面和 Browser ID；
- 对 PID、可执行文件、命令行和启动时间做身份复核；
- 目标不匹配、端口被复用或验证失败时 fail closed 并回滚。

### 1.2 原生控件优先

侧栏、项目选择器、任务内容、消息、输入框、菜单、滚动条、焦点、键盘输入、审批控件和原生弹层必须继续由 Codex 绘制和交互。

装饰层必须保持 `pointer-events: none`，不能用截图伪造 Codex UI，不能让主题背景覆盖真实控件。

### 1.3 共享源优先

修改共享逻辑时只改 `runtime/` 和 `tools/selectors.json` 等源文件，然后生成双端资产：

```powershell
node tools/sync-runtime-assets.mjs
node tools/sync-runtime-assets.mjs --check
```

禁止只改 `macos/assets/` 或 `windows/assets/`。平台副本必须保持同步。

## 2. Codex 升级最容易影响的功能点

| 区域 | 必须保持的行为 | 升级时需要重新取证 |
|---|---|---|
| 启动/CDP | 动态发现官方安装、校验身份、回滚安全 | Appx 路径、签名、Browser ID、端口、目标 URL |
| 主界面 | 连续背景、原生控件可用 | `main`、侧栏、顶栏、任务页结构 |
| 首页 | 背景、安全区、建议卡、项目工具行、输入框不被挤出 | `home-icon`、`[role=main]`、渐进渲染顺序 |
| 任务页 | 消息高对比度、背景更安静、输入框可达 | thread surface、message、composer |
| 设置页 | macOS/Windows 结构差异均可安全降级 | 是否替换整个 shell、设置面板锚点 |
| Overlay | 菜单/dialog/popper 定位和交互不变 | portal 位置、`position`、`z-index`、遮罩尺寸 |
| 状态桥 | unknown/idle/thinking/executing/approval 等状态保守归一化 | 真实 DOM 属性、事件名、状态出现时机 |
| 视频 | 播放、poster、暂停、恢复、错误回退 | CSP、媒体 URL、Blob、renderer 生命周期 |
| 主题导入 | 普通 ZIP、Safe CSS、哈希和路径安全 | 客户端版本、manifest、资源上限 |
| 恢复 | 清除注入、关闭 CDP、恢复官方外观 | 新旧进程身份、配置格式和回滚路径 |

选择器优先级必须是：

```text
data-testid > role/语义属性 > 稳定类名 > CSS Module 前缀
```

禁止依赖完整 CSS Module hash、脆弱的纯结构路径或没有实测证据的新版类名。

`L1` 选择器缺失表示主功能可能受损；`L2` 缺失只能精修降级，不能阻断基础皮肤。

## 3. 请求批准窗口的特殊边界

必须把以下两类对象分开验证：

1. 页面内 `[role="dialog"]`、`[aria-modal="true"]` 或其他页面 DOM 弹层；
2. Codex 外层原生请求批准 chrome，例如“终端 / 允许一次”卡片。

当前实机记录已经确认：原生请求批准卡片不在主页面 DOM、可见 Shadow DOM 或 CDP page target 中。页面侧 `session.evaluate()` 只能修改页面文档，不能修改该原生宿主层。

因此：

- 页面内 dialog 可以通过本项目 CSS 调整；
- 原生请求批准卡片不能靠增加 CSS selector 调整；
- 不得把 `approval` 状态名当作审批窗口节点；
- 不得为了压住原生黑带而给整个主工作区加不透明背景；
- 黑带必须先通过 A/B 取证确认来自页面 CSS、原生宿主遮罩还是合成层；
- 只有 Codex 提供原生审批层材质入口时，项目才可能改原生卡片本体；否则应记录为项目边界，而不是提交猜测性补丁。

页面侧曾确认过一类底部黑带来自共享 CSS 的 `--ds-task-fade`。这类页面渐变可以修复，但不能据此推断原生审批卡本体可被 CSS 修改。

## 4. 每次升级的标准流程

### 第 1 步：保存升级前基线

记录以下内容：

- Codex 精确版本和平台；
- Dream Skin 版本、分支和工作区状态；
- 当前主题、活动主题和恢复状态；
- Doctor JSON；
- 首页、任务页、设置页和弹层截图；
- CDP 端口、Browser ID、injector PID 和日志位置。

先检查用户未提交改动，禁止 reset、checkout 或覆盖这些改动。

### 第 2 步：启动新 Codex 并做身份验证

确认：

- Windows 动态解析当前 `OpenAI.Codex` Store 包；
- macOS 重新校验官方签名、Team ID、架构和受信任 Node；
- CDP 仍是 loopback；
- Browser ID、端口和 renderer target 没有被其他进程复用；
- 旧 PID 不会被误杀；
- 启动、注入、验证失败都能回滚到无调试口的普通 Codex。

### 第 3 步：采集真实 renderer 证据

至少采集：

- home；
- thread；
- settings；
- overlay/menu/popper；
- 页面内 dialog；
- composer；
- approval 状态；
- reload 后页面；
- 窄窗口；
- 视频主题；
- 原生请求批准卡出现时的页面和窗口边界。

每个候选选择器记录：

```text
Codex 版本
平台
selector
DOM role / data-* 属性
L1 或 L2
是否在当前 page target
computed background / opacity / filter
position / z-index
bounding box
截图或脱敏快照
```

如果没有真实 CDP 或无法获得窗口层证据，必须标记为“未验证/阻塞”，不能用 fixture 或猜测替代。

### 第 4 步：更新兼容矩阵和选择器

只有取得真实证据后，才更新：

- `tools/selectors.json`；
- `runtime/compatibility.json`；
- `runtime/renderer-inject.js`；
- `runtime/dream-skin.css`；
- 相关测试和诊断输出。

记录版本 profile、平台、证据来源和验证日期。未知版本保持 conservative，不提前标记为 validated。

### 第 5 步：实现并同步

先添加失败断言，再实现最小修复。修改完成后：

```powershell
node tools/sync-runtime-assets.mjs
node tools/sync-runtime-assets.mjs --check
```

检查三份 CSS、三份 renderer 和所有共享 validator/policy/compatibility 副本没有漂移。

### 第 6 步：自动化验证

共享 Node 回归：

```powershell
node --test macos/tests/*.test.mjs windows/tests/*.test.mjs tools/*.test.mjs
```

Windows：

```powershell
powershell -NoProfile -File windows\tests\run-tests.ps1
node --check windows\assets\renderer-inject.js
node --check windows\scripts\injector.mjs
```

macOS：

```bash
bash macos/tests/run-tests.sh
```

Doctor：

```powershell
powershell -NoProfile -File windows\scripts\doctor-dream-skin.ps1 -Json
```

```bash
./macos/scripts/doctor-macos.sh --json
./macos/scripts/doctor-macos.sh --json --require-live
```

### 第 7 步：真实 UI smoke test

必须实际验证：

- 首页背景连续显示；
- 任务页背景可读；
- 侧栏、项目选择器、菜单、输入框、滚动条可交互；
- 页面内 dialog 不变形、不丢定位、不丢遮罩；
- overlay 打开时不会让整层视频错误变暗；
- 页面 reload 后皮肤重新出现；
- 视频 readyState、paused、错误状态和 poster 回退正确；
- 原生请求批准卡出现时，单独记录其是否属于 page target；
- Restore 后注入 marker、样式、装饰 DOM 和 CDP 会话均清理；
- 窄窗口没有横向滚动、裁切或控件遮挡；
- macOS 和 Windows 分别截图验收。

没有真实截图、DOM/窗口边界和验证输出，不能宣称视觉修复完成。

### 第 8 步：版本和发布验收

按仓库发布约束同步检查：

- `macos/VERSION`；
- `windows/VERSION`；
- `macos/package.json`；
- `macos/scripts/common-macos.sh`；
- `macos/scripts/injector.mjs`；
- `windows/scripts/injector.mjs`；
- `runtime/compatibility.json` 及双端生成副本。

发布前还要确认：

- 版本递增且 tag 与提交一致；
- 构建资产来自 tag 对应提交；
- DMG、Setup.exe、`SHA256SUMS.txt` 文件名、大小和摘要正确；
- Release 为公开状态且资产齐全；
- 不能把 merged、built、released 和用户可下载混为一谈。

## 5. 主题包升级注意事项

正式包必须有 `manifest.json`、非空 `theme.json`、非空 `theme.css` 和唯一背景图；视频必须同时保留图片 poster。

持续执行：

- 普通 `.zip`，不接受 `.dreamskin`；
- 路径穿越、链接/reparse、嵌套归档、重复路径和压缩滥用拒绝；
- 图片尺寸不超过 `16384px` 或 `50MP`；
- 图片、视频、ZIP 和解压总量执行现有上限；
- manifest 的平台、最低版本、文件字节数、媒体类型和 SHA-256 全部匹配；
- Safe CSS 只作用于登记的 `data-ds-part`；
- 导入只进入 saved themes，不自动应用，不覆盖 last-known-good；
- legacy 主题可继续使用，但没有 CSS 时不注入额外样式。

## 6. 明确禁止的升级方式

- 禁止修改官方 Codex、`app.asar`、签名或 WindowsApps ACL。
- 禁止只改一个平台副本。
- 禁止用完整 CSS hash、脆弱 DOM 路径或截图猜 selector。
- 禁止把 fixture 当成真实兼容结论。
- 禁止把 `approval` 状态当成审批窗口节点。
- 禁止把原生审批 chrome 当作页面 CSS 问题。
- 禁止用全局不透明底压住黑带。
- 禁止通过 `ExecutionPolicy Bypass`、关闭安全软件或放宽校验来“解决”失败。
- 禁止跳过失败测试、把失败改成无条件 skip 或在证据不足时宣称完成。
- 禁止覆盖用户现有主题、配置、状态文件或恢复备份。

## 7. 升级记录模板

每次 Codex 升级至少留下以下记录：

```text
Codex 版本：
平台：
Dream Skin 版本：
升级前分支/工作区状态：
CDP Browser ID：
选择器变化：
L1 结果：
L2 结果：
状态信号变化：
页面内 dialog 结果：
原生 approval chrome 结果：
视频结果：
reload 结果：
restore 结果：
自动化测试结果：
Doctor 结果：
截图/脱敏快照路径：
未解决阻塞：
是否允许发布：
```

## 8. 事实来源

- `README.md`：项目边界、主题包、验证和安全边界。
- `AGENTS.md`：安全、双端同步、版本、发布和主题 ZIP 硬性约束。
- `TASK_PROGRESS.md`：当前实机证据、已知根因、原生审批 chrome 边界和未完成验证。
- `runtime/compatibility.json`：协议、状态、媒体和平台能力矩阵。
- `tools/selectors.json`：版本化选择器、L1/L2 分级和真实证据。
- `windows/references/qa-inventory.md`、`macos/references/qa-inventory.md`：真实功能、视觉和恢复验收。
