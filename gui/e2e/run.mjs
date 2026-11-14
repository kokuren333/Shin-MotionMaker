// GUI end-to-end suite (TS-08). Builds the Pages site into a temporary folder, serves it
// under /Shin-MotionMaker/ and drives a headless browser. Every GU-02 item has a test
// named "GU-02 ..." (the table in docs/work/M4/REPORT.md maps items to these names).
// Run: node --experimental-strip-types e2e/run.mjs [--only=substring] [--keep]
// Version control is never consulted: the build gets an explicit commit.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import {
  buildJobFiles, defaults, explainerQualityChecklist, formChoices, mvQualityChecklist, validateRequest,
  agentPromptFor, aivisStyleLabel, explainerStyles, mvDesign, switchStyleMode,
} from "../../src/core/index.ts";
import { loadAssets, loadTemplates } from "../../tests/helpers/templates.ts";
import { compareEntrances } from "../../tests/helpers/entrances.ts";
import { buildSite } from "../scripts/site.mjs";
import { launchBrowser, openPage, serve, sleep } from "./browser.mjs";
import { MV_INPUT, asset, baselineAssets, qcPre, writeReportFixtures } from "./fixtures.mjs";
import {
  byAria, byLabel, byPlaceholder, chooseMode, count, exportRequest, fillByLabel, fillByPlaceholder,
  fillConcept, fillMv, horizontalOverflow, tag, text,
} from "./app.mjs";

