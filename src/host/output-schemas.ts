import type { JsonObject } from "../core/index.ts";
import { inputSchemas, objectSchema as obj, requestSchema } from "./input-schemas.ts";

const str: JsonObject = { type: "string" }, num: JsonObject = { type: "number" }, bool: JsonObject = { type: "boolean" };
const nullable = (schema: JsonObject): JsonObject => ({ anyOf: [schema, { type: "null" }] });
const arr = (items: JsonObject): JsonObject => ({ type: "array", items });
const integer: JsonObject = { type: "integer", minimum: 0 };
const raw: JsonObject = { type: "object" };
const hash: JsonObject = { type: "string", pattern: "^[a-f0-9]{64}$" };
const ref = (name: string): JsonObject => ({ $ref: `${name}.schema.json` });
const verdict: JsonObject = { enum: ["pass", "fail", "not_applicable"] };
const advisory = obj({ id: str, source: str, message: str, details: {} }, ["id", "source", "message"]);
const error = obj({ code: { enum: ["E_USAGE", "E_INPUT_INVALID", "E_FORM_INVALID", "E_PATH_DENIED", "E_JOB_NOT_FOUND", "E_NOT_A_JOB", "E_OUTPUT_EXISTS", "E_DEPS_MISSING", "E_TOOL_MISSING", "E_ENGINE_UNREACHABLE", "E_BUSY", "E_CONFLICT", "E_RUN_NOT_FOUND", "E_RUN_LOST", "E_TIMEOUT", "E_DISABLED", "E_INTERNAL"] }, message: str, hint: str, details: {} }, ["code", "message", "hint"]);
const fact = obj({ path: str, exists: bool, bytes: nullable(integer), modified_at: nullable(str) }, ["path", "exists", "bytes", "modified_at"]);
const check = obj({ verdict, report: nullable(raw), artifacts: arr(str) }, ["report", "artifacts"]);
const runProperties: JsonObject = {
  schema: { const: "smm.run/1" }, id: { type: "string", pattern: "^r-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}$" },
  kind: { enum: ["setup", "validate", "qc", "ghost_check", "render", "voice", "sound", "imagegen"] }, args: raw,
  status: { enum: ["running", "completed", "failed", "cancelled", "timed_out", "lost"] }, exit_code: { enum: [0, 1, 2, 3, 4, null] },
  pid: nullable({ type: "integer", minimum: 1 }), script_pid: nullable({ type: "integer", minimum: 1 }), started_at: str, heartbeat_at: str, ended_at: nullable(str),
  progress: obj({ ratio: nullable({ type: "number", minimum: 0, maximum: 1 }), text: str }, ["ratio", "text"]), artifacts: arr(str),
  started_by: { enum: ["cli", "mcp"] }, result: check, error, script_exit_code: nullable({ type: "integer" }),
};
const runRequired = Object.keys(runProperties).filter((key) => !["result", "error", "script_exit_code"].includes(key));
const runRecord = obj(runProperties, runRequired);
const displayedRunDefinition = obj({ ...runProperties, job: str }, [...runRequired, "job"]);
const displayedRun: JsonObject = { $ref: "run.schema.json#/$defs/display" };
const generator = obj({ name: { const: "shin-motionmaker" }, version: str, template_version: str }, ["name", "version", "template_version"]);
const projectProperties = { schema_version: { enum: ["0.4", "0.5"] }, title: str, mode: { enum: ["mv", "explanation"] }, generator, scenes: arr({}) };
const project: JsonObject = { type: "object", properties: projectProperties, required: ["schema_version", "title", "mode", "scenes"], additionalProperties: true,
  oneOf: [ { properties: { schema_version: { const: "0.4" } } }, { properties: { schema_version: { const: "0.5" } }, required: ["generator"] } ] };
