import fs from "node:fs/promises";

const port = Number(process.env.CODEX_DREAM_SKIN_PORT || 9335);
const cssPath = process.argv[2];
if (!cssPath) throw new Error("Usage: node tools/live-css-override.mjs <css>");
const clear = cssPath === "--clear";
const css = clear ? "" : await fs.readFile(cssPath, "utf8");
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
await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
const expression = clear
  ? `(() => { const sheet = globalThis.__codexSkinLiveOverride; if (sheet) document.adoptedStyleSheets = document.adoptedStyleSheets.filter((item) => item !== sheet); delete globalThis.__codexSkinLiveOverride; return { ok: true, cleared: Boolean(sheet), adopted: document.adoptedStyleSheets.length }; })()`
  : `(() => { const css = ${JSON.stringify(css)}; let sheet = globalThis.__codexSkinLiveOverride; if (!sheet) { sheet = new CSSStyleSheet(); globalThis.__codexSkinLiveOverride = sheet; document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]; } sheet.replaceSync(css); return { ok: true, bytes: css.length, adopted: document.adoptedStyleSheets.length }; })()`;
const result = await send("Runtime.evaluate", { expression, returnByValue: true });
console.log(JSON.stringify(result.result?.value));
ws.close();
