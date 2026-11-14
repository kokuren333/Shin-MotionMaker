// View model for inspection results opened in the browser (GU-05).
// Reading is done by core parseInspectionReport; nothing here re-judges a report.
// Gates and advisories are kept in separate fields so the UI can never mix them (PH-03).
import {
  ghostCheckVerdict, parseGhostCheckReport, parseInspectionReport,
  type Advisory, type GhostCheckSummary, type JsonObject, type JsonValue, type Verdict,
} from "../../../src/core/index.ts";

export type GateRow = { id: string; title: string; status: string; statusLabel: string; detail: string };
export type GateView = {
  verdict: Verdict;
  rows: GateRow[];
  /** QC only: how the review lines were written (`self` is shown explicitly). */
  reviewMode?: string;
  /** QC only: waivers written by the owner. */
  waivers: { gateId: string; reason: string }[];
};
export type ReportView = {
  /** Same key replaces an earlier file of the same report. */
  key: string;
  title: string;
  file: string;
  /** null when the report has no gate of its own (ghost-check counts are advice only). */
  gate: GateView | null;
  advisories: Advisory[];
  facts: [string, string][];
  ghost?: GhostCheckSummary;
  run?: RunView;
};
export type RunView = {
  status: string; statusLabel: string; abnormal: boolean;
  error?: { code: string; message: string; hint: string };
};

const statusLabels: Record<string, string> = {
  pass: "合格", fail: "不合格", waived: "免除", "not-applicable": "対象外", not_applicable: "対象外",
  ok: "合格", error: "不合格", skip: "省略",
};
const runLabels: Record<string, string> = {
  running: "実行中", completed: "完了", failed: "失敗（起動・異常終了）", cancelled: "取り消し",
  timed_out: "時間切れ", lost: "消失（プロセスなし）",
};
export const verdictLabel = (verdict: Verdict) =>
  verdict === "pass" ? "合格" : verdict === "fail" ? "不合格" : "対象外";

const isObject = (value: unknown): value is JsonObject =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: JsonValue | undefined) => (typeof value === "string" ? value : value == null ? "" : JSON.stringify(value));

export type Classified = { ok: true; view: ReportView } | { ok: false; file: string; message: string };

/** Identify a report by its content (file names are only a hint for ghost preview/final). */
export function classifyReport(file: string, body: string): Classified {
  let raw: unknown;
  try {
    raw = JSON.parse(body.replace(/^﻿/, ""));
  } catch {
    return { ok: false, file, message: `${file}：JSON として読み取れません。` };
  }
  if (!isObject(raw)) return { ok: false, file, message: `${file}：検査結果の JSON ではありません。` };
  if (raw.schema === "smm.run/1") return runView(file, raw);
  const kind = raw.schema === "smm.validate/1" ? "validate"
    : raw.kind === "biim-explainer-qc" ? "qc"
    : raw.kind === "biim-ghost-check" ? "ghost-check" : null;
  if (!kind)
    return { ok: false, file, message: `${file}：対応していない JSON です。reports/ の validate・qc-pre・qc-post・ghost-check(-preview) の JSON か、.smm/runs/ の run.json を選んでください。` };
  const parsed = parseInspectionReport(kind, body.replace(/^﻿/, ""));
  if (!parsed.ok) return { ok: false, file, message: `${file}：${parsed.error.message}${parsed.error.hint}` };
  const inspection = parsed.value;
  if (kind === "validate") {
    const checks = (raw.checks as JsonObject[]);
    return { ok: true, view: {
      key: "validate", title: raw.final ? "validate（--final）" : "validate", file,
      gate: { verdict: inspection.verdict!, waivers: [], rows: checks.map((check) => ({
        id: text(check.name), title: text(check.name), status: text(check.status),
        statusLabel: statusLabels[text(check.status)] ?? text(check.status), detail: text(check.message),
      })) },
      advisories: inspection.advisories,
      facts: [["--final", raw.final ? "あり" : "なし"], ["--double-render", raw.double_render ? "あり" : "なし"]],
    } };
  }
  if (kind === "qc") {
    const stage = raw.stage === "post" ? "post" : "pre";
    const waivers = Array.isArray(raw.waivers)
      ? raw.waivers.filter(isObject).map((waiver) => ({ gateId: text(waiver.gate_id), reason: text(waiver.reason) })) : [];
    return { ok: true, view: {
      key: `qc-${stage}`, title: stage === "pre" ? "QC 事前ゲート（qc-pre）" : "QC 事後ゲート（qc-post）", file,
      gate: {
        verdict: inspection.verdict!, waivers,
        reviewMode: typeof raw.review_mode === "string" ? raw.review_mode : "self",
        rows: (raw.gates as JsonValue[]).filter(isObject).map((gate) => ({
          id: text(gate.id), title: text(gate.title), status: text(gate.status),
          statusLabel: statusLabels[text(gate.status)] ?? text(gate.status), detail: text(gate.detail),
        })),
      },
      advisories: inspection.advisories,
      facts: [["様式", text(raw.style_mode) || "—"]],
    } };
  }
  const summary = parseGhostCheckReport(body.replace(/^﻿/, ""));
  const preview = /preview/i.test(file) || /preview/i.test(text(raw.video));
  const advisories = [...inspection.advisories];
  if (summary) advisories.unshift({ id: "ghost-summary", source: "ghost-check", message: ghostCheckVerdict(summary) });
  return { ok: true, view: {
    key: preview ? "ghost-check-preview" : "ghost-check",
    title: preview ? "ゴースト検査（preview）" : "ゴースト検査（final）", file,
    gate: null, advisories,
    facts: summary ? [
      ["対象", summary.video], ["フレーム", `${summary.frames}（${summary.duration}）`],
      ["1フレーム検出", `${summary.singleFrameEvents} 件`], ["孤立", `${summary.isolated} 件`],
      ["連続クラスタ", `${summary.clusteredRuns} ラン（${summary.clusteredEvents} 件）`],
    ] : [["走査", "実施されていません（skipped）"]],
    ...(summary ? { ghost: summary } : {}),
  } };
}

