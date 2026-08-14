# Codex Dream Skin 分阶段计划

## 目标

在保留现有 CDP 换肤、安全校验、双平台安装和恢复能力的基础上，把 Codex Dream Skin 扩展为可加载动态媒体、理解 Codex 工作状态并保持低干扰和可恢复的视觉运行时。

## 当前基线

- 当前代码版本：`1.5.12`。
- Windows、macOS 和 `runtime/` 共享资产已经存在。
- 当前主题协议支持静态图片、可选本地视频、主题元数据和 Safe CSS。
- 当前项目包含安装器、托盘/菜单栏、CDP 注入、验证、恢复和大量跨平台测试。
- 仓库已完成首次本地 Git 提交；本阶段在该基线之上增加共享运行时契约和 Doctor。

## 阶段

| 阶段 | 目标 | 状态 | 主要产物 | 验收标准 |
|---|---|---|---|---|
| Phase 0 | 建立项目文档和可追溯基线 | completed | 根 README、计划、发现记录、首次本地提交 | 源码范围清晰，文档与版本一致，现有检查可运行 |
| Phase 1 | 固化跨平台运行基线 | completed | 版本矩阵、环境 Doctor、测试入口和同步检查 | Windows/macOS/runtime 的共享契约可验证，失败状态可诊断 |
| Phase 2 | 动态媒体运行时 | completed | 视频背景、poster 降级、媒体生命周期和性能档位 | 视频可切换、可暂停、可恢复，不遮挡原生控件 |
| Phase 3 | Codex 状态可视化 | in_progress | 状态归一化、视觉状态机、事件到动效映射 | 空闲、思考、执行、审批、成功、失败状态稳定呈现 |
| Phase 4 | 主题协议与创作工具 | completed | 主题 schema、编辑器字段、预览、主题包版本化 | 主题可创建、预览、导入、校验、切换和回滚 |
| Phase 5 | 安全与兼容性强化 | completed | CDP 会话策略、选择器矩阵、回滚和安全回归 | Codex 更新、异常启动、恶意主题和资源超限均 fail-closed |

## Current Execution Status (2026-08-13)

- Phase 5 implementation is complete: ZIP expansion limits, macOS Browser ID leasing, exact target identity, selector compatibility profiles, malformed-operation rejection, duplicate-target rejection, and media resource limits are covered.
- Phase 5 focused regression is green. The latest full portable run has 116 tests: 109 passed, 2 skipped by platform requirements, and 5 expected macOS/Unix host failures.
- Real Codex visual/state/performance validation is not claimable yet. The local candidate ports exposed no verified loopback Codex CDP page target; the doctor exits 2 without attaching.
- Phase 6 local release preparation is implemented: `tools/release-doctor.mjs`, immutable-commit release-candidate workflow, version parity checks, runtime sync checks, and read-only artifact handoff.
- Automatic GitHub Release creation is intentionally not included. Publishing remains a separately authorized human step.
| Phase 6 | 发布工程 | in_progress | 安装包、签名/校验、发布检查、用户诊断 | DMG/Setup 与源码版本一致，安装、更新、恢复可验证 |

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

## Phase 2 结果

- `runtime/theme-package-validator.mjs` 和双端生成副本支持可选 `background.mp4|webm`，要求图片 poster、静音循环、`eco`/`balanced`/`immersive` 档位和 32 MiB 上限。
- macOS/Windows 导入、暂存、发布、指纹和 payload 链路均传递受控本地 `file://` URL，不把视频字节编码进注入 payload。
- 共享渲染器已覆盖页面隐藏、窗口失焦、减少动态效果、低电量和播放错误回退；视频层不接收指针事件，原生 Codex 控件优先。
- `node --test tools/*.test.mjs` 聚焦测试 8/8 通过；完整便携 Node 回归 99 项中 91 项通过、2 项按平台跳过、6 项因 Windows 主机缺少 Unix/macOS 前置条件失败，详见 `progress.md`。
- 真实 macOS/Windows Codex 播放、宿主 CSP 兼容性和性能采样仍属于下一阶段的真实平台验收，不影响本阶段代码契约和 fail-closed 回退实现。

## Phase 3 重点

- 先从 DOM/路由观察得到可验证的页面状态，再评估更结构化的事件来源。
- 视觉状态机与 Codex 连接、主题渲染解耦。
- 事件必须有默认状态、超时、重复事件去重和错误恢复。
- 任何装饰层保持 `pointer-events: none`，审批和输入控件优先级最高。

## Phase 3 当前结果

