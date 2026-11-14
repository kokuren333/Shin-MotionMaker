// GU-05 / PH-03: reports are read by core, gates and advisories stay apart, ghost counts
// never become a gate, run status and gate verdict are separate.
import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyReport, mergeReports, verdictLabel } from "../src/lib/inspection.ts";
import { ghostPreview, qcPre, runRecord, validateReport } from "../e2e/fixtures.mjs";

const view = (file: string, value: unknown) => {
  const result = classifyReport(file, JSON.stringify(value));
  assert.ok(result.ok, !result.ok ? result.message : "");
  return result.view;
};

test("QC: verdict from the report, review_mode and waivers explicit, advisories separate", () => {
  const qc = view("qc-pre.json", qcPre);
  assert.equal(qc.key, "qc-pre");
  assert.equal(qc.gate?.verdict, "fail");
  assert.equal(qc.gate?.reviewMode, "self");
  assert.deepEqual(qc.gate?.waivers, [{ gateId: "PRE-3", reason: qcPre.waivers[0].reason }]);
  assert.deepEqual(qc.gate?.rows.map((row) => row.statusLabel), ["合格", "不合格", "免除", "対象外"]);
  assert.deepEqual(qc.advisories.map((advice) => advice.id), ["ADV-REVIEW-1", "ADV-PRE-4"]);
  assert.ok(qc.advisories.every((advice) => advice.source === "qc"));
  const post = view("whatever.json", { ...qcPre, stage: "post", verdict: "pass", review_mode: "independent", waivers: [] });
  assert.equal(post.key, "qc-post");
  assert.equal(post.gate?.reviewMode, "independent");
});

test("advisories never change the verdict: a passing QC with many advisories stays pass", () => {
  const advisories = Array.from({ length: 20 }, (_, i) => ({ id: `ADV-${i}`, scope: "all", detail: "主観的な助言" }));
  const qc = view("qc-post.json", { ...qcPre, stage: "post", verdict: "pass", advisories, waivers: [] });
  assert.equal(qc.gate?.verdict, "pass");
  assert.equal(qc.advisories.length, 20);
});

test("validate (R4): checks are gate rows, SKIP lines are advisories", () => {
  const validate = view("validate.json", validateReport);
  assert.equal(validate.gate?.verdict, "pass");
  assert.equal(validate.gate?.rows.length, 2);
  assert.deepEqual(validate.advisories.map((advice) => advice.id), ["validate-skip-1"]);
});

test("ghost-check: counts and the upstream wording are advisories only, never a gate", () => {
  const ghost = view("ghost-check-preview.json", ghostPreview);
  assert.equal(ghost.key, "ghost-check-preview");
  assert.equal(ghost.gate, null);
  assert.ok(ghost.advisories.some((advice) => advice.message.includes("孤立フラッシュ 1 件")));
  assert.equal(ghost.ghost?.stills.length, 2);
  const final = view("ghost-check.json", { ...ghostPreview, video: "output/final.mp4" });
  assert.equal(final.key, "ghost-check");
  const skipped = view("ghost-check.json", { kind: "biim-ghost-check", skipped: "ffmpeg が見つかりません" });
  assert.equal(skipped.gate, null);
  assert.ok(skipped.advisories.some((advice) => advice.id === "ghost-skipped"));
});

test("run.json: run status and gate verdict are separate facts", () => {
  const run = view("run.json", runRecord);
  assert.equal(run.run?.status, "completed");
  assert.equal(run.run?.abnormal, false);
  assert.equal(run.gate?.verdict, "fail", "a completed run may carry a failed gate");
  assert.equal(run.gate?.reviewMode, "self");
  // M4R R2: the embedded QC report is shown with the same gate fields as the report opened directly.
  const direct = view("qc-pre.json", qcPre).gate!;
  assert.deepEqual(run.gate?.waivers, [{ gateId: "PRE-3", reason: qcPre.waivers[0].reason }]);
  assert.deepEqual(run.gate?.waivers, direct.waivers);
  assert.deepEqual(run.gate?.rows, direct.rows);
  assert.deepEqual(run.advisories, view("qc-pre.json", qcPre).advisories);
  const independent = view("run.json", { ...runRecord, result: { ...runRecord.result, verdict: "pass",
    report: { ...qcPre, verdict: "pass", review_mode: "independent", waivers: [] } } });
  assert.equal(independent.gate?.verdict, "pass");
  assert.equal(independent.gate?.reviewMode, "independent");
  assert.deepEqual(independent.gate?.waivers, []);
  const lost = view("run.json", { ...runRecord, status: "lost", result: undefined,
    error: { code: "E_RUN_LOST", message: "消失", hint: "再実行" } });
  assert.equal(lost.run?.abnormal, true);
  assert.equal(lost.gate, null);
  assert.equal(lost.run?.error?.code, "E_RUN_LOST");
});

test("unknown or broken files are reported, not guessed", () => {
  for (const body of ["{", "[]", JSON.stringify({ kind: "something" }), JSON.stringify({ schema: "smm.run/1" }),
    JSON.stringify({ kind: "biim-explainer-qc", verdict: "maybe", gates: [], advisories: [] })]) {
    const result = classifyReport("x.json", body);
    assert.equal(result.ok, false, body);
  }
});

test("mergeReports replaces the same report and keeps a stable order", () => {
  const first = view("qc-pre.json", qcPre);
  const again = view("qc-pre.json", { ...qcPre, verdict: "pass" });
  const merged = mergeReports([first], [view("ghost-check-preview.json", ghostPreview), view("validate.json", validateReport), again]);
  assert.deepEqual(merged.map((entry) => entry.key), ["validate", "qc-pre", "ghost-check-preview"]);
  assert.equal(merged[1].gate?.verdict, "pass");
  assert.equal(verdictLabel("not_applicable"), "対象外");
});
