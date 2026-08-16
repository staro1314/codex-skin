import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createControlCenter } from "../control-center/server.mjs";
import { createZip, readZipEntries } from "../control-center/zip-writer.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "dream-skin-control-center-"));
const execFileAsync = promisify(execFile);
const tinyMp4 = Buffer.from("000000186674797069736f6d00000200", "hex");

test.after(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

test("control center serves an authenticated theme editor and saves immutable drafts", async () => {
  const stateRoot = path.join(tempRoot, "state");
  const center = await createControlCenter({
    port: 0,
    stateRoot,
    bundledThemeRoot: path.join(projectRoot, "windows", "assets"),
    allowActions: false,
    exposeErrors: true,
  });
  const headers = { "X-DreamSkin-Token": center.token };
  try {
    const shellResponse = await fetch(`${center.origin}/?token=${encodeURIComponent(center.token)}`);
    assert.equal(shellResponse.status, 200);
    const shellHtml = await shellResponse.text();
    assert.match(shellHtml, /DREAM SKIN/);
    const cookie = shellResponse.headers.get("set-cookie");
    assert.match(cookie ?? "", /dream_skin_control_token=/);
    const cookieBootstrapResponse = await fetch(`${center.origin}/api/bootstrap`, {
      headers: { Cookie: cookie.split(";", 1)[0] },
    });
    assert.equal(cookieBootstrapResponse.status, 200);
    assert.match(shellHtml, /id="export-version"/);
    assert.match(shellHtml, /id="export-button"/);
    assert.match(shellHtml, /id="theme-search"/);
    assert.match(shellHtml, /data-editor-tab="surface"/);
    assert.match(shellHtml, /id="reset-button"/);
    assert.match(shellHtml, /id="new-theme-button"/);
    assert.match(shellHtml, /id="delete-theme-button"/);
    assert.match(shellHtml, /id="media-mode-image"/);
    assert.match(shellHtml, /id="media-mode-video"/);
    assert.match(shellHtml, /id="new-theme-dialog"/);
    assert.match(shellHtml, /id="new-theme-type-image"/);
    assert.match(shellHtml, /id="new-theme-type-video"/);
    assert.match(shellHtml, /id="new-theme-file"/);
    assert.match(shellHtml, /id="new-theme-confirm"[^>]+type="submit"/);
    assert.match(shellHtml, /视频主题统一使用合规静态封面/,
      "The new-theme dialog must explain that video themes use the shared compliant cover.");
    assert.match(shellHtml, /不需要上传照片/,
      "The new-theme dialog must make clear that video creation does not require a photo upload.");
    assert.match(shellHtml, /id="image-upload-label"/,
      "The image upload label must be able to identify a video cover separately from a static background.");
    assert.match(shellHtml, /id="operation-progress"/);
    assert.match(shellResponse.headers.get("content-security-policy"), /frame-ancestors 'none'/);

    const clientResponse = await fetch(`${center.origin}/app.js`);
    assert.equal(clientResponse.status, 200);
    const clientJs = await clientResponse.text();
    assert.match(clientJs, /\/api\/export/);
    assert.doesNotMatch(clientJs, /captureVideoPoster/,
      "Video theme creation must not derive a cover from each video's aspect ratio.");
    assert.match(clientJs, /VIDEO_THEME_COVER_URL/,
      "The control center must preview the shared compliant video cover.");
    assert.match(clientJs, /sessionStorage/);
    assert.match(clientJs, /method: updateCurrent \? "PUT" : "POST"/);
    assert.match(clientJs, /method: "DELETE"/);
    assert.match(clientJs, /mediaMode: state\.mediaMode/);
    assert.match(clientJs, /className = "theme-delete"/);
    assert.match(clientJs, /deleteTheme\(theme\.id\)/);
    assert.match(clientJs, /function createNewTheme\(\)/);
    assert.match(clientJs, /mediaMode: type/);
    assert.match(clientJs, /elements\.previewVideo\.load\(\)/);
    assert.match(clientJs, /视频主题 \/ 统一封面/,
      "Video themes must be labeled as using the shared cover, not as an unexplained photo upload.");
    assert.match(clientJs, /统一封面/,
      "The save status must identify the shared cover source.");
    assert.match(clientJs, /operationProgressLabel/);
    assert.match(clientJs, /classList\.add\("is-loading"\)/);
    assert.match(clientJs, /const SYSTEM_DEFAULT_THEME_ID = "preset-arina-hashimoto";/,
      "New themes must use the Arina Hashimoto preset as the system default parameter source.");
    assert.match(clientJs,
      /function systemDefaultTheme\(\)[\s\S]*?theme\.id === SYSTEM_DEFAULT_THEME_ID[\s\S]*?theme\.theme\?\.id === SYSTEM_DEFAULT_THEME_ID[\s\S]*?cleanThemeName\(theme\.name\) === "桥本有菜"/,
      "The system default theme lookup must support bundled, active, and legacy Arina entries.");
    assert.match(clientJs,
      /const defaultTheme = systemDefaultTheme\(\) \?\? source;[\s\S]*?const draft = themeToDraft\(defaultTheme\.theme\);/,
      "The new-theme draft must be initialized from the system default theme parameters.");
    assert.match(clientJs,
      /function optionalFieldsForTheme\(theme\)[\s\S]*?theme\?\.colorMode !== "explicit"[\s\S]*?!theme\?\.controls/,
      "Optional parameter inheritance must follow the source theme declaration state, not runtime fallback values.");
    assert.match(clientJs,
      /function persistenceDraft\(draft, optionalFields = \{\}\)[\s\S]*?delete payload\.colors[\s\S]*?delete payload\.controls/,
      "The editor must omit untouched optional parameters when persisting a new theme.");
    assert.match(clientJs, /preserveOptionalFields: state\.optionalFields/,
      "Theme saves must tell the server which optional parameter groups remain inherited.");

    const denied = await fetch(`${center.origin}/api/bootstrap`);
    assert.equal(denied.status, 403);

    const bootstrapResponse = await fetch(`${center.origin}/api/bootstrap`, { headers });
    assert.equal(bootstrapResponse.status, 200);
    const bootstrap = await bootstrapResponse.json();
    assert.equal(bootstrap.app.actionsEnabled, false);
    assert.equal(bootstrap.themes.length, 1);
    assert.equal(bootstrap.themes[0].kind, "bundled");
    assert.equal(Object.hasOwn(bootstrap.themes[0], "_directory"), false);

    const unsavedExport = await fetch(`${center.origin}/api/export`, {
      method: "POST",
      headers: { ...headers, Origin: center.origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        themeId: bootstrap.themes[0].id,
        version: "1.0.0",
        publisherDisplayName: "Control Center Tests",
        publisherId: "control-center-tests",
        license: "CC0-1.0",
        summary: "Bundled themes must be saved before publication.",
        aiGenerated: false,
      }),
    });
    assert.equal(unsavedExport.status, 404);

    const crossOriginExport = await fetch(`${center.origin}/api/export`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(crossOriginExport.status, 403);

    const mediaResponse = await fetch(`${center.origin}/api/media/${bootstrap.themes[0].imageMediaId}`);
    assert.equal(mediaResponse.status, 200);
    assert.equal(mediaResponse.headers.get("content-type"), "image/jpeg");
    const sourceImageBytes = Buffer.from(await mediaResponse.arrayBuffer());
    assert.ok(sourceImageBytes.byteLength > 1000);

    const universalCoverResponse = await fetch(`${center.origin}/video-theme-cover.png`);
    assert.equal(universalCoverResponse.status, 200);
    assert.equal(universalCoverResponse.headers.get("content-type"), "image/png");
    const universalCoverBytes = Buffer.from(await universalCoverResponse.arrayBuffer());
    assert.ok(universalCoverBytes.byteLength > 1000);

    const forbiddenMutation = await fetch(`${center.origin}/api/themes`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(forbiddenMutation.status, 403);

    const draft = {
      name: "Control Center Test",
      appearance: "dark",
      art: { focusX: 0.72, focusY: 0.41, safeArea: "left", taskMode: "ambient" },
      colors: {
        background: "#071116", panel: "#0b1a20", panelAlt: "#10272c",
        accent: "#8dffb6", accentAlt: "#b8ff3d", secondary: "#58c9d4",
        highlight: "#642a8c", text: "#e9fff1", muted: "#9ebdb3",
        line: "rgba(124, 255, 70, .28)",
      },
      controls: {
        surfaceOpacity: 0.8, surfaceBlur: 22, surfaceRadius: 19,
        imageZoom: 1.08, imageDim: 0.28, motionLevel: "reduced",
      },
      stateEffects: {
        thinking: {
          color: "#58c9d4", overlayOpacity: 0.14, mediaOpacity: 0.92,
          brightness: 1.08, saturation: 1.2, contrast: 1.05,
          hueRotate: 4, motion: "pulse",
        },
      },
      videoPerformance: "balanced",
    };
    const videoUploadResponse = await fetch(`${center.origin}/api/upload?kind=video`, {
      method: "POST",
      headers: { ...headers, Origin: center.origin, "Content-Type": "video/mp4" },
      body: tinyMp4,
    });
    assert.equal(videoUploadResponse.status, 201);
    const videoUpload = await videoUploadResponse.json();
    const coverUploadResponse = await fetch(`${center.origin}/api/upload?kind=image`, {
      method: "POST",
      headers: { ...headers, Origin: center.origin, "Content-Type": "image/jpeg" },
      body: sourceImageBytes,
    });
    assert.equal(coverUploadResponse.status, 201);
    const coverUpload = await coverUploadResponse.json();
    const saveResponse = await fetch(`${center.origin}/api/themes`, {
      method: "POST",
      headers: { ...headers, Origin: center.origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: "bundled",
        draft,
        inheritVideo: false,
        imageUploadId: coverUpload.uploadId,
        videoUploadId: videoUpload.uploadId,
        mediaMode: "video",
      }),
    });
    const savedText = await saveResponse.text();
    assert.equal(saveResponse.status, 201, savedText);
    const saved = JSON.parse(savedText);
    assert.match(saved.theme.id, /^custom-control-center-test-/);
    assert.ok(saved.theme.imageMediaId, "Video themes must persist the shared cover image");
    assert.ok(saved.theme.videoMediaId, "Video themes must persist the video upload");
    assert.equal(saved.theme.theme.controls.surfaceBlur, 22);
    assert.equal(saved.theme.theme.stateEffects.thinking.motion, "pulse");

    const directory = path.join(stateRoot, "themes", saved.theme.id);
    const files = (await fs.readdir(directory)).sort();
    assert.deepEqual(files, ["background.mp4", "background.png", "theme.css", "theme.json"]);
    assert.deepEqual(
      await fs.readFile(path.join(directory, "background.png")),
      universalCoverBytes,
      "Every saved video theme must use the same canonical cover bytes.",
    );
    const persisted = JSON.parse(await fs.readFile(path.join(directory, "theme.json"), "utf8"));
    assert.equal(persisted.controls.motionLevel, "reduced");
    assert.equal(persisted.stateEffects.thinking.overlayOpacity, 0.14);
    assert.equal((await fs.readdir(path.join(stateRoot, "themes"))).some((name) => name.startsWith(".control-center-")), false);

    const imageUploadResponse = await fetch(`${center.origin}/api/upload?kind=image`, {
      method: "POST",
      headers: { ...headers, Origin: center.origin, "Content-Type": "image/jpeg" },
      body: sourceImageBytes,
    });
    assert.equal(imageUploadResponse.status, 201);
    const imageUpload = await imageUploadResponse.json();
    const imageSaveResponse = await fetch(`${center.origin}/api/themes`, {
      method: "POST",
      headers: { ...headers, Origin: center.origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: "bundled",
        draft: { ...draft, name: "Image Upload Test" },
        imageUploadId: imageUpload.uploadId,
        inheritVideo: false,
        mediaMode: "image",
      }),
    });
    assert.equal(imageSaveResponse.status, 201);
    const imageSaved = await imageSaveResponse.json();
    assert.equal(imageSaved.theme.videoMediaId, null, "Image mode must not create a video");
    assert.deepEqual((await fs.readdir(path.join(stateRoot, "themes", imageSaved.theme.id))).sort(), [
      "background.jpg", "theme.css", "theme.json",
    ]);

    const lifecycleSaveResponse = await fetch(`${center.origin}/api/themes`, {
      method: "POST",
      headers: { ...headers, Origin: center.origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: "bundled",
        draft: { ...draft, name: "Lifecycle Test" },
        inheritVideo: false,
        mediaMode: "image",
      }),
    });
    assert.equal(lifecycleSaveResponse.status, 201);
    const lifecycleSaved = await lifecycleSaveResponse.json();
    const lifecycleId = lifecycleSaved.theme.id;
    const lifecycleUpdateResponse = await fetch(`${center.origin}/api/themes/${encodeURIComponent(lifecycleId)}`, {
      method: "PUT",
      headers: { ...headers, Origin: center.origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: lifecycleId,
        draft: { ...draft, name: "Lifecycle Updated" },
        inheritVideo: false,
        mediaMode: "image",
      }),
    });
    assert.equal(lifecycleUpdateResponse.status, 200);
    const lifecycleUpdated = await lifecycleUpdateResponse.json();
    assert.equal(lifecycleUpdated.theme.id, lifecycleId, "Updating must preserve the saved theme id");
    assert.equal(lifecycleUpdated.theme.theme.name, "Lifecycle Updated");
    assert.equal(lifecycleUpdated.theme.videoMediaId, null, "Image mode must not retain a video");
    assert.deepEqual((await fs.readdir(path.join(stateRoot, "themes", lifecycleId))).sort(), [
      "background.jpg", "theme.css", "theme.json",
    ]);
    const lifecycleDeleteResponse = await fetch(`${center.origin}/api/themes/${encodeURIComponent(lifecycleId)}`, {
      method: "DELETE",
      headers: { ...headers, Origin: center.origin },
    });
    assert.equal(lifecycleDeleteResponse.status, 200);
    assert.equal((await fetch(`${center.origin}/api/bootstrap`, { headers }).then((response) => response.json()))
      .themes.some((theme) => theme.id === lifecycleId), false);
    await assert.rejects(fs.access(path.join(stateRoot, "themes", lifecycleId)), { code: "ENOENT" });

    const exportOptions = {
      themeId: saved.theme.id,
      version: "1.0.0",
      publisherDisplayName: "Control Center Tests",
      publisherId: "control-center-tests",
      license: "CC0-1.0",
      summary: "Cross-platform export contract test.",
      aiGenerated: false,
    };
    const exportResponse = await fetch(`${center.origin}/api/export`, {
      method: "POST",
      headers: { ...headers, Origin: center.origin, "Content-Type": "application/json" },
      body: JSON.stringify(exportOptions),
    });
    assert.equal(exportResponse.status, 200, await exportResponse.clone().text());
    assert.equal(exportResponse.headers.get("content-type"), "application/zip");
    assert.equal(exportResponse.headers.get("x-dreamskin-validated-platforms"), "windows,macos");
    assert.match(exportResponse.headers.get("content-disposition"), /-v1\.0\.0\.zip"$/);
    assert.match(exportResponse.headers.get("x-dreamskin-package-sha256"), /^[0-9a-f]{64}$/);
    const archive = Buffer.from(await exportResponse.arrayBuffer());
    const exportedFiles = readZipEntries(archive);
    assert.deepEqual([...exportedFiles.keys()].sort(), [
      "LICENSE.txt", "background.mp4", "background.png", "manifest.json", "theme.css", "theme.json",
    ]);
    const manifest = JSON.parse(exportedFiles.get("manifest.json").toString("utf8"));
    const exportedTheme = JSON.parse(exportedFiles.get("theme.json").toString("utf8"));
    assert.deepEqual(manifest.platforms, ["macos", "windows"]);
    assert.ok(manifest.capabilities.includes("video"));
    assert.equal(manifest.version, "1.0.0");
    assert.equal(manifest.publisher.id, "control-center-tests");
    assert.equal(manifest.provenance.aiGenerated, false);
    assert.equal(exportedTheme.id, manifest.themeId);
    assert.equal(exportedTheme.controls.surfaceBlur, 22);
    assert.equal(exportedTheme.video.src, "background.mp4");
    assert.deepEqual(exportedFiles.get("background.mp4"), tinyMp4);
    assert.deepEqual(exportedFiles.get("background.png"), universalCoverBytes);
    assert.equal(Object.hasOwn(exportedTheme, "artMetadata"), false);

    const duplicateResponse = await fetch(`${center.origin}/api/export`, {
      method: "POST",
      headers: { ...headers, Origin: center.origin, "Content-Type": "application/json" },
      body: JSON.stringify(exportOptions),
    });
    assert.equal(duplicateResponse.status, 409);
    assert.match((await duplicateResponse.json()).error, /already exported/);
    const refreshed = await fetch(`${center.origin}/api/bootstrap`, { headers }).then((response) => response.json());
    assert.deepEqual(refreshed.exports[saved.theme.id].versions, ["1.0.0"]);
    assert.equal(refreshed.exports[saved.theme.id].suggestedVersion, "1.0.1");
    assert.equal((await fs.readdir(stateRoot)).some((name) => name.startsWith(".control-center-export-")), false);
  } finally {
    await center.close();
  }
});

