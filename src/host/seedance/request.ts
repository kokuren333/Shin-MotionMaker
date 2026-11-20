import fs from "node:fs/promises";
import path from "node:path";
import { hostError, isMissing } from "../errors.ts";
import { sha256 } from "../io.ts";
import { assertRelative, jobFile, readJobBytes } from "../paths.ts";
import { DEFAULT_MODEL, estimate, resolveModel, type Estimate, type ModelEntry } from "./models.ts";
import type { InputRole, Ratio, Resolution, SeedanceInputRecord, SeedanceMode, SeedanceParams } from "./types.ts";

export type SeedanceCreateInput = {
  job: string; shot_id: string; prompt: string; model?: string; mode?: SeedanceMode;
  first_frame?: string; last_frame?: string;
  reference_images?: string[]; reference_videos?: string[]; reference_audios?: string[];
  resolution?: Resolution; ratio?: Ratio; duration?: number; seed?: number;
  generate_audio?: boolean; watermark?: boolean; wait_ms?: number; force?: boolean;
};
export const RESOLUTIONS: readonly Resolution[] = ["480p", "720p", "1080p", "4k"];
export const RATIOS: readonly Ratio[] = ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"];
export const MODES: readonly SeedanceMode[] = ["text", "image", "reference"];
// Windows device names (CON, NUL, COM1...) cannot be output file names; reject them before any request is sent.
export const SHOT_ID_PATTERN = /^(?!(?:[Cc][Oo][Nn]|[Pp][Rr][Nn]|[Aa][Uu][Xx]|[Nn][Uu][Ll]|[Cc][Oo][Mm][0-9]|[Ll][Pp][Tt][0-9])$)[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export const DEFAULT_CREATE_WAIT_MS = 45000;
export const MAX_WAIT_MS = 50000;
export const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
const createKeys = new Set(["job", "shot_id", "prompt", "model", "mode", "first_frame", "last_frame", "reference_images", "reference_videos", "reference_audios",
  "resolution", "ratio", "duration", "seed", "generate_audio", "watermark", "wait_ms", "force"]);

type AssetKind = "image" | "video" | "audio";
export type AssetSpec = { role: InputRole; kind: AssetKind; value: string };
export type NormalizedCreate = {
  shot_id: string; prompt: string; model: ModelEntry; mode: SeedanceMode; params: SeedanceParams;
  assets: AssetSpec[]; wait_ms: number; force: boolean; estimate: Estimate;
};
export type ResolvedAsset = { spec: AssetSpec; record: SeedanceInputRecord; send: string; cacheId: string };

const invalid = (message: string, hint: string, field?: string) => hostError("E_INPUT_INVALID", message, hint, field ? { field } : undefined);
export function integerIn(value: unknown, field: string, min: number, max: number, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw invalid(`${field} は ${min}〜${max} の整数で指定してください。`, `${field} の値を確認してください。`, field);
  return value;
}
function booleanOr(value: unknown, field: string): boolean {
  if (value === undefined) return false;
  if (typeof value !== "boolean") throw invalid(`${field} は真偽値で指定してください。`, `${field} に true か false を指定してください。`, field);
  return value;
}
function choiceOr<T extends string>(value: unknown, field: string, choices: readonly T[], fallback: T): T {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !choices.includes(value as T)) throw invalid(`${field} の値が対応していません。`, `${field} は ${choices.join("、")} のいずれかです。`, field);
  return value as T;
}
function stringList(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item)) throw invalid(`${field} は空でない文字列の配列で指定してください。`, `${field} の値を確認してください。`, field);
  return value as string[];
}

