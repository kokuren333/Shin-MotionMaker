import type { MotionForm, CharacterForm } from "./form.ts";
import type { createProject } from "./project.ts";

export interface Attachment {
  name: string;
  data: Blob | Uint8Array;
  size: number;
  type: string;
}
export interface JobAssets {
  sources: Attachment[];
  character?: Attachment;
  secondCharacter?: Attachment;
  bgm?: Attachment;
  music?: Attachment;
}
export type TemplateFiles = Record<string, string | Uint8Array>;

export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };
export type Verdict = "pass" | "fail" | "not_applicable";
export type Sha256 = string;
export type JobPath = string;
export type DisplayPath = string;
export type VideoMode = "explanation" | "mv";
export type Advisory = { id: string; source: string; message: string; details?: JsonValue };
export type Warning = { code: string; message: string; hint?: string };
export type ErrorCode = "E_USAGE" | "E_INPUT_INVALID" | "E_FORM_INVALID" | "E_PATH_DENIED"
  | "E_JOB_NOT_FOUND" | "E_NOT_A_JOB" | "E_OUTPUT_EXISTS" | "E_DEPS_MISSING"
  | "E_TOOL_MISSING" | "E_ENGINE_UNREACHABLE" | "E_BUSY" | "E_CONFLICT"
  | "E_RUN_NOT_FOUND" | "E_RUN_LOST" | "E_TIMEOUT" | "E_DISABLED" | "E_INTERNAL";
export type SmmError = { code: ErrorCode; message: string; hint: string; details?: JsonValue };
export type Validation<T> = { ok: true; value: T } | { ok: false; error: SmmError };
export type AssetPaths = {
  sources?: string[];
  character?: string | null; secondCharacter?: string | null;
  bgm?: string | null; music?: string | null;
};
export type Request = {
  form: Partial<Omit<MotionForm, "secondCharacter">> & { secondCharacter?: Partial<CharacterForm> };
  assets?: AssetPaths;
};
export type NormalizedRequest = { form: MotionForm; assets: AssetPaths };
export type RequestCheck = { phase: "shape" } | { phase: "complete"; assets: JobAssets };
export type Project = ReturnType<typeof createProject>;
export type LegacyProject = Omit<Project, "schema_version" | "generator"> & { schema_version: "0.4" };
export type JobFiles = Record<JobPath, Uint8Array>;
export type BuiltJob = {
  rootName: string; filename: string; files: JobFiles; project: Project; agentPrompt: string;
};
export type ValidateReport = {
  schema: "smm.validate/1";
  final: boolean; double_render: boolean; verdict: "pass" | "fail";
  checks: { name: string; status: "ok" | "error" | "skip"; message: string }[];
  advisories: { id: string; source: "validate"; message: string }[];
};
export type Inspection = {
  kind: "validate" | "qc" | "ghost-check" | "imagegen";
  raw: JsonObject; verdict?: Verdict; advisories: Advisory[];
};
