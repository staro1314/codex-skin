import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHealthSnapshot, normalizeHealthState, runDoctor } from "../runtime/runtime-doctor.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const platform of ["windows", "darwin"]) {
  const report = await runDoctor({
    platform,
    projectRoot,
    platformRoot: path.join(projectRoot, platform === "windows" ? "windows" : "macos"),
  });
  assert.equal(report.pass, true, `${platform} static Doctor should pass`);
  assert.equal(report.status, "ready", `${platform} static Doctor should be ready`);
  assert.equal(report.skinVersion, "1.5.12");
  assert.equal(report.checks.find((item) => item.id === "shared-contract-sync")?.status, "pass");
}

const stateRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codex-dream-skin-doctor-"));
const stateFile = path.join(stateRoot, "state.json");
await fs.writeFile(stateFile, JSON.stringify({
  session: "active",
  operation: "",
  injectorAlive: true,
  cdpOk: true,
  codexRunning: true,
  themeId: "preset-test",
  appliedThemeId: "preset-test",
}));
const liveReport = await runDoctor({
  platform: "windows",
  projectRoot,
  platformRoot: path.join(projectRoot, "windows"),
  stateFile,
  requireLive: true,
});
assert.equal(liveReport.status, "ready");
assert.equal(liveReport.session, "active");
assert.equal(liveReport.lifecycle, "active");

const missingLiveReport = await runDoctor({
  platform: "windows",
  projectRoot,
  platformRoot: path.join(projectRoot, "windows"),
  stateFile: path.join(stateRoot, "missing-state.json"),
  requireLive: true,
});
assert.equal(missingLiveReport.pass, false);
assert.equal(missingLiveReport.status, "blocked");
assert.equal(missingLiveReport.checks.find((item) => item.id === "live-session")?.code, "DS-STATE-002");

const normalized = normalizeHealthState({ session: "active", operation: "applying", cdpOK: true });
assert.deepEqual(normalized, {
  session: "active",
  operation: "applying",
  lifecycle: "applying",
  injectorAlive: false,
  cdpOk: true,
  codexRunning: false,
  themeId: "",
  appliedThemeId: "",
});

const blocked = createHealthSnapshot({
  platform: "windows",
  skinVersion: "1.5.12",
  checks: [{
    id: "fixture",
    code: "DS-STATE-002",
    status: "fail",
    message: "fixture failure",
    nextAction: "fixture action",
  }],
});
assert.equal(blocked.pass, false);
assert.equal(blocked.status, "blocked");
assert.equal(blocked.nextAction, "fixture action");

console.log("PASS: runtime Doctor validates shared contracts and normalizes health state.");
