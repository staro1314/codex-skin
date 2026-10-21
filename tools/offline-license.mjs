import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function generateKeys() {
  const output = path.resolve(option("out") ?? "private-license-keys");
  await fs.mkdir(output, { recursive: true });
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  await fs.writeFile(path.join(output, "codex-skin-license-private.pem"), privateKey.export({ type: "pkcs8", format: "pem" }), { flag: "wx", mode: 0o600 });
  await fs.writeFile(path.join(output, "codex-skin-license-public.pem"), publicKey.export({ type: "spki", format: "pem" }), { flag: "wx", mode: 0o644 });
  console.log(`密钥已生成：${output}`);
  console.log("私钥文件不得提交、上传或放入安装包。把公钥内容配置到 PRODUCT.json licensing.publicKeyPem。");
}

async function issueLicense() {
  const privateKeyPath = option("private-key");
  const machineCode = option("machine-code");
  const orderId = option("order-id");
  if (!privateKeyPath || !machineCode || !orderId) {
    throw new Error("签发需要 --private-key、--machine-code 和 --order-id");
  }
  if (!/^[A-F0-9]{4}(?:-[A-F0-9]{4}){7}$/u.test(machineCode)) throw new Error("机器码格式无效");
  const payload = Buffer.from(JSON.stringify({
    version: 1,
    product: "codex-skin-pro",
    licenseId: String(orderId).slice(0, 120),
    machineCode,
    issuedAt: new Date().toISOString(),
    expiresAt: option("expires-at") || null,
    nonce: randomUUID(),
  }), "utf8");
  const privateKey = await fs.readFile(path.resolve(privateKeyPath), "utf8");
  const token = `${payload.toString("base64url")}.${sign(null, payload, privateKey).toString("base64url")}`;
  console.log(token);
}

const command = process.argv[2];
if (command === "keygen") await generateKeys();
else if (command === "issue") await issueLicense();
else throw new Error("用法：node tools/offline-license.mjs keygen --out <安全目录>，或 issue --private-key <pem> --machine-code <code> --order-id <id>");
