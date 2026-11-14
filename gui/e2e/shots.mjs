// GU-17 screenshots of the Pages build served locally under /Shin-MotionMaker/.
// Usage: node --experimental-strip-types e2e/shots.mjs [--out=DIR] [--dist=DIR] [--commit=SHA] [--only=S1,S5]
// Without --dist the site is built into a temporary folder with the given commit
// (default "local"); version control is not consulted.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite } from "../scripts/site.mjs";
import { launchBrowser, openPage, serve } from "./browser.mjs";
import { asset, writeReportFixtures } from "./fixtures.mjs";
import { byAria, byPlaceholder, chooseMode, fillMv } from "./app.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.length ? rest.join("=") : "true"];
}));
const repository = fileURLToPath(new URL("../../", import.meta.url));
const out = path.resolve(args.out ?? path.join(repository, "docs", "work", "M4", "screenshots"));
const only = args.only ? new Set(args.only.split(",")) : null;
const work = fs.mkdtempSync(path.join(os.tmpdir(), "smm-shots-"));
const reports = writeReportFixtures(path.join(work, "job"));

async function fillExplainer(page) {
  await page.clickText(".sample-button", "サンプル");
  await page.fill(await byPlaceholder(page, "視聴後に"), "虹ができる仕組みを、光の屈折と分散から説明できる。");
  await page.fill(await byPlaceholder(page, "すでに知っている"), "雨と光は知っている。虹が物体として空に浮かんでいるという誤解を扱う。");
  await page.fill(await byPlaceholder(page, "見出しや段落"), "# 導入\n雨上がりに虹が見えるのはなぜでしょう。\n\n# 光の道筋\n雨粒に入った光は曲がり、色ごとに分かれます。\n\n# まとめ\n虹は光が分かれて見える現象です。");
}

const shots = [
  ["S1", "S1-explainer-initial-1440.png", [1440, 900], async () => {}],
  ["S1m", "S1m-mv-initial-1440.png", [1440, 900], async (page) => { await chooseMode(page, "mv"); await page.evaluate("window.scrollTo(0, 0)"); }],
  ["S2", "S2-explainer-filled-direction-1440.png", [1440, 900], async (page) => {
    await fillExplainer(page);
    await page.reveal("#direction .direction-lab");
  }],
  ["S3", "S3-mv-filled-1440.png", [1440, 900], async (page) => {
    await fillMv(page);
    await page.reveal("#direction .direction-lab");
  }],
  ["S4", "S4-required-missing-error-1440.png", [1440, 900], async (page) => {
    await page.click(".download-button");
    await page.waitFor("document.querySelector('.errors')", "error list");
  }],
  ["S5", "S5-inspection-results-1440.png", [1440, 900], async (page) => {
    await page.setFiles(byAria("検査結果のJSONと静止画を選択"), [reports.qcPre, reports.ghostPreview, ...reports.stills]);
    await page.waitFor("document.querySelector('[data-report=\"qc-pre\"]')", "reports");
    await page.reveal("[data-report='qc-pre']");
  }],
  ["S5b", "S5b-inspection-ghost-stills-1440.png", [1440, 900], async (page) => {
    await page.setFiles(byAria("検査結果のJSONと静止画を選択"), [reports.ghostPreview, reports.run, ...reports.stills]);
    await page.waitFor("document.querySelectorAll('.ghost-still-images img').length === 4", "stills");
    await page.reveal("[data-report='ghost-check-preview']");
  }],
  ["S6", "S6-info-dialog-1440.png", [1440, 900], async (page) => {
    await page.clickText(".about-button", "Shin-MotionMaker について");
    await page.waitFor("document.querySelector('dialog[open]')", "dialog");
  }],
  ["S7", "S7-explainer-390.png", [390, 844], async () => {}],
  ["S8", "S8-mv-390.png", [390, 844], async (page) => { await chooseMode(page, "mv"); }],
  ["S9", "S9-cli-mcp-request-1440.png", [1440, 900], async (page) => {
    await fillExplainer(page);
    await page.setFiles(byAria("参考資料を選択"), [asset("reference.pdf")]);
    await page.reveal(".agent-entrances");
  }],
  ["S10", "S10-request-imported-1440.png", [1440, 900], async (page) => {
    const file = path.join(work, "虹はどうしてできる？.request.json");
    fs.writeFileSync(file, JSON.stringify({ form: { title: "虹はどうしてできる？", description: "光の屈折と分散を説明する。", audience: "中高生" },
      assets: { sources: ["reference.pdf", "data/table.csv"], bgm: "bgm.mp3" } }, null, 2));
    await page.setFiles(byAria("request.json を読み込む"), [file]);
    await page.waitFor("document.querySelector('.import-note')", "import");
  }],
  ["S11", "S11-high-contrast-1440.png", [1440, 900], async (page) => {
    await page.evaluate("document.documentElement.dataset.contrast = 'high'");
  }],
  ["S12", "S12-request-invalid-choice-1440.png", [1440, 900], async (page) => {
    await fillExplainer(page);
    const file = path.join(work, "unknown-style.request.json");
    fs.writeFileSync(file, JSON.stringify({ form: { title: "test", description: "test", audience: "test", styleMode: "unknown" } }));
    await page.setFiles(byAria("request.json を読み込む"), [file]);
    await page.waitFor("document.querySelector('.errors')", "import error");
  }],
];

let browser;
let site;
try {
  let dist = args.dist && path.resolve(args.dist);
  if (!dist) {
    dist = path.join(work, "site");
    await buildSite({ outDir: dist, commit: args.commit ?? "local", builtAt: new Date().toISOString(), quiet: true });
  }
  site = await serve(dist);
  browser = await launchBrowser();
  fs.mkdirSync(out, { recursive: true });
  for (const [id, file, [width, height], run] of shots) {
    if (only && !only.has(id)) continue;
    const page = await openPage(browser.cdp, site.url, { width, height });
    try {
      await run(page);
      await page.screenshot(path.join(out, file));
      const overflow = await page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth");
      console.log(`${id} ${file} ${width}x${height} overflow=${overflow} errors=${page.consoleErrors.length}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser?.close();
  site?.server.close();
  fs.rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
