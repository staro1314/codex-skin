# 控制中心增加窗口级透明度调节：实施计划

> 状态：已实施窗口级透明度及右侧浏览器网页内容独立控制；尚未重新打包、未提交、未推送。  
> 记录日期：2026-08-30  
> 当前工作分支：`client-name`

## 1. 目标

在 Codex Skin 控制中心增加“窗口级透明度”调节，使用户能够分别调整已确认的侧栏、菜单、浮窗、底部面板、审批卡和设置内容框，而不是继续用一个全局 `controls.surfaceOpacity` 同时改动多个界面。

透明度的语义统一为“背景色 alpha”：

- `0` 表示背景透明；`1` 表示背景完全不透明。
- 只调整目标 surface 的 `background` alpha，不使用元素级 `opacity`，不降低文字、图标、按钮和交互的可见度。
- 不改变模糊、圆角、字体颜色、文字阴影或主题背景图，除非另有独立需求并完成独立验证。

## 2. 当前已确认的实现基线

以下事实来自当前 `runtime/`、`tools/selectors.json` 和 `code-help/TRANSPARENCY_ADJUSTMENT_RECORD.md`；实现前仍需对正在运行的 Codex 做一次 live computed-style 复核，防止客户端升级造成选择器漂移。

| 界面 | 运行时 marker / 精确边界 | 当前目标值 | 保护边界 |
|---|---|---:|---|
| 左侧主导航及左侧浮动栏 | `data-ds-part="sidebar"`；`left-panel`、`floating-left-panel` | `.10` | 只命中已登记 `aside`，不扩大到所有 `aside` |
| 左下角用户名菜单 | `data-ds-part="profile-menu"` | `.62` | 只跟随用户名按钮的 `aria-controls`/`aria-labelledby` 关系 |
| 会话摘要浮层 | `data-pip-home-surface="thread-summary-panel"` | `.72` | 只命中该 PIP surface，不使用所有 popper 的通配规则 |
| 环境信息浮窗 | `data-ds-part="environment-info-popover"` | `.56` | 同尺寸 `environment-info-backdrop` 必须保持透明，防止双层黑底 |
| 右侧工具面板 | `data-ds-part="utility-side-panel"` | `.56` | 页签/工具栏另有独立层，不能只改外层 |
| 右侧工具面板页签工具栏 | `utility-side-panel` 内 `[class~="h-toolbar"]` | `.62` | 只作用于右侧工具面板内部的页签层 |
| 右侧浏览器网页内容 | `data-ds-part="browser-content"` / `[data-browser-sidebar-webview]` | `.52` | 只控制浏览器 WebView 宿主背景 alpha，不改嵌套原生 `webview` 的页面几何与页面自有样式 |
| 底部面板 | `data-ds-part="bottom-panel"` | 当前源码为透明 | terminal、tabs、controller 和 tab background 不能恢复原生黑底 |
| 底部工具栏 | `bottom-panel` 内 `[class~="h-toolbar-pane"]` | 当前源码为透明；历史验收记录曾写 `.62`，存在冲突 | 必须 live 复测后才能确定产品默认值，不以旧记录猜测 |
| 审批卡 | `[data-codex-approval-surface]` | `.56` | 保留适当玻璃层；审批卡后方两条全宽渐变和原生大面积 elevation 阴影不属于透明度滑块 |
| 设置页共用内容框 | `data-ds-part="settings-page"` | 透明 | 只改共用外壳，不覆盖内部权限卡、下拉框、开关和文字 |
| 普通输入框 | `data-ds-part="composer"` / `_ComposerLayoutRoot_` | 按现有透明合同 | 本计划默认不开放窗口级滑块，禁止因新增字段重新给输入框加背景或渐变 |

当前代码的关键事实：

1. `runtime/theme-package-validator.mjs` 的 `theme.controls` 目前只有 `surfaceOpacity`、`surfaceBlur`、`surfaceRadius`、`imageZoom`、`imageDim`、`motionLevel`，并通过 exact-key 校验。
2. `control-center/public/index.html` 目前只有一个 `controls.surfaceOpacity` 滑块；`control-center/public/app.js` 将其预览为单一 `--surface-opacity`，不能直接改名或复用为窗口级对象。
3. `runtime/renderer-inject.js` 当前把全局 `surfaceOpacity` 写入 `--ds-theme-surface-opacity`；`runtime/dream-skin.css` 的各面板规则仍有大量固定 alpha。新增功能需要显式映射，不能把全局变量替换成“所有 surface 自动继承”。
4. 双端注入器已经从 `theme.controls` 读取并校验控制项，但是否只需扩展共享合同、无需额外平台分支，必须由双端 payload 测试确认，不能凭 Windows 结果推断 macOS。

