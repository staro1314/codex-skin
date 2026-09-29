# Codex Skin 窗口透明度调整记录

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

Codex 151.0.7922（Windows，2026-08-25）实际使用的 aria-label 已变为：

```text
button[aria-label="显示/隐藏侧边面板"][aria-pressed="true"]
```

运行时同时兼容以上两个触发器标签。2026-08-25 的现场证据显示：面板外层仍命中下面的结构选择器，但旧运行时代码只检查“显示/隐藏侧边栏”，因此没有写入 `data-ds-part="utility-side-panel"`；计算背景随即回退为原生 `rgb(17, 17, 17)`。本次修复只补充触发器标签兼容，不改变面板 alpha、模糊、页签层或其他面板规则。

修复后现场验收（Windows Codex 151.0.7922，保持面板打开）：marker 数量为 `1`；外层计算背景为 `rgba(23, 21, 21, 0.56)`、工具栏为 `rgba(23, 21, 21, 0.62)`，两者背景图均为 `none`；utility 内可见的 `rgb(17,17,17)`/`rgb(21,22,23)` 不透明黑色后代数量为 `0`。关闭再打开后 marker 从 `0` 恢复为 `1`，外层 alpha 仍为 `.56`，最终保持打开状态。当前 composer 仍为原有 `rgba(23,21,21,.10)` 和原有 inset 微高光，底部面板当前未打开且未被本次代码修改。

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

**Codex 26.818 当前 DOM 复核（Windows，2026-08-21）**

- 当前任务页中，第一条真实黑色渐变节点为 `pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full bg-gradient-to-t from-surface via-surface`，计算样式为 `linear-gradient(... rgb(17,17,17) ... transparent)`；它位于 `.thread-scroll-container` 内的 `.sticky` 中。
- 同一页面的 `_ComposerLayoutRoot_` 位于底部容器的兄弟结构中，不是该 `.sticky` 的后代；因此 `.sticky:has(input/textarea/[role="textbox"])` 的旧门控实际 `match=false`，旧规则不会清除当前渐变。
- 第二条真实渐变为与 `_ComposerLayoutRoot_` 同属 `.min-w-0` 共同容器的 `pointer-events-none absolute inset-x-0 -bottom-1 h-7 bg-gradient-to-t from-surface to-transparent`，同样不是旧 sticky 输入框门控可达的节点。
- 当前页面实时 `getComputedStyle()` 同时确认：渐变背景为 `rgb(17,17,17)`，输入框根 `_ComposerLayoutRoot_` 自身仍是 `rgba(21,22,23,.10)`，输入框 footer marker `data-ds-part="composer"` 仍为透明；所以本次修复目标是两条渐变节点，不是调整输入框透明度。
- 修复后通过同一实时 CDP 页面复核：两条目标渐变均为 `display:none`、`background-image:none`、`box-shadow:none`；`_ComposerLayoutRoot_` 仍为 `rgba(21,22,23,.10)`，footer marker 仍为透明，未关闭目标页面或用关闭状态截图替代验证。

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
- Codex 26.818 的普通任务页兼容规则：以同一 `.thread-scroll-container:has([data-ds-part="composer"], [class*="_ComposerLayoutRoot_"])` 为范围，清理 sticky 下的全宽渐变，以及带 `_ComposerLayoutRoot_` 的 `.min-w-0` 共同容器下的 28px 渐变；不改 composer 根本身。
- 审批态另有一条同层级兼容规则：以 `.thread-scroll-container:has([data-codex-approval-surface])` 为唯一附加条件，清理同样两条渐变。它不改变普通输入框规则；审批 marker 消失后该规则不匹配，输入框仍按原 `.10` 透明层合同工作。

**直接调整位置**

在 `runtime/dream-skin.css` 搜索：

```text
[data-codex-approval-surface]
```

当前包含三部分：审批卡本身、通用审批态 composer/sticky 清理规则，以及紧随其后的“wide task composer”高特异性审批态例外。普通任务页的 Codex 26.818 sibling-layout 渐变清理紧随旧 sticky-child 规则之后；其后还有审批 marker 的 sibling-layout 清理，覆盖审批卡与 sticky 渐变为兄弟节点的实际结构。最后两部分不能删除：宽任务交互面板已有更高特异性的 `.10` surface 规则，审批卡出现时必须在同一任务/main 边界内用 `:has([data-codex-approval-surface])` 精确覆盖它，同时不能扩大到普通输入框。

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

