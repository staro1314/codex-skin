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
const result = await send("Runtime.evaluate", { expression: `(async () => {
  const video = document.querySelector('[data-dream-skin-video]');
  video?.pause?.(); video?.remove?.();
  document.querySelector('[data-dream-skin-animated-proxy]')?.remove?.();
  for (const name of ['background-image','background-size','background-position','background-repeat','background-attachment']) {
    document.body.style.removeProperty(name);
  }
  const host = [...document.querySelectorAll('[data-browser-sidebar-webview]')].find((node) => node.offsetWidth > 0);
  const webview = host?.querySelector('webview');
  const url = webview?.getURL?.() || webview?.src;
  if (url) webview.loadURL(url);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return { video: document.querySelector('[data-dream-skin-video]') ? 'present' : null,
    bodyBackground: getComputedStyle(document.body).backgroundImage,
    webviewUrl: webview?.getURL?.() || null, webviewLoading: webview?.isLoading?.() ?? null };
})()`, awaitPromise: true, returnByValue: true });
console.log(JSON.stringify(result.result?.value));
ws.close();
