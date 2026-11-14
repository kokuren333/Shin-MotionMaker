import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import JSZip from "jszip";
import {
  explainerAxes,
  explainerAxesForContext,
  explainerCandidates,
  explainerQualityChecklist,
  explainerStyles,
  formatExplainerCandidate,
  scriptStats,
  type ExplainerContext,
} from "../src/core/assist/explainer-assist.ts";
import {
  createBrief, createProject, defaults, generateJob, agentPromptFor,
  explainerDesignDefaults, modeSettingsFor, switchStyleMode, switchVideoMode, validateForm,
  type MotionForm, type StyleMode, type TemplateFiles,
} from "../src/core/index.ts";

test("explainer directions have six varied axes and deterministic candidates differing on every active axis", () => {
  assert.equal(explainerAxes.length, 6);
  for (const axis of explainerAxes) assert.ok(axis.options.length >= 6);
  for (const style of Object.values(explainerStyles)) assert.ok(style.options.length >= 6);
  for (const context of [
    {}, { characterMode: "duo" }, { characterUsage: "none" },
    { width: 1080, height: 1920 },
  ] satisfies ExplainerContext[]) {
    for (let seed = 0; seed < 60; seed++) {
      const candidates = explainerCandidates(seed, 3, context);
      assert.deepEqual(candidates, explainerCandidates(seed, 3, context));
      assert.notDeepEqual(candidates, explainerCandidates(seed + 1, 3, context));
      for (const axis of explainerAxesForContext(context)) {
        assert.equal(new Set(candidates.map((candidate) => candidate[axis.key])).size, 3, `${seed}: ${axis.key}`);
      }
    }
  }
  assert.match(formatExplainerCandidate(explainerCandidates(7)[0]), /固定の正解ではなく、取捨選択/);
});

test("character roles switch with solo, duo and no-character contexts; portrait excludes biim and mixed", () => {
  const solo = explainerAxesForContext().find((axis) => axis.key === "character")!;
  const duo = explainerAxesForContext({ characterMode: "duo" }).find((axis) => axis.key === "character")!;
  assert.notDeepEqual(solo.options, duo.options);
  for (const candidate of explainerCandidates(4, 3, { characterMode: "duo" })) assert.ok(duo.options.includes(candidate.character));
  for (const candidate of explainerCandidates(4)) assert.ok(solo.options.includes(candidate.character));
  assert.equal(explainerAxesForContext({ characterUsage: "none" }).length, 5);
  for (const candidate of explainerCandidates(4, 3, { characterUsage: "none" })) assert.equal(candidate.character, undefined);
  for (let seed = 0; seed < 400; seed++) {
    assert.ok(explainerCandidates(seed, 3, { width: 1080, height: 1920 }).every((candidate) => ["anime", "motion"].includes(candidate.styleMode)));
  }
});

test("400 seeds give each style mode at least 15 percent of all candidates", () => {
  const counts = { biim: 0, anime: 0, motion: 0, mixed: 0 };
  const first = { ...counts };
  for (let seed = 0; seed < 400; seed++) {
    const candidates = explainerCandidates(seed);
    first[candidates[0].styleMode]++;
    for (const candidate of candidates) counts[candidate.styleMode]++;
  }
  for (const mode of Object.keys(counts) as (keyof typeof counts)[]) {
    assert.ok(counts[mode] >= 1200 * 0.15, JSON.stringify(counts));
    assert.ok(first[mode] >= 400 * 0.15, JSON.stringify(first));
  }
  console.log("400 seed style distribution:", JSON.stringify(counts), "first candidates:", JSON.stringify(first));
});

test("script stats count characters, speech estimate, headings, blocks, sentences and evidence hints", () => {
  const project = createProject(defaults, { sources: [] });
  const stats = scriptStats("## 導入\n\n雨は2倍。短い！\n\nx = 3", { project });
  assert.equal(stats.characters, 15);
  assert.equal(stats.estimatedSeconds, 2.5);
  assert.equal(stats.headings, 1);
  assert.equal(stats.blocks, 3);
  assert.equal(stats.longestSentence, 5);
  assert.equal(stats.overCapacitySentences, 0);
  assert.equal(stats.numericLines, 2);
  assert.equal(scriptStats("あ".repeat(60), { project, speed: 2 }).estimatedSeconds, 5);
  assert.deepEqual(scriptStats("", { project }), {
    characters: 0, estimatedSeconds: 0, headings: 0, blocks: 0,
    longestSentence: 0, overCapacitySentences: 0, numericLines: 0,
    captionBoxes: stats.captionBoxes,
  });
});

