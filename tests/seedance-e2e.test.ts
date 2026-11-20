import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test, type TestContext } from "node:test";
import { execute, findFfmpeg, probe, schemaIssues, schemas, schemaRegistry, type Envelope } from "../src/host/index.ts";
import { inspectMp4File } from "../src/host/seedance/mp4.ts";
import { cliContext } from "../src/cli/index.ts";
import { builtCliMain } from "./helpers/cli.ts";
import { connectMcp, envelope, mcpEntry } from "./helpers/mcp.ts";
import { workspace } from "./helpers/host.ts";

// Fixed input of the mock E2E (SEEDANCE direction §3.6). DRY_RUN only: no request may leave the process.
const SHOT = "test-horseshoe";
const PROMPT = "Psychedelic surreal short film: a giant glowing horseshoe magnet floating in a kaleidoscopic void, iron filings and sparks spiraling toward both poles, two opposing crowds of abstract silhouettes pressing against an invisible glass ceiling that cracks with rainbow light, liquid chrome colors melting and reforming, symmetrical morphing, 1960s psychedelic poster aesthetic, intensely saturated colors, no text, no watermark";
const sentinel = pathToFileURL(fileURLToPath(new URL("./fixtures/seedance/network-sentinel.mjs", import.meta.url))).href;

/** Child env without any Seedance or key variables, plus the sentinel log path. */
function sanitizedEnv(log: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined && !/^(ARK_|SEEDANCE_)/i.test(key)) env[key] = value;
  env.SEEDANCE_SENTINEL_LOG = log;
  return env;
}
async function generatedJob(t: TestContext, title: string) {
  const context = await workspace(t);
  const generated = await execute(cliContext(context.root), "generate", { request: { form: { title, description: "Seedance モック E2E", audience: "開発者", voiceEngine: "none", generateAudio: false } }, out: "." });
  assert.ok(generated.ok);
  return { root: context.root, job: generated.result.job!, log: path.join(context.root, "sentinel.log") };
}
async function noNetwork(log: string) {
  const written = await fs.readFile(log, "utf8").catch((error) => { if (error.code === "ENOENT") return ""; throw error; });
  assert.equal(written, "", `network access recorded by the sentinel:\n${written}`);
}
async function smm(root: string, env: Record<string, string>, args: string[]) {
  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", sentinel, builtCliMain, ...args], { cwd: root, env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8").on("data", (text) => { stdout += text; });
    child.stderr.setEncoding("utf8").on("data", (text) => { stderr += text; });
    child.once("error", reject); child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
  assert.doesNotMatch(result.stderr, /SEEDANCE_NETWORK_SENTINEL/);
  const parsed = JSON.parse(result.stdout) as Envelope<any>;
  assert.deepEqual(schemaIssues(schemas.envelope, parsed, schemaRegistry), [], result.stdout);
  return { ...result, envelope: parsed };
}
/** Objective checks of a saved preview set: MP4 boxes, optional real decode, sidecar and thumbnail. */
async function checkOutputs(t: TestContext, jobDirectory: string, task: Record<string, any>) {
  assert.equal(task.output, `seedance/out/${SHOT}.mp4`);
  const mp4 = path.join(jobDirectory, task.output);
  const facts = await inspectMp4File(mp4);
  assert.ok(facts.ok, JSON.stringify(facts));
  const sidecar = JSON.parse(await fs.readFile(path.join(jobDirectory, task.sidecar), "utf8"));
  assert.equal(sidecar.schema, "smm.seedance-output/1"); assert.equal(sidecar.shot_id, SHOT); assert.equal(sidecar.dry_run, true);
  assert.equal(sidecar.prompt, PROMPT); assert.equal(sidecar.video.path, task.output);
  const ffmpeg = await findFfmpeg();
  if (ffmpeg) {
    const decoded = await probe(ffmpeg, ["-v", "error", "-i", mp4, "-f", "null", "-"], 60000);
    assert.equal(decoded.code, 0, decoded.stderr);
    assert.equal(task.thumbnail, `seedance/out/${SHOT}.png`);
    const png = await fs.readFile(path.join(jobDirectory, task.thumbnail));
    assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  } else t.diagnostic("ffmpeg unavailable: real decode and thumbnail checks skipped");
}

