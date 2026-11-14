import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { findFfmpeg } from "../dist/host/index.js";

const repository = fileURLToPath(new URL("../", import.meta.url));
const workspace = ".agent-work/cli-tier-b";
const job = `${workspace}/jobs/Tier B & 全角 空白`;
const records = [];
async function run(file, args, cwd = repository, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd, env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8").on("data", (text) => { stdout += text; });
    child.stderr.setEncoding("utf8").on("data", (text) => { stderr += text; });
    child.once("error", reject); child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}
async function cli(args, expected = 0) {
  console.log(`実行: ${args[0]} ${args[1] ?? ""}`);
  const result = await run(process.execPath, ["dist/cli/main.js", ...args]);
  assert.equal(result.code, expected, result.stdout + result.stderr);
  const envelope = JSON.parse(result.stdout);
  records.push({ command: "node " + ["dist/cli/main.js", ...args].map((arg) => /[\s&]/.test(arg) ? JSON.stringify(arg) : arg).join(" "), exit_code: result.code, ok: envelope.ok,
    ...(envelope.ok ? { verdict: envelope.result?.verdict ?? null, advisories: envelope.advisories.length } : { error: envelope.error.code }),
    ...(envelope.run ? { status: envelope.run.status, script_exit_code: envelope.run.script_exit_code } : {}) });
  return envelope;
}
async function raw(script, args, expected, scenario) {
  console.log(`実測: ${script} — ${scenario}`);
  const result = await run(process.execPath, [`scripts/${script}.mjs`, ...args], path.join(repository, job, "runtime"));
  assert.equal(result.code, expected, result.stdout + result.stderr);
  records.push({ script: `${script}.mjs`, args, scenario, script_exit_code: result.code, completion_stdout: /Structural checks passed/.test(result.stdout), check_error: /^[^:\r\n]+: .+/m.test(result.stderr) });
}
await fs.mkdir(path.join(repository, workspace), { recursive: true });
const request = { form: { title: "Tier B & 全角 空白", description: "実依存の構造検査", audience: "開発者", voiceEngine: "none", generateAudio: false } };
await fs.writeFile(path.join(repository, workspace, "request.json"), JSON.stringify(request));
try { await fs.access(path.join(repository, job, "project.json")); }
catch { await cli(["generate", `${workspace}/request.json`, "--out", `${workspace}/jobs`]); }
await cli(["setup", job]);
await raw("validate", [], 0, "R4 の構造検査完了");
await cli(["validate", job]);
const projectFile = path.join(repository, job, "project.json");
const project = JSON.parse(await fs.readFile(projectFile, "utf8"));
await fs.writeFile(projectFile, JSON.stringify({ ...project, title: "" }));
await raw("validate", [], 1, "R4 の構造検査不合格");
await cli(["validate", job], 1);
await fs.writeFile(projectFile, JSON.stringify(project));
const scriptFile = path.join(repository, job, "runtime/scripts/validate.mjs");
const patched = await fs.readFile(scriptFile, "utf8");
const diffs = JSON.parse(await fs.readFile(path.join(repository, "tests/fixtures/baseline-biimmotion-262c798/allowed-diffs.json"), "utf8"));
const rule = diffs.rules.find((entry) => entry.id === "R4");
let original = patched;
for (const append of rule.appends) { assert.ok(original.endsWith(append.text)); original = original.slice(0, -append.text.length); }
for (const pair of [...rule.replacements].reverse()) original = original.replaceAll(pair.to, pair.from);
await fs.writeFile(scriptFile, original);
const legacy = { ...project, schema_version: "0.4" }; delete legacy.generator;
await fs.writeFile(projectFile, JSON.stringify(legacy));
await fs.unlink(path.join(repository, job, "reports/validate.json"));
await raw("validate", [], 0, "原典0.4の完了 stdout");
await cli(["validate", job]);
await fs.writeFile(projectFile, JSON.stringify({ ...legacy, title: "" }));
await raw("validate", [], 1, "原典0.4の OK 行と検査エラー");
await cli(["validate", job], 1);
await fs.writeFile(projectFile, JSON.stringify(project)); await fs.writeFile(scriptFile, patched);
const ffmpeg = await findFfmpeg(path.join(repository, job)); assert.ok(ffmpeg, "ffmpeg is required for the real ghost scan evidence");
await fs.mkdir(path.join(repository, job, "output"), { recursive: true });
const video = path.join(repository, job, "output/preview.mp4");
const generated = await run(ffmpeg, ["-y", "-f", "lavfi", "-i", "color=c=black:s=64x64:r=30:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", video]);
assert.equal(generated.code, 0, generated.stderr);
await raw("ghost-check", ["--target=preview", "--no-stills"], 0, "実 ffmpeg による走査完了");
await cli(["ghost-check", job, "--target", "preview", "--no-stills"]);
await fs.mkdir(path.join(repository, "docs/work/M2b"), { recursive: true });
await fs.writeFile(path.join(repository, "docs/work/M2b/TIER-B.json"), JSON.stringify({ node: process.version, platform: process.platform, records }, null, 2) + "\n");
console.log(JSON.stringify({ records: records.length, output: "docs/work/M2b/TIER-B.json" }));