const args = process.argv.slice(2);
const only = args.find((arg) => arg.startsWith("--only="))?.slice(7);
const keep = args.includes("--keep");
const COMMIT = "e2e0000000000000000000000000000000000000";
const work = fs.mkdtempSync(path.join(os.tmpdir(), "smm-e2e-"));
const dist = path.join(work, "site");
const downloads = path.join(work, "downloads");
const reports = writeReportFixtures(path.join(work, "job"));
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ---------------------------------------------------------------- GU-15 / GU-14
test("GU-15 sub-path: the Pages build loads every asset relative to /Shin-MotionMaker/", async ({ page, site }) => {
  await page.settle();
  assert.deepEqual(page.failedRequests, []);
  assert.deepEqual(page.consoleErrors, []);
  const outside = site.requests.filter((pathname) => !pathname.startsWith("/Shin-MotionMaker/") && pathname !== "/favicon.ico");
  assert.deepEqual(outside, [], "no request may escape the sub-path");
  assert.equal(await page.evaluate("document.title"), "Shin-MotionMaker");
  const icons = await page.evaluate("[...document.images].filter((img) => img.classList.contains('ico')).map((img) => [img.getAttribute('src'), img.naturalWidth])");
  assert.ok(icons.length > 5);
  for (const [src, width] of icons) {
    assert.ok(src.startsWith("./icons/"), src);
    assert.equal(width, 16, src);
  }
  const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  assert.ok(!/(?:src|href)="\/(?!\/)/.test(html), "index.html uses relative references only");
});

test("GU-14 version.json and the information dialog show the same version and commit", async ({ page, site }) => {
  const stamp = await page.evaluate(`fetch("./version.json", { cache: "no-store" }).then((r) => r.json())`);
  assert.equal(stamp.commit, COMMIT);
  assert.equal(stamp.version, defaultsVersion.version);
  assert.equal(stamp.template_version, defaultsVersion.template_version);
  assert.ok(!Number.isNaN(Date.parse(stamp.built_at)));
  await page.clickText(".about-button", "Shin-MotionMaker について");
  await page.waitFor("document.querySelector('dialog[open]')", "dialog");
  assert.equal(await text(page, "dialog [data-commit]"), COMMIT);
  const dialog = await text(page, "dialog");
  assert.ok(dialog.includes(stamp.version) && dialog.includes(stamp.built_at));
  void site;
});

// ---------------------------------------------------------------- GU-02 items
test("GU-02 制作モードの切り替えとモード別の指示・デザイン文の保持", async ({ page }) => {
  const instructions = await byPlaceholder(page, "必ず扱いたい内容");
  await page.fill(instructions, "解説の指示");
  await page.fill(await byPlaceholder(page, "配色、タイポグラフィ"), "解説のデザイン");
  await chooseMode(page, "mv");
  assert.equal(await page.evaluate(`document.querySelector('${await byPlaceholder(page, "配色、タイポグラフィ")}').value`), mvDesign);
  await page.fill(await byPlaceholder(page, "必ず扱いたい内容"), "MVの指示");
  await chooseMode(page, "explanation");
  assert.equal(await page.evaluate(`document.querySelector('${await byPlaceholder(page, "必ず扱いたい内容")}').value`), "解説の指示");
  assert.equal(await page.evaluate(`document.querySelector('${await byPlaceholder(page, "配色、タイポグラフィ")}').value`), "解説のデザイン");
  await chooseMode(page, "mv");
  assert.equal(await page.evaluate(`document.querySelector('${await byPlaceholder(page, "必ず扱いたい内容")}').value`), "MVの指示");
  // M4R T1: an edited MV design survives a round trip through the explanation mode too.
  await page.fill(await byPlaceholder(page, "配色、タイポグラフィ"), "MVのデザイン（編集）");
  await chooseMode(page, "explanation");
  assert.equal(await page.evaluate(`document.querySelector('${await byPlaceholder(page, "配色、タイポグラフィ")}').value`), "解説のデザイン");
  await chooseMode(page, "mv");
  assert.equal(await page.evaluate(`document.querySelector('${await byPlaceholder(page, "配色、タイポグラフィ")}').value`), "MVのデザイン（編集）");
  assert.equal((await exportRequest(page)).request.form.design, "MVのデザイン（編集）");
});

test("GU-02 様式モードの選択（4様式を同格のラジオで並べ、縦向きでは混在を選べない）", async ({ page }) => {
  const cards = await page.evaluate("[...document.querySelectorAll('.style-card')].map((card) => [card.querySelector('input').value, card.className, card.querySelector('img.ico').getAttribute('src')])");
  assert.deepEqual(cards.map(([mode]) => mode), ["biim", "anime", "motion", "mixed"]);
  assert.ok(cards.every(([mode, , src]) => src.endsWith(`style-${mode}.png`)));
  const widths = await page.evaluate("[...document.querySelectorAll('.style-card')].map((card) => Math.round(card.getBoundingClientRect().width))");
  assert.equal(new Set(widths).size, 1, `equal width: ${widths}`);
  await page.click('input[name="styleMode"][value="anime"]');
  await page.waitFor("[...document.querySelectorAll('.job-specs div')].some((row) => row.textContent.includes('アニメ'))", "様式の反映");
  await fillByLabel(page, "画面の向き", "portrait");
  assert.equal(await page.evaluate(`document.querySelector('input[name="styleMode"][value="mixed"]').disabled`), true);
});

test("GU-02 全入力欄（解説モードの全キーを画面から入力し request.json と一致する）", async ({ page }) => {
  const expected = structuredClone(defaults);
  const set = async (selector, key, value, second = false) => {
    await page.fill(selector, value);
    if (second) expected.secondCharacter[key] = typeof expected.secondCharacter[key] === "number" ? Number(value) : value;
    else expected[key] = typeof defaults[key] === "number" ? Number(value) : value;
  };
  await fillConcept(page, { title: "全項目", description: "説明", audience: "視聴者" });
  Object.assign(expected, { title: "全項目", description: "説明", audience: "視聴者" });
  await set(byAria("希望尺（秒）"), "durationSec", "95");
  await set(await byPlaceholder(page, "視聴後に"), "takeaway", "理解ゴール");
  await set(await byPlaceholder(page, "すでに知っている"), "priorKnowledge", "前提");
  await set(await byPlaceholder(page, "見出しや段落"), "outline", "# 見出し\n本文。");
  await set(await byPlaceholder(page, "https://example.com"), "urls", "https://example.com/a");
  await set(await byPlaceholder(page, "必ず扱いたい内容"), "instructions", "指示");
  await page.click('input[name="styleMode"][value="mixed"]');
  expected.styleMode = "mixed";
  expected.design = (await page.evaluate(`document.querySelector('${await byPlaceholder(page, "配色、タイポグラフィ")}').value`));
  await set(await byPlaceholder(page, "配色、タイポグラフィ"), "design", "デザイン");
  await set(await byPlaceholder(page, "前作と変えたい説明"), "explainerDifferentiation", "差別化");
  // M4R T1: the full-screen switch is a key of its own (it also resets biimUsage, which is set again below).
  await page.click(".layout-switch input");
  expected.fullScreen = !defaults.fullScreen;
  expected.biimUsage = "never";
  await page.clickText(".asset-options label", "画像素材");
  await page.clickText(".asset-options label", "動画生成AI");
  expected.imageGeneration = !defaults.imageGeneration;
  expected.videoGeneration = !defaults.videoGeneration;
  await set(await byLabel(page, "キャラクターモード"), "characterMode", "duo");
  const people = [["characterName", "name"], ["characterReading", "reading"], ["characterRole", "role"],
    ["characterPersonality", "personality"], ["characterSpeakingStyle", "speakingStyle"], ["characterNotes", "notes"]];
  const aria = { name: "名前（表記）", reading: "読み仮名", role: "役割", personality: "性格", speakingStyle: "口調", notes: "動きへの指示" };
  for (const [key, inner] of people) {
    await set(byAria(`1人目の${aria[inner]}`), key, `一${inner}`);
    await set(byAria(`2人目の${aria[inner]}`), inner, `二${inner}`, true);
  }
  await set(byAria("1人目の配置"), "characterPosition", "right");
  await set(byAria("2人目の配置"), "position", "left", true);
  await set(byAria("1人目の字幕色（HEX）"), "subtitleColor", "#123456");
  await set(byAria("2人目の字幕色（HEX）"), "subtitleColor", "#654321", true);
  await set(byAria("1人目のStyle ID"), "styleId", "7");
  await set(byAria("2人目のStyle ID"), "styleId", "8", true);
  await set(byAria("1人目の話速"), "voiceSpeed", "1.25");
  await set(byAria("2人目の話速"), "voiceSpeed", "0.75", true);
  await set(byAria("1人目の声への指示"), "voiceNotes", "声1");
  await set(byAria("2人目の声への指示"), "voiceNotes", "声2", true);
  await set("input[type=url]", "engineUrl", "http://127.0.0.1:10102");
  await page.clickText("#voice label.check-label", "BGM・SE");
  expected.generateAudio = !defaults.generateAudio;
  await set(await byPlaceholder(page, "音の雰囲気"), "audioNotes", "音");
  await set(await byLabel(page, "出力解像度"), "width", "1280x720");
  expected.width = 1280; expected.height = 720;
  await set(await byLabel(page, "フレームレート"), "fps", "60");
  await page.click(".advanced-toggle");
  for (const [title, key, value] of [["テンポ", "tempo", "fast"], ["派手さ", "energy", "bold"],
    ["モーショングラフィックス量", "motionAmount", "rich"], ["Biimレイアウト使用率", "biimUsage", "mostly"],
    ["3Dキャラ登場頻度", "characterUsage", "frequent"], ["根拠資料の扱い", "evidencePolicy", "balanced"]])
    await set(await byLabel(page, title), key, value);
  await set("#advanced-controls textarea", "diagramPolicy", "図解方針");
  await page.clickText("#advanced-controls label.check-label", "追加のWeb調査");
  expected.allowWebResearch = !defaults.allowWebResearch;
  // Voice engine last: choosing "none" hides the Aivis fields filled above.
  await set(await byLabel(page, "音声エンジン"), "voiceEngine", "none");
  const { request } = await exportRequest(page);
  assert.deepEqual(request.form, expected);
  // The MV-only keys are covered by "GU-02 MV の全入力欄".
});

test("GU-02 全入力欄（4様式の反映と全画面の切り替えが request.json・project.json・表示に入る）", async ({ page }) => {
  let previous = defaults;
  for (const mode of Object.keys(explainerStyles)) {
    await page.click(`input[name="styleMode"][value="${mode}"]`);
    await page.waitFor(`document.querySelector('input[name="styleMode"][value="${mode}"]').checked`, mode);
    previous = switchStyleMode(previous, mode);
    const { request } = await exportRequest(page);
    assert.equal(request.form.styleMode, mode);
    assert.equal(request.form.design, previous.design, "the default design follows the style (core switchStyleMode)");
    assert.ok((await text(page, ".job-specs")).includes(explainerStyles[mode].label), mode);
    await page.click("#tab-json");
    assert.equal(JSON.parse(await text(page, ".json-preview")).direction.style_mode, mode);
    const nonBiim = mode === "anime" || mode === "motion";
    assert.equal(await page.evaluate("document.querySelector('.layout-switch input').disabled"), nonBiim, `full-screen switch for ${mode}`);
  }
  await page.click('input[name="styleMode"][value="biim"]');
  await page.waitFor("!document.querySelector('.layout-switch input').disabled", "biim");
  await page.click(".layout-switch input");
  let { request } = await exportRequest(page);
  assert.equal(request.form.fullScreen, true);
  assert.equal(request.form.biimUsage, "never");
  await page.click(".layout-switch input");
  ({ request } = await exportRequest(page));
  assert.equal(request.form.fullScreen, false);
  assert.equal(request.form.biimUsage, "sometimes");
});

test("GU-02 全入力欄（MV の追加キー：曲の雰囲気・歌詞・差別化メモ・音源尺）", async ({ page }) => {
  await fillMv(page);
  await fillByPlaceholder(page, "前作と変えたい点", "MVの差別化");
  const { request } = await exportRequest(page);
  assert.equal(request.form.videoMode, "mv");
  assert.equal(request.form.musicMood, MV_INPUT.musicMood);
  assert.equal(request.form.musicLyrics, MV_INPUT.musicLyrics);
  assert.equal(request.form.differentiation, "MVの差別化");
  assert.equal(request.form.musicDurationSec, 30);
  assert.deepEqual(request.assets, { sources: [], music: "song.wav" });
});

test("GU-02 MV での非表示項目（04・05・詳細を出さず目次は01〜03）", async ({ page }) => {
  assert.equal(await count(page, ".toc a"), 5);
  await chooseMode(page, "mv");
  assert.equal(await count(page, ".toc a"), 3);
  for (const selector of ["#character", "#voice", ".advanced-section", "input[name=styleMode]"])
    assert.equal(await count(page, selector), 0, selector);
});

test("GU-02 参考資料のドラッグ＆ドロップ・選択・削除（件数と容量の表示）", async ({ page }) => {
  await page.setFiles(byAria("参考資料を選択"), [asset("reference.md"), asset("reference.csv")]);
  await page.waitFor("document.querySelectorAll('#sources .attachments li').length === 2", "2件");
  await page.evaluate(`(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["dropped"], "dropped.txt", { type: "text/plain" }));
    const zone = document.querySelector("#sources .dropzone");
    zone.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    zone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  })()`);
  await page.waitFor("document.querySelectorAll('#sources .attachments li').length === 3", "ドロップで3件");
  assert.match(await text(page, ".attachment-count"), /^3件の資料/);
  await page.click(byAria("reference.mdを削除"));
  await page.waitFor("document.querySelectorAll('#sources .attachments li').length === 2", "削除で2件");
  assert.match(await text(page, ".attachment-count"), /^2件の資料 · 0\.\d KB/);
});

test("GU-02 完成音源・BGM・GLB の添付と音源尺の確認", async ({ page }) => {
  await page.setFiles(byAria("BGMを選択"), [asset("song.wav")]);
  await page.setFiles(byAria("1人目の3Dモデルを選択"), [asset("character.glb")]);
  await page.waitFor("[...document.querySelectorAll('#voice .attachments strong')].some((el) => el.textContent === 'song.wav')", "BGM");
  await page.waitFor("[...document.querySelectorAll('#character .attachments strong')].some((el) => el.textContent === 'character.glb')", "GLB");
  await chooseMode(page, "mv");
  await page.setFiles(byAria("MVの完成音源を選択"), [asset("song.wav")]);
  await page.waitFor("document.querySelector('#concept small[role=status]').textContent.includes('30.00秒')", "音源尺 30.00秒");
  assert.ok((await text(page, ".band-status")).includes("30.00秒"));
});

test("GU-02 方向性のたたき台と差別化メモ（両モード、既定で選択せず追記したときだけ入る）", async ({ page }) => {
  for (const mode of ["explanation", "mv"]) {
    await chooseMode(page, mode);
    const design = await byPlaceholder(page, "配色、タイポグラフィ");
    const before = await page.evaluate(`document.querySelector('${design}').value`);
    assert.equal(await count(page, "#direction .candidate-card"), 3);
    assert.ok((await text(page, "#direction .direction-lab")).includes("たたき台"));
    assert.ok(!(await text(page, "#direction .direction-lab")).includes("追記しました"), "nothing preselected");
    const first = await text(page, "#direction .candidate-card dl");
    let changed = false;
    for (let i = 0; i < 5 && !changed; i++) {
      await page.clickText("#direction .direction-lab-heading button", "別の組み合わせ");
      await sleep(30);
      changed = (await text(page, "#direction .candidate-card dl")) !== first;
    }
    assert.ok(changed, "別の組み合わせ redraws");
    assert.equal(await page.evaluate(`document.querySelector('${design}').value`), before, "redraw does not touch the design");
    await page.clickText("#direction .candidate-card button", "この案を追記");
    await page.waitFor("[...document.querySelectorAll('#direction .candidate-card button')].some((b) => b.textContent.includes('追記しました'))", "追記");
    const after = await page.evaluate(`document.querySelector('${design}').value`);
    assert.ok(after.startsWith(before.trim()) && after.length > before.trim().length);
    assert.ok(await byPlaceholder(page, mode === "mv" ? "前作と変えたい点" : "前作と変えたい説明"));
  }
});

test("GU-02 歌詞統計・台本統計", async ({ page }) => {
  await fillByPlaceholder(page, "見出しや段落", "# 導入\n雨上がりに虹が見えるのはなぜでしょう。\n\n# まとめ\n虹は光が分かれて見える現象です。");
  await page.waitFor("document.querySelector('[aria-label=\"構成メモの統計\"]').textContent.includes('見出し 2')", "台本統計");
  await chooseMode(page, "mv");
  await fillByPlaceholder(page, "歌詞を改行", MV_INPUT.musicLyrics);
  await page.waitFor("document.querySelector('[aria-label=\"歌詞の統計\"]')?.textContent.includes('6行')", "歌詞統計");
  assert.ok((await text(page, "[aria-label='歌詞の統計']")).includes("20文字超 1行"));
  assert.ok((await text(page, "[aria-label='歌詞の統計']")).includes("[Verse]"));
});

test("GU-02 準備度一覧（両モード）", async ({ page }) => {
  assert.equal(await count(page, ".readiness li"), 10);
  const initial = await count(page, ".readiness li.done");
  assert.ok(!(await text(page, ".readiness li:first-child")).includes("✓"), "タイトルは未入力");
  await page.clickText(".sample-button", "サンプル");
  await page.waitFor(`document.querySelectorAll('.readiness li.done').length === ${initial} + 3`, "解説の準備度（タイトル・説明目的・視聴者）");
  await chooseMode(page, "mv");
  assert.equal(await count(page, ".readiness li"), 6);
  assert.ok((await text(page, ".readiness")).includes("完成音源"));
});

test("GU-02 素材生成の設定", async ({ page }) => {
  await page.click("#tab-json");
  const before = JSON.parse(await text(page, ".json-preview"));
  await page.clickText(".asset-options label", "画像素材");
  await page.clickText(".asset-options label", "動画生成AI");
  const after = JSON.parse(await text(page, ".json-preview"));
  const section = (project) => JSON.stringify(project).match(/"image":"([^"]+)"/)?.[1];
  assert.notEqual(section(after), section(before), "image generation toggled");
  assert.equal(section(after), defaults.imageGeneration ? "off" : "codex-imagegen");
  assert.ok(JSON.stringify(after).includes(`"video_generation":${!defaults.videoGeneration}`), "video generation toggled");
});