- 共享 renderer 已增加统一视觉状态机和 `data-dream-visual-state` 根属性，路由状态覆盖 `home`、`settings`、`overlay`，线程页默认 `idle`。
- 受限 DOM 语义信号支持 `thinking`、`executing`、`approval`、`success`、`error` 的显式或半显式判定；未知值 fail-closed，不读取消息文本。
- 提供 `codex-dream-skin:visual-state` 事件桥和 `clearVisualState()`，为后续 Codex 版本适配保留稳定入口；状态 effect 只作用于非交互装饰层。
- 主题协议新增可选 `stateEffects`：支持按状态配置受限颜色、边缘光透明度、媒体透明度、亮度、饱和度、对比度、色相和内置 motion；旧主题继续使用现有效果，无需迁移。
- `stateEffects` 在主题导入和双平台运行时加载时重复校验，拒绝未知状态、未知字段、越界数值及任意动画/CSS/脚本输入；边缘状态光同时覆盖图片与视频主题。
- `tools/capture-dom-fixture.mjs` 已升级为 1.2.0，在脱敏快照中记录固定状态枚举、布尔信号计数和已注入 renderer 状态，供真实 Codex 采样使用。
- 根目录新增 `start-codex-skin.ps1`，统一启动、单次脱敏采集和持续采集入口；未显式指定端口时保留底层启动器的状态端口复用逻辑。
- 聚焦 renderer/media/schema 测试 11/11 通过；完整便携 Node 回归 103 项中 95 项通过、2 项按平台跳过、6 项保持为 Windows 主机上的已知 macOS/Unix 环境失败。真实 Codex 事件名称、DOM 状态属性和跨版本快照仍待真实平台采样后收敛，Phase 3 暂不标记完成。

## Phase 4-6 重点

- 主题包 schema 采用显式版本和能力声明，旧主题继续可恢复使用。
- Safe CSS 继续限制作用域；新增能力必须扩展策略和回归测试。
- 主题导入、深链、一键换肤和发布包保持相同的字节、哈希、路径和兼容校验。
- 发布前必须同时验证版本一致性、安装包内容、签名/校验、真实 Codex smoke test 和恢复路径。

## Phase 4 当前结果

- 新增可选 `controls` 主题协议，覆盖玻璃表面透明度、模糊、圆角、背景缩放、背景压暗和动态级别；共享校验、Windows/macOS 加载器和渲染器使用同一套边界，旧主题保持原效果。
- 新增 `control-center/` 本机控制中心：主题库、图片/视频预览、构图参数、玻璃参数、颜色和 8 种状态特效可实时调校。
- Windows 用户可直接双击 `control-codex-skin.cmd`；服务仅绑定 `127.0.0.1`，使用随机会话令牌、同源写保护、CSP、随机媒体句柄和上传大小/格式校验。
- 草稿保存为新的 `custom-*` 已保存主题，采用同根暂存目录、完整运行时复验和原子重命名，不覆盖母版；应用、暂停和继续显示复用现有 Windows 生命周期函数。
- 新增正式分享包导出：语义版本、发布者、许可证、来源/AI 声明、逐文件 SHA-256、跨平台能力清单和本机版本历史；重复版本 fail-closed。
- ZIP 在内存生成并自检 CRC，输出前通过 Windows/macOS 主题目录校验器复验；视频包和 Windows 原生 `ZipArchive` 读取均进入回归。聚焦测试 16/16 通过，Phase 4 功能实现完成。
- 真实 Codex 中的视觉表现、平台性能和跨版本状态信号仍按用户要求留到全部功能完成后的统一验收，该缺口继续归属 Phase 3/最终验收，不回写为分享包已实机验证。

## Phase 5 当前进度

1. `completed` 分享包 ZIP 读取预算：解压前限制 64 MiB 累计声明大小，单项 inflate 使用输出硬上限，并拒绝本地头/中央目录元数据不一致及数据区重叠。
2. `completed` macOS CDP Browser ID 租约：启动、一次性操作、watch 重连和状态文件绑定同一 browser identity，端口复用时立即 fail-closed。
3. `in_progress` 选择器兼容矩阵：按 Codex 客户端版本记录 L0/L1 证据，未知版本只允许保守探测，不把 fixture 当作真实兼容结论。
4. `pending` 异常回滚与资源压力：覆盖操作中断、状态文件陈旧、媒体极限、重复目标和恢复失败后的可诊断状态。

## 不在当前范围

- 不修改官方 Codex 二进制、`app.asar`、签名或 WindowsApps ACL。
- 不把换肤工具变成 API 中转或模型供应商配置工具。
- 不在没有性能和恢复验证前默认启用高负载 WebGL 或 4K 视频。
- 不把未经确认版权的图片、人物、商标或截图作为公开预置资源。

## 完成定义

每个阶段完成前必须具备：实现、正向验证、失败路径验证、文档更新、测试记录和可恢复路径。`TASK_PROGRESS.md` 记录跨会话事实，`progress.md` 记录本次工作流，避免用“已完成”替代具体证据。
