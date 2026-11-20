import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import type { Advisory, JsonObject, JsonValue } from "../../core/index.ts";
import type { HostContext } from "../types.ts";
import { hostError, normalizeError } from "../errors.ts";
import { atomicJson, replaceFile } from "../io.ts";
import { ensureDirectory, jobFile, openWriteVerified, readProjectFile, resolveJob } from "../paths.ts";
import { findFfmpeg, probe } from "../tools.ts";
import { costFromTokens, MODELS, roundUsd } from "./models.ts";
import { buildBody, cacheKey, integerIn, normalizeCreate, resolveAssets, type SeedanceCreateInput } from "./request.ts";
import { createMockTransport } from "./mock.ts";
import { inspectMp4File } from "./mp4.ts";
import { budgetSummary, chooseOutputName, fileSha256, mutateTasks, newLocalId, OUT_DIR, readTasks, reconcile, TASKS_FILE } from "./store.ts";
import type { RemoteTask, SeedanceStatus, SeedanceTask, SeedanceVideoFacts, Transport } from "./types.ts";

export type { SeedanceCreateInput };
export type SeedanceDeps = {
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  findFfmpeg?: () => Promise<string | null>;
};
export type SeedanceStatusInput = { job: string; task_id?: string; shot_id?: string; wait_ms?: number };
export type SeedanceListInput = { job: string };
export type SeedanceTaskResult = { task: SeedanceTask; cached: boolean };
export type SeedanceListSummary = {
  count: number; by_status: Partial<Record<SeedanceStatus, number>>; dry_run: boolean; api_key_present: boolean;
  budget_usd: number | null; budget_scope: "job"; real_spent_usd: number; reserved_usd: number; remaining_usd: number | null; mock_count: number;
};
export type SeedanceListResult = { tasks: SeedanceTask[]; summary: SeedanceListSummary };
type Outcome<T> = { result: T; advisories: Advisory[] };
type Runtime = { env: Record<string, string | undefined>; fetchImpl?: typeof fetch; now: () => Date; sleep: (ms: number) => Promise<void>; findFfmpeg: () => Promise<string | null> };

const DEFAULT_BUDGET_USD = 10;
const DEFAULT_POLL_MS = 5000;
const TERMINAL: readonly SeedanceStatus[] = ["succeeded", "failed", "cancelled", "expired", "error"];