test("GU-02 キャラクター設定と字幕色（1人・2人、配置、HEX、字幕帯への即時反映）", async ({ page }) => {
  assert.equal(await count(page, ".character-card"), 1);
  await fillByLabel(page, "キャラクターモード", "duo");
  await page.waitFor("document.querySelectorAll('.character-card').length === 2", "2人");
  await page.fill(byAria("1人目の字幕色（HEX）"), "#0000ff");
  await page.fill(byAria("2人目の名前（表記）"), "二人目");
  const sample = await page.evaluate("getComputedStyle(document.querySelector('.subtitle-sample')).color");
  assert.equal(sample, "rgb(0, 0, 255)");
  assert.equal(await page.evaluate("document.querySelector('.band-caption').style.getPropertyValue('--caption-color')"), "#0000ff");
  assert.ok((await text(page, ".character-card:nth-of-type(2) legend")).includes("二人目"));
  assert.equal(await count(page, ".schematic-character"), 2);
});

test("GU-02 Aivis 設定（URL・Style ID とプリセット名・話速、音声なしで非表示）", async ({ page }) => {
  assert.equal(await count(page, "input[type=url]"), 1);
  await page.fill("#voice .row input[type=number]", "888753760");
  assert.equal(await text(page, "#voice .row label small"), aivisStyleLabel(888753760));
  await fillByLabel(page, "音声エンジン", "none");
  await page.waitFor("!document.querySelector('input[type=url]')", "Aivis 欄の非表示");
});

