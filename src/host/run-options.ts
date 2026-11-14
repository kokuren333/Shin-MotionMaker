import fs from "node:fs/promises";
import type { HostContext, OperationInputs, RunKind } from "./types.ts";
import { hostError, isMissing } from "./errors.ts";
import { assertRelative, jobFile, readProjectFile } from "./paths.ts";
import { checkEngine, findFfmpeg, hasRuntimeDependencies, npmEntry } from "./tools.ts";

export const runKinds: readonly RunKind[] = ["setup", "validate", "qc", "ghost_check", "render", "voice", "sound", "imagegen"];
export function runTimeout(kind: RunKind, input: OperationInputs[RunKind]): number {
  if (kind === "setup") return 1_800_000;
  if (kind === "qc" || kind === "sound") return 300_000;
  if (kind === "voice") return 3_600_000;
  if (kind === "imagegen") return ((input as OperationInputs["imagegen"]).timeout ?? 900) * 1000 + 300_000;
  return 7_200_000;
}
export function defaultWait(kind: RunKind, input: OperationInputs[RunKind]): number {
  return kind === "qc" || kind === "sound" || kind === "validate" && !(input as OperationInputs["validate"]).final ? 45000 : 0;
}
export const scriptNames: Record<Exclude<RunKind, "setup">, string> = {
  validate: "validate.mjs", qc: "qc.mjs", ghost_check: "ghost-check.mjs", render: "run.mjs", voice: "aivis.mjs", sound: "sound-design.mjs", imagegen: "imagegen.mjs",
};
export async function runCommand<K extends RunKind>(job: string, kind: K, input: OperationInputs[K]): Promise<{ args: string[]; cwd: string }> {
  if (kind === "setup") {
    let lock = false;
    try { lock = (await fs.stat(await jobFile(job, "package-lock.json"))).isFile(); } catch (error) { if (!isMissing(error)) throw error; }
    return { args: [await npmEntry(), lock ? "ci" : "install"], cwd: job };
  }
  const args = [await jobFile(job, `runtime/scripts/${scriptNames[kind as Exclude<RunKind, "setup">]}`)];
  const flags = (value: object, keys: string[]) => { for (const key of keys) if ((value as Record<string, unknown>)[key] === true) args.push(`--${key.replaceAll("_", "-")}`); };
  if (kind === "validate") flags(input, ["final", "double_render"]);
  if (kind === "qc") args.push(`--stage=${(input as OperationInputs["qc"]).stage}`);
  if (kind === "render") {
    const value = input as OperationInputs["render"];
    args.push(value.target === "final" ? "build" : value.target);
    if (value.frame !== undefined) args.push(`--frame=${value.frame}`);
  }
  if (kind === "ghost_check") {
    const value = input as OperationInputs["ghost_check"];
    args.push(`--target=${value.target ?? "final"}`);
    for (const key of ["video", "max_stills", "tile_threshold", "min_tiles"] as const) if (value[key] !== undefined) args.push(`--${key.replaceAll("_", "-")}=${value[key]}`);
    flags(value, ["double_render", "keep", "no_stills"]);
  }
  if (kind === "imagegen") {
    const value = input as OperationInputs["imagegen"];
    for (const key of ["name", "prompt", "prompt_file", "kind", "style", "size"] as const) if (value[key] !== undefined) args.push(`--${key.replaceAll("_", "-")}`, value[key]);
    for (const ref of value.refs ?? []) args.push("--ref", ref);
    args.push("--timeout", String(value.timeout ?? 900));
    flags(value, ["force", "dry_run", "strict"]);
  }
  return { args, cwd: await jobFile(job, "runtime") };
}
export async function preflight<K extends RunKind>(context: HostContext, job: string, kind: K, input: OperationInputs[K]): Promise<void> {
  if (context.readOnly || kind === "imagegen" && context.startedBy === "mcp" && !context.enableGeneration) throw hostError("E_DISABLED", "この操作は無効です。");
  const value = input as OperationInputs[RunKind] & Record<string, unknown>;
  if ((kind === "validate" || kind === "render" || kind === "ghost_check" && value.double_render) && !await hasRuntimeDependencies(job)) throw hostError("E_DEPS_MISSING", "ジョブの依存が未導入です。", "setup を実行してください。");
  if (kind !== "setup") {
    try { if (!(await fs.stat(await jobFile(job, `runtime/scripts/${scriptNames[kind as Exclude<RunKind, "setup">]}`))).isFile()) throw Error(); }
    catch (error) { if (error && typeof error === "object" && "code" in error && error.code === "E_PATH_DENIED") throw error; throw hostError("E_NOT_A_JOB", "操作に対応するスクリプトがありません。"); }
  } else await npmEntry();
  if (kind === "render" && value.frame !== undefined && value.target !== "still") throw hostError("E_INPUT_INVALID", "frame は still でだけ指定できます。");
  if (kind === "ghost_check" || kind === "render" && value.target === "still") {
    const video = kind === "ghost_check" ? String(value.video ?? `output/${value.target ?? "final"}.mp4`) : "output/preview.mp4";
    assertRelative(video);
    if (!video.startsWith("output/") || kind === "ghost_check" && Object.values(value).some((entry) => typeof entry === "string" && entry.includes("="))) throw hostError("E_INPUT_INVALID", "対象動画は output/ 内の = を含まないパスで指定してください。");
    try { if (!(await fs.stat(await jobFile(job, video))).isFile()) throw Error(); }
    catch (error) { if (!isMissing(error) && error && typeof error === "object" && "code" in error) throw error; throw hostError("E_INPUT_INVALID", "対象動画がありません。", "先に render で動画を作成してください。"); }
    if (kind === "ghost_check" && !await findFfmpeg(job)) throw hostError("E_TOOL_MISSING", "ffmpeg が見つかりません。", "ffmpeg の導入状況または FFMPEG_PATH を確認してください。");
  }
  if (kind === "voice") {
    const { project } = await readProjectFile(job);
    const check = await checkEngine(context, project);
    if (!check.available) throw hostError("E_ENGINE_UNREACHABLE", check.message, "Aivis の起動状態と Style ID を確認してください。");
  }
  if (kind === "imagegen") {
    const image = input as OperationInputs["imagegen"];
    if (!image.prompt?.trim() && !image.prompt_file) throw hostError("E_INPUT_INVALID", "prompt または prompt_file が必要です。");
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(image.name)) throw hostError("E_INPUT_INVALID", "素材名の形式が不正です。");
    for (const [relative, prefixes] of [[image.prompt_file, ["plan/", "sources/"]], [image.style, ["plan/", "sources/"]], ...(image.refs ?? []).map((ref) => [ref, ["assets/", "sources/"]] as const)] as const) {
      if (!relative) continue;
      assertRelative(relative);
      if (!prefixes.some((prefix) => relative.startsWith(prefix))) throw hostError("E_PATH_DENIED", "素材の参照先が許可範囲外です。");
      const file = await jobFile(job, relative);
      try { if (!(await fs.stat(file)).isFile()) throw Error(); } catch { throw hostError("E_INPUT_INVALID", "素材の参照ファイルがありません。"); }
    }
    if (process.platform === "win32") {
      const paths = [await fs.realpath(job), ...await Promise.all((image.refs ?? []).map(async (ref) => fs.realpath(await jobFile(job, ref))))];
      if (paths.some((file) => /[%"\r\n]/.test(file))) throw hostError("E_PATH_DENIED", "画像生成で使用できない文字が実パスに含まれています。", "%・引用符・改行を含まない場所へジョブと参照画像を移してください。");
    }
  }
  // Resolve the complete argv before acquiring a run reservation.
  await runCommand(job, kind, input);
}