test("script stats share caption geometry, halfwidth handling and explicit line fit with the runtime", () => {
  const project = createProject(defaults, { sources: [] });
  assert.deepEqual(scriptStats("", { project }).captionBoxes.map((box) => box.capacity), [46, 32]);
  assert.equal(scriptStats("あ".repeat(33) + "。", { project }).overCapacitySentences, 1);
  assert.equal(scriptStats("A".repeat(64), { project }).overCapacitySentences, 0);
  assert.equal(scriptStats("A".repeat(65), { project }).overCapacitySentences, 1);
  assert.equal(scriptStats("あ\nい", { project }).overCapacitySentences, 1);
  const portrait = createProject({ ...defaults, width: 1080, height: 1920 }, { sources: [] });
  assert.deepEqual(scriptStats("", { project: portrait }).captionBoxes.map((box) => box.capacity), [34]);
  assert.equal(scriptStats("あ".repeat(34), { project: portrait }).overCapacitySentences, 0);
});

test("all 23 shared failure descriptions also exist in the imported T3 agent harness", async () => {
  const agents = await fs.readFile("job-template/AGENTS.md", "utf8");
  assert.equal(explainerQualityChecklist.length, 23);
  for (const item of explainerQualityChecklist) assert.ok(agents.includes(item), item);
});

const form: MotionForm = {
  ...defaults, title: "虹のしくみ", description: "光の分散を説明する", audience: "中高生",
  takeaway: "太陽の反対側に虹が見える理由を言える", priorKnowledge: "光は直進する。雨粒の色が虹になるという誤解。",
  outline: "## 問い\r\n\r\n虹はなぜ見える？\r\n雨粒の中で光が曲がる。\n42度の方向を確かめる。\n",
  differentiation: "MV用のメモ", explainerDifferentiation: "前作のチャート中心から、光の経路を育てる図へ",
};
const empty = { sources: [] };
let templatesPromise: Promise<TemplateFiles> | undefined;
function loadTemplates() {
  return templatesPromise ??= (async () => {
    const templates: TemplateFiles = {};
    async function walk(directory: string) {
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) await walk(file);
        else templates[path.relative("job-template", file).replaceAll("\\", "/")] = new Uint8Array(await fs.readFile(file));
      }
    }
    await walk("job-template");
    for (const name of ["NotoSansJP-Variable.ttf", "MPLUSRounded1c-ExtraBold.ttf"])
      templates[`assets/fonts/${name}`] = new Uint8Array(await fs.readFile(`job-assets/fonts/${name}`));
    return templates;
  })();
}

test("explainer style switches change only unedited defaults and preserve mode-specific inputs", () => {
  assert.equal(defaults.design, explainerDesignDefaults.biim);
  for (const mode of ["biim", "anime", "motion", "mixed"] as StyleMode[]) {
    const switched = switchStyleMode(form, mode);
    assert.equal(switched.styleMode, mode);
    assert.equal(switched.design, explainerDesignDefaults[mode]);
    assert.equal(switched.biimUsage, form.biimUsage);
    assert.equal(switched.fullScreen, form.fullScreen);
    assert.equal(switchStyleMode({ ...form, design: "独自の図解" }, mode).design, "独自の図解");
    const mv = switchVideoMode(switched, "mv");
    assert.equal(mv.explainerDifferentiation, form.explainerDifferentiation);
    assert.equal(mv.differentiation, form.differentiation);
    assert.equal(switchVideoMode(mv, "explanation").design, explainerDesignDefaults[mode]);
    assert.deepEqual(switchVideoMode(mv, "explanation", modeSettingsFor(switched)), switched);
  }
});

