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
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  };
  ws.addEventListener("message", handler);
  ws.send(JSON.stringify({ id: current, method, params }));
});
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
const result = await send("Runtime.evaluate", {
  expression: `(() => {
    const root = document.querySelector('[data-ds-part="bottom-panel"]');
    if (!root) return null;
    return [...root.querySelectorAll('*')].map((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      if (rect.width < 100 || rect.height < 20 || style.backgroundColor === 'rgba(0, 0, 0, 0)') return null;
      const chain = [];
      for (let current = node; current && current !== root; current = current.parentElement) {
        chain.push({ tag: current.tagName, className: current.className });
      }
      const bodySelector = '[data-ds-part="bottom-panel"] [class~="relative"][class~="flex"][class~="min-h-0"][class~="flex-1"][class~="flex-col"][class~="bg-[var(--app-shell-panel-background,var(--color-surface))]"]';
      return { tag: node.tagName, className: node.className, rect: rect.toJSON(), backgroundColor: style.backgroundColor, matchesBodySelector: node.matches(bodySelector), chain };
    }).filter(Boolean);
  })()`,
  returnByValue: true,
});
console.log(JSON.stringify(result.result?.value, null, 2));
ws.close();
