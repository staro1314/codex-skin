import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  detectedVideoMedia,
  normalizeThemeControls,
  normalizeThemeStateEffects,
  normalizeThemeVideo,
} from "../runtime/theme-package-validator.mjs";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validator = path.join(projectRoot, "runtime", "theme-package-validator.mjs");
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codex-dream-skin-video-contract-"));

const tinyPng = Buffer.from("89504e470d0a1a0a", "hex");
const tinyMp4 = Buffer.from("000000186674797069736f6d00000200", "hex");
const validCss = '[data-ds-part="root"] { color: #123456; }\n';
let themeSequence = 0;

async function makeSimpleTheme(video = true) {
  themeSequence += 1;
  const source = path.join(tempRoot, `source-${themeSequence}-${video ? "video" : "image"}`);
  const stage = path.join(tempRoot, `stage-${themeSequence}-${video ? "video" : "image"}`);
  await fs.mkdir(source);
  await fs.mkdir(stage);
  await fs.writeFile(path.join(source, "background.png"), tinyPng);
  await fs.writeFile(path.join(source, "theme.css"), validCss);
  await fs.writeFile(path.join(source, "theme.json"), JSON.stringify({
    schemaVersion: 1,
    id: video ? "video-theme" : "image-theme",
    name: "Video contract",
    image: "background.png",
    ...(video ? { video: { src: "background.mp4", performance: "balanced" } } : {}),
  }));
  if (video) await fs.writeFile(path.join(source, "background.mp4"), tinyMp4);
  return { source, stage };
}

test("video contract accepts only local muted media policy", async () => {
  assert.deepEqual(normalizeThemeVideo({ src: "background.mp4" }), {
    src: "background.mp4",
    performance: "balanced",
  });
  assert.equal(detectedVideoMedia(tinyMp4), "video/mp4");
  assert.throws(() => normalizeThemeVideo({ src: "https://example.invalid/a.mp4" }), /registered video file/);
  assert.throws(() => normalizeThemeVideo({ src: "background.mp4", muted: false }), /muted must remain true/);
});

test("state effects accept bounded visual controls and reject executable or extreme values", () => {
  assert.deepEqual(normalizeThemeStateEffects({
    thinking: { color: "#36d7e8", overlayOpacity: 0.12, motion: "pulse" },
    executing: {
      mediaOpacity: 0.92,
      brightness: 1.08,
      saturation: 1.4,
      contrast: 1.1,
      hueRotate: 12,
      motion: "flash",
    },
  }), {
    thinking: { color: "#36d7e8", overlayOpacity: 0.12, motion: "pulse" },
    executing: {
      mediaOpacity: 0.92,
      brightness: 1.08,
      saturation: 1.4,
      contrast: 1.1,
      hueRotate: 12,
      motion: "flash",
    },
  });
  assert.equal(normalizeThemeStateEffects(undefined), null);
  assert.throws(
    () => normalizeThemeStateEffects({ executing: { overlayOpacity: 0.5 } }),
    /overlayOpacity must be between 0 and 0\.35/,
  );
  assert.throws(
    () => normalizeThemeStateEffects({ executing: { motion: "javascript:alert(1)" } }),
    /motion is unsupported/,
  );
  assert.throws(
    () => normalizeThemeStateEffects({ speaking: { motion: "pulse" } }),
    /unsupported field speaking/,
  );
});

