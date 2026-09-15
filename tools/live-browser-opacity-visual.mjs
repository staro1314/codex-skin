import fs from "node:fs/promises";

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
await fs.mkdir("artifacts", { recursive: true });
for (const value of [1, 0.25]) {
  const result = await send("Runtime.evaluate", {
    expression: `(() => { document.documentElement.style.setProperty("--ds-window-opacity-browser-content", "${value}"); const host = document.querySelector('[data-ds-part="browser-content"]'); return host ? { value: getComputedStyle(document.documentElement).getPropertyValue("--ds-window-opacity-browser-content").trim(), opacity: getComputedStyle(host).opacity, rect: host.getBoundingClientRect().toJSON() } : null; })()`,
    returnByValue: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const path = `artifacts/browser-content-opacity-${String(value).replace(".", "_")}.png`;
  await fs.writeFile(path, Buffer.from(shot.data, "base64"));
  console.log(JSON.stringify({ path, computed: result.result?.value }));
}
await send("Runtime.evaluate", {
  expression: `document.documentElement.style.removeProperty("--ds-window-opacity-browser-content")`,
});
ws.close();
