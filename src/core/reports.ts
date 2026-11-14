import type { Advisory, Inspection, JsonObject, JsonValue, Validation } from "./types.ts";

export interface GhostCheckFrameEvent {
  frame: number;
  time: string;
  tiles: number;
}
export interface GhostCheckRun {
  startFrame: number;
  endFrame: number;
  startTime: string;
  endTime: string;
  events: number;
  maxTiles: number;
}
export interface GhostCheckStill {
  frame: number;
  time: string;
  kind: string;
  files: string[];
}
export interface GhostCheckSummary {
  video: string;
  fps: number;
  frames: number;
  duration: string;
  singleFrameEvents: number;
  isolated: number;
  clusteredRuns: number;
  clusteredEvents: number;
  isolatedEvents: GhostCheckFrameEvent[];
  clustered: GhostCheckRun[];
  worst: GhostCheckFrameEvent[];
  stills: GhostCheckStill[];
}

/** Read the machine summary; reject other formats without judging findings. */
export function parseGhostCheckReport(text: string): GhostCheckSummary | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || data.kind !== "biim-ghost-check")
    return null;
  if (typeof data.video !== "string" || !data.counts) return null;
  const num = (value: unknown, fallback = 0) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const str = (value: unknown) => (typeof value === "string" ? value : "");
  const record = (value: unknown) =>
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const frameEvent = (value: unknown): GhostCheckFrameEvent => {
    const entry = record(value);
    return {
      frame: num(entry.frame),
      time: str(entry.time),
      tiles: num(entry.tiles),
    };
  };
  const counts = record(data.counts);
  return {
    video: data.video,
    fps: num(data.fps, 30),
    frames: num(data.frames),
    duration: str(data.duration),
    singleFrameEvents: num(counts.singleFrameEvents),
    isolated: num(counts.isolated),
    clusteredRuns: num(counts.clusteredRuns),
    clusteredEvents: num(counts.clusteredEvents),
    isolatedEvents: Array.isArray(data.isolated)
      ? data.isolated.map(frameEvent)
      : [],
    clustered: Array.isArray(data.clustered)
      ? data.clustered.map((value) => {
          const run = record(value);
          return {
            startFrame: num(run.startFrame),
            endFrame: num(run.endFrame),
            startTime: str(run.startTime),
            endTime: str(run.endTime),
            events: num(run.events),
            maxTiles: num(run.maxTiles),
          };
        })
      : [],
    worst: Array.isArray(data.worst) ? data.worst.map(frameEvent) : [],
    stills: Array.isArray(data.stills)
      ? data.stills.map((value) => {
          const still = record(value);
          return {
            frame: num(still.frame),
            time: str(still.time),
            kind: str(still.kind),
            files: Array.isArray(still.files)
              ? still.files.filter(
                  (file): file is string => typeof file === "string",
                )
              : [],
          };
        })
      : [],
  };
}

/** Summarize isolated flashes as advice, never as a gate verdict. */
export const ghostCheckVerdict = (summary: GhostCheckSummary) =>
  summary.isolated > 0
    ? `要注意：孤立フラッシュ ${summary.isolated} 件（ゴースト嫌疑）— 静止画で正解と照合してください`
    : "孤立フラッシュなし（連続クラスタのみ）";

export function parseInspectionReport(kind: Inspection["kind"], text: string): Validation<Inspection> {
  const invalid = (): Validation<Inspection> => ({ ok: false, error: {
    code: "E_INPUT_INVALID", message: "検査結果の形式が不正です。",
    hint: "検査の種類と、対応する JSON レポートを確認してください。",
  } });
  const object = (value: unknown): value is JsonObject =>
    !!value && typeof value === "object" && !Array.isArray(value);
  let raw: JsonObject;
  try {
    const value: unknown = JSON.parse(text);
    if (!object(value)) return invalid();
    raw = value;
  } catch { return invalid(); }
  const advisories: Advisory[] = [];
  const result: Inspection = { kind, raw, advisories };
  if (kind === "validate") {
    if (raw.schema !== "smm.validate/1" || !["pass", "fail"].includes(String(raw.verdict)) ||
        typeof raw.final !== "boolean" || typeof raw.double_render !== "boolean" ||
        !Array.isArray(raw.checks) || !Array.isArray(raw.advisories) ||
        !raw.checks.every((entry) => object(entry) && typeof entry.name === "string" &&
          ["ok", "error", "skip"].includes(String(entry.status)) && typeof entry.message === "string") ||
        !raw.advisories.every((entry) => object(entry) && typeof entry.id === "string" &&
          entry.source === "validate" && typeof entry.message === "string")) return invalid();
    result.verdict = raw.verdict as "pass" | "fail";
    for (const entry of raw.advisories as JsonObject[])
      advisories.push({ id: entry.id as string, source: "validate", message: entry.message as string });
  } else if (kind === "qc") {
    if (raw.kind !== "biim-explainer-qc" || !["pass", "fail"].includes(String(raw.verdict)) ||
        !Array.isArray(raw.gates) || !Array.isArray(raw.advisories)) return invalid();
    result.verdict = raw.verdict as "pass" | "fail";
    for (const entry of raw.advisories) {
      if (!object(entry) || typeof entry.id !== "string" || typeof entry.detail !== "string") return invalid();
      const details: JsonObject = {};
      for (const key of ["scope", "scene_ids"]) if (entry[key] !== undefined) details[key] = entry[key];
      advisories.push({ id: entry.id, source: "qc", message: entry.detail, details });
    }
  } else if (kind === "ghost-check") {
    const summary = parseGhostCheckReport(text);
    if (!summary) {
      if (raw.kind !== "biim-ghost-check" || typeof raw.skipped !== "string") return invalid();
    } else advisories.push({ id: "ghost-count", source: "ghost-check",
      message: `孤立フラッシュ ${summary.isolated} 件、連続クラスタ ${summary.clusteredRuns} 件（検出件数は助言です）。` });
    if (typeof raw.skipped === "string") advisories.push({ id: "ghost-skipped", source: "ghost-check", message: raw.skipped });
  } else if (kind === "imagegen") {
    const entries: JsonValue[] = Array.isArray(raw.assets) ? raw.assets : [raw];
    if (!entries.every((entry) => object(entry) && ["ok", "skipped"].includes(String(entry.status)))) return invalid();
    for (const [index, entry] of (entries as JsonObject[]).entries()) {
      if (entry.status === "skipped") advisories.push({ id: `imagegen-skipped-${index + 1}`, source: "imagegen",
        message: typeof entry.reason === "string" ? entry.reason : "画像素材は未生成です。" });
    }
  } else return invalid();
  return { ok: true, value: result };
}
