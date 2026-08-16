// Canonical cross-platform renderer. Run tools/sync-runtime-assets.mjs after editing.
((cssText, artDataUrl, themeConfig) => {
  const SELECTOR_CONTRACT = {"schema":"codex-dream-skin-selectors/1","selectors":[{"key":"shell-main","selector":"main:is(.main-surface, [data-app-shell-main-surface], [class*=\"_MainContentSurface_\"])","tier":"L1","scope":"all","required":true},{"key":"left-panel","selector":"aside:is(.app-shell-left-panel, [class~=\"bg-token-main-surface-primary\"])","tier":"L1","scope":"all","required":true},{"key":"header-tint","selector":"header:is(.app-header-tint, [data-app-shell-header-edge-scroll], [class*=\"_Header_\"])","tier":"L1","scope":"all","required":true},{"key":"main-content-top-fade","selector":":is(.app-shell-main-content-top-fade, [data-app-shell-main-content-top-fade], [class*=\"_MainContentTopFade_\"])","tier":"L2","scope":"all","required":false},{"key":"home-icon","selector":"[data-testid=\"home-icon\"]","tier":"L1","scope":"home","required":true},{"key":"home-route","selector":"[role=\"main\"]:has([data-testid=\"home-icon\"])","tier":"L1","scope":"home","required":true},{"key":"home-route-css","selector":"[role=\"main\"]","tier":"L1","scope":"home","required":true},{"key":"home-banners","selector":".home-banners","tier":"L2","scope":"home","required":false},{"key":"composer-chrome","selector":".composer-surface-chrome","tier":"L2","scope":"home+thread","required":false},{"key":"composer-toolbar","selector":".composer-surface-chrome [class*=\"_footer_\"]","tier":"L2","scope":"home+thread","required":false},{"key":"home-utility","selector":"[class*=\"_homeUtilityBar_\"]","tier":"L2","scope":"home","required":false},{"key":"game-source","selector":"[data-feature=\"game-source\"]","tier":"L2","scope":"home","required":false},{"key":"home-suggestions","selector":".group\\/home-suggestions","tier":"L2","scope":"home","required":false},{"key":"project-selector","selector":".group\\/project-selector","tier":"L2","scope":"home config","required":false},{"key":"markdown","selector":"[class*=\"_markdown\"]","tier":"L2","scope":"thread","required":false},{"key":"thread-surface","selector":".thread-scroll-container","tier":"L2","scope":"thread","required":false},{"key":"message","selector":":is([data-message-author-role], [data-local-conversation-user-anchor], [data-local-conversation-final-assistant])","tier":"L2","scope":"thread","required":false},{"key":"settings-panel","selector":"[data-settings-panel-slug=\"general-settings\"]","tier":"L2","scope":"settings","required":false},{"key":"appearance-radio","selector":"input[name=\"appearance-theme\"]","tier":"L2","scope":"settings","required":false},{"key":"overlay-menu","selector":"[role=\"menu\"]","tier":"L2","scope":"overlay","required":false},{"key":"overlay-dialog","selector":"[role=\"dialog\"]","tier":"L2","scope":"overlay","required":false},{"key":"overlay-popper","selector":"[data-radix-popper-content-wrapper]","tier":"L2","scope":"overlay","required":false}],"stableTestids":["app-shell-header-context-menu-surface","home-icon","theme-preview"]};
  const STATE_KEY = "__CODEX_DREAM_SKIN_STATE__";
  const VIDEO_SOURCE_KEY = "__CODEX_DREAM_SKIN_VIDEO_SOURCE__";
  const VIDEO_TRANSFER_KEY = "__CODEX_DREAM_SKIN_VIDEO_TRANSFER__";
  const DISABLED_KEY = "__CODEX_DREAM_SKIN_DISABLED__";
  const STYLE_REGISTRY_KEY = "__CODEX_DREAM_SKIN_STYLE_SHEETS__";
  const STYLE_ID = "codex-dream-skin-style";
  const SHELL_ATTR = "data-dream-shell";
  const PART_ATTR = "data-ds-part";
  const previous = window[STATE_KEY];
  if (typeof previous?.cleanup === "function") previous.cleanup();
  window[DISABLED_KEY] = false;
  // Codex renders screenshot comments in a transparent BrowserWindow that
  // intentionally stays on about:blank. It is native chrome, not a skin
  // surface; injecting body layers there breaks popup anchoring and caret
  // painting while the user moves the pointer.
  if (window.location?.href === "about:blank") {
    window[DISABLED_KEY] = true;
    return { installed: false, reason: "native-browser-comment-popup" };
  }
  const ROOT_ATTRS = [
    "data-dream-skin", SHELL_ATTR,
    "data-dream-media",
    "data-dream-visual-state",
    "data-dream-state-motion",
    "data-dream-controls", "data-dream-motion-level",
    "data-dream-art-wide", "data-dream-art-safe", "data-dream-task-mode",
    "data-dream-art-safe-area", "data-dream-art-task-mode", "data-dream-art-aspect",
    "data-dream-art-ready",
  ];
  const VERSION = __DREAM_SKIN_VERSION_JSON__;
  const STYLE_REVISION = __DREAM_SKIN_STYLE_REVISION_JSON__;
  const PAYLOAD_REVISION = __DREAM_SKIN_PAYLOAD_REVISION_JSON__;
  const VISUAL_STATE_EVENT = "codex-dream-skin:visual-state";
  const VISUAL_STATES = new Set([
    "unknown", "home", "idle", "thinking", "executing", "approval",
    "success", "error", "settings", "overlay",
  ]);
  const THEME = themeConfig && typeof themeConfig === "object" ? themeConfig : {};
  const VIDEO = THEME.video && typeof THEME.video === "object" ? THEME.video : null;
  const STATE_EFFECTS = THEME.stateEffects && typeof THEME.stateEffects === "object"
    && !Array.isArray(THEME.stateEffects) ? THEME.stateEffects : {};
  const RAW_CONTROLS = THEME.controls && typeof THEME.controls === "object"
    && !Array.isArray(THEME.controls) ? THEME.controls : {};
  const ART = THEME.art && typeof THEME.art === "object" ? THEME.art : {};
  const ART_METADATA = THEME.artMetadata && typeof THEME.artMetadata === "object"
    ? THEME.artMetadata : null;
  const ANALYSIS_CACHE_KEY = "__CODEX_DREAM_SKIN_ANALYSIS_CACHE__";
  const THEME_VARIABLES = [
    "--ds-bg", "--ds-panel", "--ds-panel-2", "--ds-green", "--ds-lime",
    "--ds-cyan", "--ds-purple", "--ds-text", "--ds-muted", "--ds-line",
    "--ds-bg-rgb", "--ds-panel-rgb", "--ds-panel-2-rgb", "--ds-accent-rgb",
    "--ds-accent-alt-rgb", "--ds-secondary-rgb", "--ds-highlight-rgb",
    "--ds-text-rgb", "--ds-muted-rgb", "--ds-line-rgb",
    "--dream-art-focus-x", "--dream-art-focus-y", "--dream-art-position",
    "--dream-skin-focus-x", "--dream-skin-focus-y", "--dream-skin-art-position",
    "--dream-skin-name", "--dream-skin-tagline", "--dream-skin-project-prefix",
    "--dream-skin-project-label", "--dream-skin-brand-subtitle", "--dream-skin-status",
    "--dream-skin-quote", "--dream-skin-art",
    "--ds-theme-color-background", "--ds-theme-color-panel",
    "--ds-theme-color-panel-alt", "--ds-theme-color-accent",
    "--ds-theme-color-accent-alt", "--ds-theme-color-secondary",
    "--ds-theme-color-highlight", "--ds-theme-color-text",
    "--ds-theme-color-muted", "--ds-theme-color-line",
    "--ds-theme-font-family", "--ds-theme-font-scale",
    "--ds-theme-surface-radius", "--ds-theme-surface-opacity",
    "--ds-theme-surface-blur", "--ds-theme-surface-border-alpha",
    "--ds-theme-surface-shadow", "--ds-theme-image-focus-x",
    "--ds-theme-image-focus-y", "--ds-theme-image-zoom",
    "--ds-theme-image-dim", "--ds-theme-image-task-intensity",
    "--ds-theme-density-scale", "--ds-theme-motion-level",
    "--ds-art-size", "--ds-theme-image-veil",
    "--dream-state-color", "--dream-state-overlay-opacity",
    "--dream-state-media-opacity", "--dream-state-brightness",
    "--dream-state-saturation", "--dream-state-contrast", "--dream-state-hue",
  ];
  const DEFAULT_STATE_EFFECTS = Object.freeze({
    unknown: { mediaOpacity: 0.78, brightness: 1, saturation: 1, contrast: 1, hueRotate: 0, motion: "none" },
    home: { mediaOpacity: 0.78, brightness: 1, saturation: 1, contrast: 1, hueRotate: 0, motion: "none" },
    idle: { mediaOpacity: 0.78, brightness: 1, saturation: 1, contrast: 1, hueRotate: 0, motion: "none" },
    thinking: { mediaOpacity: 0.84, brightness: 1.03, saturation: 1.08, contrast: 1, hueRotate: 0, motion: "none" },
    executing: { mediaOpacity: 0.90, brightness: 1.04, saturation: 1.16, contrast: 1, hueRotate: 0, motion: "pulse" },
    approval: { mediaOpacity: 0.86, brightness: 1.08, saturation: 0.90, contrast: 1.04, hueRotate: 0, motion: "none" },
    success: { mediaOpacity: 0.90, brightness: 1.06, saturation: 1.28, contrast: 1, hueRotate: 0, motion: "flash" },
    error: { mediaOpacity: 0.88, brightness: 0.94, saturation: 1.18, contrast: 1, hueRotate: -8, motion: "alert" },
    settings: { mediaOpacity: 0.78, brightness: 1, saturation: 1, contrast: 1, hueRotate: 0, motion: "none" },
    overlay: { mediaOpacity: 0.78, brightness: 1, saturation: 1, contrast: 1, hueRotate: 0, motion: "none" },
  });
  const STATE_EFFECT_COLORS = Object.freeze({
    unknown: "#36d7e8", home: "#36d7e8", idle: "#36d7e8", thinking: "#36d7e8",
    executing: "#7cff46", approval: "#f5b942", success: "#7cff46", error: "#ff5c67",
    settings: "#36d7e8", overlay: "#36d7e8",
  });
  const STATE_EFFECT_COLOR_PATTERN = /^(#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?|#[0-9a-fA-F]{3,4}|rgb\(\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}\s*\)|rgba\(\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}\s*,\s*(0|1|1\.0|0?\.[0-9]{1,6})\s*\))$/;
  const selectorByKey = new Map(SELECTOR_CONTRACT.selectors.map((entry) => [entry.key, entry]));
  const stableTestidSelector = (testid) => SELECTOR_CONTRACT.stableTestids?.includes(testid)
    ? `[data-testid="${testid}"]` : null;
  const installToken = {};
  const existingAnalysisCache = window[ANALYSIS_CACHE_KEY];
  const analysisCache = existingAnalysisCache && typeof existingAnalysisCache.get === "function" &&
    typeof existingAnalysisCache.set === "function" ? existingAnalysisCache : new Map();
  window[ANALYSIS_CACHE_KEY] = analysisCache;
  let artAnalysis = typeof THEME.artKey === "string" ? analysisCache.get(THEME.artKey) ?? null : null;
  let analysisTimer = null;
  let rootObserver = null;
  let partObserver = null;
  let bodyReadyHandler = null;
  let styleMode = null;
  let styleNode = null;
  let styleSheet = null;
  let stylePaintRepairTimer = null;
  let videoNode = null;
  let videoSourceOverride = null;
  let videoSourceBlobUrl = null;
  let videoFailed = false;
  let motionQuery = null;
  let motionHandler = null;
  let visibilityHandler = null;
  let blurHandler = null;
  let focusHandler = null;
  let windowFocused = true;
  let batteryManager = null;
  let batteryHandler = null;
  let batterySaver = false;
  let visualStateOverride = null;
  let visualState = {
    state: "unknown",
    source: "initial",
    confidence: "low",
    since: Date.now(),
    sequence: 0,
  };
  const now = () => typeof performance === "object" && typeof performance.now === "function"
    ? performance.now() : Date.now();
  const metrics = {
    ensureCalls: 0,
    rootPasses: 0,
    routePasses: 0,
    layoutReads: 0,
    attributeWrites: 0,
    styleWrites: 0,
    styleRepairs: 0,
    partPasses: 0,
    partWrites: 0,
    navigationEvents: 0,
    safetyPasses: 0,
    analysisRuns: 0,
    analysisCacheHits: artAnalysis ? 1 : 0,
    firstEnsureMs: null,
    analysisMs: null,
  };

  const existingStyleRegistry = window[STYLE_REGISTRY_KEY];
  const styleRegistry = existingStyleRegistry instanceof Set ? existingStyleRegistry : new Set();
  window[STYLE_REGISTRY_KEY] = styleRegistry;
  const artUrl = (() => {
    const comma = artDataUrl.indexOf(",");
    const mime = /^data:([^;,]+)/.exec(artDataUrl)?.[1] || "image/png";
    const binary = atob(artDataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  })();

  const videoPerformance = ["eco", "balanced", "immersive"].includes(VIDEO?.performance)
    ? VIDEO.performance : "balanced";
  const documentIsVisible = () => windowFocused
    && document.visibilityState !== "hidden" && !document.hidden;
  const reducedMotion = () => Boolean(motionQuery?.matches);
  const setVideoStyle = (name, value) => {
    if (videoNode?.style?.setProperty) videoNode.style.setProperty(name, value);
  };
  const setPosterMedia = (root) => {
    setAttribute(root, "data-dream-media", "poster");
    setStyleProperty(root, "--dream-skin-art", `url("${artUrl}")`);
    videoNode?.pause?.();
    setVideoStyle("display", "none");
  };
  const markVideoFallback = (root) => {
    videoFailed = true;
    setPosterMedia(root);
  };
  const ensureVideoLayer = (root) => {
    if (!VIDEO?.src || videoPerformance === "eco" || batterySaver || reducedMotion()
      || !documentIsVisible() || videoFailed) {
      setPosterMedia(root);
      return;
    }
    if (!videoNode) {
      if (!document?.createElement) {
        markVideoFallback(root);
        return;
      }
      videoNode = document.createElement("video");
      videoNode.setAttribute?.("data-dream-skin-video", "true");
      videoNode.setAttribute?.("aria-hidden", "true");
      videoNode.muted = true;
      videoNode.defaultMuted = true;
      videoNode.loop = true;
      videoNode.playsInline = true;
      videoNode.preload = videoPerformance === "immersive" ? "auto" : "metadata";
      videoNode.poster = artUrl;
      videoNode.src = videoSourceOverride || VIDEO.src;
      videoNode.addEventListener?.("error", () => markVideoFallback(root), { once: true });
      (document.body || document.documentElement)?.appendChild?.(videoNode);
    }
    setVideoStyle("display", "block");
    setAttribute(root, "data-dream-media", "video");
    // Keep the static image as the poster until the first frame is available;
    // the CSS variable is removed only after the browser accepts playback.
    setStyleProperty(root, "--dream-skin-art", "none");
    try {
      const playback = videoNode.play?.();
      Promise.resolve(playback).then(() => {
        if (!videoNode || videoFailed || !documentIsVisible() || reducedMotion()) return;
        setStyleProperty(root, "--dream-skin-art", "none");
      }).catch(() => markVideoFallback(root));
    } catch {
      markVideoFallback(root);
    }
  };

  const setVideoSource = (source) => {
    const normalized = String(source ?? "");
    if (!normalized.startsWith("blob:")) return false;
    if (videoSourceBlobUrl && videoSourceBlobUrl !== normalized) {
      try { URL.revokeObjectURL(videoSourceBlobUrl); } catch {}
    }
    videoSourceBlobUrl = normalized;
    videoSourceOverride = normalized;
    videoFailed = false;
    videoNode?.pause?.();
    videoNode?.remove?.();
    videoNode = null;
    ensure({ root: true });
    return true;
  };
  const videoTransfer = {
    chunks: [],
    mime: "video/mp4",
    begin(mime) {
      this.chunks = [];
      this.mime = String(mime || "video/mp4");
      return true;
    },
    chunk(base64) {
      const binary = atob(String(base64 || ""));
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      this.chunks.push(bytes);
      return this.chunks.length;
    },
    finish() {
      const url = URL.createObjectURL(new Blob(this.chunks, { type: this.mime }));
      this.chunks = [];
      return setVideoSource(url);
    },
    abort() {
      this.chunks = [];
    },
  };
  window[VIDEO_SOURCE_KEY] = setVideoSource;
  window[VIDEO_TRANSFER_KEY] = videoTransfer;

  const cssString = (value) => JSON.stringify(String(value ?? ""));

  const setStyleProperty = (root, name, value) => {
    if (root.style.getPropertyValue(name) !== value) {
      root.style.setProperty(name, value);
      metrics.styleWrites += 1;
    }
  };

  const setAttribute = (root, name, value) => {
    const normalized = String(value);
    if (root.getAttribute(name) !== normalized) {
      root.setAttribute(name, normalized);
      metrics.attributeWrites += 1;
    }
  };

  const boundedEffectNumber = (value, fallback, min, max) =>
    typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
      ? value : fallback;

  const controlsCustomized = Object.keys(RAW_CONTROLS).length > 0;
  const CONTROLS = Object.freeze({
    surfaceOpacity: boundedEffectNumber(RAW_CONTROLS.surfaceOpacity, 1, 0.55, 1),
    surfaceBlur: boundedEffectNumber(RAW_CONTROLS.surfaceBlur, 0, 0, 32),
    surfaceRadius: boundedEffectNumber(RAW_CONTROLS.surfaceRadius, controlsCustomized ? 22 : 12, 8, 28),
    imageZoom: boundedEffectNumber(RAW_CONTROLS.imageZoom, 1, 1, 1.2),
    imageDim: boundedEffectNumber(RAW_CONTROLS.imageDim, 0, 0, 0.65),
    motionLevel: ["reduced", "standard", "expressive"].includes(RAW_CONTROLS.motionLevel)
      ? RAW_CONTROLS.motionLevel : "standard",
    customized: controlsCustomized,
  });

  const validEffectColor = (value) => typeof value === "string"
    && STATE_EFFECT_COLOR_PATTERN.test(value);

  const stateEffectFor = (state) => {
    const defaults = DEFAULT_STATE_EFFECTS[state] || DEFAULT_STATE_EFFECTS.unknown;
    const configured = STATE_EFFECTS[state] && typeof STATE_EFFECTS[state] === "object"
      && !Array.isArray(STATE_EFFECTS[state]) ? STATE_EFFECTS[state] : {};
    const themeColor = state === "thinking" ? THEME.colors?.secondary
      : ["executing", "success"].includes(state) ? THEME.colors?.accent : null;
    const fallbackColor = validEffectColor(themeColor)
      ? themeColor : STATE_EFFECT_COLORS[state] || STATE_EFFECT_COLORS.unknown;
    const color = validEffectColor(configured.color) ? configured.color : fallbackColor;
    const requestedMotion = ["none", "pulse", "flash", "alert"].includes(configured.motion)
      ? configured.motion : defaults.motion;
    const motion = CONTROLS.motionLevel === "reduced" ? "none" : requestedMotion;
    return {
      color,
      overlayOpacity: boundedEffectNumber(configured.overlayOpacity, 0, 0, 0.35),
      mediaOpacity: boundedEffectNumber(configured.mediaOpacity, defaults.mediaOpacity, 0, 1),
      brightness: boundedEffectNumber(configured.brightness, defaults.brightness, 0.5, 1.35),
      saturation: boundedEffectNumber(configured.saturation, defaults.saturation, 0, 2),
      contrast: boundedEffectNumber(configured.contrast, defaults.contrast, 0.5, 1.5),
      hueRotate: boundedEffectNumber(configured.hueRotate, defaults.hueRotate, -180, 180),
      motion,
    };
  };

  const applyStateEffect = (root, state) => {
    const effect = stateEffectFor(state);
    if (!root) return effect;
    setAttribute(root, "data-dream-state-motion", effect.motion);
    setStyleProperty(root, "--dream-state-color", effect.color);
    setStyleProperty(root, "--dream-state-overlay-opacity", String(effect.overlayOpacity));
    setStyleProperty(root, "--dream-state-media-opacity", String(effect.mediaOpacity));
    setStyleProperty(root, "--dream-state-brightness", String(effect.brightness));
    setStyleProperty(root, "--dream-state-saturation", String(effect.saturation));
    setStyleProperty(root, "--dream-state-contrast", String(effect.contrast));
    setStyleProperty(root, "--dream-state-hue", `${effect.hueRotate}deg`);
    return effect;
  };

  const parseRgb = (value) => {
    if (!value || value === "transparent") return null;
    const hex = String(value).trim().match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (hex) {
      const rgbHex = hex[1].length <= 4
        ? hex[1].slice(0, 3).split("").map((digit) => `${digit}${digit}`).join("")
        : hex[1].slice(0, 6);
      const number = Number.parseInt(rgbHex, 16);
      return { r: number >> 16, g: (number >> 8) & 255, b: number & 255 };
    }
    const m = String(value).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (!m) return null;
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const rgbString = (value) => {
    const rgb = parseRgb(value);
    return rgb ? [rgb.r, rgb.g, rgb.b]
      .map((channel) => Math.round(clamp(channel, 0, 255)))
      .join(" ") : null;
  };

  const rgbToHex = ({ r, g, b }) => `#${[r, g, b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;

  const rgbToHsl = ({ r, g, b }) => {
    const values = [r, g, b].map((value) => value / 255);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const lightness = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l: lightness };
    const delta = max - min;
    const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    let hue;
    if (max === values[0]) hue = (values[1] - values[2]) / delta + (values[1] < values[2] ? 6 : 0);
    else if (max === values[1]) hue = (values[2] - values[0]) / delta + 2;
    else hue = (values[0] - values[1]) / delta + 4;
    return { h: hue * 60, s: saturation, l: lightness };
  };

  const hslToRgb = ({ h, s, l }) => {
    const hue = ((h % 360) + 360) % 360 / 360;
    if (s === 0) {
      const neutral = Math.round(l * 255);
      return { r: neutral, g: neutral, b: neutral };
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (offset) => {
      let t = hue + offset;
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return { r: channel(1 / 3) * 255, g: channel(0) * 255, b: channel(-1 / 3) * 255 };
  };

  const detectShellAppearance = () => {
    const root = document.documentElement;
    if (root?.classList?.contains("electron-dark")) return "dark";
    if (root?.classList?.contains("electron-light")) return "light";
    try { return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; } catch {}
    return "light";
  };

  const makeAdaptivePalette = (sample, shell) => {
    const source = sample || { r: 108, g: 126, b: 136 };
    const hsl = rgbToHsl(source);
    const hue = hsl.s < 0.12 ? 214 : hsl.h;
    const saturation = clamp(hsl.s, 0.38, 0.72);
    const accent = hslToRgb({ h: hue, s: saturation, l: shell === "light" ? 0.42 : 0.66 });
    const accentAlt = hslToRgb({ h: hue + 12, s: saturation * 0.82, l: shell === "light" ? 0.52 : 0.73 });
    const secondary = hslToRgb({ h: hue - 24, s: saturation * 0.64, l: shell === "light" ? 0.56 : 0.62 });
    const highlight = hslToRgb({ h: hue + 24, s: saturation * 0.76, l: shell === "light" ? 0.36 : 0.58 });
    const neutral = (lightness, chroma = 0.08) => rgbToHex(hslToRgb({ h: hue, s: chroma, l: lightness }));
    return shell === "light" ? {
      background: neutral(0.965, 0.07),
      panel: neutral(0.987, 0.035),
      panelAlt: neutral(0.945, 0.09),
      accent: rgbToHex(accent),
      accentAlt: rgbToHex(accentAlt),
      secondary: rgbToHex(secondary),
      highlight: rgbToHex(highlight),
      text: neutral(0.13, 0.10),
      muted: neutral(0.42, 0.08),
      line: `rgba(${Math.round(accent.r)}, ${Math.round(accent.g)}, ${Math.round(accent.b)}, .24)`,
    } : {
      background: neutral(0.055, 0.045),
      panel: neutral(0.085, 0.04),
      panelAlt: neutral(0.125, 0.05),
      accent: rgbToHex(accent),
      accentAlt: rgbToHex(accentAlt),
      secondary: rgbToHex(secondary),
      highlight: rgbToHex(highlight),
      text: neutral(0.93, 0.025),
      muted: neutral(0.69, 0.03),
      line: `rgba(${Math.round(accent.r)}, ${Math.round(accent.g)}, ${Math.round(accent.b)}, .28)`,
    };
  };

  const resolvedShell = () => {
    if (THEME.appearance === "light" || THEME.appearance === "dark") return THEME.appearance;
    // Image luminance may tune accents and scrims, but auto appearance follows
    // Codex/ChatGPT (or the OS fallback) so a bright wallpaper cannot flip a
    // native dark session back to a light shell after analysis.
    return detectShellAppearance();
  };

  const applyTheme = (root, shell) => {
    const declaredColors = THEME.colors && typeof THEME.colors === "object" ? THEME.colors : {};
    const legacyPalette = THEME.palette && typeof THEME.palette === "object" ? THEME.palette : {};
    // macOS themes use the full `colors` contract; older Windows themes used
    // `palette.accent`. Accept both while keeping one renderer source.
    const colors = Object.keys(declaredColors).length ? declaredColors : legacyPalette;
    const hasExplicitKeyList = Array.isArray(THEME.explicitColorKeys);
    const explicit = new Set(hasExplicitKeyList ? THEME.explicitColorKeys : []);
    if (!hasExplicitKeyList && (THEME.colorMode === "explicit" || !Object.hasOwn(THEME, "colorMode"))) {
      for (const key of Object.keys(declaredColors)) explicit.add(key);
    }
    if (typeof legacyPalette.accent === "string") explicit.add("accent");
    const adaptive = makeAdaptivePalette(artAnalysis?.accentRgb, shell);
    const legacyLight = (THEME.appearance === undefined || THEME.appearance === "auto")
      && THEME.colorMode !== "explicit" && shell === "light";
    const structural = new Set(["background", "panel", "panelAlt", "text", "muted"]);
    const pick = (name) => {
      const allowExplicit = explicit.has(name) && !(legacyLight && structural.has(name));
      return allowExplicit && typeof colors[name] === "string" ? colors[name] : adaptive[name];
    };
    const accent = pick("accent");
    const accentAlt = explicit.has("accentAlt") ? pick("accentAlt") : (explicit.has("accent") ? accent : adaptive.accentAlt);
    const variables = {
      "--ds-bg": pick("background"),
      "--ds-panel": pick("panel"),
      "--ds-panel-2": pick("panelAlt"),
      "--ds-green": accent,
      "--ds-lime": accentAlt,
      "--ds-cyan": pick("secondary"),
      "--ds-purple": pick("highlight"),
      "--ds-text": pick("text"),
      "--ds-muted": pick("muted"),
      "--ds-line": explicit.has("line") && typeof colors.line === "string" ? colors.line : adaptive.line,
    };

    for (const [name, value] of Object.entries(variables)) {
      if (typeof value === "string" && value) setStyleProperty(root, name, value);
    }
    const publicColors = {
      "--ds-theme-color-background": variables["--ds-bg"],
      "--ds-theme-color-panel": variables["--ds-panel"],
      "--ds-theme-color-panel-alt": variables["--ds-panel-2"],
      "--ds-theme-color-accent": variables["--ds-green"],
      "--ds-theme-color-accent-alt": variables["--ds-lime"],
      "--ds-theme-color-secondary": variables["--ds-cyan"],
      "--ds-theme-color-highlight": variables["--ds-purple"],
      "--ds-theme-color-text": variables["--ds-text"],
      "--ds-theme-color-muted": variables["--ds-muted"],
      "--ds-theme-color-line": variables["--ds-line"],
    };
    for (const [name, value] of Object.entries(publicColors)) {
      if (typeof value === "string" && value) setStyleProperty(root, name, value);
    }
    setStyleProperty(root, "--ds-theme-surface-opacity", String(CONTROLS.surfaceOpacity));
    setStyleProperty(root, "--ds-theme-surface-blur", `${CONTROLS.surfaceBlur}px`);
    setStyleProperty(root, "--ds-theme-surface-radius", `${CONTROLS.surfaceRadius}px`);
    setStyleProperty(root, "--ds-theme-font-family", "system");
    setStyleProperty(root, "--ds-theme-font-scale", "1");
    setStyleProperty(root, "--ds-theme-surface-border-alpha", "0.14");
    setStyleProperty(root, "--ds-theme-surface-shadow", "soft");
    setStyleProperty(root, "--ds-theme-image-zoom", String(CONTROLS.imageZoom));
    setStyleProperty(root, "--ds-theme-image-dim", String(CONTROLS.imageDim));
    setStyleProperty(root, "--ds-theme-image-task-intensity", "0.35");
    setStyleProperty(root, "--ds-theme-density-scale", "standard");
    setStyleProperty(root, "--ds-theme-motion-level", CONTROLS.motionLevel);
    setStyleProperty(root, "--ds-art-size", CONTROLS.imageZoom === 1
      ? "cover" : `${Number((CONTROLS.imageZoom * 100).toFixed(2))}% auto`);
    setStyleProperty(root, "--ds-theme-image-veil", `linear-gradient(rgb(var(--ds-bg-rgb) / ${CONTROLS.imageDim}), rgb(var(--ds-bg-rgb) / ${CONTROLS.imageDim}))`);
    setAttribute(root, "data-dream-controls", CONTROLS.customized ? "custom" : "default");
    setAttribute(root, "data-dream-motion-level", CONTROLS.motionLevel);
    const rgbVariables = {
      "--ds-bg-rgb": variables["--ds-bg"],
      "--ds-panel-rgb": variables["--ds-panel"],
      "--ds-panel-2-rgb": variables["--ds-panel-2"],
      "--ds-accent-rgb": variables["--ds-green"],
      "--ds-accent-alt-rgb": variables["--ds-lime"],
      "--ds-secondary-rgb": variables["--ds-cyan"],
      "--ds-highlight-rgb": variables["--ds-purple"],
      "--ds-text-rgb": variables["--ds-text"],
      "--ds-muted-rgb": variables["--ds-muted"],
      "--ds-line-rgb": variables["--ds-line"],
    };
    for (const [name, value] of Object.entries(rgbVariables)) {
      const rgb = rgbString(value);
      if (rgb) setStyleProperty(root, name, rgb);
    }
    setStyleProperty(root, "--dream-skin-name", cssString(THEME.name || "Codex Dream Skin"));
    setStyleProperty(root, "--dream-skin-tagline", cssString(THEME.tagline || "Make something wonderful."));
    setStyleProperty(root, "--dream-skin-quote", cssString(THEME.quote || "MAKE SOMETHING WONDERFUL"));
    setStyleProperty(root, "--dream-skin-brand-subtitle", cssString(
      THEME.brandSubtitle || "CODEX DREAM SKIN",
    ));
    setStyleProperty(root, "--dream-skin-status", cssString(THEME.statusText || "DREAM SKIN ONLINE"));
    setStyleProperty(root, "--dream-skin-project-prefix", cssString(THEME.projectPrefix || "选择项目 · "));
    setStyleProperty(root, "--dream-skin-project-label", cssString(THEME.projectLabel || "◉  选择项目"));
  };

  const applyArtMetadata = (root) => {
    const profile = artAnalysis || ART_METADATA;
    const inferredSafe = profile?.safeArea || "center";
    const safeArea = ART.safeArea && ART.safeArea !== "auto" ? ART.safeArea : inferredSafe;
    const canonicalSafe = ["left", "right", "center", "none"].includes(safeArea)
      ? safeArea : "center";
    const focusX = typeof ART.focusX === "number" ? ART.focusX
      : profile?.focusX ?? (safeArea === "left" ? 0.72 : safeArea === "right" ? 0.28 : 0.5);
    const focusY = typeof ART.focusY === "number" ? ART.focusY : profile?.focusY ?? 0.5;
    const taskMode = ART.taskMode && ART.taskMode !== "auto"
      ? ART.taskMode : profile?.taskMode || "ambient";
    const wide = profile?.wide || false;
    const aspect = profile?.aspect || "unknown";
    const focusXValue = `${(clamp(focusX, 0, 1) * 100).toFixed(2)}%`;
    const focusYValue = `${(clamp(focusY, 0, 1) * 100).toFixed(2)}%`;

    setAttribute(root, "data-dream-art-wide", wide ? "true" : "false");
    setAttribute(root, "data-dream-art-safe", canonicalSafe);
    setAttribute(root, "data-dream-task-mode", taskMode);
    setAttribute(root, "data-dream-art-safe-area", safeArea);
    setAttribute(root, "data-dream-art-task-mode", taskMode);
    setAttribute(root, "data-dream-art-aspect", aspect);
    setAttribute(root, "data-dream-art-ready", artAnalysis ? "true" : "false");
    setStyleProperty(root, "--dream-art-focus-x", focusXValue);
    setStyleProperty(root, "--dream-art-focus-y", focusYValue);
    setStyleProperty(root, "--dream-art-position", `${focusXValue} ${focusYValue}`);
    setStyleProperty(root, "--dream-skin-focus-x", focusXValue);
    setStyleProperty(root, "--dream-skin-focus-y", focusYValue);
    setStyleProperty(root, "--dream-skin-art-position", `${focusXValue} ${focusYValue}`);
    setStyleProperty(root, "--ds-theme-image-focus-x", String(Number(focusX.toFixed(4))));
    setStyleProperty(root, "--ds-theme-image-focus-y", String(Number(focusY.toFixed(4))));
  };

  const analyzeArt = () => new Promise((resolve) => {
    const startedAt = now();
    metrics.analysisRuns += 1;
    if (typeof window.Image !== "function" || !document?.createElement) {
      metrics.analysisMs = Number((now() - startedAt).toFixed(3));
      resolve(null);
      return;
    }
    const image = new window.Image();
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (analysisTimer) clearTimeout(analysisTimer);
      analysisTimer = null;
      metrics.analysisMs = Number((now() - startedAt).toFixed(3));
      resolve(value);
    };
    analysisTimer = setTimeout(() => finish(null), 6000);
    image.onerror = () => finish(null);
    image.onload = () => {
      try {
        const ratio = image.naturalWidth / image.naturalHeight;
        if (!Number.isFinite(ratio) || ratio <= 0) throw new Error("Invalid image dimensions");
        const maxDimension = 96;
        const width = Math.max(16, Math.round(ratio >= 1 ? maxDimension : maxDimension * ratio));
        const height = Math.max(16, Math.round(ratio >= 1 ? maxDimension / ratio : maxDimension));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext?.("2d", { willReadFrequently: true });
        if (!context) throw new Error("Canvas is unavailable");
        context.drawImage(image, 0, 0, width, height);
        const data = context.getImageData(0, 0, width, height).data;
        const samples = new Array(width * height);
        const bins = Array.from({ length: 24 }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
        let lightTotal = 0;
        let count = 0;

        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const offset = (y * width + x) * 4;
            if (data[offset + 3] < 32) continue;
            const rgb = { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
            const light = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
            const hsl = rgbToHsl(rgb);
            samples[y * width + x] = { light, saturation: hsl.s };
            lightTotal += light;
            count += 1;
            if (hsl.s >= 0.16 && hsl.l >= 0.16 && hsl.l <= 0.86) {
              const bin = bins[Math.min(23, Math.floor(hsl.h / 15))];
              const weight = hsl.s * (1 - Math.abs(hsl.l - 0.52) * 0.85);
              bin.weight += weight;
              bin.r += rgb.r * weight;
              bin.g += rgb.g * weight;
              bin.b += rgb.b * weight;
            }
          }
        }
        if (!count) throw new Error("Image has no visible pixels");
        const brightness = lightTotal / count;
        const information = (start, end) => {
          let total = 0;
          let totalSquared = 0;
          let edges = 0;
          let edgeCount = 0;
          let pixels = 0;
          for (let y = 0; y < height; y += 1) {
            for (let x = start; x < end; x += 1) {
              const sample = samples[y * width + x];
              if (!sample) continue;
              total += sample.light;
              totalSquared += sample.light * sample.light;
              pixels += 1;
              const previous = x > start ? samples[y * width + x - 1] : null;
              const above = y > 0 ? samples[(y - 1) * width + x] : null;
              if (previous) { edges += Math.abs(sample.light - previous.light); edgeCount += 1; }
              if (above) { edges += Math.abs(sample.light - above.light); edgeCount += 1; }
            }
          }
          const mean = pixels ? total / pixels : 0;
          const variance = pixels ? Math.max(0, totalSquared / pixels - mean * mean) : 1;
          return Math.sqrt(variance) * 0.58 + (edgeCount ? edges / edgeCount : 1) * 0.42;
        };
        const zoneWidth = Math.max(1, Math.floor(width * 0.38));
        const leftInformation = information(0, zoneWidth);
        const rightInformation = information(width - zoneWidth, width);
        let safeArea = "center";
        if (leftInformation < rightInformation * 0.86) safeArea = "left";
        else if (rightInformation < leftInformation * 0.86) safeArea = "right";

        let saliencyTotal = 0;
        let saliencyX = 0;
        let saliencyY = 0;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const sample = samples[y * width + x];
            if (!sample) continue;
            const previous = x > 0 ? samples[y * width + x - 1] : null;
            const above = y > 0 ? samples[(y - 1) * width + x] : null;
            const edge = (previous ? Math.abs(sample.light - previous.light) : 0) +
              (above ? Math.abs(sample.light - above.light) : 0);
            const weight = 0.01 + Math.abs(sample.light - brightness) * 0.48 +
              sample.saturation * 0.34 + edge * 0.28;
            saliencyTotal += weight;
            saliencyX += (x + 0.5) / width * weight;
            saliencyY += (y + 0.5) / height * weight;
          }
        }
        let focusX = saliencyTotal ? saliencyX / saliencyTotal : 0.5;
        let focusY = saliencyTotal ? saliencyY / saliencyTotal : 0.5;
        if (safeArea === "left") focusX = Math.max(0.64, focusX);
        if (safeArea === "right") focusX = Math.min(0.36, focusX);
        focusX = clamp(focusX, 0.12, 0.88);
        focusY = clamp(focusY, 0.18, 0.82);

        const accentBin = bins.reduce((best, candidate) => candidate.weight > best.weight ? candidate : best, bins[0]);
        const accentRgb = accentBin.weight > 0 ? {
          r: accentBin.r / accentBin.weight,
          g: accentBin.g / accentBin.weight,
          b: accentBin.b / accentBin.weight,
        } : null;
        const aspect = ratio >= 2.25 ? "ultrawide" : ratio >= 1.45 ? "wide"
          : ratio >= 1.08 ? "landscape" : ratio >= 0.9 ? "square" : "portrait";
        finish({
          width: image.naturalWidth,
          height: image.naturalHeight,
          ratio,
          wide: ratio >= 1.75,
          aspect,
          brightness,
          shell: brightness >= 0.58 ? "light" : "dark",
          safeArea,
          focusX,
          focusY,
          taskMode: ratio >= 2.25 ? "banner" : "ambient",
          accentRgb,
        });
      } catch {
        finish(null);
      }
    };
    image.src = artUrl;
  });

  const installStyle = () => {
    try {
      if (!("adoptedStyleSheets" in document) || typeof CSSStyleSheet !== "function") {
        throw new Error("Constructable stylesheets are unavailable");
      }
      const sheet = new CSSStyleSheet();
      if (typeof sheet.replaceSync !== "function") throw new Error("replaceSync is unavailable");
      sheet.replaceSync(cssText);
      const retained = [...document.adoptedStyleSheets]
        .filter((candidate) => !styleRegistry.has(candidate));
      document.adoptedStyleSheets = [...retained, sheet];
      styleRegistry.clear();
      styleRegistry.add(sheet);
      document.getElementById(STYLE_ID)?.remove();
      styleSheet = sheet;
      styleMode = "adopted";
      return;
    } catch {
      styleSheet = null;
    }

    styleNode = document.getElementById(STYLE_ID) || document.createElement("style");
    styleNode.id = STYLE_ID;
    styleNode.textContent = cssText;
    if (!styleNode.parentElement) (document.head || document.documentElement).appendChild(styleNode);
    styleMode = "style";
  };

  const ensureStyle = () => {
    if (styleMode === "adopted" && styleSheet) {
      const current = [...document.adoptedStyleSheets];
      if (!current.includes(styleSheet)) {
        document.adoptedStyleSheets = [...current, styleSheet];
        metrics.styleRepairs += 1;
      }
      return;
    }
    if (styleNode && document.getElementById(STYLE_ID) !== styleNode) {
      document.getElementById(STYLE_ID)?.remove();
      (document.head || document.documentElement).appendChild(styleNode);
      metrics.styleRepairs += 1;
    }
  };

  // Chromium can keep Codex's native browser toolbar in a stale paint layer
  // when the constructable sheet is installed before the embedded tab mounts.
  // Reattaching the same sheet once after the shell settles refreshes that
  // layer without changing native toolbar geometry or interaction.
  const scheduleStylePaintRepair = (delay = 180) => {
    if (styleMode !== "adopted" || !styleSheet || stylePaintRepairTimer) return;
    stylePaintRepairTimer = setTimeout(() => {
      stylePaintRepairTimer = null;
      if (window[DISABLED_KEY] || !styleSheet || !document.adoptedStyleSheets) return;
      const current = [...document.adoptedStyleSheets];
      if (!current.includes(styleSheet)) return;
      document.adoptedStyleSheets = current.filter((candidate) => candidate !== styleSheet);
      const reattach = () => {
        if (window[DISABLED_KEY] || !styleSheet || !document.adoptedStyleSheets) return;
        const latest = [...document.adoptedStyleSheets]
          .filter((candidate) => candidate !== styleSheet);
        document.adoptedStyleSheets = [...latest, styleSheet];
        metrics.styleRepairs += 1;
      };
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(reattach);
      else setTimeout(reattach, 0);
    }, delay);
  };

  installStyle();
  scheduleStylePaintRepair();

  const applyRootState = (root) => {
    metrics.rootPasses += 1;
    ensureStyle();
    const shell = resolvedShell();
    setAttribute(root, "data-dream-skin", "active");
    setAttribute(root, SHELL_ATTR, shell);
    setStyleProperty(root, "--dream-skin-art", `url("${artUrl}")`);
    applyTheme(root, shell);
    applyArtMetadata(root);
    ensureVideoLayer(root);
    return shell;
  };

  const selectorHit = (key) => {
    const selector = selectorByKey.get(key)?.selector;
    if (!selector) return false;
    try { return Boolean(document.querySelector(selector)); } catch { return false; }
  };

  const stableTestidHit = (testid) => {
    const selector = stableTestidSelector(testid);
    if (!selector) return false;
    try { return Boolean(document.querySelector(selector)); } catch { return false; }
  };

  const partNodes = new Set();
  const queryAll = (selector) => {
    if (!selector) return [];
    try { return [...document.querySelectorAll(selector)]; } catch { return []; }
  };
  const selectorNodes = (key) => queryAll(selectorByKey.get(key)?.selector);
  const genericNodes = (selector) => queryAll(selector)
    .filter((node) => node && typeof node.setAttribute === "function");
  const genericInputNodes = () => genericNodes(
    'textarea, [contenteditable="true"], [role="textbox"]',
  ).filter((node) => !node.closest?.('[role="dialog"], [aria-modal="true"]'));
  const resolvedMainNode = () => {
    const exact = selectorNodes("shell-main")[0];
    if (exact) return exact;
    for (const input of genericInputNodes()) {
      const main = input.closest?.('main, [role="main"]');
      if (main && typeof main.setAttribute === "function") return main;
    }
    return genericNodes('main, [role="main"]')
      .find((node) => !node.closest?.('[role="dialog"], [aria-modal="true"]')) ?? null;
  };
  const fallbackMainNodes = () => selectorNodes("shell-main").length
    ? [] : [resolvedMainNode()].filter(Boolean);
  const fallbackSidebarNodes = () => {
    if (selectorNodes("left-panel").length) return [];
    const main = resolvedMainNode();
    const mainParent = main?.parentElement;
    if (!main || !mainParent) return [];
    const candidate = genericNodes('aside, nav[aria-label]')
      .filter((node) => !main.contains?.(node))
      .filter((node) => !node.closest?.('[role="dialog"], [aria-modal="true"]'))
      .find((node) => node.parentElement === mainParent
        || node.parentElement?.parentElement === mainParent
        || node.parentElement === mainParent.parentElement);
    return candidate ? [candidate] : [];
  };
  const fallbackComposerNodes = () => selectorNodes("composer-chrome").length
    ? [] : (() => {
      const main = resolvedMainNode();
      for (const input of genericInputNodes()) {
        if (main && !main.contains?.(input)) continue;
        const owner = input.closest?.(
          '[data-testid*="composer" i], [data-testid*="prompt" i], ' +
          '[class*="composer" i], [class*="prompt" i]',
        );
        if (owner && (!main || main.contains?.(owner))) return [owner];
      }
      return [];
    })();
  const addPart = (desired, part, nodes) => {
    for (const node of nodes) {
      if (node && typeof node.setAttribute === "function" && !desired.has(node)) {
        desired.set(node, part);
      }
    }
  };
  const refreshParts = () => {
    metrics.partPasses += 1;
    const desired = new Map();
    addPart(desired, "root", [document.documentElement]);
    addPart(desired, "sidebar", [...selectorNodes("left-panel"), ...fallbackSidebarNodes()]);
    addPart(desired, "header", selectorNodes("header-tint"));
    // Route-specific parts win when a generic shell collapses home and main
    // onto the same element.
    addPart(desired, "home", selectorNodes("home-route"));
    addPart(desired, "main", [...selectorNodes("shell-main"), ...fallbackMainNodes()]);
    addPart(desired, "project-list", selectorNodes("project-selector"));
    addPart(desired, "thread", selectorNodes("thread-surface"));
    addPart(desired, "message", selectorNodes("message"));
    addPart(desired, "composer", [...selectorNodes("composer-chrome"), ...fallbackComposerNodes()]);
    addPart(desired, "composer-toolbar", selectorNodes("composer-toolbar"));
    addPart(desired, "dialog", selectorNodes("overlay-dialog"));
    const homeHero = selectorNodes("game-source")[0] ??
      selectorNodes("home-icon")[0]?.parentElement;
    addPart(desired, "home-hero", homeHero ? [homeHero] : []);

    for (const node of partNodes) {
      if (!desired.has(node)) {
        node.removeAttribute?.(PART_ATTR);
        metrics.partWrites += 1;
      }
    }
    partNodes.clear();
    for (const [node, part] of desired) {
      if (node.getAttribute?.(PART_ATTR) !== part) {
        node.setAttribute(PART_ATTR, part);
        metrics.partWrites += 1;
      }
      partNodes.add(node);
    }
  };

  const removeParts = () => {
    for (const node of partNodes) node.removeAttribute?.(PART_ATTR);
    partNodes.clear();
    for (const node of queryAll(`[${PART_ATTR}]`)) node.removeAttribute?.(PART_ATTR);
  };

  const scopeMatches = (scope, baseState, overlay) => {
    const active = new Set([baseState]);
    if (baseState !== "settings") active.add("all");
    if (overlay) active.add("overlay");
    const tokens = String(scope || "all").toLowerCase().match(/[a-z]+/g) || ["all"];
    return tokens.some((token) => token !== "config" && active.has(token));
  };

  const detectScope = () => {
    const overlay = selectorHit("overlay-menu") || selectorHit("overlay-dialog") ||
      selectorHit("overlay-popper");
    let baseState = "thread";
    if (selectorHit("settings-panel") || selectorHit("appearance-radio") ||
      stableTestidHit("theme-preview")) baseState = "settings";
    else if (selectorHit("home-icon") || selectorHit("home-route")) baseState = "home";
    else if (!selectorHit("shell-main") && !document.querySelector('main, [role="main"]')) baseState = "settings";
    const missingL1 = SELECTOR_CONTRACT.selectors
      .filter((entry) => entry.tier === "L1" && entry.required &&
        scopeMatches(entry.scope, baseState, overlay) && !selectorHit(entry.key))
      .map((entry) => entry.key);
    return {
      state: overlay ? "overlay" : baseState,
      baseState,
      overlay,
      // Settings replaces (or partially replaces) the app shell on macOS and
      // can retain a shell on Windows.  It is therefore always an L0 scope;
      // never treat the absence of the home/thread L1 anchors as a failure.
      level: baseState === "settings" || missingL1.length ? "L0" : "L1",
      missingL1,
    };
  };

  const VISUAL_STATE_ALIASES = new Map([
    ["ready", "idle"],
    ["queued", "thinking"],
    ["loading", "thinking"],
    ["generating", "thinking"],
    ["streaming", "thinking"],
    ["running", "executing"],
    ["working", "executing"],
    ["tool", "executing"],
    ["needs-approval", "approval"],
    ["needs_review", "approval"],
    ["review", "approval"],
    ["complete", "success"],
    ["completed", "success"],
    ["done", "success"],
    ["failed", "error"],
    ["failure", "error"],
  ]);

  const normalizeVisualState = (value) => {
    const token = String(value ?? "").trim().toLowerCase().replace(/[_\s]+/g, "-");
    if (VISUAL_STATES.has(token)) return token;
    return VISUAL_STATE_ALIASES.get(token) || null;
  };

  const visibleSignal = (node, main) => Boolean(node)
    && node.getAttribute?.("hidden") === null
    && node.getAttribute?.("aria-hidden") !== "true"
    && (!main || main.contains?.(node));

  const signalNodes = (selectors, main) => selectors
    .flatMap((selector) => queryAll(selector))
    .filter((node) => visibleSignal(node, main));

  const explicitVisualState = (main) => {
    const attributes = [
      "data-codex-dream-skin-state",
      "data-codex-state",
      "data-agent-state",
      "data-run-state",
      "data-task-state",
    ];
    const selectors = attributes.map((attribute) => `[${attribute}]`);
    for (const node of signalNodes(selectors, main)) {
      for (const attribute of attributes) {
        const state = normalizeVisualState(node.getAttribute?.(attribute));
        if (state) return state;
      }
    }
    return null;
  };

  const detectVisualState = (scope) => {
    if (scope?.baseState === "settings") return { state: "settings", source: "route", confidence: "high" };
    if (scope?.overlay) return { state: "overlay", source: "route", confidence: "high" };
    if (scope?.baseState === "home") return { state: "home", source: "route", confidence: "high" };

    if (visualStateOverride) {
      return { state: visualStateOverride, source: "event", confidence: "explicit" };
    }

    const main = resolvedMainNode();
    const explicit = explicitVisualState(main);
    if (explicit) return { state: explicit, source: "dom", confidence: "explicit" };
    if (signalNodes([
      "[data-codex-approval]", "[data-approval-required]",
      '[data-codex-state="approval"]', '[data-status="approval"]',
    ], main).length) {
      return { state: "approval", source: "dom", confidence: "medium" };
    }
    if (signalNodes([
      '[data-codex-state="error"]', '[data-status="error"]',
      '[data-run-state="failed"]', '[role="alert"][aria-live="assertive"]',
    ], main).length) {
      return { state: "error", source: "dom", confidence: "medium" };
    }
    if (signalNodes([
      "[data-tool-running=\"true\"]", "[data-executing=\"true\"]",
      '[data-codex-state="executing"]', '[data-status="running"]',
      '[data-state="running"]',
    ], main).length) {
      return { state: "executing", source: "dom", confidence: "medium" };
    }
    if (signalNodes([
      '[aria-busy="true"]', '[data-loading="true"]', '[data-streaming="true"]',
      '[data-codex-state="thinking"]', '[data-status="thinking"]',
      '[role="progressbar"]',
    ], main).length) {
      return { state: "thinking", source: "dom", confidence: "medium" };
    }
    if (signalNodes([
      '[data-codex-state="success"]', '[data-status="success"]',
      '[data-status="completed"]', '[data-run-state="completed"]',
    ], main).length) {
      return { state: "success", source: "dom", confidence: "medium" };
    }
    if (scope?.baseState === "thread") return { state: "idle", source: "route", confidence: "low" };
    return { state: "unknown", source: "fallback", confidence: "low" };
  };

  const applyVisualState = ({ state, source, confidence }) => {
    if (!VISUAL_STATES.has(state)) return visualState;
    const root = document.documentElement;
    const visualEffect = applyStateEffect(root, state);
    if (visualState.state === state && visualState.source === source) {
      const runtimeState = window[STATE_KEY];
      if (runtimeState?.installToken === installToken) runtimeState.visualEffect = visualEffect;
      return visualState;
    }
    visualState = {
      state,
      source,
      confidence,
      since: Date.now(),
      sequence: visualState.sequence + 1,
    };
    if (root) setAttribute(root, "data-dream-visual-state", state);
    const runtimeState = window[STATE_KEY];
    if (runtimeState?.installToken === installToken) {
      runtimeState.visualState = visualState;
      runtimeState.visualEffect = visualEffect;
    }
    return visualState;
  };

  const refreshVisualState = (scope) => applyVisualState(detectVisualState(scope));

  const setVisualState = (requested, source = "event") => {
    const state = normalizeVisualState(requested);
    if (!state) return null;
    visualStateOverride = state;
    return applyVisualState({ state, source, confidence: "explicit" });
  };

  const clearVisualState = () => {
    visualStateOverride = null;
    return refreshVisualState(window[STATE_KEY]?.scope || detectScope());
  };

  const visualStateHandler = (event) => {
    const detail = event?.detail;
    if (detail?.clear === true || detail === null) {
      clearVisualState();
      return;
    }
    const requested = typeof detail === "string" ? detail : detail?.state ?? detail?.visualState;
    if (requested !== undefined) setVisualState(requested);
  };

  const refreshScope = () => {
    metrics.routePasses += 1;
    const scope = detectScope();
    const state = window[STATE_KEY];
    if (state?.installToken === installToken) state.scope = scope;
    return scope;
  };

  const ensure = ({ root: rootPass = true, scope: scopePass = false, parts: partPass = false } = {}) => {
    if (window[DISABLED_KEY]) return;
    const root = document.documentElement;
    if (!root) return;
    metrics.ensureCalls += 1;
    if (rootPass) applyRootState(root);
    if (partPass) refreshParts();
    const scope = scopePass ? refreshScope() : window[STATE_KEY]?.scope || detectScope();
    if (rootPass || scopePass) refreshVisualState(scope);
  };

  const cleanup = () => {
    const state = window[STATE_KEY];
    if (state?.installToken !== installToken) return false;
    window[DISABLED_KEY] = true;
    const root = document.documentElement;
    for (const name of ROOT_ATTRS) root?.removeAttribute(name);
    for (const attribute of [...(root?.attributes || [])]) {
      if (attribute.name.startsWith("data-dream-")) root.removeAttribute(attribute.name);
    }
    for (const name of THEME_VARIABLES) root?.style.removeProperty(name);
    for (const property of [...(root?.style || [])]) {
      if (property.startsWith("--dream-") || property.startsWith("--ds-")) {
        root.style.removeProperty(property);
      }
    }
    removeParts();
    state?.rootObserver?.disconnect();
    state?.partObserver?.disconnect();
    if (bodyReadyHandler && typeof document.removeEventListener === "function") {
      document.removeEventListener("DOMContentLoaded", bodyReadyHandler);
    }
    if (state?.timer) clearInterval(state.timer);
    if (state?.scheduler?.timeout) clearTimeout(state.scheduler.timeout);
    if (stylePaintRepairTimer) clearTimeout(stylePaintRepairTimer);
    stylePaintRepairTimer = null;
    if (analysisTimer) clearTimeout(analysisTimer);
    if (state?.mediaHandler && state?.mediaQuery) {
      try { state.mediaQuery.removeEventListener("change", state.mediaHandler); } catch {}
    }
    if (state?.motionHandler && state?.motionQuery) {
      try { state.motionQuery.removeEventListener("change", state.motionHandler); } catch {}
    }
    if (batteryManager && batteryHandler) {
      try {
        batteryManager.removeEventListener("chargingchange", batteryHandler);
        batteryManager.removeEventListener("levelchange", batteryHandler);
      } catch {}
    }
    if (visibilityHandler && typeof document.removeEventListener === "function") {
      document.removeEventListener("visibilitychange", visibilityHandler);
    }
    if (blurHandler && typeof window.removeEventListener === "function") {
      window.removeEventListener("blur", blurHandler);
    }
    if (focusHandler && typeof window.removeEventListener === "function") {
      window.removeEventListener("focus", focusHandler);
    }
    if (visualStateHandler && typeof window.removeEventListener === "function") {
      window.removeEventListener(VISUAL_STATE_EVENT, visualStateHandler);
    }
    if (state?.navigationHandler && state?.navigation) {
      try { state.navigation.removeEventListener("navigate", state.navigationHandler); } catch {}
    }
    if (styleSheet) {
      try {
        document.adoptedStyleSheets = [...document.adoptedStyleSheets]
          .filter((candidate) => candidate !== styleSheet);
      } catch {}
      styleRegistry.delete(styleSheet);
    }
    styleNode?.remove();
    if (document.getElementById(STYLE_ID) === styleNode) document.getElementById(STYLE_ID)?.remove();
    if (styleRegistry.size === 0) delete window[STYLE_REGISTRY_KEY];
    if (state?.artUrl) URL.revokeObjectURL(state.artUrl);
    videoTransfer.abort();
    if (videoSourceBlobUrl) {
      try { URL.revokeObjectURL(videoSourceBlobUrl); } catch {}
    }
    videoSourceBlobUrl = null;
    videoSourceOverride = null;
    videoNode?.pause?.();
    videoNode?.remove?.();
    videoNode = null;
    delete window[VIDEO_SOURCE_KEY];
    delete window[VIDEO_TRANSFER_KEY];
    delete window[STATE_KEY];
    return true;
  };

  const scheduler = { timeout: null, root: false, scope: false, parts: false };
  const flushScheduledEnsure = () => {
    if (scheduler.timeout) clearTimeout(scheduler.timeout);
    scheduler.timeout = null;
    const pending = { root: scheduler.root, scope: scheduler.scope, parts: scheduler.parts };
    scheduler.root = false;
    scheduler.scope = false;
    scheduler.parts = false;
    ensure(pending);
  };
  const scheduleEnsure = ({ root = false, scope = false, parts = false } = {}, delay = 64) => {
    scheduler.root ||= root;
    scheduler.scope ||= scope;
    scheduler.parts ||= parts;
    if (scheduler.timeout) return;
    scheduler.timeout = setTimeout(flushScheduledEnsure, delay);
  };
  if (typeof MutationObserver === "function") {
    rootObserver = new MutationObserver(() => scheduleEnsure({ root: true }));
    // SPA route changes are observable as DOM mutations even when Chromium's
    // Navigation API emits no event. Keep verification scope and public parts
    // derived from the same post-mutation tree.
    partObserver = new MutationObserver(() => scheduleEnsure({ scope: true, parts: true }, 80));
  }

  let mediaQuery = null;
  let mediaHandler = null;
  try {
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaHandler = () => scheduleEnsure({ root: true });
  } catch {}

  try {
    motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    motionHandler = () => ensure({ root: true });
  } catch {}
  visibilityHandler = () => ensure({ root: true });
  blurHandler = () => {
    windowFocused = false;
    videoNode?.pause?.();
    ensure({ root: true });
  };
  focusHandler = () => {
    windowFocused = true;
    ensure({ root: true });
  };

  const navigationApi = window.navigation && typeof window.navigation.addEventListener === "function"
    ? window.navigation : null;
  const navigationHandler = navigationApi ? () => {
    metrics.navigationEvents += 1;
    scheduleEnsure({ scope: true, parts: true }, 180);
  } : null;

  if (typeof window.addEventListener === "function") {
    window.addEventListener(VISUAL_STATE_EVENT, visualStateHandler);
  }

  window[STATE_KEY] = {
    ensure,
    cleanup,
    rootObserver,
    partObserver,
    timer: null,
    scheduler,
    mediaQuery,
    mediaHandler,
    motionQuery,
    motionHandler,
    videoNode,
    visualState,
    visualEffect: null,
    setVisualState,
    clearVisualState,
    visualStateHandler,
    visualStateEvent: VISUAL_STATE_EVENT,
    navigation: navigationApi,
    navigationHandler,
    artUrl,
    installToken,
    styleMode,
    styleNode,
    styleSheet,
    styleRevision: STYLE_REVISION,
    analysis: artAnalysis,
    artMetadata: ART_METADATA,
    scope: null,
    selectorsSchema: SELECTOR_CONTRACT.schema,
    metrics,
    version: VERSION,
    themeId: THEME.id || "custom",
    revision: PAYLOAD_REVISION,
    detectShellAppearance,
  };
  const firstEnsureStartedAt = now();
  ensure({ root: true, parts: true });
  const initialScope = refreshScope();
  metrics.firstEnsureMs = Number((now() - firstEnsureStartedAt).toFixed(3));

  const observeAttributes = (node) => {
    if (!rootObserver || !node) return;
    rootObserver.observe(node, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "data-appearance", "data-color-mode"],
    });
  };
  const observePartTree = (node) => {
    if (!partObserver || !node) return;
    partObserver.observe(node, { childList: true, subtree: true });
  };
  observeAttributes(document.documentElement);
  const observeBody = () => {
    observeAttributes(document.body);
    observePartTree(document.body);
  };
  if (document.body) observeBody();
  else if (typeof document.addEventListener === "function") {
    bodyReadyHandler = () => {
      if (!window[DISABLED_KEY]) {
        observeBody();
        scheduleEnsure({ scope: true, parts: true }, 0);
      }
    };
    document.addEventListener("DOMContentLoaded", bodyReadyHandler, { once: true });
  }
  const timer = setInterval(() => {
    metrics.safetyPasses += 1;
    ensure({ root: true });
  }, 30000);
  window[STATE_KEY].timer = timer;
  if (mediaHandler && mediaQuery && typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", mediaHandler);
  }
  if (motionHandler && motionQuery && typeof motionQuery.addEventListener === "function") {
    motionQuery.addEventListener("change", motionHandler);
  }
  if (typeof document.addEventListener === "function") {
    document.addEventListener("visibilitychange", visibilityHandler);
  }
  if (typeof window.addEventListener === "function") {
    window.addEventListener("blur", blurHandler);
    window.addEventListener("focus", focusHandler);
  }
  if (typeof navigator === "object" && typeof navigator.getBattery === "function") {
    Promise.resolve(navigator.getBattery()).then((battery) => {
      if (!battery || window[DISABLED_KEY]) return;
      batteryManager = battery;
      batteryHandler = () => {
        batterySaver = battery.charging === false && Number(battery.level) <= 0.2;
        ensure({ root: true });
      };
      batteryHandler();
      battery.addEventListener?.("chargingchange", batteryHandler);
      battery.addEventListener?.("levelchange", batteryHandler);
    }).catch(() => {});
  }
  if (navigationHandler && navigationApi) {
    navigationApi.addEventListener("navigate", navigationHandler);
  }
  const analysisPromise = artAnalysis ? Promise.resolve(null) : analyzeArt();
  window[STATE_KEY].analysisTimer = analysisTimer;
  analysisPromise.then((analysis) => {
    const state = window[STATE_KEY];
    if (!analysis || state?.installToken !== installToken || window[DISABLED_KEY]) return;
    artAnalysis = analysis;
    state.analysis = analysis;
    if (typeof THEME.artKey === "string") {
      analysisCache.set(THEME.artKey, analysis);
      while (analysisCache.size > 8) analysisCache.delete(analysisCache.keys().next().value);
    }
    ensure({ root: true });
  }).catch(() => {});
  return {
    installed: true,
    version: VERSION,
    themeId: THEME.id || "custom",
    revision: PAYLOAD_REVISION,
    shell: resolvedShell(),
    scope: initialScope,
    styleMode,
    analysis: artAnalysis,
  };
})(__DREAM_SKIN_CSS_JSON__, __DREAM_SKIN_ART_JSON__, __DREAM_SKIN_THEME_JSON__)
