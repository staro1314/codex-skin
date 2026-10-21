import { spawn } from "node:child_process";
import { createHash, randomBytes, verify as verifySignature } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const LICENSE_API = "https://api.lemonsqueezy.com/v1/licenses";

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

function iso(value) {
  return new Date(value).toISOString();
}

function parseTime(value) {
  const time = Date.parse(value ?? "");
  return Number.isFinite(time) ? time : null;
}

function publicState(value, now) {
  const trialEndsAt = parseTime(value.trialEndsAt);
  const lastValidatedAt = parseTime(value.lastValidatedAt);
  const licensed = value.kind === "licensed" && value.providerStatus === "active";
  const trialActive = value.kind === "trial" && value.clockRollbackDetected !== true
    && trialEndsAt !== null && now < trialEndsAt;
  const status = licensed ? "pro_licensed"
    : trialActive ? "trial_active"
      : value.kind === "trial" ? "trial_expired"
        : value.kind === "invalid" ? "license_invalid" : "free";
  return {
    status,
    pro: licensed || trialActive,
    trialStartedAt: value.trialStartedAt ?? null,
    trialEndsAt: value.trialEndsAt ?? null,
    trialRemainingSeconds: trialActive ? Math.max(0, Math.ceil((trialEndsAt - now) / 1000)) : 0,
    lastValidatedAt: lastValidatedAt === null ? null : iso(lastValidatedAt),
    nextValidationAt: value.nextValidationAt ?? null,
    instanceName: value.instanceName ?? null,
    providerStatus: value.providerStatus ?? null,
  };
}

function assertIdentity(payload, config) {
  const meta = payload?.meta ?? {};
  for (const [key, expected] of [
    ["store_id", config.storeId],
    ["product_id", config.productId],
    ["variant_id", config.variantId],
  ]) {
    if (expected !== null && String(meta[key]) !== String(expected)) {
      fail("许可证不属于当前 Codex Skin Pro 商品。", 403);
    }
  }
}

