#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_NODE_MAJOR = 20;
const REQUIRED_FILES = [
  "VERSION",
  "assets/compatibility.json",
  "assets/dream-skin.css",
  "assets/renderer-inject.js",
  "assets/safe-css-policy.json",
  "assets/safe-css-validator.mjs",
  "assets/selectors.json",
  "assets/theme-package-validator.mjs",
  "scripts/injector.mjs",
  "scripts/runtime-doctor.mjs",
  "scripts/validate-safe-css-file.mjs",
];
const EXACT_SHARED_FILES = [
  ["runtime/compatibility.json", "assets/compatibility.json"],
  ["runtime/safe-css-policy.json", "assets/safe-css-policy.json"],
  ["runtime/safe-css-validator.mjs", "assets/safe-css-validator.mjs"],
  ["runtime/theme-package-validator.mjs", "assets/theme-package-validator.mjs"],
  ["tools/selectors.json", "assets/selectors.json"],
];

function parseArgs(argv) {
  const options = { json: false, requireLive: false, checkSync: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") options.json = true;
    else if (arg === "--require-live") options.requireLive = true;
    else if (arg === "--check-sync") options.checkSync = true;
    else if (["--platform", "--project-root", "--platform-root", "--state-file"].includes(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      options[arg.slice(2).replaceAll("-", "")] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function normalizePlatform(value) {
  if (value === "windows" || value === "win32") return "windows";
  if (value === "darwin" || value === "macos") return "darwin";
  throw new Error(`Unsupported platform: ${value}`);
}

function parseMajorVersion(value) {
  const match = String(value ?? "").match(/^v?(\d+)/);
  return match ? Number(match[1]) : 0;
}

function check(id, code, status, message, nextAction = "") {
  return { id, code, status, message, nextAction };
}

function summarizeChecks(checks) {
  if (checks.some((item) => item.status === "fail")) return "blocked";
  if (checks.some((item) => item.status === "warn")) return "degraded";
  return "ready";
}

export function normalizeHealthState(state) {
  const sessionValues = new Set(["unknown", "off", "applying", "active", "paused", "stale"]);
  const operationValues = new Set(["", "applying", "pausing", "success", "paused", "cancelled", "failed"]);
  const session = sessionValues.has(state?.session) ? state.session : "unknown";
  const operation = operationValues.has(state?.operation) ? state.operation : "";
  const lifecycle = operation === "applying" || operation === "pausing" ? operation : session;
  return {
    session,
    operation,
    lifecycle,
    injectorAlive: state?.injectorAlive === true,
    cdpOk: state?.cdpOk === true || state?.cdpOK === true,
    codexRunning: state?.codexRunning === true,
    themeId: typeof state?.themeId === "string" ? state.themeId : "",
    appliedThemeId: typeof state?.appliedThemeId === "string" ? state.appliedThemeId : "",
  };
}

export function createHealthSnapshot({ platform, skinVersion, checks, state = null, healthSchema = "codex-dream-skin/health/1" }) {
  const health = normalizeHealthState(state);
  const status = summarizeChecks(checks);
  const failed = checks.find((item) => item.status === "fail");
  const degraded = checks.find((item) => item.status === "warn");
  const action = failed?.nextAction || degraded?.nextAction || "No action required.";
  return {
    schema: healthSchema,
    pass: status !== "blocked",
    status,
    platform,
    skinVersion,
    session: health.session,
    operation: health.operation,
    lifecycle: health.lifecycle,
    nextAction: action,
    checks,
  };
}

async function readText(file) {
  return fs.readFile(file, "utf8");
}

async function readJson(file) {
  return JSON.parse(await readText(file));
}

async function existsAsFile(file) {
  try {
    return (await fs.stat(file)).isFile();
  } catch {
    return false;
  }
}

async function findProjectRoot(platformRoot, explicitRoot) {
  if (explicitRoot) return path.resolve(explicitRoot);
  const candidate = path.resolve(platformRoot, "..");
  return (await existsAsFile(path.join(candidate, "tools", "sync-runtime-assets.mjs"))) ? candidate : null;
}

async function compareFiles(left, right) {
  try {
    const [a, b] = await Promise.all([fs.readFile(left), fs.readFile(right)]);
    return a.equals(b);
  } catch {
    return false;
  }
}

async function readState(stateFile) {
  if (!stateFile) return { state: null, check: null };
  try {
    const state = await readJson(stateFile);
    if (!state || Array.isArray(state) || typeof state !== "object") {
      return { state: null, check: check("state-shape", "DS-STATE-001", "fail", "The saved Dream Skin state is not an object.", "Restore the official appearance and retry.") };
    }
    return { state, check: check("state-shape", "DS-STATE-001", "pass", "Saved Dream Skin state is readable.") };
  } catch {
    const present = await existsAsFile(stateFile);
    return present
      ? { state: null, check: check("state-shape", "DS-STATE-001", "fail", "The saved Dream Skin state is not valid JSON.", "Restore the official appearance and retry.") }
      : { state: null, check: check("state-shape", "DS-STATE-001", "warn", "No saved Dream Skin session state was found.", "Start Codex through Dream Skin when a live skin session is needed.") };
  }
}

export async function runDoctor({
  platform = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "darwin" : "windows",
  projectRoot: requestedProjectRoot = null,
  platformRoot: requestedPlatformRoot = null,
  stateFile = null,
  requireLive = false,
  checkSync = false,
} = {}) {
  const normalizedPlatform = normalizePlatform(platform);
  const platformRoot = path.resolve(requestedPlatformRoot || path.resolve(here, ".."));
  const projectRoot = await findProjectRoot(platformRoot, requestedProjectRoot);
  const checks = [];
  let compatibility = null;

  const nodeMajor = parseMajorVersion(process.version);
  checks.push(nodeMajor >= DEFAULT_NODE_MAJOR
    ? check("node-runtime", "DS-ENV-002", "pass", `Node.js ${process.version} satisfies the runtime minimum.`)
    : check("node-runtime", "DS-ENV-002", "fail", `Node.js ${process.version} is below the runtime minimum.`, "Use the bundled Node.js runtime or install Node.js 20 or newer."));

  const missing = [];
  for (const relative of REQUIRED_FILES) {
    if (!(await existsAsFile(path.join(platformRoot, relative)))) missing.push(relative);
  }
  checks.push(missing.length === 0
    ? check("platform-files", "DS-ENV-001", "pass", "Required platform runtime files are present.")
    : check("platform-files", "DS-ENV-001", "fail", `Required platform runtime files are missing: ${missing.join(", ")}.`, "Reinstall the Dream Skin runtime from a complete release or source checkout."));

  const compatibilityPath = path.join(platformRoot, "assets", "compatibility.json");
  try {
    compatibility = await readJson(compatibilityPath);
    const platformContract = compatibility.platforms?.[normalizedPlatform];
    if (compatibility.schema !== "codex-dream-skin/compatibility/1" || !platformContract) {
      throw new Error("unsupported compatibility contract");
    }
    checks.push(check("compatibility-contract", "DS-VERSION-001", "pass", `Compatibility contract supports ${normalizedPlatform}.`));
  } catch {
    checks.push(check("compatibility-contract", "DS-VERSION-001", "fail", "The shared compatibility contract is missing or invalid.", "Install matching Windows, macOS, and shared runtime assets."));
  }

  let platformVersion = "unknown";
  try {
    platformVersion = (await readText(path.join(platformRoot, "VERSION"))).trim();
  } catch {
    // The missing platform file check reports the actionable error.
  }
  if (compatibility) {
    checks.push(platformVersion === compatibility.skinVersion
      ? check("platform-version", "DS-VERSION-001", "pass", `Platform version ${platformVersion} matches the compatibility contract.`)
      : check("platform-version", "DS-VERSION-001", "fail", `Platform version ${platformVersion} does not match the compatibility contract.`, "Install matching Windows, macOS, and shared runtime assets."));
  }

  if (projectRoot) {
    const sourceVersionFiles = ["windows/VERSION", "macos/VERSION", "macos/package.json"];
    try {
      const windowsVersion = (await readText(path.join(projectRoot, sourceVersionFiles[0]))).trim();
      const macosVersion = (await readText(path.join(projectRoot, sourceVersionFiles[1]))).trim();
      const packageVersion = (await readJson(path.join(projectRoot, sourceVersionFiles[2]))).version;
      const versions = [windowsVersion, macosVersion, packageVersion];
      checks.push(new Set(versions).size === 1
        ? check("version-parity", "DS-VERSION-001", "pass", `Windows, macOS, and package versions agree at ${windowsVersion}.`)
        : check("version-parity", "DS-VERSION-001", "fail", `Platform version sources disagree: ${versions.join(", ")}.`, "Update all platform version sources together."));
    } catch {
      checks.push(check("version-parity", "DS-VERSION-001", "warn", "The source checkout version matrix is not available from this runtime root.", "Run the Doctor from the repository checkout to validate all version sources."));
    }

    const drift = [];
    for (const [sourceRelative, outputRelative] of EXACT_SHARED_FILES) {
      if (!(await compareFiles(path.join(projectRoot, sourceRelative), path.join(platformRoot, outputRelative)))) {
        drift.push(outputRelative);
      }
    }
    checks.push(drift.length === 0
      ? check("shared-contract-sync", "DS-SYNC-001", "pass", "Shared compatibility, selector, validator, and policy assets are synchronized.")
      : check("shared-contract-sync", "DS-SYNC-001", "fail", `Shared runtime assets are out of date: ${drift.join(", ")}.`, "Run tools/sync-runtime-assets.mjs and rerun the Doctor."));

    if (checkSync) {
      const syncTool = path.join(projectRoot, "tools", "sync-runtime-assets.mjs");
      if (await existsAsFile(syncTool)) {
        const { spawnSync } = await import("node:child_process");
        const result = spawnSync(process.execPath, [syncTool, "--check"], {
          cwd: projectRoot,
          encoding: "utf8",
          windowsHide: true,
        });
        checks.push(result.status === 0
          ? check("sync-tool", "DS-SYNC-001", "pass", "The runtime synchronization check passed.")
          : check("sync-tool", "DS-SYNC-001", "fail", "The runtime synchronization check failed.", "Run tools/sync-runtime-assets.mjs and inspect the reported out-of-date files."));
      } else {
        checks.push(check("sync-tool", "DS-SYNC-001", "warn", "The runtime synchronization tool is not present in this installed engine.", "Run the Doctor from a source checkout for full sync validation."));
      }
    }
  } else if (checkSync) {
    checks.push(check("sync-tool", "DS-SYNC-001", "warn", "The source checkout is not available from this installed engine.", "Run the Doctor from the repository checkout for full sync validation."));
  }

  const stateResult = await readState(stateFile);
  if (stateResult.check) checks.push(stateResult.check);
  const normalizedState = normalizeHealthState(stateResult.state);
  if (stateResult.state && normalizedState.operation === "failed") {
    checks.push(check("last-operation", "DS-RUN-001", "warn", "The last Dream Skin operation failed.", "Read the platform error log, restore the last known good theme, and retry."));
  }
  const live = Boolean(
    stateResult.state
      && normalizedState.session === "active"
      && normalizedState.injectorAlive
      && normalizedState.cdpOk
      && normalizedState.codexRunning,
  );
  if (requireLive) {
    checks.push(live
      ? check("live-session", "DS-STATE-002", "pass", "A live verified Dream Skin session is active.")
      : check("live-session", "DS-STATE-002", "fail", "No live verified Dream Skin session is active.", "Start Codex through Dream Skin, then run the Doctor again."));
  } else if (stateResult.state) {
    checks.push(live
      ? check("live-session", "DS-STATE-002", "pass", "The saved state describes a live verified session.")
      : check("live-session", "DS-STATE-002", "warn", "The saved state does not describe a live verified session.", "Start Codex through Dream Skin when a live skin session is needed."));
  }

  return createHealthSnapshot({
    platform: normalizedPlatform,
    skinVersion: compatibility?.skinVersion || platformVersion,
    checks,
    state: stateResult.state,
    healthSchema: compatibility?.health?.schema || "codex-dream-skin/health/1",
  });
}

function printHuman(report) {
  console.log(`status=${report.status}`);
  console.log(`platform=${report.platform}`);
  console.log(`version=${report.skinVersion}`);
  console.log(`session=${report.session}`);
  console.log(`operation=${report.operation}`);
  for (const item of report.checks) {
    console.log(`check=${item.status} id=${item.id} code=${item.code} message=${item.message}`);
  }
  console.log(`next_action=${report.nextAction}`);
}

if (path.resolve(process.argv[1] || "") === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const report = await runDoctor({
      platform: args.platform,
      projectRoot: args.projectroot,
      platformRoot: args.platformroot,
      stateFile: args.statefile,
      requireLive: args.requireLive,
      checkSync: args.checkSync,
    });
    if (args.json) console.log(JSON.stringify(report, null, 2));
    else printHuman(report);
    process.exitCode = report.pass ? 0 : 1;
  } catch (error) {
    console.error(error?.message || String(error));
    process.exitCode = 2;
  }
}
