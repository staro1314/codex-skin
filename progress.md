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

## Phase 2 media runtime

- Extended the shared theme package contract with an optional local `video` object. The image remains the required poster, video is limited to `background.mp4` or `background.webm`, and `muted`/`loop` cannot be disabled.
- Added `eco`, `balanced`, and `immersive` renderer behavior. Video bytes are never embedded in the payload; platform loaders pass a validated local `file://` URL and retain the static poster fallback.
- Added visibility, blur/focus, reduced-motion, playback-error, package staging, and renderer regression coverage. Shared tools and focused media tests pass.
- Generated runtime copies are synchronized and `node tools/sync-runtime-assets.mjs --check` passes. The focused media suite passes 8/8; the full portable Node suite reports 99 tests, 91 passed, 2 skipped, and 6 known macOS/Unix environment failures. Phase 2 implementation is complete; real platform playback and performance sampling remain explicit follow-up validation.

## Verification Notes

- Node test runner (elevated): focused `node --test tools/*.test.mjs` passed 8/8. Full `node --test macos/tests/*.test.mjs windows/tests/*.test.mjs tools/*.test.mjs` ran 99 tests: 91 passed, 2 skipped by platform requirements, and 6 macOS-only tests failed because this Windows checkout lacks `.github/workflows/release.yml`, Unix `/tmp` test directories, and the macOS window command environment. Windows and shared-runtime tests passed.
- `node tools/sync-runtime-assets.mjs --check` passed. Node syntax checks passed for the shared and generated renderer/validator assets plus the macOS and Windows payload/import scripts. PowerShell execution remains blocked by the local AuthorizationManager policy, so Windows script execution is recorded as an environment gap rather than bypassed.

## Phase 3 visual state bridge

- Added the shared visual state contract and renderer state machine. Route state wins for `home`, `settings`, and `overlay`; thread pages default to `idle`, while bounded DOM attributes/signals can produce `thinking`, `executing`, `approval`, `success`, and `error`.
- Added the `codex-dream-skin:visual-state` event bridge and `clearVisualState()` API. State effects are isolated to the non-interactive video layer; no message text or private Codex business event is parsed.
- Focused renderer/media tests pass 8/8. Phase 3 remains in progress until a real Codex DOM/event capture confirms the signal names across supported versions.
- The local `9335` candidate and all project fallback ports (`9335-9339`, `9341-9345`, `9222`) had no reachable CDP endpoint; running ChatGPT/Codex processes were present but no debug port was exposed. Process command-line inspection was denied by Windows permissions, so no undocumented attachment was attempted.
- Upgraded `tools/capture-dom-fixture.mjs` to `1.2.0`. It now emits only normalized visual-state candidates, fixed signal counts, and a bounded runtime state summary. Syntax validation passed and the no-CDP path exited `2` with the existing actionable message.
- Added the root `start-codex-skin.ps1` convenience launcher. It delegates to the existing verified Windows launcher, preserves automatic reuse of the state-file port unless `-Port` is explicit, and optionally starts one-shot (`-Capture`) or watch-mode (`-Watch`) redacted sampling.
- Focused tool regression now passes 9/9, including the root launcher contract; PowerShell AST and Node syntax checks also pass.
- Added `start-codex-skin.cmd` as the double-click user entry. It invokes the PowerShell launcher with `RemoteSigned`, closes on success, and pauses on failure without using `Bypass`.

## Phase 3 configurable state effects

- Added the optional `theme.json.stateEffects` contract for all normalized Codex visual states. Themes can configure a bounded edge color/opacity, media opacity, brightness, saturation, contrast, hue rotation, and one of four built-in motion profiles.
- Kept schema version 1 and backward compatibility: omitted effects retain the previous built-in video behavior, while configured edge glow also works for image themes and never receives pointer events.
- Shared package validation and both platform loaders reject unknown states/fields, unsupported motion names, invalid colors, and values outside the documented safety bounds before renderer injection.
- Refactored the renderer to expose the active normalized effect as `window.__CODEX_DREAM_SKIN_STATE__.visualEffect`, apply it through repaired root CSS variables, and clean all effect attributes/variables during restore.
- Focused protocol, loader, and dual-platform renderer regression passes 11/11. The full portable Node run reports 103 tests: 95 passed, 2 platform-skipped, and the same 6 known macOS/Unix environment failures on Windows. Phase 3 remains open only for real Codex state-signal capture and cross-version calibration.

## Phase 4 visual control center

