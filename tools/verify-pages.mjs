import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { launchBrowser, openPage, sleep } from "../gui/e2e/browser.mjs";

const fetched = async (url) => {
  const target = new URL(url); target.searchParams.set("smm_verify", `${Date.now()}-${Math.random()}`);
  const response = await fetch(target, { cache: "no-store", signal: AbortSignal.timeout(15000), headers: { "cache-control": "no-cache" } });
  assert.equal(response.status, 200, target.href);
  return response;
};
async function deadline(promise, ms) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error("ブラウザの検証がタイムアウトしました。")), ms); })]); }
  finally { clearTimeout(timer); }
}

export async function verifyPages(url, { expectCommit, attempts = 12, retryMs = 5000, screenshot } = {}) {
  assert.ok(expectCommit, "--expect-commit が必要です。");
  assert.ok(Number.isInteger(attempts) && attempts > 0 && attempts <= 60);
  assert.ok(Number.isFinite(retryMs) && retryMs >= 0 && retryMs <= 60000);
  const base = new URL(url);
  assert.ok(["http:", "https:"].includes(base.protocol));
  assert.ok(base.pathname.endsWith("/"), "URL の末尾に / を付けてください。");
  let browser;
  const failures = [];
  try {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      let page;
      try {
        const response = await fetched(base), html = await response.text();
        assert.ok(/<title[^>]*>[^<]*Shin-MotionMaker[^<]*<\/title>/i.test(html), "title が Shin-MotionMaker を含みません。");
        const version = await (await fetched(new URL("version.json", base))).json();
        assert.equal(version.commit, expectCommit, "version.json のコミットが一致しません。");
        const references = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi)]
          .map((match) => new URL(match[1], base)).filter((url) => /\.(?:js|css)$/.test(url.pathname));
        assert.ok(references.some((url) => url.pathname.endsWith(".js")), "JS がありません。");
        assert.ok(references.some((url) => url.pathname.endsWith(".css")), "CSS がありません。");
        for (const reference of references) await (await fetched(reference)).arrayBuffer();
        browser ??= await launchBrowser();
        const target = new URL(base); target.searchParams.set("smm_verify", String(Date.now()));
        page = await deadline(openPage(browser.cdp, target.href), 30000);
        await deadline(page.settle(), 15000);
        assert.match(await page.evaluate("document.title"), /Shin-MotionMaker/);
        const visible = await page.evaluate(`(() => {
          const visible = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
          return { heading: visible(document.querySelector("h1.app-task")) && document.querySelector("h1.app-task").textContent.trim(),
            sections: [...document.querySelectorAll("h2")].filter(visible).map((el) => el.textContent.trim()),
            zip: visible(document.querySelector("button.download-button")) && document.querySelector("button.download-button").textContent.trim() };
        })()`);
        assert.equal(visible.heading, "動画ジョブを作成");
        assert.ok(visible.sections.includes("ジョブの要点") && visible.sections.includes("補足"));
        assert.equal(visible.zip, "ジョブのZIPを生成");
        assert.deepEqual(page.failedRequests, []); assert.deepEqual(page.consoleErrors, []);
        if (screenshot) await page.screenshot(path.resolve(screenshot));
        return { success: true, url: base.href, expect_commit: expectCommit, attempt, failures,
          version, assets: references.map((url) => url.href), visible, console_errors: 0 };
      } catch (error) {
        failures.push({ attempt, message: error.message });
        console.error(`公開後確認 ${attempt}/${attempts}: ${error.message}`);
        if (attempt === attempts) throw new Error(`公開後確認が完了しませんでした。${JSON.stringify(failures)}`);
      } finally { await page?.close(); }
      await sleep(retryMs);
    }
  } finally { await browser?.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const option = (name, fallback) => { const index = process.argv.indexOf(`--${name}`); return index < 0 ? fallback : process.argv[index + 1]; };
  try {
    const result = await verifyPages(process.argv[2], { expectCommit: option("expect-commit"), attempts: Number(option("attempts", 12)), retryMs: Number(option("retry-ms", 5000)), screenshot: option("screenshot") });
    if (option("output")) { await fs.mkdir(path.dirname(path.resolve(option("output"))), { recursive: true }); await fs.writeFile(option("output"), JSON.stringify(result, null, 2) + "\n"); }
    console.log(JSON.stringify(result));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
