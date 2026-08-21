const STATES = ["idle", "thinking", "executing", "approval", "success", "error", "settings", "overlay"];
const STATE_LABELS = {
  idle: "待机", thinking: "思考", executing: "执行", approval: "审批",
  success: "完成", error: "异常", settings: "设置", overlay: "浮层",
};
const DEFAULT_EFFECTS = {
  idle: { color: "#58c9d4", overlayOpacity: 0.08, mediaOpacity: 1, brightness: 1, saturation: 1, contrast: 1, hueRotate: 0, motion: "none" },
  thinking: { color: "#58c9d4", overlayOpacity: 0.16, mediaOpacity: 0.96, brightness: 1.05, saturation: 1.12, contrast: 1, hueRotate: 0, motion: "pulse" },
  executing: { color: "#8dffb6", overlayOpacity: 0.18, mediaOpacity: 1, brightness: 1.08, saturation: 1.2, contrast: 1.04, hueRotate: 0, motion: "pulse" },
  approval: { color: "#ffb164", overlayOpacity: 0.2, mediaOpacity: 0.93, brightness: 1.02, saturation: 1.1, contrast: 1.05, hueRotate: 0, motion: "alert" },
  success: { color: "#8dffb6", overlayOpacity: 0.16, mediaOpacity: 1, brightness: 1.08, saturation: 1.16, contrast: 1, hueRotate: 0, motion: "flash" },
  error: { color: "#ff756e", overlayOpacity: 0.24, mediaOpacity: 0.88, brightness: 0.94, saturation: 1.35, contrast: 1.08, hueRotate: 0, motion: "alert" },
  settings: { color: "#58c9d4", overlayOpacity: 0.05, mediaOpacity: 0.82, brightness: 0.92, saturation: 0.78, contrast: 1, hueRotate: 0, motion: "none" },
  overlay: { color: "#d9eee9", overlayOpacity: 0.08, mediaOpacity: 0.72, brightness: 0.86, saturation: 0.7, contrast: 1.06, hueRotate: 0, motion: "none" },
};
const FALLBACK_CONTROLS = {
  surfaceOpacity: 0.86,
  surfaceBlur: 18,
  surfaceRadius: 18,
  imageZoom: 1,
  imageDim: 0.18,
  motionLevel: "standard",
};
const SYSTEM_DEFAULT_THEME_ID = "preset-arina-hashimoto";
const VIDEO_THEME_COVER_URL = "/video-theme-cover.png";

const TOKEN_STORAGE_KEY = "dream-skin-control-token";
const query = new URLSearchParams(location.search);
const queryToken = query.get("token") ?? "";
let token = queryToken;
try {
  if (queryToken) sessionStorage.setItem(TOKEN_STORAGE_KEY, queryToken);
  else token = sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
} catch {
  // Storage may be unavailable in a restricted browser context; URL auth still works.
}
if (queryToken) history.replaceState(null, "", location.pathname);

const state = {
  themes: [],
  selectedId: null,
  draft: null,
  optionalFields: { colors: false, controls: false },
  currentState: "idle",
  imageUploadId: null,
  videoUploadId: null,
  localImageUrl: null,
  localVideoUrl: null,
  busy: false,
  dirty: false,
  paused: false,
  actionsEnabled: false,
  importEnabled: false,
  exports: {},
  themeFilter: "all",
  themeQuery: "",
  editorTab: "media",
  mediaMode: "image",
  newDraft: false,
  connected: false,
  busyButton: null,
};

const elements = Object.fromEntries([
  "connection-dot", "system-status", "connection-banner", "connection-message", "retry-button",
  "theme-count", "theme-list", "theme-search", "library-match", "library-empty", "preview-name",
  "preview-fingerprint", "preview-mode", "preview-state-name", "preview-stage", "preview-image",
  "preview-video", "state-strip", "theme-name", "draft-summary", "selection-note", "action-help",
  "image-upload", "image-upload-label", "image-upload-hint", "video-upload", "inherit-video", "media-mode-image", "media-mode-video", "new-theme-button", "import-theme-button", "import-theme-file", "delete-theme-button", "effect-state-label", "effect-color", "effect-motion",
  "effect-overlay", "effect-overlay-output", "effect-media", "effect-media-output", "effect-brightness",
  "effect-brightness-output", "effect-saturation", "effect-saturation-output", "effect-hue", "effect-hue-output",
  "export-version", "publisher-name", "publisher-id", "export-license", "export-summary", "export-ai",
  "export-history-note", "save-status", "reset-button", "pause-button", "resume-button", "apply-button", "save-button",
  "export-button", "save-apply-button", "start-codex-button", "restore-button", "action-dock", "operation-progress", "operation-progress-label", "operation-progress-time",
  "toast", "new-theme-dialog", "new-theme-name", "new-theme-type-image",
  "new-theme-type-video", "new-theme-file", "new-theme-file-label", "new-theme-file-hint", "new-theme-error",
  "new-theme-cancel", "new-theme-confirm",
].map((id) => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), document.getElementById(id)]));

async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("X-DreamSkin-Token", token);
  if (options.body && !(options.body instanceof Blob)) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
  if (response.status === 403) {
    try { sessionStorage.removeItem(TOKEN_STORAGE_KEY); } catch {}
  }
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

function mediaUrl(id) {
  return id ? `/api/media/${encodeURIComponent(id)}` : "";
}

