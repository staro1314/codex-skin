const [mode, value] = process.argv.slice(2);
if (!mode || !value || !["aria", "text", "contains"].includes(mode)) {
  throw new Error("Usage: node tools/live-ui-action.mjs <aria|text|contains> <value>");
}
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
    clearTimeout(timer); ws.removeEventListener("message", handler);
    if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
  };
  ws.addEventListener("message", handler);
  ws.send(JSON.stringify({ id: current, method, params }));
});
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
const result = await send("Runtime.evaluate", { expression: `(() => {
  const candidates = [...document.querySelectorAll('[role="menu"] [role="menuitem"], [role="menu"] button, [role="menu"] a, button, [role="menuitem"], a')]
    .filter((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    });
  const matches = candidates.filter((node) => ${mode === "aria"
    ? `node.getAttribute("aria-label") === ${JSON.stringify(value)}`
    : mode === "contains"
      ? `(node.textContent || "").includes(${JSON.stringify(value)})`
      : `(node.textContent || "").trim() === ${JSON.stringify(value)}`});
  const target = matches.sort((left, right) => {
    const leftInMenu = left.closest('[role="menu"]') ? 0 : 1;
    const rightInMenu = right.closest('[role="menu"]') ? 0 : 1;
    return leftInMenu - rightInMenu || (left.textContent || "").length - (right.textContent || "").length;
  })[0];
  if (!target) return { ok: false, error: "not-found" };
  const rect = target.getBoundingClientRect();
  return { ok: true, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, tag: target.tagName, text: (target.textContent || "").trim(), aria: target.getAttribute("aria-label") };
})()`, returnByValue: true });
if (result.result?.value?.ok) {
  const { x, y } = result.result.value;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}
await new Promise((resolve) => setTimeout(resolve, 600));
const state = await send("Runtime.evaluate", { expression: `(() => ({ markers: [...document.querySelectorAll('[data-ds-part]')].map((node) => node.getAttribute('data-ds-part')), menus: [...document.querySelectorAll('[role="menu"]')].length, dialogs: [...document.querySelectorAll('[role="dialog"]')].length, triggers: [...document.querySelectorAll('button[aria-expanded]')].map((node) => ({ aria: node.getAttribute('aria-label'), text: (node.textContent || '').trim(), expanded: node.getAttribute('aria-expanded') })).filter((item) => item.expanded === 'true'), url: location.href }))()`, returnByValue: true });
console.log(JSON.stringify({ action: result.result?.value, state: state.result?.value }));
ws.close();