- Added an optional, bounded `controls` contract for surface opacity, blur, radius, image zoom/dim, and reduced/standard/expressive motion. Shared and generated platform runtimes preserve backward compatibility for themes without the field.
- Added a localhost-only visual control center with an authenticated API, opaque media handles, CSP, origin-protected mutations, validated in-memory uploads, immutable theme drafts, and atomic publish into the existing saved-theme library.
- Added a deliberate instrument-console UI with live image/video composition, glass controls, color controls, and per-state visual effect preview for eight normalized Codex states.
- Added `control-codex-skin.cmd` as the Windows double-click entry. It reuses a healthy local server, starts Node hidden when needed, keeps `RemoteSigned`, and opens the tokenized local URL automatically.
- Added a narrow Windows action bridge that reuses `Use-DreamSkinSavedTheme`, `Set-DreamSkinPaused`, and `Invoke-DreamSkinLiveRemove`; full official-appearance restore remains a separate explicit recovery workflow.
- Focused control-center, protocol, renderer, and Windows schema coverage passes 14/14. Real Codex interaction and performance validation remains intentionally deferred until the planned functionality is complete.
- After updating the renderer contract assertion for the new image veil, the cross-platform renderer/control-center focus set passes 15/15. The complete portable Node run now contains 107 tests: 99 passed, 2 platform-skipped, and only the same 6 macOS/Unix environment failures remain on Windows (`release.yml`, Unix `/tmp`, and native macOS window prerequisites).
- Added versioned official theme export to the control center. Packages contain normalized public theme fields, fixed media names, publisher/license/provenance metadata, per-file SHA-256, optional video, Safe CSS, and a generated license notice.
- Exported ZIPs are built in memory, CRC/self-checked, validated from a temporary directory against both Windows and macOS contracts, and never cached as public files. A bounded atomic `export-history.json` rejects repeated versions and suggests the next patch version.
- The focused export/control/runtime suite passes 16/16, including video byte preservation, internal-field exclusion, duplicate-version rejection, temporary cleanup, traversal/tamper rejection, and native Windows `ZipArchive` compatibility.
- Final portable regression contains 109 tests: 101 passed, 2 platform-skipped, and the same 6 Windows-host macOS/Unix environment failures remain (`release.yml`, Unix `/tmp`, and native macOS window prerequisites). All new control-center and export tests passed.

## Errors Encountered

## 2026-08-13 final continuation checkpoint

- Phase 5 is complete. Added strict operation-state normalization and freshness checks, exact saved Browser ID matching in macOS status/recovery paths, and regression coverage for malformed, future, expired, and duplicate operation/target inputs.
- Added a version-layered selector compatibility matrix. Known versions use only recorded evidence; unknown versions remain conservative and are never treated as live-compatible by fixtures alone.
- Added `tools/release-doctor.mjs` and `tools/release-doctor.test.mjs`. The release doctor validates strict tag/version parity and all required release inputs.
- Added a read-only `.github/workflows/release.yml` candidate pipeline. It checks out `${{ github.sha }}`, runs release/sync/tool checks, builds macOS and Windows candidates, and uploads artifacts; it does not create or overwrite GitHub Releases.
- Focused release and lifecycle tests pass 7/7. Full portable regression: 116 total, 109 passed, 2 skipped, 5 expected Windows-host failures from Unix `/tmp` and native macOS window prerequisites. No new product regression was observed.
- Real Codex validation remains an external prerequisite: local ports `9335-9339`, `9341-9345`, and `9222` exposed no verified loopback Codex CDP page target. `node tools/doctor-selectors.mjs --wait 0 --json` exited 2 by design, so no visual, state-signal, or performance claim is recorded.

## Phase 5 security and compatibility hardening

- Hardened the in-memory ZIP reader against pre-validation expansion pressure: declared output is budgeted before inflate, zlib receives a per-entry output ceiling, and local/central CRC and size fields must match.
- Added rejection for overlapping local entry ranges and regression mutations for oversized declared output and mismatched local metadata. The focused control/export/runtime suite remains 16/16.
- The next isolated change is macOS Browser ID session leasing; Windows already carries and validates a Browser ID through its injector lifecycle, while macOS currently validates only loopback target shape and Codex renderer markers.
- Added macOS Browser ID leasing across startup, state schema 5, watcher launch, one-shot injection, verification, pause, restore, switching, Doctor, and community rollback verification.
- Every target-list cycle now compares `/json/version` with the expected Browser ID. The watcher holds the browser WebSocket as a lifetime anchor and stops on identity closure or port reuse instead of attaching to the replacement process.
- Browser identity and portable injector contract tests pass 14/14. Native macOS window-readiness remains a platform-only validation item and was not represented as passing on Windows.
- The full portable regression now contains 111 tests: 103 passed, 2 platform-skipped, and the same 6 Windows-host macOS/Unix environment failures remain. Browser ID leasing introduced no new regression.

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
