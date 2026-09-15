const selector = process.argv[2] || '[data-ds-part="main"]';
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
await send("DOM.enable");
await send("CSS.enable");
const documentNode = await send("DOM.getDocument", { depth: 0 });
const node = await send("DOM.querySelector", { nodeId: documentNode.root.nodeId, selector });
if (!node.nodeId) throw new Error(`No node matched ${selector}`);
const matched = await send("CSS.getMatchedStylesForNode", { nodeId: node.nodeId });
const rules = (matched.matchedCSSRules || []).map(({ rule }) => ({
  selector: rule.selectorList?.text,
  origin: rule.origin,
  background: rule.style?.cssProperties?.filter((property) =>
    property.name.startsWith("background") && property.value).map((property) => ({
      name: property.name, value: property.value, important: property.important,
    })),
})).filter((rule) => rule.background?.length);
console.log(JSON.stringify(rules, null, 2));
ws.close();