const lyrics = obj({ lines: integer, sections: arr(str), longest: integer, longLines: integer, blocks: integer }, ["lines", "sections", "longest", "longLines", "blocks"]);
const scriptFields = { characters: integer, estimatedSeconds: num, headings: integer, blocks: integer, longestSentence: integer, overCapacitySentences: integer, numericLines: integer, captionBoxes: arr(raw) };
const outputs: Record<string, JsonObject> = {
  request: requestSchema, project,
  check,
  run: { oneOf: [runRecord, displayedRunDefinition], $defs: { record: runRecord, display: displayedRunDefinition } },
  generate: obj({ job: nullable(str), archive: nullable(str), dry_run: bool, file_count: integer, project: ref("project"), project_sha256: hash, agent_prompt: str }, ["job", "archive", "dry_run", "file_count", "project", "project_sha256", "agent_prompt"]),
  candidates: obj({ message: str, seed: { type: "integer" }, notes: arr(str), candidates: arr(raw), axes: arr(raw), formatted: arr(str) }, ["message", "seed", "notes", "candidates", "axes", "formatted"]),
  "text-stats": { oneOf: [lyrics, obj(scriptFields, Object.keys(scriptFields))] },
  "project-result": { oneOf: [obj({ project: {}, sha256: hash, pointer: str }, ["project", "sha256"]), obj({ sha256: hash }, ["sha256"])] },
  report: { oneOf: [obj({ path: str, mime_type: str, truncated: bool, text: str }, ["path", "mime_type", "truncated", "text"]),
    obj({ path: str, mime_type: { const: "image/png" }, truncated: bool, data: str, encoding: { const: "base64" } }, ["path", "mime_type", "truncated", "data", "encoding"]),
    obj({ path: str, mime_type: { const: "image/png" }, truncated: { const: false }, data: { type: "null" }, bytes: { type: "integer", minimum: 0, maximum: 6 * 1024 * 1024 }, sha256: hash, delivered_as: { const: "image" } },
      ["path", "mime_type", "truncated", "data", "bytes", "sha256", "delivered_as"])] },
  validate: obj({ schema: { const: "smm.validate/1" }, final: bool, double_render: bool, verdict: { enum: ["pass", "fail"] },
    checks: arr(obj({ name: str, status: { enum: ["ok", "error", "skip"] }, message: str }, ["name", "status", "message"])), advisories: arr(obj({ id: str, source: { const: "validate" }, message: str }, ["id", "source", "message"])) }, ["schema", "final", "double_render", "verdict", "checks", "advisories"]),
  qc: { type: "object", properties: { schema_version: str, kind: { const: "biim-explainer-qc" }, stage: { enum: ["pre", "post"] }, mode: { const: "explanation" }, style_mode: str, verdict: { enum: ["pass", "fail"] }, gates: arr(raw), advisories: arr(raw), review_mode: str, waivers: arr(raw), inputs: { type: "object", additionalProperties: nullable(hash) }, rule_versions: raw, generated_at: str }, required: ["kind", "stage", "verdict", "gates", "advisories", "inputs"] },
  "ghost-check": { type: "object", properties: { kind: { const: "biim-ghost-check" }, video: str, frames: integer, fps: num, duration: str, counts: raw, skipped: str, stills: arr(raw) }, required: ["kind"], anyOf: [{ required: ["video", "frames", "counts"] }, { required: ["skipped"] }] },
  imagegen: obj({ assets: arr({ type: "object", properties: { name: str, status: { enum: ["ok", "skipped"] }, path: nullable(str), reason: str, created_at: str }, required: ["status"] }) }, ["assets"]),
  audio: { type: "object", properties: { clips: arr(raw), method: str }, required: ["clips"] },
  doctor: obj({ checks: arr(obj({ id: str, available: bool, message: str, details: {} }, ["id", "available", "message"])) }, ["checks"]),
  "schema-list": { oneOf: [obj({ schemas: arr(obj({ name: str, file: str }, ["name", "file"])) }, ["schemas"]), obj({ name: str, schema: raw }, ["name", "schema"])] },
  "operation-inputs": { $defs: inputSchemas },
  version: obj({ version: str, commit: nullable(str), template_version: str }, ["version", "commit", "template_version"]),
};
const checkFact = { type: "object", properties: { kind: { enum: ["validate", "qc-pre", "qc-post", "ghost-check", "ghost-check-preview"] }, available: bool, summary: raw, verdict, review_mode: str, has_waiver: bool, stale: bool }, required: ["kind", "available"], additionalProperties: false };
outputs["job-status"] = obj({ job: obj({ title: str, mode: { enum: ["mv", "explanation"] }, style_mode: { enum: ["biim", "anime", "motion", "mixed", null] }, schema_version: str, generator: nullable(raw) }, ["title", "mode", "style_mode", "schema_version", "generator"]),
  deps: obj({ installed: bool }, ["installed"]), records: arr(fact), scenes: integer, outputs: arr(fact), checks: arr(checkFact), runs: arr(displayedRun),
  hints: arr(obj({ operation: { enum: Object.keys(inputSchemas) }, input: raw, note: str }, ["operation", "input", "note"])) }, ["job", "deps", "records", "scenes", "outputs", "checks", "runs", "hints"]);
const results: Record<string, JsonObject> = {
  generate: ref("generate"), candidates: ref("candidates"), stats: ref("text-stats"), status: ref("job-status"),
  "project get": ref("project-result"), "project patch": ref("project-result"), report: ref("report"),
  doctor: ref("doctor"), schema: ref("schema-list"),
  "runs get": obj({ ...check.properties as JsonObject, stdout_tail: arr(str), stderr_tail: arr(str) }, ["report", "artifacts", "stdout_tail", "stderr_tail"]),
  "runs list": obj({ runs: arr(displayedRun) }, ["runs"]), "runs cancel": { type: "null" },
  version: obj({ version: str, commit: nullable(str), template_version: str }, ["version", "commit", "template_version"]),
  studio: { type: "null" }, "mcp serve": { type: "null" },
};
for (const kind of ["setup", "validate", "qc", "ghost-check", "render", "voice", "sound", "imagegen"]) results[kind] = nullable(ref("check"));
results["runs wait"] = results["runs logs"] = results["runs get"];
outputs.envelope = { type: "object", oneOf: [
  ...Object.entries(results).map(([command, result]) => obj({ schema: { const: "smm.envelope/1" }, command: { const: command }, job: str, ok: { const: true }, result,
    advisories: arr(advisory), warnings: arr(obj({ code: str, message: str, hint: str }, ["code", "message"])), run: displayedRun }, ["schema", "command", "ok", "result", "advisories", "warnings"])),
  obj({ schema: { const: "smm.envelope/1" }, command: str, job: str, ok: { const: false }, error, run: displayedRun }, ["schema", "command", "ok", "error"]),
], $defs: { results, error, advisory } };
export const schemas: Record<string, JsonObject> = Object.fromEntries(Object.entries(outputs).map(([name, schema]) => [name, { $schema: "https://json-schema.org/draft/2020-12/schema", $id: `smm.${name}/1`, ...schema }]));
export const schemaRegistry: Record<string, JsonObject> = Object.fromEntries(Object.entries(schemas).flatMap(([name, schema]) => [[`${name}.schema.json`, schema], [`smm.${name}/1`, schema]]));
