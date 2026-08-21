import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

function styleDeclaration() {
  const values = new Map();
  return {
    values,
    getPropertyValue(name) { return values.get(name) || ""; },
    setProperty(name, value) { values.set(name, String(value)); },
    removeProperty(name) { values.delete(name); },
    [Symbol.iterator]() { return values.keys(); },
  };
}

function classList(initial) {
  const values = new Set(initial);
  const writes = [];
  return {
    values,
    writes,
    contains(value) { return values.has(value); },
    add(...names) { writes.push(["add", ...names]); names.forEach((name) => values.add(name)); },
    remove(...names) { writes.push(["remove", ...names]); names.forEach((name) => values.delete(name)); },
    toggle(name, enabled) { writes.push(["toggle", name, enabled]); if (enabled) values.add(name); else values.delete(name); },
  };
}

function makeFixture({
  nativeAppearance = "dark", settings = false, settingsPanel = false, settingsPage = false, adopted = true,
  generic = false, genericComposer = true, genericHome = false, genericSearch = false,
  lateComposer = false,
  modernMessages = false, reducedMotion = false, threadRoute = false, visualSignal = null,
  locationHref = "app://-/index.html", visibilityState = "visible", overlay = false,
  profileMenu = false,
  floatingLeftPanel = false,
  utilitySidePanel = false,
  bottomPanel = false,
  environmentInfoPopover = false,
  environmentInfoBackdrop = false,
  environmentInfoText = "环境信息变更本地来源查看全部",
  legacyVideoPortalSheet = false,
} = {}) {
  const attrs = new Map();
  const rootStyle = styleDeclaration();
  const rootClasses = classList([nativeAppearance === "dark" ? "electron-dark" : "electron-light"]);
  const nodes = new Map();
  const domNodes = new Set();
  const selectorNodes = new Map();
  const observers = [];
  const timers = new Map();
  const intervals = new Map();
  const listeners = new Map();
  const revoked = [];
  const videoNodes = [];
  let nextId = 0;
  let nextBlob = 0;
  const attributesFor = (values) => [...values].map(([name, value]) => ({ name, value }));
  const makeDomNode = (name, parentElement = null, values = new Map(), matchedSelectors = []) => {
    const selectorMatches = new Set(matchedSelectors);
    const node = {
      name,
      parentElement,
      get attributes() { return attributesFor(values); },
      getAttribute(attribute) { return values.get(attribute) ?? null; },
      setAttribute(attribute, value) { values.set(attribute, String(value)); },
      removeAttribute(attribute) { values.delete(attribute); },
      appendChild(child) { child.parentElement = node; return child; },
      matches(selector) { return selectorMatches.has(selector); },
      addMatch(selector) { selectorMatches.add(selector); },
      closest(selector) {
        let current = node;
        while (current) {
          if (current.matches?.(selector)) return current;
          current = current.parentElement;
        }
        return null;
      },
      contains(candidate) {
        let current = candidate;
        while (current) {
          if (current === node) return true;
          current = current.parentElement;
        }
        return false;
      },
    };
    domNodes.add(node);
    return node;
  };
  const root = makeDomNode("root", null, attrs);
  root.classList = rootClasses;
  root.style = rootStyle;
  root.appendChild = (node) => {
    node.parentElement = root;
    if (node.id) nodes.set(node.id, node);
    return node;
  };
  const body = makeDomNode("body", root);
  body.appendChild = (node) => {
    node.parentElement = body;
    if (node.id) nodes.set(node.id, node);
    return node;
  };
  const register = (selector, node) => {
    const current = selectorNodes.get(selector) || [];
    current.push(node);
    selectorNodes.set(selector, current);
  };
  const partFixtures = {};
  let activateLateComposer = () => {};
  if (!settings && !settingsPanel && generic) {
    const mainSelector = 'main, [role="main"]';
    const inputSelector = 'textarea, [contenteditable="true"], [role="textbox"]';
    const sidebarSelector = 'aside, nav[aria-label]';
    const composerSelector = '[data-testid*="composer" i], [data-testid*="prompt" i], ' +
      '[class*="composer" i], [class*="prompt" i]';
    const overlaySelector = '[role="dialog"], [aria-modal="true"]';
    partFixtures.shell = makeDomNode("generic-shell", body);
    partFixtures.sidebar = makeDomNode("generic-sidebar", partFixtures.shell, new Map(), [sidebarSelector]);
    partFixtures.main = makeDomNode("generic-main", partFixtures.shell, new Map(), [mainSelector]);
    if (genericComposer) {
      partFixtures.composer = makeDomNode(
        "generic-composer", partFixtures.main, new Map(), lateComposer ? [] : [composerSelector],
      );
      partFixtures.input = makeDomNode("generic-input", partFixtures.composer, new Map(), [inputSelector]);
      if (lateComposer) {
        activateLateComposer = () => {
          partFixtures.composer.addMatch(composerSelector);
          partFixtures.composer.setAttribute("class", "_ComposerLayoutRoot_fixture");
        };
      }
    }
    partFixtures.unrelatedAside = makeDomNode(
      "generic-content-aside", partFixtures.main, new Map(), [sidebarSelector],
    );
    partFixtures.dialog = makeDomNode("generic-dialog", partFixtures.main, new Map(), [overlaySelector]);
    partFixtures.dialogInput = makeDomNode(
      "generic-dialog-input", partFixtures.dialog, new Map(), [inputSelector],
    );
    if (genericSearch) {
      partFixtures.searchForm = makeDomNode("generic-search-form", partFixtures.main, new Map(), ["form"]);
      partFixtures.searchInput = makeDomNode(
        "generic-search-input", partFixtures.searchForm, new Map(), [inputSelector],
      );
    }
    register(mainSelector, partFixtures.main);
    if (genericSearch) register(inputSelector, partFixtures.searchInput);
    if (genericComposer) register(inputSelector, partFixtures.input);
    register(inputSelector, partFixtures.dialogInput);
    register(sidebarSelector, partFixtures.sidebar);
    register(sidebarSelector, partFixtures.unrelatedAside);
    if (genericHome) {
      partFixtures.homeIcon = makeDomNode("generic-home-icon", partFixtures.main);
      register('[data-testid="home-icon"]', partFixtures.homeIcon);
      register('[role="main"]:has([data-testid="home-icon"])', partFixtures.main);
      register('[role="main"]', partFixtures.main);
    }
  } else if (!settings && !settingsPanel) {
    partFixtures.sidebar = makeDomNode("sidebar", body);
    partFixtures.main = makeDomNode("main", body);
    partFixtures.header = makeDomNode("header", body);
    partFixtures.home = makeDomNode("home", partFixtures.main);
    partFixtures.homeHero = makeDomNode("home-hero", partFixtures.home);
    partFixtures.homeIcon = makeDomNode("home-icon", partFixtures.homeHero);
    partFixtures.projectList = makeDomNode("project-list", partFixtures.home);
    partFixtures.thread = makeDomNode("thread", partFixtures.main);
    partFixtures.legacyMessage = makeDomNode("legacy-message", partFixtures.thread);
    partFixtures.userMessage = makeDomNode("user-message", partFixtures.thread);
    partFixtures.assistantMessage = makeDomNode("assistant-message", partFixtures.thread);
    partFixtures.composer = makeDomNode("composer", partFixtures.main);
    partFixtures.composerToolbar = makeDomNode("composer-toolbar", partFixtures.composer);
    if (visualSignal) {
      const signalNode = makeDomNode(
        "visual-signal",
        partFixtures.thread,
        new Map([["data-codex-state", visualSignal]]),
      );
      register("[data-codex-state]", signalNode);
    }
    register('aside:is(.app-shell-left-panel, [class~="bg-token-main-surface-primary"])', partFixtures.sidebar);
    if (floatingLeftPanel) {
      const floatingLeftPanelSelector = 'aside[data-testid="app-shell-floating-left-panel"]';
      partFixtures.floatingLeftPanel = makeDomNode(
        "floating-left-panel",
        body,
        new Map([["data-testid", "app-shell-floating-left-panel"]]),
        [floatingLeftPanelSelector],
      );
      register(floatingLeftPanelSelector, partFixtures.floatingLeftPanel);
    }
    register("main:is(.main-surface, [data-app-shell-main-surface], [class*=\"_MainContentSurface_\"])", partFixtures.main);
    register("header:is(.app-header-tint, [data-app-shell-header-edge-scroll], [class*=\"_Header_\"])", partFixtures.header);
    if (!threadRoute) {
      register('[data-testid="home-icon"]', partFixtures.homeIcon);
      register('[data-feature="game-source"]', partFixtures.homeHero);
      register('[role="main"]:has([data-testid="home-icon"])', partFixtures.home);
      register('[role="main"]', partFixtures.home);
    }
    register(".group\\/project-selector", partFixtures.projectList);
    register(".thread-scroll-container", partFixtures.thread);
    const messageSelector =
      ':is([data-message-author-role], [data-local-conversation-user-anchor], [data-local-conversation-final-assistant])';
    register(messageSelector, partFixtures.legacyMessage);
    if (modernMessages) {
      register(messageSelector, partFixtures.userMessage);
      register(messageSelector, partFixtures.assistantMessage);
    }
    register(".composer-surface-chrome", partFixtures.composer);
    register('.composer-surface-chrome [class*="_footer_"]', partFixtures.composerToolbar);
    if (profileMenu) {
      const triggerSelector = "button[aria-label='打开个人资料菜单'], button[aria-label='Open profile menu']";
      const triggerId = "profile-menu-trigger";
      const menuId = "profile-menu-content";
      partFixtures.profileTrigger = makeDomNode(
        "profile-menu-trigger",
        partFixtures.sidebar,
        new Map([
          ["id", triggerId], ["aria-expanded", "true"],
          ["aria-controls", menuId], ["aria-haspopup", "menu"],
        ]),
        [triggerSelector],
      );
      partFixtures.profileMenu = makeDomNode(
        "profile-menu",
        body,
        new Map([
          ["id", menuId], ["role", "menu"], ["aria-labelledby", triggerId],
          ["data-state", "open"],
        ]),
        ['[role="menu"]'],
      );
      nodes.set(menuId, partFixtures.profileMenu);
      register(triggerSelector, partFixtures.profileTrigger);
      register('[role="menu"]', partFixtures.profileMenu);
    }
    if (environmentInfoPopover) {
      const environmentSelector = 'div[class~="bg-surface-elevated-secondary"][class~="rounded-3xl"]:has(> [class~="overflow-y-auto"])';
      partFixtures.environmentInfoPopover = makeDomNode(
        "environment-info-popover",
        body,
        new Map([[
          "class",
          "relative flex max-h-full min-h-0 flex-col overflow-hidden rounded-3xl " +
            "bg-surface-elevated-secondary electron:elevation-prominent",
        ]]),
        [environmentSelector],
      );
      partFixtures.environmentInfoPopover.textContent = environmentInfoText;
      register(environmentSelector, partFixtures.environmentInfoPopover);
    if (environmentInfoBackdrop) {
        const backdropSelector = '[data-pip-home-surface="thread-summary-panel"]';
        partFixtures.environmentInfoBackdrop = makeDomNode(
          "environment-info-backdrop",
          body,
          new Map([["data-pip-home-surface", "thread-summary-panel"]]),
          [backdropSelector],
        );
        register(backdropSelector, partFixtures.environmentInfoBackdrop);
      }
    }
    if (utilitySidePanel) {
      const trigger = makeDomNode(
        "utility-side-panel-trigger",
        body,
        new Map([[
          "aria-label", "显示/隐藏侧边栏",
        ], ["aria-pressed", "true"]]),
      );
      const triggerSelector = 'button[aria-label="显示/隐藏侧边栏"]';
      register("button", trigger);
      register(triggerSelector, trigger);
      const utilitySelector =
        'div[class~="absolute"][class~="top-0"][class~="bottom-0"][class~="left-0"]' +
        '[class~="min-w-0"][class~="bg-surface"][class~="border-l"][class~="border-default"]' +
        ':has([data-app-shell-tabs="true"]):not(:has([data-app-shell-tab-panel-controller="bottom"]))';
      partFixtures.utilitySidePanel = makeDomNode(
        "utility-side-panel",
        body,
        new Map(),
        [utilitySelector],
      );
      register(utilitySelector, partFixtures.utilitySidePanel);
    }
    if (bottomPanel) {
      const trigger = makeDomNode(
        "bottom-panel-trigger",
        body,
        new Map([[
          "aria-label", "切换底部面板显示",
        ], ["aria-pressed", "true"]]),
      );
      const triggerSelector = 'button[aria-label="切换底部面板显示"]';
      register("button", trigger);
      register(triggerSelector, trigger);
      const bottomSelector =
        'div[class~="absolute"][class~="inset-x-0"][class~="top-0"][class~="min-h-0"]' +
        '[class~="border-t"][class~="border-default"][class~="bg-surface"]' +
        ':has([data-app-shell-tabs="true"]):has([data-app-shell-tab-panel-controller="bottom"])';
      partFixtures.bottomPanel = makeDomNode(
        "bottom-panel",
        body,
        new Map(),
        [bottomSelector],
      );
      register(bottomSelector, partFixtures.bottomPanel);
    }
  }
  if (settingsPage) {
    const settingsPageSelector =
      'div[class~="electron:bg-surface"][class~="electron:elevation-prominent"]' +
      '[class~="windows:rounded-tl-lg"]:has(> [class~="draggable"][class~="electron:h-toolbar"])' +
      ':has(> [class~="overflow-y-auto"])';
    partFixtures.settingsPage = makeDomNode(
      "settings-page",
      body,
      new Map([[
        "class",
        "flex h-full min-h-0 flex-col electron:overflow-hidden electron:bg-surface " +
          "electron:elevation-prominent windows:rounded-tl-lg",
      ]]),
      [settingsPageSelector],
    );
    register(settingsPageSelector, partFixtures.settingsPage);
  }
  if (overlay) {
    partFixtures.overlay = makeDomNode("overlay-menu", body);
    register('[role="menu"]', partFixtures.overlay);
  }
  const makeStyleNode = () => {
    const node = {
      id: "",
      textContent: "",
      parentElement: null,
      dataset: {},
      remove() { if (node.id) nodes.delete(node.id); node.parentElement = null; },
    };
    return node;
  };
  const makeVideoNode = () => {
    const mediaListeners = new Map();
    const node = makeDomNode("video", null);
    node.style = styleDeclaration();
    node.tagName = "VIDEO";
    node.paused = true;
    node.playCount = 0;
    node.pauseCount = 0;
    node.addEventListener = (type, callback) => mediaListeners.set(type, callback);
    node.removeEventListener = (type) => mediaListeners.delete(type);
    node.play = () => { node.playCount += 1; node.paused = false; return Promise.resolve(); };
    node.pause = () => { node.pauseCount += 1; node.paused = true; };
    node.remove = () => { node.parentElement = null; };
    node.mediaListeners = mediaListeners;
    videoNodes.push(node);
    return node;
  };
  const document = {
    documentElement: root,
    head: root,
    body,
    visibilityState,
    hidden: visibilityState === "hidden",
    adoptedStyleSheets: adopted ? (legacyVideoPortalSheet ? [{
      cssRules: [{
        selectorText: 'html[data-dream-skin="active"][data-dream-media="video"] body > :not([data-dream-skin-video])',
        style: { position: "relative" },
      }],
    }] : []) : undefined,
    createElement(tag) {
      if (tag === "style") return makeStyleNode();
      if (tag === "video") return makeVideoNode();
      return { tagName: tag };
    },
    addEventListener(type, callback) { listeners.set(`document:${type}`, callback); },
    removeEventListener(type) { listeners.delete(`document:${type}`); },
    getElementById(id) { return nodes.get(id) || null; },
    querySelector(selector) {
      if (settingsPanel && selector === '[data-settings-panel-slug="general-settings"]') {
        return makeDomNode("settings:general-settings", body);
      }
      if (settings && (selector.includes("appearance-theme") || selector.includes("theme-preview"))) {
        return makeDomNode(`settings:${selector}`, body);
      }
      return (selectorNodes.get(selector) || [])[0] || null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-ds-part]") {
        return [...domNodes].filter((node) => node.getAttribute?.("data-ds-part") !== null);
      }
      return [...(selectorNodes.get(selector) || [])];
    },
  };
  const navigation = {
    addEventListener(type, callback) { listeners.set(`navigation:${type}`, callback); },
    removeEventListener(type) { listeners.delete(`navigation:${type}`); },
  };
  class MockMutationObserver {
    constructor(callback) { this.callback = callback; this.options = null; this.observations = []; observers.push(this); }
    observe(target, options) { this.target = target; this.options = options; this.observations.push({ target, options }); }
    disconnect() { this.disconnected = true; }
  }
  class MockSheet {
    replaceSync(text) { this.text = text; }
  }
  const window = {
    location: { href: locationHref },
    navigation,
    matchMedia(query) {
      return {
        matches: query.includes("prefers-reduced-motion") ? reducedMotion : nativeAppearance === "dark",
        addEventListener(type, callback) { listeners.set(`media:${type}`, callback); },
        removeEventListener(type) { listeners.delete(`media:${type}`); },
      };
    },
    addEventListener(type, callback) { listeners.set(`window:${type}`, callback); },
    removeEventListener(type) { listeners.delete(`window:${type}`); },
  };
  const context = {
    window,
    document,
    MutationObserver: MockMutationObserver,
    CSSStyleSheet: adopted ? MockSheet : undefined,
    Blob,
    Uint8Array,
    atob,
    URL: {
      createObjectURL() { nextBlob += 1; return `blob:fixture-${nextBlob}`; },
      revokeObjectURL(value) { revoked.push(value); },
    },
    performance: { now: () => 1 },
    setTimeout(callback, delay) { const id = ++nextId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    setInterval(callback, delay) { const id = ++nextId; intervals.set(id, { callback, delay }); return id; },
    clearInterval(id) { intervals.delete(id); },
    console,
  };
  const payloadFor = (theme = {}) => {
    const template = fixture.template;
    return template
      .replace("__DREAM_SKIN_CSS_JSON__", JSON.stringify(".fixture { color: red; }"))
      .replace("__DREAM_SKIN_ART_JSON__", JSON.stringify("data:image/png;base64,AA=="))
      .replace("__DREAM_SKIN_THEME_JSON__", JSON.stringify({ id: "fixture", appearance: "auto", ...theme }))
      .replace("__DREAM_SKIN_VERSION_JSON__", JSON.stringify("test"))
      .replace("__DREAM_SKIN_STYLE_REVISION_JSON__", JSON.stringify("css-rev"))
      .replace("__DREAM_SKIN_PAYLOAD_REVISION_JSON__", JSON.stringify("payload-rev"));
  };
  const flushTimers = (maximumDelay = Infinity) => {
    for (const [id, timer] of [...timers]) {
      if (timer.delay <= maximumDelay) { timers.delete(id); timer.callback(); }
    }
  };
  const addDynamicMessage = () => {
    const messageSelector = [...selectorNodes.keys()].find((selector) =>
      selector.includes("data-message-author-role"),
    ) || '[data-message-author-role]';
    const node = makeDomNode(`message-${(selectorNodes.get(messageSelector) || []).length + 1}`, partFixtures.thread || body);
    register(messageSelector, node);
    return node;
  };
  return {
    activateLateComposer, addDynamicMessage, attrs, context, document, domNodes, flushTimers, intervals, listeners,
    nodes, observers, partFixtures, payloadFor, revoked, root, rootClasses, rootStyle, timers, videoNodes, window,
  };
}

