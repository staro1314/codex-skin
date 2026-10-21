import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  LicenseManager,
  MemoryLicenseStore,
  MirroredLicenseStore,
  WindowsDpapiLicenseStore,
  WindowsRegistryLicenseStore,
} from "../control-center/license-manager.mjs";

const identity = { purchaseUrl: "https://example.lemonsqueezy.com/buy/example", storeId: 10, productId: 20, variantId: 30 };

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

test("trial starts only once and expires after 24 continuous hours", async () => {
  let now = Date.parse("2026-10-21T00:00:00Z");
  const store = new MemoryLicenseStore();
  const manager = new LicenseManager({ store, now: () => now });
  const active = await manager.startTrial();
  assert.equal(active.status, "trial_active");
  assert.equal(active.trialRemainingSeconds, 86_400);
  now += 24 * 60 * 60 * 1000;
  assert.equal((await manager.summary()).status, "trial_expired");
  await assert.rejects(() => manager.startTrial(), /已经使用过/);
});

test("trial expires when the system clock moves materially backwards", async () => {
  let now = Date.parse("2026-10-21T12:00:00Z");
  const store = new MemoryLicenseStore();
  const manager = new LicenseManager({ store, now: () => now });
  await manager.startTrial();
  now -= 60 * 60 * 1000;
  const state = await manager.summary();
  assert.equal(state.status, "trial_expired");
  assert.equal(store.value.clockRollbackDetected, true);
});

test("activation verifies product identity and purchaser email", async () => {
  const calls = [];
  const manager = new LicenseManager({
    store: new MemoryLicenseStore(),
    config: identity,
    fetchImpl: async (url, options) => {
      calls.push([url, String(options.body)]);
      return jsonResponse({
        activated: true,
        license_key: { status: "active" },
        instance: { id: "instance-1" },
        meta: { store_id: 10, product_id: 20, variant_id: 30, customer_email: "buyer@example.com" },
      });
    },
  });
  const state = await manager.activate({ licenseKey: "12345678-1234-1234-1234", email: "BUYER@example.com", instanceName: "PC" });
  assert.equal(state.status, "pro_licensed");
  assert.match(calls[0][0], /licenses\/activate$/u);
});

test("license deactivation preserves a device's consumed trial receipt", async () => {
  const store = new MemoryLicenseStore({
    schema: "dreamskin-license/1",
    kind: "trial",
    trialStartedAt: "2026-10-20T00:00:00.000Z",
    trialEndsAt: "2026-10-21T00:00:00.000Z",
    lastSeenAt: "2026-10-21T00:00:00.000Z",
  });
  const fetchImpl = async (url) => url.endsWith("/deactivate")
    ? jsonResponse({ deactivated: true })
    : jsonResponse({
      activated: true,
      license_key: { status: "active" },
      instance: { id: "instance-1" },
      meta: { store_id: 10, product_id: 20, variant_id: 30, customer_email: "buyer@example.com" },
    });
  const manager = new LicenseManager({ store, config: identity, fetchImpl });
  await manager.activate({ licenseKey: "12345678-1234-1234-1234", email: "buyer@example.com" });
  await manager.deactivate();
  await assert.rejects(() => manager.startTrial(), /已经使用过/);
});

test("activation rejects another product", async () => {
  const actions = [];
  const manager = new LicenseManager({
    store: new MemoryLicenseStore(),
    config: identity,
    fetchImpl: async (url) => {
      actions.push(url.split("/").at(-1));
      return url.endsWith("/deactivate")
        ? jsonResponse({ deactivated: true })
        : jsonResponse({
          activated: true,
          license_key: { status: "active" },
          instance: { id: "instance-1" },
          meta: { store_id: 10, product_id: 999, variant_id: 30, customer_email: "buyer@example.com" },
        });
    },
  });
  await assert.rejects(
    () => manager.activate({ licenseKey: "12345678-1234-1234-1234", email: "buyer@example.com" }),
    /不属于当前/,
  );
  assert.deepEqual(actions, ["activate", "deactivate"]);
});

test("licensed state keeps a bounded offline grace period", async () => {
  let now = Date.parse("2026-10-21T00:00:00Z");
  const store = new MemoryLicenseStore({
    schema: "dreamskin-license/1",
    kind: "licensed",
    licenseKey: "12345678-1234-1234-1234",
    instanceId: "instance-1",
    providerStatus: "active",
    lastValidatedAt: new Date(now).toISOString(),
    nextValidationAt: new Date(now).toISOString(),
  });
  const manager = new LicenseManager({
    store,
    config: identity,
    now: () => now,
    fetchImpl: async () => { throw new Error("offline"); },
  });
  assert.equal((await manager.validate({ force: true })).status, "pro_licensed");
  now += 31 * 24 * 60 * 60 * 1000;
  await assert.rejects(() => manager.validate({ force: true }), /无法连接许可证服务/);
});

