# Codex Dream Skin 窗口透明度调整记录

最后核对时间：2026-08-21
适用工作区：`D:\\project\\personal\\codex-skin`
记录性质：当前源码、生成资源和已完成的 Windows 实时 CDP 验证的定位索引。

## 0. 这份记录怎么使用

以后要调整某个窗口的透明度，按下面顺序操作：

1. 先在本文件的“窗口索引”中按窗口名称或触发入口定位。
2. 使用该条记录的“精确选择器”和 `data-ds-part`，不要扩大到通用的 `aside`、`[role="menu"]`、`[class~="bg-surface"]` 或所有浮层。
3. 只修改对应的 `runtime/dream-skin.css` 规则。共享运行时是唯一源文件，不直接修改 `windows/assets/` 或 `macos/assets/` 的生成副本。
4. 修改后运行：

   ```powershell
   node tools/sync-runtime-assets.mjs
   node tools/renderer-runtime.test.mjs
   node windows/tests/renderer-inject.test.mjs
   node macos/tests/renderer-inject.test.mjs
   node tools/doctor-selectors.test.mjs
   node tools/runtime-doctor.test.mjs
   node macos/tests/runtime-css-nested-has.test.mjs
   node macos/tests/safe-css-validator.test.mjs
   node --check runtime/renderer-inject.js
   node --check windows/assets/renderer-inject.js
   node --check macos/assets/renderer-inject.js
   node tools/sync-runtime-assets.mjs --check
   git diff --check
   ```

5. 通过项目官方脚本重启常驻 watcher，不使用旧的已安装 engine：

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy RemoteSigned `
     -File .\windows\scripts\start-dream-skin.ps1 -RestartExisting
   ```

6. 实时验证时必须保持目标窗口打开，读取 `getComputedStyle()` 的实际值；不能通过关闭浮层再截图来判断修复成功。

## 1. 运行时结构和修改边界

### 1.1 共享源文件和生成文件

| 用途 | 唯一源文件 | 自动同步副本 |
|---|---|---|
| 透明度和玻璃层 CSS | `runtime/dream-skin.css` | `windows/assets/dream-skin.css`、`macos/assets/dream-skin.css` |
| DOM marker、状态监听、动态刷新 | `runtime/renderer-inject.js` | `windows/assets/renderer-inject.js`、`macos/assets/renderer-inject.js` |
| 精确 DOM 选择器 | `tools/selectors.json` | `windows/assets/selectors.json`、`macos/assets/selectors.json` |
| 回归契约 | `tools/renderer-runtime.test.mjs` | Windows/macOS renderer 测试读取生成资源 |

生成副本必须通过 `node tools/sync-runtime-assets.mjs` 更新，不能单独修改平台副本，否则下一次同步会覆盖修改。

### 1.2 公共 marker 机制

`runtime/renderer-inject.js` 中的 `refreshParts()` 为已确认的 DOM 节点增加 `data-ds-part`。透明度 CSS 只通过这些 marker 命中目标窗口，避免误伤其他正常功能。

当前相关 marker：

| marker | 用途 |
|---|---|
| `sidebar` | 左侧主导航和标题栏按钮展开的左侧浮动栏 |
| `profile-menu` | 左下角用户名对应的个人菜单 |
| `utility-side-panel` | 右上角“显示/隐藏侧边栏”打开的右侧窗口 |
| `bottom-panel` | 右上角“切换底部面板显示”打开的底部面板 |
| `environment-info-popover` | 右侧“环境信息”浮窗 |
| `environment-info-backdrop` | 环境信息浮窗外层的同尺寸 PIP backdrop |
| `settings-page` | 设置页各菜单共用的右侧内容框 |
| `composer` | 输入框壳或兼容 fallback 所识别的输入区域 |

### 1.3 动态状态监听

面板是否命中由触发按钮的 `aria-pressed="true"` 判断：

- `button[aria-label="显示/隐藏侧边栏"]` → `utility-side-panel`
- `button[aria-label="切换底部面板显示"]` → `bottom-panel`

`partObserver` 必须监听 `aria-pressed`。如果新增面板又使用 `aria-expanded`、`data-state` 或其他状态属性，必须同时补充观察属性和回归测试，否则可能出现“DOM 已打开但 marker 尚未刷新”的首屏问题。

## 2. 窗口索引