function releaseObjectUrl(value) {
  if (typeof value === "string" && value.startsWith("blob:")) URL.revokeObjectURL(value);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setPath(object, dottedPath, value) {
  const parts = dottedPath.split(".");
  let cursor = object;
  for (const part of parts.slice(0, -1)) cursor = cursor[part] ??= {};
  cursor[parts.at(-1)] = value;
}

function getPath(object, dottedPath) {
  return dottedPath.split(".").reduce((value, part) => value?.[part], object);
}

function hexColor(value, fallback = "#58c9d4") {
  if (/^#[0-9a-f]{6}$/i.test(value ?? "")) return value;
  if (/^#[0-9a-f]{3}$/i.test(value ?? "")) return `#${value.slice(1).split("").map((x) => `${x}${x}`).join("")}`;
  return fallback;
}

function cleanThemeName(value) {
  const name = String(value ?? "").replace(/(?:\s+Control Edit)+$/gu, "").trim();
  return name || "未命名主题";
}

function themeToDraft(theme) {
  return {
    name: `${cleanThemeName(theme.name)} Control Edit`,
    appearance: theme.appearance ?? "auto",
    art: {
      focusX: theme.art?.focusX ?? 0.5,
      focusY: theme.art?.focusY ?? 0.5,
      safeArea: ["left", "right", "none"].includes(theme.art?.safeArea) ? theme.art.safeArea : "none",
      taskMode: ["ambient", "full", "off"].includes(theme.art?.taskMode) ? theme.art.taskMode : "ambient",
    },
    colors: {
      background: theme.colors?.background ?? "#071116",
      panel: theme.colors?.panel ?? "#0b1a20",
      panelAlt: theme.colors?.panelAlt ?? "#10272c",
      accent: theme.colors?.accent ?? "#8dffb6",
      accentAlt: theme.colors?.accentAlt ?? "#b8ff3d",
      secondary: theme.colors?.secondary ?? "#58c9d4",
      highlight: theme.colors?.highlight ?? "#642a8c",
      text: theme.colors?.text ?? "#e9fff1",
      muted: theme.colors?.muted ?? "#9ebdb3",
      line: theme.colors?.line ?? "rgba(124, 255, 70, .28)",
    },
    controls: { ...FALLBACK_CONTROLS, ...(theme.controls ?? {}) },
    stateEffects: Object.fromEntries(STATES.map((key) => [key, { ...DEFAULT_EFFECTS[key], ...(theme.stateEffects?.[key] ?? {}) }])),
    videoPerformance: theme.video?.performance ?? "balanced",
  };
}

function optionalFieldsForTheme(theme) {
  return {
    colors: theme?.colorMode !== "explicit",
    controls: !theme?.controls,
  };
}

function loadDraft(theme) {
  state.draft = themeToDraft(theme);
  state.optionalFields = optionalFieldsForTheme(theme);
}

function persistenceDraft(draft, optionalFields = {}) {
  const payload = deepClone(draft);
  if (optionalFields.colors) delete payload.colors;
  if (optionalFields.controls) delete payload.controls;
  return payload;
}

function selectedTheme() {
  return state.themes.find((theme) => theme.id === state.selectedId);
}

function systemDefaultTheme() {
  return state.themes.find((theme) => theme.id === SYSTEM_DEFAULT_THEME_ID
    || theme.theme?.id === SYSTEM_DEFAULT_THEME_ID
    || cleanThemeName(theme.name) === "桥本有菜");
}

function kindLabel(kind) {
  return kind === "active" ? "当前" : kind === "saved" ? "已保存" : "内置";
}

function updateSelectionSummary() {
  const theme = selectedTheme();
  elements.draftSummary.textContent = state.draft?.name || "尚未选择主题";
  elements.selectionNote.textContent = state.newDraft
    ? `新建草稿 / 基于 ${theme ? cleanThemeName(theme.name) : "当前主题"}`
    : theme
    ? `${kindLabel(theme.kind)}主题 / ${theme.theme.video ? "视频主题 / 统一封面" : "图片背景"}`
    : "选择主题后开始调校";
  elements.previewFingerprint.textContent = theme?.fingerprint ? `ID ${theme.fingerprint.slice(0, 12)}` : "未载入主题数据";
}

let operationTimer = null;
let operationStartedAt = 0;

function clearBusyButton(button) {
  if (!button) return;
  button.classList.remove("is-loading");
  button.removeAttribute("aria-busy");
  delete button.dataset.loadingLabel;
}

function updateOperationClock() {
  const elapsed = Math.max(0, Math.floor((performance.now() - operationStartedAt) / 1000));
  elements.operationProgressTime.textContent = `${elapsed}s`;
}

function setBusy(busy, label = "", button = null) {
  if (busy) {
    clearBusyButton(state.busyButton);
    state.busy = true;
    state.busyButton = button;
    operationStartedAt = performance.now();
    clearInterval(operationTimer);
    operationTimer = window.setInterval(updateOperationClock, 250);
    elements.operationProgressLabel.textContent = label || "正在执行本地操作";
    elements.operationProgressTime.textContent = "0s";
    elements.operationProgress.hidden = false;
    elements.actionDock.setAttribute("aria-busy", "true");
    if (button) {
      button.dataset.loadingLabel = label || "处理中";
      button.setAttribute("aria-busy", "true");
      button.classList.add("is-loading");
    }
  } else {
    clearBusyButton(state.busyButton);
    state.busy = false;
    state.busyButton = null;
    clearInterval(operationTimer);
    operationTimer = null;
    elements.operationProgress.hidden = true;
    elements.actionDock.setAttribute("aria-busy", "false");
  }
  updateActionAvailability();
  updateEditorAvailability();
  if (busy) elements.saveStatus.textContent = label || "正在执行本地操作";
  else updateSaveStatus();
}

function updateActionAvailability() {
  const savedSelected = !state.newDraft && selectedTheme()?.kind === "saved";
  const hasDraft = Boolean(state.draft);
  elements.resetButton.disabled = state.busy || !state.dirty || !hasDraft;
  elements.applyButton.disabled = state.busy || !state.actionsEnabled || !savedSelected;
  elements.pauseButton.disabled = state.busy || !state.actionsEnabled || state.paused;
  elements.resumeButton.disabled = state.busy || !state.actionsEnabled || !state.paused;
  elements.startCodexButton.disabled = state.busy || !state.actionsEnabled;
  elements.restoreButton.disabled = state.busy || !state.actionsEnabled;
  elements.saveButton.disabled = state.busy || !hasDraft;
  elements.exportButton.disabled = state.busy || !savedSelected;
  elements.saveApplyButton.disabled = state.busy || !state.actionsEnabled || !hasDraft || !savedSelected;
  elements.newThemeButton.disabled = state.busy || state.themes.length === 0;
  elements.deleteThemeButton.disabled = state.busy || !savedSelected;
  if (!hasDraft) elements.actionHelp.textContent = "选择主题后可开始调校";
  else if (!state.actionsEnabled) elements.actionHelp.textContent = "当前平台未开放原生应用操作";
  else if (!savedSelected) elements.actionHelp.textContent = "内置主题或新建草稿请使用“保存为新主题”；保存并应用只更新已保存主题";
  else if (state.dirty) elements.actionHelp.textContent = "草稿未保存，保存后才会写入主题库";
  else elements.actionHelp.textContent = state.paused ? "皮肤已暂停显示" : "参数已同步到当前主题";
}

function updateEditorAvailability() {
  const disabled = state.busy || !state.draft;
  for (const input of document.querySelectorAll(".inspector [data-path], #theme-name, #image-upload, #video-upload, #inherit-video, #media-mode-image, #media-mode-video, #effect-color, #effect-motion, #effect-overlay, #effect-media, #effect-brightness, #effect-saturation, #effect-hue")) {
    input.disabled = disabled;
  }
  elements.imageUpload.disabled = disabled || state.mediaMode === "video";
  elements.videoUpload.disabled = disabled || state.mediaMode === "image";
  elements.inheritVideo.disabled = disabled || state.mediaMode !== "video";
}

function updateMediaModeUI() {
  elements.mediaModeImage.checked = state.mediaMode === "image";
  elements.mediaModeVideo.checked = state.mediaMode === "video";
  const video = state.mediaMode === "video";
  elements.imageUploadLabel.textContent = video ? "统一视频封面" : "更换图片";
  elements.imageUploadHint.textContent = video ? "所有视频主题共用" : "PNG / JPG / WEBP";
  const imageButton = elements.imageUpload.closest(".upload-button");
  const videoButton = elements.videoUpload.closest(".upload-button");
  imageButton?.classList.toggle("is-muted", video);
  videoButton?.classList.toggle("is-muted", !video);
  updateEditorAvailability();
}

function setMediaMode(mode, dirty = false) {
  state.mediaMode = mode === "video" ? "video" : "image";
  if (state.mediaMode === "image") elements.inheritVideo.checked = false;
  updateMediaModeUI();
  if (dirty) {
    markDirty();
    renderPreview();
  }
}

function updateExportStatus() {
  const theme = selectedTheme();
  const summary = theme ? state.exports[theme.id] : null;
  const exportable = theme?.kind === "saved";
  if (exportable && summary) {
    elements.exportVersion.value = summary.suggestedVersion;
    elements.exportHistoryNote.textContent = `已导出 ${summary.versions.length} 个版本：${summary.versions.join(", ")}。建议下一版本 ${summary.suggestedVersion}。`;
  } else if (exportable) {
    elements.exportVersion.value = "1.0.0";
    elements.exportHistoryNote.textContent = "该主题尚未导出。分享包会同时通过 Windows 和 macOS 契约复验。";
  } else {
    elements.exportVersion.value = "1.0.0";
    elements.exportHistoryNote.textContent = "仅导出已保存主题；请先保存为新主题，未保存的调校不会进入分享包。";
  }
}

function updateSaveStatus() {
  if (!state.draft) {
    elements.saveStatus.textContent = "选择一个主题开始";
    elements.actionHelp.textContent = "选择主题后可开始调校";
    return;
  }
  const image = state.mediaMode === "video"
    ? "统一封面"
    : state.imageUploadId ? "新图片" : "母版图片";
  const video = state.mediaMode === "video"
    ? state.videoUploadId ? "新视频" : elements.inheritVideo.checked ? "继承视频" : "无视频"
    : "图片模式";
  elements.saveStatus.textContent = state.dirty ? `未保存 / ${image} / ${video}` : `已同步 / ${image} / ${video}`;
  updateActionAvailability();
}

let toastTimer;
function toast(message, isError = false) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", isError);
  elements.toast.classList.add("visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 3200);
}

function markDirty() {
  state.dirty = true;
  updateSaveStatus();
}

function updateRange(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const value = Number(input.value);
  input.style.setProperty("--fill", `${((value - min) / (max - min)) * 100}%`);
  const output = document.querySelector(`[data-output="${input.dataset.path}"]`);
  if (output) output.textContent = value.toFixed(Number(input.step) < 1 ? 2 : 0);
}

function syncInputs() {
  if (!state.draft) return;
  elements.themeName.value = state.draft.name;
  for (const input of document.querySelectorAll("[data-path]")) {
    const value = getPath(state.draft, input.dataset.path);
    if (value === undefined) continue;
    input.value = input.type === "color" ? hexColor(value) : String(value);
    if (input.type === "range") updateRange(input);
  }
  syncEffectInputs();
}

function currentEffect() {
  return state.draft.stateEffects[state.currentState];
}

function syncEffectInputs() {
  const effect = currentEffect();
  elements.effectStateLabel.textContent = state.currentState.toUpperCase();
  elements.effectColor.value = hexColor(effect.color);
  elements.effectMotion.value = effect.motion;
  const controls = [
    [elements.effectOverlay, elements.effectOverlayOutput, effect.overlayOpacity],
    [elements.effectMedia, elements.effectMediaOutput, effect.mediaOpacity],
    [elements.effectBrightness, elements.effectBrightnessOutput, effect.brightness],
    [elements.effectSaturation, elements.effectSaturationOutput, effect.saturation],
    [elements.effectHue, elements.effectHueOutput, effect.hueRotate],
  ];
  for (const [input, output, value] of controls) {
    input.value = String(value);
    const min = Number(input.min);
    const max = Number(input.max);
    input.style.setProperty("--fill", `${((Number(value) - min) / (max - min)) * 100}%`);
    output.textContent = Number(input.step) < 1 ? Number(value).toFixed(2) : String(value);
  }
}

function renderPreview() {
  if (!state.draft) return;
  const theme = selectedTheme();
  const style = elements.previewStage.style;
  style.setProperty("--theme-accent", state.draft.colors.accent);
  style.setProperty("--theme-secondary", state.draft.colors.secondary);
  style.setProperty("--theme-background", state.draft.colors.background);
  style.setProperty("--theme-text", state.draft.colors.text);
  style.setProperty("--image-x", `${state.draft.art.focusX * 100}%`);
  style.setProperty("--image-y", `${state.draft.art.focusY * 100}%`);
  style.setProperty("--image-zoom", state.draft.controls.imageZoom);
  style.setProperty("--image-dim", state.draft.controls.imageDim);
  style.setProperty("--surface-opacity", state.draft.controls.surfaceOpacity);
  style.setProperty("--surface-blur", `${state.draft.controls.surfaceBlur}px`);
  style.setProperty("--surface-radius", `${state.draft.controls.surfaceRadius}px`);
  const effect = currentEffect();
  style.setProperty("--effect-color", effect.color);
  style.setProperty("--effect-overlay", effect.overlayOpacity);
  style.setProperty("--effect-media", effect.mediaOpacity);
  style.setProperty("--effect-brightness", effect.brightness);
  style.setProperty("--effect-saturation", effect.saturation);
  style.setProperty("--effect-contrast", effect.contrast);
  style.setProperty("--effect-hue", `${effect.hueRotate}deg`);
  elements.previewStage.dataset.motion = state.draft.controls.motionLevel;
  elements.previewStage.dataset.effectMotion = effect.motion;
  elements.previewName.textContent = state.draft.name;
  elements.previewStateName.textContent = state.currentState.toUpperCase();
  const videoActive = state.mediaMode === "video"
    && (state.localVideoUrl || (theme?.videoMediaId && elements.inheritVideo.checked));
  elements.previewMode.textContent = `${videoActive ? "VIDEO" : "IMAGE"} / ${state.draft.art.taskMode.toUpperCase()}`;
  elements.previewFingerprint.textContent = theme?.fingerprint ? `ID ${theme.fingerprint.slice(0, 12)}` : "未保存草稿";
}

function setPreviewMedia(theme, preserveLocal = false) {
  if (!preserveLocal) {
    releaseObjectUrl(state.localImageUrl);
    releaseObjectUrl(state.localVideoUrl);
    state.localImageUrl = null;
    state.localVideoUrl = null;
  }
  elements.previewImage.src = state.localImageUrl
    || (state.mediaMode === "video" ? VIDEO_THEME_COVER_URL : mediaUrl(theme.imageMediaId));
  elements.previewVideo.pause();
  elements.previewVideo.removeAttribute("src");
  elements.previewVideo.load();
  const videoSource = state.localVideoUrl || (state.mediaMode === "video"
    && theme.videoMediaId && elements.inheritVideo.checked ? mediaUrl(theme.videoMediaId) : "");
  if (videoSource) {
    elements.previewVideo.src = videoSource;
    elements.previewVideo.load();
    elements.previewVideo.play().catch(() => {});
  }
}

function renderThemeList() {
  elements.themeCount.textContent = String(state.themes.length).padStart(2, "0");
  const queryText = state.themeQuery.trim().toLocaleLowerCase();
  const visibleThemes = state.themes.filter((theme) => {
    const matchesQuery = !queryText || theme.name.toLocaleLowerCase().includes(queryText);
    const matchesFilter = state.themeFilter === "all"
      || (state.themeFilter === "active" && theme.id === state.selectedId)
      || theme.kind === state.themeFilter;
    return matchesQuery && matchesFilter;
  });
  elements.libraryMatch.textContent = `${visibleThemes.length} / ${state.themes.length}`;
  elements.libraryEmpty.hidden = visibleThemes.length > 0;
  elements.themeList.hidden = visibleThemes.length === 0;
  elements.themeList.replaceChildren(...visibleThemes.map((theme) => {
    const card = document.createElement("div");
    card.className = `theme-card${theme.id === state.selectedId ? " selected" : ""}`;
    card.dataset.themeId = theme.id;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-card-main";
    const image = document.createElement("img");
    image.className = "theme-thumb";
    image.src = mediaUrl(theme.imageMediaId);
    image.alt = `${cleanThemeName(theme.name)} 预览`;
    const copy = document.createElement("div");
    const title = document.createElement("b");
    title.textContent = cleanThemeName(theme.name);
    const meta = document.createElement("small");
    meta.textContent = `${kindLabel(theme.kind)} / ${theme.theme.video ? "视频主题 / 统一封面" : "图片背景"}`;
    copy.append(title, meta);
    if (theme.kind === "saved") {
      const badge = document.createElement("span");
      badge.className = "theme-badge";
      badge.textContent = "SAVED";
      title.append(badge);
    }
    const arrow = document.createElement("span");
    arrow.textContent = theme.id === state.selectedId ? "●" : "›";
    button.append(image, copy, arrow);
    button.addEventListener("click", () => selectTheme(theme.id));
    card.append(button);
    if (theme.kind === "saved") {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "theme-delete";
      deleteButton.textContent = "删除";
      deleteButton.title = `删除主题 ${cleanThemeName(theme.name)}`;
      deleteButton.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteTheme(theme.id);
      });
      card.append(deleteButton);
    }
    return card;
  }));
}

function selectTheme(id) {
  const theme = state.themes.find((entry) => entry.id === id);
  if (!theme) return;
  if (state.dirty && state.selectedId !== id && !window.confirm("当前草稿尚未保存，切换主题会丢失这些调校。继续吗？")) return;
  state.selectedId = id;
  loadDraft(theme.theme);
  state.newDraft = false;
  state.imageUploadId = null;
  state.videoUploadId = null;
  state.dirty = false;
  state.mediaMode = theme.videoMediaId ? "video" : "image";
  elements.inheritVideo.checked = state.mediaMode === "video";
  elements.imageUpload.value = "";
  elements.videoUpload.value = "";
  updateMediaModeUI();
  setPreviewMedia(theme);
  renderThemeList();
  syncInputs();
  renderPreview();
  updateSelectionSummary();
  updateSaveStatus();
  updateExportStatus();
  updateActionAvailability();
  updateEditorAvailability();
}

function buildStateStrip() {
  elements.stateStrip.replaceChildren(...STATES.map((name) => {
    const button = document.createElement("button");
    button.type = "button";
     button.className = `state-button${name === state.currentState ? " active" : ""}`;
     button.textContent = STATE_LABELS[name];
     button.dataset.state = name;
     button.setAttribute("role", "tab");
     button.setAttribute("aria-selected", name === state.currentState ? "true" : "false");
     button.addEventListener("click", () => {
       state.currentState = name;
       for (const item of elements.stateStrip.children) {
         const active = item.dataset.state === name;
         item.classList.toggle("active", active);
         item.setAttribute("aria-selected", active ? "true" : "false");
       }
      syncEffectInputs();
      renderPreview();
    });
    return button;
  }));
}

function setEditorTab(tab) {
  state.editorTab = tab;
  for (const button of document.querySelectorAll("[data-editor-tab]")) {
    const active = button.dataset.editorTab === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  }
  for (const section of document.querySelectorAll("[data-section]")) {
    const active = section.dataset.section === tab;
    section.classList.toggle("active", active);
    if (active) {
      section.classList.add("open");
      section.querySelector(".section-title i").textContent = "−";
    }
  }
}

function resetDraft() {
  const theme = selectedTheme();
  if (!theme || !state.draft) return;
  loadDraft(theme.theme);
  state.newDraft = false;
  state.imageUploadId = null;
  state.videoUploadId = null;
  state.dirty = false;
  elements.imageUpload.value = "";
  elements.videoUpload.value = "";
  state.mediaMode = theme.videoMediaId ? "video" : "image";
  elements.inheritVideo.checked = state.mediaMode === "video";
  updateMediaModeUI();
  setPreviewMedia(theme);
  syncInputs();
  renderPreview();
  updateSelectionSummary();
  updateSaveStatus();
  updateActionAvailability();
  toast("草稿已恢复到已保存版本");
}

function createNewDraft() {
  const theme = selectedTheme();
  if (!theme || !state.draft) return;
  if (state.dirty && !window.confirm("当前草稿尚未保存，创建新草稿会丢失这些调校。继续吗？")) return;
  loadDraft(theme.theme);
  state.draft.name = `${cleanThemeName(theme.name)} New Theme`;
  state.newDraft = true;
  state.imageUploadId = null;
  state.videoUploadId = null;
  state.mediaMode = "image";
  state.dirty = true;
  elements.imageUpload.value = "";
  elements.videoUpload.value = "";
  elements.inheritVideo.checked = false;
  updateMediaModeUI();
  setPreviewMedia(theme);
  syncInputs();
  renderPreview();
  updateSelectionSummary();
  updateSaveStatus();
  updateActionAvailability();
  toast("已创建新主题草稿，保存为新主题后加入主题库");
}

function selectedNewThemeType() {
  return elements.newThemeTypeVideo.checked ? "video" : "image";
}

function syncNewThemeFilePicker() {
  const video = selectedNewThemeType() === "video";
  elements.newThemeFile.accept = video ? "video/mp4,video/webm" : "image/png,image/jpeg,image/webp";
  elements.newThemeFileLabel.textContent = video ? "上传视频" : "上传图片";
  elements.newThemeFileHint.textContent = video
    ? "MP4 / WEBM，所有视频主题共用统一封面"
    : "PNG / JPG / WEBP，最大 10 MiB";
  elements.newThemeFile.value = "";
  elements.newThemeError.textContent = "";
}

function openNewThemeDialog() {
  elements.newThemeName.value = "";
  elements.newThemeTypeImage.checked = true;
  syncNewThemeFilePicker();
  elements.newThemeDialog.showModal();
  elements.newThemeName.focus();
}

function closeNewThemeDialog() {
  elements.newThemeDialog.close();
  elements.newThemeError.textContent = "";
}

async function createNewTheme() {
  const source = selectedTheme() ?? state.themes[0];
  const name = elements.newThemeName.value.trim();
  const type = selectedNewThemeType();
  const file = elements.newThemeFile.files[0];
  if (!source) return;
  if (!name) {
    elements.newThemeError.textContent = "请输入主题名称";
    elements.newThemeName.focus();
    return;
  }
  if (!file) {
    elements.newThemeError.textContent = type === "video" ? "请选择一个视频文件" : "请选择一张图片文件";
    return;
  }
  if (state.dirty && !window.confirm("当前草稿尚未保存，创建新主题不会保存这次调校。继续吗？")) return;
  setBusy(true, "正在创建新主题");
  elements.newThemeConfirm.disabled = true;
  try {
    const uploadResult = type === "video"
      ? { videoUpload: await uploadMedia("video", file) }
      : { imageUpload: await uploadMedia("image", file) };
    const defaultTheme = systemDefaultTheme() ?? source;
    const draft = themeToDraft(defaultTheme.theme);
    const optionalFields = optionalFieldsForTheme(defaultTheme.theme);
    draft.name = name;
    const payload = await api("/api/themes", {
      method: "POST",
      body: JSON.stringify({
        sourceId: source.id,
        draft: persistenceDraft(draft, optionalFields),
        preserveOptionalFields: optionalFields,
        imageUploadId: type === "video" ? null : uploadResult.imageUpload.uploadId,
        videoUploadId: type === "video" ? uploadResult.videoUpload.uploadId : null,
        inheritVideo: false,
        mediaMode: type,
      }),
    });
    closeNewThemeDialog();
    state.editorTab = "media";
    setEditorTab("media");
    await refresh(payload.theme.id);
    toast("新主题已创建，已进入编辑器");
  } catch (error) {
    elements.newThemeError.textContent = error.message;
  } finally {
    elements.newThemeConfirm.disabled = false;
    setBusy(false);
  }
}

async function uploadMedia(kind, file) {
  return api(`/api/upload?kind=${kind}`, {
    method: "POST",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
}

async function upload(kind, file) {
  if (kind === "video") {
    const videoUpload = await uploadMedia("video", file);
    state.imageUploadId = null;
    state.videoUploadId = videoUpload.uploadId;
    elements.inheritVideo.checked = false;
    setMediaMode("video");
    releaseObjectUrl(state.localImageUrl);
    state.localImageUrl = VIDEO_THEME_COVER_URL;
    releaseObjectUrl(state.localVideoUrl);
    state.localVideoUrl = URL.createObjectURL(file);
    elements.previewImage.src = state.localImageUrl;
    elements.previewVideo.src = state.localVideoUrl;
    elements.previewVideo.play().catch(() => {});
    markDirty();
    renderPreview();
    toast("视频已校验，将使用统一合规封面；保存后写入主题库");
    return;
  }
  if (state.mediaMode === "video") {
    toast("视频主题使用统一封面，不需要上传照片", true);
    return;
  }
  const result = await uploadMedia("image", file);
  state.imageUploadId = result.uploadId;
  state.videoUploadId = null;
  elements.videoUpload.value = "";
  releaseObjectUrl(state.localVideoUrl);
  state.localVideoUrl = null;
  setMediaMode("image");
  releaseObjectUrl(state.localImageUrl);
  state.localImageUrl = URL.createObjectURL(file);
  elements.previewImage.src = state.localImageUrl;
  markDirty();
  renderPreview();
  toast("图片已校验，保存后写入主题库");
}

async function refresh(selectId = null) {
  const payload = await api("/api/bootstrap");
  state.themes = payload.themes;
  state.paused = payload.paused;
  state.actionsEnabled = payload.app.actionsEnabled;
  state.importEnabled = payload.app.importEnabled === true;
  elements.importThemeButton.hidden = !state.importEnabled;
  state.exports = payload.exports ?? {};
  state.connected = true;
  elements.connectionDot.classList.add("online");
  elements.systemStatus.textContent = payload.paused ? "皮肤已暂停 / 服务在线" : "本地主题引擎在线";
  elements.connectionBanner.hidden = true;
  const active = state.themes.find((theme) => theme.kind === "active");
  const activeSaved = active && state.themes.find((theme) => theme.kind === "saved" && theme.id === active.theme?.id);
  const preferred = selectId && state.themes.some((theme) => theme.id === selectId) ? selectId
    : state.selectedId && state.themes.some((theme) => theme.id === state.selectedId) ? state.selectedId
      : activeSaved?.id ?? state.themes[0]?.id;
  renderThemeList();
  if (preferred) selectTheme(preferred);
  else {
    state.selectedId = null;
    state.draft = null;
    updateSelectionSummary();
    updateSaveStatus();
    updateEditorAvailability();
  }
  updateActionAvailability();
  if (payload.warnings.length) toast(`已忽略 ${payload.warnings.length} 个无效主题`, true);
}

async function importTheme(file) {
  if (!state.importEnabled) return;
  if (!file || !file.name.toLowerCase().endsWith(".zip")) return toast("请选择普通 .zip 主题包", true);
  if (file.size <= 0 || file.size > 32 * 1024 * 1024) return toast("主题 ZIP 必须非空且不超过 32 MiB", true);
  setBusy(true, "正在导入并严格验证主题", elements.importThemeButton);
  try {
    const result = await api("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/zip" },
      body: file,
    });
    await refresh(result.themeId);
    toast(result.status === "Duplicate" ? "该主题已存在，已定位到已保存主题" : "主题已导入到已保存主题库，尚未自动应用");
  } catch (error) {
    toast(error.message, true);
  } finally {
    elements.importThemeFile.value = "";
    setBusy(false);
  }
}

function nextPatchVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return match ? `${match[1]}.${match[2]}.${Number(match[3]) + 1}` : "1.0.0";
}