## 3. 建议的配置合同（实现前冻结）

建议在现有 `theme.controls` 下增加可选对象 `windowOpacity`，保持旧主题没有该字段时行为完全不变：

```json
{
  "controls": {
    "surfaceOpacity": 0.86,
    "windowOpacity": {
      "sidebar": 0.10,
      "profileMenu": 0.62,
      "summaryPanel": 0.72,
      "environmentInfoPopover": 0.56,
      "utilitySidePanel": 0.56,
      "utilityToolbar": 0.62,
      "browserContent": 0.52,
      "bottomPanel": 0.00,
      "bottomToolbar": 0.00,
      "approvalSurface": 0.56,
      "settingsPage": 0.00
    }
  }
}
```

上面是合同草案，不是当前代码事实。实施前必须完成以下冻结事项：

- 确认字段命名和键集合；不允许用户输入任意 CSS selector、CSS 字符串或任意 JSON 键。
- 确认是否把 `utilityToolbar`、`bottomToolbar` 作为可调项；它们是页签可读性层，默认值必须来自当前 live 样式。
- `composer`、审批后的 sticky 渐变、环境浮窗 backdrop、底部 terminal 内部 surface、普通设置卡片列为保护项，不进入第一版滑块。
- 每个 alpha 使用 `0..1`、步长 `.01`、有限数校验；保留 `surfaceOpacity` 作为旧主题/全局兼容字段，不将它静默解释为 `windowOpacity`。
- 缺失 `windowOpacity` 时使用当前共享 CSS 的固定合同；字段部分缺失时按键级 fallback，不能把缺失项变成 `undefined` 或继承相邻窗口值。
- “保存”只写主题草稿/主题包；“应用”才改变当前运行时。失败时保持旧主题和旧控制值，不产生半套运行时状态。

## 4. 实施顺序与文件范围

### 阶段 A：基线复核（先做，不改代码）

1. 按透明度记录核对当前 `runtime/renderer-inject.js`、`runtime/dream-skin.css`、`tools/selectors.json` 的 marker、触发器和 CSS 优先级。
2. 在真实 Codex renderer 中保持目标面板打开，读取 `matchCount`、marker 数量、`backgroundColor`、`backgroundImage`、`boxShadow`、`backdropFilter`；至少覆盖侧栏、用户名菜单、右侧面板、底部面板、审批卡、设置页和普通输入框。
3. 对右侧页签、底部页签、审批卡后方渐变、环境 backdrop 单独取样，解决记录与源码的底部工具栏值冲突。
4. 记录当前运行时 `injectorPath`、revision 和双端资源 hash；如果实际运行的是旧安装 engine，先停止实施，避免验证错版本。

### 阶段 B：共享数据合同

预期修改范围：

- `runtime/theme-package-validator.mjs`：扩展 exact-key schema，验证 `windowOpacity` 键和值，拒绝未知键、数组、NaN、无穷和越界值。
- `control-center/theme-store.mjs`：规范化、继承、部分字段 fallback 和 optional-field 保留逻辑；旧主题不得被无意补写成新合同。
- 相关 validator/store 测试：覆盖合法值、缺失字段、部分字段、未知键、越界值、旧主题 round-trip 和导入导出失败路径。

### 阶段 C：控制中心界面和预览

预期修改范围：

- `control-center/public/index.html`：新增与“表面”同级的“窗口”页签，在其中提供独立的“窗口级透明度”分组，按用户可理解的窗口名称显示百分比和原始 alpha；保护项显示为说明而不是可编辑滑块。
- `control-center/public/app.js`：增加 fallback、draft path、输出值、重置、保存、应用和导出链路；不能只改视觉预览而遗漏持久化。
- `control-center/public/styles.css`：仅补充该分组的布局/说明样式，不修改已有按钮、输入框和控制中心整体透明度。
- 预览至少提供“主窗口、侧栏、右侧面板、底部面板、审批卡、设置内容框”可辨识状态；预览变量必须与运行时变量一一对应，不能用一个 overlay 假装多个窗口均已生效。

### 阶段 D：共享 renderer 消费合同

预期修改范围：

