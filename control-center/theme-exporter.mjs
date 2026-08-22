import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { validateThemePackageDirectory } from "../runtime/theme-package-validator.mjs";
import { createZip } from "./zip-writer.mjs";

const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const PUBLISHER_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SAVED_THEME_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const PACKAGE_THEME_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const CONTROL = /[\u0000-\u001f\u007f]/u;
const PROVENANCE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const LICENSES = new Set(["CC0-1.0", "CC-BY-4.0", "MIT", "All-Rights-Reserved"]);
const MEDIA_TYPES = new Map([
  ["theme.json", "application/json"],
  ["background.png", "image/png"],
  ["background.jpg", "image/jpeg"],
  ["background.webp", "image/webp"],
  ["background.mp4", "video/mp4"],
  ["background.webm", "video/webm"],
  ["theme.css", "text/css"],
  ["LICENSE.txt", "text/plain"],
]);

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function safeText(value, fallback, max, label, controls = CONTROL) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string" || controls.test(value) || Array.from(value).length > max) fail(`${label} is invalid`);
  return value.trim() || fallback;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function licenseText(license, publisher, year) {
  if (license === "MIT") {
    return `SPDX-License-Identifier: MIT\n\nCopyright (c) ${year} ${publisher}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this theme and associated files (the "Theme"), to deal in the Theme without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Theme, and to permit persons to whom the Theme is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Theme.\n\nTHE THEME IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE THEME OR THE USE OR OTHER DEALINGS IN THE THEME.\n`;
  }
  if (license === "CC0-1.0") {
    return `SPDX-License-Identifier: CC0-1.0\nPublisher: ${publisher}\nThe publisher applies CC0 1.0 Universal to this theme.\nhttps://creativecommons.org/publicdomain/zero/1.0/legalcode\n`;
  }
  if (license === "CC-BY-4.0") {
    return `SPDX-License-Identifier: CC-BY-4.0\nAttribution: ${publisher}\nThis theme is licensed under Creative Commons Attribution 4.0 International.\nhttps://creativecommons.org/licenses/by/4.0/legalcode\n`;
  }
  return `Copyright (c) ${year} ${publisher}. All rights reserved.\nRedistribution, modification, or public sharing requires explicit permission from the publisher.\n`;
}

function packageThemeId(sourceId) {
  let id = String(sourceId).toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .replace(/[.-]{2,}/g, "-");
  if (id.length < 3) id = `theme-${sha256(Buffer.from(String(sourceId))).slice(0, 12)}`;
  if (id.length > 64) id = `${id.slice(0, 47).replace(/[.-]+$/g, "")}-${sha256(Buffer.from(id)).slice(0, 12)}`;
  return id;
}

function publisherId(value, displayName) {
  if (value !== undefined && value !== "") {
    if (typeof value !== "string" || !PUBLISHER_ID.test(value)) fail("publisherId is invalid");
    return value;
  }
  const generated = displayName.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
  return generated || "local-creator";
}

function imageName(file) {
  const extension = path.extname(file).toLowerCase();
  if (extension === ".jpeg" || extension === ".jpg") return "background.jpg";
  if (extension === ".png") return "background.png";
  if (extension === ".webp") return "background.webp";
  fail("Saved theme image format cannot be exported", 409);
}

function videoName(file) {
  const extension = path.extname(file).toLowerCase();
  if (extension === ".mp4") return "background.mp4";
  if (extension === ".webm") return "background.webm";
  fail("Saved theme video format cannot be exported", 409);
}

