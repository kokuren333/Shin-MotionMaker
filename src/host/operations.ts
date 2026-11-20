import { spawn } from "node:child_process";
import path from "node:path";
import { buildJobFiles, candidatesFor, createProject, defaults, lyricStats, PACKAGE_VERSION, scriptStats, TEMPLATE_VERSION, validateRequest } from "../core/index.ts";
import type { JsonObject } from "../core/index.ts";
import type { Envelope, HostContext, OperationDefinition, OperationId, OperationInputs, OperationResults, RunKind } from "./types.ts";
import { hostError, normalizeError } from "./errors.ts";
import { generatedResult, loadTemplates, resolveRequest, writeJob } from "./io.ts";
import { deriveJobStatus } from "./status.ts";
import { getProject, patchProject } from "./project.ts";
import { getReport } from "./report.ts";
import { cancelRun, getRun, listRuns, startRun } from "./runs.ts";
import { defaultWait, runKinds, runTimeout } from "./run-options.ts";
import { resultAdvisories } from "./run-result.ts";
import { doctor, hasRuntimeDependencies } from "./tools.ts";
import { displayPath, jobFile, resolveAllowedPath, resolveJob } from "./paths.ts";
import { acquireJobLock } from "./locks.ts";
import { inputSchemas } from "./input-schemas.ts";
import { schemaRegistry, schemas } from "./output-schemas.ts";
import { schemaIssues } from "./schema-validation.ts";
import { displayHostOutput } from "./display.ts";
import { seedanceCreate, seedanceList, seedanceStatus } from "./seedance/index.ts";