- `runtime/renderer-inject.js`：读取并边界化 `windowOpacity`，写入命名 CSS 自定义属性，例如 `--ds-window-opacity-sidebar`；通过已有 marker 刷新动态面板，不新增宽泛的 `role`/`aside`/`div` 选择器。
- `runtime/dream-skin.css`：只在现有精确 marker 下消费对应变量；每个窗口保留自己的背景图、阴影、backdrop、内层清理和页签规则。不得把 `windowOpacity` 作用于 composer 或所有 descendant。
- 若阶段 A 证明现有 marker/selector 不足，只增加最小稳定 marker 和 `tools/selectors.json` 条目，并同步补 doctor/fixture；不能用扩大选择器范围代替定位。

### 阶段 E：双端同步与回归

1. 通过 `node tools/sync-runtime-assets.mjs` 生成 Windows/macOS 受管资产，不手工改 `windows/assets` 或 `macos/assets`。
2. 检查双端源码/生成资产的 schema、注入器、CSS、selector hash 一致；确认 Windows 和 macOS 的 payload 都能加载旧主题及新字段。
3. 运行适用的 Node、控制中心、validator、renderer、selector、同步检查和 Windows/PowerShell 测试；macOS 专用测试若本机不能执行，明确记录为 CI 缺口。

## 5. 验收矩阵

### 正向验收

- 控制中心拖动每个开放滑块时，预览只改变对应窗口层，并显示准确百分比/alpha。
- 保存后重新加载主题，所有 `windowOpacity` 值保持；导出再导入后值保持；旧主题没有新字段时仍按原样工作。
- 实际 Codex 中面板保持打开，逐项读取 computed style，确认实际 alpha 与保存值一致；不能用关闭浮框或只截关闭状态截图作为证据。
- 右侧面板关闭再打开、底部面板关闭再打开、用户名菜单重复打开、审批卡出现/消失、设置菜单在“常规/外观”等页面间切换后，marker 和 alpha 都恢复正确。

### 回归验收

- 普通输入框保持现有透明度、微高光和交互，不出现渐变黑影；审批卡出现/消失不能改变普通输入框规则。
- 审批卡后方全宽渐变仍被精确清理，审批卡本身仍为适当透明而非完全透明；不能通过修改全局 `main`、composer 或所有 sticky 规则实现。
- 右侧面板页签可读，页签层与外层不叠加第二层黑底；环境浮窗 backdrop 不恢复第二层黑色。
- 底部 PowerShell 的外层、terminal 内容、tabs 和 toolbar 的层级保持现状；全局 `.app-theme.electron-dark` 的既有规则不被改成影响其他 terminal 的公共规则。
- 设置页只改变共用内容框，不覆盖内部卡片；主交互区、左侧菜单、用户名菜单和其他已调好的窗口 computed style 无非预期变化。
- 主题 CSS Safe CSS、选择器 doctor、双端 payload 和恢复/暂停路径均保持通过。

## 6. 风险、回滚和停止条件

- **串改风险**：继续复用全局 `surfaceOpacity` 会再次同时改变输入框、审批层和其他 surface。处理：新建嵌套合同，旧字段保留兼容。
- **层叠风险**：只改外层 alpha 会留下原生内层 `bg-surface`、elevation 或渐变。处理：每个目标窗口建立“外层 + 内层 + 伪元素/backdrop”清单，逐项验收。
- **版本漂移风险**：Codex DOM/CSS Module 改版会导致 marker 缺失。处理：先核对 live matchCount 和 `injectorPath`，缺失时保守降级，不扩大选择器。
- **可读性风险**：滑块设为过低会使文字不可读。处理：第一版只调整背景 alpha，不调整字体；在预览和实机验收中增加文字可读性检查，必要时设置产品允许范围。
- **回滚**：删除/忽略 `windowOpacity` 时运行时回退到当前固定 CSS；若实现引入回归，回滚共享 runtime 源并重新执行同步，不直接修改生成副本。
- **停止条件**：任何一个目标 marker 的 matchCount 不为预期、普通输入框 computed style 变化、双端 payload 不一致、审批/底部渐变重新出现，均停止继续扩大修改范围，先补证据。

## 7. 本次不执行内容

本轮只保存本计划，不执行上述阶段，不改 CSS/JS/schema，不生成安装包，不修改用户主题，不提交 Git，也不推送远程。开始实现前应先确认阶段 A 的 live 基线和上面列出的配置合同冻结项。
