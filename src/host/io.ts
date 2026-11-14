import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import { includeTemplatePath, mimeTypeFor, validateRequest, zipJobFiles, type BuiltJob, type JobAssets, type TemplateFiles } from "../core/index.ts";
import fontAssets from "../core/data/font-assets.json" with { type: "json" };
import type { GenerateResult, HostContext } from "./types.ts";
import { assertRelative, displayPath, jobFile, resolveAllowedPath } from "./paths.ts";
import { hostError, isMissing } from "./errors.ts";
import { measureAudio } from "./tools.ts";

export const repository = fileURLToPath(new URL("../../", import.meta.url));
export const sha256 = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export async function replaceFile(temporary: string, destination: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try { await fs.rename(temporary, destination); return; }
    catch (error) {
      // Windows readers and scanners can briefly deny replacement. Never unlink the target.
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (process.platform !== "win32" || !["EPERM", "EACCES", "EBUSY"].includes(code) || attempt >= 49) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.min(20 + attempt * 10, 100)));
    }
  }
}
export async function atomicJson(file: string, value: unknown): Promise<void> {
  const temporary = `${file}.${randomBytes(8).toString("hex")}.tmp`;
  try { await fs.writeFile(temporary, JSON.stringify(value, null, 2) + "\n", { flag: "wx" }); await replaceFile(temporary, file); }
  finally { await fs.rm(temporary, { force: true }); }
}
export async function loadTemplates(): Promise<TemplateFiles> {
  const result = await loadTemplateDirectory(path.join(repository, "job-template"));
  for (const font of fontAssets) {
    const bytes = new Uint8Array(await fs.readFile(path.join(repository, "job-assets/fonts", font.name)));
    if (sha256(bytes) !== font.sha256) throw hostError("E_INTERNAL", "同梱フォントのハッシュが一致しません。");
    result[`assets/fonts/${font.name}`] = bytes;
  }
  return result;
}
export async function loadTemplateDirectory(directory: string): Promise<TemplateFiles> {
  const result: TemplateFiles = {};
  async function visit(directory: string, prefix = "") {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const name = prefix + entry.name;
      if (!includeTemplatePath(name)) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file, name + "/");
      else if (entry.isFile()) result[name] = await fs.readFile(file, "utf8");
      else throw hostError("E_PATH_DENIED", "テンプレートにリンクが含まれています。");
    }
  }
  await visit(directory);
  return result;
}
export async function readJsonInput(file: string, context: HostContext): Promise<unknown> {
  try { return JSON.parse(await readTextInput(file, context)); }
  catch (error) { if (error instanceof SyntaxError || isMissing(error)) throw hostError("E_INPUT_INVALID", "入力 JSON を読めません。", "ファイルの場所と JSON の構文を確認してください。"); throw error; }
}
export async function readTextInput(file: string, context: HostContext): Promise<string> {
  try { return (await fs.readFile(await resolveAllowedPath(context, file, "read"), "utf8")).replace(/^\uFEFF/, ""); }
  catch (error) { if (isMissing(error)) throw hostError("E_INPUT_INVALID", "入力ファイルが見つかりません。", "指定したパスを確認してください。"); throw error; }
}
export async function resolveRequest(input: unknown, context: HostContext) {
  const shape = validateRequest(input, { phase: "shape" });
  if (!shape.ok) throw shape.error;
  const assets: JobAssets = { sources: [] };
  const load = async (relative: string) => {
    try {
      const file = await resolveAllowedPath(context, relative, "attachment");
      const data = new Uint8Array(await fs.readFile(await resolveAllowedPath(context, relative, "attachment")));
      const name = path.basename(file);
      return { name, data, size: data.byteLength, type: mimeTypeFor(name) };
    } catch (error) { if (isMissing(error)) throw hostError("E_INPUT_INVALID", "添付ファイルが見つかりません。", "request.json からの相対パスを確認してください。"); throw error; }
  };
  for (const value of shape.value.assets.sources ?? []) assets.sources.push(await load(value));
  for (const key of ["character", "secondCharacter", "bgm", "music"] as const)
    if (shape.value.assets[key]) assets[key] = await load(shape.value.assets[key]);
  if (shape.value.form.videoMode === "mv" && shape.value.form.musicDurationSec === null && assets.music) {
    shape.value.form.musicDurationSec = await measureAudio(assets.music.data as Uint8Array, await resolveAllowedPath(context, shape.value.assets.music!, "attachment"));
  }
  const complete = validateRequest(shape.value, { phase: "complete", assets });
  if (!complete.ok) {
    if (shape.value.form.videoMode === "mv" && assets.music && shape.value.form.musicDurationSec === null)
      throw { ...complete.error, hint: "音源を測定できませんでした。request.form.musicDurationSec に0秒超〜7,200秒の尺を指定するか、測定可能な WAV を添付してください。" };
    throw complete.error;
  }
  return { request: complete.value, assets };
}
export async function readRequest(file: string, context: HostContext) {
  const location = await resolveAllowedPath(context, file, "read");
  return resolveRequest(await readJsonInput(file, context), { ...context, requestDirectory: path.dirname(location) });
}
export function generatedResult(job: BuiltJob): GenerateResult {
  return { job: null, archive: null, dry_run: true, file_count: Object.keys(job.files).length,
    project: job.project, project_sha256: sha256(job.files["project.json"]), agent_prompt: job.agentPrompt };
}
export async function writeJob(context: HostContext, job: BuiltJob, out: string, format: "dir" | "zip"): Promise<GenerateResult> {
  if (context.readOnly) throw hostError("E_DISABLED", "読み取り専用では生成できません。");
  assertRelative(job.rootName); assertRelative(job.filename);
  if (job.rootName.includes("/") || job.filename.includes("/")) throw hostError("E_PATH_DENIED", "出力名に区切りは使用できません。");
  for (const name of Object.keys(job.files)) assertRelative(name);
  // Detect case-insensitive and file/directory collisions before reserving output.
  const names = new Set<string>();
  const files = Object.keys(job.files).map((name) => name.toLowerCase());
  for (const name of files) {
    if (names.has(name) || name.split("/").slice(0, -1).some((_, index, parts) => files.includes(parts.slice(0, index + 1).join("/")))) throw hostError("E_PATH_DENIED", "出力パスが衝突しています。");
    names.add(name);
  }
  const parent = await resolveAllowedPath(context, out, "write");
  const destination = path.join(parent, format === "dir" ? job.rootName : job.filename);
  await resolveAllowedPath(context, path.relative(context.root, destination).split(path.sep).join("/"), "write");
  await fs.mkdir(await resolveAllowedPath(context, out, "write"), { recursive: true });
  const result = generatedResult(job);
  try {
    if (format === "dir") {
      await fs.mkdir(destination);
      for (const [name, bytes] of Object.entries(job.files)) {
        const file = await jobFile(destination, name);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(await jobFile(destination, name), bytes, { flag: "wx" });
      }
      result.job = displayPath(context, destination);
    } else {
      const handle = await fs.open(destination, "wx");
      try { await handle.writeFile((await zipJobFiles(job)).data); } finally { await handle.close(); }
      result.archive = displayPath(context, destination);
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") throw hostError("E_OUTPUT_EXISTS", "同名の出力先が既に存在します。", "別の出力先またはタイトルを指定してください。");
    throw error;
  }
  return { ...result, dry_run: false };
}
