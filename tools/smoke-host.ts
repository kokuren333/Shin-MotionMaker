import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execute, getRun, cancelRun, listRuns, readRequest, schemaIssues, schemaRegistry, schemas, type HostContext } from "../src/host/index.ts";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "smm-host-smoke-"));
const context: HostContext = { root, requestDirectory: root, restrictToRoot: true, allowDirs: [], allowEngineHosts: [], readOnly: false, enableGeneration: true, startedBy: "cli" };
let failed = true;
try {
  const request = { form: { title: "host & 全角 空白", description: "動作確認", audience: "開発者", voiceEngine: "none" as const, imageGeneration: false, generateAudio: false, styleMode: "anime" as const } };
  await fs.writeFile(path.join(root, "request.json"), "\uFEFF" + JSON.stringify(request));
  const read = await readRequest("request.json", context);
  assert.equal(read.request.form.voiceEngine, "none");
  const generated = await execute(context, "generate", { request, out: "." });
  assert.ok(generated.ok); const job = generated.result.job!;
  const qc = await execute(context, "qc", { job, stage: "pre", wait_ms: 10000 });
  assert.ok(qc.ok); assert.equal(qc.result?.verdict, "fail"); assert.equal(qc.run?.exit_code, 1);
  const sound = await execute(context, "sound", { job, wait_ms: 10000 }); assert.ok(sound.ok); assert.equal(sound.result?.verdict, "not_applicable");
  const voice = await execute(context, "voice", { job, wait_ms: 10000 }); assert.ok(voice.ok); assert.equal(voice.result?.verdict, "not_applicable");
  const status = await execute(context, "status", { job }); assert.ok(status.ok); assert.equal(status.result.job.style_mode, "anime");
  const missing = await execute(context, "validate", { job }); assert.equal(missing.ok, false); if (!missing.ok) assert.equal(missing.error.code, "E_DEPS_MISSING");
  const image = await execute(context, "imagegen", { job, name: "dry", prompt: "抽象的な図", dry_run: true, wait_ms: 50000 });
  if (image.run?.status !== "completed") console.error(JSON.stringify(await getRun(context, { job, run_id: image.run!.id })));
  assert.ok(image.ok); assert.equal(image.run?.status, "completed");
  for (const envelope of [generated, qc, sound, voice, status, missing, image]) assert.deepEqual(schemaIssues(schemas.envelope, envelope, schemaRegistry), []);
  console.log(JSON.stringify({ generated_files: generated.result.file_count, qc: qc.result?.verdict, qc_exit_code: qc.run?.exit_code, sound: sound.result?.verdict, voice: voice.result?.verdict, style_mode: status.result.job.style_mode, imagegen: image.run?.status, validate: missing.ok ? null : missing.error.code, schema_errors: 0 }));
  failed = false;
} finally {
  if (failed) console.error("動作確認に失敗しました。一時ジョブは削除します。");
  const resolved = path.resolve(root);
  try { for (const run of await listRuns(context, "host & 全角 空白")) if (run.status === "running") await cancelRun(context, "host & 全角 空白", run.id); } catch {}
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("smm-host-smoke-")) throw Error("Unexpected cleanup target");
  await fs.rm(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
