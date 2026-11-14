import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import JSZip from "jszip";
import { buildJobFiles, generateJob, validateRequest, type JsonValue, type Request } from "../src/core/index.ts";
import { execute, resolveAllowedPath, readRequest, readTextInput, loadTemplates, writeJob, getProject, patchProject, deriveJobStatus, getReport, sha256, schemaIssues, schemas, schemaRegistry, exposedOperations, operations, doctor } from "../src/host/index.ts";
import { baseline, fileMap, loadAssets, loadTemplates as browserTemplates } from "./helpers/templates.ts";
import { fakeJob, workspace } from "./helpers/host.ts";

test("MC-02 rejects lexical escapes and resolves missing output parents", async (t) => {
  const context = await workspace(t);
  for (const name of ["../escape", "a/../../escape", "C:/Windows", "c:relative", "//server/share", "\\\\server\\share", "a\\..\\b", "a/./b", "a//b", "x\u0000"])
    await assert.rejects(resolveAllowedPath(context, name, "write"), { code: "E_PATH_DENIED" }, name);
  assert.equal(await resolveAllowedPath(context, "new & 全角 空白/nested/file", "write"), path.join(context.root, "new & 全角 空白/nested/file"));
  assert.equal(await resolveAllowedPath(context, ".", "read"), context.root);
});

test("MC-02 win32 rejects reserved names ADS and trailing dots and folds case", { skip: process.platform !== "win32" ? "win32 固有の名前規則と大文字小文字の比較を Windows CI で確認するため" : false }, async (t) => {
  const context = await workspace(t);
  for (const name of ["a/.. ", "a./x", "a /x", "x:stream", "NUL", "con.txt", "a?b"])
    await assert.rejects(resolveAllowedPath(context, name, "write"), { code: "E_PATH_DENIED" }, name);
  await fs.mkdir(path.join(context.root, "Case"));
  assert.equal((await fs.realpath(await resolveAllowedPath(context, "case", "read"))).toLowerCase(), path.join(context.root, "Case").toLowerCase());
});

