import fs from "node:fs/promises";
import path from "node:path";
import type { HostContext } from "./types.ts";
import { hostError, isMissing } from "./errors.ts";

export const slash = (value: string) => value.split(path.sep).join("/");
export function inside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}
export function assertRelative(value: string, rootAllowed = false): void {
  if (typeof value !== "string" || !value || value.includes("\\") || value.includes(":") || value.includes("\0") || value.startsWith("/") ||
      (value !== "." || !rootAllowed) && value.split("/").some((part) => !part || part === "." || part === ".." || /[. ]$/.test(part) || /[<>"|?*\x00-\x1f]/.test(part) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part)))
    throw hostError("E_PATH_DENIED", "安全な相対パスではありません。", "区切りを / にし、..・ドライブ名・末尾のドットや空白を取り除いてください。");
}
export async function physicalPath(target: string): Promise<string> {
  try { return await fs.realpath(target); }
  catch (error) {
    if (!isMissing(error)) throw error;
    // A dangling link must not be treated as an ordinary missing component.
    try { if ((await fs.lstat(target)).isSymbolicLink()) throw hostError("E_PATH_DENIED", "リンクの実体を確認できません。"); }
    catch (statError) { if (!isMissing(statError)) throw statError; }
    const parent = path.dirname(target);
    if (parent === target) throw error;
    return path.join(await physicalPath(parent), path.basename(target));
  }
}
export function displayPath(context: HostContext, target: string): string {
  const relative = slash(path.relative(context.root, target)) || ".";
  if (context.restrictToRoot) assertRelative(relative, true);
  return relative;
}
export async function resolveAllowedPath(context: HostContext, relative: string, purpose: "read" | "write" | "attachment"): Promise<string> {
  if (typeof relative !== "string" || !relative || relative.includes("\0")) throw hostError("E_PATH_DENIED", "パスが不正です。");
  const absoluteAttachment = purpose === "attachment" && path.isAbsolute(relative);
  if (context.restrictToRoot && !absoluteAttachment) assertRelative(relative, true);
  const base = purpose === "attachment" ? context.requestDirectory : context.root;
  const target = path.resolve(base, relative);
  const physical = await physicalPath(target);
  if (context.restrictToRoot) {
    const root = await fs.realpath(context.root);
    let allowed = inside(root, physical);
    if (purpose === "attachment") for (const directory of context.allowDirs)
      if (inside(await fs.realpath(directory), physical)) allowed = true;
    if (!allowed || absoluteAttachment && !await Promise.all(context.allowDirs.map(async (directory) => inside(await fs.realpath(directory), physical))).then((checks) => checks.some(Boolean)))
      throw hostError("E_PATH_DENIED", "許可されたフォルダの外にはアクセスできません。", "root 内へ移すか、添付の読取元を allow-dir で明示してください。");
  }
  return target;
}
export async function jobFile(job: string, relative: string): Promise<string> {
  assertRelative(relative);
  const target = path.join(job, ...relative.split("/"));
  if (!inside(await fs.realpath(job), await physicalPath(target))) throw hostError("E_PATH_DENIED", "ジョブの外へ向くリンクは使用できません。");
  return target;
}
export async function resolveJob(context: HostContext, relative: string): Promise<string> {
  const job = await resolveAllowedPath(context, relative, "read");
  try { if (!(await fs.stat(job)).isDirectory()) throw hostError("E_NOT_A_JOB", "ジョブフォルダではありません。"); }
  catch (error) { if (isMissing(error)) throw hostError("E_JOB_NOT_FOUND", "ジョブが見つかりません。"); throw error; }
  await readProjectFile(job);
  return job;
}
export async function readProjectFile(job: string): Promise<{ bytes: Buffer; project: Record<string, unknown> }> {
  let bytes: Buffer;
  try { bytes = await fs.readFile(await jobFile(job, "project.json")); }
  catch (error) { if (isMissing(error)) throw hostError("E_NOT_A_JOB", "project.json がありません。"); throw error; }
  try {
    const project: unknown = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
    if (!project || typeof project !== "object" || Array.isArray(project)) throw Error();
    return { bytes, project: project as Record<string, unknown> };
  } catch { throw hostError("E_NOT_A_JOB", "project.json を読めません。", "JSON の構文を確認してください。", { reason: "invalid_json" }); }
}
