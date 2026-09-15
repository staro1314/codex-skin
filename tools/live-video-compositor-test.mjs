import fs from "node:fs/promises";

const mode = process.argv[2] || "baseline";
const targets = await (await fetch("http://127.0.0.1:9335/json/list")).json();
const target = targets.find((item) => item.type === "page" && item.url?.startsWith("app://-/"));
if (!target) throw new Error("No Codex renderer target");
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
const styleByMode = {
  baseline: {},
  filter: { filter: "opacity(0.999)" },
  opacity: { opacity: "0.999" },
  clip: { clipPath: "inset(0.01px)" },
  transform: { transform: "translateZ(0) scale(1.00001)" },
  canvasHidden: {},
  removeVideo: {},
};
if (!styleByMode[mode]) throw new Error(`Unknown mode: ${mode}`);
const result = await send("Runtime.evaluate", {
  expression: `(async () => {
    clearInterval(globalThis.__dsCanvasTimer);
    document.querySelector('[data-dream-skin-video-canvas]')?.remove();
    const video = document.querySelector('[data-dream-skin-video]');
    const host = [...document.querySelectorAll('[data-browser-sidebar-webview]')].find((node) => node.offsetWidth > 0);
    const webview = host?.querySelector('webview');
    if (!video || !webview) return { ok: false };
    for (const name of ['filter','opacity','clipPath','transform','width','height','left']) video.style[name] = '';
    Object.assign(video.style, ${JSON.stringify(styleByMode[mode])}, { display: 'block' });
    if (${JSON.stringify(mode)} === 'canvasHidden') {
      let canvas = document.querySelector('[data-dream-skin-video-canvas]');
      if (!canvas) { canvas = document.createElement('canvas'); canvas.dataset.dreamSkinVideoCanvas = 'true'; document.body.append(canvas); }
      canvas.width = innerWidth; canvas.height = innerHeight;
      Object.assign(canvas.style, { position:'fixed', inset:'0', width:'100vw', height:'100vh', zIndex:'-1', pointerEvents:'none' });
      const ctx = canvas.getContext('2d');
      let callbackId = 0;
      const draw = () => { try { ctx.drawImage(video, 0, 0, canvas.width, canvas.height); } catch {}
        callbackId = video.requestVideoFrameCallback(draw); };
      if (globalThis.__dsVideoFrameCallbackId) video.cancelVideoFrameCallback(globalThis.__dsVideoFrameCallbackId);
      callbackId = video.requestVideoFrameCallback(draw);
      globalThis.__dsVideoFrameCallbackId = callbackId;
      video.style.display = 'none';
    }
    document.documentElement.setAttribute('data-dream-media', 'video');
    try { await video.play(); } catch {}
    if (${JSON.stringify(mode)} === 'removeVideo') {
      video.pause();
      video.remove();
    }
    const url = webview.getURL?.() || webview.src;
    if (url) webview.loadURL(url);
    await new Promise((resolve) => setTimeout(resolve, 1800));
    const first = video.currentTime;
    await new Promise((resolve) => setTimeout(resolve, 700));
    return { ok: true, mode: ${JSON.stringify(mode)}, paused: video.paused, readyState: video.readyState,
      first, second: video.currentTime, webviewUrl: webview.getURL?.() || null,
      webviewLoading: webview.isLoading?.() ?? null, style: { filter: getComputedStyle(video).filter,
      opacity: getComputedStyle(video).opacity, clipPath: getComputedStyle(video).clipPath,
      transform: getComputedStyle(video).transform } };
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
console.log(JSON.stringify(result.result?.value));
const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
const path = `artifacts/video-compositor-${mode}.png`;
await fs.writeFile(path, Buffer.from(shot.data, "base64"));
console.log(path);
ws.close();
