import fs from "node:fs/promises";

const port = Number(process.env.CODEX_DREAM_SKIN_PORT || 9335);
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((item) => item.type === "page" && item.url === "app://-/index.html");
if (!target) throw new Error("No Codex renderer target");
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const current = ++id;
  const timer = setTimeout(() => reject(new Error(`${method} timeout`)), 15000);
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

const inventory = await send("Runtime.evaluate", {
  expression: `(() => {
    const sheets = [...document.adoptedStyleSheets];
    const candidates = sheets.map((sheet, index) => {
      try { const rules=[...sheet.cssRules]; return {index,rules,match:rules.some((rule)=>rule.cssText.includes('data-dream-skin'))}; }
      catch { return {index,rules:[],match:false}; }
    }).filter((entry)=>entry.match).sort((a,b)=>b.rules.length-a.rules.length);
    const index = candidates[0]?.index ?? -1;
    if (index < 0) return { error: 'skin-sheet-not-found' };
    return { index, candidates: candidates.map((entry) => ({ index: entry.index, count: entry.rules.length })), rules: [...sheets[index].cssRules].map((rule) => rule.cssText) };
  })()`,
  returnByValue: true,
});
const data = inventory.result?.value;
if (data?.error) throw new Error(data.error);
const outputDir = "artifacts/css-bisect";
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(`${outputDir}/rules.json`, JSON.stringify(data, null, 2));
const groups = Number(process.argv[2] || 8);
const mode = ["only", "prefix"].includes(process.argv[3]) ? process.argv[3] : "without";
const explicitStart = Number.isInteger(Number(process.argv[4])) ? Number(process.argv[4]) : null;
const explicitEnd = Number.isInteger(Number(process.argv[5])) ? Number(process.argv[5]) : null;
const size = Math.ceil(data.rules.length / groups);
for (let group = 0; group < (explicitStart === null ? groups : 1); group += 1) {
  const start = explicitStart ?? group * size;
  const end = explicitEnd ?? Math.min(data.rules.length, start + size);
  if (start >= end) break;
  const css = data.rules.filter((_, index) => mode === "only"
    ? index >= start && index < end
    : mode === "prefix" ? index < end
      : index < start || index >= end).join("\n");
  await send("Runtime.evaluate", {
    expression: `document.adoptedStyleSheets[${data.index}].replaceSync(${JSON.stringify(css)})`,
  });
  await new Promise((resolve) => setTimeout(resolve, 1800));
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await fs.writeFile(`${outputDir}/${mode}-${group}-${start}-${end}.png`, Buffer.from(shot.data, "base64"));
  console.log(JSON.stringify({ group, start, end }));
}
await send("Runtime.evaluate", {
  expression: `document.adoptedStyleSheets[${data.index}].replaceSync(${JSON.stringify(data.rules.join("\n"))})`,
});
ws.close();
