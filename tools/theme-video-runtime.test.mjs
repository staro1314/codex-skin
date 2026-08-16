import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { installVideoBlob, loadPayload } from "../windows/scripts/injector.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codex-dream-skin-video-runtime-"));
const tinyMp4 = Buffer.from("000000186674797069736f6d00000200", "hex");

test.after(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

test("video renderer payload stays small while CDP transfers a validated video into a renderer blob", async () => {
  const themeRoot = path.join(tempRoot, "video-theme");
  await fs.mkdir(themeRoot);
  const theme = JSON.parse(await fs.readFile(path.join(projectRoot, "windows", "assets", "theme.json"), "utf8"));
  theme.video = { src: "background.mp4", performance: "balanced" };
  const videoBytes = Buffer.alloc(400_000, 0x5a);
  await Promise.all([
    fs.copyFile(
      path.join(projectRoot, "windows", "assets", "dream-reference.jpg"),
      path.join(themeRoot, "dream-reference.jpg"),
    ),
    fs.writeFile(path.join(themeRoot, "background.mp4"), Buffer.concat([tinyMp4, videoBytes])),
    fs.writeFile(path.join(themeRoot, "theme.json"), `${JSON.stringify(theme)}\n`),
  ]);

  const loaded = await loadPayload(themeRoot);

  assert.match(loaded.theme.video.src, /^file:\/\//);
  assert.doesNotMatch(loaded.payload, /data:video\//);
  assert.doesNotMatch(loaded.payload, /0000001866747970/);

  const calls = [];
  const session = {
    async evaluate(expression) {
      calls.push(expression);
      if (calls.length === 1 || expression.includes(".finish()")) return true;
      return calls.length;
    },
  };
  const transferred = await installVideoBlob(session, loaded);
  assert.equal(transferred, true);
  assert.match(calls[0], /video\/mp4/);
  assert.match(calls.at(-1), /\.finish\(\)/);
  const chunks = calls.slice(1, -1).map((expression) => {
    const argument = /\.chunk\((.*)\)$/.exec(expression)?.[1];
    assert.ok(argument, "Each CDP video transfer call must carry one base64 chunk");
    return Buffer.from(JSON.parse(argument), "base64");
  });
  assert.deepEqual(Buffer.concat(chunks), Buffer.concat([tinyMp4, videoBytes]));
  assert.doesNotMatch(calls.join("\n"), /data:video\//);
});
