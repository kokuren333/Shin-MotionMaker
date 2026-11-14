import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { execute, atomicJson, loadTemplateDirectory, schemaIssues, schemas, schemaRegistry, doctor, listRuns, type OperationInputs } from "../src/host/index.ts";
import { runCommand } from "../src/host/run-options.ts";
import { fakeJob, workspace } from "./helpers/host.ts";

test("template filesystem loader excludes dot entries and node_modules like the Vite glob", async (t) => {
  const context = await workspace(t);
  for (const name of ["visible/a.txt", ".hidden/file", "visible/.dot", "node_modules/module", "nested/node_modules/module", "nested/.dot/file"]) {
    const file = path.join(context.root, name); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, "本文\r\n");
  }
  assert.deepEqual(await loadTemplateDirectory(context.root), { "visible/a.txt": "本文\r\n" });
});

test("atomic ledger replacement remains readable during concurrent polling on Windows", async (t) => {
  const context = await workspace(t); const file = path.join(context.root, "run.json");
  await atomicJson(file, { revision: 0 });
  let finished = false, reads = 0;
  const reader = (async () => {
    while (!finished) { const value = JSON.parse(await fs.readFile(file, "utf8")); assert.ok(Number.isInteger(value.revision)); reads++; }
  })();
  try { for (let revision = 1; revision <= 40; revision++) await atomicJson(file, { revision }); }
  finally { finished = true; await reader; }
  assert.ok(reads > 0); assert.equal(JSON.parse(await fs.readFile(file, "utf8")).revision, 40);
  assert.deepEqual(await fs.readdir(context.root), ["run.json"]);
});

test("CL-11 node executes a job below a path longer than 260 characters", async (t) => {
  const context = await workspace(t);
  const root = path.join(context.root, ...Array.from({ length: 8 }, (_, index) => `${index}-long & 全角 空白 directory`));
  await fs.mkdir(root, { recursive: true }); const nested = { ...context, root, requestDirectory: root };
  const job = await fakeJob(nested); assert.ok(path.join(job, "runtime/scripts/qc.mjs").length > 260);
  const result = await execute(nested, "qc", { job: "job & 全角 空白", stage: "pre", wait_ms: 10000 });
  if (!result.ok) t.diagnostic(JSON.stringify(await execute(nested, "run_get", { job: "job & 全角 空白", run_id: result.run!.id })));
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.run?.status, "completed");
});

test("setup executes npm JavaScript directly for install then ci without runtime dependencies", async (t) => {
  const context = await workspace(t); const job = await fakeJob(context), relative = "job & 全角 空白";
  await fs.writeFile(path.join(job, "package.json"), JSON.stringify({ name: "host-setup-fixture", version: "1.0.0", private: true }));
  await fs.writeFile(path.join(job, ".npmrc"), "audit=false\nfund=false\nupdate-notifier=false\n");
  assert.equal((await runCommand(job, "setup", { job: relative })).args[1], "install");
  let result = await execute(context, "setup", { job: relative, wait_ms: 50000 });
  if (!result.ok) t.diagnostic(JSON.stringify(await execute(context, "run_get", { job: relative, run_id: result.run!.id })));
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.run?.exit_code, 0);
  assert.equal((await runCommand(job, "setup", { job: relative })).args[1], "ci");
  result = await execute(context, "setup", { job: relative, wait_ms: 50000 }); assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.run?.exit_code, 0);
});

test("MCP engine authorization prevents voice and doctor from contacting unapproved hosts", async (t) => {
  const context = await workspace(t); const job = await fakeJob(context), relative = "job & 全角 空白";
  const file = path.join(job, "project.json"); const project = JSON.parse(await fs.readFile(file, "utf8"));
  project.voice = { engine: "aivis", engine_url: "http://unapproved.invalid:10101", style_id: 1 };
  await fs.writeFile(file, JSON.stringify(project));
  const result = await execute(context, "voice", { job: relative, wait_ms: 0 }); assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, "E_DISABLED");
  assert.deepEqual(await listRuns(context, relative), []);
  const report = await doctor(context, relative); const aivis = report.checks.find((check) => check.id === "aivis"); assert.equal(aivis?.available, false); assert.match(aivis!.message, /接続先が許可されていません/);
});

test("schema checker rejects missing hints wrong run states result types and unknown operation keys", async (t) => {
  const context = await workspace(t);
  assert.ok(schemaIssues(schemas.envelope, { schema: "smm.envelope/1", ok: false, command: "qc", error: { code: "E_INTERNAL", message: "失敗" } }, schemaRegistry).length);
  assert.ok(schemaIssues(schemas.run, { schema: "smm.run/1", status: "success" }, schemaRegistry).length);
  assert.ok(schemaIssues(schemas.envelope, { schema: "smm.envelope/1", ok: true, command: "stats", result: {}, advisories: [], warnings: [] }, schemaRegistry).length);
  const invalid = { job: "job", target: "preview", arbitrary: true } as OperationInputs["render"];
  const result = await execute(context, "render", invalid); assert.equal(result.ok, false); if (!result.ok) { assert.equal(result.error.code, "E_INPUT_INVALID"); assert.deepEqual(result.error.details, [{ pointer: "/arbitrary", reason: "未知のキーです。" }]); }
});

test("run argv only admits declared options and preserves spaces ampersands and equals validation", async (t) => {
  const context = await workspace(t); const job = await fakeJob(context);
  const image = await runCommand(job, "imagegen", { job: "job", name: "asset", prompt: "空白 & 日本語", timeout: 12, refs: ["assets/a.png"], force: true });
  assert.deepEqual(image.args.slice(1), ["--name", "asset", "--prompt", "空白 & 日本語", "--ref", "assets/a.png", "--timeout", "12", "--force"]);
  assert.equal(image.cwd, path.join(job, "runtime"));
  assert.deepEqual((await runCommand(job, "validate", { job: "job", final: true, double_render: true })).args.slice(1), ["--final", "--double-render"]);
  const invalid = await execute(context, "ghost_check", { job: "job & 全角 空白", video: "output/a=b.mp4" }); assert.equal(invalid.ok, false); if (!invalid.ok) assert.equal(invalid.error.code, "E_INPUT_INVALID");
});