/** Validate the create input and build the parameters. Pure apart from the model table. */
export function normalizeCreate(input: SeedanceCreateInput): NormalizedCreate {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw invalid("入力はオブジェクトで指定してください。", "seedance_create の入力を確認してください。");
  const unknown = Object.keys(input).filter((key) => !createKeys.has(key));
  if (unknown.length) throw hostError("E_INPUT_INVALID", "seedance_create に未知の項目があります。", "入力スキーマにある項目だけを指定してください。", { fields: unknown });
  if (typeof input.shot_id !== "string" || !SHOT_ID_PATTERN.test(input.shot_id)) throw invalid("shot_id が不正です。", "英数字で始まり、英数字・_・- だけからなる64文字以内にしてください。CON・NUL・COM1 などの Windows の予約名は使えません。", "shot_id");
  if (typeof input.prompt !== "string" || !input.prompt.trim()) throw invalid("prompt が空です。", "生成したい映像を自由に記述してください。", "prompt");
  if (input.model !== undefined && typeof input.model !== "string") throw invalid("model は文字列で指定してください。", "モデルの別名または ID を指定してください。", "model");
  const model = resolveModel(input.model ?? DEFAULT_MODEL);
  const mode = choiceOr(input.mode, "mode", MODES, "text");
  const resolution = choiceOr(input.resolution, "resolution", RESOLUTIONS, "720p");
  const ratio = choiceOr(input.ratio, "ratio", RATIOS, "16:9");
  const duration = integerIn(input.duration, "duration", 1, 15, 5);
  const params: SeedanceParams = { resolution, ratio, duration, generate_audio: booleanOr(input.generate_audio, "generate_audio"), watermark: booleanOr(input.watermark, "watermark") };
  if (input.seed !== undefined) params.seed = integerIn(input.seed, "seed", -1, 4294967295, -1);
  const wait_ms = integerIn(input.wait_ms, "wait_ms", 0, MAX_WAIT_MS, DEFAULT_CREATE_WAIT_MS);
  const force = booleanOr(input.force, "force");
  for (const field of ["first_frame", "last_frame"] as const)
    if (input[field] !== undefined && (typeof input[field] !== "string" || !input[field])) throw invalid(`${field} は空でない文字列で指定してください。`, `${field} の値を確認してください。`, field);
  const images = stringList(input.reference_images, "reference_images"), videos = stringList(input.reference_videos, "reference_videos"), audios = stringList(input.reference_audios, "reference_audios");
  const frames = input.first_frame !== undefined || input.last_frame !== undefined;
  const references = images.length + videos.length + audios.length > 0 || input.reference_images !== undefined || input.reference_videos !== undefined || input.reference_audios !== undefined;
  const assets: AssetSpec[] = [];
  if (mode === "text") {
    if (frames || references) throw invalid("text モードでは素材を指定できません。", "素材を使うときは mode に image（先頭・末尾フレーム）か reference（参照素材）を指定してください。", "mode");
  } else if (mode === "image") {
    if (references) throw invalid("image モードでは reference_* を指定できません。", "参照素材を使うときは mode に reference を指定してください。混在はできません。", "mode");
    if (!input.first_frame) throw invalid("image モードでは first_frame が必須です。", "先頭フレームの画像を first_frame に指定してください。", "first_frame");
    assets.push({ role: "first_frame", kind: "image", value: input.first_frame });
    if (input.last_frame) assets.push({ role: "last_frame", kind: "image", value: input.last_frame });
  } else {
    if (frames) throw invalid("reference モードでは first_frame・last_frame を指定できません。", "先頭・末尾フレームを使うときは mode に image を指定してください。混在はできません。", "mode");
    if (!images.length && !videos.length && !audios.length) throw invalid("reference モードでは参照素材が少なくとも1つ必要です。", "reference_images・reference_videos・reference_audios のいずれかを指定してください。", "mode");
    const over = ([["reference_images", images.length, model.limits.images], ["reference_videos", videos.length, model.limits.videos], ["reference_audios", audios.length, model.limits.audios]] as const)
      .filter(([, count, limit]) => count > limit);
    if (over.length) throw hostError("E_INPUT_INVALID", "参照素材の数がモデルの上限を超えています。", `${model.alias} の上限は画像 ${model.limits.images}・動画 ${model.limits.videos}・音声 ${model.limits.audios} です。`,
      { field: over[0][0], count: over[0][1], limit: over[0][2], model: model.alias });
    for (const value of images) assets.push({ role: "reference_image", kind: "image", value });
    for (const value of videos) assets.push({ role: "reference_video", kind: "video", value });
    for (const value of audios) assets.push({ role: "reference_audio", kind: "audio", value });
  }
  const cost = estimate(model, { resolution, ratio, duration, referenceVideos: videos.length });
  return { shot_id: input.shot_id, prompt: input.prompt, model, mode, params, assets, wait_ms, force, estimate: cost };
}

