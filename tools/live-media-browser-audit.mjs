const port = Number(process.env.CODEX_DREAM_SKIN_PORT || 9335);
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((item) => item.type === "page" && item.url === "app://-/index.html");
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

const result = await send("Runtime.evaluate", {
  expression: `(async () => {
    const readStyle = (node) => {
      if (!node) return null;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return {
        rect: rect.toJSON(), display: style.display, visibility: style.visibility,
        opacity: style.opacity, position: style.position, zIndex: style.zIndex,
        backgroundColor: style.backgroundColor, transform: style.transform,
      };
    };
    const root = document.documentElement;
    const video = document.querySelector('[data-dream-skin-video]');
    const host = [...document.querySelectorAll('[data-browser-sidebar-webview]')].find((node) => {
      const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    });
    const webview = host?.querySelector('webview');
    const variables = ['main-surface', 'browser-content'].map((key) => {
      const name = '--ds-window-opacity-' + key;
      return [key, {
        computed: getComputedStyle(root).getPropertyValue(name).trim(),
        inline: root.style.getPropertyValue(name),
        priority: root.style.getPropertyPriority(name),
      }];
    });
    let blob = null;
    if (video?.src?.startsWith('blob:')) {
      try {
        const bytes = await (await fetch(video.src)).arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        blob = { size: bytes.byteLength, sha256: [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('') };
      } catch (error) {
        blob = { error: String(error?.message || error) };
      }
    }
    return {
      href: location.href,
      media: root.getAttribute('data-dream-media'),
      revision: root.getAttribute('data-dream-skin-revision'),
      adoptedSheets: [...document.adoptedStyleSheets].map((sheet, index) => {
        let text = ''; try { text = [...sheet.cssRules].map((rule) => rule.cssText).join('\\n'); } catch {}
        return { index, bytes: text.length, prefix: text.slice(0, 300), hasMainOverride: text.includes('--ds-window-opacity-main-surface: 1 !important') };
      }),
      variables: Object.fromEntries(variables),
      video: video ? {
        ...readStyle(video),
        srcPrefix: video.src.slice(0, 96), srcLength: video.src.length,
        currentSrcPrefix: video.currentSrc.slice(0, 96), currentSrcLength: video.currentSrc.length,
        readyState: video.readyState, networkState: video.networkState,
        paused: video.paused, ended: video.ended,
        error: video.error ? { code: video.error.code, message: video.error.message } : null,
        currentTime: video.currentTime, duration: video.duration,
        blob,
      } : null,
      main: readStyle(document.querySelector('[data-ds-part="main"]')),
      browserHost: host ? { ...readStyle(host), html: host.outerHTML.slice(0, 1000) } : null,
      webview: webview ? {
        ...readStyle(webview), src: webview.src, url: webview.getURL?.() || null,
        partition: webview.partition || null,
      } : null,
    };
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime audit failed");
console.log(JSON.stringify(result.result?.value, null, 2));
ws.close();