## 6. 窗口级透明度控制落地记录（2026-08-30）

### 6.1 实时基线事实

- 当前本机正式 Codex 为 `26.825.5331.0`，CDP 端口为 `9335`；运行中的 injector 仍来自旧安装副本 `C:\Users\fuyou\AppData\Local\CodexDreamSkin\engine\scripts\injector.mjs`。编辑前已核对该副本与工作区共享 renderer/CSS/validator 的哈希一致；本次源码修改不会自动改变已运行安装态。
- 实时任务页的 sidebar 计算背景为 `rgba(21, 22, 23, 0.10)`；个人资料菜单打开后 marker 为 `profile-menu`，计算背景为 `rgba(21, 22, 23, 0.62)`；环境信息 popover 为 `rgba(21, 22, 23, 0.56)`，其配套 backdrop 为透明。
- 实时底部面板打开后 outer 与工具栏均为透明；这覆盖了历史记录中“底部工具栏 .62”的冲突，当前实现默认保持 `bottomPanel = 0`、`bottomToolbar = 0`。
- 实时右侧 utility 面板打开后 outer 使用 `bg-[var(--app-shell-panel-background,var(--color-surface))]`，原 `bg-surface` selector 命中数为 `0`，因此没有得到 marker，计算背景仍为不透明 `rgb(17, 17, 17)`。这不是 CSS alpha 值问题，而是 selector 漂移；selector 已在共享 `tools/selectors.json` 中兼容旧 `bg-surface` 与当前精确 class，并继续保留 tabs、定位、边框和 bottom 排除条件。

### 6.2 已实现的单一窗口控制合同

- `theme.controls.windowOpacity` 允许且只允许以下 12 个键：`sidebar`、`profileMenu`、`summaryPanel`、`environmentInfoPopover`、`utilitySidePanel`、`utilityToolbar`、`browserContent`、`composer`、`bottomPanel`、`bottomToolbar`、`approvalSurface`、`settingsPage`。
- 每个值必须是有限数字，范围 `0..1`，步进 `0.01`；缺失对象保持当前 CSS 行为，部分对象逐键回退，未知键 fail closed。
- 共享 renderer 通过 `--ds-window-opacity-*` 注入这些值，CSS 只在对应 runtime marker 上消费。浏览器 WebView 宿主现在由 `browserContent` 控制；输入框、审批卡后方渐变、environment backdrop、terminal 内层内容和 settings 内部卡片仍保持隔离。
- 控制中心在与“表面”同级的“窗口”页签中提供 12 个独立滑块和逐窗口预览；旧主题如果没有主动编辑窗口滑块，保存时不会无意增加 `windowOpacity` 字段；主动编辑后才写入完整窗口控制对象。

### 6.3 本次代码与验证边界

- 共享源：`runtime/theme-package-validator.mjs`、`runtime/renderer-inject.js`、`runtime/dream-skin.css`、`control-center/theme-store.mjs`、`control-center/public/`；selector 只改 `tools/selectors.json`，双端副本由同步脚本生成。
- 已通过：Node/renderer 语法、共享 renderer runtime、控制中心核心测试、selector Doctor、runtime Doctor、Safe CSS validator、Windows schema contract、video runtime contract、双端资源同步检查。
- 当前仍有两个环境/基线缺口：依赖子进程的 Windows Node 测试在沙箱中返回 `spawn EPERM`；`macos/tests/runtime-css-nested-has.test.mjs` 的“wide task workspace”用例要求的历史注释/渐变文本在当前 HEAD 源文件本来就不存在，三份 CSS 均因此同样失败，未将其改成绿色。
- 已通过项目启动器重启并完成安装态 post-change computed-style 验收：`state.json.injectorPath` 已指向 `D:\project\personal\codex-skin\windows\scripts\injector.mjs`，端口仍为 `9335`，Codex 版本为 `26.825.5331.0`。未直接覆盖官方 Codex 安装目录。

### 6.4 2026-08-30 post-change live 验收