test("GU-02 解像度・向き・fps", async ({ page }) => {
  await fillByLabel(page, "画面の向き", "portrait");
  const options = await page.evaluate(`[...document.querySelector('${await byLabel(page, "出力解像度")}').options].map((o) => o.value)`);
  assert.deepEqual(options, ["1080x1920", "720x1280", "2160x3840"]);
  await fillByLabel(page, "フレームレート", "24");
  assert.ok((await text(page, ".job-specs")).includes("1080 × 1920 / 24 fps"));
});

test("GU-02 レイアウト図・同梱ファイル・JSON の表示", async ({ page }) => {
  assert.equal(await count(page, ".video-schematic[role=img]"), 1);
  await page.click("#tab-files");
  assert.ok((await text(page, ".file-tree")).includes("motion-kit/"));
  await page.click("#tab-json");
  const project = JSON.parse(await text(page, ".json-preview"));
  assert.equal(project.generator.name, "shin-motionmaker");
  assert.equal(await page.evaluate("document.querySelector('#tab-json').getAttribute('aria-selected')"), "true");
});

test("GU-02 必須項目のエラー表示とフォーカス移動", async ({ page }) => {
  await page.click(".download-button");
  await page.waitFor("document.querySelector('.errors')", "エラー");
  await page.waitFor("document.activeElement === document.querySelector('.errors')", "フォーカス移動");
  const errors = await text(page, ".errors");
  for (const message of ["動画タイトルを入力してください。", "何を説明する動画かを入力してください。", "対象視聴者を入力してください。"])
    assert.ok(errors.includes(message), message);
});

test("GU-02 ZIP 生成と進捗（AR-06：GUI の ZIP と core＋Node 読みのジョブが同じバイト、解説・添付あり）", async ({ page }) => {
  await page.clickText(".sample-button", "サンプル");
  await fillByLabel(page, "キャラクターモード", "duo");
  await page.setFiles(byAria("参考資料を選択"), ["reference.md", "reference.csv", "reference.pdf", "reference.png"].map(asset));
  await page.setFiles(byAria("1人目の3Dモデルを選択"), [asset("character.glb")]);
  await page.setFiles(byAria("2人目の3Dモデルを選択"), [asset("character.glb")]);
  await page.setFiles(byAria("BGMを選択"), [asset("song.wav")]);
  await page.waitFor("document.querySelector('.band-status.ready')", "書き出せる状態");
  await compareZip(page, true);
});

test("GU-02 ZIP 生成と進捗（AR-06：MV・完成音源あり）", async ({ page }) => {
  await fillMv(page);
  await page.setFiles(byAria("参考資料を選択"), [asset("reference.txt")]);
  await compareZip(page, false);
});

test("GU-02 指示のコピー", async ({ page }) => {
  await page.click(".copy-button");
  await page.waitFor("document.querySelector('.band-actions .copy-status').textContent.length > 0", "コピーの結果");
  assert.equal(await text(page, ".band-actions .copy-status"), "コピーしました");
  const copied = await page.evaluate("navigator.clipboard.readText().catch(() => null)");
  if (copied !== null) assert.equal(copied, agentPromptFor("explanation", "biim"));
});

test("GU-02 失敗パターン一覧（両モード）", async ({ page }) => {
  assert.equal(await count(page, ".quality-checklist li"), explainerQualityChecklist.length);
  await chooseMode(page, "mv");
  assert.equal(await count(page, ".quality-checklist li"), mvQualityChecklist.length);
});

test("GU-02 ゴースト検査結果の読み込みと静止画表示", async ({ page }) => {
  await page.setFiles(byAria("検査結果のJSONと静止画を選択"), [reports.ghostPreview, ...reports.stills]);
  await page.waitFor("document.querySelectorAll('[data-report=\"ghost-check-preview\"] .ghost-still-images img').length === 4", "静止画4枚");
  const card = await text(page, "[data-report='ghost-check-preview']");
  assert.ok(card.includes("孤立 1 件") || card.includes("孤立1 件") || card.includes("1 件"));
  assert.equal(await count(page, "[data-report='ghost-check-preview'] .gate-block"), 0, "ghost counts are never a gate");
});

test("GU-02 サンプル入力", async ({ page }) => {
  await page.clickText(".sample-button", "サンプル");
  await page.waitFor("document.querySelector('#concept input[maxlength=\"200\"]').value === '虹はどうしてできる？'", "サンプル");
  assert.ok(await page.evaluate("document.querySelector('.band-status').classList.contains('ready')"));
});

test("GU-02 情報ダイアログ（同梱物・データの扱い・制作環境・参考元、Escape で閉じる）", async ({ page }) => {
  await page.clickText(".main-footer button", "同梱物とデータの扱い");
  await page.waitFor("document.querySelector('dialog[open]')", "dialog");
  const dialog = await text(page, "dialog");
  for (const heading of ["同梱するもの", "データの扱い", "制作環境と参考元"]) assert.ok(dialog.includes(heading), heading);
  assert.ok(!/Claude|GPT|Codex 6|Opus|Sonnet|Fable/.test(dialog.replace("Codex CLI", "").replace("Codex imagegen", "")), "no fixed model name");
  await page.key("Escape");
  await page.waitFor("!document.querySelector('dialog[open]')", "閉じる");
});

