import fs from "node:fs/promises";
import { parseInspectionReport, type JsonObject } from "../core/index.ts";
import type { CheckFact, FileFact, HostContext, JobStatus } from "./types.ts";
import { jobFile, readProjectFile, resolveJob, readJobBytes } from "./paths.ts";
import { isMissing } from "./errors.ts";
import { sha256 } from "./io.ts";
import { hasRuntimeDependencies } from "./tools.ts";
import { listRuns } from "./runs.ts";

async function fileFact(job: string, relative: string): Promise<FileFact> {
  try { const stat = await fs.stat(await jobFile(job, relative)); return { path: relative, exists: true, bytes: stat.size, modified_at: stat.mtime.toISOString() }; }
  catch (error) { if (!isMissing(error)) throw error; return { path: relative, exists: false, bytes: null, modified_at: null }; }
}
export async function deriveJobStatus(context: HostContext, relative: string): Promise<JobStatus> {
  const job = await resolveJob(context, relative);
  const { project } = await readProjectFile(job);
  const mv = project.mode === "mv";
  const records = ["plan/direction.md", "plan/storyboard.md", "plan/sources.md", "reports/visual-qa.md", "reports/delivery.md",
    ...(mv ? ["plan/music-analysis.md"] : ["plan/script.md", "plan/explanation-map.md", "plan/evidence.json", "plan/narration.json", "reports/qc-review.md", "assets/audio/narration.json", "reports/ghost-check-preview.json", "reports/ghost-check.json"])];
  const checks: CheckFact[] = [];
  for (const kind of ["validate", "qc-pre", "qc-post", "ghost-check", "ghost-check-preview"] as const) {
    if (mv && kind.startsWith("qc-")) { checks.push({ kind: kind as "qc-pre" | "qc-post", available: false, verdict: "not_applicable" }); continue; }
    let report: JsonObject;
    try {
      const raw: unknown = JSON.parse((await readJobBytes(job, `reports/${kind}.json`)).toString("utf8"));
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error();
      report = raw as JsonObject;
    } catch (error) {
      if (error instanceof SyntaxError || isMissing(error) || error instanceof Error && !('code' in error)) { checks.push({ kind, available: false }); continue; }
      throw error;
    }
    const parsed = parseInspectionReport(kind.startsWith("qc-") ? "qc" : kind.startsWith("ghost-check") ? "ghost-check" : "validate", JSON.stringify(report));
    if (!parsed.ok) { checks.push({ kind, available: false }); continue; }
    if (kind === "ghost-check" || kind === "ghost-check-preview") { checks.push({ kind, available: true, summary: report }); continue; }
    const fact: CheckFact = { kind, available: true, summary: report };
    if (["pass", "fail", "not_applicable"].includes(String(report.verdict))) fact.verdict = report.verdict as "pass" | "fail" | "not_applicable";
    if (kind.startsWith("qc-")) {
      if (typeof report.review_mode === "string") fact.review_mode = report.review_mode;
      fact.has_waiver = Array.isArray(report.waivers) && report.waivers.length > 0;
      fact.stale = false;
      if (report.inputs && typeof report.inputs === "object" && !Array.isArray(report.inputs)) for (const [name, previous] of Object.entries(report.inputs)) {
        let current: string | null = null;
        try { current = sha256(await readJobBytes(job, name)); }
        catch { fact.stale = true; }
        if (current !== previous) fact.stale = true;
      }
    }
    checks.push(fact);
  }
  const runs = await listRuns(context, relative);
  return {
    job: { title: String(project.title ?? ""), mode: mv ? "mv" : "explanation", style_mode: mv ? null : ((project.direction as JsonObject | undefined)?.style_mode ?? "biim") as "biim" | "anime" | "motion" | "mixed",
      schema_version: String(project.schema_version ?? ""), generator: project.generator && typeof project.generator === "object" ? project.generator as JsonObject : null },
    deps: { installed: await hasRuntimeDependencies(job) }, records: await Promise.all(records.map((name) => fileFact(job, name))),
    scenes: Array.isArray(project.scenes) ? project.scenes.length : 0,
    outputs: await Promise.all(["output/preview.mp4", "output/final.mp4"].map((name) => fileFact(job, name))), checks,
    runs: [...runs.filter((run) => run.status === "running"), ...runs.filter((run) => run.status !== "running").slice(0, 20)], hints: [{ operation: "project_get", input: { job: relative }, note: "設定の確認に利用できます。工程の順序を強制するものではありません。" }],
  };
}