test("new themes preserve optional parameters omitted by their system parameter source", async () => {
  const center = await createControlCenter({
    port: 0,
    stateRoot: path.join(tempRoot, "optional-parameter-state"),
    bundledThemeRoot: path.join(projectRoot, "windows", "assets"),
    allowActions: false,
  });
  try {
    const response = await fetch(`${center.origin}/api/themes`, {
      method: "POST",
      headers: {
        "X-DreamSkin-Token": center.token,
        Origin: center.origin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceId: "bundled",
        draft: {
          name: "Arina Optional Parameters",
          appearance: "auto",
          art: { focusX: 0.72, focusY: 0.45, safeArea: "left", taskMode: "ambient" },
          stateEffects: {},
        },
        preserveOptionalFields: { colors: true, controls: true },
        inheritVideo: false,
        mediaMode: "image",
      }),
    });
    const payload = await response.json();
    assert.equal(response.status, 201, JSON.stringify(payload));
    const persisted = JSON.parse(await fs.readFile(
      path.join(tempRoot, "optional-parameter-state", "themes", payload.theme.id, "theme.json"),
      "utf8",
    ));
    assert.equal(Object.hasOwn(persisted, "colors"), false);
    assert.equal(Object.hasOwn(persisted, "controls"), false);
  } finally {
    await center.close();
  }
});