async function postLicense(fetchImpl, action, fields) {
  const body = new URLSearchParams(fields);
  let response;
  try {
    response = await fetchImpl(`${LICENSE_API}/${action}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    throw Object.assign(new Error("暂时无法连接许可证服务，请检查网络后重试。"), { status: 503, cause: error });
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) fail(payload?.error || "许可证服务返回了无效响应。", 502);
  return payload;
}

function runPowerShell(script, input) {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const output = [];
    const errors = [];
    let total = 0;
    const timer = setTimeout(() => child.kill(), 10_000);
    child.stdout.on("data", (chunk) => {
      total += chunk.length;
      if (total > 1024 * 1024) child.kill();
      else output.push(chunk);
    });
    child.stderr.on("data", (chunk) => errors.push(chunk));
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code === 0 && total <= 1024 * 1024) resolve(Buffer.concat(output).toString("utf8").trim());
      else reject(new Error(Buffer.concat(errors).toString("utf8").trim() || "Windows secure storage failed"));
    });
    child.stdin.end(input, "utf8");
  });
}

const PROTECT_SCRIPT = "$v=[Console]::In.ReadToEnd();$b=[Text.Encoding]::UTF8.GetBytes($v);$p=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Convert]::ToBase64String($p))";
const UNPROTECT_SCRIPT = "$v=[Console]::In.ReadToEnd();$p=[Convert]::FromBase64String($v);$b=[Security.Cryptography.ProtectedData]::Unprotect($p,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Text.Encoding]::UTF8.GetString($b))";
const REGISTRY_READ_SCRIPT = "$p='HKCU:\\Software\\CodexDreamSkin\\Licensing';if(Test-Path -LiteralPath $p){$v=Get-ItemPropertyValue -LiteralPath $p -Name State -ErrorAction SilentlyContinue;if($null -ne $v){[Console]::Out.Write([string]$v)}}";
const REGISTRY_WRITE_SCRIPT = "$v=[Console]::In.ReadToEnd();$p='HKCU:\\Software\\CodexDreamSkin\\Licensing';$null=New-Item -Path $p -Force;Set-ItemProperty -LiteralPath $p -Name State -Value $v -Type String";
const MACHINE_ID_SCRIPT = "$g=(Get-ItemPropertyValue -LiteralPath 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography' -Name MachineGuid -ErrorAction Stop);$s=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;[Console]::Out.Write(\"$g|$s\")";

async function defaultProtect(value) {
  return runPowerShell(PROTECT_SCRIPT, value);
}

async function defaultUnprotect(value) {
  return runPowerShell(UNPROTECT_SCRIPT, value);
}

export class LicenseManager {
  constructor({ store, config = {}, fetchImpl = fetch, now = () => Date.now(), machineCode = null }) {
    if (!store?.load || !store?.save) throw new TypeError("LicenseManager requires a secure state store");
    this.store = store;
    this.fetch = fetchImpl;
    this.now = now;
    this.machineCodeProvider = machineCode ?? (async () => {
      const identity = await runPowerShell(MACHINE_ID_SCRIPT, "");
      const digest = createHash("sha256").update(`codex-skin-pro|${identity}`).digest("hex").toUpperCase();
      return digest.slice(0, 32).match(/.{1,4}/gu).join("-");
    });
    this.machineCodePromise = null;
    this.config = {
      provider: config.provider ?? "lemonsqueezy",
      purchaseUrl: typeof config.purchaseUrl === "string" ? config.purchaseUrl : "",
      publicKeyPem: typeof config.publicKeyPem === "string" ? config.publicKeyPem : "",
      productCode: typeof config.productCode === "string" ? config.productCode : "codex-skin-pro",
      storeId: config.storeId ?? null,
      productId: config.productId ?? null,
      variantId: config.variantId ?? null,
      trialHours: config.trialHours ?? 24,
      validationDays: config.validationDays ?? 7,
      offlineGraceDays: config.offlineGraceDays ?? 30,
    };
    this.enforcementEnabled = this.config.provider === "offline_signed"
      ? Boolean(this.config.purchaseUrl && this.config.publicKeyPem)
      : Boolean(this.config.purchaseUrl)
        && [this.config.storeId, this.config.productId, this.config.variantId].every((value) => value !== null);
  }

  machineCode() {
    this.machineCodePromise ??= Promise.resolve(this.machineCodeProvider());
    return this.machineCodePromise;
  }

  async verifyOfflineLicense(token) {
    const parts = String(token ?? "").trim().split(".");
    if (parts.length !== 2 || parts.some((part) => !/^[A-Za-z0-9_-]+$/u.test(part))) fail("许可证格式无效。", 400);
    const payloadBytes = Buffer.from(parts[0], "base64url");
    const signature = Buffer.from(parts[1], "base64url");
    if (payloadBytes.length < 2 || payloadBytes.length > 4096 || signature.length > 256
      || !verifySignature(null, payloadBytes, this.config.publicKeyPem, signature)) fail("许可证签名无效。", 403);
    let payload;
    try { payload = JSON.parse(payloadBytes.toString("utf8")); } catch { fail("许可证内容无效。", 400); }
    if (payload?.version !== 1 || payload.product !== this.config.productCode || typeof payload.licenseId !== "string") {
      fail("许可证不属于当前 Codex Skin Pro 商品。", 403);
    }
    if (payload.machineCode !== await this.machineCode()) fail("许可证与当前设备不匹配。", 403);
    const expiresAt = parseTime(payload.expiresAt);
    if (payload.expiresAt && (expiresAt === null || this.now() >= expiresAt)) fail("许可证已经过期。", 403);
    return payload;
  }

  async read() {
    let value = await this.store.load() ?? { schema: "dreamskin-license/1", kind: "free" };
    const now = this.now();
    if (value.kind === "trial") {
      const lastSeenAt = parseTime(value.lastSeenAt);
      if (lastSeenAt !== null && now + 5 * 60 * 1000 < lastSeenAt) {
        value = { ...value, clockRollbackDetected: true };
        await this.store.save(value);
      } else if (lastSeenAt === null || now > lastSeenAt) {
        value = { ...value, lastSeenAt: iso(now) };
        await this.store.save(value);
      }
    }
    return { value, public: publicState(value, now) };
  }

  async summary() {
    const { public: state } = await this.read();
    return {
      ...state,
      purchaseUrl: this.config.purchaseUrl,
      purchaseAvailable: Boolean(this.config.purchaseUrl),
      enforcementEnabled: this.enforcementEnabled,
      provider: this.config.provider,
      machineCode: this.config.provider === "offline_signed" ? await this.machineCode() : null,
    };
  }

  async startTrial() {
    const { value, public: current } = await this.read();
    if (current.pro) return current;
    if (value.trialStartedAt) fail("此设备已经使用过 Pro 免费体验。", 409);
    const now = this.now();
    const next = {
      schema: "dreamskin-license/1",
      kind: "trial",
      trialStartedAt: iso(now),
      trialEndsAt: iso(now + this.config.trialHours * HOUR_MS),
      lastSeenAt: iso(now),
    };
    await this.store.save(next);
    return publicState(next, now);
  }

  async activate({ licenseKey, email, instanceName }) {
    if (this.config.provider === "offline_signed") {
      if (!this.config.publicKeyPem) fail("Pro 离线授权尚未配置完成。", 503);
      const previous = (await this.read()).value;
      const token = String(licenseKey ?? "").trim();
      const payload = await this.verifyOfflineLicense(token);
      const now = this.now();
      const next = {
        schema: "dreamskin-license/1", kind: "licensed", licenseKey: token,
        instanceName: payload.licenseId, providerStatus: "active", lastValidatedAt: iso(now),
        trialStartedAt: previous.trialStartedAt ?? null, trialEndsAt: previous.trialEndsAt ?? null,
        clockRollbackDetected: previous.clockRollbackDetected === true,
      };
      await this.store.save(next);
      return publicState(next, now);
    }
    if ([this.config.storeId, this.config.productId, this.config.variantId].some((value) => value === null)) {
      fail("Pro 购买与激活尚未配置完成。", 503);
    }
    const key = String(licenseKey ?? "").trim();
    const customerEmail = String(email ?? "").trim().toLowerCase();
    if (key.length < 16 || key.length > 200) fail("请输入有效的许可证。", 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(customerEmail)) fail("请输入购买时使用的邮箱。", 400);
    const name = String(instanceName ?? "").trim() || `Codex Skin ${randomBytes(4).toString("hex")}`;
    if (name.length > 120) fail("设备名称过长。", 400);
    const previous = (await this.read()).value;
    const payload = await postLicense(this.fetch, "activate", { license_key: key, instance_name: name });
    if (!payload.activated || !payload.instance?.id) fail(payload.error || "许可证激活失败。", 409);
    try {
      assertIdentity(payload, this.config);
      if (String(payload.meta?.customer_email ?? "").trim().toLowerCase() !== customerEmail) {
        fail("邮箱与购买记录不一致。", 403);
      }
    } catch (error) {
      await postLicense(this.fetch, "deactivate", { license_key: key, instance_id: payload.instance.id }).catch(() => {});
      throw error;
    }
    const now = this.now();
    const next = {
      schema: "dreamskin-license/1",
      kind: "licensed",
      licenseKey: key,
      instanceId: payload.instance.id,
      instanceName: name,
      providerStatus: payload.license_key?.status ?? "active",
      lastValidatedAt: iso(now),
      nextValidationAt: iso(now + this.config.validationDays * DAY_MS),
      trialStartedAt: previous.trialStartedAt ?? null,
      trialEndsAt: previous.trialEndsAt ?? null,
      clockRollbackDetected: previous.clockRollbackDetected === true,
    };
    await this.store.save(next);
    return publicState(next, now);
  }

  async validate({ force = false } = {}) {
    const { value, public: current } = await this.read();
    if (value.kind !== "licensed" || !value.licenseKey) return current;
    if (this.config.provider === "offline_signed") {
      try {
        await this.verifyOfflineLicense(value.licenseKey);
        return current;
      } catch {
        const next = { ...value, kind: "invalid", providerStatus: "invalid" };
        await this.store.save(next);
        return publicState(next, this.now());
      }
    }
    if (!value.instanceId) return current;
    const now = this.now();
    const nextValidation = parseTime(value.nextValidationAt) ?? 0;
    if (!force && now < nextValidation) return current;
    try {
      const payload = await postLicense(this.fetch, "validate", {
        license_key: value.licenseKey,
        instance_id: value.instanceId,
      });
      assertIdentity(payload, this.config);
      const next = {
        ...value,
        kind: payload.valid && payload.license_key?.status === "active" ? "licensed" : "invalid",
        providerStatus: payload.license_key?.status ?? "invalid",
        lastValidatedAt: iso(now),
        nextValidationAt: iso(now + this.config.validationDays * DAY_MS),
      };
      await this.store.save(next);
      return publicState(next, now);
    } catch (error) {
      const lastValidated = parseTime(value.lastValidatedAt) ?? 0;
      if (now - lastValidated <= this.config.offlineGraceDays * DAY_MS) return current;
      throw error;
    }
  }

  async deactivate() {
    const { value } = await this.read();
    if (this.config.provider !== "offline_signed" && value.kind === "licensed" && value.licenseKey && value.instanceId) {
      const payload = await postLicense(this.fetch, "deactivate", {
        license_key: value.licenseKey,
        instance_id: value.instanceId,
      });
      if (!payload.deactivated) fail(payload.error || "设备许可证停用失败。", 409);
    }
    const next = {
      schema: "dreamskin-license/1",
      kind: value.trialStartedAt ? "trial" : "free",
      trialStartedAt: value.trialStartedAt ?? null,
      trialEndsAt: value.trialEndsAt ?? null,
    };
    await this.store.save(next);
    return publicState(next, this.now());
  }

  async requirePro(feature) {
    // Existing releases stay fully functional until the seller deliberately
    // configures the complete product identity and checkout URL.
    if (!this.enforcementEnabled) return { ...(await this.summary()), pro: true };
    const state = await this.validate();
    if (!state.pro) fail(`${feature} 是 Pro 功能；可先免费体验 24 小时。`, 402);
    return state;
  }
}

export class MemoryLicenseStore {
  constructor(value = null) { this.value = value; }
  async load() { return this.value ? structuredClone(this.value) : null; }
  async save(value) { this.value = structuredClone(value); }
}

function stateTime(value) {
  return Math.max(
    parseTime(value.lastValidatedAt) ?? 0,
    parseTime(value.lastSeenAt) ?? 0,
    parseTime(value.trialStartedAt) ?? 0,
  );
}

function reconcileLicenseStates(values) {
  const latest = [...values].sort((left, right) => stateTime(right) - stateTime(left))[0];
  const trialStarts = values.map((value) => parseTime(value.trialStartedAt)).filter(Number.isFinite);
  const trialEnds = values.map((value) => parseTime(value.trialEndsAt)).filter(Number.isFinite);
  return {
    ...latest,
    trialStartedAt: trialStarts.length ? iso(Math.min(...trialStarts)) : null,
    trialEndsAt: trialEnds.length ? iso(Math.min(...trialEnds)) : null,
    clockRollbackDetected: values.some((value) => value.clockRollbackDetected === true),
    storageRecoveryDetected: true,
  };
}

export class MirroredLicenseStore {
  constructor(stores) {
    if (!Array.isArray(stores) || stores.length < 2 || stores.some((store) => !store?.load || !store?.save)) {
      throw new TypeError("MirroredLicenseStore requires at least two state stores");
    }
    this.stores = stores;
  }

  async load() {
    const results = await Promise.allSettled(this.stores.map((store) => store.load()));
    const values = results.filter((result) => result.status === "fulfilled" && result.value).map((result) => result.value);
    if (!values.length) {
      const failure = results.find((result) => result.status === "rejected");
      if (failure) throw failure.reason;
      return null;
    }
    const canonical = values.length === 1 || values.every((value) => JSON.stringify(value) === JSON.stringify(values[0]))
      ? values[0]
      : reconcileLicenseStates(values);
    const needsRepair = results.some((result) => result.status === "rejected" || !result.value)
      || values.some((value) => JSON.stringify(value) !== JSON.stringify(canonical));
    if (needsRepair) await this.save({ ...canonical, storageRecoveryDetected: true });
    return canonical;
  }

  async save(value) {
    const results = await Promise.allSettled(this.stores.map((store) => store.save(value)));
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
  }
}

export class WindowsRegistryLicenseStore {
  constructor({ protect = defaultProtect, unprotect = defaultUnprotect, read = null, write = null } = {}) {
    this.protect = protect;
    this.unprotect = unprotect;
    this.read = read ?? (() => runPowerShell(REGISTRY_READ_SCRIPT, ""));
    this.write = write ?? ((value) => runPowerShell(REGISTRY_WRITE_SCRIPT, value));
  }

  async load() {
    const encoded = String(await this.read()).trim();
    if (!encoded) return null;
    if (!/^[A-Za-z0-9+/=]+$/u.test(encoded) || encoded.length > 1024 * 1024) {
      throw new Error("Registry license receipt is invalid");
    }
    const value = JSON.parse(await this.unprotect(encoded));
    if (!value || value.schema !== "dreamskin-license/1" || typeof value.kind !== "string") {
      throw new Error("Registry license receipt has an unsupported schema");
    }
    return value;
  }

  async save(value) {
    if (!value || value.schema !== "dreamskin-license/1") throw new TypeError("License state schema is invalid");
    const encoded = await this.protect(JSON.stringify(value));
    if (!/^[A-Za-z0-9+/=]+$/u.test(encoded) || encoded.length > 1024 * 1024) {
      throw new Error("Protected registry license receipt is invalid");
    }
    await this.write(encoded);
  }
}

export class WindowsDpapiLicenseStore {
  constructor({ filePath, protect = defaultProtect, unprotect = defaultUnprotect }) {
    if (!filePath) throw new TypeError("WindowsDpapiLicenseStore requires filePath");
    this.filePath = path.resolve(filePath);
    this.protect = protect;
    this.unprotect = unprotect;
  }

  async load() {
    let encoded;
    try {
      const stat = await fs.lstat(this.filePath);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > 1024 * 1024) {
        throw new Error("License state file is invalid");
      }
      encoded = (await fs.readFile(this.filePath, "utf8")).trim();
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
    const plaintext = await this.unprotect(encoded);
    const value = JSON.parse(plaintext);
    if (!value || value.schema !== "dreamskin-license/1" || typeof value.kind !== "string") {
      throw new Error("License state has an unsupported schema");
    }
    return value;
  }

  async save(value) {
    if (!value || value.schema !== "dreamskin-license/1") throw new TypeError("License state schema is invalid");
    const directory = path.dirname(this.filePath);
    await fs.mkdir(directory, { recursive: true });
    const encoded = await this.protect(JSON.stringify(value));
    if (!/^[A-Za-z0-9+/=]+$/u.test(encoded) || encoded.length > 1024 * 1024) {
      throw new Error("Protected license state is invalid");
    }
    const temporary = `${this.filePath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
    try {
      await fs.writeFile(temporary, `${encoded}\n`, { flag: "wx", mode: 0o600 });
      await fs.rename(temporary, this.filePath);
    } finally {
      await fs.rm(temporary, { force: true }).catch(() => {});
    }
  }
}
