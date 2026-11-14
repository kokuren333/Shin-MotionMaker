import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { execute, startRun, getRun, cancelRun, listRuns, readRunLog, acquireJobLock, schemaIssues, schemaRegistry, schemas, type RunRecord } from "../src/host/index.ts";
import { processExists, releaseOwnedLock } from "../src/host/locks.ts";
import { identifyProcess } from "../src/host/processes.ts";
import { defaultWait, runTimeout } from "../src/host/run-options.ts";
import { fakeJob, fixtureModule, hostModule, workerModule, workspace } from "./helpers/host.ts";

const relative = "job & 全角 空白";
for (const [name, scenario, expected, code] of [
  ["TS-07 completes with advisory without changing verdict", "complete", "completed", 0],
  ["TS-07 gate failure is completed and ok true", "fail", "completed", 1],
  ["TS-07 unexpected exit is failed", "crash", "failed", 4],
  ["TS-07 mismatched QC exit and report is failed", "mismatch", "failed", 4],
] as const) test(name, async (t) => {
  const context = await workspace(t); await fakeJob(context, { scenario });
  const result = await execute(context, "qc", { job: relative, stage: "pre", wait_ms: 10000 });
  if (result.run?.status !== expected && result.run) t.diagnostic(JSON.stringify(await getRun(context, { job: relative, run_id: result.run.id })));
  assert.equal(result.run?.status, expected, JSON.stringify(result)); assert.equal(result.run?.exit_code, code);
  assert.equal(result.ok, expected === "completed");
  assert.deepEqual(schemaIssues(schemas.envelope, result, schemaRegistry), []);
  assert.deepEqual(schemaIssues(schemas.run, result.run, schemaRegistry), []);
  if (result.ok && result.result) { assert.equal(result.advisories.length, 1); assert.equal(result.result.verdict, code === 0 ? "pass" : "fail"); }
  const fetched = await getRun(context, { job: relative, run_id: result.run!.id }); assert.equal(fetched.ok, true);
  const bytes = JSON.parse(await fs.readFile(path.join(context.root, relative, ".smm/runs", result.run!.id, "run.json"), "utf8"));
  assert.equal(Object.hasOwn(bytes, "job"), false); assert.equal(Object.hasOwn(bytes.args, "job"), false);
  assert.deepEqual(schemaIssues(schemas.run, bytes, schemaRegistry), []);
});

test("TS-07 cancels the process tree then releases E_BUSY reservation", async (t) => {
  const context = await workspace(t); const job = await fakeJob(context, { scenario: "sleep" });
  const run = await startRun(context, "qc", { job: relative, stage: "pre" });
  for (let count = 0; count < 100; count++) { try { await fs.access(path.join(job, "child.pid")); break; } catch { await new Promise((resolve) => setTimeout(resolve, 50)); } }
  const descendant = Number(await fs.readFile(path.join(job, "child.pid"), "utf8"));
  assert.ok(processExists(descendant));
  const busy = await execute(context, "sound", { job: relative, wait_ms: 0 });
  assert.equal(busy.ok, false); if (!busy.ok) { assert.equal(busy.error.code, "E_BUSY"); assert.deepEqual(busy.error.details, { run_id: run.id }); }
  assert.equal((await listRuns(context, relative)).length, 1);
  const patch = await execute(context, "project_patch", { job: relative, patch: {}, expect_sha256: "0".repeat(64) });
  assert.equal(patch.ok, false); if (!patch.ok) assert.equal(patch.error.code, "E_BUSY");
  const cancelled = await cancelRun(context, relative, run.id);
  assert.equal(cancelled.status, "cancelled"); assert.equal(cancelled.exit_code, 4);
  assert.equal(processExists(descendant), false); assert.equal(processExists(cancelled.script_pid), false);
  assert.equal((await cancelRun(context, relative, run.id)).status, "cancelled");
  const lock = await acquireJobLock(context, relative, "test"); await lock.release();
});

