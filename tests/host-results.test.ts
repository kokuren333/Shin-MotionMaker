import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { execute, getRun, schemaIssues, schemas, schemaRegistry, acquireJobLock, cancelRun } from "../src/host/index.ts";
import { collectRunResult } from "../src/host/run-result.ts";
import type { RunRecord } from "../src/host/types.ts";
import { fakeJob, workspace } from "./helpers/host.ts";

test("host reads ghost counts as advice and rejects inconsistent completion evidence", async (t) => {
  const context = await workspace(t); const job = await fakeJob(context);
  await fs.mkdir(path.join(job, "reports"));
  const run: RunRecord = { schema: "smm.run/1", id: "r-20261114T000000Z-abcdef12", kind: "ghost_check", args: {}, status: "running", exit_code: null, pid: process.pid, script_pid: null, started_at: new Date().toISOString(), heartbeat_at: new Date().toISOString(), ended_at: null, progress: { ratio: null, text: "検証" }, artifacts: [], started_by: "mcp" };
  await fs.writeFile(path.join(job, "reports/ghost-check.json"), JSON.stringify({ kind: "biim-ghost-check", video: "output/final.mp4", frames: 120, fps: 30, duration: "4", counts: { isolated: 12, clusteredRuns: 4 }, stills: [] }));
  const result = await collectRunResult(job, run, 0, "", ""); assert.equal(result.exit_code, 0); assert.equal(Object.hasOwn(result.result, "verdict"), false);
  assert.deepEqual(schemaIssues(schemas["ghost-check"], result.result.report, schemaRegistry), []);
  await assert.rejects(collectRunResult(job, run, 1, "", ""), { code: "E_INTERNAL" });
  await fs.writeFile(path.join(job, "reports/ghost-check.json"), JSON.stringify({ kind: "biim-ghost-check", skipped: "ffmpeg missing" }));
  await assert.rejects(collectRunResult(job, run, 0, "", ""), { code: "E_INTERNAL" });
});

test("atomic reservation permits only one concurrent run and terminal completion releases it", async (t) => {
  const context = await workspace(t); await fakeJob(context, { delay: 2000 });
  const results = await Promise.all(Array.from({ length: 6 }, () => execute(context, "qc", { job: "job & 全角 空白", stage: "pre", wait_ms: 0 })));
  const started = results.filter((result) => result.ok);
  if (started.length !== 1) for (const result of results) if (result.run) t.diagnostic(JSON.stringify(await getRun(context, { job: "job & 全角 空白", run_id: result.run.id })));
  assert.equal(started.length, 1);
  for (const result of results) if (!result.ok) assert.equal(result.error.code, "E_BUSY", JSON.stringify(result));
  await cancelRun(context, "job & 全角 空白", started[0].run!.id);
  const lock = await acquireJobLock(context, "job & 全角 空白", "test"); await lock.release();
});

test("real generated scripts preserve MV QC exemption imagegen skips and sound input exit mapping", async (t) => {
  const context = { ...await workspace(t), enableGeneration: true };
  const generated = await execute(context, "generate", { request: { form: { title: "real", description: "説明", audience: "視聴者", voiceEngine: "none" } }, out: "." }); assert.ok(generated.ok);
  const job = generated.result.job!;
  const original = process.env.CODEX_BIN;
  process.env.CODEX_BIN = path.join(context.root, "missing-codex.mjs");
  try {
    const image = await execute(context, "imagegen", { job, name: "missing", prompt: "図", wait_ms: 10000 });
    assert.ok(image.ok, JSON.stringify(image)); assert.equal(image.run?.status, "completed"); assert.equal(image.run?.exit_code, 0); assert.ok(image.advisories.length); assert.equal(image.result?.verdict, undefined);
    const strict = await execute(context, "imagegen", { job, name: "strict", prompt: "図", strict: true, wait_ms: 10000 });
    assert.ok(strict.ok, JSON.stringify(strict)); assert.equal(strict.result?.verdict, "fail"); assert.equal(strict.run?.exit_code, 1);
    await fs.writeFile(path.join(context.root, job, "plan/sound-design.json"), JSON.stringify({ cues: [] }));
    const sound = await execute(context, "sound", { job, wait_ms: 10000 }); assert.equal(sound.ok, false); if (!sound.ok) assert.equal(sound.error.code, "E_INPUT_INVALID"); assert.equal(sound.run?.exit_code, 2);
    const file = path.join(context.root, job, "project.json"); const project = JSON.parse(await fs.readFile(file, "utf8")); project.mode = "mv"; await fs.writeFile(file, JSON.stringify(project));
    const qc = await execute(context, "qc", { job, stage: "pre", wait_ms: 10000 });
    if (!qc.ok && qc.run) t.diagnostic(JSON.stringify(await getRun(context, { job, run_id: qc.run.id })));
    assert.ok(qc.ok, JSON.stringify(qc)); assert.equal(qc.result?.verdict, "not_applicable"); assert.equal(qc.run?.exit_code, 0);
    for (const envelope of [image, strict, sound, qc]) assert.deepEqual(schemaIssues(schemas.envelope, envelope, schemaRegistry), []);
  } finally { if (original === undefined) delete process.env.CODEX_BIN; else process.env.CODEX_BIN = original; }
});
