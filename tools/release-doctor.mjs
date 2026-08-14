#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const toolsRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolsRoot, "..");
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const RELEASE_INPUTS = [
  "runtime/compatibility.json",
  "tools/selectors.json",
  "tools/sync-runtime-assets.mjs",
  "macos/VERSION",
  "macos/package.json",
  "macos/LICENSE",
  "macos/NOTICE.md",
  "macos/scripts/build-release.sh",
  "windows/VERSION",
  "windows/installer/node-runtime.json",
  "windows/installer/build-release.ps1",
  "windows/installer/codex-dream-skin.iss",
];

function parseReleaseVersion(value) {
  const version = String(value ?? "").trim();
  return SEMVER_PATTERN.test(version) ? version : null;
}

function releaseVersionFromTag(tag) {
  const value = String(tag ?? "").trim();
  return value.startsWith("v") ? parseReleaseVersion(value.slice(1)) : null;
}

async function readText(root, relativePath) {
  try {
    return await fs.readFile(path.join(root, relativePath), "utf8");
  } catch {
    return null;
  }
}

async function inspectReleaseTree(root = projectRoot, tag = "") {
  const errors = [];
  for (const relativePath of RELEASE_INPUTS) {
    if (await readText(root, relativePath) === null) errors.push(`missing=${relativePath}`);
  }

  const windowsVersion = parseReleaseVersion(await readText(root, "windows/VERSION"));
  const macosVersion = parseReleaseVersion(await readText(root, "macos/VERSION"));
  const packageSource = await readText(root, "macos/package.json");
  let packageVersion = null;
  try {
    packageVersion = parseReleaseVersion(JSON.parse(packageSource ?? "{}").version);
  } catch {
    errors.push("invalid=macos/package.json");
  }
  if (!windowsVersion) errors.push("invalid=windows/VERSION");
  if (!macosVersion) errors.push("invalid=macos/VERSION");
  if (!packageVersion) errors.push("invalid=macos/package.json.version");
  const versions = [windowsVersion, macosVersion, packageVersion].filter(Boolean);
  if (versions.length === 3 && new Set(versions).size !== 1) {
    errors.push(`version-mismatch=${versions.join(",")}`);
  }

  if (tag) {
    const tagVersion = releaseVersionFromTag(tag);
    if (!tagVersion) errors.push(`invalid-tag=${tag}`);
    else if (versions.length === 3 && tagVersion !== versions[0]) {
      errors.push(`tag-version-mismatch=${tag}:${versions[0]}`);
    }
  }

  return {
    ok: errors.length === 0,
    version: versions.length === 3 && new Set(versions).size === 1 ? versions[0] : null,
    errors,
  };
}

export { RELEASE_INPUTS, inspectReleaseTree, parseReleaseVersion, releaseVersionFromTag };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const tagIndex = args.indexOf("--tag");
  if (args.length > 0 && (tagIndex !== 0 || args.length !== 2)) {
    throw new Error("Usage: release-doctor.mjs [--tag vX.Y.Z]");
  }
  const tag = tagIndex === 0 ? args[1] : "";
  const result = await inspectReleaseTree(projectRoot, tag);
  if (!result.ok) {
    for (const error of result.errors) console.error(`release-doctor: ${error}`);
    process.exitCode = 2;
  } else {
    console.log(`Release inputs verified for v${result.version}.`);
  }
}