- 初始任务页：sidebar `rgba(21, 22, 23, 0.10)`；环境信息 popover `rgba(21, 22, 23, 0.56)`；environment backdrop `rgba(0, 0, 0, 0)`；输入框 footer marker 仍为透明。
- 打开个人资料菜单：`data-ds-part="profile-menu"` 命中 `1`，背景 `rgba(21, 22, 23, 0.62)`。
- 同时打开底部与右侧 utility：新版 utility selector 命中 `1`、bottom selector 命中 `1`；utility outer/toolbar 分别为 `rgba(21, 22, 23, 0.56)`、`rgba(21, 22, 23, 0.62)`；bottom outer/toolbar 分别为 `rgba(21, 22, 23, 0)`、`rgba(21, 22, 23, 0)`；terminal 内层为透明。关闭后两个 marker 都清理，未遗留 DOM marker。
- 设置页：`settings-page` marker 命中 `1`，根容器背景为 `rgba(21, 22, 23, 0)`，`background-image` 为 `none`，`box-shadow` 与 `backdrop-filter` 均为 `none`；设置内部卡片未被该根规则覆盖。
- 运行时保留了 PIP summary 与 environment popover 的结构关系：本次 live 页面观察到的是 environment-info marker，未把它错误描述为独立 summary marker；独立 summary selector 仍保留在合同中，只有实际出现并通过结构校验时才会被标记。

### 6.5 2026-08-31 控制中心“应用所选主题”链路修复

- 故障不在 `windowOpacity` schema、renderer 变量或窗口 CSS：当前活动主题的 10 个 `--ds-window-opacity-*` 均已注入，侧栏实测变量为 `0.1`、计算背景为 `rgba(11, 26, 32, 0.1)`，右侧工具面板变量为 `0.56`、计算背景为 `rgba(11, 26, 32, 0.56)`。
- 确认的断点位于控制中心按钮语义：滑块只更新浏览器内存中的 dirty draft，而“应用所选主题”原先直接执行原生 `apply`，没有先保存 draft；因此它会重新应用磁盘上的旧主题，用户刚调的逐窗口值不会进入 `active-theme/theme.json`。
- 修复后，“应用所选主题”在当前已保存主题存在 dirty draft 时先 PUT 更新该主题，再执行原生 apply；没有改动时仍只重新应用。独立的“保存为新主题”和“保存并应用”能力保持不变。
- 2026-08-31 已构建并覆盖安装本地包；工作区、安装 payload 和本机 engine 的 `control-center/public/app.js` SHA-256 一致。桌面实机继续操作时检测到用户正在输入，已停止自动点击，未覆盖用户当前滑块值。

### 6.6 2026-08-31 底部输入框目标纠正

- 用户截图明确标注的目标是任务页底部 `_ComposerLayoutRoot_` 输入框，而控制中心原“底部面板”实际对应由“切换底部面板显示”打开的 terminal 面板。两者是不同 DOM、不同 marker 和不同 CSS 合同；此前验证 terminal 面板不能证明输入框会变化。
- 原实现还把输入框列为 `windowOpacity` 的保护项，因此 `bottomPanel = 0` 正常保存和应用后，红框输入区仍保持现有 `.10` alpha 是代码预期，不是安装失败。本次将这一目标误判纠正为合同缺项。
- 新增 `windowOpacity.composer` 和 `--ds-window-opacity-composer`，默认 `0.10`；CSS 只作用于 `.composer-surface-chrome`、`data-ds-part="composer"` 和 `_ComposerLayoutRoot_` 三个既有精确边界。审批态后方渐变、终端面板、环境 backdrop 和设置内部卡片继续隔离。
- 控制中心新增“底部输入框”，原“底部面板/底部工具栏”改名为“底部终端面板/终端面板工具栏”。用户将底部输入框调为 `0` 后，目标输入框背景 alpha 才应为 `0`。
- 2026-08-31 新包已覆盖安装；源码、安装 payload 与本地 engine 的 `app.js`、`dream-skin.css`、`renderer-inject.js`、`theme-package-validator.mjs` 摘要一致。此证据只证明新合同已落盘，实际计算样式仍须在用户应用“底部输入框 = 0”后核对。
- 控制中心窗口项现按界面位置和语义命名：左侧导航栏、左下角个人资料菜单、对话摘要面板、右侧环境信息浮层、右侧工具侧栏/工具栏、底部会话输入框、底部终端面板/工具栏、命令审批卡片、设置页内容框架。每张预览卡通过 `data-window-control` 和 `aria-controls` 绑定对应滑块；点击预览会定位并高亮该滑块，数值同步显示在卡片上。
- 三层联动现已闭合：窗口滑块写入 `preview-stage` 的 `--window-opacity-*`，中间模拟 Codex 预览的对应 `data-window-preview-target` 实时消费这些变量；选中滑块或预览卡后，中间预览只显示并高亮当前区域，右上角 `WINDOW LINK` 读数同步当前对象。中间预览的额外区域（环境浮层、工具侧栏、底部终端面板、审批卡片、设置页框架）默认隐藏，选中后显示，避免同时堆叠造成误读。