test("TS-07 times out a worker and stops descendants before releasing the lock", async (t) => {
  const context = await workspace(t); const job = await fakeJob(context, { scenario: "sleep" });
  const id = "r-20261114T000000Z-abcd1234";
  const reservation = await acquireJobLock(context, relative, id);
  const now = new Date().toISOString();
  const record: RunRecord = { schema: "smm.run/1", id, kind: "qc", args: { stage: "pre" }, status: "running", exit_code: null, pid: process.pid, script_pid: null, started_at: now, heartbeat_at: now, ended_at: null, artifacts: [], progress: { ratio: null, text: "テスト" }, started_by: "cli" };
  const folder = path.join(job, ".smm/runs", id); await fs.mkdir(folder, { recursive: true }); await fs.writeFile(path.join(folder, "run.json"), JSON.stringify(record));
  await fs.writeFile(path.join(folder, "processes.json"), JSON.stringify({ token: reservation.token }));
  for (const stream of ["stdout", "stderr"]) await fs.writeFile(path.join(folder, stream + ".log"), "");
  const child = spawn(process.execPath, ["--experimental-strip-types", fixtureModule("timeout-worker"), workerModule, job, id], { shell: false, windowsHide: true, stdio: "pipe" });
  const code = await new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
  assert.equal(code, 0);
  const fetched = await getRun(context, { job: relative, run_id: id });
  assert.equal(fetched.run?.status, "timed_out"); assert.equal(fetched.run?.error?.code, "E_TIMEOUT");
  const descendant = Number(await fs.readFile(path.join(job, "child.pid"), "utf8"));
  assert.equal(processExists(descendant), false);
  const lock = await acquireJobLock(context, relative, "test"); await lock.release();
});

