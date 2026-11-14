import fs from "node:fs/promises";
import path from "node:path";
import type { FileHandle } from "node:fs/promises";
import type { HostContext } from "./types.ts";
import { hostError, isMissing } from "./errors.ts";

export const slash = (value: string) => value.split(path.sep).join("/");
export function inside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}
export function assertRelative(value: string, rootAllowed = false): void {
  if (typeof value !== "string" || !value || value.includes("\\") || (process.platform === "win32" ? value.includes(":") : /^[a-z]:/i.test(value)) || value.includes("\0") || value.startsWith("/") ||
      (value !== "." || !rootAllowed) && value.split("/").some((part) => !part || part === "." || part === ".." || process.platform === "win32" && (/[. ]$/.test(part) || /[<>"|?*\x00-\x1f]/.test(part) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part))))
    throw hostError("E_PATH_DENIED", "安全な相対パスではありません。", "区切りを / にし、..・ドライブ名・使用できない文字を取り除いてください。");
}
function pathError(error: unknown): never {
  if (isMissing(error) || error && typeof error === "object" && "code" in error && error.code === "E_PATH_DENIED") throw error;
  throw hostError("E_PATH_DENIED", "パスの安全性を確認できません。", "アクセス権とリンクの実体を確認してください。");
}
export async function physicalPath(target: string): Promise<string> {
  try { return await fs.realpath(target); }
  catch (error) {
    if (!isMissing(error)) return pathError(error);
    try { if ((await fs.lstat(target)).isSymbolicLink()) throw hostError("E_PATH_DENIED", "リンクの実体を確認できません。"); }
    catch (statError) { if (!isMissing(statError)) return pathError(statError); }
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
function namespace(value: string): string {
  const normalized = value.replaceAll("\\", "/");
  return normalized.startsWith("//?/") ? "extended" : normalized.startsWith("//./") ? "device" : normalized.startsWith("//") ? "unc" : "local";
}
const rootAnchors = new Map<string, { real: string; dev: number; ino: number }>();
async function rootAnchor(root: string): Promise<string> {
  const real = await fs.realpath(root), stat = await fs.stat(real);
  const previous = rootAnchors.get(root);
  if (previous && (previous.real !== real || previous.dev !== stat.dev || previous.ino !== stat.ino))
    throw hostError("E_PATH_DENIED", "root の実体が変更されています。", "root の状態を確認して入口を再起動してください。");
  rootAnchors.set(root, { real, dev: stat.dev, ino: stat.ino });
  return real;
}
// Also called by the MCP startup path; invalid configuration is never an absent attachment.
export async function validateRootDirectory(root: string): Promise<void> {
  try {
    if (!(await fs.stat(await fs.realpath(root))).isDirectory()) throw Error();
  } catch { throw hostError("E_PATH_DENIED", "root のフォルダを確認できません。", "--root に存在するディレクトリを指定してください。"); }
}
export async function validateAllowDirectories(context: HostContext): Promise<string[]> {
  const result: string[] = [];
  for (const directory of context.allowDirs) {
    try {
      if (!path.isAbsolute(directory) || !(await fs.stat(directory)).isDirectory()) throw Error();
      result.push(await fs.realpath(directory));
    } catch { throw hostError("E_PATH_DENIED", "allow-dir のフォルダを確認できません。", "存在する絶対パスのフォルダを allow-dir に指定してください。"); }
  }
  return result;
}
export async function resolveAllowedPath(context: HostContext, relative: string, purpose: "read" | "write" | "attachment"): Promise<string> {
  if (typeof relative !== "string" || !relative || relative.includes("\0")) throw hostError("E_PATH_DENIED", "パスが不正です。");
  const absoluteAttachment = purpose === "attachment" && (path.isAbsolute(relative) || namespace(relative) !== "local");
  if (context.restrictToRoot && !absoluteAttachment) assertRelative(relative, true);
  const base = purpose === "attachment" ? context.requestDirectory : context.root;
  const target = path.resolve(base, relative);
  // This check must precede every filesystem operation, including allow-dir validation.
  if (context.restrictToRoot && absoluteAttachment && !context.allowDirs.some((directory) =>
    path.isAbsolute(directory) && namespace(directory) === namespace(relative) && inside(path.resolve(directory), target)))
    throw hostError("E_PATH_DENIED", "添付の絶対パスが許可されていません。", "添付の読取元を allow-dir で明示してください。");
  try {
    const allowedDirs = context.restrictToRoot ? await validateAllowDirectories(context) : [];
    const physical = await physicalPath(target);
    if (context.restrictToRoot) {
      const root = await rootAnchor(context.root);
      if (!(absoluteAttachment ? allowedDirs.some((directory) => inside(directory, physical)) :
        inside(root, physical) || purpose === "attachment" && allowedDirs.some((directory) => inside(directory, physical))))
        throw hostError("E_PATH_DENIED", "許可されたフォルダの外にはアクセスできません。", "root 内へ移すか、添付の読取元を allow-dir で明示してください。");
    }
    return target;
  } catch (error) { return pathError(error); }
}
const jobRoots = new Map<string, string>();
export async function anchorJob(context: HostContext, job: string): Promise<void> {
  if (context.restrictToRoot) {
    if (!inside(await rootAnchor(context.root), await fs.realpath(job))) throw hostError("E_PATH_DENIED", "ジョブの実体が root の外です。");
    jobRoots.set(job, context.root);
  }
}
export async function jobFile(job: string, relative: string): Promise<string> {
  assertRelative(relative);
  try {
    const root = await fs.realpath(job);
    const boundary = jobRoots.get(job);
    if (boundary && !inside(await rootAnchor(boundary), root)) throw hostError("E_PATH_DENIED", "ジョブの実体が root の外へ変更されています。");
    const target = path.join(job, ...relative.split("/"));
    if (!inside(root, await physicalPath(target))) throw hostError("E_PATH_DENIED", "ジョブの外へ向くリンクは使用できません。");
    return target;
  } catch (error) { return pathError(error); }
}
// Records are replaced atomically by rename. On POSIX a reader can open the old inode just before
// the rename, so an identity mismatch is re-verified a few times; a persistent mismatch is denied.
const identityAttempts = 5;
export async function openVerified(file: string, recheck: () => Promise<string>, rejectLinks = false): Promise<FileHandle> {
  for (let attempt = 1; ; attempt++) {
    let handle: FileHandle | undefined;
    try {
      handle = await fs.open(file, "r");
      const opened = await handle.stat();
      const actual = await fs.stat(await fs.realpath(await recheck()));
      if (!opened.isFile() || rejectLinks && opened.nlink > 1)
        throw hostError("E_PATH_DENIED", "読取対象の実体が一致しないか、許可されないリンクです。");
      if (opened.dev !== actual.dev || opened.ino !== actual.ino) {
        await handle.close(); handle = undefined;
        if (attempt < identityAttempts) { await new Promise((resolve) => setTimeout(resolve, 10 * attempt)); continue; }
        throw hostError("E_PATH_DENIED", "読取対象の実体が一致しないか、許可されないリンクです。");
      }
      return handle;
    } catch (error) { await handle?.close(); return pathError(error); }
  }
}
export async function readJobBytes(job: string, relative: string): Promise<Buffer> {
  const handle = await openVerified(await jobFile(job, relative), () => jobFile(job, relative));
  try { return await handle.readFile(); } finally { await handle.close(); }
}
// Resolve an existing parent, create immediately below it, then verify its identity again.
export async function withVerifiedParent<T>(file: string, action: (physicalFile: string) => Promise<T>): Promise<T> {
  const parent = path.dirname(file);
  const real = await fs.realpath(parent);
  const before = await fs.stat(real);
  try { return await action(path.join(real, path.basename(file))); }
  finally {
    try {
      const after = await fs.stat(await fs.realpath(parent));
      if (before.dev !== after.dev || before.ino !== after.ino || await fs.realpath(parent) !== real)
        throw hostError("E_PATH_DENIED", "書込先の親フォルダが変更されています。");
    } catch (error) { pathError(error); }
  }
}
export async function openWriteVerified(file: string, flags: "wx" | "a"): Promise<FileHandle> {
  let handle: FileHandle | undefined;
  try {
    await withVerifiedParent(file, async (physicalFile) => {
      handle = await fs.open(physicalFile, flags);
      const opened = await handle.stat(), actual = await fs.stat(physicalFile);
      if (opened.dev !== actual.dev || opened.ino !== actual.ino || opened.nlink > 1 || path.dirname(await fs.realpath(physicalFile)) !== path.dirname(physicalFile))
        throw hostError("E_PATH_DENIED", "書込対象の実体を確認できません。");
    });
    return handle!;
  } catch (error) { await handle?.close(); throw error; }
}
export async function ensureDirectory(directory: string): Promise<void> {
  try { if ((await fs.stat(directory)).isDirectory()) return; }
  catch (error) { if (!isMissing(error)) return pathError(error); }
  const parent = path.dirname(directory);
  if (parent === directory) throw hostError("E_PATH_DENIED", "親フォルダを確認できません。");
  await ensureDirectory(parent);
  await withVerifiedParent(directory, async (file) => {
    try { await fs.mkdir(file); }
    catch (error) { if (!error || typeof error !== "object" || !("code" in error) || error.code !== "EEXIST" || !(await fs.stat(file)).isDirectory()) throw error; }
  });
}
export async function resolveJob(context: HostContext, relative: string): Promise<string> {
  const job = await resolveAllowedPath(context, relative, "read");
  try { if (!(await fs.stat(job)).isDirectory()) throw hostError("E_NOT_A_JOB", "ジョブフォルダではありません。"); }
  catch (error) { if (isMissing(error)) throw hostError("E_JOB_NOT_FOUND", "ジョブが見つかりません。"); throw error; }
  await anchorJob(context, job);
  await readProjectFile(job);
  return job;
}
export async function readProjectFile(job: string): Promise<{ bytes: Buffer; project: Record<string, unknown> }> {
  let bytes: Buffer;
  try { bytes = await readJobBytes(job, "project.json"); }
  catch (error) { if (isMissing(error)) throw hostError("E_NOT_A_JOB", "project.json がありません。"); throw error; }
  try {
    const project: unknown = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
    if (!project || typeof project !== "object" || Array.isArray(project)) throw Error();
    return { bytes, project: project as Record<string, unknown> };
  } catch { throw hostError("E_NOT_A_JOB", "project.json を読めません。", "JSON の構文を確認してください。", { reason: "invalid_json" }); }
}
