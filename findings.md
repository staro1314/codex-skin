# Findings

## 2026-08-11：仓库边界

- 正确工作项目为 `D:\project\personal\codex-skin`。
- 仓库包含 `windows/`、`macos/`、`runtime/`、`tools/`、`docs/`，是 Codex Dream Skin 的完整源码工程。
- 当前 `master` 没有提交；源码、脚本、测试、文档和许可证全部处于未跟踪状态。
- `.codegraph/` 是本地索引目录，不纳入首次源码提交。
- `TASK_PROGRESS.md` 被 `.gitignore` 忽略，是本地连续进度记录，不作为源码发布文件。

## 2026-08-11：现有能力

- Windows 和 macOS 都通过本机回环 CDP 连接官方 Codex renderer。
- 现有实现保留原生 Codex 控件，不修改官方安装包、`app.asar` 或代码签名。
- `runtime/` 提供跨平台共享的 renderer 注入、Safe CSS、主题包和图片元数据能力。
- Windows 已有安装、启动、托盘、导入、验证、暂停、恢复和卸载流程。
- macOS 已有菜单栏、安装、主题编辑、验证、恢复和 DMG 相关流程。
- 主题包以静态背景图、`theme.json` 和 `theme.css` 为核心，导入过程包含路径、大小、类型、内容和 Safe CSS 校验。
- `TASK_PROGRESS.md` 记录的当前代码版本为 `1.5.12`，并记录了双平台回归和发布准备历史。

## 2026-08-11：后续扩展判断

- 动态视频应进入 renderer 注入层，而不是新建一个与 Codex 窗口同步的外部背景窗口。
- 视频不能沿用图片的 Base64 注入方式；需要受控资源地址、poster、生命周期和性能模式。
- Codex 状态视觉化需要独立的状态归一化层，不能把主题 CSS 直接耦合到页面文案或单一 DOM 结构。
- 共享 `runtime/` 是跨平台扩展的首选位置，平台目录应继续通过同步工具生成对应资产。
- 任何新增主题能力都必须同步更新 manifest/schema、Safe CSS 策略、双平台校验和恢复路径。

## 待验证问题

- 当前 Codex 各版本对 CDP 启动参数和 renderer marker 的兼容范围。
- 视频资源在 Windows/macOS renderer 中最可靠的本地加载方式。
- DOM/路由观察能覆盖哪些 Codex 工作状态，哪些状态需要更结构化的事件来源。
- 动态媒体在真实 Codex 窗口上的 GPU、内存、耗电和最小化行为。
- 发布包中动态媒体资源的大小、版权和升级保留策略。