test("control center surfaces a recoverable Windows action failure", async () => {
  const center = await createControlCenter({
    platform: "win32",
    port: 0,
    stateRoot: path.join(tempRoot, "action-error-state"),
    bundledThemeRoot: path.join(projectRoot, "windows", "assets"),
    actionRunner: async () => {
      throw Object.assign(new Error("internal action detail"), {
        publicMessage: "Windows theme action failed; retry after the current operation finishes.",
      });
    },
  });
  try {
    const response = await fetch(`${center.origin}/api/action`, {
      method: "POST",
      headers: {
        "X-DreamSkin-Token": center.token,
        Origin: center.origin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "pause" }),
    });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: "Windows theme action failed; retry after the current operation finishes.",
    });
  } finally {
    await center.close();
  }
});

test("ZIP writer rejects tampering and unsafe entry names", () => {
  const archive = createZip([
    { name: "theme.json", bytes: Buffer.from('{"schemaVersion":1}\n') },
    { name: "theme.css", bytes: Buffer.from('[data-ds-part="root"] { color: #fff; }\n') },
  ], { timestamp: "2026-08-13T00:00:00Z" });
  assert.deepEqual([...readZipEntries(archive).keys()], ["theme.json", "theme.css"]);
  const tampered = Buffer.from(archive);
  tampered[40] ^= 0x01;
  assert.throws(() => readZipEntries(tampered), /CRC|inflate|invalid/i);
  assert.throws(
    () => createZip([{ name: "../theme.json", bytes: Buffer.from("x") }]),
    /unsafe/,
  );

  const inconsistentSize = Buffer.from(archive);
  const endOffset = inconsistentSize.length - 22;
  const centralOffset = inconsistentSize.readUInt32LE(endOffset + 16);
  inconsistentSize.writeUInt32LE(65 * 1024 * 1024, centralOffset + 24);
  assert.throws(() => readZipEntries(inconsistentSize), /64 MiB|metadata disagree/);

  const inconsistentLocalHeader = Buffer.from(archive);
  inconsistentLocalHeader.writeUInt32LE(
    inconsistentLocalHeader.readUInt32LE(18) + 1,
    18,
  );
  assert.throws(() => readZipEntries(inconsistentLocalHeader), /metadata disagree/);
});

