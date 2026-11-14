import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import type { OperationInputs, RunRecord } from "./types.ts";
import { hostError, normalizeError, errorExitCode } from "./errors.ts";
import { jobFile } from "./paths.ts";
import { atomicJson } from "./io.ts";
import { processExists, releaseOwnedLock, transferLock } from "./locks.ts";
import { collectRunResult } from "./run-result.ts";
import { runCommand, runTimeout } from "./run-options.ts";

export async function stopProcessTree(pid: number | null): Promise<void> {
  if (!pid || !processExists(pid)) return;
  if (process.platform === "win32") {
    const system = process.env.SystemRoot ?? process.env.WINDIR;
    const executable = system ? path.join(system, "System32", "taskkill.exe") : "taskkill.exe";
    await new Promise<void>((resolve, reject) => {
      const killer = spawn(executable, ["/PID", String(pid), "/T", "/F"], { shell: false, windowsHide: true, stdio: "ignore" });
      killer.once("error", reject);
      killer.once("close", (code) => code === 0 || !processExists(pid) ? resolve() : reject(hostError("E_INTERNAL", "プロセスツリーを停止できませんでした。")));
    });
  } else {
    try { process.kill(-pid, "SIGKILL"); }
    catch (error) { if (processExists(pid)) throw error; }
  }
  for (let attempt = 0; attempt < 100 && processExists(pid); attempt++) await new Promise((resolve) => setTimeout(resolve, 50));
  if (processExists(pid)) throw hostError("E_INTERNAL", "プロセスの停止を確認できませんでした。", "run を確認し、停止できるまで別の書き込みを開始しないでください。");
}
// The optional limit is for direct worker lifecycle tests, never an operation input.
export async function runWorker(job: string, id: string, limit?: number): Promise<void> {
  const recordFile = await jobFile(job, `.smm/runs/${id}/run.json`);
  let run = JSON.parse(await fs.readFile(recordFile, "utf8")) as RunRecord;
  if (run.status !== "running") return;
  await transferLock(job, id);
  const output = await fs.open(await jobFile(job, `.smm/runs/${id}/stdout.log`), "a");
  const errors = await fs.open(await jobFile(job, `.smm/runs/${id}/stderr.log`), "a");
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writeQueue = Promise.resolve();
  const save = () => { const snapshot = structuredClone(run); writeQueue = writeQueue.catch(() => {}).then(() => atomicJson(recordFile, snapshot)); return writeQueue; };
  let terminal: "cancelled" | "timed_out" | undefined;
  let stopping: Promise<void> | undefined;
  const stop = (reason: "cancelled" | "timed_out") => {
    if (stopping) return stopping;
    terminal = reason;
    stopping = stopProcessTree(run.script_pid);
    return stopping;
  };
  let safeToRelease = true;
  try {
    run.pid = process.pid; run.heartbeat_at = new Date().toISOString();
    const command = await runCommand(job, run.kind, { ...run.args, job: "." } as OperationInputs[typeof run.kind]);
    const child = spawn(process.execPath, command.args, { cwd: process.platform === "win32" ? path.toNamespacedPath(command.cwd) : command.cwd, detached: process.platform !== "win32", shell: false, windowsHide: true, stdio: ["ignore", output.fd, errors.fd] });
    run.script_pid = child.pid ?? null;
    const completion = new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    // Register rejection handling before the first filesystem await.
    completion.catch(() => {});
    await save();
    heartbeat = setInterval(() => { run.heartbeat_at = new Date().toISOString(); void save().catch(() => stop("cancelled").catch(() => {})); }, 5000);
    poll = setInterval(() => { void fs.access(path.join(job, ".smm", "runs", id, "cancel")).then(() => stop("cancelled")).catch(() => {}); }, 100);
    timer = setTimeout(() => { void stop("timed_out").catch(() => {}); }, limit ?? runTimeout(run.kind, { ...run.args, job: "." } as OperationInputs[typeof run.kind]));
    const code = await completion;
    if (stopping) await stopping;
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
    await errors.writeFile(String(error instanceof Error ? error.stack : error) + "\n");
    run.status = "failed"; run.error = normalizeError(error); run.exit_code = errorExitCode(run.error.code);
    try { await stopProcessTree(run.script_pid); } catch { safeToRelease = false; }
  } finally {
    clearInterval(heartbeat); clearInterval(poll); clearTimeout(timer);
    await output.close(); await errors.close();
    run.heartbeat_at = new Date().toISOString(); run.ended_at = run.heartbeat_at;
    run.progress = { ratio: run.status === "completed" ? 1 : null, text: run.status === "completed" ? "実行が完了しました。" : "実行が終了しました。" };
    // Publish a terminal state only after the script has stopped and its lock is released.
    if (safeToRelease) await releaseOwnedLock(job, id);
    await save();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await runWorker(process.argv[2], process.argv[3]);
}