function runView(file: string, raw: JsonObject): Classified {
  const status = text(raw.status);
  if (typeof raw.id !== "string" || typeof raw.kind !== "string" || !(status in runLabels))
    return { ok: false, file, message: `${file}：run.json（smm.run/1）の形式が不正です。` };
  const result = isObject(raw.result) ? raw.result : null;
  const verdict = result && ["pass", "fail", "not_applicable"].includes(text(result.verdict))
    ? text(result.verdict) as Verdict : null;
  const report = result && isObject(result.report) ? result.report : null;
  const error = isObject(raw.error)
    ? { code: text(raw.error.code), message: text(raw.error.message), hint: text(raw.error.hint) } : undefined;
  // The embedded report is read by the same path as a report opened directly, so a QC run
  // shows the same gate rows, review_mode and waivers (GU-05). The run's recorded verdict stays.
  const inner = report ? classifyReport(file, JSON.stringify(report)) : null;
  const innerView = inner?.ok ? inner.view : null;
  const reportAdvisories: Advisory[] = innerView ? innerView.advisories : report && Array.isArray(report.advisories)
    ? report.advisories.filter(isObject).map((entry) => ({
        id: text(entry.id), source: text(entry.source) || text(raw.kind),
        message: text(entry.message ?? entry.detail),
      })) : [];
  const gate: GateView | null = !verdict ? null
    : innerView?.gate ? { ...innerView.gate, verdict }
    : { verdict, rows: [], waivers: [],
      ...(report && typeof report.review_mode === "string" ? { reviewMode: report.review_mode } : {}) };
  return { ok: true, view: {
    key: `run-${raw.id}`, title: `run ${raw.kind}`, file,
    gate,
    advisories: reportAdvisories,
    facts: [
      ["run ID", raw.id], ["種類", raw.kind], ["引数", JSON.stringify(raw.args ?? {})],
      ["終了コード", raw.exit_code === null || raw.exit_code === undefined ? "—" : String(raw.exit_code)],
      ["開始", text(raw.started_at) || "—"], ["終了", text(raw.ended_at) || "—"], ["起動元", text(raw.started_by) || "—"],
      ...(Array.isArray(raw.artifacts) && raw.artifacts.length ? [["成果物", raw.artifacts.map(text).join("、")] as [string, string]] : []),
    ],
    run: { status, statusLabel: runLabels[status], abnormal: ["failed", "cancelled", "timed_out", "lost"].includes(status), ...(error ? { error } : {}) },
  } };
}

/** Merge newly opened reports: a file of the same report replaces the earlier one. */
export function mergeReports(current: ReportView[], added: ReportView[]): ReportView[] {
  const map = new Map(current.map((view) => [view.key, view]));
  for (const view of added) map.set(view.key, view);
  const order = ["validate", "qc-pre", "qc-post", "ghost-check-preview", "ghost-check"];
  return [...map.values()].sort((a, b) => {
    const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length);
    return rank(a.key) - rank(b.key) || a.key.localeCompare(b.key);
  });
}
