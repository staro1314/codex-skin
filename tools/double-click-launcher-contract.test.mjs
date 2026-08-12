import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const launcher = await fs.readFile(path.join(projectRoot, "start-codex-skin.cmd"), "utf8");

test("double-click launcher runs the root PowerShell entry without bypass", () => {
  assert.match(launcher, /cd \/d "%~dp0"/i);
  assert.match(launcher, /start-codex-skin\.ps1/i);
  assert.match(launcher, /-ExecutionPolicy RemoteSigned/i);
  assert.match(launcher, /-PromptRestart/i);
  assert.doesNotMatch(launcher, /ExecutionPolicy\s+Bypass/i);
  assert.match(launcher, /pause/i);
});
