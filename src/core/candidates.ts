import { directionAxes, directionCandidates as seededDirectionCandidates, formatCandidate, type DirectionAxis, type DirectionCandidate } from "./assist/mv-assist.ts";
import { explainerAxesForContext, explainerCandidates as seededExplainerCandidates, formatExplainerCandidate, type ExplainerCandidate, type ExplainerContext } from "./assist/explainer-assist.ts";
import type { SmmError, VideoMode } from "./types.ts";

export type CandidatesResult = {
  message: string; seed: number; notes: string[];
  candidates: (DirectionCandidate | ExplainerCandidate)[];
  axes: DirectionAxis[]; formatted: string[];
};

const randomSeed = () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
export function directionCandidates(seed = randomSeed(), count = 3): DirectionCandidate[] {
  return seededDirectionCandidates(seed, count);
}
export function explainerCandidates(seed = randomSeed(), count = 3, context: ExplainerContext = {}): ExplainerCandidate[] {
  return seededExplainerCandidates(seed, count, context);
}

export function candidatesFor(input: {
  mode: VideoMode; seed?: number; count?: number;
  characters?: "solo" | "duo" | "none"; orientation?: "landscape" | "portrait";
}): CandidatesResult {
  if (!["mv", "explanation"].includes(input.mode) ||
      (input.seed !== undefined && !Number.isSafeInteger(input.seed)) ||
      (input.count !== undefined && (!Number.isInteger(input.count) || input.count < 1 || input.count > 20)) ||
      (input.characters !== undefined && !["solo", "duo", "none"].includes(input.characters)) ||
      (input.orientation !== undefined && !["landscape", "portrait"].includes(input.orientation))) {
    const error: SmmError = { code: "E_INPUT_INVALID", message: "候補生成の入力が不正です。",
      hint: "mode、seed（安全な整数）、count（1〜20の整数）、人数と向きを確認してください。" };
    throw error;
  }
  const seed = input.seed ?? randomSeed();
  const count = input.count ?? 3;
  const message = "方向性のたたき台であり固定の正解ではない。入力へは自動で適用しません。";
  if (input.mode === "mv") {
    const candidates = directionCandidates(seed, count);
    return { message, seed, notes: ["MV では人数と向きの指定を候補生成に使用しません。"],
      candidates, axes: directionAxes, formatted: candidates.map(formatCandidate) };
  }
  const context: ExplainerContext = {
    ...(input.characters === "none" ? { characterUsage: "none" } : { characterMode: input.characters ?? "solo" }),
    ...(input.orientation === "portrait" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 }),
  };
  const candidates = explainerCandidates(seed, count, context);
  return { message, seed, notes: [], candidates, axes: explainerAxesForContext(context),
    formatted: candidates.map(formatExplainerCandidate) };
}
