import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  detectedVideoMedia,
  normalizeThemeControls,
  normalizeThemeStateEffects,
  normalizeThemeVideo,
} from "../runtime/theme-package-validator.mjs";
import { readImageMetadata } from "../runtime/image-metadata.mjs";
import { decodeAndValidateSafeCss } from "../runtime/safe-css-validator.mjs";
import { loadTheme } from "../windows/scripts/injector.mjs";

const MAX_THEME_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 32 * 1024 * 1024;
const THEME_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([^\r\n()]{1,80}\))$/;
const CONTROL = /[\u0000-\u001f\u007f]/u;
const DEFAULT_SAFE_CSS = '[data-ds-part="root"] { color: var(--ds-theme-color-text); }\n';
const APPEARANCES = new Set(["auto", "light", "dark"]);
const SAFE_AREAS = new Set(["left", "right", "none"]);
const TASK_MODES = new Set(["ambient", "full", "off"]);

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function boundedNumber(value, min, max, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    fail(`${label} must be between ${min} and ${max}`);
  }
  return value;
}

function text(value, fallback, max, label) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string" || CONTROL.test(value) || Array.from(value).length > max) {
    fail(`${label} is invalid`);
  }
  return value.trim() || fallback;
}

function color(value, fallback, label) {
  const normalized = text(value, fallback, 96, label);
  if (!COLOR.test(normalized)) fail(`${label} is not a supported color`);
  return normalized;
}

function isInside(candidate, root) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function realDirectory(directory, root, label) {
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail(`${label} is not a real directory`, 409);
  const resolved = await fs.realpath(directory);
  if (root && !isInside(resolved, await fs.realpath(root))) fail(`${label} escaped its root`, 409);
  return resolved;
}

async function readRegular(file, maxBytes, label) {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > maxBytes) {
    fail(`${label} is missing or exceeds its size limit`, 409);
  }
  const bytes = await fs.readFile(file);
  if (bytes.length !== stat.size) fail(`${label} changed while being read`, 409);
  return bytes;
}

function imageType(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    return { extension: ".png", mediaType: "image/png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: ".jpg", mediaType: "image/jpeg" };
  }
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString() === "RIFF"
    && bytes.subarray(8, 12).toString() === "WEBP") {
    return { extension: ".webp", mediaType: "image/webp" };
  }
  return null;
}

export function validateUploadedMedia(kind, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  if (kind === "image") {
    if (bytes.length < 1 || bytes.length > MAX_IMAGE_BYTES) fail("Image must be between 1 byte and 10 MiB");
    const type = imageType(bytes);
    if (!type || !readImageMetadata(bytes, type.extension)) fail("Image is invalid, too large, or unsupported");
    return { kind, bytes, ...type };
  }
  if (kind === "video") {
    if (bytes.length < 1 || bytes.length > MAX_VIDEO_BYTES) fail("Video must be between 1 byte and 32 MiB");
    const mediaType = detectedVideoMedia(bytes);
    if (!mediaType) fail("Video must be MP4 or WebM");
    return {
      kind,
      bytes,
      mediaType,
      extension: mediaType === "video/mp4" ? ".mp4" : ".webm",
    };
  }
  fail("Unknown media kind");
}