const metadata: Record<OperationId, { cli: string[]; mcp: string | null; description: string; cliOnlyReason?: string }> = {
  generate: { cli: ["generate"], mcp: "job_generate", description: "同じ request と添付からジョブを生成します。" },
  candidates: { cli: ["candidates"], mcp: "direction_candidates", description: "方向性のたたき台であり固定の正解ではない候補を返します。自動適用しません。" },
  stats: { cli: ["stats"], mcp: "text_stats", description: "歌詞または台本の統計を助言として返します。" },
  status: { cli: ["status"], mcp: "job_status", description: "ジョブのファイルから毎回状態を導出します。hints は助言です。" },
  project_get: { cli: ["project get"], mcp: "project_get", description: "project.json の内容と実バイトの SHA-256 を返します。" },
  project_patch: { cli: ["project patch"], mcp: "project_patch", description: "SHA-256 を照合して JSON Merge Patch を適用します。場面の内容は検査しません。" },
  report: { cli: ["report"], mcp: "report_get", description: "許可された制作記録・検査結果・PNG を取得します。" },
  setup: { cli: ["setup"], mcp: "job_setup", description: "ジョブの依存導入を run として開始します。" },
  validate: { cli: ["validate"], mcp: "job_validate", description: "ジョブ内の構造検査を実行します。助言は合否に影響しません。" },
  qc: { cli: ["qc"], mcp: "job_qc", description: "ジョブ内の QC を実行します。MV は対象外です。" },
  ghost_check: { cli: ["ghost-check"], mcp: "job_ghost_check", description: "ジョブ内のゴースト走査を実行します。検出件数は助言です。" },
  render: { cli: ["render"], mcp: "job_render", description: "ジョブ内のレンダースクリプトを実行します。" },
  voice: { cli: ["voice"], mcp: "job_voice", description: "ジョブ内の音声合成を実行します。" },
  sound: { cli: ["sound"], mcp: "job_sound", description: "ジョブ内の音響生成を実行します。" },
  imagegen: { cli: ["imagegen"], mcp: "job_imagegen", description: "画像生成を実行します。未生成は通常は助言です。費用が発生する場合があります。" },
  run_get: { cli: ["runs get", "runs wait", "runs logs"], mcp: "run_get", description: "run の状態とログ末尾を取得します。" },
  run_list: { cli: ["runs list"], mcp: "run_list", description: "ジョブの run 台帳を一覧表示します。" },
  run_cancel: { cli: ["runs cancel"], mcp: "run_cancel", description: "run の子孫を含めて停止します。" },
  doctor: { cli: ["doctor"], mcp: "doctor", description: "実行環境を確認します。自動インストールはしません。" },
  schema: { cli: ["schema"], mcp: "schema_get", description: "JSON Schema の一覧または本文を取得します。" },
  studio: { cli: ["studio"], mcp: null, cliOnlyReason: "人が Remotion Studio を対話操作するためです。", description: "Remotion Studio を前面で起動します。" },
  mcp_serve: { cli: ["mcp serve"], mcp: null, cliOnlyReason: "stdio サーバー自身の起動操作だからです。", description: "MCP サーバーを起動します。" },
  version: { cli: ["version"], mcp: null, cliOnlyReason: "MCP では初期化の serverInfo で版を返すためです。", description: "版を返します。" },
  seedance_create: { cli: ["seedance create"], mcp: "seedance_create", description: "Seedance の動画生成タスクを作り、完了すれば MP4・サイドカー・PNG をジョブ内に保存します。既定は DRY_RUN のモックで外部へ接続しません。実 API は費用が発生します。モデルと見積りは助言です。" },
  seedance_status: { cli: ["seedance status"], mcp: "seedance_status", description: "Seedance タスクの状態を取得します。成功済みで未保存なら保存します。新しい課金は起こしません。" },
  seedance_list: { cli: ["seedance list"], mcp: "seedance_list", description: "ジョブ内の Seedance タスクと費用の集計を返します。" },
};
const writing = new Set<OperationId>(["generate", "project_patch", "run_cancel", "studio", "mcp_serve", "seedance_create", "seedance_status"]);
export const operations: readonly OperationDefinition[] = (Object.keys(metadata) as OperationId[]).map((id) => {
  const run = runKinds.includes(id as RunKind);
  return { id, ...metadata[id], kind: run ? "run" : writing.has(id) ? "write" : "read", inputSchema: inputSchemas[id],
    exposedInReadOnly: !run && !writing.has(id), enableGeneration: id === "imagegen" || id === "seedance_create",
    defaultWaitMs: run ? defaultWait(id as RunKind, { job: "" }) : id === "run_get" ? 0 : null,
    timeoutMs: run ? (input) => runTimeout(id as RunKind, input as OperationInputs[RunKind]) : null,
    handle: (context, input) => dispatch(context, id, input),
  };
});
export function exposedOperations(context: HostContext): readonly OperationDefinition[] {
  return operations.filter((operation) => operation.mcp && (!context.readOnly || operation.exposedInReadOnly) && (!operation.enableGeneration || context.enableGeneration));
}
export async function execute<K extends OperationId>(context: HostContext, id: K, input: OperationInputs[K]): Promise<Envelope<OperationResults[K]>> {
  const definition = operations.find((operation) => operation.id === id);
  const command = definition?.cli[0] ?? String(id);
  try {
    if (!definition) throw hostError("E_USAGE", "操作が見つかりません。");
    if (context.readOnly && !definition.exposedInReadOnly || context.startedBy === "mcp" && (definition.mcp === null || definition.enableGeneration && !context.enableGeneration)) throw hostError("E_DISABLED", "この操作は公開されていません。");
    // Core owns request validation; no generated schema replaces its error classification.
    const value = input as Record<string, unknown>;
    if (id === "generate" || id === "stats" && value?.request !== undefined) {
      const checked = validateRequest(value?.request, { phase: "shape" });
      if (!checked.ok) throw checked.error;
    }
    const issues = schemaIssues(definition.inputSchema, input, schemaRegistry);
    if (issues.length) throw hostError("E_INPUT_INVALID", "操作の入力が不正です。", "details の pointer が指す項目を確認してください。", issues);
    const envelope = await definition.handle(context, input) as Envelope<OperationResults[K]>;
    if (definition.kind === "run" || ["report", "status", "run_get", "run_list", "run_cancel", "doctor"].includes(id))
      return await displayHostOutput(context, envelope, envelope.job ? path.resolve(context.root, envelope.job) : undefined);
    return envelope;
  } catch (error) {
    const run = error && typeof error === "object" && "run" in error ? error.run as import("./types.ts").Run : undefined;
    return displayHostOutput(context, { schema: "smm.envelope/1", command, ok: false, error: normalizeError(error), ...(run ? { run, job: run.job } : {}) }, run ? path.resolve(context.root, run.job) : undefined);
  }
}
async function dispatch<K extends OperationId>(context: HostContext, id: K, input: OperationInputs[K]): Promise<Envelope<OperationResults[K]>> {
  const command = metadata[id].cli[0];
  let result: unknown;
  let job: string | undefined;
  if (runKinds.includes(id as RunKind)) {
    const kind = id as RunKind, value = input as OperationInputs[RunKind];
    const run = await startRun(context, kind, value);
    try {
      const observed = await getRun(context, { job: value.job, run_id: run.id, wait_ms: value.wait_ms ?? defaultWait(kind, value), log_tail: 0 });
      if (!observed.ok || !observed.run) throw hostError("E_INTERNAL", "run の開始結果を取得できませんでした。");
      const current = observed.run;
      if (current.status !== "running" && current.status !== "completed") return { schema: "smm.envelope/1", command, job: current.job, ok: false, run: current, error: current.error ?? normalizeError(hostError("E_INTERNAL", "run が異常終了しました。")) };
      return { schema: "smm.envelope/1", command, job: current.job, ok: true, result: (current.status === "running" ? null : current.result) as OperationResults[K], advisories: resultAdvisories(current), warnings: [], run: current };
    } catch (error) {
      const normalized = normalizeError(error);
      throw Object.assign(hostError(normalized.code, normalized.message, normalized.hint, normalized.details), { run });
    }
  }
  switch (id) {
    case "generate": { const value = input as OperationInputs["generate"]; await resolveAllowedPath(context, value.out, "write"); const resolved = await resolveRequest(value.request, context); const built = await buildJobFiles(resolved.request.form, resolved.assets, await loadTemplates()); result = value.dry_run ? generatedResult(built) : await writeJob(context, built, value.out, value.format ?? "dir"); break; }
    case "candidates": result = candidatesFor(input as OperationInputs["candidates"]); break;
    case "stats": {
      const value = input as OperationInputs["stats"];
      const checked = validateRequest(value.request ?? { form: {} }, { phase: "shape" }); if (!checked.ok) throw checked.error;
      const form = value.request ? checked.value.form : defaults;
      result = value.kind === "lyrics" ? lyricStats(value.text) : scriptStats(value.text, { project: createProject(form, { sources: [] }), speed: Number.isFinite(form.voiceSpeed) && form.voiceSpeed > 0 ? form.voiceSpeed : 1 }); break;
    }
    case "status": result = await deriveJobStatus(context, (input as OperationInputs["status"]).job); break;
    case "project_get": { const value = input as OperationInputs["project_get"]; result = await getProject(context, value.job, value.pointer); break; }
    case "project_patch": result = await patchProject(context, input as OperationInputs["project_patch"]); break;
    case "report": { const value = input as OperationInputs["report"]; result = await getReport(context, value.job, value.path); break; }
    case "run_get": return getRun(context, input as OperationInputs["run_get"]) as Promise<Envelope<OperationResults[K]>>;
    case "run_list": result = { runs: await listRuns(context, (input as OperationInputs["run_list"]).job) }; break;
    case "run_cancel": { const value = input as OperationInputs["run_cancel"]; const run = await cancelRun(context, value.job, value.run_id); return { schema: "smm.envelope/1", command, job: run.job, ok: true, result: null as OperationResults[K], advisories: [], warnings: [], run }; }
    case "doctor": result = await doctor(context, (input as OperationInputs["doctor"]).job); break;
    case "schema": {
      const name = (input as OperationInputs["schema"]).name;
      if (name === undefined) result = { schemas: Object.keys(schemas).map((name) => ({ name: `smm.${name}/1`, file: `${name}.schema.json` })) };
      else { const key = name.replace(/^smm\./, "").replace(/\/1$/, ""); if (!Object.hasOwn(schemas, key)) throw hostError("E_INPUT_INVALID", "指定したスキーマがありません。"); result = { name: `smm.${key}/1`, schema: schemas[key] }; } break;
    }
    case "version": result = { version: PACKAGE_VERSION, commit: null, template_version: TEMPLATE_VERSION }; break;
    case "studio": result = await studio(context, (input as OperationInputs["studio"]).job); break;
    case "mcp_serve": throw hostError("E_DISABLED", "サーバーの起動は CLI の入口で行ってください。");
    case "seedance_create": case "seedance_status": case "seedance_list": {
      const outcome = id === "seedance_create" ? await seedanceCreate(context, input as OperationInputs["seedance_create"])
        : id === "seedance_status" ? await seedanceStatus(context, input as OperationInputs["seedance_status"])
        : await seedanceList(context, input as OperationInputs["seedance_list"]);
      const job = displayPath(context, await resolveJob(context, (input as { job: string }).job));
      return { schema: "smm.envelope/1", command, job, ok: true, result: outcome.result as OperationResults[K], advisories: outcome.advisories, warnings: [] };
    }
    default: throw hostError("E_USAGE", "操作が見つかりません。");
  }
  if (input && typeof input === "object" && "job" in input && typeof input.job === "string") job = displayPath(context, await resolveJob(context, input.job));
  return { schema: "smm.envelope/1", command, ...(job === undefined ? {} : { job }), ok: true, result: result as OperationResults[K], advisories: [], warnings: [] };
}
export async function studio(context: HostContext, relative: string): Promise<null> {
  if (context.readOnly || context.startedBy !== "cli") throw hostError("E_DISABLED", "Studio は CLI の対話操作専用です。");
  const job = await resolveJob(context, relative);
  if (!await hasRuntimeDependencies(job)) throw hostError("E_DEPS_MISSING", "ジョブの依存が未導入です。", "setup を実行してください。");
  const lock = await acquireJobLock(context, relative, "studio");
  try {
    const script = await jobFile(job, "runtime/scripts/run.mjs");
    const cwd = await jobFile(job, "runtime");
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, [script, "studio"], { cwd: process.platform === "win32" ? path.toNamespacedPath(cwd) : cwd, shell: false, windowsHide: true, stdio: ["inherit", 2, 2] });
      child.once("error", reject); child.once("close", (code) => code === 0 ? resolve() : reject(hostError("E_INTERNAL", "Studio が異常終了しました。")));
    });
    return null;
  } finally { await lock.release(); }
}
