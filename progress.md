# Progress Log

## 2026-08-11

- 纠正工作目录：当前项目是 `D:\project\personal\codex-skin`，不是 Javesy 原型。
- 检查仓库结构：确认包含 Windows、macOS、共享 runtime、测试、安装器和维护文档。
- 检查 Git 状态：当前 `master` 没有提交，项目文件均未跟踪。
- 阅读根 `AGENTS.md`、`TASK_PROGRESS.md`、`docs/PROJECT.md`、Windows/macOS README 和平台 SKILL 约束。
- 新增根项目说明 `README.md`。
- 新增分阶段计划 `task_plan.md`。
- 新增本次发现记录 `findings.md`。
- 新增本次会话进度 `progress.md`。
- 已完成：更新 `TASK_PROGRESS.md`、运行验证、脚本语法检查、源码暂存和首次本地提交。
- 首次本地提交：`41b8980 Initialize Codex Dream Skin repository baseline`；提交包含 221 个文件，未包含 `.codegraph/`。
- Phase 1 已开始：范围限定为共享兼容性契约、跨平台 Doctor、统一健康状态和安装/同步检查；不涉及动态媒体实现。
- 已新增 `runtime/compatibility.json`、`runtime/runtime-doctor.mjs`、Windows Doctor 入口和运行时 Doctor 测试；待生成双端副本并接入安装清单。
- 同步检查、三份 Doctor 语法检查、Selector Doctor 和新增 Runtime Doctor 均通过。
- Phase 1 验收：Windows/shared Node 测试 26/26 通过；Windows 和 macOS 模式 Doctor 均返回 `ready`，包含版本矩阵、共享同步、稳定错误码和下一步动作；Phase 1 已完成。

## Verification Notes

- Node test runner (elevated): 93 tests ran, 85 passed, 2 skipped by platform requirements, and 6 macOS-only tests failed because this Windows checkout lacks `.github/workflows/release.yml`, Unix `/tmp` test directories, and the macOS window command environment. Windows and shared-runtime tests passed.
- Node syntax checks passed for the Windows injector, Windows renderer injection, and macOS injector; no implementation files were changed by this documentation task.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| README/计划第一次写入了错误的 `javesy` 工作区 | 1 | 未对 `codex-skin` 做覆盖；重新确认目录后切换到正确仓库，错误提交保留在 `javesy`，本次不回滚 |
| Node Test Runner 在沙箱内对测试文件 `spawn` 返回 `EPERM` | 1 | 已记录为环境阻断；使用受控提升权限重跑同一套测试，不修改源码 |
| 跨平台 Node 测试在 Windows 环境下有 6 个 macOS 专用失败 | 1 | 已完成提升权限重跑；85 个测试通过，失败归因于缺失 Unix/macOS 前置条件，保留为后续跨平台验证项 |
| 第一次补记测试结果的补丁因 PowerShell 乱码上下文匹配失败 | 1 | 改用 ASCII 标题和表格锚点追加记录，未改变源码 |
| 暂存差异检查发现仓库原有文件存在尾随空格 | 1 | 未清理无关文件；记录为基线格式债务，不阻断本次文档与源码首提交 |
| `node tools/sync-runtime-assets.mjs` 更新既有生成资产时返回 `EPERM` | 1 | 先检查文件属性和 ACL；必要时仅提升既有同步工具，不手工改写平台生成副本 |
| 平台清单补丁因 JavaScript 字符串转义丢失 PowerShell 反斜杠 | 1 | 改用原始补丁字符串重新应用，首次补丁未修改文件 |
| 第二次平台清单补丁在调用层发生字符串语法解析错误 | 1 | 拆分为小补丁逐个应用，目标文件在失败时未改变 |
| 拆分后的 Windows 清单补丁仍因反斜杠过度转义未匹配 | 1 | 改用逐行数组构造补丁，保留单个 Windows 路径分隔符 |
| macOS 清单补丁的 shell hunk 缺少补丁上下文前缀 | 1 | 拆分 macOS 修改，先应用 Swift、构建清单和 Doctor，再单独处理 shell 断行 |
| macOS 测试清单补丁的首行缺少 hunk 上下文前缀 | 1 | 修正补丁行前缀后重新应用，未改变测试文件 |
| 新增 Doctor 测试在 Windows 下直接使用 URL pathname 导致项目根路径错误 | 1 | 改用 `fileURLToPath` 解析模块路径；显式 Doctor CLI 已通过 |
| Phase 1 后完整 Node 回归仍有 6 个 macOS/Unix 环境失败 | 1 | 86 个通过、2 个平台跳过；失败仍为缺少 `.github/workflows/release.yml`、Unix `/tmp` 和 macOS 窗口命令环境，未改动这些既有测试 |
| Windows PowerShell 测试默认执行策略拒绝未签名本地脚本 | 1 | 按项目约定改用 `-ExecutionPolicy RemoteSigned` 重跑，不使用 Bypass |
| 记录 PowerShell 策略阻断时误生成了空补丁且路径写错 | 1 | 补丁未修改文件；继续使用正确路径记录后续验证 |
| Windows PowerShell 测试在 `Unrestricted` 下仍被本机 AuthorizationManager 拦截 | 1 | 未清除 Zone.Identifier 或使用 Bypass；记录为本机策略阻断，改用 Node/静态检查覆盖可验证部分 |
| PowerShell 下使用 `docs/*.md` 的 literal glob 查询失败 | 1 | 改用仓库范围 `rg` 查询，不影响源码或测试 |
| 使用说明补丁在调用层漏引号导致 JavaScript 语法错误 | 1 | 文档文件未修改；拆分为三个小补丁重新应用 |
| README 补丁直接使用标题行而未加 hunk 上下文前缀 | 1 | 改为在稳定标题前插入独立章节 |
| PowerShell AST 检查命令被外层 shell 展开变量而自身语法失败 | 1 | 改用单引号包裹内层命令重跑，目标脚本未执行 |
| PowerShell AST 检查第二种引号组合仍被宿主命令解析器剥离 | 2 | 放弃该辅助检查，不修改脚本；以 Node、同步、聚焦测试和差异检查作为当前验证证据 |
| WindowsApps `bash.exe -n` 启动 WSL 时返回 `E_ACCESSDENIED` | 1 | macOS shell 语法无法在本机执行；保留 Node shell 约束测试和 macOS/CI 验证缺口 |
| Windows 安装器静态测试补丁构造时混入未引用的 patch 行 | 1 | 测试文件未修改；暂不扩大该辅助断言范围 |
