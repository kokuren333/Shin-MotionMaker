import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { hostError, isMissing } from "../errors.ts";
import { atomicJson } from "../io.ts";
import { ensureDirectory, jobFile, openWriteVerified, readJobBytes } from "../paths.ts";
import { processExists } from "../processes.ts";
import { roundUsd } from "./models.ts";
import type { SeedanceStatus, SeedanceTask, TasksDocument } from "./types.ts";

export const TASKS_FILE = "seedance/tasks.json";
export const LOCK_FILE = "seedance/.lock";
export const OUT_DIR = "seedance/out";
export const ORPHAN_CREATING_MS = 10 * 60 * 1000;
const LOCK_WAIT_MS = 15000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const errorCode = (error: unknown) => error && typeof error === "object" && "code" in error ? String(error.code) : "";

/**
 * Run `action` while holding <job>/seedance/.lock (exclusive create, content {pid}).
 * A lock whose owner process no longer exists is discarded; there is no time-based expiry.
 */
export async function withTasksLock<T>(job: string, action: () => Promise<T>): Promise<T> {
  await ensureDirectory(await jobFile(job, "seedance"));
  const file = await jobFile(job, LOCK_FILE);
  const started = Date.now();
  let unreadable = 0;
  for (;;) {
    let handle;
    try { handle = await openWriteVerified(file, "wx"); }
    catch (error) {
      if (errorCode(error) !== "EEXIST") throw error;
      let owner: number | null = null, identity: { ino: number; mtimeMs: number } | null = null;
      try {
        const stat = await fs.stat(file);
        identity = { ino: stat.ino, mtimeMs: stat.mtimeMs };
        const parsed = JSON.parse(await fs.readFile(file, "utf8")) as { pid?: unknown };
        owner = typeof parsed.pid === "number" ? parsed.pid : null;
      } catch (readError) {
        if (isMissing(readError)) continue;
        // The owner may not have written its pid yet.
        if (++unreadable > 100) throw hostError("E_BUSY", "Seedance 台帳のロックの所有者を確認できません。", "Seedance の操作が動いていないことを確かめてから、ジョブ内の seedance/.lock を削除して再試行してください。");
        await delay(10); continue;
      }
      if (owner !== null && !processExists(owner) && identity) {
        try {
          const again = await fs.stat(file);
          if (again.ino === identity.ino && again.mtimeMs === identity.mtimeMs) await fs.unlink(file);
        } catch (unlinkError) { if (!isMissing(unlinkError)) throw unlinkError; }
        continue;
      }
      if (Date.now() - started > LOCK_WAIT_MS) throw hostError("E_BUSY", "別の Seedance 操作が台帳を使用中です。", "しばらく待ってから再試行してください。", { owner_pid: owner });
      await delay(5 + Math.floor(Math.random() * 15));
      continue;
    }
    try {
      try { await handle.writeFile(JSON.stringify({ pid: process.pid }) + "\n"); } finally { await handle.close(); }
      return await action();
    } finally {
      try { await fs.unlink(file); } catch (error) { if (!isMissing(error)) throw error; }
    }
  }
}
export async function readTasks(job: string): Promise<TasksDocument> {
  let bytes: Buffer;
  try { bytes = await readJobBytes(job, TASKS_FILE); }
  catch (error) { if (isMissing(error)) return { schema: "smm.seedance-tasks/1", tasks: [] }; throw error; }
  try {
    const value = JSON.parse(bytes.toString("utf8").replace(/^﻿/, "")) as TasksDocument;
    if (value?.schema !== "smm.seedance-tasks/1" || !Array.isArray(value.tasks)) throw Error();
    return value;
  } catch { throw hostError("E_INTERNAL", "Seedance の台帳（seedance/tasks.json）を読めません。", "ファイルの JSON を確認してください。生成済みの動画は seedance/out/ に残っています。", { reason: "invalid_tasks_json" }); }
}
export async function writeTasks(job: string, document: TasksDocument): Promise<void> {
  await ensureDirectory(await jobFile(job, "seedance"));
  await atomicJson(await jobFile(job, TASKS_FILE), document);
}
/** Read, change and write the ledger in one lock section. `change` returns the value to hand back. */
export async function mutateTasks<T>(job: string, change: (document: TasksDocument) => T | Promise<T>): Promise<T> {
  return withTasksLock(job, async () => {
    const document = await readTasks(job);
    const before = JSON.stringify(document);
    const result = await change(document);
    if (JSON.stringify(document) !== before) await writeTasks(job, document);
    return result;
  });
}
/** creating without task_id whose owner is gone, or older than 10 minutes, becomes unknown (still reserved). */
export function reconcile(document: TasksDocument, now: Date): boolean {
  let changed = false;
  for (const task of document.tasks) {
    if (task.status !== "creating" || task.task_id) continue;
    const age = now.getTime() - Date.parse(task.created_at);
    if (!processExists(task.owner_pid) || !(age <= ORPHAN_CREATING_MS)) {
      task.status = "unknown";
      task.updated_at = now.toISOString();
      task.error = { code: "E_ENGINE_UNREACHABLE", message: "作成要求の送信結果を確認できないまま、所有プロセスが終了したか時間が経過しました。", hint: "seedance status で追跡するか、BytePlus コンソールのタスク一覧で確認してください。", details: { kind: "orphan_creating" } };
      changed = true;
    }
  }
  return changed;
}
export const RESERVED_STATUSES: readonly SeedanceStatus[] = ["creating", "queued", "running", "unknown"];
export type BudgetSummary = { real_spent_usd: number; reserved_usd: number };
export function budgetSummary(tasks: SeedanceTask[]): BudgetSummary {
  let spent = 0, reserved = 0;
  for (const task of tasks) {
    if (task.dry_run) continue;
    if (RESERVED_STATUSES.includes(task.status)) reserved += task.estimate_usd;
    else if (task.status === "succeeded") spent += task.actual_usd ?? task.estimate_usd;
    else if (task.actual_usd !== null) spent += task.actual_usd;
  }
  return { real_spent_usd: roundUsd(spent), reserved_usd: roundUsd(reserved) };
}
export async function fileSha256(job: string, relative: string): Promise<string | null> {
  try {
    const file = await jobFile(job, relative);
    if (!(await fs.stat(file)).isFile()) return null;
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
    return hash.digest("hex");
  } catch (error) { if (isMissing(error)) return null; throw error; }
}
export async function fileExists(job: string, relative: string): Promise<boolean> {
  try { await fs.lstat(await jobFile(job, relative)); return true; }
  catch (error) { if (isMissing(error)) return false; throw error; }
}
/** First free output name: <shot_id>, <shot_id>-2, ... Never reuses a name that has a file or belongs to another record. */
export async function chooseOutputName(job: string, document: TasksDocument, task: SeedanceTask): Promise<string> {
  const claimed = new Set(document.tasks.filter((other) => other.local_id !== task.local_id && other.output).map((other) => other.output));
  for (let index = 1; index < 10000; index++) {
    const name = index === 1 ? task.shot_id : `${task.shot_id}-${index}`;
    const relative = `${OUT_DIR}/${name}.mp4`;
    if (claimed.has(relative)) continue;
    if (await fileExists(job, relative) || await fileExists(job, `${OUT_DIR}/${name}.json`)) continue;
    return name;
  }
  throw hostError("E_OUTPUT_EXISTS", "出力名の候補を使い切りました。", "seedance/out/ の不要なファイルを整理してください。");
}
export function newLocalId(now: Date): string {
  return `s-${now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}-${randomBytes(4).toString("hex")}`;
}
