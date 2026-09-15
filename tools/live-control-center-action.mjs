import fs from "node:fs/promises";
const action = process.argv[2];
if (!action) throw new Error("Action required");
const state = JSON.parse(await fs.readFile(`${process.env.LOCALAPPDATA}/CodexDreamSkin/control-center.json`, "utf8"));
const response = await fetch(`${state.origin}/api/action`, {
  method: "POST",
  headers: { "X-DreamSkin-Token": state.token, Origin: state.origin, "Content-Type": "application/json" },
  body: JSON.stringify({ action }),
});
console.log(JSON.stringify({ status: response.status, body: await response.text() }));
if (!response.ok) process.exitCode = 1;
