import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  inspectReleaseTree,
  parseReleaseVersion,
  releaseVersionFromTag,
} from "./release-doctor.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonicalVersion = (await fs.readFile(path.join(projectRoot, "VERSION"), "utf8")).trim();

test("release doctor accepts only strict semantic versions and v-tags", () => {
  assert.equal(parseReleaseVersion(canonicalVersion), canonicalVersion);
  assert.equal(parseReleaseVersion("01.5.12"), null);
  assert.equal(parseReleaseVersion("1.5"), null);
  assert.equal(releaseVersionFromTag(`v${canonicalVersion}`), canonicalVersion);
  assert.equal(releaseVersionFromTag(canonicalVersion), null);
});

test("release doctor verifies the checked-out release inputs and versions", async () => {
  const result = await inspectReleaseTree();
  assert.equal(result.ok, true, result.errors.join(", "));
  assert.equal(result.version, canonicalVersion);
  const tagged = await inspectReleaseTree(undefined, `v${canonicalVersion}`);
  assert.equal(tagged.ok, true, tagged.errors.join(", "));
  const mismatched = await inspectReleaseTree(undefined, "v9.9.9");
  assert.equal(mismatched.ok, false);
  assert.match(mismatched.errors.join("\n"), /tag-version-mismatch/);
});
