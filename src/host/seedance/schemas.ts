import type { JsonObject } from "../../core/index.ts";
import { MODELS } from "./models.ts";
import { DEFAULT_CREATE_WAIT_MS, MAX_WAIT_MS, MODES, RATIOS, RESOLUTIONS, SHOT_ID_PATTERN } from "./request.ts";

// Same shape as objectSchema in ../input-schemas.ts; defined locally so that module can import this one without a cycle.
const objectSchema = (properties: JsonObject, required: string[] = []): JsonObject => ({ type: "object", properties, required, additionalProperties: false });
const string: JsonObject = { type: "string", minLength: 1 };
const boolean: JsonObject = { type: "boolean" };
const strings: JsonObject = { type: "array", items: string };
const integer = (minimum: number, maximum?: number): JsonObject => ({ type: "integer", minimum, ...(maximum === undefined ? {} : { maximum }) });
const choice = (...values: string[]): JsonObject => ({ type: "string", enum: values });

export const seedanceInputSchemas: { seedance_create: JsonObject; seedance_status: JsonObject; seedance_list: JsonObject } = {
  seedance_create: objectSchema({
    job: string, shot_id: { type: "string", pattern: SHOT_ID_PATTERN.source }, prompt: string,
    model: { type: "string", minLength: 1, default: "seedance-2-0-mini", examples: MODELS.map((model) => model.alias) },
    mode: { ...choice(...MODES), default: "text" }, first_frame: string, last_frame: string,
    reference_images: strings, reference_videos: strings, reference_audios: strings,
    resolution: { ...choice(...RESOLUTIONS), default: "720p" }, ratio: { ...choice(...RATIOS), default: "16:9" },
    duration: { ...integer(1, 15), default: 5 }, seed: integer(-1, 4294967295),
    generate_audio: { ...boolean, default: false }, watermark: { ...boolean, default: false },
    wait_ms: { ...integer(0, MAX_WAIT_MS), default: DEFAULT_CREATE_WAIT_MS }, force: { ...boolean, default: false },
  }, ["job", "shot_id", "prompt"]),
  // Exactly one of task_id and shot_id is enforced by the operation itself.
  seedance_status: objectSchema({ job: string, task_id: string, shot_id: string, wait_ms: { ...integer(0, MAX_WAIT_MS), default: 0 } }, ["job"]),
  seedance_list: objectSchema({ job: string }, ["job"]),
};

const str: JsonObject = { type: "string" }, num: JsonObject = { type: "number" }, bool: JsonObject = { type: "boolean" };
const nullable = (schema: JsonObject): JsonObject => ({ anyOf: [schema, { type: "null" }] });
const arr = (items: JsonObject): JsonObject => ({ type: "array", items });
const hash: JsonObject = { type: "string", pattern: "^[a-f0-9]{64}$" };
const count: JsonObject = { type: "integer", minimum: 0 };
const statuses = ["creating", "queued", "running", "succeeded", "failed", "cancelled", "expired", "unknown", "error"];
const roles = ["first_frame", "last_frame", "reference_image", "reference_video", "reference_audio"];
const error = objectSchema({ code: str, message: str, hint: str, details: {} }, ["code", "message", "hint"]);
const params = objectSchema({ resolution: { enum: [...RESOLUTIONS] }, ratio: { enum: [...RATIOS] }, duration: integer(1, 15), seed: integer(-1, 4294967295), generate_audio: bool, watermark: bool },
  ["resolution", "ratio", "duration", "generate_audio", "watermark"]);
const input = objectSchema({ role: { enum: roles }, path: str, url: str, url_sha256: hash, sha256: hash }, ["role"]);
const video = objectSchema({ bytes: count, duration_seconds: num, width: count, height: count }, ["bytes", "duration_seconds", "width", "height"]);
const taskProperties: JsonObject = {
  local_id: { type: "string", pattern: "^s-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}$" }, shot_id: str, task_id: nullable(str), dry_run: bool,
  model: objectSchema({ alias: str, id: str }, ["alias", "id"]), mode: { enum: [...MODES] }, prompt: str, inputs: arr(input), params,
  cache_key: hash, cached: bool, status: { enum: statuses }, estimate_usd: num, estimate_tokens: count, estimate_basis: str,
  usage_tokens: nullable(count), actual_usd: nullable(num), output: nullable(str), output_sha256: nullable(hash),
  sidecar: nullable(str), thumbnail: nullable(str), video: nullable(video), error: nullable(error), owner_pid: nullable({ type: "integer", minimum: 1 }),
  created_at: str, updated_at: str,
};
export const seedanceTaskSchema = objectSchema(taskProperties, Object.keys(taskProperties));
const summary = objectSchema({
  count, by_status: { type: "object", properties: Object.fromEntries(statuses.map((status) => [status, count])), additionalProperties: false },
  dry_run: bool, api_key_present: bool, budget_usd: nullable(num), budget_scope: { const: "job" },
  real_spent_usd: num, reserved_usd: num, remaining_usd: nullable(num), mock_count: count,
}, ["count", "by_status", "dry_run", "api_key_present", "budget_usd", "budget_scope", "real_spent_usd", "reserved_usd", "remaining_usd", "mock_count"]);
export const seedanceOutputSchemas: { "seedance-task": JsonObject; "seedance-list": JsonObject } = {
  "seedance-task": objectSchema({ task: seedanceTaskSchema, cached: bool }, ["task", "cached"]),
  "seedance-list": objectSchema({ tasks: arr(seedanceTaskSchema), summary }, ["tasks", "summary"]),
};