const imageTypes: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
/** Strip query and fragment for storage; the full URL is only sent in the request body. */
export function storedUrl(value: string): string {
  if (/^https:\/\//i.test(value)) { const url = new URL(value); url.search = ""; url.hash = ""; return url.toString(); }
  return value.split(/[?#]/, 1)[0];
}
/** Resolve local images to data URIs and normalise URLs. Local video and audio files are rejected. */
export async function resolveAssets(job: string, assets: AssetSpec[]): Promise<ResolvedAsset[]> {
  const result: ResolvedAsset[] = [];
  for (const spec of assets) {
    const value = spec.value;
    if (/^https:\/\//i.test(value) || /^asset:\/\//i.test(value)) {
      if (/^https:/i.test(value)) { try { new URL(value); } catch { throw invalid("素材の URL を解釈できません。", "https:// で始まる正しい URL を指定してください。", spec.role); } }
      const full = sha256(value);
      result.push({ spec, record: { role: spec.role, url: storedUrl(value), url_sha256: full }, send: value, cacheId: `url:${full}` });
      continue;
    }
    if (/^[a-z][a-z0-9+.-]+:/i.test(value)) throw invalid("素材の URL は https:// と asset:// だけを受け付けます。", "https:// の URL、asset:// の素材 ID、またはジョブ内の画像の相対パスを指定してください。", spec.role);
    if (spec.kind !== "image") throw invalid("動画・音声のローカルファイルは参照素材に使えません。", "https:// の URL か、BytePlus に登録した asset:// の素材 ID を指定してください。", spec.role);
    assertRelative(value);
    const type = imageTypes[path.extname(value).toLowerCase()];
    if (!type) throw invalid("ローカル画像は png・jpg・jpeg・webp だけを受け付けます。", "画像の形式を変換してから指定してください。", spec.role);
    let bytes: Buffer;
    try {
      const stat = await fs.stat(await jobFile(job, value));
      if (!stat.isFile()) throw invalid("素材のパスがファイルではありません。", "ジョブ内の画像ファイルの相対パスを指定してください。", spec.role);
      if (stat.size > MAX_IMAGE_BYTES) throw invalid("ローカル画像が 30 MiB を超えています。", "画像を縮小するか、https:// の URL を指定してください。", spec.role);
      bytes = await readJobBytes(job, value);
    } catch (error) {
      if (isMissing(error)) throw invalid("素材の画像が見つかりません。", "ジョブフォルダからの相対パス（/ 区切り）を指定してください。", spec.role);
      throw error;
    }
    if (bytes.length > MAX_IMAGE_BYTES) throw invalid("ローカル画像が 30 MiB を超えています。", "画像を縮小するか、https:// の URL を指定してください。", spec.role);
    const digest = sha256(bytes);
    result.push({ spec, record: { role: spec.role, path: value, sha256: digest }, send: `data:${type};base64,${bytes.toString("base64")}`, cacheId: `sha256:${digest}` });
  }
  return result;
}
export function buildContent(prompt: string, assets: ResolvedAsset[]): Record<string, unknown>[] {
  const content: Record<string, unknown>[] = [{ type: "text", text: prompt }];
  for (const asset of assets) {
    const kind = asset.spec.kind;
    content.push({ type: `${kind}_url`, [`${kind}_url`]: { url: asset.send }, role: asset.spec.role });
  }
  return content;
}
export function buildBody(model: ModelEntry, prompt: string, assets: ResolvedAsset[], params: SeedanceParams): Record<string, unknown> {
  return { model: model.id, content: buildContent(prompt, assets), resolution: params.resolution, ratio: params.ratio, duration: params.duration,
    generate_audio: params.generate_audio, watermark: params.watermark, ...(params.seed === undefined ? {} : { seed: params.seed }) };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().filter((key) => (value as Record<string, unknown>)[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function cacheKey(backend: "mock" | "ark", model: ModelEntry, mode: SeedanceMode, prompt: string, params: SeedanceParams, assets: ResolvedAsset[]): string {
  return sha256(canonical({ backend, model_id: model.id, mode, prompt, params, inputs: assets.map((asset) => ({ role: asset.spec.role, id: asset.cacheId })) }));
}
