import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectReleaseTree,
  parseReleaseVersion,
  releaseVersionFromTag,
} from "./release-doctor.mjs";

test("release doctor accepts only strict semantic versions and v-tags", () => {
  assert.equal(parseReleaseVersion("1.0.0"), "1.0.0");
  assert.equal(parseReleaseVersion("01.5.12"), null);
  assert.equal(parseReleaseVersion("1.5"), null);
  assert.equal(releaseVersionFromTag("v1.0.0"), "1.0.0");
  assert.equal(releaseVersionFromTag("1.5.12"), null);
});

test("release doctor verifies the checked-out release inputs and versions", async () => {
  const result = await inspectReleaseTree();
  assert.equal(result.ok, true, result.errors.join(", "));
  assert.equal(result.version, "1.0.1");
  const previousTag = await inspectReleaseTree(undefined, "v1.0.0");
  assert.equal(previousTag.ok, false);
  assert.match(previousTag.errors.join("\n"), /tag-version-mismatch=v1\.0\.0:1\.0\.1/);
  const mismatched = await inspectReleaseTree(undefined, "v1.5.13");
  assert.equal(mismatched.ok, false);
  assert.match(mismatched.errors.join("\n"), /tag-version-mismatch/);
});
