import fs from "node:fs/promises";

const selectors = {
  mainSurface: '[data-ds-part="main"]',
  sidebar: '[data-ds-part="sidebar"]',
  profileMenu: '[data-ds-part="profile-menu"]',
  summaryPanel: '[data-pip-home-surface="thread-summary-panel"]',
  environmentInfoPopover: '[data-ds-part="environment-info-popover"]',
  environmentHeader: '[data-ds-part="environment-info-popover"] header[class~="bg-surface-elevated-secondary"]',
  utilitySidePanel: '[data-ds-part="utility-side-panel"]',
  utilityToolbar: '[data-ds-part="utility-side-panel"] [class~="h-toolbar"]',
  browserContent: '[data-ds-part="browser-content"]',
  composerShell: '[class*="_ComposerLayoutRoot_"]',
  composerEditor: '[class*="_ComposerLayoutInput_"]',
  bottomPanel: '[data-ds-part="bottom-panel"]',
  bottomToolbar: '[data-ds-part="bottom-panel"] [class~="h-toolbar-pane"]',
  approvalSurface: '[data-codex-approval-surface]',
  settingsPage: '[data-ds-part="settings-page"]',
};
const temporarilyHideBrowserGuest = new Set(["environmentInfoPopover", "environmentHeader", "summaryPanel", "approvalSurface"]);
const requested = process.argv.slice(2);
const keys = requested.length ? requested : Object.keys(selectors);
for (const key of keys) if (!selectors[key]) throw new Error(`Unknown opacity key: ${key}`);

const port = Number(process.env.CODEX_DREAM_SKIN_PORT || 9335);
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((item) => item.type === "page" && item.url?.startsWith("app://-/"));
if (!target) throw new Error("No Codex renderer target");
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const current = ++id;
  const timer = setTimeout(() => reject(new Error(`${method} timeout`)), 12000);
  const handler = (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id !== current) return;
    clearTimeout(timer);
    ws.removeEventListener("message", handler);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  };
  ws.addEventListener("message", handler);
  ws.send(JSON.stringify({ id: current, method, params }));
});
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
await fs.mkdir("artifacts/window-opacity-visual", { recursive: true });

for (const key of keys) {
  const cssKey = key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
  const variableName = `--ds-window-opacity-${cssKey}`;
  const selector = selectors[key];
  const original = await send("Runtime.evaluate", {
    expression: `(() => ({ value: document.documentElement.style.getPropertyValue("${variableName}"), priority: document.documentElement.style.getPropertyPriority("${variableName}") }))()`,
    returnByValue: true,
  });
  for (const value of [1, 0.05]) {
    const result = await send("Runtime.evaluate", {
      expression: `(() => {
        document.documentElement.style.setProperty("${variableName}", "${value}", "important");
        const element = [...document.querySelectorAll(${JSON.stringify(selector)})].find((node) => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        });
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { rootValue: getComputedStyle(document.documentElement).getPropertyValue("--ds-window-opacity-${cssKey}").trim(), rect: rect.toJSON(), backgroundColor: style.backgroundColor, opacity: style.opacity, backdropFilter: style.backdropFilter };
      })()`,
      returnByValue: true,
    });
    const computed = result.result?.value;
    if (!computed) {
      console.log(JSON.stringify({ key, skipped: "not-visible" }));
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
    if (temporarilyHideBrowserGuest.has(key)) {
      await send("Runtime.evaluate", { expression: `(() => { for (const node of document.querySelectorAll('[data-browser-sidebar-webview], [data-browser-sidebar-webview] webview')) { node.dataset.opacityAuditOpacity = node.style.getPropertyValue('opacity'); node.dataset.opacityAuditOpacityPriority = node.style.getPropertyPriority('opacity'); node.style.setProperty('opacity', '0', 'important'); } })()` });
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    const margin = 24;
    const clip = {
      x: Math.max(0, computed.rect.x - margin),
      y: Math.max(0, computed.rect.y - margin),
      width: Math.min(1441, computed.rect.width + margin * 2),
      height: Math.min(853, computed.rect.height + margin * 2),
      scale: 1,
    };
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, clip });
    const path = `artifacts/window-opacity-visual/${key}-${String(value).replace(".", "_")}.png`;
    await fs.writeFile(path, Buffer.from(shot.data, "base64"));
    if (temporarilyHideBrowserGuest.has(key)) {
      await send("Runtime.evaluate", { expression: `(() => { for (const node of document.querySelectorAll('[data-browser-sidebar-webview], [data-browser-sidebar-webview] webview')) { const value = node.dataset.opacityAuditOpacity || ''; const priority = node.dataset.opacityAuditOpacityPriority || ''; if (value) node.style.setProperty('opacity', value, priority); else node.style.removeProperty('opacity'); delete node.dataset.opacityAuditOpacity; delete node.dataset.opacityAuditOpacityPriority; } })()` });
    }
    console.log(JSON.stringify({ key, value, path, computed }));
  }
  const saved = original.result?.value || { value: "", priority: "" };
  await send("Runtime.evaluate", { expression: saved.value
    ? `document.documentElement.style.setProperty("${variableName}", ${JSON.stringify(saved.value)}, ${JSON.stringify(saved.priority)})`
    : `document.documentElement.style.removeProperty("${variableName}")` });
}
ws.close();
