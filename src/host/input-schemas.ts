import { defaults, formChoices, type JsonObject, type JsonValue } from "../core/index.ts";
import type { OperationId } from "./types.ts";
import { defaultWait } from "./run-options.ts";
import { seedanceInputSchemas } from "./seedance/schemas.ts";

const string: JsonObject = { type: "string" };
const boolean: JsonObject = { type: "boolean" };
const integer = (minimum = 0, maximum = Number.MAX_SAFE_INTEGER): JsonObject => ({ type: "integer", minimum, maximum });
const choice = (...values: string[]): JsonObject => ({ type: "string", enum: values });
export const objectSchema = (properties: JsonObject, required: string[] = []): JsonObject => ({ type: "object", properties, required, additionalProperties: false });
function fields(values: object, choices: object = formChoices): JsonObject {
  return objectSchema(Object.fromEntries(Object.entries(values).map(([key, value]) => {
    const field: JsonObject = value === null ? { type: ["number", "null"] }
      : typeof value === "object" ? fields(value, (choices as Record<string, object>)[key]) : { type: typeof value };
    if (Array.isArray((choices as Record<string, unknown>)[key]))
      field.enum = [...(choices as Record<string, readonly JsonValue[]>)[key]];
    return [key, field];
  })));
}
// Inactive mode/character fields retain their types without restricting unused choices.
const formSchema = fields(defaults);
const formProperties = formSchema.properties as JsonObject;
for (const key of ["styleMode", "characterPosition"]) delete (formProperties[key] as JsonObject).enum;
delete (((formProperties.secondCharacter as JsonObject).properties as JsonObject).position as JsonObject).enum;
const mv = { properties: { videoMode: { const: "mv" } }, required: ["videoMode"] };
formSchema.allOf = [
  { anyOf: [mv, { properties: { styleMode: { enum: [...formChoices.styleMode] } } }] },
  { anyOf: [mv, { properties: { characterPosition: { enum: [...formChoices.characterPosition] } } }] },
  { anyOf: [mv, { properties: { characterMode: { const: "solo" } } },
    { properties: { secondCharacter: { properties: { position: { enum: [...formChoices.secondCharacter.position] } } } } }] },
];
// Request shape follows core defaults; complete validation remains validateRequest's job.
export const requestSchema = objectSchema({ form: formSchema, assets: objectSchema({ sources: { type: "array", items: { type: "string", minLength: 1 } },
  ...Object.fromEntries(["character", "secondCharacter", "bgm", "music"].map((key) => [key, { type: ["string", "null"], minLength: 1 }])) }) }, ["form"]);
const request: JsonObject = requestSchema;
const wait_ms = { ...integer(0, 50000), default: 0 };
const waiting = { job: string, wait_ms };
const shortWait = (kind: "validate" | "qc" | "sound") => ({ ...waiting, wait_ms: { ...wait_ms, default: defaultWait(kind, { job: "" }) } });
const strings: JsonObject = { type: "array", items: string };
export const inputSchemas: Record<OperationId, JsonObject> = {
  generate: objectSchema({ request, out: string, format: { ...choice("dir", "zip"), default: "dir" }, dry_run: { ...boolean, default: false } }, ["request", "out"]),
  candidates: objectSchema({ mode: choice("mv", "explanation"), seed: integer(Number.MIN_SAFE_INTEGER), count: { ...integer(1, 20), default: 3 }, characters: { ...choice("solo", "duo", "none"), default: "solo" }, orientation: { ...choice("landscape", "portrait"), default: "landscape" } }, ["mode"]),
  stats: objectSchema({ kind: choice("lyrics", "script"), text: string, request }, ["kind", "text"]),
  status: objectSchema({ job: string }, ["job"]), project_get: objectSchema({ job: string, pointer: string }, ["job"]),
  project_patch: objectSchema({ job: string, patch: {}, expect_sha256: { type: "string", pattern: "^[a-f0-9]{64}$" } }, ["job", "patch", "expect_sha256"]),
  report: objectSchema({ job: string, path: string }, ["job", "path"]),
  setup: objectSchema(waiting, ["job"]),
  validate: { ...objectSchema({ ...shortWait("validate"), final: { ...boolean, default: false }, double_render: { ...boolean, default: false } }, ["job"]),
    allOf: [{ anyOf: [{ properties: { final: { const: true }, wait_ms: { default: 0 } }, required: ["final"] },
      { properties: { final: { const: false }, wait_ms: { default: 45000 } } }] }] },
  qc: objectSchema({ ...shortWait("qc"), stage: choice("pre", "post") }, ["job", "stage"]),
  ghost_check: objectSchema({ ...waiting, target: { ...choice("preview", "final"), default: "final" }, video: string, double_render: boolean, keep: boolean, no_stills: boolean, max_stills: integer(), tile_threshold: { type: "number", minimum: 0 }, min_tiles: integer(1) }, ["job"]),
  render: objectSchema({ ...waiting, target: choice("preview", "final", "still"), frame: integer() }, ["job", "target"]),
  voice: objectSchema(waiting, ["job"]), sound: objectSchema(shortWait("sound"), ["job"]),
  imagegen: objectSchema({ ...waiting, name: string, prompt: string, prompt_file: string, kind: choice("background", "transparent", "character-sheet", "motion", "texture", "prop"), refs: strings, style: string, size: string, timeout: { type: "number", exclusiveMinimum: 0, maximum: 1800, default: 900 }, force: boolean, dry_run: boolean, strict: boolean }, ["job", "name"]),
  run_get: objectSchema({ job: string, run_id: string, wait_ms: { ...wait_ms, default: 0 }, log_tail: { ...integer(0, 2000), default: 100 } }, ["job", "run_id"]),
  run_list: objectSchema({ job: string }, ["job"]), run_cancel: objectSchema({ job: string, run_id: string }, ["job", "run_id"]),
  doctor: objectSchema({ job: string }), schema: objectSchema({ name: string }), studio: objectSchema({ job: string }, ["job"]),
  mcp_serve: objectSchema({ root: string, allow_dir: strings, read_only: boolean, enable_generation: boolean, allow_engine_host: strings }, ["root"]), version: objectSchema({}),
  ...seedanceInputSchemas,
};
