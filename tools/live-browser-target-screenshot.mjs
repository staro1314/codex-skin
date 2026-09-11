import fs from "node:fs/promises";
const targets = await (await fetch("http://127.0.0.1:9335/json/list")).json();
const target = targets.find((item) => item.type === "page" && item.url?.includes("localhost:8090/ledger-window-new"));
if (!target) throw new Error("No browser target");
const ws = new WebSocket(target.webSocketDebuggerUrl); let id = 0;
const send = (method, params = {}) => new Promise((resolve, reject) => { const current = ++id; const timer = setTimeout(() => reject(new Error(`${method} timeout`)), 10000); const onMessage = (event) => { const m = JSON.parse(String(event.data)); if (m.id !== current) return; clearTimeout(timer); ws.removeEventListener("message", onMessage); m.error ? reject(new Error(m.error.message)) : resolve(m.result); }; ws.addEventListener("message", onMessage); ws.send(JSON.stringify({ id: current, method, params })); });
await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
const info = await send("Runtime.evaluate", { expression: "JSON.stringify({title:document.title,body:document.body.innerText.slice(0,500),ready:document.readyState,visibility:document.visibilityState})", returnByValue: true });
const shot = await send("Page.captureScreenshot", { format: "png" }); await fs.writeFile("artifacts/browser-target.png", Buffer.from(shot.data, "base64")); console.log(info.result?.value); console.log("artifacts/browser-target.png"); ws.close();