test("ZIP output opens with the native Windows ZipArchive reader", { skip: process.platform !== "win32" }, async () => {
  const archive = createZip([
    { name: "theme.json", bytes: Buffer.from('{"schemaVersion":1}\n') },
    { name: "theme.css", bytes: Buffer.from('[data-ds-part="root"] { color: #fff; }\n') },
  ], { timestamp: "2026-08-13T00:00:00Z" });
  const archivePath = path.join(tempRoot, "native-reader.zip");
  await fs.writeFile(archivePath, archive);
  const script = [
    "Add-Type -AssemblyName System.IO.Compression.FileSystem",
    "$zip=[System.IO.Compression.ZipFile]::OpenRead($env:DREAMSKIN_TEST_ZIP)",
    "try { @($zip.Entries | ForEach-Object FullName) | ConvertTo-Json -Compress } finally { $zip.Dispose() }",
  ].join("; ");
  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
    env: { ...process.env, DREAMSKIN_TEST_ZIP: archivePath },
    windowsHide: true,
  });
  assert.deepEqual(JSON.parse(stdout.trim()), ["theme.json", "theme.css"]);
});

test("control center validates uploads before accepting them", async () => {
  const center = await createControlCenter({
    port: 0,
    stateRoot: path.join(tempRoot, "upload-state"),
    bundledThemeRoot: path.join(projectRoot, "windows", "assets"),
    allowActions: false,
  });
  try {
    const invalid = await fetch(`${center.origin}/api/upload?kind=image`, {
      method: "POST",
      headers: {
        Origin: center.origin,
        "X-DreamSkin-Token": center.token,
        "Content-Type": "application/octet-stream",
      },
      body: Buffer.from("not-an-image"),
    });
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json()).error, /Image is invalid/);
  } finally {
    await center.close();
  }
});

