const targets = await (await fetch("http://127.0.0.1:9335/json/list")).json();
const target = targets.find((item) => item.type === "page" && item.url?.startsWith("app://-/index.html"));
if (!target) throw new Error("No Codex renderer target");
const ws = new WebSocket(target.webSocketDebuggerUrl); let id = 0;
const send = (method, params = {}) => new Promise((resolve, reject) => { const current = ++id; const timer = setTimeout(() => reject(new Error(`${method} timeout`)), 10000); const onMessage = (event) => { const m = JSON.parse(String(event.data)); if (m.id !== current) return; clearTimeout(timer); ws.removeEventListener("message", onMessage); m.error ? reject(new Error(m.error.message)) : resolve(m.result); }; ws.addEventListener("message", onMessage); ws.send(JSON.stringify({ id: current, method, params })); });
await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
const result = await send("Runtime.evaluate", { expression: `(() => [...document.querySelectorAll('webview[data-browser-sidebar-webview]')].map((n) => { const s = getComputedStyle(n); return { id: n.getAttribute('data-browser-sidebar-webview'), src: n.getAttribute('src'), visibility: s.visibility, display: s.display, pointerEvents: s.pointerEvents, rect: n.getBoundingClientRect().toJSON() }; }))()`, returnByValue: true });
console.log(JSON.stringify(result.result?.value, null, 2)); ws.close();