test("style validation keeps optional fields optional and rejects incompatible mixed settings", () => {
  assert.equal(validateForm(defaults).length, 3);
  assert.ok(validateForm({ ...form, styleMode: "invalid" as StyleMode }).includes("様式モードが不正です。"));
  assert.ok(validateForm({ ...form, styleMode: "mixed", width: 1080, height: 1920 }).includes("縦向きの出力ではBiim枠を置けないため、様式「混在」は選べません。横向きにするか、別の様式を選んでください。"));
  for (const settings of [{ fullScreen: true }, { biimUsage: "never" as const }])
    assert.ok(validateForm({ ...form, styleMode: "mixed", ...settings }).includes("様式「混在」ではBiim区間が必要なため、全画面モードとBiim使用率「使わない」は選べません。"));
  assert.deepEqual(validateForm({ ...form, width: 1080, height: 1920 }), []);
  const music = { name: "song.wav", data: new Uint8Array([1]), size: 1, type: "audio/wav" };
  assert.deepEqual(validateForm({ ...switchVideoMode(form, "mv"), styleMode: "invalid" as StyleMode, musicDurationSec: 20 }, { sources: [], music }), []);
});

test("explainer ZIPs carry goals, exact outline, independent differentiation, style and full production guidance", async () => {
  const templates = await loadTemplates();
  const forbidden = /note_top|note_bottom|BiimScene|BiimOverlay|biim-standard|biim_usage|Biim枠|Biimレイアウト|Biim使用率/;
  for (const mode of ["biim", "anime", "motion", "mixed"] as StyleMode[]) {
    const selected = switchStyleMode(form, mode);
    const job = await generateJob(selected, empty, templates);
    const zip = await JSZip.loadAsync(job.data);
    const prefix = `${form.title}/`;
    const project = JSON.parse(await zip.file(`${prefix}project.json`)!.async("string"));
    const brief = await zip.file(`${prefix}brief.md`)!.async("string");
    assert.equal(project.schema_version, "0.5");
    assert.equal(project.direction.takeaway, form.takeaway);
    assert.equal(project.direction.prior_knowledge, form.priorKnowledge);
    assert.equal(project.direction.outline, form.outline);
    assert.equal(project.direction.differentiation, form.explainerDifferentiation);
    assert.equal(project.direction.style_mode, mode);
    assert.deepEqual(project.scenes, []);
    assert.equal(await zip.file(`${prefix}plan/outline.txt`)!.async("string"), form.outline);
    for (const input of [form.takeaway, form.priorKnowledge, form.outline, form.explainerDifferentiation]) assert.ok(brief.includes(input));
    for (const phrase of ["理解先的設計", "何を理解させるかが先", "方向性を3案", "3軸以上", "事前ゲート", "事後ゲート", "npm run qc -- --stage=pre", "npm run qc -- --stage=post", "推定読み上げ", "目安", "reports/qc-review.md", "免除はオーナーだけ", "検出件数", "助言", "plan/explanation-map.md", "plan/evidence.json", "plan/storyboard.md", "reports/delivery.md", "出典リスト", "チャプター"])
      assert.ok(brief.includes(phrase), `${mode}: ${phrase}`);
    for (const item of explainerQualityChecklist) assert.ok(brief.includes(item));
    assert.equal(zip.file(`${prefix}plan/lyrics.txt`), null);
    const prompt = agentPromptFor("explanation", mode);
    const stages = ["理解先的設計", "方向性を3案", "スタイル定義", "台本と根拠台帳", "npm run qc -- --stage=pre", "Remotion", "preview", "npm run qc -- --stage=post"];
    let previous = -1;
    for (const stage of stages) { const index = prompt.indexOf(stage); assert.ok(index > previous, stage); previous = index; }
    assert.ok(prompt.includes(`様式モードは${mode}`));
    assert.ok(prompt.includes("previewが出たらruntimeでnpm run ghost-check -- --target=previewを実行し、孤立フラッシュ（ゴースト嫌疑）をreports/ghost-stills/の静止画で確認して、問題があれば直してからfinalへ進んでください。final後もnpm run ghost-checkで同じ検査を行ってください。"));
    if (mode === "anime" || mode === "motion") {
      assert.equal(project.layout.mode, "fullscreen");
      assert.equal(project.direction.biim_usage, "never");
      assert.doesNotMatch(brief, forbidden);
      assert.doesNotMatch(createBrief(selected, empty), forbidden);
      assert.doesNotMatch(prompt, forbidden);
      assert.ok(brief.includes("FullscreenStage"));
    }
    if (mode === "mixed") {
      assert.equal(project.layout.mode, "biim");
      assert.match(brief, /scenes\[\]\.style/);
      assert.match(brief, /biim: false/);
    }
  }
  const blank = await generateJob({ ...form, outline: " \r\n " }, empty, templates);
  assert.equal((await JSZip.loadAsync(blank.data)).file(`${form.title}/plan/outline.txt`), null);
});