test("TS-07 detached run survives client exit and heartbeat updates", async (t) => {
  const context = await workspace(t); await fakeJob(context, { delay: 6000 });
  const child = spawn(process.execPath, ["--experimental-strip-types", fixtureModule("client"), hostModule, context.root], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = ""; child.stdout.on("data", (data) => { stdout += data; }); child.stderr.on("data", (data) => { stderr += data; });
  const code = await new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
  assert.equal(code, 0, stderr); const run = JSON.parse(stdout);
  assert.notEqual(run.pid, child.pid); assert.ok(processExists(run.pid));
  await new Promise((resolve) => setTimeout(resolve, 5200));
  const active = await getRun(context, { job: relative, run_id: run.id, wait_ms: 0 });
  assert.ok(Date.parse(active.run!.heartbeat_at) > Date.parse(run.heartbeat_at));
  const done = await getRun(context, { job: relative, run_id: run.id, wait_ms: 10000 }); assert.equal(done.run?.status, "completed");
});

test("TS-07 lost derivation is read only and stale lock recovery checks process existence", async (t) => {
  const context = await workspace(t); const job = await fakeJob(context);
  const run = await startRun(context, "qc", { job: relative, stage: "pre" });
  await getRun(context, { job: relative, run_id: run.id, wait_ms: 10000 });
  const file = path.join(job, ".smm/runs", run.id, "run.json");
  const record = JSON.parse(await fs.readFile(file, "utf8"));
  const old = { ...record, status: "running", pid: 2147483647, script_pid: null, heartbeat_at: "2000-01-01T00:00:00.000Z", exit_code: null, ended_at: null };
  await fs.writeFile(file, JSON.stringify(old));
  const before = await fs.readFile(file, "utf8");
  const fetched = await getRun({ ...context, readOnly: true }, { job: relative, run_id: run.id });
  assert.equal(fetched.run?.status, "lost"); assert.equal(fetched.run?.error?.code, "E_RUN_LOST");
  assert.equal(await fs.readFile(file, "utf8"), before);
  await fs.writeFile(file, JSON.stringify({ ...old, pid: record.pid }));
  assert.equal((await getRun(context, { job: relative, run_id: run.id })).run?.status, "lost");
  await fs.writeFile(file, before);
  const lockFile = path.join(job, ".smm/write.lock");
  await fs.writeFile(lockFile, JSON.stringify({ pid: 2147483647, owner: run.id, token: "dead" }));
  const recovered = await acquireJobLock(context, relative, "test"); await recovered.release();
  await fs.writeFile(lockFile, JSON.stringify({ pid: process.pid, owner: "live", token: "alive" }));
  await assert.rejects(acquireJobLock(context, relative, "other"), { code: "E_BUSY" });
  await releaseOwnedLock(job, "live", "alive");
});

test("stale validate report is never adopted after early script termination", async (t) => {
  const context = await workspace(t); const job = await fakeJob(context, { scenario: "stale" });
  await fs.mkdir(path.join(job, "reports")); const file = path.join(job, "reports/validate.json");
  await fs.writeFile(file, JSON.stringify({ schema: "smm.validate/1", final: false, double_render: false, verdict: "pass", checks: [], advisories: [] })); await fs.utimes(file, 1, 1);
  const result = await execute(context, "validate", { job: relative, wait_ms: 10000 });
  assert.equal(result.ok, false); assert.equal(result.run?.status, "failed"); if (!result.ok) assert.equal(result.error.code, "E_INTERNAL");
});

test("JT-12 legacy validate reconstructs pass and fail from completed stdout and exit", async (t) => {
  const context = await workspace(t); await fakeJob(context, {}, true);
  for (const scenario of ["complete", "fail", "crash"]) {
    await fakeJob(context, { scenario }, true);
    const result = await execute(context, "validate", { job: relative, wait_ms: 10000 });
    assert.equal(result.ok, scenario !== "crash", JSON.stringify(result));
    if (result.ok) assert.equal(result.result?.verdict, scenario === "fail" ? "fail" : "pass");
  }
});

test("readRunLog uses byte offsets without splitting or duplicating UTF-8", async (t) => {
  const context = await workspace(t); const job = await fakeJob(context);
  const run = await startRun(context, "qc", { job: relative, stage: "pre" });
  await getRun(context, { job: relative, run_id: run.id, wait_ms: 10000 });
  const file = path.join(job, ".smm/runs", run.id, "stdout.log");
  const bytes = Buffer.from("a日本語\n");
  await fs.writeFile(file, bytes.subarray(0, 3));
  const first = await readRunLog(job, run.id, "stdout", 0); assert.deepEqual(first, { text: "a", next_offset: 1 });
  await fs.appendFile(file, bytes.subarray(3));
  const second = await readRunLog(job, run.id, "stdout", first.next_offset); assert.equal(first.text + second.text, "a日本語\n"); assert.equal(second.next_offset, bytes.length);
});

test("run defaults limits disabled operations and missing dependencies leave no ledger", async (t) => {
  const context = await workspace(t); const job = await fakeJob(context);
  assert.equal(defaultWait("validate", { job }), 45000); assert.equal(defaultWait("validate", { job, final: true }), 0);
  assert.equal(runTimeout("setup", { job }), 1800000); assert.equal(runTimeout("render", { job, target: "preview" }), 7200000);
  assert.equal(runTimeout("voice", { job }), 3600000); assert.equal(runTimeout("imagegen", { job, name: "a", timeout: 2 }), 302000);
  for (const [ctx, kind, input, expected] of [
    [{ ...context, readOnly: true }, "qc", { job: relative, stage: "pre" }, "E_DISABLED"],
    [context, "imagegen", { job: relative, name: "x", prompt: "x" }, "E_DISABLED"],
  ] as const) {
    const result = await execute(ctx, kind, input);
    assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, expected);
  }
  await fs.rm(path.join(job, "runtime/node_modules/typescript/bin/tsc"));
  const missing = await execute(context, "validate", { job: relative }); assert.equal(missing.ok, false); if (!missing.ok) assert.equal(missing.error.code, "E_DEPS_MISSING");
  assert.deepEqual(await listRuns(context, relative), []);
});