### 6.7 2026-09-01 窗口名称与中间预览映射复核

- [verified] 当前运行中的 Codex `26.825` CDP 实测：左侧 `aside.app-shell-left-panel` 是导航面板；右侧 utility 根节点为 `absolute top-0 bottom-0 left-0 ... border-l`，其顶部栏是内部 `h-toolbar`；环境信息浮窗是该 utility 根内的 `rounded-3xl bg-surface-elevated-secondary` 节点。
- [verified] 当前运行中的 `[data-pip-home-surface="thread-summary-panel"]` 与环境信息浮窗同区域、同尺寸，实际是 PIP 底层节点，不是中间消息回复卡片；环境浮窗打开时运行时会把它标记为 `environment-info-backdrop` 并清除其背景，防止双层变暗。因此控制中心将该项改名为“右侧摘要底层面板”，并在说明中明确这一动态边界。
- [verified] 打开底部面板后，真实根节点为 `x=275` 的主内容区外壳，包含 `data-app-shell-tab-panel-controller="bottom"`；其直接 `h-toolbar-pane` 子节点才是终端顶部栏。设置页的 Windows 目标是保留 shell 后的右侧内容面板，不是整窗覆盖层；会话审批节点属于底部 composer 内部。
- [implemented] 控制中心中间预览已按上述真实父子关系重排：环境信息浮窗和摘要底层均位于右侧工具面板内，审批卡片位于会话输入区域内，底部终端面板和设置页从左侧导航之后开始，左侧图标轨道与导航面板共同响应 sidebar 选中态。
- [implemented] 清理预览卡遗留的 `data-window-preview` 样式选择器，统一改为当前 `data-window-control`；新增控制中心结构断言，防止摘要再次绑定到中间回复卡片。
- [verified] `node --check control-center/public/app.js`、`node --check tools/control-center.test.mjs`、控制中心测试 13/13、renderer runtime 测试和 `git diff --check` 均通过。源码修正后旧安装包不包含本轮映射，未重新打包。

### 6.8 2026-09-02 浏览器网页内容透明度控制

- [root-cause] `utilitySidePanel = 0.56` 只作用于右侧工具面板外层；动态浏览器/终端 surface 另有固定 `.52` 的 `.app-theme.electron-dark` 规则，因此调节外层滑块不会改变浏览器网页区域的可见背景。
- [implemented] 新增可选的 `windowOpacity.browserContent`，默认值保持现有 `.52`；`tools/selectors.json` 以 `[data-browser-sidebar-webview]` 登记浏览器宿主边界，运行时标记为 `data-ds-part="browser-content"`，共享 CSS 改为消费 `--ds-window-opacity-browser-content`。
- [implemented] 控制中心新增“右侧浏览器网页内容”滑块、预览卡和中间预览区域，保存、导入导出和部分字段回退沿用现有 `windowOpacity` 合同；`utilitySidePanel` 与 `utilityToolbar` 的职责不变。
- [boundary] 只调整浏览器宿主背景 alpha；嵌套原生 `webview` 仍不改几何、页面自有样式或交互，其他动态 terminal 继续使用原有全局 `.52` 规则。

### 6.9 2026-09-11 真实 Codex 逐项复核

- [evidence] CDP 返回的第一个页面是控制中心 `http://localhost:8090/general-agent`，不能用于 Codex 窗口验收；改为选择 `app://-/index.html` 后，真实 renderer 的活动主题变量已读到 12 项。
- [evidence] 真实当前状态中 sidebar `.10`、utility 外壳 `.56`、browser host `.52` 的计算背景均符合活动主题；composer marker 的变量为 `.04`，但实际背景仍为 `.86`，原因为通用 `.app-theme.electron-dark` 规则的 class specificity 高于 marker-only composer 规则。
- [implemented] composer 增加限定在 `.app-theme.electron-dark` 宿主下的高 specificity 规则，并兼容当前 `_ComposerLayoutInput_` CSS-module class；浏览器宿主 marker 只保留可见、可交互、非零尺寸节点，隐藏历史 WebView 不再参与当前透明度消费。
- [pending] 本轮源码与双端资产已通过 renderer 回归和同步检查，但安装态仍运行修复前资产；重新打包/安装后必须重新读取每个打开窗口的 computed style，未将未安装源码修复宣称为 live 验收完成。