下面的透明度是当前工作区源码中的目标值。实时计算值可能显示为 `rgba(21, 22, 23, alpha)`，其中 alpha 才是透明度；背景 RGB 会随活动主题和原生外观变化，不应作为选择器依据。

### 2.1 左侧主导航和左侧浮动导航

**触发入口**

- 常驻左侧项目导航。
- 点击标题栏左上角侧栏按钮后展开的左侧浮动栏。

**精确定位**

- 主侧栏选择器：`left-panel`。
- 主侧栏实际选择器：

  ```css
  aside:is(.app-shell-left-panel, [class~="bg-token-main-surface-primary"])
  ```

- 浮动侧栏选择器：

  ```css
  aside[data-testid="app-shell-floating-left-panel"]
  ```

- 运行时 marker：`data-ds-part="sidebar"`。

选择器定义在 `tools/selectors.json` 的 `left-panel` 和 `floating-left-panel` 条目中。不要把这项改成所有 `aside`，因为浏览器侧栏、右侧工具面板和其他浮层也可能使用 `aside`。

**当前样式**

- 主侧栏和切换后的左侧浮框背景：`rgb(var(--ds-panel-rgb) / .10)`，与主交互区统一为 10% 透明面板层。这里调整的是背景 alpha，不使用 `opacity: 0`，所以文字、图标、按钮和交互仍保持可见可用。
- 模糊：`none`。左侧主菜单和切换后的左侧浮框不叠加背景模糊，避免透明后形成额外暗层。
- 背景图：该层 `background-image: none`，主题背景由下层显示。
- 在 immersive/home 两种高 specificity 状态下，仍使用带 `data-ds-part="sidebar"` 的状态限定规则，保持 `.10`，避免旧的 `.46/.58` 渐变重新胜出。

**直接调整位置**

在 `runtime/dream-skin.css` 搜索：

```text
[data-ds-part="sidebar"] {
```

当前主规则约在 1756 行；紧随其后的两条 immersive/home 状态规则也必须同步调整，否则不同页面状态可能恢复不透明背景或重新出现模糊。三条规则的 `background` 都应保持为 `rgb(var(--ds-panel-rgb) / .10) !important`，`background-image` 应为 `none !important`，`backdrop-filter` 应为 `none !important`。

### 2.1b 主交互区（主表面）

**精确定位**

- 选择器契约：`shell-main`，实际选择器为：

  ```css
  main:is(.main-surface, [data-app-shell-main-surface], [class*="_MainContentSurface_"])
  ```

- 运行时 marker：`data-ds-part="main"`。

**当前样式**

- 主表面背景：`rgb(var(--ds-panel-rgb) / .10)`，即保留一层很轻的透明面板色；不是纯黑底，也不是完全无背景。
- 主表面背景图：`none`；已移除 immersive 状态下的 `.46/.58` 横向渐变暗幕。
- 主表面阴影：`none`。
- 主表面字体：恢复 Codex 原生字体颜色和字形，不额外设置字体 alpha，不加 `text-shadow`；此前的文字阴影会造成字形周围的光晕，已移除。
- 该规则只作用于 marker 为 `main` 的主交互区，不改变消息卡片、输入框、工具栏或其他独立 surface。

**直接调整位置**

在 `runtime/dream-skin.css` 搜索：

```text
[data-ds-part="main"] {
```

同时检查 full、ambient/banner、home 三种高 specificity 主表面规则；它们的 `background` 应保持 `rgb(var(--ds-panel-rgb) / .10)`，`background-image` 应为 `none`，否则状态切换后会恢复旧暗层。若还需微调，先在 `.10` 附近调整面板 alpha；不要通过字体阴影或额外字体描边补对比度。

### 2.2 设置页各菜单对应的右侧内容框

**触发入口**

- 点击 Codex 设置入口，或使用 `Ctrl+,` 打开设置页。
- 左侧“常规、导入、个人资料、外观、语音、配置、个性化、宠物、键盘快捷键、使用情况和计费、账户、插件、浏览器、电脑操控、钩子、连接、Git、环境、Worktrees”等菜单均在同一个设置内容框内切换。

**现场证据（Windows Codex 26.810，2026-08-21）**