// ---------------------------------------------------------------- GU-04 request.json
test("GU-04 request.json の往復（書き出し→読み込みで同じ入力、添付は名前だけ・選び直しを案内）", async ({ page }) => {
  await page.clickText(".sample-button", "サンプル");
  await fillByPlaceholder(page, "視聴後に", "改行を含む\n理解ゴール");
  await page.setFiles(byAria("参考資料を選択"), [asset("reference.pdf")]);
  const first = await exportRequest(page);
  assert.equal(first.name, "虹はどうしてできる？.request.json");
  assert.deepEqual(first.request.assets, { sources: ["reference.pdf"] });
  const checked = validateRequest(first.request, { phase: "shape" });
  assert.ok(checked.ok, "core accepts the exported shape");
  const file = path.join(work, first.name);
  fs.writeFileSync(file, "﻿" + first.bytes.toString("utf8"));
  await page.goto(page.url);
  await page.waitFor("document.querySelector('.download-button')", "再読み込み");
  await page.setFiles(byAria("request.json を読み込む"), [file]);
  await page.waitFor("document.querySelector('.import-note')", "読み込み");
  assert.ok((await text(page, ".import-note")).includes("reference.pdf"));
  assert.equal(await count(page, "#sources .attachments li"), 0, "attachments are picked again by the user");
  const second = await exportRequest(page);
  assert.deepEqual(second.request.form, first.request.form);
});

test("GU-04 request.json の読み込みは core validateRequest で検査する（未知キー・型の誤り・JSON 不正）", async ({ page }) => {
  const write = (name, body) => { const file = path.join(work, name); fs.writeFileSync(file, body); return file; };
  for (const [file, expected] of [
    [write("unknown.request.json", JSON.stringify({ form: { title: "x", colour: "red" } })), "/form/colour"],
    [write("type.request.json", JSON.stringify({ form: { durationSec: "30" } })), "/form/durationSec"],
    [write("broken.request.json", "{ not json"), "JSON として読み取れません"],
  ]) {
    await page.setFiles(byAria("request.json を読み込む"), [file]);
    await page.waitFor("document.querySelector('.errors')", "エラー");
    assert.ok((await text(page, ".errors")).includes(expected), expected);
    assert.equal(await page.evaluate("document.querySelector('#concept input[maxlength=\"200\"]').value"), "", "form untouched");
    await page.fill("#concept input[maxlength='200']", "");
  }
});

test("GU-04 不正な列挙値の request.json は入力エラーとして表示し、画面と既存の入力・添付を残す（M4R R1）", async ({ page }) => {
  await page.clickText(".sample-button", "サンプル");
  await page.setFiles(byAria("参考資料を選択"), [asset("reference.md")]);
  await page.waitFor("document.querySelectorAll('#sources .attachments li').length === 1", "添付");
  const before = (await exportRequest(page)).request;
  const write = (name, value) => { const file = path.join(work, name); fs.writeFileSync(file, JSON.stringify(value)); return file; };
  for (const [name, form, pointer, label, values] of [
    ["style.request.json", { title: "test", description: "test", audience: "test", styleMode: "unknown" }, "/form/styleMode", "様式モード", formChoices.styleMode.join("、")],
    ["mode.request.json", { title: "test", videoMode: "film" }, "/form/videoMode", "制作モード", formChoices.videoMode.join("、")],
    ["position.request.json", { characterMode: "duo", secondCharacter: { position: "middle" } }, "/form/secondCharacter/position", "2人目のキャラの初期配置", formChoices.secondCharacter.position.join("、")],
  ]) {
    await page.setFiles(byAria("request.json を読み込む"), [write(name, { form })]);
    await page.waitFor(`document.querySelector('.errors')?.textContent.includes(${JSON.stringify(name)})`, "エラー");
    const errors = await text(page, ".errors");
    assert.ok(errors.includes(`${label}（${pointer}）`), errors);
    assert.ok(errors.includes(`request.json に書ける値：${values}`), errors);
    assert.ok(errors.includes("読み込み前の入力と添付はそのままです。"), errors);
    assert.equal(await count(page, "form.studio"), 1, "the screen stays");
    assert.deepEqual(page.consoleErrors, []);
    assert.equal(await count(page, "#sources .attachments li"), 1, "attachments are kept");
    assert.deepEqual((await exportRequest(page)).request, before, "input is kept");
  }
  // The screen keeps working: solo imports an inactive second character position, as upstream does.
  await page.setFiles(byAria("request.json を読み込む"), [write("ok.request.json", { form: {
    title: "読み込み後", styleMode: "anime", characterMode: "solo", secondCharacter: { position: "middle" },
  } })]);
  await page.waitFor("document.querySelector('.import-note')", "読み込み");
  const imported = (await exportRequest(page)).request.form;
  assert.equal(imported.styleMode, "anime");
  assert.equal(imported.characterMode, "solo");
  assert.equal(imported.secondCharacter.position, "middle");
  assert.equal(await count(page, ".errors"), 0, "solo does not reject the inactive position");
  assert.equal(await count(page, "form.studio"), 1, "the screen stays after import");
  assert.deepEqual(page.consoleErrors, []);
});

// ---------------------------------------------------------------- GU-05 inspection results
test("GU-05 検査結果の表示（ゲートと助言を別区画、助言は不合格の色・記号を使わない、self と免除を明示）", async ({ page }) => {
  await page.setFiles(byAria("検査結果のJSONと静止画を選択"), [reports.qcPre, reports.validate, reports.run, reports.broken]);
  await page.waitFor("document.querySelector('[data-report=\"qc-pre\"]') && document.querySelector('[data-report=\"validate\"]')", "検査結果");
  const qc = "[data-report='qc-pre']";
  assert.equal(await page.evaluate(`document.querySelector("${qc} .gate-verdict").dataset.verdict`), "fail");
  assert.equal(await page.evaluate(`document.querySelector("${qc} .review-mode").dataset.reviewMode`), "self");
  assert.ok((await text(page, `${qc} .review-mode`)).includes("自己レビュー"));
  assert.ok((await text(page, `${qc} .waivers`)).includes("PRE-3"));
  assert.ok((await text(page, `${qc} .gate-table`)).includes("免除"));
  // The advice block lives outside the gate block and uses neutral colours and no fail/warn icon.
  assert.equal(await count(page, `${qc} .gate-block .advice-block`), 0);
  assert.ok((await text(page, `${qc} .advice-block`)).includes("ADV-PRE-4"));
  const icons = await page.evaluate(`[...document.querySelectorAll(".advice-block img, .advice img")].map((img) => img.getAttribute("src"))`);
  assert.ok(icons.length > 0 && icons.every((src) => src.endsWith("advisory.png")), icons.join());
  const colours = await page.evaluate(`(() => {
    const style = getComputedStyle(document.documentElement);
    const probe = document.createElement("div"); document.body.append(probe);
    const resolve = (name) => { probe.style.background = "var(" + name + ")"; return getComputedStyle(probe).backgroundColor; };
    const bad = ["--ui-error-bg", "--ui-warn-bg", "--cs-error", "--cs-warn"].map(resolve);
    const blocks = [...document.querySelectorAll(".advice-block")].flatMap((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).borderLeftColor, getComputedStyle(el).color]);
    probe.remove(); void style;
    return { bad, blocks };
  })()`);
  for (const colour of colours.blocks) assert.ok(!colours.bad.includes(colour), `advice uses ${colour}`);
  assert.equal(await page.evaluate(`document.querySelector("[data-report='validate'] .gate-verdict").dataset.verdict`), "pass");
  assert.ok((await text(page, "[data-report='validate'] .advice-block")).includes("SKIP"));
  const run = "[data-report^='run-']";
  assert.equal(await page.evaluate(`document.querySelector("${run} .run-status").dataset.runStatus`), "completed");
  assert.equal(await page.evaluate(`document.querySelector("${run} .gate-verdict").dataset.verdict`), "fail", "completed run with a failed gate");
  assert.ok((await text(page, ".inspection-viewer .inline-error")).includes("not-a-report.json"));
});