### 6.10 2026-09-14 原生浏览器 WebView 被视频层遮挡

- [root-cause] 在同一个可见 WebView 中加载固定 `data:` 测试页，并按 adopted stylesheet 顶层规则二分。只启用 `[data-dream-skin-video]` 规则即可让原生 guest 消失；单独启用 `body` 背景、视频态 `#root` 和 `body::after` 均不会复现。根因是全屏视频元素的 `position: fixed` 与 `z-index: 0 !important` 进入原生 WebView 合成层之前。
- [implemented] 背景媒体仍保持全屏、播放、缩放和状态动画，仅将 `[data-dream-skin-video]` 调整为 `z-index: -1 !important`；没有删除、隐藏或停用视频皮肤。浏览器宿主 `browserContent` 透明度规则保留。
- [visual-verified] 热注入完整主题后，同一截图同时显示主题背景、Codex 透明界面和右侧 `WEBVIEW CONTENT IS VISIBLE` 原生 guest，证明视频仍可见且 WebView 不再被遮挡。
- [regression] `tools/renderer-runtime.test.mjs` 新增背景媒体必须位于 `-1` 层的断言；真实网页内容仍由网页自身和服务状态决定，不以外部服务在线作为此合成层修复的前提。
### 6.11 浏览器网页内容透明度必须作用于原生 guest 合成结果（2026-09-14）

- 运行时证据：`--ds-window-opacity-browser-content=0.52` 已到达根节点，但可见的
  `[data-ds-part="browser-content"]` 只有透明背景，原生 `<webview>` guest 仍以不透明
  合成层绘制，因此旧实现调节宿主 `background` 不会改变网页内容的视觉透明度。
- 修复：在已登记的浏览器宿主上增加
  `opacity: var(--ds-window-opacity-browser-content) !important`。该规则只影响原生 guest
  的最终合成输出，不复用也不覆盖 `utilitySidePanel` 或 `utilityToolbar`。
- 视觉验收：在同一真实 Codex renderer、同一浏览器页和视频主题下临时切换 1.00/0.25，
  截图 `artifacts/browser-content-opacity-1.png` 与
  `artifacts/browser-content-opacity-0_25.png` 显示网页内容整体透明度明确变化，而相邻工具栏、
  中间会话区保持不变；computed opacity 分别为 `1` 和 `0.25`。测试后已恢复主题值。

### 6.12 浏览器宿主不得覆盖原生浮层（2026-09-14）

- 复测发现此前用于绕过视频遮挡的 `[data-browser-sidebar-webview] { z-index: 20 }` 会把
  独立 WebView 合成层抬到环境信息浮层之上，导致浮层 marker 和 computed background 正常，
  但视觉上仍只看到网页。
- 视频层已经通过 `z-index: -1` 放到底层，浏览器宿主不再需要额外抬高。删除该 z-index，
  并增加 renderer CSS 断言，禁止浏览器宿主再次覆盖 Codex 菜单、浮层和对话框。
- Electron 截图对浮层和 guest 的合成顺序仍有平台差异；验收浮层时允许在截图瞬间隐藏
  guest 宿主并立即恢复，但不得关闭标签、删除网页或将该状态作为产品实现。

### 6.13 视觉 A/B 的变量优先级与输入框两级关系（2026-09-14）

- 运行时会把部分 `--ds-window-opacity-*` 以 inline `!important` 写入根节点。视觉诊断脚本
  必须用同优先级临时值，并保存/恢复原值和 priority；普通 `setProperty` 会造成变量未变化的
  假失败。
- 会话输入框按外到内分两级：`composerShell` 控制边框包围的完整输入容器，
  `composerEditor` 控制内部文字编辑带。内层覆盖重叠像素，视觉优先级高于外壳；验证外壳时
  重点观察上下留白和边缘区域，验证编辑区时观察中间输入带。

### 6.14 Codex 26.903 设置页与环境标题结构漂移（2026-09-14）

