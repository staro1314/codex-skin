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
const result = await send("Runtime.evaluate", { expression: `(() => [...document.querySelectorAll('button,a,[role="menuitem"]')].map((node, index) => { const rect=node.getBoundingClientRect(); const style=getComputedStyle(node); return {index,tag:node.tagName,text:(node.textContent||'').trim().replace(/\\s+/g,' ').slice(0,80),aria:node.getAttribute('aria-label'),pressed:node.getAttribute('aria-pressed'),expanded:node.getAttribute('aria-expanded'),rect:rect.toJSON(),visible:rect.width>0&&rect.height>0&&style.visibility!=='hidden'&&style.display!=='none'}; }).filter((item)=>item.visible))()`, returnByValue: true });
console.log(JSON.stringify(result.result?.value, null, 2));
ws.close();