function runtime(deps: SeedanceDeps = {}): Runtime {
  return {
    env: deps.env ?? process.env,
    fetchImpl: deps.fetch,
    now: deps.now ?? (() => new Date()),
    sleep: deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))),
    findFfmpeg: deps.findFfmpeg ?? (() => findFfmpeg()),
  };
}
/** Evaluated on every call: only "false" or "0" (case and surrounding spaces ignored) turn DRY_RUN off. */
export function isDryRun(env: Record<string, string | undefined>): boolean {
  const value = env.SEEDANCE_DRY_RUN;
  if (value === undefined) return true;
  const text = value.trim().toLowerCase();
  return !(text === "false" || text === "0");
}
export const apiKeyPresent = (env: Record<string, string | undefined>) => !!(env.ARK_API_KEY ?? "").trim();
export function budgetLimit(env: Record<string, string | undefined>): number {
  const raw = env.SEEDANCE_BUDGET_USD;
  if (raw === undefined || raw.trim() === "") return DEFAULT_BUDGET_USD;
  const value = Number(raw.trim());
  if (!Number.isFinite(value) || value < 0) throw hostError("E_INPUT_INVALID", "SEEDANCE_BUDGET_USD が 0 以上の数ではありません。", "環境変数 SEEDANCE_BUDGET_USD に 0 以上の USD 金額を指定してください（既定 10）。", { field: "SEEDANCE_BUDGET_USD" });
  return value;
}
export function pollInterval(env: Record<string, string | undefined>): number {
  const value = Number((env.SEEDANCE_POLL_INTERVAL_MS ?? "").trim() || DEFAULT_POLL_MS);
  return Number.isFinite(value) ? Math.max(1000, Math.floor(value)) : DEFAULT_POLL_MS;
}
const videoGenerationOn = (project: Record<string, unknown> | undefined) => {
  const settings = project?.asset_generation;
  return !!settings && typeof settings === "object" && (settings as Record<string, unknown>).video_generation === true;
};
function disabled(reason: "api_key_missing" | "video_generation_off" | "budget_exceeded" | "read_only", extra: JsonObject = {}): Error {
  const text: Record<typeof reason, [string, string]> = {
    api_key_missing: ["実 API モードですが ARK_API_KEY が設定されていません。", "環境変数 ARK_API_KEY に API キーを設定するか、SEEDANCE_DRY_RUN を外してモックで実行してください。"],
    video_generation_off: ["project.json で動画生成が有効になっていません。", "実 API で生成するには project.json の asset_generation.video_generation を true にしてください。"],
    budget_exceeded: ["Seedance の予算（SEEDANCE_BUDGET_USD）を超えるため作成しません。", "解像度・長さ・モデルを見直すか、SEEDANCE_BUDGET_USD を引き上げてください。予算はジョブ単位です。"],
    read_only: ["読み取り専用では Seedance の書き込み操作を実行できません。", "読み取り専用を外して実行してください。"],
  };
  return hostError("E_DISABLED", text[reason][0], text[reason][1], { reason, ...extra });
}
/** The only place that decides between the mock and the network client. The client is never loaded in DRY_RUN. */
export async function selectTransport(dryRun: boolean, deps: SeedanceDeps = {}): Promise<Transport> {
  if (dryRun) return createMockTransport();
  const { createArkTransport } = await import("./client.ts");
  return createArkTransport({ env: deps.env ?? process.env, fetchImpl: deps.fetch, sleep: deps.sleep });
}
const clone = <T>(value: T): T => structuredClone(value);
const advisory = (id: string, message: string, details?: JsonValue): Advisory => ({ id, source: "seedance", message, ...(details === undefined ? {} : { details }) });
function withDetails(error: unknown, extra: JsonObject): unknown {
  if (error && typeof error === "object" && "code" in error && "hint" in error) {
    const current = (error as { details?: unknown }).details;
    (error as { details?: unknown }).details = { ...(current && typeof current === "object" && !Array.isArray(current) ? current : {}), ...extra };
  }
  return error;
}
async function updateTask(job: string, localId: string, change: (task: SeedanceTask) => void, now: Date): Promise<SeedanceTask> {
  return mutateTasks(job, (document) => {
    const task = document.tasks.find((item) => item.local_id === localId);
    if (!task) throw hostError("E_INTERNAL", "Seedance の台帳からレコードが消えています。", "seedance/tasks.json を確認してください。", { local_id: localId });
    change(task);
    task.updated_at = now.toISOString();
    return clone(task);
  });
}
async function findCached(job: string, key: string): Promise<SeedanceTask | null> {
  const { tasks } = await readTasks(job);
  for (const task of [...tasks].reverse()) {
    if (task.cache_key !== key || task.status !== "succeeded" || !task.output || !task.output_sha256) continue;
    if (await fileSha256(job, task.output) === task.output_sha256) return { ...clone(task), cached: true };
  }
  return null;
}
function applyRemote(task: SeedanceTask, remote: RemoteTask): void {
  if (remote.status === "queued" || remote.status === "running") task.status = remote.status;
  else if (remote.status === "succeeded" && task.status !== "succeeded") task.status = "running";
  else if (remote.status === "failed" || remote.status === "cancelled" || remote.status === "expired") {
    task.status = remote.status;
    task.error = { code: "E_ENGINE_UNREACHABLE", message: remote.status === "failed" ? "Seedance のタスクが失敗しました。" : remote.status === "expired" ? "Seedance のタスクが期限切れになりました。" : "Seedance のタスクは取り消されています。",
      hint: "プロンプト・素材・パラメータを見直して作り直してください。", details: { kind: "task_" + remote.status, ...(remote.error?.code ? { api_code: remote.error.code } : {}), ...(remote.error?.message ? { api_message: remote.error.message } : {}) } };
  }
  const tokens = remote.usage?.completion_tokens;
  if (typeof tokens === "number" && Number.isFinite(tokens) && tokens >= 0) {
    task.usage_tokens = tokens;
    const model = MODELS.find((entry) => entry.id === task.model.id);
    task.actual_usd = task.dry_run ? 0 : model ? costFromTokens(model, task.params.resolution, task.inputs.some((input) => input.role === "reference_video"), tokens) : null;
  }
}
async function saveOutput(job: string, localId: string, remote: RemoteTask, transport: Transport, rt: Runtime, advisories: Advisory[]): Promise<SeedanceTask> {
  const url = remote.content?.video_url;
  const fail = async (reason: string) => {
    await updateTask(job, localId, (task) => {
      // The remote task succeeded and is billed: keep its cost (actual, else the estimate) in the budget.
      applyRemote(task, remote);
      if (!task.dry_run) task.actual_usd ??= task.estimate_usd;
      task.status = "error"; task.output = null;
      task.error = { code: "E_ENGINE_UNREACHABLE", message: "Seedance の出力動画を検査できませんでした。", hint: "BytePlus コンソールで動画を確認してください。", details: { kind: "invalid_output", reason } };
    }, rt.now());
    return hostError("E_ENGINE_UNREACHABLE", "Seedance の出力動画を検査できませんでした。", "BytePlus コンソールで動画を確認してください。", { kind: "invalid_output", reason, local_id: localId });
  };
  if (!url) throw await fail("missing_video_url");
  const name = await mutateTasks(job, async (document) => {
    const task = document.tasks.find((item) => item.local_id === localId);
    if (!task) throw hostError("E_INTERNAL", "Seedance の台帳からレコードが消えています。", "seedance/tasks.json を確認してください。", { local_id: localId });
    if (task.status === "succeeded" && task.output) return null;
    if (task.output) return task.output.slice(OUT_DIR.length + 1, -".mp4".length);
    const chosen = await chooseOutputName(job, document, task);
    task.output = `${OUT_DIR}/${chosen}.mp4`;
    task.updated_at = rt.now().toISOString();
    return chosen;
  });
  if (name === null) return (await readTasks(job)).tasks.find((item) => item.local_id === localId)!;
  await ensureDirectory(await jobFile(job, OUT_DIR));
  const suffix = randomBytes(6).toString("hex");
  const temporary = await jobFile(job, `${OUT_DIR}/.${name}.${suffix}.mp4.tmp`);
  const video = `${OUT_DIR}/${name}.mp4`;
  let download: { bytes: number; sha256: string };
  let facts: SeedanceVideoFacts;
  try {
    const handle = await openWriteVerified(temporary, "wx");
    try { download = await transport.download(url, handle); } finally { await handle.close(); }
    const check = await inspectMp4File(temporary);
    if (!check.ok) throw await fail(check.reason);
    await replaceFile(temporary, await jobFile(job, video));
    facts = { bytes: download.bytes, duration_seconds: check.duration_seconds, width: check.width, height: check.height };
  } finally { await fs.rm(temporary, { force: true }); }
  let thumbnail: string | null = null;
  const ffmpeg = await rt.findFfmpeg();
  if (ffmpeg) {
    const png = await jobFile(job, `${OUT_DIR}/.${name}.${suffix}.tmp.png`);
    try {
      const result = await probe(ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error", "-i", await jobFile(job, video), "-frames:v", "1", "-update", "1", png], 60000);
      if (result.code === 0 && (await fs.stat(png)).size > 0) { await replaceFile(png, await jobFile(job, `${OUT_DIR}/${name}.png`)); thumbnail = `${OUT_DIR}/${name}.png`; }
    } catch {} finally { await fs.rm(png, { force: true }); }
  }
  if (!thumbnail) advisories.push(advisory("seedance-thumbnail-unavailable", "ffmpeg が見つからないか先頭フレームを取り出せなかったため、サムネイル PNG を作りませんでした。動画は保存済みです。"));
  const sidecar = `${OUT_DIR}/${name}.json`;
  const now = rt.now();
  const saved = await updateTask(job, localId, (task) => {
    applyRemote(task, remote);
    task.status = "succeeded"; task.output = video; task.output_sha256 = download.sha256; task.video = facts;
    task.thumbnail = thumbnail; task.sidecar = sidecar; task.error = null;
  }, now);
  await atomicJson(await jobFile(job, sidecar), {
    schema: "smm.seedance-output/1", shot_id: saved.shot_id, local_id: saved.local_id, task_id: saved.task_id, dry_run: saved.dry_run,
    model: saved.model, mode: saved.mode, prompt: saved.prompt, inputs: saved.inputs, params: saved.params,
    estimate_usd: saved.estimate_usd, usage_tokens: saved.usage_tokens, actual_usd: saved.actual_usd,
    video: { path: video, bytes: facts.bytes, sha256: download.sha256, duration_seconds: facts.duration_seconds, width: facts.width, height: facts.height },
    thumbnail, generated_at: now.toISOString(),
  });
  return saved;
}
/** Poll until a terminal state or the wait limit, then save a successful result. */
async function follow(job: string, localId: string, transport: Transport, waitMs: number, atLeastOnce: boolean, rt: Runtime, advisories: Advisory[]): Promise<SeedanceTask> {
  let task = (await readTasks(job)).tasks.find((item) => item.local_id === localId)!;
  if (waitMs <= 0 && !atLeastOnce) {
    advisories.push(advisory("seedance-still-running", "タスクを作成しました。seedance status で進行の確認と保存ができます。", { local_id: localId, task_id: task.task_id }));
    return task;
  }
  const interval = pollInterval(rt.env);
  const started = rt.now().getTime();
  let slept = 0;
  for (;;) {
    let remote: RemoteTask;
    try { remote = await transport.get(task.task_id!, { model_id: task.model.id, estimate_tokens: task.estimate_tokens }); }
    catch (error) { throw withDetails(error, { local_id: localId, task_id: task.task_id }); }
    if (remote.status === "succeeded") return saveOutput(job, localId, remote, transport, rt, advisories);
    task = await updateTask(job, localId, (item) => applyRemote(item, remote), rt.now());
    if (TERMINAL.includes(task.status)) {
      advisories.push(advisory("seedance-task-ended", "Seedance のタスクは成功せずに終了しました。", { status: task.status }));
      return task;
    }
    const elapsed = Math.max(rt.now().getTime() - started, slept);
    if (elapsed + interval > waitMs) {
      advisories.push(advisory("seedance-still-running", "待機の上限に達しました。生成は続いています。seedance status で再開してください。", { local_id: localId, task_id: task.task_id, status: task.status }));
      return task;
    }
    await rt.sleep(interval);
    slept += interval;
  }
}

export async function seedanceCreate(context: HostContext, input: SeedanceCreateInput, deps?: SeedanceDeps): Promise<Outcome<SeedanceTaskResult>> {
  const rt = runtime(deps);
  if (context.readOnly) throw disabled("read_only");
  const job = await resolveJob(context, input?.job);
  const dryRun = isDryRun(rt.env);
  const budget = budgetLimit(rt.env);
  const plan = normalizeCreate(input);
  const { project } = await readProjectFile(job);
  const optIn = videoGenerationOn(project);
  const advisories: Advisory[] = [];
  if (!dryRun) {
    if (!apiKeyPresent(rt.env)) throw disabled("api_key_missing");
    if (!optIn) throw disabled("video_generation_off");
  } else {
    if (!optIn) advisories.push(advisory("seedance-opt-in-required-for-real", "DRY_RUN のモックで作成しました。実 API で生成するには project.json の asset_generation.video_generation を true にする必要があります。"));
    advisories.push(advisory("seedance-mock-output", "DRY_RUN のため、外部へ接続せず固定のモック動画を保存しました。寸法と長さは要求と一致しません。"));
  }
  const assets = await resolveAssets(job, plan.assets);
  const backend = dryRun ? "mock" : "ark";
  const key = cacheKey(backend, plan.model, plan.mode, plan.prompt, plan.params, assets);
  if (!plan.force) {
    const hit = await findCached(job, key);
    if (hit) return { result: { task: hit, cached: true }, advisories: [...advisories, advisory("seedance-cache-hit", "同じ入力の生成済み動画があるため、API を呼ばずに返しました。作り直すには force を指定してください。", { local_id: hit.local_id })] };
  }
  const created = rt.now();
  const task: SeedanceTask = {
    local_id: newLocalId(created), shot_id: plan.shot_id, task_id: null, dry_run: dryRun, model: { alias: plan.model.alias, id: plan.model.id },
    mode: plan.mode, prompt: plan.prompt, inputs: assets.map((asset) => asset.record), params: plan.params, cache_key: key, cached: false,
    status: "creating", estimate_usd: plan.estimate.usd, estimate_tokens: plan.estimate.tokens, estimate_basis: plan.estimate.basis,
    usage_tokens: null, actual_usd: null, output: null, output_sha256: null, sidecar: null, thumbnail: null, video: null, error: null,
    owner_pid: process.pid, created_at: created.toISOString(), updated_at: created.toISOString(),
  };
  // Read, budget and append in one lock section so concurrent creates cannot both pass.
  await mutateTasks(job, (document) => {
    reconcile(document, created);
    const { real_spent_usd, reserved_usd } = budgetSummary(document.tasks);
    const total = roundUsd(real_spent_usd + reserved_usd + plan.estimate.usd);
    if (total > budget) throw disabled("budget_exceeded", { budget_usd: budget, real_spent_usd, reserved_usd, estimate_usd: plan.estimate.usd, budget_scope: "job" });
    document.tasks.push(task);
  });
  const transport = await selectTransport(dryRun, { env: rt.env, fetch: rt.fetchImpl, sleep: rt.sleep });
  let id: string;
  try { id = (await transport.create(buildBody(plan.model, plan.prompt, assets, plan.params))).id; }
  catch (error) {
    const normalized = normalizeError(error);
    const details = normalized.details && typeof normalized.details === "object" && !Array.isArray(normalized.details) ? normalized.details : {};
    await updateTask(job, task.local_id, (item) => { item.status = details.uncertain === true ? "unknown" : "error"; item.error = normalized; }, rt.now());
    throw withDetails(error, { local_id: task.local_id });
  }
  await updateTask(job, task.local_id, (item) => { item.task_id = id; item.status = "queued"; }, rt.now());
  const result = await follow(job, task.local_id, transport, plan.wait_ms, false, rt, advisories);
  return { result: { task: result, cached: false }, advisories };
}

async function recoverUnknown(job: string, task: SeedanceTask, transport: Transport, rt: Runtime): Promise<SeedanceTask | null> {
  const remote = await transport.list({ model_id: task.model.id });
  return mutateTasks(job, (document) => {
    const current = document.tasks.find((item) => item.local_id === task.local_id);
    if (!current) return null;
    if (current.task_id) return clone(current); // already claimed by a concurrent status call
    if (current.status !== "unknown") return null;
    const claimed = new Set(document.tasks.filter((item) => item.local_id !== task.local_id && item.task_id).map((item) => item.task_id));
    const created = Math.floor(Date.parse(current.created_at) / 1000);
    const matches = remote.filter((item) => item.model === current.model.id && typeof item.created_at === "number" &&
      item.created_at >= created - 60 && item.created_at <= created + 600 && !claimed.has(item.id));
    if (matches.length !== 1) return null;
    current.task_id = matches[0].id; current.status = "queued"; current.error = null; current.updated_at = rt.now().toISOString();
    return clone(current);
  });
}
const statusKeys = new Set(["job", "task_id", "shot_id", "wait_ms"]);
export async function seedanceStatus(context: HostContext, input: SeedanceStatusInput, deps?: SeedanceDeps): Promise<Outcome<SeedanceTaskResult>> {
  const rt = runtime(deps);
  if (context.readOnly) throw disabled("read_only");
  const unknownKeys = Object.keys(input ?? {}).filter((key) => !statusKeys.has(key));
  if (unknownKeys.length) throw hostError("E_INPUT_INVALID", "seedance_status に未知の項目があります。", "入力スキーマにある項目だけを指定してください。", { fields: unknownKeys });
  const job = await resolveJob(context, input.job);
  const byTask = typeof input.task_id === "string" && input.task_id !== "", byShot = typeof input.shot_id === "string" && input.shot_id !== "";
  if (byTask === byShot) throw hostError("E_INPUT_INVALID", "task_id と shot_id のどちらか一方を指定してください。", "task_id（またはレコードの local_id）か shot_id を1つだけ指定してください。", { field: "task_id" });
  const waitMs = integerIn(input.wait_ms, "wait_ms", 0, 50000, 0);
  const now = rt.now();
  const document = await mutateTasks(job, (current) => { reconcile(current, now); return clone(current); });
  const task = byTask ? [...document.tasks].reverse().find((item) => item.task_id === input.task_id || item.local_id === input.task_id)
    : [...document.tasks].reverse().find((item) => item.shot_id === input.shot_id);
  if (!task) throw hostError("E_INPUT_INVALID", "指定の Seedance タスクが台帳にありません。", "seedance list で task_id・local_id・shot_id を確認してください。", byTask ? { task_id: input.task_id! } : { shot_id: input.shot_id! });
  const advisories: Advisory[] = [];
  if (TERMINAL.includes(task.status) && (task.status !== "succeeded" || task.output)) return { result: { task, cached: false }, advisories };
  const dryRun = isDryRun(rt.env);
  if (!task.dry_run && dryRun) {
    advisories.push(advisory("seedance-dry-run-active", "このタスクは実 API で作成されたものですが、現在は DRY_RUN のため外部へ接続せずに台帳の内容を返しました。", { local_id: task.local_id }));
    return { result: { task, cached: false }, advisories };
  }
  if (!task.dry_run && !apiKeyPresent(rt.env)) throw disabled("api_key_missing");
  const transport = task.dry_run ? createMockTransport() : await selectTransport(false, { env: rt.env, fetch: rt.fetchImpl, sleep: rt.sleep });
  let current = task;
  if (!current.task_id) {
    if (current.status === "creating" || current.dry_run) {
      advisories.push(advisory("seedance-still-creating", "作成要求の処理中です。少し待ってから再度確認してください。", { local_id: current.local_id }));
      return { result: { task: current, cached: false }, advisories };
    }
    const recovered = await recoverUnknown(job, current, transport, rt);
    if (!recovered) {
      advisories.push(advisory("seedance-unknown-task", "作成結果を確認できず、対応するタスクを一意に特定できませんでした。BytePlus コンソールのタスク一覧で確認してください。予算には予約したまま計上しています。", { local_id: current.local_id }));
      return { result: { task: current, cached: false }, advisories };
    }
    current = recovered;
  }
  const result = await follow(job, current.local_id, transport, waitMs, true, rt, advisories);
  return { result: { task: result, cached: false }, advisories };
}

export async function seedanceList(context: HostContext, input: SeedanceListInput, deps?: SeedanceDeps): Promise<Outcome<SeedanceListResult>> {
  const rt = runtime(deps);
  const unknownKeys = Object.keys(input ?? {}).filter((key) => key !== "job");
  if (unknownKeys.length) throw hostError("E_INPUT_INVALID", "seedance_list に未知の項目があります。", "job だけを指定してください。", { fields: unknownKeys });
  const job = await resolveJob(context, input.job);
  // Read-only: reconcile only in memory.
  const document = clone(await readTasks(job));
  reconcile(document, rt.now());
  const by_status: Partial<Record<SeedanceStatus, number>> = {};
  for (const task of document.tasks) by_status[task.status] = (by_status[task.status] ?? 0) + 1;
  let budget: number | null = null;
  const advisories: Advisory[] = [];
  try { budget = budgetLimit(rt.env); } catch { advisories.push(advisory("seedance-budget-invalid", "SEEDANCE_BUDGET_USD が 0 以上の数ではないため、作成は拒否されます。")); }
  const { real_spent_usd, reserved_usd } = budgetSummary(document.tasks);
  return { result: { tasks: document.tasks, summary: {
    count: document.tasks.length, by_status, dry_run: isDryRun(rt.env), api_key_present: apiKeyPresent(rt.env),
    budget_usd: budget, budget_scope: "job", real_spent_usd, reserved_usd,
    remaining_usd: budget === null ? null : roundUsd(budget - real_spent_usd - reserved_usd),
    mock_count: document.tasks.filter((task) => task.dry_run).length,
  } }, advisories };
}

export function seedanceDoctorCheck(env: Record<string, string | undefined>, project?: Record<string, unknown>): { id: "seedance"; available: boolean; message: string; details: JsonObject } {
  const present = apiKeyPresent(env), dryRun = isDryRun(env);
  let budget: number | null = null;
  try { budget = budgetLimit(env); } catch {}
  const message = !present ? "ARK_API_KEY が未設定のため、Seedance は DRY_RUN のモックでのみ動作します。"
    : dryRun ? "ARK_API_KEY は設定済みですが DRY_RUN（既定）のため、モックで動作します。実 API には SEEDANCE_DRY_RUN=false が必要です。"
    : "ARK_API_KEY が設定され、実 API モードです。作成には project.json の asset_generation.video_generation と予算内であることが必要です。";
  return { id: "seedance", available: present, message, details: { api_key_present: present, dry_run: dryRun, models: MODELS.length, budget_usd: budget, video_generation: project ? videoGenerationOn(project) : null } };
}
export const LEDGER_FILE = TASKS_FILE;