- [root-cause] 设置页右侧内容框仍保留 `electron:bg-surface` 与
  `windows:rounded-tl-lg`，但已移除旧选择器依赖的 `electron:elevation-prominent`、直接
  toolbar、直接滚动内容子节点，并增加布局包装层。旧 `settings-page` selector 因此命中 0，
  透明度变量虽然存在但没有消费节点。
- [implemented] `settings-page` 改为限定在 `_MainContentSurface_` 内的 Electron surface 与
  Windows 圆角联合选择器。热注入后 marker 命中 1；1.00/0.05 A/B 的背景分别为
  `rgb(11, 26, 32)` 与 `rgba(11, 26, 32, 0.05)`，设置内部卡片未被扩大命中。
- [root-cause] 环境信息标题已从浮窗根的直接 `header` 变为 `section > header`。旧直接子选择器
  不再命中；同时 `header::before` 仍消费外壳变量，导致独立 `environmentHeader` 控制无效。
- [implemented] 标题和标题伪层均改为消费 `--ds-window-opacity-environment-header`。运行态
  1.00/0.05 A/B 的标题背景分别为 `rgb(11, 26, 32)` 与
  `rgba(11, 26, 32, 0.05)`；外壳仍独立消费 `environmentInfoPopover`。
- [visual-boundary] 当前 Electron `Page.captureScreenshot` 会把原生 WebView guest 合成在浮层
  截图之前；临时将宿主及 `webview` 设置为 `display:none`、`visibility:hidden` 或
  `opacity:0` 后仍得到 guest 图像。因此这些 clipped 截图不能作为环境浮层视觉通过证据，
  computed-style 结果只能证明规则生效。不得把该工具限制误报为产品层级回归。
# 2026-09-14 视频主题与原生浏览器合成冲突补充

- 浏览器内容透明度变量已确认不是本次空白根因：宿主 `browserContent=1`、guest URL 与尺寸正常时，持续播放视频仍会让原生 guest 不可见。
- `5bab518` 加入的 Windows 启动参数强制启用完整 `DelegatedCompositing`，但没有视频 + 原生 WebView 的视觉验收；当前实测与独立 DComp surface 冲突一致。
- 已从启动链移除 `DelegatedCompositing` / `DelegatedCompositingLimitToUi` 强制开关。最终结论必须等待无该参数的新 Codex 进程做真实网页同屏验证，不能用代码测试替代。
- 无 delegation 强制开关的新进程实测仍复现：视频播放时 fixture 空白、暂停皮肤后 fixture 完整显示，故该回退不足以修复浏览器。
- 下一 A/B 使用 `--disable-direct-composition-video-overlays`，只禁止视频 overlay；必须在新进程中同时验证视频时间推进与原生 guest 可见。

### 6.15 视频主题根堆叠上下文与原生 WebView 合成（2026-09-14 最终结论）

- [correction] 6.10 中“仅 `[data-dream-skin-video]` 规则即可让 guest 消失”以及“只需把视频层降到 `-1`”不是最终根因。严格二分显示：视频规则单独启用不会复现，视频态 `body > #root` 单独启用也不会复现；二者组合时才失败。
- [root-cause] `body > #root { position: relative; z-index: 1 }` 创建正层级根堆叠上下文，与 `position: fixed; z-index: -1` 的视频背景组合后，使 Electron 原生 WebView guest 未进入最终合成。空白区域顶层元素仍是 `<webview>`，不存在覆盖 DOM 或伪元素；可见灰色为 WebView 的 `rgb(33, 33, 33)` 占位背景。
- [fix] 保留根节点 `position: relative` 与视频的全屏动态播放，只把视频主题根节点改为 `z-index: auto`。不要重新引入浏览器宿主 `z-index: 20`，也不要恢复已证伪的 DirectComposition 视频 overlay 启动参数。
- [visual-verified] 清除所有临时 adopted stylesheet 后，安装态 engine CSS 仍通过 fixture；恢复 `http://localhost:8090/ledger-window-new` 后，guest 文档 `readyState=complete` 且正文可读。`artifacts/final-install-source-real-a.png` 与 `artifacts/final-install-source-real-b.png` 同时显示完整台账网页和不同视频帧；视频运行态为 `readyState=4`、`paused=false`、`error=null`。
- [acceptance] 后续变更必须同时满足：视频 `currentTime` 连续推进或正常循环、真实网页视觉可见且可交互、浏览器浮层不被宿主 z-index 覆盖、暂停/恢复皮肤不改变浏览器 URL。fixture 只能验证合成边界，不能替代真实网页最终验收。

