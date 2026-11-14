import type { Advisory, BuiltJob, CandidatesResult, JsonObject, JsonValue, Project, Request, Sha256, SmmError, Verdict, Warning } from "../core/index.ts";

export type HostContext = {
  root: string; restrictToRoot: boolean; requestDirectory: string;
  allowDirs: readonly string[]; allowEngineHosts: readonly string[];
  readOnly: boolean; enableGeneration: boolean; startedBy: "cli" | "mcp";
};
type Waiting = { job: string; wait_ms?: number };
export type OperationInputs = {
  generate: { request: Request; out: string; format?: "dir" | "zip"; dry_run?: boolean };
  candidates: Parameters<typeof import("../core/index.ts").candidatesFor>[0];
  stats: { kind: "lyrics" | "script"; text: string; request?: Request };
  status: { job: string }; project_get: { job: string; pointer?: string };
  project_patch: { job: string; patch: JsonValue; expect_sha256: Sha256 };
  report: { job: string; path: string }; setup: Waiting;
  validate: Waiting & { final?: boolean; double_render?: boolean };
  qc: Waiting & { stage: "pre" | "post" };
  ghost_check: Waiting & { target?: "preview" | "final"; video?: string; double_render?: boolean; keep?: boolean; no_stills?: boolean; max_stills?: number; tile_threshold?: number; min_tiles?: number };
  render: Waiting & { target: "preview" | "final" | "still"; frame?: number };
  voice: Waiting; sound: Waiting;
  imagegen: Waiting & { name: string; prompt?: string; prompt_file?: string; kind?: string; refs?: string[]; style?: string; size?: string; timeout?: number; force?: boolean; dry_run?: boolean; strict?: boolean };
  run_get: { job: string; run_id: string; wait_ms?: number; log_tail?: number };
  run_list: { job: string }; run_cancel: { job: string; run_id: string };
  doctor: { job?: string }; schema: { name?: string }; studio: { job: string };
  mcp_serve: { root: string; allow_dir?: string[]; read_only?: boolean; enable_generation?: boolean; allow_engine_host?: string[] }; version: Record<string, never>;
};
export type OperationId = keyof OperationInputs;
export type RunKind = "setup" | "validate" | "qc" | "ghost_check" | "render" | "voice" | "sound" | "imagegen";
export type RunStatus = "running" | "completed" | "failed" | "cancelled" | "timed_out" | "lost";
export type CheckResult = { verdict?: Verdict; report: JsonObject | null; artifacts: string[] };
export type RunRecord = {
  schema: "smm.run/1"; id: string; kind: RunKind; args: JsonObject; status: RunStatus;
  exit_code: 0 | 1 | 2 | 3 | 4 | null; pid: number | null; script_pid: number | null;
  started_at: string; heartbeat_at: string; ended_at: string | null;
  progress: { ratio: number | null; text: string }; artifacts: string[]; started_by: "cli" | "mcp";
  result?: CheckResult; error?: SmmError; script_exit_code?: number | null;
};
export type Run = RunRecord & { job: string };
export type Envelope<T> = { schema: "smm.envelope/1"; command: string; job?: string } & (
  { ok: true; result: T; advisories: Advisory[]; warnings: Warning[]; run?: Run } |
  { ok: false; error: SmmError; run?: Run }
);
export type GenerateResult = { job: string | null; archive: string | null; dry_run: boolean; file_count: number; project: Project; project_sha256: string; agent_prompt: string };
export type ProjectGetResult = { project: JsonValue; sha256: string; pointer?: string };
export type ReportResult = { path: string; mime_type: string; truncated: boolean } & ({ text: string } | { data: Uint8Array });
export type RunGetResult = CheckResult & { stdout_tail: string[]; stderr_tail: string[] };
export type DoctorResult = { checks: { id: string; available: boolean; message: string; details?: JsonValue }[] };
export type FileFact = { path: string; exists: boolean; bytes: number | null; modified_at: string | null };
export type CheckFact = { available: boolean; summary?: JsonObject } & (
  { kind: "validate" | "qc-pre" | "qc-post"; verdict?: Verdict; review_mode?: string; has_waiver?: boolean; stale?: boolean } |
  { kind: "ghost-check" | "ghost-check-preview" }
);
export type JobStatus = {
  job: { title: string; mode: "mv" | "explanation"; style_mode: "biim" | "anime" | "motion" | "mixed" | null; schema_version: string; generator: JsonObject | null };
  deps: { installed: boolean }; records: FileFact[]; scenes: number; outputs: FileFact[];
  checks: CheckFact[]; runs: Run[]; hints: { operation: OperationId; input: JsonObject; note: string }[];
};
export type OperationResults = {
  generate: GenerateResult; candidates: CandidatesResult;
  stats: ReturnType<typeof import("../core/index.ts").lyricStats> | ReturnType<typeof import("../core/index.ts").scriptStats>;
  status: JobStatus; project_get: ProjectGetResult; project_patch: { sha256: string }; report: ReportResult;
  setup: CheckResult | null; validate: CheckResult | null; qc: CheckResult | null; ghost_check: CheckResult | null;
  render: CheckResult | null; voice: CheckResult | null; sound: CheckResult | null; imagegen: CheckResult | null;
  run_get: RunGetResult; run_list: { runs: Run[] }; run_cancel: null; doctor: DoctorResult;
  schema: { name: string; schema: JsonObject } | { schemas: { name: string; file: string }[] };
  version: { version: string; commit: string | null; template_version: string }; studio: null; mcp_serve: null;
};
export type OperationDefinition<K extends OperationId = OperationId> = {
  id: K; cli: readonly string[]; mcp: string | null; cliOnlyReason?: string;
  kind: "read" | "write" | "run"; inputSchema: JsonObject; description: string;
  exposedInReadOnly: boolean; enableGeneration: boolean;
  defaultWaitMs: number | null;
  timeoutMs: number | null | ((input: OperationInputs[K]) => number);
  handle: (context: HostContext, input: OperationInputs[K]) => Promise<Envelope<OperationResults[K]>>;
};
export type { BuiltJob };
