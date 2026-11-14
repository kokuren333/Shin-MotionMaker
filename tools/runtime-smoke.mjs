import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { prepareRuntimeSmoke } from "./prepare-runtime-smoke.mjs";
import { findBrowser } from "../gui/e2e/browser.mjs";
import { cli, mcp, option, repository, owned, removeOwned, facts, saveEvidence, cancelActiveRuns } from "./verification-lib.mjs";
import { verifyEvidenceState } from "./verification-state.mjs";

const entry = option("entry", "cli");
assert.ok(["cli", "mcp"].includes(entry));
const revision = await verifyEvidenceState(option("commit", process.env.GITHUB_SHA));
const legacy = option("legacy-job");
assert.ok(!legacy || entry === "cli", "原典ジョブの検証は CLI で実行してください。");
const label = legacy ? "legacy" : entry;
const root = owned(path.join(repository, ".agent-work", `m7-runtime-${label}`));
const evidenceFile = path.resolve(option("evidence", path.join(repository, ".agent-work", "m7-evidence", `tier-c-${label}.json`)));
const evidence = { tier: "C", entry, legacy: !!legacy, commit: revision.head, template_version: revision.template_version, revision, platform: process.platform, node: process.version,
  started_at: new Date().toISOString(), records: [], success: false };