async function exportTheme() {
  const theme = selectedTheme();
  if (theme?.kind !== "saved") return toast("请先把当前调校保存为新主题", true);
  setBusy(true, "正在构建并复验跨平台分享包");
  try {
    const response = await fetch("/api/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-DreamSkin-Token": token,
      },
      body: JSON.stringify({
        themeId: theme.id,
        version: elements.exportVersion.value.trim(),
        publisherDisplayName: elements.publisherName.value.trim(),
        publisherId: elements.publisherId.value.trim(),
        license: elements.exportLicense.value,
        summary: elements.exportSummary.value.trim(),
        aiGenerated: elements.exportAi.checked,
      }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(failure.error || `HTTP ${response.status}`);
    }
    const archive = await response.blob();
    const disposition = response.headers.get("content-disposition") ?? "";
    const filename = /filename="([A-Za-z0-9._-]+\.zip)"/i.exec(disposition)?.[1] ?? "dream-skin-theme.zip";
    const url = URL.createObjectURL(archive);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    const version = response.headers.get("x-dreamskin-package-version") ?? elements.exportVersion.value;
    const digest = response.headers.get("x-dreamskin-package-sha256") ?? "";
    const summary = state.exports[theme.id] ??= { versions: [], suggestedVersion: "1.0.0" };
    summary.versions = [...new Set([...summary.versions, version])];
    summary.suggestedVersion = nextPatchVersion(version);
    updateExportStatus();
    toast(`分享包已下载 / SHA-256 ${digest.slice(0, 12)}…`);
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}

async function saveTheme(applyAfter) {
  const theme = selectedTheme();
  const updateCurrent = applyAfter && !state.newDraft && theme?.kind === "saved";
  if (applyAfter && !updateCurrent) {
    toast("请先选择已保存主题；内置主题或新建草稿请使用“保存为新主题”", true);
    return;
  }
  setBusy(true, applyAfter ? "正在保存并应用" : "正在保存新主题", applyAfter ? elements.saveApplyButton : elements.saveButton);
  try {
    const payload = await api(updateCurrent ? `/api/themes/${encodeURIComponent(theme.id)}` : "/api/themes", {
      method: updateCurrent ? "PUT" : "POST",
      body: JSON.stringify({
        sourceId: state.selectedId,
        draft: persistenceDraft(state.draft, state.optionalFields),
        preserveOptionalFields: state.optionalFields,
        imageUploadId: state.imageUploadId,
        videoUploadId: state.videoUploadId,
        inheritVideo: state.mediaMode === "video" && elements.inheritVideo.checked,
        mediaMode: state.mediaMode,
      }),
    });
    await refresh(payload.theme.id);
    if (applyAfter) await action("apply", payload.theme.id);
    else toast("新主题已保存，原主题未被覆盖");
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}

async function deleteTheme(themeId = state.selectedId) {
  const theme = state.themes.find((entry) => entry.id === themeId);
  if (theme?.kind !== "saved") return;
  const deletingSelected = theme.id === state.selectedId;
  if (!window.confirm(`确认删除主题“${cleanThemeName(theme.name)}”吗？`)) return;
  setBusy(true, "正在删除主题");
  try {
    await api(`/api/themes/${encodeURIComponent(theme.id)}`, { method: "DELETE" });
    if (deletingSelected) {
      state.selectedId = null;
      state.newDraft = false;
      state.dirty = false;
    }
    await refresh(deletingSelected ? null : state.selectedId);
    toast("主题已从主题库删除");
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}

async function action(name, themeId = state.selectedId) {
  const button = name === "apply" ? elements.applyButton
    : name === "pause" ? elements.pauseButton
      : name === "resume" ? elements.resumeButton
        : name === "start" ? elements.startCodexButton : elements.restoreButton;
  const label = name === "apply" ? "正在应用主题"
    : name === "pause" ? "正在暂停皮肤"
      : name === "resume" ? "正在继续显示"
        : name === "start" ? "正在启动并验证 Codex" : "正在恢复官方外观";
  setBusy(true, label, button);
  try {
    const result = await api("/api/action", { method: "POST", body: JSON.stringify({ action: name, themeId }) });
    toast(result.message || "操作已完成");
    const current = state.selectedId;
    // The native action is the operation being tracked.  A bootstrap refresh
    // is only a best-effort UI sync; it must not keep a completed start/apply
    // button in the loading state when the status endpoint is slow.
    setBusy(false);
    await refresh(current);
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}

for (const section of document.querySelectorAll(".section-title")) {
  section.addEventListener("click", () => {
    const parent = section.closest(".control-section");
    parent.classList.toggle("open");
    section.querySelector("i").textContent = parent.classList.contains("open") ? "−" : "+";
  });
}

for (const tab of document.querySelectorAll("[data-editor-tab]")) {
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-selected", tab.classList.contains("active") ? "true" : "false");
  tab.addEventListener("click", () => setEditorTab(tab.dataset.editorTab));
}

elements.themeSearch.addEventListener("input", () => {
  state.themeQuery = elements.themeSearch.value;
  renderThemeList();
});
for (const filter of document.querySelectorAll("[data-filter]")) {
  filter.addEventListener("click", () => {
    state.themeFilter = filter.dataset.filter;
    for (const item of document.querySelectorAll("[data-filter]")) item.classList.toggle("active", item === filter);
    renderThemeList();
  });
}

for (const input of document.querySelectorAll("[data-path]")) {
  input.addEventListener("input", () => {
    const value = input.type === "range" ? Number(input.value) : input.value;
    setPath(state.draft, input.dataset.path, value);
    const [group] = input.dataset.path.split(".");
    if (group === "colors" || group === "controls") state.optionalFields[group] = false;
    if (input.type === "range") updateRange(input);
    markDirty();
    renderPreview();
  });
}

elements.themeName.addEventListener("input", () => {
  state.draft.name = elements.themeName.value;
  markDirty();
  renderPreview();
});
function changeMediaMode(mode) {
  const theme = selectedTheme();
  if (mode === state.mediaMode) return;
  if (mode === "image") {
    state.videoUploadId = null;
    elements.videoUpload.value = "";
    releaseObjectUrl(state.localVideoUrl);
    state.localVideoUrl = null;
    releaseObjectUrl(state.localImageUrl);
    state.localImageUrl = null;
    elements.inheritVideo.checked = false;
  } else {
    state.imageUploadId = null;
    releaseObjectUrl(state.localImageUrl);
    state.localImageUrl = VIDEO_THEME_COVER_URL;
    elements.inheritVideo.checked = Boolean(state.videoUploadId || theme?.videoMediaId);
  }
  setMediaMode(mode, true);
  if (theme) setPreviewMedia(theme, true);
  renderPreview();
}
elements.mediaModeImage.addEventListener("change", () => changeMediaMode("image"));
elements.mediaModeVideo.addEventListener("change", () => changeMediaMode("video"));
elements.inheritVideo.addEventListener("change", () => {
  if (state.mediaMode !== "video") {
    elements.inheritVideo.checked = false;
    return;
  }
  if (!state.videoUploadId) {
    const theme = selectedTheme();
    elements.previewVideo.pause();
    elements.previewVideo.src = elements.inheritVideo.checked && theme?.videoMediaId ? mediaUrl(theme.videoMediaId) : "";
    elements.previewVideo.load();
    if (elements.previewVideo.src) elements.previewVideo.play().catch(() => {});
  }
  markDirty();
  renderPreview();
});
elements.imageUpload.addEventListener("change", () => elements.imageUpload.files[0] && upload("image", elements.imageUpload.files[0]).catch((error) => toast(error.message, true)));
elements.videoUpload.addEventListener("change", () => elements.videoUpload.files[0] && upload("video", elements.videoUpload.files[0]).catch((error) => toast(error.message, true)));

elements.effectColor.addEventListener("input", () => { currentEffect().color = elements.effectColor.value; markDirty(); renderPreview(); });
elements.effectMotion.addEventListener("input", () => { currentEffect().motion = elements.effectMotion.value; markDirty(); renderPreview(); });
for (const [input, key, output] of [
  [elements.effectOverlay, "overlayOpacity", elements.effectOverlayOutput],
  [elements.effectMedia, "mediaOpacity", elements.effectMediaOutput],
  [elements.effectBrightness, "brightness", elements.effectBrightnessOutput],
  [elements.effectSaturation, "saturation", elements.effectSaturationOutput],
  [elements.effectHue, "hueRotate", elements.effectHueOutput],
]) {
  input.addEventListener("input", () => {
    currentEffect()[key] = Number(input.value);
    const min = Number(input.min);
    const max = Number(input.max);
    input.style.setProperty("--fill", `${((Number(input.value) - min) / (max - min)) * 100}%`);
    output.textContent = Number(input.step) < 1 ? Number(input.value).toFixed(2) : input.value;
    markDirty();
    renderPreview();
  });
}

elements.applyButton.addEventListener("click", () => action("apply"));
elements.pauseButton.addEventListener("click", () => action("pause"));
elements.resumeButton.addEventListener("click", () => action("resume"));
elements.startCodexButton.addEventListener("click", () => action("start", null));
elements.restoreButton.addEventListener("click", () => action("restore", null));
elements.resetButton.addEventListener("click", resetDraft);
elements.newThemeButton.addEventListener("click", openNewThemeDialog);
elements.importThemeButton.addEventListener("click", () => elements.importThemeFile.click());
elements.importThemeFile.addEventListener("change", () => {
  const file = elements.importThemeFile.files[0];
  if (file) importTheme(file);
});
elements.newThemeTypeImage.addEventListener("change", syncNewThemeFilePicker);
elements.newThemeTypeVideo.addEventListener("change", syncNewThemeFilePicker);
elements.newThemeCancel.addEventListener("click", closeNewThemeDialog);
elements.newThemeDialog.querySelector("form").addEventListener("submit", (event) => {
  event.preventDefault();
  createNewTheme();
});
elements.newThemeDialog.addEventListener("cancel", () => elements.newThemeError.textContent = "");
elements.deleteThemeButton.addEventListener("click", deleteTheme);
elements.saveButton.addEventListener("click", () => saveTheme(false));
elements.exportButton.addEventListener("click", exportTheme);
elements.saveApplyButton.addEventListener("click", () => saveTheme(true));
elements.retryButton.addEventListener("click", () => refresh().catch((error) => {
  elements.connectionMessage.textContent = error.message;
  toast(error.message, true);
}));

window.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
    event.preventDefault();
    elements.themeSearch.focus();
  }
});
window.addEventListener("beforeunload", (event) => {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = "";
});

buildStateStrip();
setEditorTab("media");
updateMediaModeUI();
updateSelectionSummary();
updateActionAvailability();
updateEditorAvailability();
refresh().catch((error) => {
  state.connected = false;
  elements.connectionDot.classList.remove("online");
  elements.systemStatus.textContent = "本地服务连接失败";
  elements.connectionMessage.textContent = error.message;
  elements.connectionBanner.hidden = false;
  updateActionAvailability();
  updateEditorAvailability();
  toast(error.message, true);
});
