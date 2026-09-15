import fs from "node:fs/promises";
const targets = await (await fetch("http://127.0.0.1:9335/json/list")).json();
const target = targets.find((item) => item.type === "page" && item.url?.startsWith("app://-/"));
if (!target) throw new Error("No Codex renderer target");
const ws = new WebSocket(target.webSocketDebuggerUrl); let id = 0;
const send = (method, params = {}) => new Promise((resolve, reject) => { const current = ++id;
  const timer = setTimeout(() => reject(new Error(`${method} timeout`)), 15000);
  const handler = (event) => { const message = JSON.parse(String(event.data)); if (message.id !== current) return;
    clearTimeout(timer); ws.removeEventListener("message", handler); message.error ? reject(new Error(message.error.message)) : resolve(message.result); };
  ws.addEventListener("message", handler); ws.send(JSON.stringify({ id: current, method, params })); });
await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
const setup = await send("Runtime.evaluate", { expression: `(async () => {
  const video = document.querySelector('[data-dream-skin-video]'); if (!video) return false;
  const host = [...document.querySelectorAll('[data-browser-sidebar-webview]')].find((node) => {
    const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  });
  const webview = host?.querySelector('webview');
  let canvas = document.querySelector('[data-dream-skin-video-canvas]'); if (!canvas) { canvas = document.createElement('canvas'); canvas.dataset.dreamSkinVideoCanvas = 'true'; document.body.append(canvas); }
  Object.assign(canvas.style, {position:'fixed',inset:'0',width:'100vw',height:'100vh',zIndex:'-1',pointerEvents:'none'});
  canvas.width = innerWidth; canvas.height = innerHeight; video.style.opacity = '0'; video.style.width = '1px'; video.style.height = '1px'; video.style.left = '-10px';
  const ctx = canvas.getContext('2d'); video.pause();
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (webview) {
    const url = webview.getURL?.() || webview.src;
    if (url) webview.loadURL(url);
  }
  await new Promise((resolve) => setTimeout(resolve, 1200));
  let frame = video.currentTime || 0;
  const draw = () => { try { ctx.drawImage(video,0,0,canvas.width,canvas.height); } catch {} };
  video.addEventListener('seeked', draw);
  draw();
  clearInterval(globalThis.__dsCanvasTimer);
  globalThis.__dsCanvasTimer = setInterval(() => {
    if (video.seeking || !Number.isFinite(video.duration) || video.duration <= 0) return;
    frame = (frame + 0.1) % video.duration;
    video.currentTime = frame;
  }, 100);
  return { paused: video.paused, webviewUrl: webview?.getURL?.() || null };
})()`, awaitPromise: true, returnByValue: true });
console.log(JSON.stringify(setup.result?.value));
await new Promise((resolve) => setTimeout(resolve, 1800));
const state = await send("Runtime.evaluate", { expression: `(() => { const video=document.querySelector('[data-dream-skin-video]'); const host=[...document.querySelectorAll('[data-browser-sidebar-webview]')].find(n=>n.offsetWidth>0); const webview=host?.querySelector('webview'); return {paused:video?.paused,currentTime:video?.currentTime,seeking:video?.seeking,webviewUrl:webview?.getURL?.()||null,webviewLoading:webview?.isLoading?.()??null,canvas:Boolean(document.querySelector('[data-dream-skin-video-canvas]'))}; })()`, returnByValue: true });
console.log(JSON.stringify(state.result?.value));
const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await fs.writeFile("artifacts/video-browser-canvas.png", Buffer.from(shot.data, "base64"));
console.log("artifacts/video-browser-canvas.png"); ws.close();
