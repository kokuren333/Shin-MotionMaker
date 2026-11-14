import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildJobFiles, candidatesFor, defaults, directionCandidates, explainerCandidates, mimeTypeFor,
  parseInspectionReport, validateRequest, type SmmError,
} from "../src/core/index.ts";
import { loadTemplates } from "./helpers/templates.ts";

const minimal = { title: "自由な映像", description: "カタログ外の表現を使う", audience: "一般" };

test("request phases keep shape separate from upstream form and attachment validation", () => {
  assert.equal(validateRequest({ form: {} }, { phase: "shape" }).ok, true);
  const result = validateRequest({ form: {} }, { phase: "complete", assets: { sources: [] } });
  assert.ok(!result.ok);
  assert.equal(result.error.code, "E_FORM_INVALID");
  assert.deepEqual(result.error.details, ["動画タイトルを入力してください。", "何を説明する動画かを入力してください。", "対象視聴者を入力してください。"]);
  const shaped = validateRequest({ form: { ...minimal, secondCharacter: { name: "第二演者" } }, assets: { music: null } }, { phase: "shape" });
  assert.ok(shaped.ok);
  assert.deepEqual(shaped.value.form.secondCharacter, { ...defaults.secondCharacter, name: "第二演者" });
  shaped.value.form.secondCharacter.name = "changed";
  assert.equal(defaults.secondCharacter.name, "");
  for (const form of [{ durationSec: Infinity }, { musicDurationSec: NaN }, { secondCharacter: [] }, { fullScreen: 1 }]) {
    const invalid = validateRequest({ form: { ...minimal, ...form } }, { phase: "shape" });
    assert.ok(!invalid.ok);
    assert.equal(invalid.error.code, "E_INPUT_INVALID");
    assert.ok(Array.isArray(invalid.error.details));
  }
  const unknown = validateRequest({ form: { ...minimal, "a/b~c": "x" } }, { phase: "shape" });
  assert.ok(!unknown.ok);
  assert.deepEqual(unknown.error.details, [{ pointer: "/form/a~1b~0c", reason: "未知のキーです。" }]);
});

test("free text remains unrestricted and MIME types follow the upstream extension table", () => {
  const form = { ...minimal, design: "未知の演出／#自由形式\nWebUIの制約によらない", instructions: "自由な文章", outline: "\r\n", differentiation: "自由" };
  const result = validateRequest({ form }, { phase: "complete", assets: { sources: [] } });
  assert.ok(result.ok);
  for (const key of ["design", "instructions", "outline", "differentiation"] as const) assert.equal(result.value.form[key], form[key]);
  for (const [name, type] of [["document.MD", "text/markdown"], ["data.csv", "text/csv"], ["x.PDF", "application/pdf"],
    ["image.png", "image/png"], ["music.M4A", "audio/mp4"], ["no-extension", "application/octet-stream"],
    ["unknown.zzz", "application/octet-stream"], ["folder.pdf/unknown", "application/octet-stream"]]) assert.equal(mimeTypeFor(name), type);
});

test("buildJobFiles shares exclusions and produces structured errors for invalid input or paths", async () => {
  const templates = await loadTemplates();
  const form = { ...defaults, ...minimal };
  const job = await buildJobFiles(form, { sources: [] }, { ...templates,
    ".hidden": "hidden", "runtime/.hidden/deep": "hidden", "runtime/node_modules/pkg/a.js": "hidden" });
  for (const key of Object.keys(job.files)) assert.ok(!key.includes(".hidden") && !key.includes("node_modules"));
  for (const name of ["/absolute", "C:/absolute", "a//b", "a/../b", "a/./b", "a\\b", "", "bad\0file"])
    await assert.rejects(buildJobFiles(form, { sources: [] }, { ...templates, [name]: "bad" }), (error: SmmError) => error.code === "E_INTERNAL" && !!error.hint);
  await assert.rejects(buildJobFiles(form, { sources: [] }, {}), (error: SmmError) => error.code === "E_INTERNAL" && !!error.hint);
  await assert.rejects(buildJobFiles(defaults, { sources: [] }, templates), (error: SmmError) => error.code === "E_FORM_INVALID" && Array.isArray(error.details));
});

test("candidate seeds reproduce both modes, vary when omitted, and copy only existing context", () => {
  const seeds = new Set<number>();
  for (const mode of ["explanation", "mv"] as const) for (let index = 0; index < 6; index++) {
    const actual = candidatesFor({ mode, characters: "none", orientation: "portrait" });
    seeds.add(actual.seed);
    assert.deepEqual(actual, candidatesFor({ mode, characters: "none", orientation: "portrait", seed: actual.seed }));
    assert.match(actual.message, /たたき台であり固定の正解ではない/);
    if (mode === "explanation") {
      assert.ok(actual.axes.every((axis) => axis.key !== "character"));
      assert.ok(actual.candidates.every((candidate) => ["anime", "motion"].includes(candidate.styleMode)));
    } else assert.ok(actual.notes.length);
  }
  assert.ok(seeds.size > 1);
  assert.deepEqual(directionCandidates(7), directionCandidates(7));
  assert.deepEqual(explainerCandidates(7), explainerCandidates(7));
  assert.ok(new Set(Array.from({ length: 8 }, () => JSON.stringify(directionCandidates()))).size > 1);
  assert.ok(new Set(Array.from({ length: 8 }, () => JSON.stringify(explainerCandidates()))).size > 1);
  for (const count of [0, 21, 1.5, NaN]) assert.throws(() => candidatesFor({ mode: "mv", count }), (error: SmmError) => error.code === "E_INPUT_INVALID");
});

test("inspection parsing preserves gate verdicts and keeps ghost or missing images as advice", () => {
  const ghost = parseInspectionReport("ghost-check", JSON.stringify({ kind: "biim-ghost-check", video: "output/final.mp4", counts: { isolated: 100, clusteredRuns: 2 } }));
  assert.ok(ghost.ok);
  assert.equal(ghost.value.verdict, undefined);
  assert.equal(ghost.value.advisories[0].id, "ghost-count");
  const image = parseInspectionReport("imagegen", JSON.stringify({ assets: [{ status: "ok", name: "ok" }, { status: "skipped", reason: "未生成" }] }));
  assert.ok(image.ok);
  assert.equal(image.value.verdict, undefined);
  assert.equal(image.value.advisories.length, 1);
  const qc = parseInspectionReport("qc", JSON.stringify({ kind: "biim-explainer-qc", verdict: "fail", gates: [], advisories: [{ id: "subjective", scope: "all", detail: "演出を再検討", scene_ids: ["s1"] }] }));
  assert.ok(qc.ok);
  assert.equal(qc.value.verdict, "fail");
  assert.deepEqual(qc.value.advisories, [{ id: "subjective", source: "qc", message: "演出を再検討", details: { scope: "all", scene_ids: ["s1"] } }]);
  for (const kind of ["qc", "validate", "ghost-check", "imagegen"] as const)
    for (const text of ["broken", "null", "[]", '{"wrong":true}']) assert.equal(parseInspectionReport(kind, text).ok, false);
});
