# Codex Dream Skin 分阶段计划

## 目标

在保留现有 CDP 换肤、安全校验、双平台安装和恢复能力的基础上，把 Codex Dream Skin 扩展为可加载动态媒体、理解 Codex 工作状态并保持低干扰和可恢复的视觉运行时。

## 当前基线

- 当前代码版本：`1.5.12`。
- Windows、macOS 和 `runtime/` 共享资产已经存在。
- 当前主题协议以静态图片、主题元数据和 Safe CSS 为主。
- 当前项目包含安装器、托盘/菜单栏、CDP 注入、验证、恢复和大量跨平台测试。
- 仓库已完成首次本地 Git 提交；本阶段在该基线之上增加共享运行时契约和 Doctor。

## 阶段

| 阶段 | 目标 | 状态 | 主要产物 | 验收标准 |
|---|---|---|---|---|
| Phase 0 | 建立项目文档和可追溯基线 | completed | 根 README、计划、发现记录、首次本地提交 | 源码范围清晰，文档与版本一致，现有检查可运行 |
| Phase 1 | 固化跨平台运行基线 | completed | 版本矩阵、环境 Doctor、测试入口和同步检查 | Windows/macOS/runtime 的共享契约可验证，失败状态可诊断 |
| Phase 2 | 动态媒体运行时 | pending | 视频背景、poster 降级、媒体生命周期和性能档位 | 视频可切换、可暂停、可恢复，不遮挡原生控件 |
| Phase 3 | Codex 状态可视化 | pending | 状态归一化、视觉状态机、事件到动效映射 | 空闲、思考、执行、审批、成功、失败状态稳定呈现 |
| Phase 4 | 主题协议与创作工具 | pending | 主题 schema、编辑器字段、预览、主题包版本化 | 主题可创建、预览、导入、校验、切换和回滚 |
| Phase 5 | 安全与兼容性强化 | pending | CDP 会话策略、选择器矩阵、回滚和安全回归 | Codex 更新、异常启动、恶意主题和资源超限均 fail-closed |
| Phase 6 | 发布工程 | pending | 安装包、签名/校验、发布检查、用户诊断 | DMG/Setup 与源码版本一致，安装、更新、恢复可验证 |

## Phase 1 重点

- 明确 `runtime/` 是共享源，平台目录中的文件由同步流程生成。
- 建立 Codex 版本、CDP 启动行为和 selector contract 的兼容矩阵。
- 为启动、注入、验证、暂停、恢复和卸载统一健康状态和错误码。
- 让 Doctor 能输出下一步动作，而不是只返回模糊失败。
- 固化便携 Node、PowerShell、shell、Swift 和真实平台测试的边界。

## Phase 1 结果

- `runtime/compatibility.json` 定义平台能力、CDP 边界、版本和稳定错误码。
- `runtime/runtime-doctor.mjs` 输出统一的 `ready`、`degraded`、`blocked` 健康状态，以及会话生命周期、检查项和下一步动作。
- Windows 提供 `scripts/doctor-dream-skin.ps1`；macOS 的 `doctor-macos.sh` 增加 `--json` 和 `--require-live`。
- `tools/sync-runtime-assets.mjs` 将契约和 Doctor 同步到双端；安装器、DMG 和运行时清单会拒绝缺失副本。
- Windows/shared Node 测试 26/26 通过；macOS/Unix 专用测试因当前主机环境缺口未宣称通过。

## Phase 2 重点

- 扩展主题背景类型：`image`、`video`、后续 `canvas`。
- 视频使用 poster、静音、循环和可中断生命周期。
- 不把大视频编码成 Base64；使用受控本地资源或本机 HTTP 资源。
- 提供 `eco`、`balanced`、`immersive` 三档性能策略。
- 窗口最小化、失焦、电池供电和 `prefers-reduced-motion` 时降级。

## Phase 3 重点

- 先从 DOM/路由观察得到可验证的页面状态，再评估更结构化的事件来源。
- 视觉状态机与 Codex 连接、主题渲染解耦。
- 事件必须有默认状态、超时、重复事件去重和错误恢复。
- 任何装饰层保持 `pointer-events: none`，审批和输入控件优先级最高。

## Phase 4-6 重点

- 主题包 schema 采用显式版本和能力声明，旧主题继续可恢复使用。
- Safe CSS 继续限制作用域；新增能力必须扩展策略和回归测试。
- 主题导入、深链、一键换肤和发布包保持相同的字节、哈希、路径和兼容校验。
- 发布前必须同时验证版本一致性、安装包内容、签名/校验、真实 Codex smoke test 和恢复路径。

## 不在当前范围

- 不修改官方 Codex 二进制、`app.asar`、签名或 WindowsApps ACL。
- 不把换肤工具变成 API 中转或模型供应商配置工具。
- 不在没有性能和恢复验证前默认启用高负载 WebGL 或 4K 视频。
- 不把未经确认版权的图片、人物、商标或截图作为公开预置资源。

## 完成定义

每个阶段完成前必须具备：实现、正向验证、失败路径验证、文档更新、测试记录和可恢复路径。`TASK_PROGRESS.md` 记录跨会话事实，`progress.md` 记录本次工作流，避免用“已完成”替代具体证据。