test("MC-02 junction and symlink escapes denied for reads writes jobs reports and ledger", async (t) => {
  const context = await workspace(t); const outside = await workspace(t);
  await fs.writeFile(path.join(outside.root, "source.txt"), "外部");
  const link = path.join(context.root, "junction");
  await fs.symlink(outside.root, link, process.platform === "win32" ? "junction" : "dir");
  for (const purpose of ["read", "write", "attachment"] as const) await assert.rejects(resolveAllowedPath(context, "junction/source.txt", purpose), { code: "E_PATH_DENIED" });
  await assert.rejects(resolveAllowedPath(context, "junction/missing/nested/file", "write"), { code: "E_PATH_DENIED" });
  const enabled = { ...context, allowDirs: [outside.root] };
  assert.equal(await resolveAllowedPath(enabled, path.join(outside.root, "source.txt"), "attachment"), path.join(outside.root, "source.txt"));
  await assert.rejects(resolveAllowedPath(enabled, "junction/new", "write"), { code: "E_PATH_DENIED" });
  await assert.rejects(resolveAllowedPath(context, path.join(outside.root, "source.txt"), "attachment"), { code: "E_PATH_DENIED" });
  const job = await fakeJob(context);
  await fs.symlink(outside.root, path.join(job, "reports"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(getReport(context, "job & 全角 空白", "reports/source.txt"), { code: "E_PATH_DENIED" });
  await fs.symlink(outside.root, path.join(job, ".smm"), process.platform === "win32" ? "junction" : "dir");
  const run = await execute(context, "qc", { job: "job & 全角 空白", stage: "pre" });
  assert.equal(run.ok, false); if (!run.ok) assert.equal(run.error.code, "E_PATH_DENIED");
  try {
    await fs.symlink(outside.root, path.join(context.root, "symlink"), "dir");
    await assert.rejects(resolveAllowedPath(context, "symlink/source.txt", "read"), { code: "E_PATH_DENIED" });
  } catch (error) {
    if (process.platform === "win32" && error && typeof error === "object" && "code" in error && ["EPERM", "EACCES"].includes(String(error.code))) t.diagnostic("ディレクトリ symlink 権限なし: junction で実体の境界検査を実行しました。");
    else throw error;
  }
});

test("host generation validates every path before any output and preserves existing outputs", async (t) => {
  const context = await workspace(t);
  const denied = await execute(context, "generate", { request: { form: { title: "検証", description: "説明", audience: "読者" } }, out: "../escape", dry_run: true });
  assert.equal(denied.ok, false); if (!denied.ok) assert.equal(denied.error.code, "E_PATH_DENIED");
  const checked = validateRequest({ form: { title: "検証", description: "説明", audience: "読者" } }, { phase: "complete", assets: { sources: [] } }); assert.ok(checked.ok);
  const built = await buildJobFiles(checked.value.form, { sources: [] }, await loadTemplates());
  for (const bad of ["../outside", "/absolute", "C:/drive", "a\\b", ...(process.platform === "win32" ? ["a:stream", "x."] : [])]) {
    await assert.rejects(writeJob(context, { ...built, files: { ...built.files, [bad]: new Uint8Array([1]) } }, "out", "dir"), { code: "E_PATH_DENIED" });
    await assert.rejects(fs.stat(path.join(context.root, "out")), { code: "ENOENT" });
  }
  await fs.mkdir(path.join(context.root, "out", built.rootName), { recursive: true });
  await fs.writeFile(path.join(context.root, "out", "sibling"), "keep");
  await assert.rejects(writeJob(context, built, "out", "dir"), { code: "E_OUTPUT_EXISTS" });
  assert.equal(await fs.readFile(path.join(context.root, "out", "sibling"), "utf8"), "keep");
  await fs.writeFile(path.join(context.root, "out", built.filename), "edited");
  await assert.rejects(writeJob(context, built, "out", "zip"), { code: "E_OUTPUT_EXISTS" });
  assert.equal(await fs.readFile(path.join(context.root, "out", built.filename), "utf8"), "edited");
});

test("AR-06 independent browser ZIP and host folder and ZIP contain identical paths and bytes", async (t) => {
  const context = { ...await workspace(t), restrictToRoot: false, startedBy: "cli" as const };
  const templates = await browserTemplates();
  for (const name of ["minimal", "mv-landscape", "mv-portrait-options", "explainer-anime", "explainer-motion", "explainer-mixed", "explainer-attachments"]) {
    const directory = path.join(baseline, "golden", name), inputFile = path.join(directory, "request.json");
    const input = JSON.parse(await fs.readFile(inputFile, "utf8")) as Request;
    const loaded = await readRequest(inputFile, context);
    const assets = await loadAssets(input.assets ?? {}, directory);
    assert.deepEqual(loaded.assets, assets);
    const checked = validateRequest(input, { phase: "complete", assets }); assert.ok(checked.ok);
    const browser = await JSZip.loadAsync((await generateJob(checked.value.form, assets, templates)).data);
    const built = await buildJobFiles(loaded.request.form, loaded.assets, await loadTemplates());
    const output = path.join(context.root, name);
    const folder = await writeJob(context, built, output, "dir");
    const archive = await writeJob(context, built, output, "zip");
    const actual = await fileMap(path.join(context.root, folder.job!));
    const zip = await JSZip.loadAsync(await fs.readFile(path.join(context.root, archive.archive!)));
    const expected = Object.entries(browser.files).filter(([, entry]) => !entry.dir);
    assert.deepEqual(Object.keys(actual).sort(), expected.map(([key]) => key.slice(built.rootName.length + 1)).sort(), name);
    for (const [key, entry] of expected) {
      assert.deepEqual(actual[key.slice(built.rootName.length + 1)], await entry.async("uint8array"), `${name}: ${key}`);
      assert.deepEqual(await zip.files[key].async("uint8array"), await entry.async("uint8array"), key);
    }
    assert.deepEqual(schemaIssues(schemas.generate, folder, schemaRegistry), []);
  }
});

test("CL-01 BOM request attachments resolve from the request parent and WAV duration is measured", async (t) => {
  const context = { ...await workspace(t), restrictToRoot: false, startedBy: "cli" as const };
  await fs.mkdir(path.join(context.root, "input"));
  await fs.copyFile(path.join(baseline, "assets/song.wav"), path.join(context.root, "input/song.WAV"));
  const file = path.join(context.root, "input/request.json");
  await fs.writeFile(file, "\uFEFF" + JSON.stringify({ form: { videoMode: "mv", title: "曲", description: "表現", audience: "視聴者", musicDurationSec: null }, assets: { music: "song.WAV" } }));
  assert.ok((await readTextInput(file, context)).startsWith("{"));
  const result = await readRequest(file, context);
  assert.ok(result.request.form.musicDurationSec! > 0); assert.equal(result.assets.music?.type, "audio/wav"); assert.equal(result.assets.music?.name, "song.WAV");
  const invalid = Buffer.alloc(12); invalid.write("RIFF"); invalid.write("WAVE", 8); await fs.writeFile(path.join(context.root, "input/song.WAV"), invalid);
  await assert.rejects(readRequest(file, context), (error: unknown) => !!error && typeof error === "object" && "code" in error && error.code === "E_FORM_INVALID" && "hint" in error && String(error.hint).includes("musicDurationSec"));
  await fs.writeFile(file, "{"); await assert.rejects(readRequest(file, context), { code: "E_INPUT_INVALID" });
});

test("MC-08 JSON Pointer merge patch optimistic concurrency and immutable fields", async (t) => {
  const context = await workspace(t); const job = await fakeJob(context, {}, true); const relative = "job & 全角 空白";
  const original = await getProject(context, relative);
  await assert.rejects(patchProject(context, { job: relative, patch: {}, expect_sha256: "0".repeat(64) }), { code: "E_CONFLICT" });
  const invalid: JsonValue[] = [{ mode: "mv" }, { schema_version: "0.5" }, { generator: {} }, [], null];
  for (const patch of invalid) await assert.rejects(patchProject(context, { job: relative, patch, expect_sha256: original.sha256 }), { code: "E_INPUT_INVALID" });
  const patched = await patchProject(context, { job: relative, patch: { scenes: [{ free: "任意内容" }], fixture: null, "a/b": { "~key": "値" } }, expect_sha256: original.sha256 });
  assert.equal((await getProject(context, relative, "/a~1b/~0key")).project, "値");
  assert.equal((await getProject(context, relative, "/scenes/0/free")).project, "任意内容");
  assert.equal(patched.sha256, sha256(await fs.readFile(path.join(job, "project.json"))));
  await assert.rejects(getProject(context, relative, "/scenes/01"), { code: "E_INPUT_INVALID" });
  await assert.rejects(getProject(context, relative, "/a~2b"), { code: "E_INPUT_INVALID" });
  assert.equal(await fs.readFile(path.join(job, "project.json"), "utf8").then((value) => value.endsWith("\n")), true);
});

test("JT-12 status reads legacy project and QC stale changes with current input bytes", async (t) => {
  const context = await workspace(t); const job = await fakeJob(context, {}, true), relative = "job & 全角 空白";
  await fs.mkdir(path.join(job, "reports"));
  await fs.writeFile(path.join(job, "reports/qc-pre.json"), JSON.stringify({ kind: "biim-explainer-qc", stage: "pre", verdict: "fail", gates: [], advisories: [], review_mode: "self", waivers: [{ gate_id: "PRE-1" }], inputs: { "project.json": sha256(await fs.readFile(path.join(job, "project.json"))) } }));
  let status = await deriveJobStatus(context, relative);
  assert.equal(status.job.generator, null); assert.equal(status.job.style_mode, "biim"); assert.equal(status.checks.find((fact) => fact.kind === "qc-pre")?.available, true);
  assert.equal((status.checks.find((fact) => fact.kind === "qc-pre") as { stale?: boolean }).stale, false);
  const current = await getProject(context, relative); await patchProject(context, { job: relative, expect_sha256: current.sha256, patch: { title: "更新" } });
  status = await deriveJobStatus(context, relative); assert.equal((status.checks.find((fact) => fact.kind === "qc-pre") as { stale?: boolean }).stale, true);
  assert.equal(Object.hasOwn(status, "verdict"), false); assert.deepEqual(schemaIssues(schemas["job-status"], status, schemaRegistry), []);
  const project = JSON.parse(await fs.readFile(path.join(job, "project.json"), "utf8")); project.mode = "mv"; await fs.writeFile(path.join(job, "project.json"), JSON.stringify(project));
  status = await deriveJobStatus(context, relative); assert.equal(status.job.style_mode, null); assert.equal((status.checks.find((fact) => fact.kind === "qc-pre") as { verdict?: string }).verdict, "not_applicable");
});

test("MC-09 report whitelist text limit UTF-8 boundary and PNG size limit", async (t) => {
  const context = await workspace(t); const job = await fakeJob(context), relative = "job & 全角 空白";
  await fs.mkdir(path.join(job, "reports")); await fs.writeFile(path.join(job, "reports/large.txt"), "日".repeat(100000));
  const report = await getReport(context, relative, "reports/large.txt");
  assert.ok("text" in report); assert.equal(report.truncated, true); assert.ok(!report.text.includes("\uFFFD")); assert.ok(Buffer.byteLength(report.text) <= 256 * 1024);
  for (const name of ["project.json", "runtime/.env", "reports/a.mjs", "output/a/b.png", "../project.json"]) await assert.rejects(getReport(context, relative, name), { code: "E_PATH_DENIED" });
  await fs.writeFile(path.join(job, "reports/image.png"), new Uint8Array(8 * 1024 * 1024 + 1));
  await assert.rejects(getReport(context, relative, "reports/image.png"), { code: "E_INPUT_INVALID" });
  await assert.rejects(getReport({ ...context, restrictToRoot: false, startedBy: "cli" }, relative, "reports/image.png"), { code: "E_INPUT_INVALID" });
  await fs.writeFile(path.join(job, "reports/image.png"), new Uint8Array(6 * 1024 * 1024 + 1));
  await assert.rejects(getReport(context, relative, "reports/image.png"), { code: "E_INPUT_INVALID" });
  const cliImage = await getReport({ ...context, restrictToRoot: false, startedBy: "cli" }, relative, "reports/image.png");
  assert.ok("data" in cliImage); assert.equal(cliImage.data.byteLength, 6 * 1024 * 1024 + 1);
});

test("operation table covers contract names flags closed schemas and exported files", async (t) => {
  const context = await workspace(t);
  assert.equal(operations.length, 23); assert.equal(new Set(operations.map((operation) => operation.id)).size, 23);
  assert.equal(exposedOperations({ ...context, readOnly: true }).some((operation) => operation.kind !== "read"), false);
  assert.equal(exposedOperations(context).some((operation) => operation.id === "imagegen"), false);
  assert.equal(exposedOperations({ ...context, enableGeneration: true }).some((operation) => operation.id === "imagegen"), true);
  for (const operation of operations) { assert.equal(operation.inputSchema.additionalProperties, false); assert.ok(operation.description); if (!operation.mcp) assert.ok(operation.cliOnlyReason); }
  for (const [name, schema] of Object.entries(schemas)) {
    assert.deepEqual(JSON.parse(await fs.readFile(new URL(`../schemas/${name}.schema.json`, import.meta.url), "utf8")), schema);
  }
  for (const [id, input] of [["candidates", { mode: "explanation", seed: 3 }], ["stats", { kind: "lyrics", text: "歌詞" }], ["stats", { kind: "script", text: "説明" }], ["schema", {}]] as const) {
    const result = await execute(context, id, input); assert.equal(result.ok, true); assert.deepEqual(schemaIssues(schemas.envelope, result, schemaRegistry), []);
  }
  const before = await fs.readdir(context.root); const result = await doctor(context); assert.deepEqual(await fs.readdir(context.root), before); assert.deepEqual(schemaIssues(schemas.doctor, result, schemaRegistry), []);
});