- 在设置页首次取到的唯一目标 `matchCount=1`。
- 未修复前的真实计算样式：`background-color: rgb(17, 17, 17)`；`box-shadow` 为 `rgba(252,252,252,.157) 0 0 0 .5px` 加两层原生黑色 elevation 阴影；`background-image: none`；`backdrop-filter: none`。
- 该根容器位于已经验证为 `rgba(21,22,23,.10)` 的主表面内部，因此黑色根背景会把主表面和主题图完全盖住；这是黑框的直接原因，不是字体对比度或输入框样式问题。
- 切换“外观”菜单后仍命中同一个根容器；现场验证结果保持 `background-color: rgba(0,0,0,0)`、`box-shadow: none`，说明规则覆盖的是设置页共用外壳，而不是只覆盖“常规”页面。

**精确定位**

- 选择器契约 key：`settings-page`。
- 实际选择器：

  ```css
  div[class~="electron:bg-surface"][class~="electron:elevation-prominent"][class~="windows:rounded-tl-lg"]:has(> [class~="draggable"][class~="electron:h-toolbar"]):has(> [class~="overflow-y-auto"])
  ```

  注意：上面为便于阅读换行，实际选择器中的 `windows:rounded-tl-lg` 与前一个类位于同一个 `div`，完整单行以 `tools/selectors.json` 为准。
- 运行时 marker：`data-ds-part="settings-page"`。
- marker 逻辑：`runtime/renderer-inject.js` 的 `settingsPageNodes()`，由 `refreshParts()` 标记；`detectScope()` 以该 marker 作为设置页高置信识别信号。

**当前样式**

- 设置页共用外壳：`background: transparent`。
- 背景图：`none`。
- 原生 elevation 阴影：`none`。
- `backdrop-filter`：`none`。
- 设置页内部的权限卡片、下拉框、开关和文字没有被通用规则覆盖，继续使用原生 surface 和字体，从而避免影响设置功能和可读性。

**直接调整位置**

在 `runtime/dream-skin.css` 搜索：

```text
[data-ds-part="settings-page"] {
```

如果以后需要让设置页更或更不透明，只调整这个规则；不要扩大到所有 `electron:bg-surface`、所有 `role=main` 或所有设置卡片。若设置菜单改版导致 marker 缺失，先重新读取实际 DOM 并更新 `tools/selectors.json`，不要先猜一个更宽的选择器。

### 2.3 左下角用户名个人菜单

**触发入口**

- 点击左下角用户名 `bobyer`。

**精确定位**

- 触发器：

  ```css
  button[aria-label='打开个人资料菜单'], button[aria-label='Open profile menu']
  ```

- 运行时先读取触发器的 `aria-expanded="true"`、`aria-controls`，再要求菜单满足：

  ```css
  [role="menu"][aria-labelledby="触发器 id"]
  ```

- marker：`data-ds-part="profile-menu"`。

这样只命中用户名对应的菜单，不会把项目菜单、普通下拉菜单或其他 `role="menu"` 一起改掉。

**当前样式**

- 透明度：`.62`。
- 模糊：`blur(14px) saturate(108%)`。
- 背景图：无。
- 阴影：主题线条加低强度下投影。

**直接调整位置**

在 `runtime/dream-skin.css` 搜索：

```text
[data-ds-part="profile-menu"] {
```

当前约在 182 行。菜单的 marker 逻辑位于 `runtime/renderer-inject.js` 的 `profileMenuNodes()`。

### 2.4 右上角摘要错误浮窗

**触发入口**

- 右上角出现的“摘要面板无法显示 / 重试”浮窗。

**精确定位**

```css
[data-pip-home-surface="thread-summary-panel"]
```

该窗口不使用 `role="menu"`，也不是环境信息浮窗，不能复用其他浮层选择器。

**当前样式**

- 透明度：`.72`。
- 模糊：`blur(14px) saturate(108%)`。
- 背景图：无。
- 原生黑色阴影被替换为主题线条和低强度阴影。

**直接调整位置**

在 `runtime/dream-skin.css` 搜索：

```text
[data-pip-home-surface="thread-summary-panel"] {
```

当前约在 134 行。该规则是直接命中原生 surface，不依赖 `data-ds-part`。

### 2.5 右侧环境信息浮窗

**触发入口**

- 右上角环境信息按钮展开的“环境信息”面板。

**精确定位**

```css
div[class~="bg-surface-elevated-secondary"][class~="rounded-3xl"]:has(> [class~="overflow-y-auto"])
```

这是 `tools/selectors.json` 的 `environment-info-popover` 条目，运行时还要求文本包含“环境信息”，然后设置：