function publicTheme(entry, id, image, video) {
  const source = entry.theme;
  const art = source.art ?? {};
  const result = {
    schemaVersion: 1,
    id,
    name: safeText(source.name, "Dream Skin Theme", 80, "theme name"),
    image,
    appearance: new Set(["auto", "light", "dark"]).has(source.appearance) ? source.appearance : "auto",
    art: {
      focusX: typeof art.focusX === "number" ? art.focusX : 0.5,
      focusY: typeof art.focusY === "number" ? art.focusY : 0.5,
      safeArea: new Set(["left", "right", "none"]).has(art.safeArea) ? art.safeArea : "none",
      taskMode: new Set(["ambient", "full", "off"]).has(art.taskMode) ? art.taskMode : "ambient",
    },
    colors: source.colors,
  };
  for (const key of [
    "brandSubtitle", "tagline", "projectPrefix", "projectLabel", "statusText", "quote", "promoTitle", "promoSub",
  ]) {
    if (typeof source[key] === "string" && source[key]) result[key] = safeText(source[key], "", 120, key);
  }
  if (source.stateEffects) result.stateEffects = source.stateEffects;
  if (source.controls) result.controls = source.controls;
  if (video) result.video = { src: video, poster: image, performance: source.video?.performance ?? "balanced" };
  return result;
}

function manifestEntry(name, bytes) {
  return { path: name, mediaType: MEDIA_TYPES.get(name), bytes: bytes.length, sha256: sha256(bytes) };
}