### 6.16 主内容区边界与底部终端正文层（2026-09-14）

- “主内容区”绑定 `_MainContentSurface_`：从左侧导航右边开始、位于顶部应用菜单下方，是任务会话、浏览器或编辑器的工作区外壳。网页 guest、会话输入框、底部终端和浮层具有独立变量，优先覆盖重叠区域，不能用主内容区设置替代。
- Codex 26.903 的底部终端分三层：外壳 `[data-ds-part="bottom-panel"]`、顶部 `h-toolbar-pane`、工具栏下的终端正文 flex surface。视觉优先级为终端正文/工具栏高于外壳。
- `bottomPanel` 必须同时控制外壳和终端正文层；`bottomToolbar` 只控制顶部 40px 工具栏。终端正文的精确特征为 bottom marker 内的 `relative flex min-h-0 flex-1 flex-col` 且带 `bg-[var(--app-shell-panel-background,var(--color-surface))]`。
- 真实运行态曾出现外壳与工具栏 alpha 均为 0、但正文仍为 `rgb(17,17,17)` 的失效状态。修复后 1.00/0.05 视觉 A/B 明显变化，截图位于 `artifacts/window-opacity-visual/bottomPanel-*` 和 `bottomToolbar-*`。

### 6.17 Codex 26.924 会话容器误命中顶部渐变规则（2026-09-29）

- [root-cause] Windows Codex `26.924.2738.0` 将 `data-app-shell-main-content-top-fade="visible"` 放到了包裹完整会话正文和输入框的业务容器；真正的装饰渐变仍是它下面带 `aria-hidden="true"` 的 `_MainContentTopFade_` 子节点。旧合同中的裸 `[data-app-shell-main-content-top-fade]` 因而把完整业务容器命中为渐变层，并由共享 CSS 施加 `display:none !important`，使 thread 和 composer 的运行态矩形同时变成 `0x0`。
- [evidence] 失败态最上层匹配规则来自第一张 adopted stylesheet；移除该单条命中后正文立即恢复。结构审计确认业务容器含渐变子节点和实际会话子树，不是蒙版覆盖、视频层遮挡或 WebView 合成问题。
- [fix] `main-content-top-fade` 只接受历史专用类 `.app-shell-main-content-top-fade`、带 `aria-hidden="true"` 的专用 data 节点或 `[class*="_MainContentTopFade_"]`；明确禁止恢复裸 `[data-app-shell-main-content-top-fade]`。共享 selector 合同、Windows/macOS 生成资产和 runtime CSS 已同步。
- [compatibility] 新增 Windows `26.924` validated profile。该变更只缩窄装饰渐变的隐藏范围，不改变主内容区、输入框、浏览器、底部终端、视频背景和各窗口透明度变量的归属。
- [visual-verified] 修复后的真实 Codex 截图 `artifacts/codex-26.924.2738-fixed-runtime.png` 同时显示新版 52px 图标轨道、项目侧栏、顶部应用菜单、会话正文、输入框和动态视频背景。computed geometry 为 thread `1146x752`、composer `736x98`、业务容器 `1146x752`；真正的 `_MainContentTopFade_` 子节点保持 `display:none`。
- [video-regression] 两次采样中视频 `readyState=4`、`paused=false`，`currentTime` 从 `1.61457` 推进到 `6.258912`，证明修复没有通过暂停或移除视频换取正文可见。
- [acceptance] 后续 Codex 升级必须同时核对：业务容器非零尺寸、真正渐变节点被隐藏、会话与 composer 可见、视频时间推进、浏览器/终端等独立 surface 未被扩大命中。仅看选择器命中数量不能替代 computed geometry 和视觉截图。
- [installed-visual] v1.0.4 Setup 本机升级安装成功后，控制中心 `resume` 在 Codex 窗口可见时返回 `applied=true`。安装态截图 `artifacts/codex-26.924.2738-installed-1.0.4.png` 显示新版导航轨道、项目侧栏、会话正文、输入框和视频同屏；thread `1146x752`、composer `736x98`，无隐藏祖先。视频 `readyState=4`、`paused=false`、`error=null`，连续采样跨越循环边界从 `7.468395` 到 `2.259729` 秒。
- [visual-note] 当前用户所选视频主题在画面亮部对白色会话文字的对比偏低；本次只修复误隐藏，不擅自修改用户保存的主内容区透明度或主题素材。安装态另已实际导航并截图首页 `artifacts/codex-26.924.2738-installed-home-1.0.4.png` 和设置页 `artifacts/codex-26.924.2738-installed-settings-1.0.4.png`：新版左侧导航及设置卡片结构可见、无整页误隐藏；随后通过返回按钮恢复原会话。右侧浏览器和底部终端未打开，仍需单独视觉复验。

