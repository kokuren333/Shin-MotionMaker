import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import ts from "typescript";
import JSZip from "jszip";
import { buildJobFiles, validateRequest, zipJobFiles, includeTemplatePath } from "../src/core/index.ts";
import fontAssets from "../src/core/data/font-assets.json" with { type: "json" };

const repository = fileURLToPath(new URL("../", import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "smm core & 全角 "));
const browserRoot = path.join(temporary, "browser");
let browser;
let server;
try {
  const browserPaths = [process.argv[2],
    path.join(process.env.PROGRAMFILES ?? "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] ?? "", "Microsoft/Edge/Application/msedge.exe")].filter(Boolean);
  let executable;
  for (const candidate of browserPaths) try { await fs.access(candidate); executable = candidate; break; } catch {}
  if (!executable) throw new Error("既存ブラウザの実行ファイルを第1引数に指定してください。");
  async function walk(directory, prefix = "") {
    const files = {};
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) Object.assign(files, await walk(filename, relative + "/"));
      else files[relative] = await fs.readFile(filename);
    }
    return files;
  }
  const templates = {};
  for (const [name, bytes] of Object.entries(await walk(path.join(repository, "job-template"))))
    if (includeTemplatePath(name)) templates[name] = bytes.toString("utf8");
  for (const font of fontAssets) {
    const bytes = new Uint8Array(await fs.readFile(path.join(repository, "job-assets/fonts", font.name)));
    assert.equal(hash(bytes), font.sha256);
    templates[`assets/fonts/${font.name}`] = bytes;
  }
  const request = { form: { title: "ブラウザと Node の生成確認", description: "同じ入力の本文を照合する", audience: "開発者", outline: "自由な構成\r\n原文を維持する。" } };
  const checked = validateRequest(request, { phase: "complete", assets: { sources: [] } });
  assert.ok(checked.ok);
  const job = await buildJobFiles(checked.value.form, { sources: [] }, templates);
  const archive = await zipJobFiles(job);
  const loaded = await JSZip.loadAsync(archive.data);
  const expected = {};
  for (const [name, entry] of Object.entries(loaded.files)) if (!entry.dir) expected[name] = hash(await entry.async("uint8array"));
  console.log(`Node: ${Object.keys(expected).length} ファイル、ZIP ${archive.data.length} bytes、schema ${job.project.schema_version}`);
  const write = async (name, bytes) => {
    const target = path.join(browserRoot, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
  };
  for (const [name, bytes] of Object.entries(await walk(path.join(repository, "src/core")))) {
    if (name.endsWith(".ts")) {
      const compiled = ts.transpileModule(bytes.toString("utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
      await write(`src/core/${name.replace(/\.ts$/, ".js")}`, compiled.replaceAll('.ts"', '.js"'));
    } else await write(`src/core/${name}`, bytes);
  }
  await write("job-template/runtime/scripts/caption-capacity.mjs", await fs.readFile(path.join(repository, "job-template/runtime/scripts/caption-capacity.mjs")));
  await write("jszip.js", await fs.readFile(path.join(repository, "node_modules/jszip/dist/jszip.min.js")));
  await write("jszip-shim.js", "export default globalThis.JSZip;\n");
  const templateNames = Object.keys(templates);
  for (const [index, name] of templateNames.entries()) await write(`templates/${index}`, templates[name]);
  await write("input.json", JSON.stringify({ request, templateNames, binary: templateNames.filter((name) => templates[name] instanceof Uint8Array) }));
  await write("index.html", `<!doctype html><meta charset="utf-8"><title>Core smoke</title><script src="/jszip.js"></script><script type="importmap">{"imports":{"jszip":"/jszip-shim.js"}}</script><body>running<script type="module">
import { buildJobFiles, validateRequest, zipJobFiles, candidatesFor } from "/src/core/index.js";
try {
  const { request, templateNames, binary } = await (await fetch("/input.json")).json();
  const templates = {};
  await Promise.all(templateNames.map(async (name, index) => { const response = await fetch("/templates/" + index); templates[name] = binary.includes(name) ? new Uint8Array(await response.arrayBuffer()) : await response.text(); }));
  const checked = validateRequest(request, { phase: "complete", assets: { sources: [] } });
  if (!checked.ok) throw Error(JSON.stringify(checked.error));
  const job = await buildJobFiles(checked.value.form, { sources: [] }, templates);
  const archive = await zipJobFiles(job);
  const zip = await JSZip.loadAsync(archive.data);
  const hashes = {};
  for (const [name, entry] of Object.entries(zip.files)) if (!entry.dir) hashes[name] = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await entry.async("uint8array"))), byte => byte.toString(16).padStart(2, "0")).join("");
  const result = { ok: true, hashes, filename: archive.filename, seed: candidatesFor({ mode: "explanation" }).seed };
  document.body.textContent = JSON.stringify(result);
  await fetch("/result", { method: "POST", body: JSON.stringify(result) });
} catch (error) { document.body.textContent = error.stack; await fetch("/result", { method: "POST", body: JSON.stringify({ ok: false, error: error.stack }) }); }
</script>`);
  let resolveResult;
  const resultPromise = new Promise((resolve) => { resolveResult = resolve; });
  server = http.createServer(async (request, response) => {
    if (request.url === "/result" && request.method === "POST") {
      let body = "";
      for await (const chunk of request) body += chunk;
      response.end("ok"); resolveResult(JSON.parse(body)); return;
    }
    try {
      const name = request.url === "/" ? "index.html" : decodeURIComponent(request.url.slice(1));
      const target = path.resolve(browserRoot, name);
      if (!target.startsWith(path.resolve(browserRoot) + path.sep)) throw Error("path");
      const bytes = await fs.readFile(target);
      response.setHeader("Content-Type", name.endsWith(".html") ? "text/html; charset=utf-8" : name.endsWith(".json") ? "application/json" : /\.(?:mjs|js)$/.test(name) ? "text/javascript" : "application/octet-stream");
      response.end(bytes);
    } catch { response.statusCode = 404; response.end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  browser = spawn(executable, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-extensions", "--disable-gpu",
    `--user-data-dir=${path.join(temporary, "profile")}`, "--dump-dom", "--virtual-time-budget=15000", url], { shell: false, windowsHide: true, stdio: "ignore" });
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("ブラウザの core 実行が時間内に完了しませんでした。")), 45000);
    resultPromise.then((result) => { clearTimeout(timer); resolve(result); });
    browser.once("error", (error) => { clearTimeout(timer); reject(error); });
  });
  assert.ok(result.ok, result.error);
  assert.deepEqual(result.hashes, expected);
  assert.equal(result.filename, archive.filename);
  console.log(`Browser: ${Object.keys(result.hashes).length} ファイルの SHA-256 が Node と一致、乱数 seed ${result.seed}`);
  console.log("core のブラウザ実行・ZIP 展開本文の照合が完了しました。");
} finally {
  if (browser && browser.exitCode === null) {
    browser.kill();
    await new Promise((resolve) => browser.once("close", resolve));
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  assert.equal(path.dirname(path.resolve(temporary)), path.resolve(os.tmpdir()));
  await fs.rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