function unscopedCssRules(css) {
  const rules = [];
  let start = 0;
  let quote = null;
  let index = 0;
  while (index < css.length) {
    if (!quote && css.startsWith("/*", index)) {
      const end = css.indexOf("*/", index + 2);
      index = end < 0 ? css.length : end + 2;
      continue;
    }
    const character = css[index];
    if (quote) {
      if (character === "\\") index += 2;
      else { if (character === quote) quote = null; index += 1; }
      continue;
    }
    if (character === "\"" || character === "'") { quote = character; index += 1; continue; }
    if (character === "{") {
      const prelude = css.slice(start, index).trim();
      if (prelude && !prelude.startsWith("@") &&
        !prelude.includes('html[data-dream-skin="active"]') &&
        !prelude.includes(':root[data-dream-skin="active"]')) {
        rules.push(prelude);
      }
      start = index + 1;
    } else if (character === "}") {
      start = index + 1;
    }
    index += 1;
  }
  return rules;
}

export async function runRendererRuntimeTest(assetRoot) {
  const template = await fs.readFile(path.join(assetRoot, "renderer-inject.js"), "utf8");
  const css = await fs.readFile(path.join(assetRoot, "dream-skin.css"), "utf8");
  fixture.template = template;

  assert.match(template, /adoptedStyleSheets/);
  assert.match(template, /CSSStyleSheet/);
  assert.match(template, /window\.navigation/);
  assert.match(template, /native-browser-comment-popup/);
  assert.match(template, /electron-dark/);
  assert.doesNotMatch(template, /electron-opaque|home-suggestion-list-item/,
    "Runtime payload must not carry retired selector documentation/fossils.");
  assert.doesNotMatch(template, /classList\.(add|remove|toggle)/);
  assert.doesNotMatch(template, /getBoundingClientRect|ResizeObserver/);
  assert.match(template, /childList:\s*true/);
  assert.match(template, /subtree:\s*true/);
  // The new contract intentionally keeps the `data-dream-*` attribute names
  // and `--dream-*` custom properties.  Only the retired DOM marker classes
  // and the measured fossil selector must be absent from the canonical CSS.
  assert.doesNotMatch(css, /(?:^|[.#\s])(?:codex-dream-skin|dream-skin-home|dream-home|dream-task)(?:[\s.#:{>]|$)|home-suggestion-list-item/);
  assert.match(css, /html\[data-dream-skin="active"\]/);
  // Home gating must stay single-level: CSS forbids :has() inside :has(),
  // and Chromium drops any rule that nests it (the v1.3.1 regression).  The
  // canonical CSS therefore gates on the :has()-free home-route-css alias.
  assert.match(css, /main:is\(\.main-surface, \[data-app-shell-main-surface\], \[class\*=\"_MainContentSurface_\"\]\):has\(\[role="main"\]\)/);
  assert.match(css, /main:is\(\.main-surface, \[data-app-shell-main-surface\], \[class\*=\"_MainContentSurface_\"\]\):not\(:has\(\[role="main"\]\)\)/);
  assert.match(css, /header:is\(\.app-header-tint, \[data-app-shell-header-edge-scroll\], \[class\*=\"_Header_\"\]\)/);
  assert.match(css, /:is\(\.app-shell-main-content-top-fade, \[data-app-shell-main-content-top-fade\], \[class\*=\"_MainContentTopFade_\"\]\)/);
  assert.doesNotMatch(css, /:has\([^()]*:has\(/);
  assert.doesNotMatch(css, /content:\s*var\(--dream-skin-name[\s\S]{0,180}var\(--dream-skin-brand-subtitle/,
    "The renderer must not inject a duplicate title into Codex's native header.");
  assert.doesNotMatch(css, /content:\s*var\(--dream-skin-status/,
    "The renderer must not inject a duplicate status badge into Codex's native header.");
  assert.doesNotMatch(css, /content:\s*var\(--dream-skin-quote/,
    "The renderer must not paint a decorative quote signature over the composer.");
  assert.match(css, /--ds-task-full-veil/);
  assert.match(css, /data-dream-task-mode="full"/);
  assert.match(css, /data-dream-state-motion="pulse"/);
  assert.match(css, /codex-dream-skin-media-flash/);
  assert.match(css, /--dream-state-overlay-opacity/);
  assert.match(
    css,
    /background-image:\s*var\(--ds-task-full-veil\),\s*var\(--ds-theme-image-veil\),\s*var\(--dream-skin-art\)/,
  );
  assert.match(css, /background-size:\s*100% 100%,\s*100% 100%,\s*var\(--ds-art-size, cover\)/);
  assert.match(
    css,
    /:not\(:has\(main:is\(\.main-surface, \[data-app-shell-main-surface\], \[class\*=\"_MainContentSurface_\"\]\)\)\)[\s\S]{0,120}\[data-ds-part="sidebar"\]/,
    "Core CSS must style the validated generic sidebar when the exact shell selector is absent.",
  );
  assert.match(
    css,
    /:not\(:has\(main:is\(\.main-surface, \[data-app-shell-main-surface\], \[class\*=\"_MainContentSurface_\"\]\)\)\)[\s\S]{0,180}\[data-ds-part="main"\]/,
    "Core CSS must paint a validated generic main surface.",
  );
  assert.match(
    css,
    /:not\(:has\(main:is\(\.main-surface, \[data-app-shell-main-surface\], \[class\*=\"_MainContentSurface_\"\]\)\)\)[\s\S]{0,120}\[data-ds-part="composer"\]/,
    "Core CSS must style the validated generic composer.",
  );
  // Every home/project selector must stay behind the root skin gate.  A
  // marker-class-to-:has() conversion must never leave native layout rules
  // active after pause/restore.
  const unscoped = unscopedCssRules(css).join("\n");
  assert.doesNotMatch(unscoped, /\[role="main"\]:has\(\[data-testid="home-icon"\]\)/);
  assert.doesNotMatch(unscoped, /\.group\\\/project-selector/);

  assert.match(css, /header:is\(\.app-header-tint, \[data-app-shell-header-edge-scroll\], \[class\*="_Header_"\]\)[\s\S]{0,520}z-index:\s*2\s*!important/,
    "Native header controls must stay above the skin artwork layer.");
  assert.match(css, /body::after[\s\S]{0,260}z-index:\s*0;/,
    "State glow must remain below native controls.");
  assert.match(css, /\[class\*="_ApplicationMenuTopBar_"\][\s\S]{0,260}color:\s*var\(--ds-text\)/,
    "The rebuilt native menu bar must use the skin text token for contrast.");
  assert.match(css, /aside\[class~="bg-token-main-surface-primary"\][\s\S]{0,360}background:\s*linear-gradient[\s\S]{0,180}rgb\(var\(--ds-panel-rgb\) \/ \.46\)[\s\S]{0,120}rgb\(var\(--ds-bg-rgb\) \/ \.58\)/,
    "Rebuilt hover sidebars must use the skin glass surface.");
  assert.match(css, /\[class~="bg-token-dropdown-background"\][\s\S]{0,320}background:\s*rgb\(var\(--ds-panel-rgb\) \/ \.56\)/,
    "Floating dropdown surfaces must remain translucent under the skin.");
  assert.match(css, /\[data-pip-home-surface="thread-summary-panel"\][\s\S]{0,420}background:\s*rgb\(var\(--ds-panel-rgb\) \/ \.72\)/,
    "The native thread summary panel must use the scoped readable glass surface.");
  assert.match(css, /\[data-pip-home-surface="thread-summary-panel"\][\s\S]{0,520}backdrop-filter:\s*blur\(14px\) saturate\(108%\)/,
    "The native thread summary panel must retain the scoped glass blur.");
  assert.match(css, /\[data-ds-part="environment-info-popover"\][\s\S]{0,420}background:\s*rgb\(var\(--ds-panel-rgb\) \/ \.56\)/,
    "The live environment-information popover must use a scoped translucent glass surface.");
  assert.match(css, /\[data-ds-part="environment-info-popover"\][\s\S]{0,700}header\[class~="bg-surface-elevated-secondary"\]::before[\s\S]{0,220}background:\s*rgb\(var\(--ds-panel-rgb\) \/ \.56\)/,
    "The environment-information section header veil must match the translucent popover surface.");
  assert.match(css, /\[data-ds-part="environment-info-backdrop"\][\s\S]{0,300}background:\s*transparent[\s\S]{0,220}backdrop-filter:\s*none/,
    "The environment popover's same-sized native backdrop must not add a second dark layer.");
  assert.match(css, /html\[data-dream-skin="active"\] \[data-ds-part="profile-menu"\][\s\S]{0,420}background:\s*rgb\(var\(--ds-panel-rgb\) \/ \.62\)/,
    "Only the runtime-marked profile menu must use the readable glass surface.");
  assert.match(css, /html\[data-dream-skin="active"\] \[data-ds-part="sidebar"\]\s*\{[\s\S]{0,260}background:\s*rgb\(var\(--ds-panel-rgb\) \/ \.10\)/,
    "The validated sidebar and its floating variant must match the main surface tint.");
  assert.match(css, /html\[data-dream-skin="active"\] \[data-ds-part="sidebar"\]\s*\{[\s\S]{0,320}backdrop-filter:\s*none/,
    "The validated sidebar and its floating variant must not add a second background blur.");
  assert.match(css, /:is\(\[data-dream-task-mode="ambient"\][\s\S]{0,520}\[data-ds-part="sidebar"\]\s*\{[\s\S]{0,260}background:\s*rgb\(var\(--ds-panel-rgb\) \/ \.10\)/,
    "The unified sidebar tint must outrank the immersive shell's legacy aside rule.");
  assert.match(css, /:is\(\[data-dream-task-mode="ambient"\][\s\S]{0,520}\[data-ds-part="sidebar"\]\s*\{[\s\S]{0,320}backdrop-filter:\s*none/,
    "The immersive sidebar override must also remove the extra background blur.");
  assert.match(css, /html\[data-dream-skin="active"\] \[data-ds-part="main"\][\s\S]{0,260}background:\s*rgb\(var\(--ds-panel-rgb\) \/ \.10\)[\s\S]{0,120}background-image:\s*none/,
    "The validated main interaction surface must use a restrained transparent tint.");
  assert.match(css, /html\[data-dream-skin="active"\] \[data-ds-part="settings-page"\][\s\S]{0,300}background:\s*transparent[\s\S]{0,180}background-image:\s*none[\s\S]{0,180}box-shadow:\s*none[\s\S]{0,180}backdrop-filter:\s*none/,
    "The native settings content frame must clear its opaque surface and elevation without changing inner settings cards.");
  assert.match(css, /html\[data-dream-skin="active"\] \[data-codex-approval-surface\][\s\S]{0,420}background:\s*rgb\(var\(--ds-panel-rgb\) \/ \.56\) !important;[\s\S]{0,180}background-image:\s*none !important;[\s\S]{0,260}box-shadow:\s*\n?\s*inset 0 0 0 1px var\(--ds-immersive-line\),[\s\S]{0,160}backdrop-filter:\s*none !important;/,
    "The native approval card must use a readable translucent surface without native elevation.");
  assert.match(css, /html\[data-dream-skin="active"\][\s\S]{0,700}\.sticky:has\(\[data-codex-approval-surface\]\)\s*\{[\s\S]{0,240}background:\s*transparent !important;[\s\S]{0,180}box-shadow:\s*none !important;/,
    "The approval replacement path must clear the sticky host without changing ordinary input composers.");
  assert.match(css, /\.sticky:has\(\[data-codex-approval-surface\]\)[\s\S]{0,420}\[class~=\"bg-gradient-to-t\"\][\s\S]{0,220}display:\s*none !important;/,
    "The approval replacement path must remove the confirmed sticky gradient child.");
  assert.match(css, /Codex 26\.818 keeps the bottom sticky gradient[\s\S]*?\.thread-scroll-container:has\(\[data-ds-part=\"composer\"\], \[class\*=\"_ComposerLayoutRoot_\"\]\)[\s\S]*?\.sticky\s+\[class~=\"pointer-events-none\"\]\[class~=\"absolute\"\]\[class~=\"bg-gradient-to-t\"\]\[class~=\"from-surface\"\][\s\S]*?display:\s*none !important;/,
    "The current sibling-layout sticky gradient must be removed only when a task thread owns the composer.");
  assert.match(css, /Codex 26\.818 keeps the bottom sticky gradient[\s\S]*?\.thread-scroll-container:has\(\[data-ds-part=\"composer\"\], \[class\*=\"_ComposerLayoutRoot_\"\]\)[\s\S]*?\.min-w-0:has\(\[class\*=\"_ComposerLayoutRoot_\"\]\)\s+\[class~=\"pointer-events-none\"\]\[class~=\"absolute\"\]\[class~=\"bg-gradient-to-t\"\]\[class~=\"from-surface\"\][\s\S]*?display:\s*none !important;/,
    "The current composer-root gradient must be removed without changing the composer surface itself.");
  assert.match(css, /Approval replaces the textbox[\s\S]*?\.thread-scroll-container:has\(\[data-codex-approval-surface\]\)[\s\S]*?\.sticky\s+\[class~=\"pointer-events-none\"\]\[class~=\"absolute\"\]\[class~=\"bg-gradient-to-t\"\]\[class~=\"from-surface\"\][\s\S]*?display:\s*none !important;/,
    "Approval state must remove the sibling-layout sticky gradient without changing ordinary input composers.");
  assert.match(css, /Approval replaces the textbox[\s\S]*?\.thread-scroll-container:has\(\[data-codex-approval-surface\]\)[\s\S]*?\.min-w-0:has\(\[class\*="_ComposerLayoutRoot_"\]\)\s+\[class~=\"pointer-events-none\"\]\[class~=\"absolute\"\]\[class~=\"bg-gradient-to-t\"\]\[class~=\"from-surface\"\][\s\S]*?display:\s*none !important;/,
    "Approval state must remove the sibling composer-root gradient without changing the composer surface itself.");
  assert.doesNotMatch(css, /html\[data-dream-skin="active"\] \[data-ds-part="main"\][\s\S]{0,700}text-shadow:/,
    "The main interaction surface must not add a glyph halo or scoped text shadow.");
  assert.match(css, /__DREAM_SELECTOR_SHELL_MAIN__:\s*not\([^)]*\)[\s\S]{0,320}background:\s*rgb\(var\(--ds-panel-rgb\) \/ \.10\)[\s\S]{0,120}background-image:\s*none/,
    "The state-specific main interaction surface override must keep the restrained tint.");
  assert.match(css, /\[class~="app-theme"\]\[class~="electron-dark"\][\s\S]{0,260}background:\s*rgb\(var\(--ds-panel-rgb\) \/ \.52\)/,
    "Dynamic terminal panes must use the skin glass surface.");
  assert.match(css, /\[data-ds-part="utility-side-panel"\][\s\S]{0,420}background:\s*rgb\(var\(--ds-panel-rgb\) \/ \.56\)/,
    "The verified right utility sidebar wrapper must use a translucent glass surface.");
  assert.match(css, /\[data-ds-part="utility-side-panel"\][\s\S]{0,900}\[data-app-shell-tabs="true"\][\s\S]{0,300}\[class~="h-toolbar"\][\s\S]{0,220}background:\s*rgb\(var\(--ds-panel-rgb\) \/ \.62\)/,
    "The right utility sidebar tab toolbar must remain translucent and readable.");
  assert.match(css, /\[data-ds-part="bottom-panel"\][\s\S]{0,420}background:\s*transparent[\s\S]{0,220}box-shadow:\s*none[\s\S]{0,120}backdrop-filter:\s*none/,
    "The verified bottom panel wrapper must not add a dark fill, shadow, or blur.");
  assert.match(css, /\[data-ds-part="bottom-panel"\][\s\S]{0,520}\[class~="app-theme"\]\[class~="electron-dark"\][\s\S]{0,220}background:\s*transparent/,
    "Only the bottom panel terminal content must use a transparent surface.");
  assert.match(css, /\[data-ds-part="bottom-panel"\][\s\S]{0,900}\[class~="h-toolbar-pane"\][\s\S]{0,220}background:\s*transparent[\s\S]{0,180}backdrop-filter:\s*none/,
    "The bottom panel toolbar must not restore an opaque or blurred native surface.");
  assert.match(css, /\[data-ds-part="bottom-panel"\][\s\S]{0,1200}\[class~="group\/tab"\][\s\S]{0,260}background:\s*transparent/,
    "The bottom panel active tab must not restore an opaque native surface.");
  assert.match(css, /\[data-ds-part="bottom-panel"\][\s\S]{0,1800}\[class~="w-max"\]\[class~="bg-surface"\][\s\S]{0,180}background:\s*transparent/,
    "The bottom panel tab controls must remain transparent.");
  assert.match(css, /\[class\*="_ComposerLayoutRoot_"\][\s\S]{0,260}background:\s*rgb\(var\(--ds-panel-rgb\) \/ \.56\)/,
    "Current Codex composer roots must use the skin glass surface.");
  assert.match(css, /:has\(main:is\([^)]*\) \[role="main"\]\)\s+aside:is\([^)]*\)\[data-ds-part="sidebar"\][\s\S]{0,260}background:\s*rgb\(var\(--ds-panel-rgb\) \/ \.10\)/,
    "The home immersive sidebar override must retain the unified tint.");
  assert.match(css, /:has\(main:is\([^)]*\) \[role="main"\]\)\s+aside:is\([^)]*\)\[data-ds-part="sidebar"\][\s\S]{0,320}backdrop-filter:\s*none/,
    "The home immersive sidebar override must also remove the extra background blur.");

  const home = makeFixture({ nativeAppearance: "dark" });
  vm.runInNewContext(home.payloadFor({ art: { safeArea: "left", taskMode: "banner" } }), home.context);
  const state = home.window.__CODEX_DREAM_SKIN_STATE__;
  assert.equal(home.attrs.get("data-dream-skin"), "active");
  assert.equal(home.attrs.get("data-dream-shell"), "dark");
  assert.equal(home.attrs.get("data-ds-part"), "root");
  assert.equal(state.styleMode, "adopted");
  assert.equal(home.document.adoptedStyleSheets.length, 1);
  assert.equal(state.scope.baseState, "home");
  assert.equal(state.scope.level, "L1");
  assert.equal(state.visualState.state, "home");
  assert.equal(home.attrs.get("data-dream-visual-state"), "home");
  // The real Codex browser toolbar can mount after the constructable sheet.
  // The delayed repair must reattach the same sheet without losing the active
  // theme, so the native tab title and add-tab control get a fresh paint pass.
  home.flushTimers(180);
  home.flushTimers(0);
  assert.equal(home.document.adoptedStyleSheets.length, 1);
  assert.equal(state.metrics.styleRepairs, 1);
  assert.equal(home.rootStyle.values.get("--dream-skin-brand-subtitle"), '"CODEX DREAM SKIN"');
  assert.equal(home.rootStyle.values.get("--dream-skin-status"), '"DREAM SKIN ONLINE"');
  assert.equal(home.rootStyle.values.get("--ds-theme-surface-radius"), "12px");
  assert.equal(home.rootStyle.values.get("--ds-theme-surface-opacity"), "1");
  assert.equal(home.rootStyle.values.get("--ds-theme-surface-blur"), "0px");
  const publicDefaults = {
    "--ds-theme-font-family": "system",
    "--ds-theme-font-scale": "1",
    "--ds-theme-surface-border-alpha": "0.14",
    "--ds-theme-surface-shadow": "soft",
    "--ds-theme-image-zoom": "1",
    "--ds-theme-image-dim": "0",
    "--ds-theme-image-task-intensity": "0.35",
    "--ds-theme-density-scale": "standard",
    "--ds-theme-motion-level": "standard",
  };
  for (const [variable, expected] of Object.entries(publicDefaults)) {
    assert.equal(home.rootStyle.values.get(variable), expected);
  }
  assert.equal(home.attrs.get("data-dream-controls"), "default");
  assert.equal(home.attrs.get("data-dream-motion-level"), "standard");
  assert.equal(home.rootStyle.values.get("--ds-theme-image-focus-x"), "0.72");
  assert.equal(home.rootStyle.values.get("--ds-theme-image-focus-y"), "0.5");
  assert.equal(state.metrics.routePasses, 1);
  assert.equal(state.metrics.partPasses, 1);
  assert.equal(state.metrics.layoutReads, 0, "Runtime must not perform layout reads");
  assert.equal(home.rootClasses.writes.length, 0, "Runtime must not write classes");

  const nativeCommentPopup = makeFixture({ locationHref: "about:blank" });
  const nativeCommentResult = vm.runInNewContext(
    nativeCommentPopup.payloadFor(), nativeCommentPopup.context,
  );
  assert.equal(nativeCommentResult?.installed, false,
    "Native Codex comment popups must not install Dream Skin");
  assert.equal(nativeCommentResult?.reason, "native-browser-comment-popup",
    "Native Codex comment popups must be identified before any skin layer is created");
  assert.equal(nativeCommentPopup.document.adoptedStyleSheets.length, 0);
  assert.equal(nativeCommentPopup.attrs.size, 0);

  const transitioningCommentPopup = makeFixture({ nativeAppearance: "dark" });
  vm.runInNewContext(transitioningCommentPopup.payloadFor(), transitioningCommentPopup.context);
  assert.equal(transitioningCommentPopup.attrs.get("data-dream-skin"), "active");
  assert.equal(transitioningCommentPopup.document.adoptedStyleSheets.length, 1);
  transitioningCommentPopup.window.location.href = "about:blank";
  const transitionResult = vm.runInNewContext(
    transitioningCommentPopup.payloadFor(), transitioningCommentPopup.context,
  );
  assert.equal(transitionResult?.installed, false,
    "A popup that transitions to native comment mode must disable Dream Skin");
  assert.equal(transitionResult?.reason, "native-browser-comment-popup",
    "A popup that transitions to native comment mode must use the native isolation path");
  assert.equal(transitioningCommentPopup.window.__CODEX_DREAM_SKIN_STATE__, undefined);
  assert.equal(transitioningCommentPopup.document.adoptedStyleSheets.length, 0);
  assert.equal(transitioningCommentPopup.attrs.size, 0);

  const video = makeFixture({ nativeAppearance: "dark" });
  vm.runInNewContext(video.payloadFor({
    video: { src: "file:///theme/background.mp4", performance: "balanced" },
  }), video.context);
  assert.equal(video.attrs.get("data-dream-media"), "video");
  assert.equal(video.videoNodes.length, 1);
  assert.equal(video.videoNodes[0].muted, true);
  assert.equal(video.videoNodes[0].loop, true);
  assert.equal(video.videoNodes[0].playsInline, true);
  assert.equal(video.videoNodes[0].src, "file:///theme/background.mp4");
  assert.equal(video.videoNodes[0].playCount, 1);
  video.listeners.get("window:blur")();
  assert.equal(video.attrs.get("data-dream-media"), "video",
    "Blur must not replace a visible video with its poster");
  assert.equal(video.videoNodes[0].pauseCount, 1,
    "Blur may pause the video without changing the rendered media layer");
  video.listeners.get("window:focus")();
  assert.equal(video.attrs.get("data-dream-media"), "video");
  assert.equal(video.videoNodes[0].playCount, 2,
    "Focus may resume a healthy balanced video");
  video.document.visibilityState = "hidden";
  video.document.hidden = true;
  video.listeners.get("document:visibilitychange")();
  assert.equal(video.attrs.get("data-dream-media"), "poster",
    "A truly hidden document must use the static poster fallback");
  video.document.visibilityState = "visible";
  video.document.hidden = false;
  video.listeners.get("document:visibilitychange")();
  assert.equal(video.attrs.get("data-dream-media"), "video",
    "Returning from a hidden document must restore the video layer");
  assert.equal(video.videoNodes[0].playCount, 3);
  video.videoNodes[0].mediaListeners.get("error")();
  assert.equal(video.attrs.get("data-dream-media"), "poster");
  assert.equal(video.rootStyle.values.get("--dream-skin-art"), 'url("blob:fixture-1")');

  const reducedVideo = makeFixture({ nativeAppearance: "dark", reducedMotion: true });
  vm.runInNewContext(reducedVideo.payloadFor({
    video: { src: "file:///theme/background.webm", performance: "immersive" },
  }), reducedVideo.context);
  assert.equal(reducedVideo.attrs.get("data-dream-media"), "poster");
  assert.equal(reducedVideo.videoNodes.length, 0,
    "Reduced-motion mode must not create a video element or fetch the media");

  const ecoVideo = makeFixture({ nativeAppearance: "dark" });
  vm.runInNewContext(ecoVideo.payloadFor({
    video: { src: "file:///theme/background.mp4", performance: "eco" },
  }), ecoVideo.context);
  assert.equal(ecoVideo.attrs.get("data-dream-media"), "poster");
  assert.equal(ecoVideo.videoNodes.length, 0,
    "Eco mode must keep the poster-only path");

  const thinking = makeFixture({ nativeAppearance: "dark", threadRoute: true, visualSignal: "thinking" });
  vm.runInNewContext(thinking.payloadFor(), thinking.context);
  assert.equal(thinking.window.__CODEX_DREAM_SKIN_STATE__.scope.baseState, "thread");
  assert.equal(thinking.window.__CODEX_DREAM_SKIN_STATE__.visualState.state, "thinking");
  assert.equal(thinking.window.__CODEX_DREAM_SKIN_STATE__.visualState.source, "dom");

  const stateBridge = makeFixture({ nativeAppearance: "dark", threadRoute: true });
  vm.runInNewContext(stateBridge.payloadFor(), stateBridge.context);
  const stateBridgeRuntime = stateBridge.window.__CODEX_DREAM_SKIN_STATE__;
  assert.equal(stateBridgeRuntime.visualState.state, "idle");
  const stateEvent = stateBridge.listeners.get("window:codex-dream-skin:visual-state");
  assert.equal(typeof stateEvent, "function");
  stateEvent({ detail: { state: "executing" } });
  assert.equal(stateBridgeRuntime.visualState.state, "executing");
  assert.equal(stateBridge.attrs.get("data-dream-visual-state"), "executing");
  assert.equal(stateBridge.attrs.get("data-dream-state-motion"), "pulse");
  assert.equal(stateBridge.rootStyle.values.get("--dream-state-media-opacity"), "0.9");
  stateEvent({ detail: { state: "approval" } });
  assert.equal(stateBridgeRuntime.visualState.state, "approval");
  stateBridgeRuntime.clearVisualState();
  assert.equal(stateBridgeRuntime.visualState.state, "idle");

  const staleVideoPortal = makeFixture({ nativeAppearance: "dark", threadRoute: true, legacyVideoPortalSheet: true });
  vm.runInNewContext(staleVideoPortal.payloadFor({
    video: { src: "file:///theme/background.mp4", performance: "balanced" },
  }), staleVideoPortal.context);
  assert.equal(staleVideoPortal.document.adoptedStyleSheets.length, 1,
    "The current renderer sheet must remain installed after stale-sheet cleanup.");
  assert.equal(staleVideoPortal.document.adoptedStyleSheets.some((sheet) =>
    sheet.cssRules?.some((rule) => rule.selectorText?.includes("body > :not([data-dream-skin-video])"))), false,
  "Reinjection must remove the legacy video portal positioning sheet.");

  const videoOverlay = makeFixture({ nativeAppearance: "dark", threadRoute: true, overlay: true });
  vm.runInNewContext(videoOverlay.payloadFor({
    video: { src: "file:///theme/background.mp4", performance: "balanced" },
    stateEffects: {
      overlay: {
        overlayOpacity: 0.08,
        mediaOpacity: 0.72,
        brightness: 0.86,
        saturation: 0.7,
        contrast: 1.06,
        hueRotate: 12,
        motion: "alert",
      },
    },
  }), videoOverlay.context);
  const videoOverlayRuntime = videoOverlay.window.__CODEX_DREAM_SKIN_STATE__;
  assert.equal(videoOverlayRuntime.visualState.state, "overlay");
  assert.equal(videoOverlay.rootStyle.values.get("--dream-state-media-opacity"), "1",
    "Interaction menus must not dim a video theme.");
  assert.equal(videoOverlay.rootStyle.values.get("--dream-state-brightness"), "1");
  assert.equal(videoOverlay.rootStyle.values.get("--dream-state-saturation"), "1");
  assert.equal(videoOverlay.rootStyle.values.get("--dream-state-contrast"), "1");
  assert.equal(videoOverlay.rootStyle.values.get("--dream-state-hue"), "0deg");
  assert.equal(videoOverlay.attrs.get("data-dream-state-motion"), "none");

  const customEffect = makeFixture({ nativeAppearance: "dark", threadRoute: true });
  vm.runInNewContext(customEffect.payloadFor({
    stateEffects: {
      executing: {
        color: "#123456",
        overlayOpacity: 0.2,
        mediaOpacity: 0.66,
        brightness: 1.2,
        saturation: 1.4,
        contrast: 1.1,
        hueRotate: 22,
        motion: "alert",
      },
    },
  }), customEffect.context);
  customEffect.listeners.get("window:codex-dream-skin:visual-state")({
    detail: { state: "executing" },
  });
  const customRuntime = customEffect.window.__CODEX_DREAM_SKIN_STATE__;
  assert.equal(customEffect.attrs.get("data-dream-state-motion"), "alert");
  assert.equal(customEffect.rootStyle.values.get("--dream-state-color"), "#123456");
  assert.equal(customEffect.rootStyle.values.get("--dream-state-overlay-opacity"), "0.2");
  assert.equal(customEffect.rootStyle.values.get("--dream-state-media-opacity"), "0.66");
  assert.equal(customEffect.rootStyle.values.get("--dream-state-brightness"), "1.2");
  assert.equal(customEffect.rootStyle.values.get("--dream-state-saturation"), "1.4");
  assert.equal(customEffect.rootStyle.values.get("--dream-state-contrast"), "1.1");
  assert.equal(customEffect.rootStyle.values.get("--dream-state-hue"), "22deg");
  assert.equal(customRuntime.visualEffect.motion, "alert");

  const customControls = makeFixture({ nativeAppearance: "dark", threadRoute: true });
  vm.runInNewContext(customControls.payloadFor({
    controls: {
      surfaceOpacity: 0.72,
      surfaceBlur: 20,
      surfaceRadius: 26,
      imageZoom: 1.12,
      imageDim: 0.28,
      motionLevel: "reduced",
    },
  }), customControls.context);
  assert.equal(customControls.attrs.get("data-dream-controls"), "custom");
  assert.equal(customControls.attrs.get("data-dream-motion-level"), "reduced");
  assert.equal(customControls.rootStyle.values.get("--ds-theme-surface-opacity"), "0.72");
  assert.equal(customControls.rootStyle.values.get("--ds-theme-surface-blur"), "20px");
  assert.equal(customControls.rootStyle.values.get("--ds-theme-surface-radius"), "26px");
  assert.equal(customControls.rootStyle.values.get("--ds-theme-image-zoom"), "1.12");
  assert.equal(customControls.rootStyle.values.get("--ds-theme-image-dim"), "0.28");
  assert.equal(customControls.rootStyle.values.get("--ds-art-size"), "112% auto");
  customControls.listeners.get("window:codex-dream-skin:visual-state")({
    detail: { state: "executing" },
  });
  assert.equal(customControls.attrs.get("data-dream-state-motion"), "none",
    "Reduced theme motion must disable state animations at the runtime boundary");

  const partObserver = home.observers.find((observer) => observer.options?.childList);
  const rootObserver = home.observers.find((observer) => observer.options?.attributes);
  assert.ok(partObserver?.options?.subtree, "Dynamic parts require one subtree child-list observer");
  assert.equal(partObserver?.options?.attributes, true,
    "Dynamic parts must also react when a reused composer changes its class or role.");
  assert.ok(partObserver?.options?.attributeFilter?.includes("class"),
    "Composer class changes must trigger the first-paint part refresh.");
  assert.ok(partObserver?.options?.attributeFilter?.includes("aria-expanded"),
    "Profile menu trigger state changes must refresh the scoped menu marker.");
  assert.ok(partObserver?.options?.attributeFilter?.includes("aria-pressed"),
    "Panel trigger state changes must refresh the scoped utility/bottom panel markers.");
  assert.ok(partObserver?.options?.attributeFilter?.includes("aria-labelledby"),
    "Portal menu ownership changes must refresh the scoped menu marker.");
  assert.ok(partObserver?.options?.attributeFilter?.includes("data-testid"),
    "Semantic test-id changes must trigger the first-paint part refresh.");
  assert.equal(partObserver?.options?.attributeFilter?.includes("data-ds-part"), false,
    "The public part marker must not make its own observer loop.");
  assert.ok(rootObserver && !rootObserver.options?.childList && !rootObserver.options?.subtree);
  const expectedParts = {
    sidebar: "sidebar",
    main: "main",
    header: "header",
    home: "home",
    homeHero: "home-hero",
    projectList: "project-list",
    thread: "thread",
    legacyMessage: "message",
    composer: "composer",
    composerToolbar: "composer-toolbar",
  };
  for (const [fixtureKey, part] of Object.entries(expectedParts)) {
    assert.equal(home.partFixtures[fixtureKey].getAttribute("data-ds-part"), part,
      `${part} must be exposed through the public Safe CSS bridge`);
  }
  const dynamicMessage = home.addDynamicMessage();
  partObserver.callback([{ type: "childList" }]);
  home.flushTimers(80);
  assert.equal(dynamicMessage.getAttribute("data-ds-part"), "message");
  assert.equal(state.metrics.routePasses, 2,
    "DOM mutations must refresh SPA route scope alongside public parts");

  const modernMessages = makeFixture({ nativeAppearance: "dark", modernMessages: true });
  vm.runInNewContext(modernMessages.payloadFor(), modernMessages.context);
  assert.equal(modernMessages.partFixtures.legacyMessage.getAttribute("data-ds-part"), "message",
    "The legacy message role attribute must remain supported.");
  assert.equal(modernMessages.partFixtures.userMessage.getAttribute("data-ds-part"), "message",
    "Codex 26.727 user message anchors must expose the public message part.");
  assert.equal(modernMessages.partFixtures.assistantMessage.getAttribute("data-ds-part"), "message",
    "Codex 26.727 assistant message containers must expose the public message part.");

  const profile = makeFixture({ nativeAppearance: "dark", profileMenu: true });
  vm.runInNewContext(profile.payloadFor(), profile.context);
  assert.equal(profile.partFixtures.profileMenu.getAttribute("data-ds-part"), "profile-menu",
    "The profile trigger's portal menu must receive a dedicated visual part.");
  assert.equal(profile.partFixtures.profileTrigger.getAttribute("data-ds-part"), null,
    "The profile trigger itself must not receive the menu surface marker.");

  const floatingLeftPanel = makeFixture({ nativeAppearance: "dark", floatingLeftPanel: true });
  vm.runInNewContext(floatingLeftPanel.payloadFor(), floatingLeftPanel.context);
  assert.equal(floatingLeftPanel.partFixtures.floatingLeftPanel.getAttribute("data-ds-part"), "sidebar",
    "The exact app-shell floating left panel must reuse the validated sidebar glass surface.");

  const utilitySidePanel = makeFixture({ nativeAppearance: "dark", utilitySidePanel: true });
  vm.runInNewContext(utilitySidePanel.payloadFor(), utilitySidePanel.context);
  assert.equal(utilitySidePanel.partFixtures.utilitySidePanel.getAttribute("data-ds-part"),
    "utility-side-panel",
    "The exact open right utility sidebar must receive its dedicated visual part.");

  const bottomPanel = makeFixture({ nativeAppearance: "dark", bottomPanel: true });
  vm.runInNewContext(bottomPanel.payloadFor(), bottomPanel.context);
  assert.equal(bottomPanel.partFixtures.bottomPanel.getAttribute("data-ds-part"),
    "bottom-panel",
    "The exact open bottom panel must receive its dedicated visual part.");

  const environment = makeFixture({ nativeAppearance: "dark", threadRoute: true, environmentInfoPopover: true });
  vm.runInNewContext(environment.payloadFor(), environment.context);
  assert.equal(environment.partFixtures.environmentInfoPopover.getAttribute("data-ds-part"),
    "environment-info-popover",
    "The structurally verified environment-information surface must receive its dedicated marker.");

  const environmentWithBackdrop = makeFixture({
    nativeAppearance: "dark", threadRoute: true, environmentInfoPopover: true,
    environmentInfoBackdrop: true,
  });
  vm.runInNewContext(environmentWithBackdrop.payloadFor(), environmentWithBackdrop.context);
  assert.equal(environmentWithBackdrop.partFixtures.environmentInfoBackdrop.getAttribute("data-ds-part"),
    "environment-info-backdrop",
    "Only the same-container summary backdrop beside the environment surface receives the clear-layer marker.");

  const unrelatedSurface = makeFixture({
    nativeAppearance: "dark",
    threadRoute: true,
    environmentInfoPopover: true,
    environmentInfoText: "产出创建来源查看全部",
  });
  vm.runInNewContext(unrelatedSurface.payloadFor(), unrelatedSurface.context);
  assert.equal(unrelatedSurface.partFixtures.environmentInfoPopover.getAttribute("data-ds-part"), null,
    "A same-shaped output/source surface must not receive the environment-information marker.");

  const unrelatedMenu = makeFixture({ nativeAppearance: "dark", overlay: true });
  vm.runInNewContext(unrelatedMenu.payloadFor(), unrelatedMenu.context);
  assert.equal(unrelatedMenu.partFixtures.overlay.getAttribute("data-ds-part"), null,
    "Other role=menu overlays must remain outside the profile-menu surface rule.");

  const generic = makeFixture({ nativeAppearance: "dark", generic: true });
  vm.runInNewContext(generic.payloadFor(), generic.context);
  assert.equal(generic.partFixtures.sidebar.getAttribute("data-ds-part"), "sidebar");
  assert.equal(generic.partFixtures.main.getAttribute("data-ds-part"), "main");
  assert.equal(generic.partFixtures.composer.getAttribute("data-ds-part"), "composer");
  assert.equal(generic.partFixtures.input.getAttribute("data-ds-part"), null,
    "The composer wrapper, not its input, should receive the public part when available.");
  assert.equal(generic.partFixtures.unrelatedAside.getAttribute("data-ds-part"), null,
    "An aside inside the main content must not be exposed as the app sidebar.");
  assert.equal(generic.partFixtures.dialogInput.getAttribute("data-ds-part"), null,
    "Dialog inputs must not be mistaken for the app composer.");

  const lateGeneric = makeFixture({ nativeAppearance: "dark", generic: true, lateComposer: true });
  vm.runInNewContext(lateGeneric.payloadFor(), lateGeneric.context);
  assert.equal(lateGeneric.partFixtures.composer.getAttribute("data-ds-part"), null,
    "A reused composer must remain unmarked before its semantic class is mounted.");
  const latePartObserver = lateGeneric.observers.find((observer) => observer.options?.childList);
  lateGeneric.activateLateComposer();
  latePartObserver.callback([{ type: "attributes", attributeName: "class" }]);
  lateGeneric.flushTimers(80);
  assert.equal(lateGeneric.partFixtures.composer.getAttribute("data-ds-part"), "composer",
    "A class-only composer mount must receive its public part before the next interaction.");

  const genericSearch = makeFixture({
    nativeAppearance: "dark", generic: true, genericComposer: false, genericSearch: true,
  });
  vm.runInNewContext(genericSearch.payloadFor(), genericSearch.context);
  assert.equal(genericSearch.partFixtures.searchForm.getAttribute("data-ds-part"), null,
    "A generic search form must not be exposed as the app composer.");
  assert.equal(genericSearch.partFixtures.searchInput.getAttribute("data-ds-part"), null,
    "A generic search textbox must not be exposed as the app composer.");

  const genericSearchBeforeComposer = makeFixture({
    nativeAppearance: "dark", generic: true, genericComposer: true, genericSearch: true,
  });
  vm.runInNewContext(
    genericSearchBeforeComposer.payloadFor(), genericSearchBeforeComposer.context,
  );
  assert.equal(
    genericSearchBeforeComposer.partFixtures.searchInput.getAttribute("data-ds-part"), null,
    "A preceding search textbox must remain unmarked.",
  );
  assert.equal(
    genericSearchBeforeComposer.partFixtures.composer.getAttribute("data-ds-part"), "composer",
    "A preceding search textbox must not hide the real semantic composer.",
  );

  const genericHome = makeFixture({ nativeAppearance: "dark", generic: true, genericHome: true });
  vm.runInNewContext(genericHome.payloadFor(), genericHome.context);
  assert.equal(genericHome.partFixtures.main.getAttribute("data-ds-part"), "home",
    "The specific home part must win when generic home and main are one node.");
  assert.equal(genericHome.window.__CODEX_DREAM_SKIN_STATE__.scope.baseState, "home");

  const full = makeFixture({ nativeAppearance: "dark" });
  vm.runInNewContext(full.payloadFor({ art: { taskMode: "full" } }), full.context);
  assert.equal(full.attrs.get("data-dream-task-mode"), "full");
  assert.equal(full.attrs.get("data-dream-art-task-mode"), "full");

  const explicitColors = {
    background: "#abc",
    panel: "#abcd",
    panelAlt: "#11223344",
    accent: "#010203",
    accentAlt: "rgba(4, 5, 6, .5)",
    secondary: "rgb(999, 2, 3)",
    highlight: "#abcdef",
    text: "#000",
    muted: "#fff8",
    line: "rgba(7, 8, 9, .25)",
  };
  const explicitLight = makeFixture({ nativeAppearance: "light" });
  vm.runInNewContext(explicitLight.payloadFor({
    appearance: "auto",
    colorMode: "explicit",
    explicitColorKeys: Object.keys(explicitColors),
    colors: explicitColors,
  }), explicitLight.context);
  const renderedColors = {
    background: "--ds-bg",
    panel: "--ds-panel",
    panelAlt: "--ds-panel-2",
    accent: "--ds-green",
    accentAlt: "--ds-lime",
    secondary: "--ds-cyan",
    highlight: "--ds-purple",
    text: "--ds-text",
    muted: "--ds-muted",
    line: "--ds-line",
  };
  for (const [key, variable] of Object.entries(renderedColors)) {
    assert.equal(explicitLight.rootStyle.values.get(variable), explicitColors[key],
      `Light auto appearance must preserve explicit ${key}`);
  }
  const publicColorVariables = {
    "--ds-theme-color-background": "background",
    "--ds-theme-color-panel": "panel",
    "--ds-theme-color-panel-alt": "panelAlt",
    "--ds-theme-color-accent": "accent",
    "--ds-theme-color-accent-alt": "accentAlt",
    "--ds-theme-color-secondary": "secondary",
    "--ds-theme-color-highlight": "highlight",
    "--ds-theme-color-text": "text",
    "--ds-theme-color-muted": "muted",
    "--ds-theme-color-line": "line",
  };
  for (const [variable, colorKey] of Object.entries(publicColorVariables)) {
    assert.equal(explicitLight.rootStyle.values.get(variable), explicitColors[colorKey],
      `${variable} must expose the validated theme color`);
  }
  const renderedRgb = {
    "--ds-bg-rgb": "170 187 204",
    "--ds-panel-rgb": "170 187 204",
    "--ds-panel-2-rgb": "17 34 51",
    "--ds-accent-rgb": "1 2 3",
    "--ds-accent-alt-rgb": "4 5 6",
    "--ds-secondary-rgb": "255 2 3",
    "--ds-highlight-rgb": "171 205 239",
    "--ds-text-rgb": "0 0 0",
    "--ds-muted-rgb": "255 255 255",
    "--ds-line-rgb": "7 8 9",
  };
  for (const [variable, expected] of Object.entries(renderedRgb)) {
    assert.equal(explicitLight.rootStyle.values.get(variable), expected,
      `${variable} must support official hex forms and clamp RGB channels`);
  }

  rootObserver.callback([]);
  home.flushTimers(64);
  assert.equal(state.metrics.routePasses, 2, "Attribute safety pass must not be a route pass");
  const navigationHandler = home.listeners.get("navigation:navigate");
  assert.equal(typeof navigationHandler, "function");
  navigationHandler();
  home.flushTimers(180);
  assert.equal(state.metrics.navigationEvents, 1);
  assert.equal(state.metrics.routePasses, 3);

  const settings = makeFixture({ nativeAppearance: "light", settings: true });
  vm.runInNewContext(settings.payloadFor(), settings.context);
  assert.equal(settings.window.__CODEX_DREAM_SKIN_STATE__.scope.baseState, "settings");
  assert.equal(settings.window.__CODEX_DREAM_SKIN_STATE__.scope.level, "L0");
  assert.equal(settings.attrs.get("data-dream-skin"), "active");
  assert.equal(settings.document.adoptedStyleSheets.length, 1);

  const currentSettings = makeFixture({ nativeAppearance: "light", settingsPanel: true });
  vm.runInNewContext(currentSettings.payloadFor(), currentSettings.context);
  const currentSettingsScope = currentSettings.window.__CODEX_DREAM_SKIN_STATE__.scope;
  assert.equal(currentSettingsScope.baseState, "settings",
    "Codex 26.727 general-settings must classify as Settings without legacy appearance controls.");
  assert.equal(currentSettingsScope.level, "L0");
  assert.equal(currentSettingsScope.missingL1.length, 0);
  assert.equal(currentSettings.attrs.get("data-dream-skin"), "active");
  assert.equal(currentSettings.document.adoptedStyleSheets.length, 1);

  const settingsPage = makeFixture({ nativeAppearance: "light", settings: true, settingsPage: true });
  vm.runInNewContext(settingsPage.payloadFor(), settingsPage.context);
  assert.equal(settingsPage.window.__CODEX_DREAM_SKIN_STATE__.scope.baseState, "settings",
    "The structurally verified settings content frame must classify every settings menu as Settings.");
  assert.equal(settingsPage.partFixtures.settingsPage.getAttribute("data-ds-part"), "settings-page",
    "The settings content frame must receive its dedicated transparency marker.");

  const explicit = makeFixture({ nativeAppearance: "light" });
  const result = vm.runInNewContext(explicit.payloadFor({ appearance: "dark", quote: "TEST QUOTE" }), explicit.context);
  assert.equal(result.shell, "dark", "Explicit appearance must beat native appearance");
  assert.equal(explicit.attrs.get("data-dream-shell"), "dark");
  const oldState = explicit.window.__CODEX_DREAM_SKIN_STATE__;
  vm.runInNewContext(explicit.payloadFor({ appearance: "dark" }), explicit.context);
  assert.equal(oldState.cleanup(), false, "A stale cleanup must not remove the replacement");
  const replacement = explicit.window.__CODEX_DREAM_SKIN_STATE__;
  assert.equal(explicit.document.adoptedStyleSheets.length, 1);
  assert.equal(replacement.cleanup(), true);
  assert.equal(explicit.document.adoptedStyleSheets.length, 0);
  assert.equal(explicit.attrs.size, 0);
  assert.equal(explicit.rootStyle.values.size, 0);
  assert.equal(explicit.window.__CODEX_DREAM_SKIN_STATE__, undefined);
  assert.ok([...explicit.domNodes].every((node) => node.getAttribute?.("data-ds-part") === null));
  assert.deepEqual(explicit.revoked, ["blob:fixture-1", "blob:fixture-2"]);

  const fallback = makeFixture({ nativeAppearance: "dark", adopted: false });
  vm.runInNewContext(fallback.payloadFor(), fallback.context);
  const fallbackState = fallback.window.__CODEX_DREAM_SKIN_STATE__;
  assert.equal(fallbackState.styleMode, "style");
  assert.ok(fallback.nodes.has("codex-dream-skin-style"));
  assert.equal(fallbackState.cleanup(), true);
  assert.equal(fallback.nodes.has("codex-dream-skin-style"), false);

  console.log(`PASS: unified renderer runtime (${path.basename(assetRoot)})`);
}

const fixture = { template: "" };
