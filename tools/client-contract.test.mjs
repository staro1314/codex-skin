import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientRoot = path.join(projectRoot, "windows", "client");

test("native client is an embedded WebView2 host with a single-instance boundary", async () => {
  const [project, program, windowHost, runtime, context] = await Promise.all([
    fs.readFile(path.join(clientRoot, "CodexDreamSkin.Client.csproj"), "utf8"),
    fs.readFile(path.join(clientRoot, "Program.cs"), "utf8"),
    fs.readFile(path.join(clientRoot, "ClientWindow.cs"), "utf8"),
    fs.readFile(path.join(clientRoot, "RuntimeSupervisor.cs"), "utf8"),
    fs.readFile(path.join(clientRoot, "ClientApplicationContext.cs"), "utf8"),
  ]);
  assert.match(project, /TargetFramework>net8\.0-windows/);
  assert.match(project, /UseWindowsForms>true/);
  assert.match(project, /Microsoft\.Web\.WebView2/);
  assert.match(program, /Local\\\\CodexDreamSkin\.Client/);
  assert.match(windowHost, /CoreWebView2Environment\.CreateAsync/);
  assert.match(windowHost, /fixedRuntime/);
  assert.match(windowHost, /不会回退到系统浏览器/);
  assert.match(windowHost, /NavigationStarting/);
  assert.match(windowHost, /NewWindowRequested/);
  assert.match(windowHost, /DownloadStarting/);
  assert.doesNotMatch(windowHost, /Process\.Start/);
  assert.match(runtime, /--embedded/);
  assert.match(runtime, /--runtime-root/);
  assert.match(runtime, /TryReuseExistingAsync/);
  assert.match(context, /NotifyIcon/);
  assert.match(context, /启动 \/ 重新应用 Codex/);
  assert.match(context, /完整恢复官方外观/);
  assert.match(context, /ExitClient/);
});

test("installed entry points target the native client while browser control remains source-only", async () => {
  const [installer, installScript, bootstrap, browserLauncher] = await Promise.all([
    fs.readFile(path.join(projectRoot, "windows", "installer", "codex-dream-skin.iss"), "utf8"),
    fs.readFile(path.join(projectRoot, "windows", "scripts", "install-dream-skin.ps1"), "utf8"),
    fs.readFile(path.join(projectRoot, "windows", "installer", "setup-bootstrap.ps1"), "utf8"),
    fs.readFile(path.join(projectRoot, "control-codex-skin.ps1"), "utf8"),
  ]);
  assert.match(installer, /CodexDreamSkin\\engine\\client\\CodexDreamSkin\.Client\.exe/);
  assert.match(installScript, /\$clientPath|\$engine\.Client/);
  assert.match(bootstrap, /CodexDreamSkin\.Client\.exe/);
  assert.match(browserLauncher, /Start-Process -FilePath "\$\(\$state\.url\)"/);
  assert.match(browserLauncher, /control-center\.json/);
});
