#!/usr/bin/env node

import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { ThemeExporter } from "./theme-exporter.mjs";
import { ThemeStore, validateUploadedMedia } from "./theme-store.mjs";

const execFileAsync = promisify(execFile);
const moduleRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleRoot, "..");
const publicRoot = path.join(moduleRoot, "public");
const STATIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
]);
const SECURITY_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
});
const WINDOWS_ACTION_TIMEOUT_MS = 120_000;

function defaultStateRoot(platform = process.platform) {
  if (platform === "win32") {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "CodexDreamSkin");
  }
  return path.join(os.homedir(), "Library", "Application Support", "CodexDreamSkinStudio");
}

function response(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

function requestCookie(req, name) {
  const prefix = `${name}=`;
  for (const part of String(req.headers.cookie ?? "").split(";")) {
    const value = part.trim();
    if (value.startsWith(prefix)) return value.slice(prefix.length);
  }
  return "";
}

function json(res, status, value) {
  response(res, status, `${JSON.stringify(value)}\n`, { "Content-Type": "application/json; charset=utf-8" });
}

function errorStatus(error) {
  return Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
    ? error.status : 500;
}

async function readBody(req, maxBytes) {
  const declared = Number(req.headers["content-length"] ?? 0);
  if (declared > maxBytes) {
    const error = new Error("Request body exceeds its size limit");
    error.status = 413;
    throw error;
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      const error = new Error("Request body exceeds its size limit");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

async function readJson(req) {
  const bytes = await readBody(req, 1024 * 1024);
  try {
    const value = JSON.parse(bytes.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    const error = new Error("Request body must be a JSON object");
    error.status = 400;
    throw error;
  }
}

function publicTheme(entry, mediaIds) {
  return {
    id: entry.id,
    kind: entry.kind,
    name: entry.name,
    fingerprint: entry.fingerprint,
    theme: entry.theme,
    imageMediaId: mediaIds.get(entry._imagePath) ?? null,
    videoMediaId: entry._videoPath ? mediaIds.get(entry._videoPath) ?? null : null,
  };
}

async function runWindowsAction({ action, themeId, stateRoot }) {
  const script = path.join(projectRoot, "windows", "scripts", "control-center-action.ps1");
  const args = [
    "-NoProfile",
    "-ExecutionPolicy", "RemoteSigned",
    "-File", script,
    "-Action", action,
    "-StateRoot", stateRoot,
  ];
  if (themeId) args.push("-ThemeId", themeId);
  try {
    const { stdout } = await execFileAsync("powershell.exe", args, {
      cwd: projectRoot,
      encoding: "utf8",
      timeout: WINDOWS_ACTION_TIMEOUT_MS,
      windowsHide: true,
    });
    const line = stdout.trim().split(/\r?\n/u).filter(Boolean).at(-1);
    return line ? JSON.parse(line) : { ok: true, action };
  } catch (error) {
    const raw = [error?.stderr, error?.stdout, error?.message]
      .filter(Boolean)
      .join("\n");
    const timedOut = error?.code === "ETIMEDOUT" || error?.killed || error?.signal === "SIGTERM";
    const message = timedOut
      ? "Windows 主题操作超过 120 秒未完成，请检查 Codex 会话后重试。"
      : /Node\.js \d+ or newer is required/i.test(raw)
        ? "需要 Node.js 22 或更高版本，请重新打开控制中心后重试。"
        : /access to the path|access is denied/i.test(raw)
          ? "无法写入活动主题文件，可能有其他主题操作正在占用；请稍后重试。"
          : "Windows 主题操作失败，请稍后重试。";
    throw Object.assign(new Error(message), {
      status: timedOut ? 504 : 500,
      publicMessage: message,
      cause: error,
    });
  }
}

async function writeStateFile(stateFile, state) {
  if (!stateFile) return;
  const resolved = path.resolve(stateFile);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  const temporary = `${resolved}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(temporary, resolved);
}

export async function createControlCenter(options = {}) {
  const platform = options.platform ?? process.platform;
  const host = "127.0.0.1";
  const port = Number.isInteger(options.port) ? options.port : 0;
  const token = options.token ?? randomBytes(24).toString("base64url");
  const stateRoot = path.resolve(options.stateRoot ?? defaultStateRoot(platform));
  const store = new ThemeStore({
    stateRoot,
    bundledThemeRoot: options.bundledThemeRoot ?? path.join(projectRoot, "windows", "assets"),
  });
  const clientVersion = options.clientVersion
    ?? (await fs.readFile(path.join(projectRoot, "windows", "VERSION"), "utf8")).trim();
  const exporter = new ThemeExporter({ stateRoot, store, clientVersion });
  const uploads = new Map();
  const media = new Map();
  const mediaIds = new Map();
  const allowActions = options.allowActions ?? true;
  const actionRunner = options.actionRunner ?? runWindowsAction;
  let origin = "";

  function authorize(req, mutating = false) {
    const presentedToken = req.headers["x-dreamskin-token"] || requestCookie(req, "dream_skin_control_token");
    if (presentedToken !== token) return false;
    if (mutating && req.headers.origin !== origin) return false;
    return true;
  }

  function registerMedia(file) {
    if (!file) return null;
    if (mediaIds.has(file)) return mediaIds.get(file);
    const id = randomBytes(18).toString("base64url");
    media.set(id, file);
    mediaIds.set(file, id);
    return id;
  }

  async function bootstrap(res) {
    media.clear();
    mediaIds.clear();
    const snapshot = await store.list();
    for (const entry of snapshot.themes) {
      registerMedia(entry._imagePath);
      registerMedia(entry._videoPath);
    }
    json(res, 200, {
      app: { version: "1.1.0", platform, stateRoot, clientVersion, actionsEnabled: allowActions && platform === "win32" },
      paused: snapshot.paused,
      warnings: snapshot.warnings,
      themes: snapshot.themes.map((entry) => publicTheme(entry, mediaIds)),
      exports: await exporter.summaries(),
    });
  }

  async function serveMedia(req, res, id) {
    const file = media.get(id);
    if (!file) return json(res, 404, { error: "Media handle expired; refresh the theme library" });
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) return json(res, 404, { error: "Media is unavailable" });
    const extension = path.extname(file).toLowerCase();
    const type = extension === ".png" ? "image/png"
      : extension === ".webp" ? "image/webp"
        : extension === ".mp4" ? "video/mp4"
          : extension === ".webm" ? "video/webm" : "image/jpeg";
    const range = req.headers.range;
    if (range && type.startsWith("video/")) {
      const match = /^bytes=(\d*)-(\d*)$/u.exec(range);
      if (!match) return response(res, 416, "", { "Content-Range": `bytes */${stat.size}` });
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= stat.size) {
        return response(res, 416, "", { "Content-Range": `bytes */${stat.size}` });
      }
      const handle = await fs.open(file, "r");
      try {
        const bytes = Buffer.alloc(end - start + 1);
        await handle.read(bytes, 0, bytes.length, start);
        return response(res, 206, bytes, {
          "Accept-Ranges": "bytes",
          "Content-Length": String(bytes.length),
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Content-Type": type,
        });
      } finally {
        await handle.close();
      }
    }
    return response(res, 200, await fs.readFile(file), {
      "Accept-Ranges": type.startsWith("video/") ? "bytes" : "none",
      "Content-Length": String(stat.size),
      "Content-Type": type,
    });
  }

  async function saveTheme(body, updateId = null) {
    const imageUpload = body.imageUploadId ? uploads.get(body.imageUploadId) : null;
    const videoUpload = body.videoUploadId ? uploads.get(body.videoUploadId) : null;
    if (body.imageUploadId && imageUpload?.kind !== "image") throw Object.assign(new Error("Image upload expired"), { status: 400 });
    if (body.videoUploadId && videoUpload?.kind !== "video") throw Object.assign(new Error("Video upload expired"), { status: 400 });
    const saved = await store.save({
      draft: body.draft,
      sourceId: updateId ?? body.sourceId,
      imageUpload,
      videoUpload,
      inheritVideo: body.inheritVideo !== false,
      mediaMode: body.mediaMode,
      updateId,
    });
    uploads.clear();
    registerMedia(saved._imagePath);
    registerMedia(saved._videoPath);
    return saved;
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin || "http://127.0.0.1");
      if (req.method === "GET" && STATIC_FILES.has(url.pathname)) {
        const [name, type] = STATIC_FILES.get(url.pathname);
        const headers = { "Content-Type": type };
        if (url.pathname === "/" && url.searchParams.get("token") === token) {
          headers["Set-Cookie"] = `dream_skin_control_token=${token}; Max-Age=86400; Path=/; HttpOnly; SameSite=Strict`;
        }
        return response(res, 200, await fs.readFile(path.join(publicRoot, name)), headers);
      }
      if (!url.pathname.startsWith("/api/")) return json(res, 404, { error: "Not found" });
      // Media handles are random, short-lived and disclosed only by the authenticated
      // bootstrap response. Native img/video requests cannot attach custom headers.
      if (req.method === "GET" && url.pathname.startsWith("/api/media/")) {
        return serveMedia(req, res, url.pathname.slice("/api/media/".length));
      }
      const mutating = req.method !== "GET" && req.method !== "HEAD";
      if (!authorize(req, mutating)) return json(res, 403, { error: "Control Center authorization failed" });
      if (req.method === "GET" && url.pathname === "/api/bootstrap") return bootstrap(res);
      if (req.method === "POST" && url.pathname === "/api/upload") {
        const kind = url.searchParams.get("kind");
        const limit = kind === "image" ? 10 * 1024 * 1024 : kind === "video" ? 32 * 1024 * 1024 : 0;
        if (!limit) return json(res, 400, { error: "Upload kind must be image or video" });
        const upload = validateUploadedMedia(kind, await readBody(req, limit));
        const uploadId = randomBytes(18).toString("base64url");
        for (const [id, item] of uploads) if (item.kind === kind) uploads.delete(id);
        uploads.set(uploadId, upload);
        return json(res, 201, { uploadId, kind, mediaType: upload.mediaType, bytes: upload.bytes.length });
      }
      if (req.method === "POST" && url.pathname === "/api/themes") {
        const body = await readJson(req);
        const saved = await saveTheme(body);
        return json(res, 201, { theme: publicTheme(saved, mediaIds) });
      }
      const themePath = /^\/api\/themes\/([^/]+)$/u.exec(url.pathname);
      if (req.method === "PUT" && themePath) {
        const body = await readJson(req);
        const themeId = decodeURIComponent(themePath[1]);
        const saved = await saveTheme(body, themeId);
        return json(res, 200, { theme: publicTheme(saved, mediaIds) });
      }
      if (req.method === "DELETE" && themePath) {
        const themeId = decodeURIComponent(themePath[1]);
        await store.remove(themeId);
        return json(res, 200, { id: themeId });
      }
      if (req.method === "POST" && url.pathname === "/api/export") {
        const exported = await exporter.exportPackage(await readJson(req));
        return response(res, 200, exported.archive, {
          "Content-Disposition": `attachment; filename="${exported.filename}"`,
          "Content-Length": String(exported.archive.length),
          "Content-Type": "application/zip",
          "X-DreamSkin-Package-Sha256": exported.record.packageSha256,
          "X-DreamSkin-Package-Version": exported.record.version,
          "X-DreamSkin-Validated-Platforms": "windows,macos",
        });
      }
      if (req.method === "POST" && url.pathname === "/api/action") {
        if (!allowActions) return json(res, 409, { error: "Platform actions are disabled" });
        if (platform !== "win32") return json(res, 501, { error: "Control Center actions currently require Windows" });
        const body = await readJson(req);
        if (!new Set(["apply", "pause", "resume"]).has(body.action)) {
          return json(res, 400, { error: "Unknown action" });
        }
        let themeId = null;
        if (body.action === "apply") {
          const snapshot = await store.list();
          const selected = snapshot.themes.find((entry) => entry.id === body.themeId && entry.kind === "saved");
          if (!selected) return json(res, 404, { error: "Saved theme not found" });
          themeId = selected.id;
        }
        return json(res, 200, await actionRunner({ action: body.action, themeId, stateRoot }));
      }
      return json(res, 404, { error: "Not found" });
    } catch (error) {
      const status = errorStatus(error);
      return json(res, status, {
        error: status === 500 ? error.publicMessage ?? "Control Center operation failed" : error.message,
        ...(options.exposeErrors ? { detail: error?.stack ?? String(error) } : {}),
      });
    }
  });

  await store.initialize();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  origin = `http://${host}:${address.port}`;
  const url = `${origin}/?token=${encodeURIComponent(token)}`;
  await writeStateFile(options.stateFile, {
    pid: process.pid,
    origin,
    url,
    token,
    stateRoot,
    startedAt: new Date().toISOString(),
  });
  return {
    server,
    origin,
    url,
    token,
    stateRoot,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

function parseArguments(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!new Set(["--port", "--state-file", "--state-root"]).has(flag)) throw new Error(`Unknown argument: ${flag}`);
    const value = argv[index + 1];
    if (!value) throw new Error(`Missing value for ${flag}`);
    result[flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    index += 1;
  }
  if (result.port !== undefined) {
    result.port = Number(result.port);
    if (!Number.isInteger(result.port) || result.port < 0 || result.port > 65535) throw new Error("Invalid port");
  }
  return result;
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  try {
    const controlCenter = await createControlCenter(parseArguments(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify({ url: controlCenter.url, pid: process.pid })}\n`);
    const shutdown = async () => {
      await controlCenter.close().catch(() => {});
      process.exit(0);
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    process.stderr.write(`Control Center failed: ${error?.message ?? error}\n`);
    process.exitCode = 1;
  }
}