function makeId(name) {
  const slug = name.toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 38);
  return `custom-${slug || "theme"}-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

function normalizeOptionalFields(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("preserveOptionalFields must be an object");
  }
  const allowed = new Set(["colors", "controls"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    fail("preserveOptionalFields contains an unsupported field");
  }
  for (const key of allowed) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") {
      fail(`preserveOptionalFields.${key} must be boolean`);
    }
  }
  return value;
}

function normalizedDraft(value, fallbackTheme, preserveOptionalFields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Theme draft must be an object");
  const optionalFields = normalizeOptionalFields(preserveOptionalFields);
  const name = text(value.name, "Untitled Theme", 80, "name");
  const appearance = value.appearance ?? fallbackTheme.appearance ?? "auto";
  if (!APPEARANCES.has(appearance)) fail("appearance is unsupported");
  const artValue = value.art && typeof value.art === "object" ? value.art : {};
  const safeArea = artValue.safeArea ?? fallbackTheme.art?.safeArea ?? "none";
  const taskMode = artValue.taskMode ?? fallbackTheme.art?.taskMode ?? "ambient";
  if (!SAFE_AREAS.has(safeArea)) fail("art.safeArea is unsupported");
  if (!TASK_MODES.has(taskMode)) fail("art.taskMode is unsupported");
  const fallbackColors = fallbackTheme.colors ?? {};
  const values = value.colors && typeof value.colors === "object" ? value.colors : {};
  const colors = optionalFields.colors && value.colors === undefined ? undefined : {
    background: color(values.background, fallbackColors.background ?? "#071116", "colors.background"),
    panel: color(values.panel, fallbackColors.panel ?? "#0b1a20", "colors.panel"),
    panelAlt: color(values.panelAlt, fallbackColors.panelAlt ?? "#10272c", "colors.panelAlt"),
    accent: color(values.accent, fallbackColors.accent ?? "#7cff46", "colors.accent"),
    accentAlt: color(values.accentAlt, fallbackColors.accentAlt ?? "#b8ff3d", "colors.accentAlt"),
    secondary: color(values.secondary, fallbackColors.secondary ?? "#36d7e8", "colors.secondary"),
    highlight: color(values.highlight, fallbackColors.highlight ?? "#642a8c", "colors.highlight"),
    text: color(values.text, fallbackColors.text ?? "#e9fff1", "colors.text"),
    muted: color(values.muted, fallbackColors.muted ?? "#9ebdb3", "colors.muted"),
    line: color(values.line, fallbackColors.line ?? "rgba(124, 255, 70, .28)", "colors.line"),
  };
  const controls = optionalFields.controls && value.controls === undefined
    ? undefined
    : normalizeThemeControls(value.controls ?? fallbackTheme.controls ?? {});
  return {
    name,
    appearance,
    art: {
      focusX: boundedNumber(artValue.focusX ?? fallbackTheme.art?.focusX ?? 0.5, 0, 1, "art.focusX"),
      focusY: boundedNumber(artValue.focusY ?? fallbackTheme.art?.focusY ?? 0.5, 0, 1, "art.focusY"),
      safeArea,
      taskMode,
    },
    ...(colors ? { colors } : {}),
    ...(controls ? { controls } : {}),
    stateEffects: normalizeThemeStateEffects(value.stateEffects ?? fallbackTheme.stateEffects ?? {}),
    videoPerformance: value.videoPerformance ?? fallbackTheme.video?.performance ?? "balanced",
  };
}

async function safeCssFor(source) {
  if (!source?.safeCssPath) {
    decodeAndValidateSafeCss(Buffer.from(DEFAULT_SAFE_CSS));
    return Buffer.from(DEFAULT_SAFE_CSS);
  }
  const bytes = await readRegular(source.safeCssPath, 256 * 1024, "Theme Safe CSS");
  decodeAndValidateSafeCss(bytes);
  return bytes;
}

export class ThemeStore {
  constructor({ stateRoot, bundledThemeRoot }) {
    this.stateRoot = path.resolve(stateRoot);
    this.savedRoot = path.join(this.stateRoot, "themes");
    this.activeRoot = path.join(this.stateRoot, "active-theme");
    this.pauseFile = path.join(this.stateRoot, "paused");
    this.bundledThemeRoot = path.resolve(bundledThemeRoot);
  }

  async initialize() {
    await fs.mkdir(this.savedRoot, { recursive: true });
    await realDirectory(this.stateRoot, null, "State root");
    await realDirectory(this.savedRoot, this.stateRoot, "Saved themes root");
  }

  async loadEntry(directory, id, kind, root = null) {
    const resolved = await realDirectory(directory, root, `Theme ${id}`);
    const rawBytes = await readRegular(path.join(resolved, "theme.json"), MAX_THEME_BYTES, "theme.json");
    let raw;
    try { raw = JSON.parse(rawBytes.toString("utf8")); } catch { fail(`Theme ${id} has invalid JSON`, 409); }
    const loaded = await loadTheme(resolved);
    const videoName = typeof raw.video?.src === "string" ? raw.video.src : null;
    const videoPath = loaded.theme.video?.src ? fileURLToPath(loaded.theme.video.src) : null;
    return {
      id,
      kind,
      name: loaded.theme.name,
      theme: {
        ...loaded.theme,
        ...(videoName ? { video: { src: videoName, performance: loaded.theme.video.performance } } : {}),
      },
      fingerprint: loaded.fingerprint,
      _directory: resolved,
      _imagePath: loaded.imagePath,
      _videoPath: videoPath,
      safeCssPath: loaded.safeCssPath,
    };
  }

  async list() {
    await this.initialize();
    const themes = [];
    const warnings = [];
    let active = null;
    try {
      active = await this.loadEntry(this.activeRoot, "active", "active", this.stateRoot);
      themes.push(active);
    } catch (error) {
      if (error.code !== "ENOENT") warnings.push(`Active theme: ${error.message}`);
    }
    if (!active) {
      try {
        active = await this.loadEntry(this.bundledThemeRoot, "bundled", "bundled");
        themes.push(active);
      } catch (error) {
        warnings.push(`Bundled theme: ${error.message}`);
      }
    }
    const entries = await fs.readdir(this.savedRoot, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || !THEME_ID.test(entry.name)) continue;
      try {
        themes.push(await this.loadEntry(path.join(this.savedRoot, entry.name), entry.name, "saved", this.savedRoot));
      } catch (error) {
        warnings.push(`${entry.name}: ${error.message}`);
      }
    }
    return { themes, warnings, paused: await fs.access(this.pauseFile).then(() => true, () => false) };
  }

  async save({ draft, sourceId, preserveOptionalFields, imageUpload, videoUpload, inheritVideo = true, mediaMode, updateId = null }) {
    const snapshot = await this.list();
    const source = updateId
      ? snapshot.themes.find((entry) => entry.id === updateId && entry.kind === "saved")
      : snapshot.themes.find((entry) => entry.id === sourceId) ?? snapshot.themes[0];
    if (!source) fail("No valid source theme is available", 409);
    if (updateId && source.id !== updateId) fail("Saved theme not found", 404);
    const normalized = normalizedDraft(draft, source.theme, preserveOptionalFields);
    if (!new Set(["eco", "balanced", "immersive"]).has(normalized.videoPerformance)) {
      fail("videoPerformance is unsupported");
    }
    const selectedMediaMode = mediaMode ?? (videoUpload || (inheritVideo && source._videoPath) ? "video" : "image");
    if (!["image", "video"].includes(selectedMediaMode)) fail("mediaMode must be image or video");
    const image = imageUpload ?? validateUploadedMedia(
      "image",
      await readRegular(source._imagePath, MAX_IMAGE_BYTES, "Source image"),
    );
    let video = selectedMediaMode === "video" ? videoUpload ?? null : null;
    if (!video && selectedMediaMode === "video" && inheritVideo && source._videoPath) {
      video = validateUploadedMedia(
        "video",
        await readRegular(source._videoPath, MAX_VIDEO_BYTES, "Source video"),
      );
    }
    if (selectedMediaMode === "video" && !video) fail("Video mode requires a video upload or inherited video");
    const id = updateId ?? makeId(normalized.name);
    if (!THEME_ID.test(id)) fail("Generated theme id is invalid", 500);
    const imageName = `background${image.extension}`;
    const videoName = video ? `background${video.extension}` : null;
    const theme = {
      schemaVersion: 1,
      id,
      name: normalized.name,
      brandSubtitle: "CODEX DREAM SKIN",
      tagline: "Visual theme created in Control Center.",
      image: imageName,
      appearance: normalized.appearance,
      art: normalized.art,
      ...(normalized.colors ? { colors: normalized.colors } : {}),
      ...(normalized.controls ? { controls: normalized.controls } : {}),
      stateEffects: normalized.stateEffects,
      ...(video ? { video: { src: videoName, performance: normalized.videoPerformance } } : {}),
    };
    const stage = path.join(this.savedRoot, `.control-center-${randomBytes(12).toString("hex")}`);
    const destination = path.join(this.savedRoot, id);
    await fs.mkdir(stage, { mode: 0o700 });
    try {
      await Promise.all([
        fs.writeFile(path.join(stage, "theme.json"), `${JSON.stringify(theme, null, 2)}\n`, { flag: "wx" }),
        fs.writeFile(path.join(stage, imageName), image.bytes, { flag: "wx" }),
        fs.writeFile(path.join(stage, "theme.css"), await safeCssFor(source), { flag: "wx" }),
        ...(video ? [fs.writeFile(path.join(stage, videoName), video.bytes, { flag: "wx" })] : []),
      ]);
      await loadTheme(stage);
    } catch (error) {
      await fs.rm(stage, { recursive: true, force: true });
      throw error;
    }
    if (updateId) {
      await realDirectory(destination, this.savedRoot, `Theme ${id}`);
      const backup = path.join(this.savedRoot, `.control-center-replace-${randomBytes(12).toString("hex")}`);
      let moved = false;
      try {
        await fs.rename(destination, backup);
        moved = true;
        await fs.rename(stage, destination);
        await fs.rm(backup, { recursive: true, force: true });
      } catch (error) {
        await fs.rm(stage, { recursive: true, force: true });
        if (moved) {
          await fs.rm(destination, { recursive: true, force: true }).catch(() => {});
          await fs.rename(backup, destination).catch(() => {});
        }
        throw error;
      }
    } else {
      await fs.rename(stage, path.join(this.savedRoot, id));
    }
    return this.loadEntry(destination, id, "saved", this.savedRoot);
  }

  async remove(id) {
    if (!THEME_ID.test(id)) fail("Theme id is invalid");
    const snapshot = await this.list();
    const entry = snapshot.themes.find((theme) => theme.id === id && theme.kind === "saved");
    if (!entry) fail("Saved theme not found", 404);
    const destination = await realDirectory(path.join(this.savedRoot, id), this.savedRoot, `Theme ${id}`);
    const tombstone = path.join(this.savedRoot, `.control-center-delete-${randomBytes(12).toString("hex")}`);
    await fs.rename(destination, tombstone);
    try {
      await fs.rm(tombstone, { recursive: true, force: true });
    } catch (error) {
      await fs.rename(tombstone, destination).catch(() => {});
      throw error;
    }
    return entry;
  }
}
