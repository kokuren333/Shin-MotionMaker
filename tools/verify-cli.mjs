import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const repository = fileURLToPath(new URL("../", import.meta.url));
const workspace = ".agent-work/cli-evidence";
const job = `${workspace}/jobs/CLI & 全角 空白`;
const records = [];
async function run(args, cwd = repository, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8").on("data", (text) => { stdout += text; });
    child.stderr.setEncoding("utf8").on("data", (text) => { stderr += text; });
    child.once("error", reject); child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}
const commandText = (args) => "node " + args.map((arg) => /[\s&]/.test(arg) ? JSON.stringify(arg) : arg).join(" ");
async function cli(args, expected = 0, env) {
  console.log(`実行: ${args[0]} ${args[1] ?? ""}`);
  const result = await run(["dist/cli/main.js", ...args], repository, env);
  assert.equal(result.code, expected, result.stdout + result.stderr);
  const envelope = JSON.parse(result.stdout);
  assert.equal(result.stdout.trim().split("\n").length, 1);
  records.push({ command: commandText(["dist/cli/main.js", ...args]), exit_code: result.code, ok: envelope.ok,
    ...(envelope.ok ? { verdict: envelope.result?.verdict ?? null, advisories: envelope.advisories.length } : { error: envelope.error.code }),
    ...(envelope.run ? { run: { id: envelope.run.id, status: envelope.run.status, exit_code: envelope.run.exit_code, script_exit_code: envelope.run.script_exit_code ?? null } } : {}) });
  return envelope;
}
async function raw(script, args, expected, label, env, targetJob = job) {
  console.log(`実測: ${script} — ${label}`);
  const result = await run([`scripts/${script}.mjs`, ...args], path.join(repository, targetJob, "runtime"), env);
  assert.equal(result.code, expected, result.stdout + result.stderr);
  records.push({ script: `${script}.mjs`, args, scenario: label, script_exit_code: result.code,
    stdout: result.stdout.trim().split(/\r?\n/).filter(Boolean).slice(0, 3).map(redact),
    stderr: result.stderr.trim().split(/\r?\n/).filter(Boolean).slice(0, 3).map(redact) });
}
function redact(text) { return text.split(repository).join("<repo>").split(repository.replaceAll("\\", "/")).join("<repo>"); }
const evidenceRoot = path.resolve(repository, workspace);
assert.equal(path.dirname(evidenceRoot), path.join(repository, ".agent-work"));
assert.equal(path.basename(evidenceRoot), "cli-evidence");
await fs.rm(evidenceRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
await fs.mkdir(evidenceRoot, { recursive: true });
// A fresh workspace keeps evidence reproducible without overwriting a user's job.
await fs.writeFile(path.join(repository, workspace, "request.json"), "\uFEFF" + JSON.stringify({ form: { title: "CLI & 全角 空白", description: "CLI の実動確認", audience: "開発者", voiceEngine: "none", generateAudio: false } }));
await cli(["version"]);
await cli(["schema"]);
await cli(["schema", "request"]);
await cli(["schema", "version"]);
await cli(["candidates", "--mode", "explanation", "--seed", "42", "--count", "3"]);
await fs.writeFile(path.join(repository, workspace, "text.txt"), "# 導入\n光が分かれます。\n");
await cli(["stats", `${workspace}/text.txt`, "--kind", "script", "--request", `${workspace}/request.json`]);
await cli(["generate", `${workspace}/request.json`, "--out", `${workspace}/dry`, "--dry-run"]);
await cli(["generate", `${workspace}/request.json`, "--out", `${workspace}/jobs`]);
await cli(["generate", `${workspace}/request.json`, "--out", `${workspace}/archives`, "--zip"]);
await cli(["generate", `${workspace}/request.json`, "--out", `${workspace}/jobs`], 2);
await cli(["status", job]);
const project = await cli(["project", "get", job]);
await cli(["project", "get", job, "--pointer", "/title"]);
await fs.writeFile(path.join(repository, workspace, "patch.json"), '{"description":"CLI の更新確認"}\n');
await cli(["project", "patch", job, `${workspace}/patch.json`, "--expect-sha256", project.result.sha256]);
await cli(["report", job, "brief.md"]);
await cli(["doctor", job]);
await cli(["mcp", "serve", "--root", workspace], 3);
await cli(["validate", job], 3);
await raw("validate", [], 1, "依存未導入の TypeScript 検査エラー");
await raw("qc", ["--stage=invalid"], 2, "不正 stage");
await raw("qc", ["--stage=pre"], 1, "制作記録のない解説");
await cli(["qc", job, "--stage", "pre"], 1);
const detached = await cli(["qc", job, "--stage", "pre", "--detach"]);
const id = detached.run.id;
await cli(["runs", "wait", job, id], 1);
await cli(["runs", "list", job]);
await cli(["runs", "get", job, id]);
await cli(["runs", "logs", job, id]);
await cli(["runs", "cancel", job, id]);
await raw("aivis", [], 0, "voice.engine none");
await cli(["voice", job]);
const projectFile = path.join(repository, job, "project.json");
const saved = JSON.parse(await fs.readFile(projectFile, "utf8"));
await fs.writeFile(projectFile, JSON.stringify({ ...saved, voice: { ...saved.voice, engine: "unsupported" } }));
await raw("aivis", [], 1, "未対応 voice.engine");
await cli(["voice", job], 2);
await fs.writeFile(projectFile, JSON.stringify(saved));
await raw("sound-design", [], 0, "音響生成無効");
await cli(["sound", job]);
await fs.writeFile(projectFile, JSON.stringify({ ...saved, audio: { ...saved.audio, generate_bgm_se: true } }));
await fs.writeFile(path.join(repository, job, "plan/sound-design.json"), '{"cues":[]}');
await raw("sound-design", [], 1, "空の cues");
await cli(["sound", job], 2);
await fs.writeFile(path.join(repository, job, "plan/sound-design.json"), JSON.stringify({ cues: [{ id: "chime", kind: "chime", start_sec: 0, duration_sec: 0.1 }] }));
await raw("sound-design", [], 0, "有効な cue から WAV 合成");
await cli(["sound", job]);
await fs.writeFile(projectFile, JSON.stringify(saved));
await raw("ghost-check", ["--target=preview"], 1, "動画不在");
await cli(["ghost-check", job, "--target", "preview"], 2);
await raw("run", ["unknown"], 1, "不正 mode");
await raw("run", ["preview"], 1, "Remotion 依存未導入");
await cli(["render", job, "--target", "preview"], 3);
const absentCodex = { ...process.env, CODEX_BIN: path.join(repository, workspace, "missing-codex") };
await raw("imagegen", ["--name", "raw-skipped", "--prompt", "抽象図"], 0, "Codex 不在の SKIPPED", absentCodex);
await raw("imagegen", ["--name", "raw-strict", "--prompt", "抽象図", "--strict"], 1, "Codex 不在の strict SKIPPED", absentCodex);
await raw("imagegen", [], 1, "必要引数不在");
await cli(["imagegen", job, "--name", "skipped", "--prompt", "抽象図"], 0, absentCodex);
await cli(["imagegen", job, "--name", "strict", "--prompt", "抽象図", "--strict"], 1, absentCodex);
const qcReport = path.join(repository, job, "reports/qc-review.md");
await fs.mkdir(qcReport);
await raw("qc", ["--stage=pre"], 2, "制作記録の読取対象がディレクトリ");
await cli(["qc", job, "--stage", "pre"], 4);
await fs.rmdir(qcReport);
const current = JSON.parse(await fs.readFile(projectFile, "utf8"));
current.mode = "mv";
await fs.writeFile(projectFile, JSON.stringify(current));
await raw("qc", ["--stage=pre"], 0, "MV の QC 対象外");
await cli(["qc", job, "--stage", "pre"]);
const fixture = await run(["--experimental-strip-types", "tools/make-fixture.ts", "--style=anime", "--qc=pass", `--out=${workspace}/synthetic`]);
assert.equal(fixture.code, 0, fixture.stderr);
const syntheticJob = `${workspace}/synthetic/smoke-video`;
await raw("qc", ["--stage=pre"], 0, "検証専用の合成記録による QC pass", process.env, syntheticJob);
await cli(["qc", syntheticJob, "--stage", "pre"]);
await fs.mkdir(path.join(repository, "docs/work/M2b"), { recursive: true });
await fs.writeFile(path.join(repository, "docs/work/M2b/CLI-EXAMPLES.json"), JSON.stringify({ node: process.version, platform: process.platform, records }, null, 2) + "\n");
console.log(JSON.stringify({ records: records.length, output: "docs/work/M2b/CLI-EXAMPLES.json" }));
