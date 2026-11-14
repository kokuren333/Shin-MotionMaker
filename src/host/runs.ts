import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { JsonObject } from "../core/index.ts";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import type { Envelope, HostContext, OperationInputs, Run, RunGetResult, RunKind, RunRecord } from "./types.ts";
import { hostError, isMissing, normalizeError } from "./errors.ts";
import { displayPath, jobFile, resolveJob, openVerified, readJobBytes, ensureDirectory, openWriteVerified } from "./paths.ts";
import { atomicJson } from "./io.ts";
import { acquireJobLock, processExists, releaseOwnedLock } from "./locks.ts";
import { preflight } from "./run-options.ts";
import { resultAdvisories } from "./run-result.ts";
import { stopProcessTree } from "./worker.ts";
import { utf8Prefix } from "./report.ts";
import { identifyProcess, processState, readProcessOwners, type ProcessIdentity } from "./processes.ts";
import { displayHostOutput } from "./display.ts";

export const runIdPattern = /^r-\d{8}T\d{6}Z-[a-f0-9]{8}$/;
function assertRunId(id: string) { if (!runIdPattern.test(id)) throw hostError("E_INPUT_INVALID", "run ID の形式が不正です。"); }
async function readRecord(job: string, id: string): Promise<RunRecord> {
  assertRunId(id);
  let run: RunRecord;
  try { run = JSON.parse((await readJobBytes(job, `.smm/runs/${id}/run.json`)).toString("utf8")) as RunRecord; }
  catch (error) { if (isMissing(error)) throw hostError("E_RUN_NOT_FOUND", "run が見つかりません。"); throw error; }
  if (run.id !== id || run.schema !== "smm.run/1") throw hostError("E_INTERNAL", "run 台帳の形式が不正です。");
  if (run.status === "running" && Date.now() - Date.parse(run.heartbeat_at) >= 15000 && await processState(run.pid, (await readProcessOwners(job, id)).worker) === "absent") {
    return { ...run, status: "lost", ended_at: new Date().toISOString(), exit_code: 4, error: normalizeError(hostError("E_RUN_LOST", "run の実行プロセスが見つかりません。", "ログを確認し、必要なら新しい run を開始してください。")) };
  }
  return run;
}
export async function startRun<K extends RunKind>(context: HostContext, kind: K, input: OperationInputs[K]): Promise<Run> {
  const job = await resolveJob(context, input.job);
  await preflight(context, job, kind, input);
  const id = `r-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}-${randomBytes(4).toString("hex")}`;
  const lock = await acquireJobLock(context, input.job, id);
  let workerStarted = false;
  let recordCreated = false;
  let workerPid: number | null = null;
  let workerIdentity: ProcessIdentity | undefined;
  try {
    // Re-read voice policy after acquiring the writer reservation.
    if (kind === "voice") await preflight(context, job, kind, input);
    const now = new Date().toISOString();
    const { job: _job, wait_ms: _wait, ...args } = input;
    const run: RunRecord = { schema: "smm.run/1", id, kind, args: args as JsonObject, status: "running", exit_code: null,
      pid: process.pid, script_pid: null, started_at: now, heartbeat_at: now, ended_at: null,
      progress: { ratio: null, text: "実行を開始しています。" }, artifacts: [], started_by: context.startedBy };
    await ensureDirectory(await jobFile(job, `.smm/runs/${id}`));
    await atomicJson(await jobFile(job, `.smm/runs/${id}/processes.json`), { token: lock.token, worker: await identifyProcess(process.pid) });
    await atomicJson(await jobFile(job, `.smm/runs/${id}/run.json`), run);
    recordCreated = true;
    for (const name of ["stdout", "stderr"]) await (await openWriteVerified(await jobFile(job, `.smm/runs/${id}/${name}.log`), "wx")).close();
    const worker = fileURLToPath(new URL(import.meta.url.endsWith(".ts") ? "./worker.ts" : "./worker.js", import.meta.url));
    const out = await openWriteVerified(await jobFile(job, `.smm/runs/${id}/stdout.log`), "a");
    const err = await openWriteVerified(await jobFile(job, `.smm/runs/${id}/stderr.log`), "a");
    const child = spawn(process.execPath, [...(worker.endsWith(".ts") ? ["--experimental-strip-types"] : []), worker, job, id], { detached: true, shell: false, windowsHide: true, stdio: ["ignore", out.fd, err.fd] });
    workerPid = child.pid ?? null;
    try { await new Promise<void>((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); }); }
    finally { await out.close(); await err.close(); }
    workerStarted = true; child.unref();
    workerIdentity = await identifyProcess(workerPid) ?? undefined;
    if (child.exitCode !== null || child.signalCode !== null) workerIdentity = undefined;
    // Acknowledgment transfers ownership before the caller may exit.
    for (let attempt = 0; attempt < 200; attempt++) {
      const current = await readRecord(job, id);
      if (current.pid === child.pid) return { ...current, job: displayPath(context, job) };
      if (!processExists(child.pid ?? null)) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await stopProcessTree(child.pid ?? null, workerIdentity);
    throw hostError("E_INTERNAL", "worker の起動を確認できませんでした。");
  } catch (error) {
    if (workerStarted || recordCreated) {
      const current = await readRecord(job, id);
      const owners = await readProcessOwners(job, id);
      await stopProcessTree(workerPid, workerIdentity);
      await stopProcessTree(current.script_pid, owners.script);
      const cause = normalizeError(error);
      const failed: RunRecord = { ...current, pid: workerPid, status: "failed", ended_at: new Date().toISOString(),
        error: { ...cause, details: { reason: "worker_start_failed", ...(cause.details === undefined ? {} : { cause: cause.details }) } }, exit_code: 4 };
      await atomicJson(await jobFile(job, `.smm/runs/${id}/run.json`), failed);
      if (await processState(workerPid, workerIdentity) === "absent" && await processState(current.script_pid, owners.script) === "absent")
        await releaseOwnedLock(job, id, lock.token);
      throw Object.assign(hostError(failed.error!.code, failed.error!.message, failed.error!.hint, failed.error!.details), { run: { ...failed, job: displayPath(context, job) } });
    } else await lock.release();
    throw error;
  }
}
export async function listRuns(context: HostContext, relative: string): Promise<Run[]> {
  const job = await resolveJob(context, relative);
  let names: string[];
  try { names = await fs.readdir(await jobFile(job, ".smm/runs")); }
  catch (error) { if (isMissing(error)) return []; throw error; }
  const runs: Run[] = [];
  for (const id of names.filter((name) => runIdPattern.test(name)).sort().reverse()) runs.push({ ...await readRecord(job, id), job: displayPath(context, job) });
  return runs;
}
export async function readRunLog(job: string, id: string, stream: "stdout" | "stderr", offset: number): Promise<{ text: string; next_offset: number }> {
  assertRunId(id);
  if (!["stdout", "stderr"].includes(stream) || !Number.isSafeInteger(offset) || offset < 0) throw hostError("E_INPUT_INVALID", "ログの位置または種別が不正です。");
  const handle = await openVerified(await jobFile(job, `.smm/runs/${id}/${stream}.log`), () => jobFile(job, `.smm/runs/${id}/${stream}.log`));
  try {
    const size = (await handle.stat()).size;
    if (offset > size) throw hostError("E_INPUT_INVALID", "ログの位置がファイル末尾を超えています。");
    const bytes = Buffer.alloc(Math.min(size - offset, 256 * 1024));
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, offset);
    const prefix = utf8Prefix(bytes.subarray(0, bytesRead));
    return { text: prefix.text, next_offset: offset + prefix.consumed };
  } finally { await handle.close(); }
}
async function tail(job: string, id: string, stream: "stdout" | "stderr", lines: number): Promise<string[]> {
  if (lines === 0) return [];
  const handle = await openVerified(await jobFile(job, `.smm/runs/${id}/${stream}.log`), () => jobFile(job, `.smm/runs/${id}/${stream}.log`));
  try {
    const size = (await handle.stat()).size;
    const chunks: Buffer[] = [];
    let position = size, newlines = 0;
    while (position > 0 && newlines <= lines) {
      const bytes = Buffer.alloc(Math.min(position, 64 * 1024));
      position -= bytes.length;
      const { bytesRead } = await handle.read(bytes, 0, bytes.length, position);
      const chunk = bytes.subarray(0, bytesRead); chunks.unshift(chunk);
      for (const byte of chunk) if (byte === 10) newlines++;
    }
    const text = utf8Prefix(Buffer.concat(chunks)).text.replace(/\r?\n$/, "");
    return text ? text.split(/\r?\n/).slice(-lines) : [];
  } finally { await handle.close(); }
}
export async function getRun(context: HostContext, input: OperationInputs["run_get"]): Promise<Envelope<RunGetResult>> {
  const job = await resolveJob(context, input.job);
  const wait = input.wait_ms ?? 0, lines = input.log_tail ?? 100;
  if (!Number.isInteger(wait) || wait < 0 || wait > 50000 || !Number.isInteger(lines) || lines < 0 || lines > 2000) throw hostError("E_INPUT_INVALID", "待ち時間またはログ行数が範囲外です。");
  const deadline = Date.now() + wait;
  let record = await readRecord(job, input.run_id);
  while (record.status === "running" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(100, deadline - Date.now())));
    record = await readRecord(job, input.run_id);
  }
  const run = { ...record, job: displayPath(context, job) };
  return displayHostOutput(context, { schema: "smm.envelope/1", command: "runs get", job: run.job, ok: true,
    result: { ...(run.result ?? { report: null, artifacts: [] }), stdout_tail: await tail(job, run.id, "stdout", lines), stderr_tail: await tail(job, run.id, "stderr", lines) },
    advisories: resultAdvisories(run), warnings: [], run }, job);
}
export async function cancelRun(context: HostContext, relative: string, id: string): Promise<Run> {
  if (context.readOnly) throw hostError("E_DISABLED", "読み取り専用では取り消せません。");
  const job = await resolveJob(context, relative);
  let run = await readRecord(job, id);
  const owners = await readProcessOwners(job, id);
  if (run.status !== "running" && run.status !== "lost") return { ...run, job: displayPath(context, job) };
  if (run.status === "lost") {
    await stopProcessTree(run.script_pid, owners.script);
    await atomicJson(await jobFile(job, `.smm/runs/${id}/run.json`), run);
    await releaseOwnedLock(job, id, owners.token);
    return { ...run, job: displayPath(context, job) };
  }
  if (await processState(run.pid, owners.worker) === "absent" && Date.now() - Date.parse(run.heartbeat_at) >= 15000) {
    await stopProcessTree(run.script_pid, owners.script);
    run = { ...run, status: "cancelled", exit_code: 4, ended_at: new Date().toISOString(), error: normalizeError(hostError("E_INTERNAL", "実行を取り消しました。", "必要なら再実行してください。", { reason: "cancelled" })) };
    await atomicJson(await jobFile(job, `.smm/runs/${id}/run.json`), run);
    await releaseOwnedLock(job, id, owners.token);
  } else {
    await (await openWriteVerified(await jobFile(job, `.smm/runs/${id}/cancel`), "a")).close();
    for (let attempt = 0; attempt < 400; attempt++) {
      run = await readRecord(job, id);
      if (run.status === "lost") return cancelRun(context, relative, id);
      if (run.status !== "running") break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (run.status === "running") throw hostError("E_INTERNAL", "取り消しの完了を確認できませんでした。", "ログと実行プロセスを確認してください。");
  }
  return { ...run, job: displayPath(context, job) };
}