function nextPatch(versions) {
  if (!versions.length) return "1.0.0";
  const sorted = versions.filter((version) => SEMVER.test(version)).sort((left, right) => {
    const a = left.split(".").map(Number);
    const b = right.split(".").map(Number);
    return b[0] - a[0] || b[1] - a[1] || b[2] - a[2];
  });
  if (!sorted.length) return "1.0.0";
  const parts = sorted[0].split(".").map(Number);
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

export class ThemeExporter {
  constructor({ stateRoot, store, clientVersion }) {
    this.stateRoot = path.resolve(stateRoot);
    this.store = store;
    this.clientVersion = clientVersion;
    this.historyPath = path.join(this.stateRoot, "export-history.json");
    this.queue = Promise.resolve();
  }

  async readHistory() {
    try {
      const stat = await fs.lstat(this.historyPath);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 256 * 1024) fail("Export history is invalid", 409);
      const parsed = JSON.parse(await fs.readFile(this.historyPath, "utf8"));
      if (parsed?.schema !== "dreamskin-export-history/1" || !Array.isArray(parsed.exports) || parsed.exports.length > 200) {
        throw new Error();
      }
      for (const item of parsed.exports) {
        if (!item || typeof item !== "object" || !SAVED_THEME_ID.test(item.sourceId)
          || !PACKAGE_THEME_ID.test(item.themeId) || !SEMVER.test(item.version)
          || typeof item.packageSha256 !== "string" || !/^[0-9a-f]{64}$/.test(item.packageSha256)
          || !Number.isSafeInteger(item.packageBytes) || item.packageBytes < 1 || item.packageBytes > 32 * 1024 * 1024
          || !Number.isFinite(Date.parse(item.createdAt))) throw new Error();
      }
      return parsed.exports.slice(-200);
    } catch (error) {
      if (error.code === "ENOENT") return [];
      if (error.status) throw error;
      fail("Export history is invalid", 409);
    }
  }

  async summaries() {
    const history = await this.readHistory();
    const byTheme = Object.create(null);
    for (const item of history) {
      if (!item || typeof item.themeId !== "string" || !SEMVER.test(item.version)) continue;
      const values = byTheme[item.sourceId] ??= [];
      values.push(item.version);
    }
    return Object.fromEntries(Object.entries(byTheme).map(([id, versions]) => [id, {
      versions: [...new Set(versions)],
      suggestedVersion: nextPatch(versions),
    }]));
  }

  async writeHistory(exports) {
    const temporary = `${this.historyPath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify({ schema: "dreamskin-export-history/1", exports: exports.slice(-200) }, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temporary, this.historyPath);
  }

  exportPackage(options) {
    const operation = this.queue.then(() => this.buildPackage(options));
    this.queue = operation.catch(() => {});
    return operation;
  }

  async buildPackage(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) fail("Export options must be an object");
    const snapshot = await this.store.list();
    const entry = snapshot.themes.find((theme) => theme.id === options.themeId && theme.kind === "saved");
    if (!entry) fail("Only a saved theme can be exported", 404);
    const version = safeText(options.version, "", 32, "version");
    if (!SEMVER.test(version)) fail("version must be semantic x.y.z without prefixes");
    const displayName = safeText(options.publisherDisplayName, "Local Creator", 80, "publisherDisplayName");
    const publisher = { id: publisherId(options.publisherId, displayName), displayName };
    const license = safeText(options.license, "All-Rights-Reserved", 64, "license");
    if (!LICENSES.has(license)) fail("license is unsupported");
    const summary = safeText(
      options.summary,
      "Theme exported from Codex-Skin Control Center.",
      500,
      "summary",
      PROVENANCE_CONTROL,
    );
    if (options.aiGenerated !== undefined && typeof options.aiGenerated !== "boolean") fail("aiGenerated must be boolean");
    const history = await this.readHistory();
    if (history.some((item) => item.sourceId === entry.id && item.version === version)) {
      fail(`Version ${version} was already exported for this theme`, 409);
    }

    const id = packageThemeId(entry.theme.id || entry.id);
    const image = imageName(entry._imagePath);
    const video = entry._videoPath ? videoName(entry._videoPath) : null;
    const [imageBytes, videoBytes, cssBytes] = await Promise.all([
      fs.readFile(entry._imagePath),
      entry._videoPath ? fs.readFile(entry._videoPath) : null,
      entry.safeCssPath ? fs.readFile(entry.safeCssPath) : null,
    ]);
    if (!cssBytes) fail("Saved theme must contain validated Safe CSS before export", 409);
    const themeBytes = jsonBytes(publicTheme(entry, id, image, video));
    const createdAt = new Date().toISOString();
    const licenseBytes = Buffer.from(licenseText(license, publisher.displayName, new Date(createdAt).getUTCFullYear()), "utf8");
    const payload = new Map([
      ["theme.json", themeBytes],
      [image, imageBytes],
      ...(video ? [[video, videoBytes]] : []),
      ["theme.css", cssBytes],
      ["LICENSE.txt", licenseBytes],
    ]);
    const capabilities = ["background", "tokens", "safe-css", ...(video ? ["video"] : [])];
    const manifest = {
      packageVersion: 1,
      themeId: id,
      version,
      skinApiVersion: 1,
      minClientVersion: this.clientVersion,
      platforms: ["macos", "windows"],
      capabilities,
      publisher,
      license,
      provenance: { aiGenerated: options.aiGenerated ?? false, summary },
      files: [...payload].map(([name, bytes]) => manifestEntry(name, bytes)),
      createdAt,
    };
    const entries = [{ name: "manifest.json", bytes: jsonBytes(manifest) }, ...[...payload].map(([name, bytes]) => ({ name, bytes }))];
    const work = path.join(this.stateRoot, `.control-center-export-${randomBytes(12).toString("hex")}`);
    const source = path.join(work, "source");
    const windowsStage = path.join(work, "windows");
    const macosStage = path.join(work, "macos");
    await fs.mkdir(work);
    await Promise.all([fs.mkdir(source), fs.mkdir(windowsStage), fs.mkdir(macosStage)]);
    try {
      await Promise.all(entries.map(({ name, bytes }) => fs.writeFile(path.join(source, name), bytes, { flag: "wx" })));
      const [windowsValidation, macosValidation] = await Promise.all([
        validateThemePackageDirectory({ source, stage: windowsStage, platform: "windows", clientVersion: this.clientVersion }),
        validateThemePackageDirectory({ source, stage: macosStage, platform: "macos", clientVersion: this.clientVersion }),
      ]);
      const archive = createZip(entries, { timestamp: createdAt });
      const packageSha256 = sha256(archive);
      const record = {
        sourceId: entry.id,
        themeId: id,
        name: entry.name,
        version,
        publisher,
        license,
        aiGenerated: options.aiGenerated ?? false,
        packageBytes: archive.length,
        packageSha256,
        createdAt,
      };
      await this.writeHistory([...history, record]);
      return {
        archive,
        filename: `${id}-v${version}.zip`,
        record,
        validation: { windows: windowsValidation, macos: macosValidation },
      };
    } finally {
      await fs.rm(work, { recursive: true, force: true });
    }
  }
}
