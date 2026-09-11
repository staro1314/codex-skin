const port = Number(process.env.CODEX_DREAM_SKIN_PORT || 9335);
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((item) => item.type === "page" && item.url?.startsWith("app://"));
if (!target) throw new Error("No Codex app:// renderer target");
const ws = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 1;
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  const timeout = setTimeout(() => reject(new Error(`${method} timeout`)), 8000);
  const onMessage = (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id !== id) return;
    clearTimeout(timeout);
    ws.removeEventListener("message", onMessage);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  };
  ws.addEventListener("message", onMessage);
  ws.send(JSON.stringify({ id, method, params }));
});
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
const expression = `(() => {
  const keys = ["sidebar","profile-menu","summary-panel","environment-info-popover","utility-side-panel","utility-toolbar","browser-content","composer","bottom-panel","bottom-toolbar","approval-surface","settings-page"];
  const rootStyle = getComputedStyle(document.documentElement);
  const read = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return { tag: element.tagName, className: String(element.className).slice(0, 180), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage, boxShadow: style.boxShadow, backdropFilter: style.backdropFilter };
  };
  return {
    url: location.href,
    viewport: { width: innerWidth, height: innerHeight },
    vars: Object.fromEntries(keys.map((key) => [key, rootStyle.getPropertyValue("--ds-window-opacity-" + key).trim()])),
    markers: Object.fromEntries(keys.map((key) => [key, [...document.querySelectorAll('[data-ds-part="' + key + '"]')].map(read)])),
    browserHosts: [...document.querySelectorAll("[data-browser-sidebar-webview]")].map((element) => ({ ...read(element), outerHTML: element.outerHTML.slice(0, 500), parentChain: (() => { const chain = []; for (let current = element.parentElement, depth = 0; current && depth < 5; current = current.parentElement, depth += 1) chain.push({ tag: current.tagName, className: String(current.className).slice(0, 120), rect: (() => { const r = current.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })() }); return chain; })() })),
    utilityRoots: [...document.querySelectorAll("[data-app-shell-tabs=\\"true\\"]")].map(read),
    nativeWebviews: [...document.querySelectorAll("webview")].map(read),
  };
})()`;
const result = await send("Runtime.evaluate", { expression, returnByValue: true });
console.log(JSON.stringify(result.result?.value, null, 2));
ws.close();