test("GU-05 run.json 経由でも QC の免除・review_mode・ゲート行を直接開いた場合と同じ部品で表示する（M4R R2）", async ({ page }) => {
  await page.setFiles(byAria("検査結果のJSONと静止画を選択"), [reports.run]);
  const run = "[data-report^='run-']";
  await page.waitFor(`document.querySelector("${run}")`, "run");
  const waivers = await text(page, `${run} .waivers`);
  assert.ok(waivers.includes("PRE-3") && waivers.includes(qcPre.waivers[0].reason), waivers);
  assert.ok(!waivers.includes("免除：なし"));
  assert.equal(await page.evaluate(`document.querySelector("${run} .review-mode").dataset.reviewMode`), "self");
  await page.setFiles(byAria("検査結果のJSONと静止画を選択"), [reports.qcPre]);
  await page.waitFor(`document.querySelector("[data-report='qc-pre']")`, "qc-pre");
  for (const part of [".waivers", ".review-mode", ".gate-table", ".advice-block ul"])
    assert.equal(await text(page, `${run} ${part}`), await text(page, `[data-report='qc-pre'] ${part}`), part);
  assert.equal(await page.evaluate(`document.querySelector("${run} .run-status").dataset.runStatus`), "completed", "run status stays separate");
});

// ---------------------------------------------------------------- GU-06 / GU-07
test("GU-06 CLI・MCP の区画（現在の入力の generate コマンド例、MCP の登録例、文書へのリンク）", async ({ page }) => {
  await page.fill("#concept input[maxlength='200']", "空白 と&記号");
  const commands = () => page.evaluate("[...document.querySelectorAll('.agent-entrances .command-example')].map((el) => [el.dataset.shell, el.querySelector('.command-shell').textContent, el.querySelector('pre').textContent])");
  let shown = await commands();
  assert.deepEqual(shown.map(([shell]) => shell), ["powershell", "posix"]);
  assert.ok(shown[0][1].includes("PowerShell") && shown[1][1].includes("POSIX"), "each example names its shell");
  assert.deepEqual(shown.map(([, , command]) => command), ["smm generate '空白 と&記号.request.json' --out jobs", "smm generate '空白 と&記号.request.json' --out jobs"]);
  // M4R R3: PowerShell and POSIX quoting differ for ' and both keep $() literal.
  await page.fill("#concept input[maxlength='200']", "$(1+1) it's");
  shown = await commands();
  assert.deepEqual(shown.map(([, , command]) => command), [
    "smm generate '$(1+1) it''s.request.json' --out jobs",
    "smm generate '$(1+1) it'\\''s.request.json' --out jobs",
  ]);
  const registration = JSON.parse(await text(page, ".agent-entrances [aria-label='MCP の登録例']"));
  assert.deepEqual(registration.mcpServers["shin-motionmaker"].args.slice(0, 3), ["mcp", "serve", "--root"]);
  const links = await page.evaluate("[...document.querySelectorAll('.agent-entrances .doc-links a')].map((a) => a.href)");
  assert.ok(links.some((href) => href.endsWith("docs/CLI.md")) && links.some((href) => href.endsWith("docs/MCP.md")));
});

test("GU-07 たたき台：seed を固定しない（開き直すたびに別の3案）", async ({ browser, site }) => {
  const seen = new Set();
  for (let i = 0; i < 3; i++) {
    const page = await openPage(browser.cdp, site.url);
    seen.add(await text(page, "#direction .candidate-grid"));
    await page.close();
  }
  assert.ok(seen.size > 1, "fresh seeds per load");
});

// ---------------------------------------------------------------- GU-16
test("GU-16 幅390px で横スクロールなし（両モード・入力済み・検査結果あり）", async ({ page }) => {
  await page.resize(390, 844);
  await page.settle();
  assert.ok(await horizontalOverflow(page) <= 0, "explanation");
  await page.clickText(".sample-button", "サンプル");
  await page.setFiles(byAria("検査結果のJSONと静止画を選択"), [reports.qcPre, reports.ghostPreview, ...reports.stills]);
  await page.waitFor("document.querySelector('[data-report=\"qc-pre\"]')", "検査結果");
  await page.settle();
  assert.ok(await horizontalOverflow(page) <= 0, `filled ${await horizontalOverflow(page)}`);
  await chooseMode(page, "mv");
  await page.settle();
  assert.ok(await horizontalOverflow(page) <= 0, "mv");
});

test("GU-16 1440×900 で最初の入力欄（制作モード・タイトル・説明・視聴者・希望尺）がスクロールなしで見える", async ({ page }) => {
  const bottoms = await page.evaluate(`[
    document.querySelector(".mode-choice"), document.querySelector("#concept input[maxlength='200']"),
    document.querySelector("#concept textarea[required]"), document.querySelector(".concept-row input[required]"),
    document.querySelector("[aria-label='希望尺（秒）']")].map((el) => el.getBoundingClientRect().bottom)`);
  const band = await page.evaluate("document.querySelector('.subtitle-band').getBoundingClientRect().top");
  for (const bottom of bottoms) assert.ok(bottom < band, `${bottom} < ${band}`);
});

/**
 * Tab through the page and check that every visible control (inside `within`, or outside any
 * dialog when `within` is null) receives focus with a visible ring. Radio groups count once.
 */
