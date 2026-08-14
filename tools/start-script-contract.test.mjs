import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = await fs.readFile(path.join(projectRoot, "start-codex-skin.ps1"), "utf8");

test("root launcher delegates to the verified Windows start path", () => {
  assert.match(script, /windows\\scripts\\start-dream-skin\.ps1/);
  assert.match(script, /tools\\capture-dom-fixture\.mjs/);
  assert.match(script, /\[switch\]\$Capture/);
  assert.match(script, /\[switch\]\$Watch/);
  assert.match(script, /\$Capture -and \$Watch/);
  assert.match(script, /\$PSBoundParameters\.ContainsKey\('Port'\)/);
  assert.match(script, /managedScriptRoot/);
  assert.match(script, /Unblock-File -LiteralPath \$managedScript\.FullName/);
  assert.match(script, /Zone\.Identifier=3/);
  assert.match(script, /-ExecutionPolicy', 'RemoteSigned/);
  assert.doesNotMatch(script, /ExecutionPolicy['\"]\s*,\s*['\"]Bypass/i);
});
