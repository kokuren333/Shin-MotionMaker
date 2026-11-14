import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { buildSite } from "../gui/scripts/site.mjs";
import { serve } from "../gui/e2e/browser.mjs";
import { verifyPages } from "./verify-pages.mjs";
import { option, repository, owned, removeOwned, saveEvidence, facts, processResult } from "./verification-lib.mjs";

const commit = option("commit", process.env.GITHUB_SHA);
assert.ok(commit, "--commit が必要です。");
const root = owned(path.join(repository, ".agent-work/m7-pages"));
const evidenceFile = path.resolve(option("evidence", path.join(repository, ".agent-work/m7-evidence/pages-local.json")));
await fs.mkdir(root, { recursive: true });
const dist = path.join(root, "site");
const evidence = { commit, platform: process.platform, node: process.version, started_at: new Date().toISOString(), checks: [], success: false };
let site;
try {
  await buildSite({ outDir: dist, commit, builtAt: new Date().toISOString(), quiet: true });
  site = await serve(dist);
  const options = { expectCommit: commit, attempts: 1, retryMs: 0 };
  const htmlFile = path.join(dist, "index.html"), html = await fs.readFile(htmlFile, "utf8");
  const versionFile = path.join(dist, "version.json"), version = await fs.readFile(versionFile, "utf8");
  const rejected = async (name, action, restore) => {
    try {
      await action();
      await assert.rejects(verifyPages(site.url, options));
      evidence.checks.push({ scenario: name, rejected: true });
    } finally { await restore(); }
  };
  await assert.rejects(verifyPages(`${site.url}missing/`, options));
  evidence.checks.push({ scenario: "HTTP 404", rejected: true });
  await rejected("title mismatch", () => fs.writeFile(htmlFile, html.replace("<title>Shin-MotionMaker</title>", "<title>Wrong</title>")), () => fs.writeFile(htmlFile, html));
  await rejected("commit mismatch", () => fs.writeFile(versionFile, JSON.stringify({ commit: "old" })), () => fs.writeFile(versionFile, version));
  for (const extension of ["js", "css"]) {
    const name = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]).find((name) => name.endsWith(`.${extension}`));
    const asset = path.join(dist, name);
    await rejected(`${extension} HTTP 404`, () => fs.rename(asset, asset + ".hidden"), () => fs.rename(asset + ".hidden", asset));
  }
  const injected = (script) => html.replace("</head>", `<script>addEventListener('load', () => { ${script} });</script></head>`);
  await rejected("browser console error", () => fs.writeFile(htmlFile, injected("console.error('verification fixture')")), () => fs.writeFile(htmlFile, html));
  await rejected("hidden heading", () => fs.writeFile(htmlFile, html.replace("</head>", "<style>h1.app-task {display:none!important}</style></head>")), () => fs.writeFile(htmlFile, html));
  await rejected("hidden ZIP button", () => fs.writeFile(htmlFile, html.replace("</head>", "<style>.download-button {display:none!important}</style></head>")), () => fs.writeFile(htmlFile, html));
  // Change version after the first stale response, before the deterministic second attempt.
  await fs.writeFile(versionFile, JSON.stringify({ commit: "old" }));
  const restoreAfterRequest = (request, response) => {
    if (request.url.startsWith("/Shin-MotionMaker/version.json")) {
      site.server.off("request", restoreAfterRequest);
      response.once("finish", () => { fs.writeFile(versionFile, version).catch(() => {}); });
    }
  };
  site.server.on("request", restoreAfterRequest);
  const retried = await verifyPages(site.url, { ...options, attempts: 2, retryMs: 200 });
  assert.equal(retried.attempt, 2);
  evidence.checks.push({ scenario: "retry after stale commit", attempt: retried.attempt, success: retried.success });
  const screenshot = path.join(path.dirname(evidenceFile), "pages-local.png");
  const output = path.join(root, "verifier.json");
  const result = await processResult(process.execPath, [path.join(repository, "tools/verify-pages.mjs"), site.url,
    "--expect-commit", commit, "--attempts", "1", "--screenshot", screenshot, "--output", output]);
  assert.equal(result.code, 0, result.stdout + result.stderr);
  evidence.verifier = JSON.parse(result.stdout);
  evidence.artifacts = await facts(path.dirname(evidenceFile), ["pages-local.png"]);
  evidence.success = true;
} catch (error) { evidence.error = error.message; console.error(error.message); process.exitCode = 1; }
finally {
  site?.server.close(); evidence.ended_at = new Date().toISOString();
  await saveEvidence(evidenceFile, evidence); await removeOwned(root);
}
