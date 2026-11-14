import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import type { OperationInputs, RunRecord } from "./types.ts";
import { hostError, normalizeError, errorExitCode } from "./errors.ts";
import { jobFile, openWriteVerified } from "./paths.ts";
import { atomicJson } from "./io.ts";
import { releaseOwnedLock, transferLock } from "./locks.ts";
import { identifyProcess, processState, readProcessOwners, descendantIdentities, type ProcessIdentity } from "./processes.ts";
import { collectRunResult } from "./run-result.ts";
import { runCommand, runTimeout } from "./run-options.ts";

export async function stopProcessTree(pid: number | null, identity?: ProcessIdentity): Promise<void> {
  if (!pid || await processState(pid, identity) !== "same") return;
  if (process.platform === "win32") {
    const system = process.env.SystemRoot ?? process.env.WINDIR;
    const executable = system ? path.join(system, "System32", "taskkill.exe") : "taskkill.exe";
    await new Promise<void>((resolve, reject) => {
      const killer = spawn(executable, ["/PID", String(pid), "/T", "/F"], { shell: false, windowsHide: true, stdio: "ignore" });
      killer.once("error", reject);
      killer.once("close", (code) => { void processState(pid, identity).then((state) => code === 0 || state === "absent" ? resolve() : reject(hostError("E_INTERNAL", "プロセスツリーを停止できませんでした。", undefined, { reason: "stop_failed" }))); });
    });
  } else {
    const descendants = await descendantIdentities(pid);
    const signal = async (owner: ProcessIdentity, value: NodeJS.Signals) => {
      if (await processState(owner.pid, owner) === "same") {
        try { process.kill(owner.pid, value); }
        catch (error) { if (await processState(owner.pid, owner) !== "absent") throw error; }
      }
    };
    // Snapshot descendants before terminating parents, including separate sessions.
    for (const owner of [...descendants, identity!]) await signal(owner, "SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 750));
    for (const owner of [...descendants, identity!]) await signal(owner, "SIGKILL");
    // SIGKILL is delivered asynchronously; give the kernel time to finish each exit.
    const remaining = async () => { for (const owner of descendants) if (await processState(owner.pid, owner) !== "absent") return true; return false; };
    for (let attempt = 0; attempt < 100 && await remaining(); attempt++) await new Promise((resolve) => setTimeout(resolve, 50));
    for (const owner of descendants) if (await processState(owner.pid, owner) !== "absent")
      throw hostError("E_INTERNAL", "子孫の停止を確認できませんでした。", undefined, { reason: "stop_failed" });
  }
  for (let attempt = 0; attempt < 100 && await processState(pid, identity) === "same"; attempt++) await new Promise((resolve) => setTimeout(resolve, 50));
  if (await processState(pid, identity) !== "absent") throw hostError("E_INTERNAL", "プロセスの停止を確認できませんでした。", "run を確認し、停止できるまで別の書き込みを開始しないでください。", { reason: "stop_failed" });
}
// The optional limit is for direct worker lifecycle tests, never an operation input.
export async function runWorker(job: string, id: string, limit?: number): Promise<void> {
  const recordFile = await jobFile(job, `.smm/runs/${id}/run.json`);
  let run = JSON.parse(await fs.readFile(recordFile, "utf8")) as RunRecord;
  if (run.status !== "running") return;
  const owners = await readProcessOwners(job, id);
  await transferLock(job, id, owners.token);
  owners.worker = await identifyProcess(process.pid) ?? undefined;
  const output = await openWriteVerified(await jobFile(job, `.smm/runs/${id}/stdout.log`), "a");
  const errors = await openWriteVerified(await jobFile(job, `.smm/runs/${id}/stderr.log`), "a");
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writeQueue = Promise.resolve();
  const save = () => {
    const snapshot = structuredClone(run);
    writeQueue = writeQueue.catch(() => {}).then(async () => {
      const current = JSON.parse(await fs.readFile(recordFile, "utf8")) as RunRecord;
      if (current.status === "running") await atomicJson(recordFile, snapshot);
    });
    return writeQueue;
  };
  let terminal: "cancelled" | "timed_out" | undefined;
  let stopping: Promise<void> | undefined;
  let stopFailed!: (error: unknown) => void;
  const stopFailure = new Promise<never>((_, reject) => { stopFailed = reject; });
  stopFailure.catch(() => {});
  const stop = (reason: "cancelled" | "timed_out") => {
    if (stopping) return stopping;
    terminal = reason;
    stopping = stopProcessTree(run.script_pid, owners.script);
    stopping.catch(stopFailed);
    return stopping;
  };
  let safeToRelease = true;
  try {
    if ((JSON.parse(await fs.readFile(recordFile, "utf8")) as RunRecord).status !== "running") return;
    run.pid = process.pid; run.heartbeat_at = new Date().toISOString();
    const command = await runCommand(job, run.kind, { ...run.args, job: "." } as OperationInputs[typeof run.kind]);
    // npm workspace URLs reject the Windows namespace prefix; other scripts retain long cwd support.
    const cwd = process.platform === "win32" && run.kind !== "setup" ? path.toNamespacedPath(command.cwd) : command.cwd;
    const child = spawn(process.execPath, command.args, { cwd, detached: process.platform !== "win32", shell: false, windowsHide: true, stdio: ["ignore", output.fd, errors.fd] });
    run.script_pid = child.pid ?? null;
    const completion = new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    // Register rejection handling before the first filesystem await.
    completion.catch(() => {});
    owners.script = await identifyProcess(run.script_pid) ?? undefined;
    // A PID observed after this child exited may already belong to somebody else.
    const childExited = child.exitCode !== null || child.signalCode !== null;
    if (childExited) owners.script = undefined;
    if (!childExited && run.script_pid && !owners.script && await identifyProcess(run.script_pid) !== null)
      throw hostError("E_INTERNAL", "script の同一性を確認できません。", undefined, { reason: "identity_unavailable" });
    await atomicJson(await jobFile(job, `.smm/runs/${id}/processes.json`), owners);
    await save();
    let heartbeatError: unknown;
    heartbeat = setInterval(() => { run.heartbeat_at = new Date().toISOString(); void save().catch((error) => { heartbeatError = error; void stop("cancelled").catch(() => {}); }); }, 5000);
    poll = setInterval(() => { void fs.access(path.join(job, ".smm", "runs", id, "cancel")).then(() => stop("cancelled")).catch(() => {}); }, 100);
    timer = setTimeout(() => { void stop("timed_out").catch(() => {}); }, limit ?? runTimeout(run.kind, { ...run.args, job: "." } as OperationInputs[typeof run.kind]));
    const code = await Promise.race([completion, stopFailure]);
    if (stopping) await stopping;
    if (heartbeatError) throw hostError("E_INTERNAL", "heartbeat を保存できませんでした。", undefined, { reason: "heartbeat_failed" });
    run.script_exit_code = code;
    if (terminal) {
      run.status = terminal; run.exit_code = 4;
      run.error = normalizeError(terminal === "timed_out" ? hostError("E_TIMEOUT", "実行時間の上限を超えました。") : hostError("E_INTERNAL", "実行を取り消しました。", "必要なら新しい run を開始してください。", { reason: "cancelled" }));
    } else {
      const stdout = await fs.readFile(await jobFile(job, `.smm/runs/${id}/stdout.log`), "utf8");
      const stderr = await fs.readFile(await jobFile(job, `.smm/runs/${id}/stderr.log`), "utf8");
      const outcome = await collectRunResult(job, run, code, stdout, stderr);
      run.status = "completed"; run.result = outcome.result; run.artifacts = outcome.result.artifacts; run.exit_code = outcome.exit_code;
    }
  } catch (error) {
    run.status = "failed"; run.error = normalizeError(error); run.exit_code = errorExitCode(run.error.code);
    const details = run.error.details && typeof run.error.details === "object" && !Array.isArray(run.error.details) ? run.error.details : {};
    run.error.details = { ...details, reason: details.reason ?? (stopping ? "stop_failed" : "execution_failed") };
    await errors.writeFile(JSON.stringify({ code: run.error.code, message: run.error.message, reason: run.error.details.reason }) + "\n");
    try {
      await stopProcessTree(run.script_pid, owners.script);
      if (await processState(run.script_pid, owners.script) !== "absent") safeToRelease = false;
    } catch { safeToRelease = false; }
  } finally {
    clearInterval(heartbeat); clearInterval(poll); clearTimeout(timer);
    await output.close(); await errors.close();
    run.heartbeat_at = new Date().toISOString(); run.ended_at = run.heartbeat_at;
    run.progress = { ratio: run.status === "completed" ? 1 : null, text: run.status === "completed" ? "実行が完了しました。" : "実行が終了しました。" };
    // Publish a terminal state only after the script has stopped and its lock is released.
    if (safeToRelease) await releaseOwnedLock(job, id, owners.token);
    await save();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { await runWorker(process.argv[2], process.argv[3]); }
  catch (error) {
    const normalized = normalizeError(error);
    console.error(JSON.stringify({ code: normalized.code, message: normalized.message, reason: "worker_start_failed" }));
    process.exitCode = 1;
  }
}
