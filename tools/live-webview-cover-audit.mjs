const targets = await (await fetch("http://127.0.0.1:9335/json/list")).json();
const target = targets.find((item) => item.type === "page" && item.url === "app://-/index.html");
if (!target) throw new Error("No Codex main renderer target");
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const current = ++id;
  const timer = setTimeout(() => reject(new Error(`${method} timeout`)), 12000);
  const handler = (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id !== current) return;
    clearTimeout(timer); ws.removeEventListener("message", handler);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  };
  ws.addEventListener("message", handler);
  ws.send(JSON.stringify({ id: current, method, params }));
});
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
const result = await send("Runtime.evaluate", { expression: `(() => {
  const host = [...document.querySelectorAll('[data-browser-sidebar-webview]')]
    .find((node) => node.offsetWidth > 0 && node.offsetHeight > 0);
  const webview = host?.querySelector('webview');
  if (!host || !webview) return { ok:false };
  const rect = host.getBoundingClientRect();
  const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const describe = (node) => {
    const style = getComputedStyle(node);
    const before = getComputedStyle(node, '::before');
    const after = getComputedStyle(node, '::after');
    return {
      tag: node.tagName, id: node.id || null,
      classes: typeof node.className === 'string' ? node.className : null,
      part: node.getAttribute?.('data-ds-part'),
      browserHost: node.hasAttribute?.('data-browser-sidebar-webview') || false,
      zIndex: style.zIndex, position: style.position, opacity: style.opacity,
      visibility: style.visibility, display: style.display, pointerEvents: style.pointerEvents,
      background: style.background, backgroundColor: style.backgroundColor,
      before: { content:before.content, display:before.display, position:before.position, zIndex:before.zIndex, background:before.background, opacity:before.opacity },
      after: { content:after.content, display:after.display, position:after.position, zIndex:after.zIndex, background:after.background, opacity:after.opacity },
    };
  };
  return {
    ok:true, point, host:describe(host), webview:describe(webview),
    webviewUrl:webview.getURL?.() || webview.src, loading:webview.isLoading?.(),
    stack:document.elementsFromPoint(point.x, point.y).map(describe)
  };
})()`, returnByValue: true });
console.log(JSON.stringify(result.result?.value, null, 2));
if (process.argv[2]) {
  const fs = await import("node:fs/promises");
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await fs.writeFile(process.argv[2], Buffer.from(shot.data, "base64"));
}
ws.close();