```text
data-ds-part="environment-info-popover"
```

**当前源码样式**

- 当前透明度：`.56`。
- 模糊：`blur(14px) saturate(108%)`。
- sticky section header 同样为 `.56`。
- 背景图和原生 elevation shadow 被清除。
- 关联的同尺寸 backdrop：`data-ds-part="environment-info-backdrop"`，背景和阴影透明，避免出现两层黑色底。

**历史值说明**

旧的 `TASK_PROGRESS.md` 历史条目曾记录过 `.68`，但当前共享 CSS 和同步后的 Windows/macOS CSS 实际为 `.56`。以后调整时以本文件“当前源码样式”和 `runtime/dream-skin.css` 为准，不以旧历史条目为准。

**直接调整位置**

在 `runtime/dream-skin.css` 搜索：

```text
[data-ds-part="environment-info-popover"]
```

当前约在 152 行；backdrop 规则约在 172 行。

### 2.6 右上角“显示/隐藏侧边栏”右侧窗口

**触发入口**

```text
button[aria-label="显示/隐藏侧边栏"][aria-pressed="true"]
```

**精确定位**

```css
div[class~="absolute"][class~="top-0"][class~="bottom-0"][class~="left-0"][class~="min-w-0"][class~="bg-surface"][class~="border-l"][class~="border-default"]:has([data-app-shell-tabs="true"]):not(:has([data-app-shell-tab-panel-controller="bottom"]))
```

实际选择器是一行，定义在 `tools/selectors.json` 的 `utility-side-panel` 条目。它通过 `border-l`、绝对定位、tabs 标记，并排除底部 controller 来避免误命中底部面板。

运行时 marker：`data-ds-part="utility-side-panel"`。

**当前样式**

- 右侧窗口外层：`.56`。
- 外层模糊：`blur(12px) saturate(106%)`。
- tabs 根节点和内容 controller：透明，避免叠加第二层黑色。
- 顶部工具栏/页签区域：`.62`，保持文字和按钮可读。
- 右侧窗口边框和阴影使用主题线条，不使用原生不透明 surface。

**直接调整位置**

在 `runtime/dream-skin.css` 搜索：

```text
[data-ds-part="utility-side-panel"] {
```

当前约在 772 行。右侧页签工具栏规则紧随其后，搜索 `[class~="h-toolbar"]`；不要只改外层 `.56` 而遗漏 `.62` 的页签层。

### 2.7 右上角“切换底部面板显示”底部面板

**触发入口**

```text
button[aria-label="切换底部面板显示"][aria-pressed="true"]
```

**精确定位**

```css
div[class~="absolute"][class~="inset-x-0"][class~="top-0"][class~="min-h-0"][class~="border-t"][class~="border-default"][class~="bg-surface"]:has([data-app-shell-tabs="true"]):has([data-app-shell-tab-panel-controller="bottom"])
```

实际选择器是一行，定义在 `tools/selectors.json` 的 `bottom-panel` 条目。

运行时 marker：`data-ds-part="bottom-panel"`。

**当前样式**

- 底部外层：`transparent`，无额外阴影、无背景模糊。
- terminal 的 `.app-theme.electron-dark` 内容 surface：`transparent`，且只在 `bottom-panel` marker 范围内覆盖；其他动态 terminal 仍按全局 `.52` 规则。
- 底部 tabs 根和 bottom controller：透明。
- 底部工具栏：透明、无背景模糊。
- 活动 terminal 页签 `.group/tab.bg-surface`：透明。
- 页签旁边独立的 `.w-max.bg-surface` 控件：透明。
- 活动页签的原生 background image 被清除，防止同一个页签出现第二层黑色矩形。

**直接调整位置**

在 `runtime/dream-skin.css` 搜索：

```text
[data-ds-part="bottom-panel"] {
```

当前约在 802 行。底部外层规则之后紧跟 bottom-panel 范围内的 `.app-theme.electron-dark[class]` 内容规则；`[class]` 是为压过主区既有 `main ... .app-theme.electron-dark` 的 `.52 !important` 而保留的精确优先级补充，不能删除。随后依次是 tabs 根、`.h-toolbar-pane`、`.group/tab`、`app-shell-tab-background`、`.w-max.bg-surface` 和 bottom controller 规则。底部页签不能只改外层；所有这些 bottom-panel 内层也必须保持透明，否则活动页签仍可能恢复黑色矩形。不要修改全局 `.app-theme.electron-dark` 的 `.52`，以免影响其他动态 terminal。

