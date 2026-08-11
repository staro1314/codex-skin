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

test("simplified theme packages stage video beside the poster without embedding it", async () => {
  const { source, stage } = await makeSimpleTheme(true);
  const { stdout } = await execFileAsync(process.execPath, [
    validator,
    "--source", source,
    "--stage", stage,
    "--platform", "windows",
    "--client-version", "1.5.12",
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
    "--client-version", "1.5.12",
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
