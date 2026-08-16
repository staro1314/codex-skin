import process from "node:process";

const port = Number(process.env.CODEX_DREAM_SKIN_PORT || 9335);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function json(pathname) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`);
  if (!response.ok) throw new Error(`${pathname}: ${response.status}`);
  return response.json();
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      clearTimeout(waiter.timer);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
    });
  }

  async open() {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP open timeout")), 6000);
      this.ws.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      this.ws.addEventListener("error", () => { clearTimeout(timer); reject(new Error("CDP open error")); }, { once: true });
    });
    return this;
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timeout`));
      }, 10000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "evaluate failed");
    return result.result?.value;
  }

  async click(x, y) {
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  }

  async key(key) {
    await this.send("Input.dispatchKeyEvent", { type: "keyDown", key });
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", key });
  }
}

function visibleRect(el) {
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0
    ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    : null;
}

const targets = (await json("/json/list")).filter((item) => item.type === "page" && item.webSocketDebuggerUrl);
if (!targets.length) throw new Error("No CDP page target");
const cdp = await new Cdp(targets[0].webSocketDebuggerUrl).open();
await cdp.key("Escape");
await sleep(300);

const inspect = await cdp.eval(`(() => {
  const rect = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0 ? {x:r.x,y:r.y,width:r.width,height:r.height} : null; };
  const describe = (el) => ({
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute('role'),
    testid: el.getAttribute('data-testid'),
    aria: el.getAttribute('aria-label'),
    rect: rect(el),
    textLength: (el.textContent || '').trim().length,
  });
  const buttons = Array.from(document.querySelectorAll('button,[role="button"]')).map(describe).filter((x) => x.rect);
  const low = buttons.filter((x) => x.rect.y + x.rect.height > innerHeight - 120 && x.rect.x < 320);
  const named = buttons.filter((x) => ['环境信息', '提交或推送'].some((term) => String(x.aria || '').includes(term)));
  const video = document.querySelector('[data-dream-skin-video]');
  const root = document.documentElement;
  return {
    viewport: { width: innerWidth, height: innerHeight },
    root: { media: root.getAttribute('data-dream-media'), state: root.getAttribute('data-dream-visual-state') },
    video: video ? { opacity: getComputedStyle(video).opacity, filter: getComputedStyle(video).filter } : null,
    low,
    named,
  };
})()`);
console.log(JSON.stringify({ stage: "initial", inspect }, null, 2));

const profile = inspect.low.find((candidate) => candidate.rect.width >= 180 && candidate.rect.height <= 80) || inspect.low.at(-1);
if (!profile?.rect) throw new Error("Profile button candidate not found");
await cdp.click(profile.rect.x + profile.rect.width / 2, profile.rect.y + profile.rect.height / 2);
await sleep(500);
const profileResult = await cdp.eval(`(() => {
  const root = document.documentElement;
  const video = document.querySelector('[data-dream-skin-video]');
  return { rootState: root.getAttribute('data-dream-visual-state'), menu: !!document.querySelector('[role="menu"],[data-radix-menu-content],[data-radix-popper-content-wrapper]'), video: video ? { opacity: getComputedStyle(video).opacity, filter: getComputedStyle(video).filter } : null };
})()`);
console.log(JSON.stringify({ stage: "profile-open", profileResult }, null, 2));
await cdp.key("Escape");
await sleep(250);