await removeOwned(root);
await fs.mkdir(root, { recursive: true });
let connection, job;
const start = Date.now();
try {
  if (entry === "mcp") connection = await mcp(root);
  const request = { form: { title: "Runtime & ＆（全角）　・ 空白", description: "枠・字幕・3D・音響の動作確認", audience: "開発者",
    width: 640, height: 360, durationSec: 30, voiceEngine: "none", generateAudio: true, imageGeneration: false } };
  if (legacy) {
    job = "Legacy & ＆（全角）　・ 空白";
    await fs.cp(path.resolve(legacy), path.join(root, job), { recursive: true,
      filter: (source) => !["node_modules", ".smm", "output"].includes(path.basename(source)) });
    const project = JSON.parse(await fs.readFile(path.join(root, job, "project.json"), "utf8"));
    assert.equal(project.schema_version, "0.4"); assert.equal(project.generator, undefined);
    evidence.origin = "BiimMotion 262c798 tools/generate-job.ts";
  } else if (entry === "cli") {
    await fs.writeFile(path.join(root, "request.json"), JSON.stringify(request));
    const generated = await cli(["generate", "request.json", "--out", "jobs"], root);
    assert.equal(generated.code, 0, generated.stdout + generated.stderr); job = generated.envelope.result.job;
    evidence.generation = generated.envelope.result;
  } else {
    const generated = await connection.call("job_generate", { request, out: "jobs" });
    assert.ok(generated.ok, JSON.stringify(generated)); job = generated.result.job;
    evidence.generation = generated.result;
  }
  evidence.job = job;
  await prepareRuntimeSmoke(path.join(root, job));
  const browser = findBrowser();
  // Explicitly use an already installed browser; Remotion must never download one here.
  const config = path.join(root, job, "runtime/remotion.config.ts");
  await fs.appendFile(config, `\nConfig.setBrowserExecutable(${JSON.stringify(browser)});\nConfig.setConcurrency(2);\n`);
  evidence.fixture = await facts(path.join(root, job), ["project.json", "assets/character.glb", "plan/sound-design.json", "runtime/remotion.config.ts", "runtime/scripts/validate.mjs"]);
  const run = async (kind, args = [], input = {}, expected = 0) => {
    console.log(`実行: ${label} ${kind} ${input.target ?? ""}`);
    const began = Date.now();
    let current, polls = 0, command, cliExit;
    if (entry === "cli") {
      command = [kind, job, ...args];
      const result = await cli(command, root);
      current = result.envelope;
      cliExit = result.code;
    } else {
      command = { name: `job_${kind.replaceAll("-", "_")}`, arguments: { job, ...input, wait_ms: 0 } };
      current = await connection.call(command.name, command.arguments);
      assert.ok(current.ok && current.run, JSON.stringify(current));
      const id = current.run.id;
      do {
        current = await connection.call("run_get", { job, run_id: id, wait_ms: 50000, log_tail: 20 });
        polls++;
        console.log(`取得: ${kind} ${current.run?.status}`);
      } while (current.run?.status === "running");
    }
    const logNames = current.run ? ["stdout", "stderr"].map((stream) => `.smm/runs/${current.run.id}/${stream}.log`) : [];
    const logs = current.run ? await facts(path.join(root, job), logNames) : [];
    for (const log of logs) log.tail = (await fs.readFile(path.join(root, job, log.path), "utf8")).split(/\r?\n/).slice(-30);
    evidence.records.push({ command, cli_exit_code: cliExit ?? null, polling: polls ? { count: polls, wait_ms: 50000 } : null,
      elapsed_ms: Date.now() - began, run: current.run, result: current.result,
      error: current.error ?? null, logs, artifacts: current.run ? await facts(path.join(root, job), current.run.artifacts) : [] });
    if (entry === "cli") assert.equal(cliExit, expected, JSON.stringify(current));
    assert.ok(current.ok, JSON.stringify(current));
    assert.equal(current.run.status, "completed", JSON.stringify(current));
    assert.equal(current.run.exit_code, expected, JSON.stringify(current));
    return current;
  };
  await run("setup");
  if (legacy) {
    const status = await cli(["status", job], root);
    assert.equal(status.code, 0); assert.equal(status.envelope.result.job.generator, null);
    evidence.status = status.envelope.result;
  }
  await run("sound");
  const validated = await run("validate");
  assert.equal(validated.result.verdict, "pass");
  if (legacy) {
    await assert.rejects(fs.access(path.join(root, job, "reports/validate.json")), { code: "ENOENT" });
    evidence.legacy_validate_report_absent = true;
    // Exercise both stdout-only outcomes from the actual original script.
    const projectFile = path.join(root, job, "project.json");
    const original = await fs.readFile(projectFile, "utf8");
    const invalid = JSON.parse(original); invalid.title = "";
    await fs.writeFile(projectFile, JSON.stringify(invalid));
    assert.equal((await run("validate", [], {}, 1)).result.verdict, "fail");
    await fs.writeFile(projectFile, original);
    const qc = await run("qc", ["--stage", "pre"], { stage: "pre" }, 1);
    assert.equal(qc.result.verdict, "fail");
  }
  await run("render", ["--target", "preview"], { target: "preview" });
  await run("render", ["--target", "still", "--frame", "30"], { target: "still", frame: 30 });
  await run("ghost-check", ["--target", "preview"], { target: "preview" });
  await run("render", ["--target", "final"], { target: "final" });
  await run("ghost-check");
  evidence.outputs = await facts(path.join(root, job), ["output/preview.mp4", "output/preview.png", "output/final.mp4", "reports/ghost-check-preview.json", "reports/ghost-check.json"]);
  evidence.protocol_errors = connection?.errors.length ?? 0;
  // Keep small visual/report evidence; large videos and dependencies are hashed above.
  const artifacts = path.join(path.dirname(evidenceFile), `${label}-artifacts`);
  await fs.mkdir(artifacts, { recursive: true });
  for (const name of ["output/preview.png", "reports/ghost-check-preview.json", "reports/ghost-check.json"])
    await fs.copyFile(path.join(root, job, name), path.join(artifacts, path.basename(name)));
  evidence.success = true;
} catch (error) {
  evidence.error = { message: error.message, stack: error.stack };
  process.exitCode = 1;
  console.error(error.message);
} finally {
  if (!evidence.success && job) {
    try { await cancelActiveRuns(root, job); }
    catch (error) { evidence.cancellation_error = error.message; }
  }
  if (connection) await connection.close();
  evidence.ended_at = new Date().toISOString(); evidence.elapsed_ms = Date.now() - start;
  await saveEvidence(evidenceFile, evidence, root);
  if (evidence.success && !process.argv.includes("--keep")) { await removeOwned(root); console.log("一時ジョブの依存と動画を削除しました。"); }
}
