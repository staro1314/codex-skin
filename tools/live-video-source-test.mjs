const source = process.argv[2];
if (!source?.startsWith("http://127.0.0.1:")) throw new Error("A loopback media URL is required");
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
    if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
  };
  ws.addEventListener("message", handler);
  ws.send(JSON.stringify({ id: current, method, params }));
});
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
const result = await send("Runtime.evaluate", {
  expression: `(async () => {
    const video = document.querySelector('[data-dream-skin-video]');
    if (!video) return { ok: false, error: 'video-node-missing' };
    video.src = ${JSON.stringify(source)};
    video.style.setProperty('display', 'block');
    document.documentElement.setAttribute('data-dream-media', 'video');
    try { await video.play(); } catch {}
    await new Promise((resolve) => setTimeout(resolve, 2500));
    return { ok: video.readyState >= 2 && !video.error, readyState: video.readyState,
      networkState: video.networkState, paused: video.paused, currentTime: video.currentTime,
      duration: video.duration, error: video.error ? { code: video.error.code, message: video.error.message } : null,
      src: video.currentSrc, display: getComputedStyle(video).display };
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
console.log(JSON.stringify(result.result?.value, null, 2));
ws.close();