const env = await cdp.eval(`(() => {
  const rect = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0 ? {x:r.x,y:r.y,width:r.width,height:r.height} : null; };
  const candidates = Array.from(document.querySelectorAll('button,[role="button"],[role="menuitem"]')).filter((el) => {
    const label = el.getAttribute('aria-label') || '';
    const text = (el.textContent || '').trim();
    return label.includes('环境') || label.includes('提交') || text.includes('环境信息') || text.includes('提交或推送');
  }).map((el) => ({ label: el.getAttribute('aria-label'), text: (el.textContent || '').trim(), rect: rect(el) })).filter((x) => x.rect);
  return candidates;
})()`);
console.log(JSON.stringify({ stage: "environment-candidates", env }, null, 2));
let push = env.find((candidate) => candidate.text === "提交或推送");
if (!push) {
  const envButton = env.find((candidate) => candidate.text === "环境信息" || candidate.label?.includes("环境"));
  if (!envButton) throw new Error("Environment info button candidate not found");
  await cdp.click(envButton.rect.x + envButton.rect.width / 2, envButton.rect.y + envButton.rect.height / 2);
  await sleep(250);
  push = await cdp.eval(`(() => {
    const rect = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0 ? {x:r.x,y:r.y,width:r.width,height:r.height} : null; };
    const el = Array.from(document.querySelectorAll('button,[role="button"],[role="menuitem"]')).find((item) => (item.textContent || '').trim() === '提交或推送');
    return el ? { text: el.textContent.trim(), rect: rect(el) } : null;
  })()`);
}
if (!push?.rect) throw new Error("Submit/push button candidate not found");
await cdp.click(push.rect.x + push.rect.width / 2, push.rect.y + push.rect.height / 2);
await sleep(400);
const dialogResult = await cdp.eval(`(() => {
  const overlay = Array.from(document.body.children).find((el) => el.className && String(el.className).includes('codex-dialog-overlay'));
  const dialog = Array.from(document.body.children).find((el) => el.className && String(el.className).includes('codex-dialog'));
  const read = (el) => el ? { position: getComputedStyle(el).position, rect: (() => { const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })() } : null;
  const styles = Array.from(document.querySelectorAll('style')).map((el) => el.textContent || '').join('\\n');
  const matched = [];
  const collect = (rules, source) => Array.from(rules || []).forEach((rule) => {
    if (rule.cssRules) return collect(rule.cssRules, source);
    if (!rule.selectorText || !rule.style?.position) return;
    let hits = false;
    try { hits = [overlay, dialog].some((el) => el && el.matches(rule.selectorText)); } catch {}
    if (hits) matched.push({ source, selector: rule.selectorText.slice(0, 240), position: rule.style.position, important: rule.style.getPropertyPriority('position') });
  });
  Array.from(document.styleSheets).forEach((sheet, index) => { try { collect(sheet.cssRules, 'sheet-' + index); } catch {} });
  Array.from(document.adoptedStyleSheets || []).forEach((sheet, index) => { try { collect(sheet.cssRules, 'adopted-' + index); } catch {} });
  return {
    bodyScrollLocked: document.body.getAttribute('data-scroll-locked'),
    overlay: read(overlay),
    dialog: read(dialog),
    inlineStyles: { overlay: overlay?.getAttribute('style'), dialog: dialog?.getAttribute('style') },
    bodyChildren: Array.from(document.body.children).map((el) => ({ tag: el.tagName.toLowerCase(), id: el.id, className: String(el.className).slice(0, 120), position: getComputedStyle(el).position })),
    hasOldPortalRule: styles.includes('body > :not([data-dream-skin-video])'),
    hasRootOnlyRule: styles.includes('body > #root'),
    matchedPositionRules: matched.slice(-30),
  };
})()`);
await cdp.send("DOM.enable");
await cdp.send("CSS.enable");
const documentNode = await cdp.send("DOM.getDocument", { depth: 1 });
const dialogNode = await cdp.send("DOM.querySelector", { nodeId: documentNode.root.nodeId, selector: ".codex-dialog" });
const matchedStyles = dialogNode.nodeId ? await cdp.send("CSS.getMatchedStylesForNode", { nodeId: dialogNode.nodeId }) : null;
const matchedPositionRules = (matchedStyles?.matchedCSSRules || []).map((item) => ({
  styleSheetId: item.rule?.styleSheetId,
  selector: item.rule?.selectorList?.text,
  position: item.rule?.style?.cssProperties?.filter((property) => property.name === "position"),
})).filter((item) => item.position?.length);
const oldSheetIds = [...new Set(matchedPositionRules
  .filter((item) => item.selector?.includes("body > :not([data-dream-skin-video])"))
  .map((item) => item.styleSheetId).filter(Boolean))];
const oldSheetTexts = [];
for (const styleSheetId of oldSheetIds) {
  try {
    const textResult = await cdp.send("CSS.getStyleSheetText", { styleSheetId });
    oldSheetTexts.push({ styleSheetId, excerpt: String(textResult.text || "").slice(0, 400) });
  } catch {}
}
console.log(JSON.stringify({ stage: "submit-dialog", dialogResult, cdpMatchedPositionRules: matchedPositionRules, oldSheetTexts }, null, 2));
await cdp.key("Escape");
await sleep(200);
cdp.ws.close();