### 2.8 “新对话”输入框首屏透明问题

**触发入口**

- 点击左侧“新对话”。

**问题性质**

这项不是把输入框改成某个半透明值，而是修复首次打开时 marker 刷新延迟。用户原本要求输入框保持透明，因此当前实时计算值必须保持：

```text
background-color: rgba(0, 0, 0, 0)
```

**精确定位**

- 旧版输入框壳：`.composer-surface-chrome`。
- 输入框工具栏：`.composer-surface-chrome [class*="_footer_"]`。
- 新版输入框根：`[class*="_ComposerLayoutRoot_"]`。
- 运行时兼容 marker：`data-ds-part="composer"`。
- fallback 逻辑：`runtime/renderer-inject.js` 的 `fallbackComposerNodes()`。

**修复点**

- part observer 监听 class、语义属性和 childList，使新对话复用已有节点时能在首屏刷新 marker。
- 不得把右侧面板、底部面板规则复制到 composer。
- 不得用 `[data-ds-part="composer"] { background: ... }` 覆盖当前输入区域的透明要求，除非先重新取得实时 DOM 证据并单独记录。

**直接调整位置**

在 `runtime/dream-skin.css` 搜索：

```text
_ComposerLayoutRoot_
```

当前约在 1212 行；输入框 task-mode 的透明层和 fade 清理规则在约 1535 行以后。这个区域与底部面板完全独立。

### 2.9 请求批准弹窗及其后方黑色渐变层

**触发入口**

- Codex 在执行需要用户授权的命令时，底部输入区域替换为“请求批准”卡片。

**现场和静态证据**

- Codex 26.810 原生实现不是普通 `role="dialog"`；审批卡使用稳定标记：

  ```css
  [data-codex-approval-surface]
  ```

- 原生 Card 同时带有 `bg-primary-soft` 与 `electron:elevation-prominent`。前者绘制原生不透明 surface，后者绘制 elevation 阴影；这两层就是截图中审批卡及其后方黑色层的直接来源。
- 原有底部清理规则只在 sticky 容器包含 `input`、`textarea`、`contenteditable` 或 `role="textbox"` 时生效。审批卡替换输入框后，该条件不成立，因此宽任务交互面板的 `.10` surface 规则继续保留，形成卡片后方的黑色渐变/暗层。

**精确定位**

- 卡片：`html[data-dream-skin="active"] [data-codex-approval-surface]`。
- 审批态 composer：带 `[data-codex-approval-surface]` 后代的 composer 根；实际兼容选择器包括 `.composer-surface-chrome`、`[data-ds-part="composer"]` 和 `[class*="_ComposerLayoutRoot_"]`。
- 审批态 sticky 宿主：`.sticky:has([data-codex-approval-surface])`。
- sticky 内确认的渐变子节点：

  ```css
  [class~="pointer-events-none"][class~="absolute"][class~="bg-gradient-to-t"]
  ```

**当前样式目标**

- 审批卡背景：`rgb(var(--ds-panel-rgb) / .56)`；这是与环境信息/右侧工具面板一致的可读玻璃层，不是完全透明。`background-image: none`。
- 审批卡仅保留主题边界和两条 inset 微高光，不保留 `electron:elevation-prominent` 的大面积下投影；`backdrop-filter: none`。
- 审批态 composer 与 sticky 宿主：`background: transparent`、无背景图、无 `box-shadow`、无 `backdrop-filter`。
- sticky 渐变子节点：`display: none`，避免在审批卡后方再绘制一块全宽黑色渐变。

**直接调整位置**

在 `runtime/dream-skin.css` 搜索：

```text
[data-codex-approval-surface]
```

当前包含三部分：审批卡本身、通用审批态 composer/sticky 清理规则，以及紧随其后的“wide task composer”高特异性审批态例外。最后一部分不能删除：宽任务交互面板已有更高特异性的 `.10` surface 规则，审批卡出现时必须在同一任务/main 边界内用 `:has([data-codex-approval-surface])` 精确覆盖它。

**回归边界**

