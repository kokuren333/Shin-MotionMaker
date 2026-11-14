import fs from "node:fs/promises";
import path from "node:path";
import { parseInspectionReport, type Advisory, type JsonObject } from "../core/index.ts";
import type { CheckResult, RunRecord } from "./types.ts";
import { hostError, isMissing } from "./errors.ts";
import { assertRelative, jobFile, readProjectFile, openVerified } from "./paths.ts";

export async function freshJson(job: string, name: string, started: string): Promise<JsonObject | null> {
  try {
    const file = await jobFile(job, name);
    const handle = await openVerified(file, () => jobFile(job, name));
    let value: unknown;
    try {
      if ((await handle.stat()).mtimeMs < Date.parse(started)) return null;
      value = JSON.parse(await handle.readFile("utf8"));
    } finally { await handle.close(); }
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error();
    return value as JsonObject;
  } catch (error) { if (isMissing(error)) return null; throw error; }
}
function reportName(run: RunRecord): string | null {
  if (run.kind === "validate") return "reports/validate.json";
  if (run.kind === "qc") return `reports/qc-${run.args.stage}.json`;
  if (run.kind === "ghost_check") {
    const video = String(run.args.video ?? `output/${run.args.target ?? "final"}.mp4`);
    const stem = path.basename(video, path.extname(video));
    return `reports/ghost-check${stem === "final" ? "" : `-${stem}`}.json`;
  }
  if (run.kind === "imagegen") return "assets/generated/manifest.json";
  if (run.kind === "voice") return "assets/audio/narration.json";
  if (run.kind === "sound") return "assets/audio/sound-design.json";
  return null;
}
export function resultAdvisories(run: RunRecord): Advisory[] {
  if (!run.result?.report) return [];
  const kind = run.kind === "ghost_check" ? "ghost-check" : run.kind;
  if (!["qc", "validate", "ghost-check", "imagegen"].includes(kind)) return [];
  const parsed = parseInspectionReport(kind as "qc" | "validate" | "ghost-check" | "imagegen", JSON.stringify(run.result.report));
  return parsed.ok ? parsed.value.advisories : [];
}
async function freshArtifact(job: string, relative: string, started: string): Promise<boolean> {
  assertRelative(relative);
  try { return (await fs.stat(await jobFile(job, relative))).mtimeMs >= Date.parse(started); }
  catch (error) { if (isMissing(error)) return false; throw error; }
}
export async function collectRunResult(job: string, run: RunRecord, code: number | null, stdout: string, stderr: string): Promise<{ result: CheckResult; exit_code: 0 | 1 }> {
  const { project } = await readProjectFile(job);
  const name = reportName(run);
  let report = name ? await freshJson(job, name, run.started_at) : null;
  const result: CheckResult = { report, artifacts: report && name ? [name] : [] };
  const anomaly = () => hostError("E_INTERNAL", "スクリプトの終了と今回の完了記録が一致しません。", "stdout.log・stderr.log とレポートの更新時刻を確認してください。");
  if (run.kind === "qc" && project.mode === "mv") {
    if (code !== 0) throw anomaly();
    return { result: { verdict: "not_applicable", report: null, artifacts: [] }, exit_code: 0 };
  }
  if (run.kind === "qc" || run.kind === "validate") {
    if (!report && run.kind === "validate" && project.schema_version === "0.4") {
      const checks = stdout.split(/\r?\n/).filter((line) => line.startsWith("OK ")).map((line) => ({ name: line.slice(3), status: "ok", message: line }));
      const errors = stderr.trim().split(/\r?\n/).filter(Boolean);
      const complete = code === 0 && stdout.includes("Structural checks passed. Visual and audio QA still requires watching and listening.") ||
        code === 1 && checks.length > 0 && errors.length > 0 && errors.every((line) => /^[^:\r\n]+: .+/.test(line) && !/^(?:Error|TypeError|ReferenceError|SyntaxError|RangeError):|^\s+at\s/.test(line));
      if (!complete) throw anomaly();
      report = { schema: "smm.validate/1", final: run.args.final === true, double_render: run.args.double_render === true, verdict: code === 0 ? "pass" : "fail",
        checks: [...checks, ...errors.map((line) => ({ name: line.split(":")[0], status: "error", message: line }))],
        advisories: stdout.split(/\r?\n/).filter((line) => /^(SKIP|GHOST) /.test(line)).map((line, index) => ({ id: `legacy-${index + 1}`, source: "validate", message: `ジョブからの助言: ${line}` })) };
      result.report = report;
    }
    if (!report) throw anomaly();
    const parsed = parseInspectionReport(run.kind, JSON.stringify(report));
    if (!parsed.ok || ![0, 1].includes(code ?? -1) || parsed.value.verdict !== (code === 0 ? "pass" : "fail")) throw anomaly();
    result.verdict = parsed.value.verdict;
    return { result, exit_code: code as 0 | 1 };
  }
  if (run.kind === "ghost_check") {
    if (!report) throw anomaly();
    const parsed = parseInspectionReport("ghost-check", JSON.stringify(report));
    if (!parsed.ok || code !== 0 || report.skipped !== undefined || !report.counts || typeof report.frames !== "number") throw anomaly();
    for (const still of Array.isArray(report.stills) ? report.stills : []) {
      if (still && typeof still === "object" && !Array.isArray(still) && Array.isArray(still.files)) for (const file of still.files) if (typeof file === "string" && await freshArtifact(job, file, run.started_at)) result.artifacts.push(file);
    }
    return { result, exit_code: 0 };
  }
  if (run.kind === "imagegen") {
    if (run.args.dry_run === true && code === 0) return { result: { report: null, artifacts: [] }, exit_code: 0 };
    // The manifest accumulates history; only this invocation's named entries are results.
    const entries = Array.isArray(report?.assets) ? report.assets.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry) && entry.name === run.args.name && typeof entry.created_at === "string" && Date.parse(entry.created_at) >= Date.parse(run.started_at)) as JsonObject[] : [];
    if (!entries.length) throw anomaly();
    result.report = { assets: entries };
    const parsed = parseInspectionReport("imagegen", JSON.stringify(result.report));
    const skipped = entries.some((entry) => entry.status === "skipped");
    const expected = skipped && run.args.strict === true ? 1 : 0;
    if (!parsed.ok || code !== expected) throw anomaly();
    if (expected === 1) result.verdict = "fail";
    for (const entry of entries) if (typeof entry.path === "string" && await freshArtifact(job, entry.path, run.started_at)) result.artifacts.push(entry.path);
    return { result, exit_code: expected };
  }
  if (code !== 0) {
    if ((run.kind === "voice" || run.kind === "sound") && /^(?:plan\/narration\.json segments must be an array|Write (?:project\.json scenes\[\]\.script|1–100 cues)|Scene (?:dialogue|narration)|Duo scenes require|Duo narration requires|Unknown speaker_id|Duplicate (?:narration|sound|character) id|Narration text is empty|spoken_text must|Narration .+ overlaps|id must be|Invalid (?:Aivis Style ID|character|notes|project path)|Unsupported voice engine|Aivis requires HTTP|Unknown sound kind|loop must be boolean|kind must be|notes must be|(?:start_sec|duration_sec|frequency|bpm|note|volume|play_duration_sec|voice\.speed|\w+\.voice\.speed): expected)/m.test(stderr))
      throw hostError("E_INPUT_INVALID", "ジョブ内スクリプトが音声・音響の入力不正を報告しました。", "run のログが示す project.json または plan の項目を修正してください。");
    if (run.kind === "voice" && /^Aivis \w+: (?:start the engine|HTTP)/m.test(stderr)) throw hostError("E_ENGINE_UNREACHABLE", "音声合成中にエンジンへの接続が失敗しました。", "Aivis の状態と run のログを確認してください。");
    if (run.kind === "render" && /(?:browser|chrome|chromium|ffmpeg).*(?:not found|could not find|no such file|ENOENT)|(?:could not find|no such file).*(?:browser|chrome|ffmpeg)/i.test(stderr)) throw hostError("E_TOOL_MISSING", "レンダーに必要な外部ツールが見つかりません。", "doctor と run のログを確認してください。");
    throw anomaly();
  }
  if (run.kind === "render") {
    const target = run.args.target === "still" ? "output/preview.png" : `output/${run.args.target}.mp4`;
    if (!await freshArtifact(job, target, run.started_at)) throw anomaly();
    result.artifacts.push(target);
  }
  if (run.kind === "voice" && (project.voice as JsonObject | undefined)?.engine === "none" || run.kind === "sound" && (project.mode === "mv" || (project.audio as JsonObject | undefined)?.generate_bgm_se === false)) {
    result.verdict = "not_applicable";
  }
  if (run.kind === "voice" || run.kind === "sound") {
    for (const clip of Array.isArray(report?.clips) ? report.clips : []) if (clip && typeof clip === "object" && !Array.isArray(clip) && typeof clip.path === "string" && await freshArtifact(job, clip.path, run.started_at)) result.artifacts.push(clip.path);
    if (run.kind === "voice" && await freshArtifact(job, "assets/audio/narration.srt", run.started_at)) result.artifacts.push("assets/audio/narration.srt");
  }
  return { result, exit_code: 0 };
}