async function assertKeyboardReach(page, label, within = null) {
  await page.evaluate("document.activeElement?.blur?.(); window.scrollTo(0, 0); document.querySelectorAll('[data-kb]').forEach((el) => delete el.dataset.kb)");
  const targets = await page.evaluate(`(() => {
    const within = ${JSON.stringify(within)};
    const scope = within ? document.querySelector(within) : document;
    const all = [...scope.querySelectorAll("a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex='-1'])")]
      .filter((el) => !el.disabled && (within || !el.closest("dialog")) && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden");
    const seen = new Set();
    return all.filter((el) => {
      if (el.type === "radio") { if (seen.has(el.name)) return false; seen.add(el.name); }
      return true;
    }).map((el, i) => { el.dataset.kb = String(i); return String(i); });
  })()`);
  assert.ok(targets.length > 0, `${label}: no controls`);
  const reached = new Set();
  const outlines = [];
  for (let i = 0; i < targets.length + 40 && reached.size < targets.length; i++) {
    await page.key("Tab");
    const info = await page.evaluate(`(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { kb: null };
      const style = getComputedStyle(el);
      const ring = el.closest(".file-button, .choice, .style-card") ?? el;
      const ringStyle = getComputedStyle(ring);
      return { kb: el.dataset.kb ?? (el.type === "radio" ? document.querySelector('input[name="' + el.name + '"][data-kb]')?.dataset.kb ?? null : null),
        visible: el.matches(":focus-visible"), outline: Math.max(parseFloat(style.outlineWidth) || 0, parseFloat(ringStyle.outlineWidth) || 0),
        outlineStyle: style.outlineStyle !== "none" ? style.outlineStyle : ringStyle.outlineStyle };
    })()`);
    if (info.kb !== null && info.kb !== undefined) reached.add(info.kb);
    outlines.push(info);
  }
  const missing = targets.filter((id) => !reached.has(id));
  const names = await page.evaluate(`${JSON.stringify(missing)}.map((id) => { const el = document.querySelector('[data-kb="' + id + '"]'); return el.outerHTML.slice(0, 120); })`);
  assert.deepEqual(names, [], `${label}: every control is reachable by Tab`);
  const unseen = outlines.filter((info) => info.kb !== null && (!info.visible || info.outline < 2 || info.outlineStyle === "none"));
  assert.deepEqual(unseen, [], `${label}: focus ring is visible`);
  return targets.length;
}

test("GU-16 キーボードで全操作に届き、フォーカスが見える（解説・サンプル＋詳細）", async ({ page }) => {
  await page.clickText(".sample-button", "サンプル");
  await page.click(".advanced-toggle");
  await assertKeyboardReach(page, "explanation");
});

test("GU-16 キーボード到達（M4R T1：MV と音源・duo と添付の削除・読み込み通知・検査結果・エラー表示・ダイアログ）", async ({ page }) => {
  // MV with a music file attached (MV-only fields, attachment remove buttons).
  await fillMv(page);
  await page.setFiles(byAria("参考資料を選択"), [asset("reference.txt")]);
  await page.waitFor("document.querySelectorAll('#sources .attachments li').length === 1", "MV の添付");
  await assertKeyboardReach(page, "mv");
  // Explanation duo with models and BGM, an import note, inspection results and the error summary.
  await chooseMode(page, "explanation");
  const file = path.join(work, "keyboard.request.json");
  fs.writeFileSync(file, JSON.stringify({ form: { characterMode: "duo" }, assets: { sources: ["a.pdf"], character: "c.glb" } }));
  await page.setFiles(byAria("request.json を読み込む"), [file]);
  await page.waitFor("document.querySelector('.import-note')", "読み込み通知");
  await page.waitFor("document.querySelectorAll('.character-card').length === 2", "duo");
  await page.setFiles(byAria("1人目の3Dモデルを選択"), [asset("character.glb")]);
  await page.setFiles(byAria("2人目の3Dモデルを選択"), [asset("character.glb")]);
  await page.setFiles(byAria("BGMを選択"), [asset("song.wav")]);
  await page.setFiles(byAria("検査結果のJSONと静止画を選択"), [reports.qcPre, reports.run, reports.ghostPreview, ...reports.stills, reports.broken]);
  await page.waitFor("document.querySelector('[data-report=\"qc-pre\"]') && document.querySelector('.inspection-viewer .inline-error')", "検査結果");
  await page.click(".download-button");
  await page.waitFor("document.querySelector('.errors')", "エラー表示");
  await page.click(".advanced-toggle");
  await assertKeyboardReach(page, "duo + import note + inspection + errors");
  // The information dialog: focus stays inside the modal and reaches every control there.
  await page.clickText(".about-button", "Shin-MotionMaker について");
  await page.waitFor("document.querySelector('dialog[open]')", "dialog");
  await assertKeyboardReach(page, "dialog", "dialog[open]");
});