test("advanced feature gate rejects free mode", async () => {
  const manager = new LicenseManager({ store: new MemoryLicenseStore(), config: identity });
  await assert.rejects(() => manager.requirePro("视频背景"), (error) => error.status === 402);
});

test("unconfigured commerce keeps existing advanced features available", async () => {
  const manager = new LicenseManager({ store: new MemoryLicenseStore() });
  assert.equal((await manager.requirePro("视频背景")).pro, true);
  assert.equal((await manager.summary()).enforcementEnabled, false);
});

test("Windows secure store persists only protected bytes", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dreamskin-license-store-"));
  const filePath = path.join(root, "license-state.dpapi");
  const store = new WindowsDpapiLicenseStore({
    filePath,
    protect: async (value) => Buffer.from(`protected:${value}`).toString("base64"),
    unprotect: async (value) => Buffer.from(value, "base64").toString("utf8").replace(/^protected:/u, ""),
  });
  try {
    const value = { schema: "dreamskin-license/1", kind: "licensed", licenseKey: "secret-license" };
    await store.save(value);
    assert.deepEqual(await store.load(), value);
    assert.doesNotMatch(await fs.readFile(filePath, "utf8"), /secret-license/u);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("mirrored storage restores a deleted trial receipt from the surviving anchor", async () => {
  const file = new MemoryLicenseStore();
  const registry = new MemoryLicenseStore();
  const store = new MirroredLicenseStore([file, registry]);
  const manager = new LicenseManager({ store, now: () => Date.parse("2026-10-21T00:00:00Z") });
  await manager.startTrial();

  file.value = null;
  assert.equal((await manager.summary()).status, "trial_active");
  assert.equal(file.value.trialStartedAt, registry.value.trialStartedAt);

  registry.value = null;
  assert.equal((await manager.summary()).status, "trial_active");
  assert.equal(registry.value.trialStartedAt, file.value.trialStartedAt);
});

test("mirrored storage keeps the earliest trial receipt and strict rollback marker on conflict", async () => {
  const file = new MemoryLicenseStore({
    schema: "dreamskin-license/1",
    kind: "trial",
    trialStartedAt: "2026-10-21T01:00:00.000Z",
    trialEndsAt: "2026-10-22T01:00:00.000Z",
    lastSeenAt: "2026-10-21T02:00:00.000Z",
  });
  const registry = new MemoryLicenseStore({
    schema: "dreamskin-license/1",
    kind: "trial",
    trialStartedAt: "2026-10-20T01:00:00.000Z",
    trialEndsAt: "2026-10-21T01:00:00.000Z",
    lastSeenAt: "2026-10-21T01:30:00.000Z",
    clockRollbackDetected: true,
  });
  const value = await new MirroredLicenseStore([file, registry]).load();
  assert.equal(value.trialStartedAt, "2026-10-20T01:00:00.000Z");
  assert.equal(value.trialEndsAt, "2026-10-21T01:00:00.000Z");
  assert.equal(value.clockRollbackDetected, true);
  assert.equal(file.value.storageRecoveryDetected, true);
  assert.deepEqual(file.value, registry.value);
});

test("Windows registry receipt stores only DPAPI-protected text", async () => {
  let persisted = "";
  const store = new WindowsRegistryLicenseStore({
    protect: async (value) => Buffer.from(`protected:${value}`).toString("base64"),
    unprotect: async (value) => Buffer.from(value, "base64").toString("utf8").replace(/^protected:/u, ""),
    read: async () => persisted,
    write: async (value) => { persisted = value; },
  });
  const value = { schema: "dreamskin-license/1", kind: "trial", trialStartedAt: "2026-10-21T00:00:00.000Z" };
  await store.save(value);
  assert.doesNotMatch(persisted, /trialStartedAt/u);
  assert.deepEqual(await store.load(), value);
});

test("signed offline license is bound to the current machine", async () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
  const payload = Buffer.from(JSON.stringify({
    version: 1,
    product: "codex-skin-pro",
    licenseId: "AFDIAN-ORDER-1",
    machineCode: "AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-0000-1111",
    issuedAt: "2026-10-21T00:00:00.000Z",
    expiresAt: null,
  }));
  const token = `${payload.toString("base64url")}.${sign(null, payload, privateKey).toString("base64url")}`;
  const store = new MemoryLicenseStore();
  const manager = new LicenseManager({
    store,
    config: { provider: "offline_signed", purchaseUrl: "https://afdian.com/a/example", publicKeyPem },
    machineCode: async () => "AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-0000-1111",
  });
  assert.equal((await manager.activate({ licenseKey: token })).status, "pro_licensed");
  assert.equal((await manager.requirePro("视频背景")).pro, true);

  const otherMachine = new LicenseManager({
    store: new MemoryLicenseStore(),
    config: { provider: "offline_signed", purchaseUrl: "https://afdian.com/a/example", publicKeyPem },
    machineCode: async () => "2222-3333-4444-5555-6666-7777-8888-9999",
  });
  await assert.rejects(() => otherMachine.activate({ licenseKey: token }), /当前设备不匹配/);
});