test("theme controls normalize the bounded control-center contract", () => {
  assert.deepEqual(normalizeThemeControls({
    surfaceOpacity: 0.78,
    surfaceBlur: 18,
    surfaceRadius: 24,
    imageZoom: 1.08,
    imageDim: 0.22,
    motionLevel: "expressive",
  }), {
    surfaceOpacity: 0.78,
    surfaceBlur: 18,
    surfaceRadius: 24,
    imageZoom: 1.08,
    imageDim: 0.22,
    motionLevel: "expressive",
  });
  assert.equal(normalizeThemeControls(undefined), null);
  assert.throws(() => normalizeThemeControls({ surfaceOpacity: 0.2 }), /between 0\.55 and 1/);
  assert.throws(() => normalizeThemeControls({ surfaceBlur: 48 }), /between 0 and 32/);
  assert.throws(() => normalizeThemeControls({ imageZoom: 2 }), /between 1 and 1\.2/);
  assert.throws(() => normalizeThemeControls({ motionLevel: "script" }), /unsupported/);
  assert.throws(() => normalizeThemeControls({ remoteCss: "https://example.invalid" }), /unsupported field/);
});

test("simplified theme packages stage video beside the poster without embedding it", async () => {
  const { source, stage } = await makeSimpleTheme(true);
  const { stdout } = await execFileAsync(process.execPath, [
    validator,
    "--source", source,
    "--stage", stage,
    "--platform", "windows",
    "--client-version", "1.0.0",
  ], { cwd: projectRoot });
  const result = JSON.parse(stdout);
  assert.equal(result.format, "simple");
  assert.equal(result.video, "background.mp4");
  assert.deepEqual(await fs.readFile(path.join(stage, "background.mp4")), tinyMp4);
});

test("legacy image-only simplified packages remain valid", async () => {
  const { source, stage } = await makeSimpleTheme(false);
  const { stdout } = await execFileAsync(process.execPath, [
    validator,
    "--source", source,
    "--stage", stage,
    "--platform", "macos",
    "--client-version", "1.0.0",
  ], { cwd: projectRoot });
  assert.equal(JSON.parse(stdout).video, null);
});

test("macOS staging preserves the video file beside its poster", async () => {
  const { source, stage } = await makeSimpleTheme(true);
  const stageScript = path.join(projectRoot, "macos", "scripts", "stage-theme.mjs");
  const { stdout } = await execFileAsync(process.execPath, [stageScript, source, stage], { cwd: projectRoot });
  const result = JSON.parse(stdout);
  assert.equal(result.video, "background.mp4");
  assert.deepEqual(await fs.readFile(path.join(stage, "background.mp4")), tinyMp4);
});

test("macOS payload carries only the local video URL, never video Base64", async () => {
  const directory = path.join(tempRoot, "payload-video");
  await fs.mkdir(directory);
  await fs.copyFile(path.join(projectRoot, "macos", "assets", "portal-hero.png"), path.join(directory, "background.png"));
  await fs.writeFile(path.join(directory, "background.mp4"), tinyMp4);
  await fs.writeFile(path.join(directory, "theme.json"), JSON.stringify({
    schemaVersion: 1,
    id: "payload-video",
    name: "Payload video",
    image: "background.png",
    video: { src: "background.mp4", performance: "balanced" },
  }));
  const { loadPayload } = await import("../macos/scripts/injector.mjs");
  const loaded = await loadPayload(directory);
  assert.match(loaded.payload, /"video":\{"src":"file:/);
  assert.equal(loaded.payload.includes(tinyMp4.toString("base64")), false);
});

test("macOS payload rejects oversized video before reading or embedding it", async () => {
  const directory = path.join(tempRoot, "payload-video-over-limit");
  await fs.mkdir(directory);
  await fs.copyFile(path.join(projectRoot, "macos", "assets", "portal-hero.png"), path.join(directory, "background.png"));
  await fs.writeFile(path.join(directory, "theme.json"), JSON.stringify({
    schemaVersion: 1,
    id: "payload-video-over-limit",
    name: "Oversized video",
    image: "background.png",
    video: { src: "background.mp4", performance: "eco" },
  }));
  await fs.writeFile(path.join(directory, "background.mp4"), tinyMp4);
  await fs.truncate(path.join(directory, "background.mp4"), 32 * 1024 * 1024 + 1);
  const { loadPayload } = await import("../macos/scripts/injector.mjs");
  await assert.rejects(loadPayload(directory), /no larger than 33554432 bytes/);
});