test("GU-16 prefers-reduced-motion（スクロールの動きを止める）", async ({ browser, site }) => {
  const page = await openPage(browser.cdp, site.url, { reducedMotion: true });
  try {
    assert.equal(await page.evaluate("getComputedStyle(document.documentElement).scrollBehavior"), "auto");
    assert.equal(await page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"), true);
    const animated = await page.evaluate("[...document.querySelectorAll('*')].filter((el) => { const s = getComputedStyle(el); return parseFloat(s.transitionDuration) > 0 || s.animationName !== 'none'; }).length");
    assert.equal(animated, 0);
  } finally { await page.close(); }
});

test("GU-16 prefers-reduced-motion では生成エラー・読み込みエラーのスクロールに smooth を渡さない（M4R R4）", async ({ browser, site }) => {
  const broken = path.join(work, "reduce-broken.request.json");
  fs.writeFileSync(broken, JSON.stringify({ form: { styleMode: "unknown" } }));
  const record = `(() => { window.__scrolls = []; const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (options) { window.__scrolls.push(options ?? null); return original.call(this, options); }; })()`;
  for (const reducedMotion of [true, false]) {
    const page = await openPage(browser.cdp, site.url, { reducedMotion });
    try {
      await page.evaluate(record);
      await page.click(".download-button");
      await page.waitFor("window.__scrolls.length === 1", "生成エラーのスクロール");
      await page.setFiles(byAria("request.json を読み込む"), [broken]);
      await page.waitFor("window.__scrolls.length === 2", "読み込みエラーのスクロール");
      const calls = await page.evaluate("window.__scrolls");
      if (reducedMotion) assert.ok(calls.every((call) => call?.behavior !== "smooth"), JSON.stringify(calls));
      else assert.ok(calls.every((call) => call?.behavior === "smooth"), `without reduce the scroll stays smooth: ${JSON.stringify(calls)}`);
      assert.deepEqual(page.consoleErrors, []);
    } finally { await page.close(); }
  }
});

for (const contrastMode of ["normal", "high"]) {
  test(`GU-16 描画後の文字のコントラスト 4.5:1 以上（${contrastMode}、入力済み・検査結果あり）`, async ({ page }) => {
    await page.clickText(".sample-button", "サンプル");
    await page.click(".advanced-toggle");
    await page.setFiles(byAria("検査結果のJSONと静止画を選択"), [reports.qcPre, reports.validate, reports.ghostPreview, reports.run]);
    await page.waitFor("document.querySelector('[data-report=\"qc-pre\"]')", "検査結果");
    if (contrastMode === "high") await page.evaluate("document.documentElement.dataset.contrast = 'high'");
    await page.settle();
    const failures = await page.evaluate(`(() => {
      const parse = (value) => { const m = value.match(/rgba?[(]([^)]+)[)]/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
      const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((t, v, i) => t + v * [0.2126, 0.7152, 0.0722][i], 0);
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      const background = (el) => { for (let node = el; node; node = node.parentElement) { const c = parse(getComputedStyle(node).backgroundColor); if (c && c.a > 0) return c.rgb; } return [255, 255, 255]; };
      // Skipped: the Biim preview motif and caption strip (user subtitle colours), and hidden text.
      const skip = ".band-caption, .subtitle-sample, .video-schematic, .sr-only, option, dialog:not([open])";
      const out = [];
      for (const el of document.querySelectorAll("body *")) {
        if (el.closest(skip)) continue;
        const own = [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
        if (!own || el.getClientRects().length === 0 || getComputedStyle(el).visibility === "hidden") continue;
        const fg = parse(getComputedStyle(el).color);
        const r = ratio(fg.rgb, background(el));
        if (!(r >= 4.5)) out.push(el.tagName + "." + el.className + " '" + el.textContent.trim().slice(0, 20) + "' " + r.toFixed(2));
      }
      return out;
    })()`);
    assert.deepEqual(failures, []);
  });
}

test("GU-08 高コントラスト表示（正本の high-contrast トークンに切り替わる）", async ({ page }) => {
  await page.clickText(".about-button", "Shin-MotionMaker について");
  await page.waitFor("document.querySelector('dialog[open]')", "dialog");
  await page.clickText("dialog label.check-label", "高コントラスト表示");
  await page.waitFor("document.documentElement.dataset.contrast === 'high'", "data-contrast");
  assert.equal(await page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--cs-trace').trim()"), "#0B2A3A");
});

// ---------------------------------------------------------------- helpers
const defaultsVersion = await (await import("../scripts/site.mjs")).coreVersions();

async function compareZip(page, explanation) {
  const exported = await exportRequest(page);
  // M4R T1: record every state of the ZIP button while it generates (disabled + progress, then the end state).
  await page.evaluate(`(() => {
    window.__progress = [];
    const take = () => { const button = document.querySelector(".download-button"); const bar = document.querySelector(".band-actions progress");
      window.__progress.push({ disabled: button.disabled, label: button.textContent, bar: bar ? bar.value : null }); };
    window.__progressObserver = new MutationObserver(take);
    window.__progressObserver.observe(document.querySelector(".band-actions"), { subtree: true, childList: true, attributes: true, characterData: true });
  })()`);
  const zipFile = await page.download(() => page.click(".download-button"), 120000);
  await page.waitFor("document.querySelector('.band-caption .success')", "生成完了の表示");
  const states = await page.evaluate("window.__progressObserver.disconnect(), window.__progress");
  const busy = states.filter((state) => state.disabled);
  assert.ok(busy.length > 0, "the button is disabled while generating");
  assert.ok(busy.every((state) => state.bar !== null && /ZIPを生成中… \d+%/.test(state.label)), JSON.stringify(busy.slice(0, 3)));
  const values = busy.map((state) => state.bar);
  assert.ok(values.every((value, i) => i === 0 || value >= values[i - 1]), `progress never goes back: ${values}`);
  assert.equal(await page.evaluate("document.querySelector('.download-button').disabled"), false, "enabled again at the end");
  assert.equal(await count(page, ".band-actions progress"), 0, "the progress bar is gone at the end");
  assert.equal((await text(page, ".download-button")).trim(), "ジョブのZIPを生成");
  const request = exported.request;
  const assets = await loadAssets(request.assets, baselineAssets);
  const normalized = validateRequest(request, { phase: "complete", assets });
  assert.ok(normalized.ok, JSON.stringify(normalized.error ?? ""));
  const built = await buildJobFiles(normalized.value.form, assets, await loadTemplates());
  assert.equal(zipFile.name, built.filename);
  const zip = await JSZip.loadAsync(zipFile.data);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const actual = {};
  for (const entry of entries) {
    assert.ok(entry.name.startsWith(`${built.rootName}/`), entry.name);
    actual[entry.name.slice(built.rootName.length + 1)] = new Uint8Array(await entry.async("uint8array"));
  }
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(built.files).sort(), "same paths");
  for (const [name, bytes] of Object.entries(built.files))
    assert.ok(Buffer.from(actual[name]).equals(Buffer.from(bytes)), `same bytes: ${name}`);
  await compareEntrances(request, baselineAssets, actual);
  if (explanation) {
    for (const name of ["assets/character.glb", "assets/character2.glb", "sources/reference.pdf", "sources/reference.png", "assets/fonts/NotoSansJP-Variable.ttf"])
      assert.ok(name in actual, name);
  } else assert.ok(Object.keys(actual).some((name) => name.startsWith("assets/music")), "music attached");
}

// ---------------------------------------------------------------- runner
let failures = 0;
let browser;
let site;
const results = [];
try {
  console.log("Pages 用ビルドを一時フォルダに作成します…");
  await buildSite({ outDir: dist, commit: COMMIT, builtAt: "2026-11-14T00:00:00.000Z", quiet: true });
  site = await serve(dist);
  browser = await launchBrowser();
  for (const { name, fn } of tests) {
    if (only && !name.includes(only)) continue;
    const page = await openPage(browser.cdp, site.url, { downloads });
    page.url = site.url;
    const started = Date.now();
    try {
      await fn({ page, browser, site });
      results.push({ name, ok: true });
      console.log(`ok   ${name} (${Date.now() - started}ms)`);
    } catch (error) {
      failures++;
      results.push({ name, ok: false, error: String(error?.stack ?? error) });
      console.log(`FAIL ${name}\n     ${String(error?.stack ?? error).split("\n").slice(0, 6).join("\n     ")}`);
    } finally {
      await page.close();
    }
  }
} catch (error) {
  failures++;
  console.error(`e2e を実行できませんでした: ${error?.message ?? error}`);
} finally {
  await browser?.close();
  site?.server.close();
  if (!keep) fs.rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  else console.log(`作業フォルダを残しました: ${work}`);
}
const passed = results.filter((result) => result.ok).length;
console.log(`\ne2e: ${passed} 件合格 / ${results.length} 件${failures ? `、失敗 ${failures} 件` : ""}`);
process.exitCode = failures || results.length === 0 ? 1 : 0;