### 6.18 Codex 26.924 底部终端第三层正文表面（2026-09-29）

- [root-cause] 新版底部终端的外壳已移除旧 `bg-surface` 类，且按钮 aria-label 从“切换底部面板显示”改为打开时的“隐藏底部面板”；旧 selector 与旧 aria-pressed 门控因此同时失效，`bottom-panel` marker 未写入。
- [evidence] 修复外壳 selector 和按钮门控后，实时 marker 命中唯一外壳，外壳、工具栏、正文第一层 computed background 已随 `bottomPanel` 变为 `rgba(11, 26, 32, 0.16)`；视觉截图仍显示底部黑块。继续对该 marker 的可见 descendants 做 computed-style 审计，唯一剩余大面积不透明层是 `relative flex h-full w-full flex-col`，computed background 为 `rgb(17, 17, 17)`。
- [fix] 在 `bottom-panel` marker 内仅覆盖这组结构特征的新版 terminal-content surface，使用同一 `--ds-window-opacity-bottom-panel`；没有扩大到全局 `.app-theme` 或所有 `flex-col`，工具栏仍由 `bottomToolbar` 独立控制。
- [acceptance] 需同时满足：打开态按钮 marker 命中唯一外壳；外壳、工具栏、正文两层和 terminal-content surface 都不再保留 `rgb(17,17,17)` 不透明填充；底部真实终端内容仍可见；视频继续推进；其他窗口与浏览器规则不受影响。

### 6.19 Codex 26.924 重启后视频焦点恢复与浏览器复验（2026-09-29）

- [runtime-evidence] 用户重启 Codex 并通过控制中心重新启用皮肤后，安装态 renderer 的视频节点为 `readyState=4`、`error=null`、`display=block`，但在控制中心保持前台时 `document.hasFocus()=false`，视频为 `paused=true`。现有 `blur` 处理器会暂停视频，`focus` 处理器会调用 `ensure` 恢复播放；因此该暂停状态属于焦点生命周期，不是视频资源损坏或 WebView 遮挡。
- [verified] 触发同一已注册的 focus 恢复路径后，视频 2 秒内从 `currentTime=5.431762` 推进到 `7.4351`，随后继续循环；未修改视频为静态图，也未移除视频层。
- [visual-verified] `artifacts/codex-restart-video-a.png` 与 `artifacts/codex-restart-video-b.png` 是真实 Codex renderer 的连续截图，背景画面不同；同屏可见新版 Codex UI、视频皮肤、右侧 WebView 外壳和底部终端。
- [browser-boundary] 同屏 WebView 当前完整显示 Chromium 的 `ERR_CONNECTION_REFUSED` 页面，失败 URL 为 `http://localhost:8090/ledger-window-new`。这证明 WebView guest 没有被蒙版覆盖；页面业务内容不可见的原因是该本地服务未响应，本轮不改变服务启动方式。fixture 成功显示证据仍为 `artifacts/codex-26.924.2738-browser-fixture-visible.png`。
- [acceptance] 重启后的最终验收必须在 Codex 窗口重新取得焦点后同时满足：视频 `paused=false` 且时间持续推进、底部终端正文按 `bottomPanel` 透明度显示、WebView guest 可见且可交互；本轮已完成前三项的运行态/视觉证据，真实台账页面仍受本地 8090 服务状态限制。
- [regression] Windows renderer 资产测试最初未通过，是测试 mock 只登记了单个 aria selector，而实现向 DOM 查询逗号合并 selector；实现已改为逐个候选 selector 查询，真实 DOM 语义不变，`windows/tests/renderer-inject.test.mjs` 已通过。
- [environment-boundary] 完整 Windows suite 在当前环境的 `.NET File.Replace` 最小探针同样返回 `Access denied`，因此保留该测试失败，不修改原子替换实现。新安装包构建还被官方 WebView2 与 Node 依赖下载的 TLS/连接错误阻断；未生成新 Setup，旧包不代表本轮修复。
