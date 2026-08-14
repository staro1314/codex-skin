import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertUniqueCdpTargets as assertUniqueMacTargets,
  browserIdFromVersion,
  isFreshBusyOperation,
  normalizeOperationState,
} from "../scripts/injector.mjs";
import { assertUniqueCdpTargets as assertUniqueWindowsTargets } from "../../windows/scripts/injector.mjs";

const macosRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("macOS CDP browser identity accepts only the exact loopback browser endpoint", () => {
  assert.equal(browserIdFromVersion({
    webSocketDebuggerUrl: "ws://127.0.0.1:9341/devtools/browser/browser-123",
  }, 9341), "browser-123");
  assert.throws(() => browserIdFromVersion({
    webSocketDebuggerUrl: "ws://127.0.0.1:9341/devtools/page/browser-123",
  }, 9341), /browser identity/);
  assert.throws(() => browserIdFromVersion({
    webSocketDebuggerUrl: "ws://example.com:9341/devtools/browser/browser-123",
  }, 9341), /loopback/);
});

test("macOS lifecycle carries one Browser ID lease through state and injector calls", async () => {
  const files = await Promise.all([
    "common-macos.sh",
    "start-dream-skin-macos.sh",
    "verify-dream-skin-macos.sh",
    "pause-dream-skin-macos.sh",
    "restore-dream-skin-macos.sh",
    "switch-theme-macos.sh",
    "doctor-macos.sh",
    "apply-community-theme-macos.sh",
    "status-dream-skin-macos.sh",
    "injector.mjs",
  ].map(async (name) => [name, await fs.readFile(path.join(macosRoot, "scripts", name), "utf8")]));
  const source = Object.fromEntries(files);
  assert.match(source["common-macos.sh"], /schemaVersion:\s*5/);
  assert.match(source["common-macos.sh"], /browserId,/);
  assert.match(source["common-macos.sh"], /--watch --port "\$port" --browser-id "\$browser_id"/);
  assert.match(source["status-dream-skin-macos.sh"], /--port \$expected_port --browser-id \$expected_browser_id --theme-dir/);
  assert.match(source["start-dream-skin-macos.sh"], /write_state[^\n]+applying "\$BROWSER_ID"/);
  assert.match(source["injector.mjs"], /--browser-id is required/);
  assert.match(source["injector.mjs"], /connectBrowserIdentityAnchor\(options\.port, options\.browserId\)/);
  for (const name of [
    "verify-dream-skin-macos.sh",
    "pause-dream-skin-macos.sh",
    "restore-dream-skin-macos.sh",
    "switch-theme-macos.sh",
    "doctor-macos.sh",
    "apply-community-theme-macos.sh",
  ]) {
    assert.match(source[name], /--browser-id/, `${name} must pass the Browser ID lease`);
  }
});

test("macOS operation state fails closed on malformed or expired operations", () => {
  const valid = {
    operationToken: "42:1735689600123:7",
    status: "applying",
    message: "working",
    updatedAt: 1_735_689_600,
  };
  assert.deepEqual(normalizeOperationState(valid), {
    token: valid.operationToken,
    status: valid.status,
    message: valid.message,
    updatedAt: valid.updatedAt,
  });
  assert.equal(isFreshBusyOperation(normalizeOperationState(valid), 1_735_689_600_000), true);
  assert.equal(isFreshBusyOperation(normalizeOperationState(valid), 1_735_689_780_001), false);
  assert.equal(isFreshBusyOperation(normalizeOperationState(valid), 1_735_689_594_999), false);
  for (const malformed of [
    { ...valid, operationToken: "old" },
    { ...valid, status: "unknown" },
    { ...valid, updatedAt: 0 },
    { ...valid, updatedAt: "not-a-time" },
    null,
  ]) {
    assert.equal(normalizeOperationState(malformed), null);
  }
  assert.equal(isFreshBusyOperation({ ...valid, token: "old" }, 1_735_689_600_000), false);
});

test("both injectors fail closed on duplicate CDP page targets", () => {
  const targets = [{ id: "page-1" }, { id: "page-2" }];
  assert.deepEqual(assertUniqueMacTargets(targets), targets);
  assert.deepEqual(assertUniqueWindowsTargets(targets), targets);
  for (const assertUnique of [assertUniqueMacTargets, assertUniqueWindowsTargets]) {
    assert.throws(
      () => assertUnique([{ id: "page-1" }, { id: "page-1" }]),
      /duplicate page target id/,
    );
    assert.throws(
      () => assertUnique([{ id: "page-1" }, {}]),
      /duplicate page target id|<missing>/,
    );
  }
});