test("control center launchers keep the double-click and RemoteSigned contract", async () => {
  const [cmd, ps, action] = await Promise.all([
    fs.readFile(path.join(projectRoot, "control-codex-skin.cmd"), "utf8"),
    fs.readFile(path.join(projectRoot, "control-codex-skin.ps1"), "utf8"),
    fs.readFile(path.join(projectRoot, "windows", "scripts", "control-center-action.ps1"), "utf8"),
  ]);
  assert.match(cmd, /control-codex-skin\.ps1/i);
  assert.match(cmd, /ExecutionPolicy RemoteSigned/i);
  assert.doesNotMatch(cmd, /ExecutionPolicy\s+Bypass/i);
  assert.match(ps, /ProcessStartInfo/);
  assert.match(ps, /\$startInfo\.FileName = \$node\.Path/);
  assert.match(ps, /\$startInfo\.CreateNoWindow = \$true/);
  assert.match(ps, /\$startInfo\.UseShellExecute = \$false/);
  assert.match(ps, /managedScriptRoot/);
  assert.match(ps, /Unblock-File -LiteralPath \$managedScript\.FullName/);
  assert.match(ps, /control-center\.json/i);
  assert.match(ps, /Stop-ControlCenterState/);
  assert.match(ps, /Existing Control Center detected/);
  assert.match(ps, /Stop-Process -Id \$processId/);
  assert.doesNotMatch(ps, /Start-Process -FilePath "\$\(\$existing\.url\)"/);
  assert.match(action, /Use-DreamSkinSavedTheme/);
  assert.match(action, /Invoke-DreamSkinLiveRemove/);
  assert.match(action, /Set-DreamSkinPaused/);
});
