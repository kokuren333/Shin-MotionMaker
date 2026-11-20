import { hostError } from "../errors.ts";
import type { Ratio, Resolution } from "./types.ts";

type Price = { plain: number; video: number };
export type ModelEntry = {
  alias: string; id: string; family: "2.5" | "2.0";
  resolutions: readonly Resolution[];
  /** USD per 1M tokens. null means the resolution is accepted by the API but has no registered price. */
  prices: Partial<Record<Resolution, Price | null>>;
  limits: { images: number; videos: number; audios: number };
};

const standard = (plain: number, video: number): Price => ({ plain, video });
export const MODELS: readonly ModelEntry[] = Object.freeze([
  { alias: "seedance-2-5", id: "dreamina-seedance-2-5-260628", family: "2.5", resolutions: ["480p", "720p", "1080p", "4k"],
    prices: { "480p": standard(10.7, 6.4), "720p": standard(10.7, 6.4), "1080p": standard(11.7, 7.0), "4k": null }, limits: { images: 30, videos: 10, audios: 10 } },
  { alias: "seedance-2-5-flash", id: "dreamina-seedance-2-5-flash-261115", family: "2.5", resolutions: ["480p", "720p"],
    prices: { "480p": standard(7.0, 4.3), "720p": standard(7.0, 4.3) }, limits: { images: 10, videos: 5, audios: 5 } },
  { alias: "seedance-2-0", id: "dreamina-seedance-2-0-260128", family: "2.0", resolutions: ["480p", "720p", "1080p", "4k"],
    prices: { "480p": standard(7.0, 4.3), "720p": standard(7.0, 4.3), "1080p": standard(7.7, 4.7), "4k": standard(4.0, 2.4) }, limits: { images: 9, videos: 3, audios: 3 } },
  { alias: "seedance-2-0-fast", id: "dreamina-seedance-2-0-fast-260128", family: "2.0", resolutions: ["480p", "720p"],
    prices: { "480p": standard(5.6, 3.3), "720p": standard(5.6, 3.3) }, limits: { images: 9, videos: 3, audios: 3 } },
  { alias: "seedance-2-0-mini", id: "dreamina-seedance-2-0-mini-260615", family: "2.0", resolutions: ["480p", "720p"],
    prices: { "480p": standard(3.5, 2.1), "720p": standard(3.5, 2.1) }, limits: { images: 9, videos: 3, audios: 3 } },
].map((entry) => Object.freeze(entry) as ModelEntry));
export const DEFAULT_MODEL = "seedance-2-0-mini";
/** Input video length is unknown from a URL, so each reference video is assumed to be this long. */
export const ASSUMED_INPUT_VIDEO_SECONDS = 15;

export function findModel(name: string): ModelEntry | undefined {
  return MODELS.find((entry) => entry.alias === name || entry.id === name);
}
export function resolveModel(name: string): ModelEntry {
  const entry = findModel(name);
  if (!entry) throw hostError("E_INPUT_INVALID", "Seedance のモデルが登録表にありません。", `別名または ID を指定してください：${MODELS.map((model) => model.alias).join("、")}。`, { field: "model" });
  return entry;
}
/** 16:9 frame size used for the token formula. */
export function dimensions(model: ModelEntry, resolution: Resolution): { width: number; height: number } {
  if (resolution === "480p") return model.family === "2.5" ? { width: 854, height: 480 } : { width: 864, height: 496 };
  if (resolution === "720p") return { width: 1280, height: 720 };
  if (resolution === "1080p") return { width: 1920, height: 1080 };
  return { width: 3840, height: 2160 };
}
export const roundUsd = (value: number) => Math.round(value * 1e6) / 1e6;
export type Estimate = { tokens: number; usd: number; basis: string; price_per_million: number };
function priceFor(model: ModelEntry, resolution: Resolution, videoInput: boolean): number {
  if (!model.resolutions.includes(resolution))
    throw hostError("E_INPUT_INVALID", "このモデルは指定の解像度に対応していません。", `${model.alias} の対応解像度：${model.resolutions.join("、")}。`, { field: "resolution", model: model.alias, resolution });
  const price = model.prices[resolution];
  if (!price) throw hostError("E_INPUT_INVALID", "このモデルと解像度の単価が登録されていないため、費用を見積もれません。", "別の解像度を指定してください。", { field: "resolution", model: model.alias, resolution, reason: "price_unregistered" });
  return videoInput ? price.video : price.plain;
}
/** tokens = (input video seconds + output seconds) * width * height * 24 / 1024 */
export function estimate(modelName: string | ModelEntry, options: { resolution: Resolution; ratio?: Ratio; duration: number; referenceVideos?: number }): Estimate {
  const model = typeof modelName === "string" ? resolveModel(modelName) : modelName;
  const videos = options.referenceVideos ?? 0;
  const price = priceFor(model, options.resolution, videos > 0);
  const { width, height } = dimensions(model, options.resolution);
  const inputSeconds = videos * ASSUMED_INPUT_VIDEO_SECONDS;
  const tokens = Math.ceil((inputSeconds + options.duration) * width * height * 24 / 1024);
  const basis = [(options.ratio ?? "16:9") === "16:9" ? "dimensions-16:9" : "area-16:9", ...(videos > 0 ? [`video-input-assumed-${ASSUMED_INPUT_VIDEO_SECONDS}s-each`] : [])].join("+");
  return { tokens, usd: roundUsd(tokens * price / 1e6), basis, price_per_million: price };
}
/** Actual cost from usage.completion_tokens. */
export function costFromTokens(model: ModelEntry, resolution: Resolution, videoInput: boolean, tokens: number): number {
  return roundUsd(tokens * priceFor(model, resolution, videoInput) / 1e6);
}