test("SEEDANCE E2E CLI: test-horseshoe create, status, list, report and doctor stay offline in DRY_RUN", async (t) => {
  const { root, job, log } = await generatedJob(t, "seedance cli & 全角 空白");
  const env = sanitizedEnv(log);
  const created = await smm(root, env, ["seedance", "create", job, "--shot-id", SHOT, "--prompt", PROMPT, "--model", "seedance-2-0-mini", "--mode", "text", "--duration", "5", "--ratio", "16:9", "--resolution", "720p"]);
  assert.equal(created.code, 0, created.stdout + created.stderr); assert.ok(created.envelope.ok);
  const task = created.envelope.result.task;
  assert.equal(created.envelope.result.cached, false);
  assert.equal(task.status, "succeeded"); assert.match(task.task_id, /^mock-/); assert.equal(task.dry_run, true);
  assert.deepEqual(task.model, { alias: "seedance-2-0-mini", id: "dreamina-seedance-2-0-mini-260615" });
  assert.equal(task.estimate_usd, 0.378); assert.equal(task.actual_usd, 0);
  assert.ok(created.envelope.advisories.some((item: { id: string }) => item.id === "seedance-opt-in-required-for-real"));
  await checkOutputs(t, path.join(root, job), task);

  const status = await smm(root, env, ["seedance", "status", job, "--shot-id", SHOT]);
  assert.equal(status.code, 0, status.stdout); assert.ok(status.envelope.ok); assert.equal(status.envelope.result.task.status, "succeeded");
  const again = await smm(root, env, ["seedance", "create", job, "--shot-id", SHOT, "--prompt", PROMPT]);
  assert.ok(again.envelope.ok); assert.equal(again.envelope.result.cached, true); assert.equal(again.envelope.result.task.local_id, task.local_id);
  const listed = await smm(root, env, ["seedance", "list", job]);
  assert.ok(listed.envelope.ok); assert.equal(listed.envelope.result.tasks.length, 1);
  assert.equal(listed.envelope.result.summary.dry_run, true); assert.equal(listed.envelope.result.summary.api_key_present, false);
  assert.equal(listed.envelope.result.summary.mock_count, 1); assert.equal(listed.envelope.result.summary.real_spent_usd, 0);
  const report = await smm(root, env, ["report", job, `seedance/out/${SHOT}.json`]);
  assert.ok(report.envelope.ok, report.stdout); assert.equal(JSON.parse(report.envelope.result.text).shot_id, SHOT);
  const denied = await smm(root, env, ["report", job, `seedance/out/${SHOT}.mp4`]);
  assert.ok(!denied.envelope.ok); assert.equal(denied.envelope.error.code, "E_PATH_DENIED");
  const doctor = await smm(root, env, ["doctor"]); assert.ok(doctor.envelope.ok, doctor.stdout);
  const check = doctor.envelope.result.checks.find((item: { id: string }) => item.id === "seedance");
  assert.equal(check.available, false); assert.equal(check.details.api_key_present, false); assert.equal(check.details.dry_run, true); assert.equal(check.details.models, 5);
  assert.deepEqual(doctor.envelope.result.checks.map((item: { id: string }) => item.id).slice(-2), ["seedance", "disk"]);
  await noNetwork(log);
});

test("SEEDANCE E2E MCP: seedance_create needs enable-generation; test-horseshoe previews come back through report_get offline", async (t) => {
  const { root, job, log } = await generatedJob(t, "seedance mcp & 全角 空白");
  const env = sanitizedEnv(log);
  const entry = ["--import", sentinel, mcpEntry];
  const plain = await connectMcp(root, [], entry, env);
  try {
    const names = (await plain.client.listTools()).tools.map((tool) => tool.name);
    assert.ok(!names.includes("seedance_create")); assert.ok(names.includes("seedance_status")); assert.ok(names.includes("seedance_list"));
    const refused = envelope<"seedance_create">(await plain.call("seedance_create", { job, shot_id: SHOT, prompt: PROMPT }));
    assert.ok(!refused.ok); assert.equal(refused.error.code, "E_DISABLED");
  } finally { await plain.close(); }
  const readOnly = await connectMcp(root, ["--read-only"], entry, env);
  try {
    const names = (await readOnly.client.listTools()).tools.map((tool) => tool.name);
    assert.deepEqual(names.filter((name) => name.startsWith("seedance_")), ["seedance_list"]);
  } finally { await readOnly.close(); }

  const connection = await connectMcp(root, ["--enable-generation"], entry, env);
  try {
    const created = envelope<"seedance_create">(await connection.call("seedance_create", { job, shot_id: SHOT, prompt: PROMPT, model: "seedance-2-0-mini", mode: "text", duration: 5, ratio: "16:9", resolution: "720p" }));
    assert.ok(created.ok, JSON.stringify(created));
    const task = created.result.task;
    assert.equal(task.status, "succeeded"); assert.match(task.task_id!, /^mock-/); assert.equal(task.estimate_usd, 0.378);
    await checkOutputs(t, path.join(root, job), task);
    const status = envelope<"seedance_status">(await connection.call("seedance_status", { job, task_id: task.task_id }));
    assert.ok(status.ok); assert.equal(status.result.task.local_id, task.local_id);
    const listed = envelope<"seedance_list">(await connection.call("seedance_list", { job }));
    assert.ok(listed.ok); assert.equal(listed.result.summary.count, 1); assert.equal(listed.result.summary.budget_scope, "job");
    const sidecar = await connection.call("report_get", { job, path: task.sidecar });
    assert.equal(sidecar.isError, false); assert.equal(JSON.parse((sidecar.structuredContent as any).result.text).local_id, task.local_id);
    if (task.thumbnail) {
      const image = await connection.call("report_get", { job, path: task.thumbnail });
      assert.equal(image.isError, false); assert.equal(image.content[1]?.type, "image");
      assert.equal((image.structuredContent as any).result.delivered_as, "image");
    } else t.diagnostic("ffmpeg unavailable: thumbnail image block check skipped");
  } finally { await connection.close(); }
  await noNetwork(log);
});
