import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { HostContext } from "./types.ts";
import { hostError, isMissing } from "./errors.ts";
import { jobFile, resolveJob, ensureDirectory, openWriteVerified } from "./paths.ts";
import { atomicJson } from "./io.ts";

export { processExists } from "./processes.ts";
import { identifyProcess, processExists, processState, readProcessOwners, type ProcessIdentity } from "./processes.ts";
type Lock = { owner: string; pid: number; token: string; identity?: ProcessIdentity };
const lockState = (lock: Lock) => lock.identity ? processState(lock.pid, lock.identity) : Promise.resolve(processExists(lock.pid) ? "unknown" : "absent");
async function lockGuard<T>(job: string, owner: string, action: () => Promise<T>): Promise<T> {
  const file = await jobFile(job, ".smm/reclaim.lock");
  let handle;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { handle = await openWriteVerified(file, "wx"); break; }
    catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "EEXIST") throw error;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  if (!handle) throw hostError("E_BUSY", "排他予約の所有権を確認中です。", "全 run と所有プロセスの停止を確認後、残った .smm/reclaim.lock を削除して再試行してください。", { run_id: owner });
  try { await handle.writeFile(JSON.stringify({ pid: process.pid }) + "\n"); return await action(); }
  finally { await handle.close(); await fs.unlink(file); }
}
export async function acquireJobLock(context: HostContext, relative: string, owner: string): Promise<{ token: string; release(): Promise<void> }> {
  const job = await resolveJob(context, relative);
  await ensureDirectory(await jobFile(job, ".smm"));
  const file = await jobFile(job, ".smm/write.lock");
  const token = randomBytes(16).toString("hex");
  const identity = await identifyProcess(process.pid);
  if (!identity) throw hostError("E_INTERNAL", "所有プロセスの同一性を確認できません。", undefined, { reason: "identity_unavailable" });
  const lock: Lock = { owner, pid: process.pid, token, identity };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const handle = await openWriteVerified(await jobFile(job, ".smm/write.lock"), "wx");
      try { await handle.writeFile(JSON.stringify(lock) + "\n"); } finally { await handle.close(); }
      return { token, release: async () => {
        try { const current = JSON.parse(await fs.readFile(await jobFile(job, ".smm/write.lock"), "utf8")) as Lock;
          if (current.token === token) await fs.unlink(file);
        } catch (error) { if (!isMissing(error)) throw error; }
      } };
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "EEXIST") throw error;
      let current: Lock | undefined;
      for (let retry = 0; retry < 20; retry++) {
        try { current = JSON.parse(await fs.readFile(file, "utf8")) as Lock; break; }
        catch (readError) {
          if (isMissing(readError)) break;
          if (!(readError instanceof SyntaxError)) throw readError;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }
      if (!current) {
        try { await fs.access(file); }
        catch (readError) { if (isMissing(readError)) continue; throw readError; }
        throw hostError("E_BUSY", "ジョブの排他予約の所有者を確認できません。", "全 run と所有プロセスの停止を確認後、破損した .smm/write.lock を削除して再試行してください。", { owner: "不明" });
      }
      if (await lockState(current) !== "absent") throw hostError("E_BUSY", "別の書き込み操作が実行中です。", "所有する run の終了を待つか取り消してください。", { run_id: current.owner });
      // Serialize stale-lock collectors. Never remove a replacement lock.
      const stale = current;
      await lockGuard(job, current.owner, async () => {
        const latest = JSON.parse(await fs.readFile(file, "utf8")) as Lock;
        if (latest.token === stale.token && await lockState(latest) === "absent") {
          // An orphan script must be stopped by cancellation before a new writer.
          if (/^r-/.test(latest.owner)) {
            try {
              const run = JSON.parse(await fs.readFile(await jobFile(job, `.smm/runs/${latest.owner}/run.json`), "utf8"));
              const owners = await readProcessOwners(job, latest.owner);
              if (await processState(run.pid, owners.worker) !== "absent" || await processState(run.script_pid, owners.script) !== "absent" || run.status === "running" && Date.now() - Date.parse(run.heartbeat_at) < 15000) throw hostError("E_BUSY", "実行中または起動直後の run が残っています。", "run の状態を確認し、必要なら run_cancel で停止してください。", { run_id: latest.owner });
              if (run.status === "running") await atomicJson(await jobFile(job, `.smm/runs/${latest.owner}/run.json`), { ...run, status: "lost", exit_code: 4, ended_at: new Date().toISOString(), error: { code: "E_RUN_LOST", message: "run の実行プロセスが見つかりません。", hint: "ログを確認してください。" } });
            } catch (runError) { if (!isMissing(runError)) throw runError; }
          }
          await fs.unlink(file);
        }
      });
    }
  }
  throw hostError("E_BUSY", "ジョブを予約できませんでした。", "実行中の操作を確認してください。");
}
export async function transferLock(job: string, owner: string, token: string): Promise<void> {
  await lockGuard(job, owner, async () => {
    const file = await jobFile(job, ".smm/write.lock");
    const lock = JSON.parse(await fs.readFile(file, "utf8")) as Lock;
    if (lock.owner !== owner || lock.token !== token) throw hostError("E_BUSY", "run の排他所有が変わりました。");
    const identity = await identifyProcess(process.pid);
    if (!identity) throw hostError("E_INTERNAL", "worker の同一性を確認できません。", undefined, { reason: "identity_unavailable" });
    await atomicJson(file, { ...lock, pid: process.pid, identity });
  });
}
export async function releaseOwnedLock(job: string, owner: string, token: string): Promise<void> {
  await lockGuard(job, owner, async () => {
    try {
      const file = await jobFile(job, ".smm/write.lock");
      const lock = JSON.parse(await fs.readFile(file, "utf8")) as Lock;
      if (lock.owner === owner && lock.token === token) await fs.unlink(file);
    } catch (error) { if (!isMissing(error)) throw error; }
  });
}