- 不修改普通输入框的透明规则；审批标记移除后，实时 CSS 合同必须恢复 composer 的原有 `.10` 微高光样式。
- 不使用所有 `.sticky`、所有 `role="dialog"`、所有 `div` 或所有 elevation 类作为选择器，避免影响右侧面板、底部 PowerShell、设置页和普通对话框。
- 目前的实时合同验证使用隐藏的审批标记 fixture 验证级联结果；如果页面当时没有真实审批卡，不能把 fixture 结果描述成真实审批卡截图验证。真实审批状态应保持打开后再读取 `getComputedStyle()`，不得先关闭浮窗截图。

## 3. 已明确没有覆盖的窗口或内容

以下项目不能从本记录中的面板规则推导透明度：

1. 浏览器页签内部 WebView 的网页内容。当前只调整右侧 utility 外壳、页签和工具栏；如果要改 WebView 页面背景，需要在该 WebView 的独立文档中取证。
2. Windows 原生标题栏、最小化/最大化/关闭按钮和系统菜单栏。它们不是网页 CSS surface。
3. terminal 内部文字、PowerShell 内容和命令输出。当前只调整 terminal 容器和页签背景。
4. 截图缩略图、附件预览图和图片本身。它们是内容，不是透明窗口外壳。
5. 普通项目菜单、命令菜单和其他业务 `role="menu"`。当前没有把个人菜单规则扩大到所有菜单。
6. 普通对话框和业务弹窗。除本记录明确列出的摘要、环境信息和个人菜单外，不应自动套用同一 alpha。

## 4. 修改后的验收标准

### 4.1 右侧和底部面板同时打开

实时 CDP 应确认：

```text
pressedBottom = true
pressedUtility = true
utility data-ds-part = utility-side-panel
bottom data-ds-part = bottom-panel
utility outer = rgba(21, 22, 23, 0.56)
utility toolbar = rgba(21, 22, 23, 0.62)
bottom outer = rgba(0, 0, 0, 0)
bottom terminal content = rgba(0, 0, 0, 0)
bottom toolbar = rgba(21, 22, 23, 0.62)
composer = rgba(0, 0, 0, 0)
```

底部面板的可见大面积纯黑 descendant 应为 `0`。如果 marker 缺失，先检查触发按钮的 `aria-pressed` 是否被 part observer 监听，再检查 selector 是否仍命中，不能直接继续调 alpha。

### 4.3 设置页各菜单

实时 CDP 应确认：

```text
settings-page selector matchCount = 1
settings data-ds-part = settings-page
settings root background = rgba(0, 0, 0, 0)
settings root background-image = none
settings root box-shadow = none
settings root backdrop-filter = none
settings scope.baseState = settings
```

至少在“常规”和“外观”之间切换后各读取一次；两页都保持同一根容器透明，才能说明是共用设置外壳规则生效。设置页内部卡片可以保留原生 surface，不把 `[data-ds-part="settings-page"]` 规则扩大到其后代。

### 4.2 回归边界

每次改一个窗口后至少检查：

- 输入框仍然透明；
- 其他已调整窗口的 marker 和 computed style 未变化；
- 普通菜单、对话框、浏览器 WebView 未被通用选择器误命中；
- Windows/macOS 生成资源仍与 `runtime/` 同步；
- injector 使用工作区路径，而不是旧的 `%LOCALAPPDATA%\\CodexDreamSkin\\engine` 副本。

常驻 watcher 的 `state.json` 应满足：

```json
{
  "injectorPath": "D:\\project\\personal\\codex-skin\\windows\\scripts\\injector.mjs",
  "port": 9335
}
```

## 5. 已知历史问题

- 2026-08-20 曾出现重启无效：实际运行的是旧安装 engine，旧资源没有 utility/bottom selector 和 CSS。
- 2026-08-20 曾出现底部面板 CSS 已写入但不生效：打开按钮的 `aria-pressed` 未进入 observer 的 `attributeFilter`，导致 marker 没刷新。
- 2026-08-21 现场验证设置页时发现，仓库一次性注入会被仍在运行的旧 `%LOCALAPPDATA%\\CodexDreamSkin\\engine` watcher 在路由变化后覆盖；表现为新 revision 注入成功但设置页随后回到旧 revision。验证时必须核对 `state.json` 的 `injectorPath`，确保常驻 watcher 指向工作区版本。
- 这些问题的处理顺序固定为：先核对运行时路径和 revision，再核对选择器 matchCount/marker，最后读取 computed style；不要直接猜 CSS 没命中。
