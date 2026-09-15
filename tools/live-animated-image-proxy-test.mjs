import fs from "node:fs/promises";

const file = process.argv[2];
if (!file) throw new Error("Animated image path required");
const dataUrl = `data:image/webp;base64,${(await fs.readFile(file)).toString("base64")}`;
const targets = await (await fetch("http://127.0.0.1:9335/json/list")).json();
const target = targets.find((item) => item.type === "page" && item.url === "app://-/index.html");
if (!target) throw new Error("No Codex main renderer target");
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const current = ++id;
  const timer = setTimeout(() => reject(new Error(`${method} timeout`)), 15000);
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
const setup = await send("Runtime.evaluate", {
  expression: `(async () => {
    const video = document.querySelector('[data-dream-skin-video]');
    video?.pause?.(); video?.remove?.();
    document.querySelector('[data-dream-skin-animated-proxy]')?.remove?.();
    document.body.style.setProperty('background-image', ${JSON.stringify(`url("${dataUrl}")`)}, 'important');
    document.body.style.setProperty('background-size', 'cover', 'important');
    document.body.style.setProperty('background-position', 'center', 'important');
    document.body.style.setProperty('background-repeat', 'no-repeat', 'important');
    document.body.style.setProperty('background-attachment', 'fixed', 'important');
    const host = [...document.querySelectorAll('[data-browser-sidebar-webview]')].find((node) => node.offsetWidth > 0);
    const webview = host?.querySelector('webview');
    const url = webview?.getURL?.() || webview?.src;
    if (url) webview.loadURL(url);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return { video: document.querySelector('[data-dream-skin-video]') ? 'present' : null,
      imageProxy: document.querySelector('[data-dream-skin-animated-proxy]') ? 'present' : null,
      bodyBackgroundPrefix: getComputedStyle(document.body).backgroundImage.slice(0, 48),
      bodyBackgroundLength: getComputedStyle(document.body).backgroundImage.length,
      webviewUrl:webview?.getURL?.() || null, webviewLoading:webview?.isLoading?.() ?? null };
  })()`, awaitPromise: true, returnByValue: true,
});
console.log(JSON.stringify(setup.result?.value));
for (const suffix of ["a", "b"]) {
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await fs.writeFile(`artifacts/animated-proxy-${suffix}.png`, Buffer.from(shot.data, "base64"));
  await new Promise((resolve) => setTimeout(resolve, 1200));
}
ws.close();
