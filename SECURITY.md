# Security boundary / 安全边界

Codex Dream Skin is an unofficial local customization tool. It avoids modifying
the official Codex package, but it relies on the Chrome DevTools Protocol (CDP)
to inject the theme into a running Codex renderer.

Codex Dream Skin 是非官方本地定制工具。它不会修改官方 Codex 安装包，但需要通过
Chrome DevTools Protocol（CDP）向正在运行的 Codex renderer 注入主题。

## Loopback is not authentication / 回环地址不等于身份认证

The debug listener is restricted to `127.0.0.1`, which prevents a direct
connection from another machine. CDP itself has no authentication, however.
While the CDP-enabled Codex process is running, another process on the same
computer can attempt to connect to that listener.

CDP can inspect page content, execute JavaScript in the renderer, and interact
with the active session. A hostile local process may therefore be able to read
visible conversation or workspace data and act with the renderer's privileges.
A host firewall does not isolate one local process from another, and loopback
binding must not be described as a sandbox or a trust boundary.

调试端口只绑定 `127.0.0.1`，因此其他电脑不能直接连接；但 CDP 本身没有认证。
只要带 CDP 参数启动的 Codex 仍在运行，同一台电脑上的其他进程就可能尝试连接。

CDP 能读取页面内容、在 renderer 中执行 JavaScript，并操作当前会话。因此，恶意本机
进程可能读取可见的对话或工作区数据，并以 renderer 的权限执行操作。本机防火墙不能
隔离同一设备上的两个进程；“仅回环”不能被理解为沙箱或身份认证边界。

## When exposure starts and ends / 风险窗口何时开始和结束

- The window starts when Dream Skin launches Codex with a
  `--remote-debugging-port` argument.
- Pausing the theme, removing its CSS, or stopping only the injector does not
  remove that launch argument from an already running Codex process.
- The window ends after the CDP-enabled Codex process has fully exited and the
  official app has been reopened normally without the Dream Skin launcher.
- The platform Restore flows can perform that full restart when their restart
  option is selected. Merely hiding the theme is not equivalent to closing CDP.

- Dream Skin 使用 `--remote-debugging-port` 参数启动 Codex 时，风险窗口开始。
- 暂停主题、移除 CSS 或只停止 injector，不会从仍在运行的 Codex 进程中移除启动参数。
- 完全退出该 Codex 进程，并通过普通官方入口重新启动（不经过 Dream Skin 启动器）后，
  风险窗口才结束。
- 两个平台的 Restore 流程在选择完整重启时可以完成上述操作；只隐藏主题不等于关闭 CDP。

## Recommended operation / 建议操作

1. Use Dream Skin only on a trusted personal device and trusted OS account.
2. Do not run unknown executables, scripts, browser extensions, or local
   development services while a CDP-enabled Codex session is active.
3. Never forward, proxy, tunnel, or rebind the debug port beyond loopback.
4. Do not share CDP logs, screenshots, `auth.json`, API keys, relay tokens, or
   private conversation content in an issue or pull request.
5. When finished, use a full Restore/restart or quit every Codex process and
   reopen Codex from its normal official entry point.

1. 只在可信个人设备和可信系统账户中使用 Dream Skin。
2. CDP 会话运行期间，不要运行来源不明的程序、脚本、浏览器扩展或本地服务。
3. 不要把调试端口转发、代理、隧道化或重新绑定到非回环地址。
4. Issue 或 PR 中不要上传 CDP 日志、截图、`auth.json`、API Key、中转 token 或私人对话。
5. 使用结束后执行完整 Restore/重启，或退出全部 Codex 进程，再从官方普通入口启动。

## What the project validates / 项目会校验什么

### Local Control Center and exports / 本地控制中心与导出

The visual Control Center binds only to a random `127.0.0.1` port. Its API uses
a random per-process token, and mutations additionally require an exact same-
origin `Origin` header. Media previews use temporary opaque handles because
native image and video elements cannot attach the API token. The page has a
restrictive CSP and loads no third-party scripts or fonts.

Theme uploads are bounded and content-sniffed before use. Saved drafts are
published by same-root staging and atomic rename. Official export ZIPs contain
only registered flat files, are CRC checked, and are revalidated for both
platform contracts before download. ZIP self-validation budgets at most 64 MiB
of expanded content before inflation, caps each inflater output, and requires
local and central metadata and byte ranges to agree. Export metadata and a selected license do
not prove ownership of third-party images or videos; publishers remain
responsible for rights and attribution.

可视化控制中心只绑定 `127.0.0.1` 的随机端口。API 使用每次进程随机 token，写操作还
要求精确同源 `Origin`。图片和视频原生元素无法附加 API token，因此预览媒体使用临时、
不可预测的句柄。页面启用严格 CSP，不加载第三方脚本或字体。

上传媒体在使用前进行大小限制和内容识别；主题草稿通过同根暂存和原子重命名发布。
正式导出 ZIP 只包含注册的平面文件，执行 CRC 自检，并在下载前按两个平台契约复验。
ZIP 自检会在解压前执行 64 MiB 累计预算，为每个解压器设置输出硬上限，并要求本地头、
中央目录元数据和数据范围完全一致。
导出元数据和许可证选择不能证明第三方图片或视频的所有权，发布者仍需自行确认授权与署名。

The platform scripts validate the expected Codex installation or package,
process identity, loopback listener ownership, renderer target shape, and
recorded injector state before performing sensitive lifecycle operations.
Both injectors bind their lifecycle to the exact CDP Browser ID. The macOS
watcher additionally keeps the browser WebSocket open as a lease and stops if
the identity closes or the loopback port begins reporting another browser.
Those checks reduce accidental targeting and stale-process mistakes. They do
not add authentication to CDP and do not protect Codex from other software that
is already running on the same computer.

平台脚本会在敏感生命周期操作前校验 Codex 安装或包身份、进程身份、回环监听归属、
renderer 目标形状和已记录的 injector 状态。这些校验能减少误操作和陈旧进程问题，
双平台 injector 还会绑定精确的 CDP Browser ID；macOS watcher 会持续持有 browser
WebSocket 租约，身份关闭或端口开始报告另一 browser 时立即停止。
但不会给 CDP 增加认证，也不能防御同一台电脑上已经运行的其他软件。
