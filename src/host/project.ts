import fs from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { randomBytes } from "node:crypto";
import type { JsonValue } from "../core/index.ts";
import type { HostContext, OperationInputs, ProjectGetResult } from "./types.ts";
import { hostError } from "./errors.ts";
import { jobFile, readProjectFile, resolveJob, withVerifiedParent } from "./paths.ts";
import { replaceFile, sha256 } from "./io.ts";
import { acquireJobLock } from "./locks.ts";

export async function getProject(context: HostContext, relative: string, pointer?: string): Promise<ProjectGetResult> {
  const job = await resolveJob(context, relative);
  const { bytes, project } = await readProjectFile(job);
  let value: unknown = project;
  if (pointer !== undefined && pointer !== "") {
    if (!pointer.startsWith("/") || /~(?![01])/u.test(pointer)) throw hostError("E_INPUT_INVALID", "JSON Pointer が不正です。");
    for (const token of pointer.slice(1).split("/").map((key) => key.replaceAll("~1", "/").replaceAll("~0", "~"))) {
      if (!value || typeof value !== "object" || !Object.hasOwn(value, token) || Array.isArray(value) && !/^(0|[1-9][0-9]*)$/.test(token)) throw hostError("E_INPUT_INVALID", "JSON Pointer の参照先がありません。");
      value = (value as Record<string, unknown>)[token];
    }
  }
  return { project: value as JsonValue, sha256: sha256(bytes), ...(pointer === undefined ? {} : { pointer }) };
}
function mergePatch(target: JsonValue, patch: JsonValue): JsonValue {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return patch;
  const output: Record<string, JsonValue> = Object.assign(Object.create(null), target && typeof target === "object" && !Array.isArray(target) ? target : {});
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete output[key];
    else output[key] = mergePatch(Object.hasOwn(output, key) ? output[key] : null, value);
  }
  return output;
}
export async function patchProject(context: HostContext, input: OperationInputs["project_patch"]): Promise<{ sha256: string }> {
  if (context.readOnly) throw hostError("E_DISABLED", "読み取り専用では設定を変更できません。");
  const job = await resolveJob(context, input.job);
  const lock = await acquireJobLock(context, input.job, "project_patch");
  let temporary: string | undefined;
  try {
    const { bytes, project } = await readProjectFile(job);
    if (sha256(bytes) !== input.expect_sha256) throw hostError("E_CONFLICT", "project.json が変更されています。", "project_get で読み直してから、新しい SHA-256 を指定してください。");
    const result = mergePatch(project as JsonValue, input.patch);
    if (!result || typeof result !== "object" || Array.isArray(result)) throw hostError("E_INPUT_INVALID", "patch の結果はオブジェクトにしてください。");
    for (const key of ["schema_version", "mode", "generator"]) if (!isDeepStrictEqual(project[key], result[key])) throw hostError("E_INPUT_INVALID", "schema_version・mode・generator は変更できません。");
    const body = JSON.stringify(result, null, 2) + "\n";
    temporary = await jobFile(job, `.smm/project-${randomBytes(8).toString("hex")}.tmp`);
    await withVerifiedParent(temporary, (file) => fs.writeFile(file, body, { flag: "wx" }));
    await withVerifiedParent(await jobFile(job, "project.json"), (file) => replaceFile(temporary!, file));
    return { sha256: sha256(body) };
  } finally { if (temporary) await fs.rm(temporary, { force: true }); await lock.release(); }
}
