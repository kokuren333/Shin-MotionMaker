import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { execute, operations, exposedOperations, listRuns } from "../src/host/index.ts";
import { toolDefinitions } from "../src/mcp/index.ts";
import { fakeJob, workspace } from "./helpers/host.ts";
import { mcpWorkspace, envelope, connectMcp, mcpEntry } from "./helpers/mcp.ts";
import { builtCliMain } from "./helpers/cli.ts";

const fixture = new URL("./fixtures/mcp-tools.json", import.meta.url);
const request = (title: string) => ({ form: { title, description: "往復試験", audience: "開発者", voiceEngine: "none" as const, generateAudio: false } });

test("TS-04 tools list matches the complete tool schema snapshot and operation table", async (t) => {
  const { context, client, messages } = await mcpWorkspace(t, ["--enable-generation"]);
  const { tools } = await client.listTools();
  const snapshot = JSON.parse(await fs.readFile(fixture, "utf8"));
  assert.deepEqual(tools, snapshot.tools.map((tool: object) => ({ ...tool, outputSchema: snapshot.outputSchema })));
  assert.deepEqual(tools, toolDefinitions({ ...context, enableGeneration: true }));
  assert.equal(tools.length, 20);
  assert.deepEqual(tools.map((tool) => tool.name), exposedOperations({ ...context, enableGeneration: true }).map((operation) => operation.mcp));
  for (const tool of tools) { assert.equal(tool.inputSchema.additionalProperties, false); assert.equal(tool.outputSchema?.type, "object"); assert.match(tool.description!, /[ぁ-んァ-ヶ一-龠]/); }
  assert.deepEqual(operations.filter((operation) => !operation.mcp).map((operation) => operation.id), ["studio", "mcp_serve", "version"]);
  for (const operation of operations.filter((operation) => !operation.mcp)) assert.ok(operation.cliOnlyReason);
  assert.equal(client.getServerVersion()?.name, "shin-motionmaker");
  const initialized = messages.find((message) => "result" in message && "protocolVersion" in message.result);
  assert.ok(initialized && "result" in initialized); assert.equal(initialized.result.protocolVersion, "2025-11-25");
});

test("TS-04 real explanation and MV jobs preserve QC verdicts without tool errors", async (t) => {
  const { context, call } = await mcpWorkspace(t);
  const title = "MCP & 全角 空白";
  const generated = envelope<"generate">(await call("job_generate", { request: request(title), out: "." }));
  assert.ok(generated.ok); const job = generated.result.job!;
  assert.equal(generated.result.file_count, 68);
  const status = envelope<"status">(await call("job_status", { job })); assert.ok(status.ok); assert.equal(status.result.deps.installed, false);
  for (const key of ["verdict", "score", "rank"]) assert.equal(Object.hasOwn(status.result, key), false);
  const project = envelope<"project_get">(await call("project_get", { job })); assert.ok(project.ok); assert.deepEqual(project.result.project, generated.result.project);
  const checked = envelope<"qc">(await call("job_qc", { job, stage: "pre" })); assert.ok(checked.ok); assert.equal(checked.result?.verdict, "fail"); assert.equal(checked.run?.exit_code, 1);
  const missing = envelope<"validate">(await call("job_validate", { job })); assert.ok(!missing.ok); assert.equal(missing.error.code, "E_DEPS_MISSING"); assert.equal(missing.run, undefined);
  assert.equal((await listRuns(context, job)).length, 1);
  await fs.copyFile(new URL("./fixtures/baseline-biimmotion-262c798/assets/song.wav", import.meta.url), path.join(context.root, "song.wav"));
  const mv = envelope<"generate">(await call("job_generate", { request: { form: { ...request("MV").form, videoMode: "mv", musicDurationSec: 12 }, assets: { music: "song.wav" } }, out: "." }));
  assert.ok(mv.ok);
  const mvQc = envelope<"qc">(await call("job_qc", { job: mv.result.job, stage: "pre" })); assert.ok(mvQc.ok); assert.equal(mvQc.result?.verdict, "not_applicable");
});

test("TS-05 MCP structured results equal host execute for identical deterministic inputs", async (t) => {
  const { context, call } = await mcpWorkspace(t);
  for (const [id, name, input] of [
    ["candidates", "direction_candidates", { mode: "explanation", seed: 417 }],
    ["stats", "text_stats", { kind: "lyrics", text: "一行\n二行" }],
    ["generate", "job_generate", { request: request("一致"), out: ".", dry_run: true }],
    ["schema", "schema_get", { name: "smm.envelope/1" }],
  ] as const) {
    const host = await execute(context, id, input); assert.ok(host.ok);
    const mcp = envelope(await call(name, input)); assert.ok(mcp.ok);
    assert.deepEqual(mcp.result, host.result);
  }
});

test("TS-06 candidate description and results say draft and omitted seeds vary", async (t) => {
  const { client, call } = await mcpWorkspace(t);
  assert.match((await client.listTools()).tools.find((tool) => tool.name === "direction_candidates")!.description!, /たたき台であり固定の正解ではない/);
  const results = [];
  for (let index = 0; index < 4; index++) {
    const result = envelope<"candidates">(await call("direction_candidates", { mode: "mv" })); assert.ok(result.ok);
    assert.match(result.result.message, /たたき台であり固定の正解ではない/);
    for (const key of ["verdict", "score", "rank"]) assert.equal(Object.hasOwn(result.result, key), false);
    results.push(result.result);
  }
  assert.ok(new Set(results.map((result) => result.seed)).size > 1);
  assert.ok(new Set(results.map((result) => JSON.stringify(result.candidates))).size > 1);
});

test("MC-04 read-only and generation flags filter publication and reject direct hidden calls", async (t) => {
  const context = await workspace(t);
  for (const flags of [[], ["--enable-generation"], ["--read-only"], ["--read-only", "--enable-generation"]]) {
    const connection = await connectMcp(context.root, flags);
    try {
      const tools = (await connection.client.listTools()).tools;
      const expected = exposedOperations({ ...context, readOnly: flags.includes("--read-only"), enableGeneration: flags.includes("--enable-generation") });
      assert.deepEqual(tools.map((tool) => tool.name), expected.map((operation) => operation.mcp));
      if (flags.includes("--read-only")) for (const operation of operations.filter((item) => item.mcp && !item.exposedInReadOnly)) {
        const denied = envelope(await connection.call(operation.mcp!, {})); assert.ok(!denied.ok); assert.equal(denied.error.code, "E_DISABLED");
      }
      if (!flags.includes("--enable-generation")) { const denied = envelope(await connection.call("job_imagegen", {})); assert.ok(!denied.ok); assert.equal(denied.error.code, "E_DISABLED"); }
      const unknown = envelope(await connection.call("execute_command", {})); assert.ok(!unknown.ok); assert.equal(unknown.error.code, "E_USAGE");
    } finally { await connection.close(); }
  }
});

test("MC-02 root-relative and realpath boundaries reject traversal absolute paths and links", async (t) => {
  const { context, call } = await mcpWorkspace(t);
  const outside = await workspace(t); await fakeJob(outside);
  for (const job of ["../escape", outside.root, "C:/escape", "//server/share", "job/../../escape"]) {
    const result = envelope(await call("project_get", { job })); assert.ok(!result.ok); assert.equal(result.error.code, "E_PATH_DENIED");
  }
  for (const type of process.platform === "win32" ? ["junction", "dir"] as const : ["dir"] as const) {
    const link = `escape-${type}`;
    try { await fs.symlink(outside.root, path.join(context.root, link), type); }
    catch (error) { if (type === "dir" && (error as NodeJS.ErrnoException).code === "EPERM") { t.diagnostic("ディレクトリ symlink は EPERM。junction の境界拒否を実測する。"); continue; } throw error; }
    const result = envelope(await call("project_get", { job: `${link}/job & 全角 空白` })); assert.ok(!result.ok); assert.equal(result.error.code, "E_PATH_DENIED");
    const write = envelope(await call("job_generate", { request: request("escape"), out: link })); assert.ok(!write.ok); assert.equal(write.error.code, "E_PATH_DENIED");
  }
});

test("MC-02 allow-dir permits only absolute request attachments and denies escaped realpaths", async (t) => {
  const context = await workspace(t), outside = await workspace(t), escaped = await workspace(t);
  await fs.writeFile(path.join(outside.root, "source.txt"), "資料");
  await fs.writeFile(path.join(escaped.root, "secret.txt"), "秘密");
  const connection = await connectMcp(context.root, ["--allow-dir", outside.root]);
  try {
    const input = { request: { ...request("添付"), assets: { sources: [path.join(outside.root, "source.txt")] } }, out: ".", dry_run: true };
    assert.ok(envelope(await connection.call("job_generate", input)).ok);
    for (const out of [outside.root, "../escape"]) { const result = envelope(await connection.call("job_generate", { ...input, out })); assert.ok(!result.ok); assert.equal(result.error.code, "E_PATH_DENIED"); }
    const result = envelope(await connection.call("project_get", { job: outside.root })); assert.ok(!result.ok); assert.equal(result.error.code, "E_PATH_DENIED");
    await fs.symlink(escaped.root, path.join(outside.root, "link"), process.platform === "win32" ? "junction" : "dir");
    const denied = envelope(await connection.call("job_generate", { ...input, request: { ...request("リンク"), assets: { sources: [path.join(outside.root, "link", "secret.txt")] } } })); assert.ok(!denied.ok); assert.equal(denied.error.code, "E_PATH_DENIED");
  } finally { await connection.close(); }
});

test("MC-01 invalid startup fails on stderr with no protocol stdout", async (t) => {
  const context = await workspace(t);
  const file = path.join(context.root, "file.txt"); await fs.writeFile(file, "root fixture");
  for (const [args, code] of [[[], "E_USAGE"], [["--root", context.root, "--unknown"], "E_USAGE"],
    [["--root", path.join(context.root, "absent")], "E_PATH_DENIED"], [["--root", file], "E_PATH_DENIED"],
    [["--root", context.root, "--allow-dir", path.join(context.root, "absent")], "E_PATH_DENIED"]] as const) {
    const output = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(process.execPath, [mcpEntry, ...args], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "", stderr = "";
      child.stdout.on("data", (data) => { stdout += data; }); child.stderr.on("data", (data) => { stderr += data; });
      child.once("error", reject); child.once("close", (code) => resolve({ code, stdout, stderr }));
    });
    assert.equal(output.code, 2); assert.equal(output.stdout, ""); assert.equal(JSON.parse(output.stderr).code, code); assert.ok(JSON.parse(output.stderr).hint);
    assert.equal(output.stderr.includes(context.root), false);
  }
});

test("MC-06 report PNG sends metadata in JSON and bytes only in the image block", async (t) => {
  const { context, call } = await mcpWorkspace(t); const job = await fakeJob(context);
  const data = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1EAAAAASUVORK5CYII=", "base64");
  await fs.mkdir(path.join(job, "output")); await fs.writeFile(path.join(job, "output", "still.png"), data);
  const response = await call("report_get", { job: "job & 全角 空白", path: "output/still.png" });
  assert.equal(response.content.length, 2); assert.deepEqual(response.content[1], { type: "image", mimeType: "image/png", data: data.toString("base64") });
  const result = (response.structuredContent as { result: Record<string, unknown> }).result;
  assert.equal(result.data, null); assert.equal(result.bytes, data.length); assert.equal(result.delivered_as, "image");
  assert.equal(result.sha256, createHash("sha256").update(data).digest("hex")); assert.equal(result.encoding, undefined);
  for (const name of ["project.json", "runtime/package.json", "../secret.txt"]) { const denied = envelope(await call("report_get", { job: "job & 全角 空白", path: name })); assert.ok(!denied.ok); assert.equal(denied.error.code, "E_PATH_DENIED"); }
});

test("MC-12 wait bounds unknown keys and log_tail bounds use host input validation", async (t) => {
  const { call } = await mcpWorkspace(t);
  for (const wait_ms of [-1, 50001, 0.5]) { const result = envelope(await call("job_qc", { job: "job", stage: "pre", wait_ms })); assert.ok(!result.ok); assert.equal(result.error.code, "E_INPUT_INVALID"); }
  for (const input of [{ log_tail: -1 }, { log_tail: 2001 }, { log_offset: 0 }, { arbitrary: true }]) { const result = envelope(await call("run_get", { job: "job", run_id: "run", ...input })); assert.ok(!result.ok); assert.equal(result.error.code, "E_INPUT_INVALID"); }
});

test("MC-05 and MC-15 host exclusion and token progress survive stdio waiting", async (t) => {
  const { context, call } = await mcpWorkspace(t); await fakeJob(context, { delay: 10000 });
  const job = "job & 全角 空白", notifications: unknown[] = [];
  const start = envelope<"qc">(await call("job_qc", { job, stage: "pre", wait_ms: 0 })); assert.ok(start.ok); assert.equal(start.run?.status, "running");
  const busy = envelope(await call("job_qc", { job, stage: "pre", wait_ms: 0 })); assert.ok(!busy.ok); assert.equal(busy.error.code, "E_BUSY", JSON.stringify(busy));
  const result = envelope<"run_get">(await call("run_get", { job, run_id: start.run!.id, wait_ms: 10000, log_tail: 100 }, (value) => notifications.push(value)));
  assert.ok(result.ok); assert.equal(result.run?.status, "completed"); assert.equal(result.result.verdict, "pass"); assert.ok(notifications.length > 0);
  const progress = notifications as { progress: number; message: string }[];
  assert.ok(progress.every((item, index) => index === 0 || item.progress > progress[index - 1].progress));
  const startProgress: unknown[] = [];
  const waited = envelope<"qc">(await call("job_qc", { job, stage: "pre", wait_ms: 10000 }, (value) => startProgress.push(value)));
  assert.ok(waited.ok); assert.equal(waited.result?.verdict, "pass"); assert.ok(startProgress.length > 0);
});

test("MC-04 and R-12 unapproved engine hosts are denied for voice and uncontacted by doctor", async (t) => {
  const { context, call } = await mcpWorkspace(t); const job = await fakeJob(context);
  const project = JSON.parse(await fs.readFile(path.join(job, "project.json"), "utf8"));
  project.voice = { engine: "aivis", engine_url: "http://unapproved.invalid:10101", style_id: 1 };
  await fs.writeFile(path.join(job, "project.json"), JSON.stringify(project));
  const denied = envelope(await call("job_voice", { job: "job & 全角 空白" })); assert.ok(!denied.ok); assert.equal(denied.error.code, "E_DISABLED");
  const report = envelope<"doctor">(await call("doctor", { job: "job & 全角 空白" })); assert.ok(report.ok);
  assert.match(report.result.checks.find((check) => check.id === "aivis")!.message, /接続先が許可されていません/);
  assert.deepEqual(await listRuns(context, "job & 全角 空白"), []);
});

test("MC-04 explicit engine host permission reaches only the local fixture engine", async (t) => {
  const address = Object.values(networkInterfaces()).flat().find((item) => item?.family === "IPv4" && !item.internal)?.address;
  if (!address) { t.skip("非ループバック IPv4 がないため接続許可の実疎通を実行できません。"); return; }
  const context = await workspace(t), job = await fakeJob(context);
  let requests = 0;
  const engine = createServer((request, response) => {
    assert.equal(request.url, "/speakers"); requests++;
    response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify([{ styles: [{ id: 1 }] }]));
  });
  await new Promise<void>((resolve, reject) => { engine.once("error", reject); engine.listen(0, address, resolve); });
  t.after(() => new Promise<void>((resolve) => engine.close(() => resolve())));
  const port = (engine.address() as { port: number }).port;
  const project = JSON.parse(await fs.readFile(path.join(job, "project.json"), "utf8"));
  project.voice = { engine: "aivis", engine_url: `http://${address}:${port}`, style_id: 1 };
  await fs.writeFile(path.join(job, "project.json"), JSON.stringify(project));
  const denied = await connectMcp(context.root);
  try {
    const voice = envelope(await denied.call("job_voice", { job: "job & 全角 空白" })); assert.ok(!voice.ok); assert.equal(voice.error.code, "E_DISABLED");
    await denied.call("doctor", { job: "job & 全角 空白" }); assert.equal(requests, 0);
  } finally { await denied.close(); }
  const permitted = await connectMcp(context.root, ["--allow-engine-host", address], [builtCliMain, "mcp", "serve"]);
  try {
    const doctor = envelope<"doctor">(await permitted.call("doctor", { job: "job & 全角 空白" })); assert.ok(doctor.ok);
    assert.equal(doctor.result.checks.find((check) => check.id === "aivis")?.available, true); assert.equal(requests, 1);
    const voice = envelope<"voice">(await permitted.call("job_voice", { job: "job & 全角 空白", wait_ms: 10000 })); assert.ok(voice.ok); assert.equal(voice.run?.status, "completed"); assert.ok(requests >= 2);
  } finally { await permitted.close(); }
});

test("MC-13 detached MCP runs remain queryable after the stdio server restarts", async (t) => {
  const context = await workspace(t); const job = await fakeJob(context);
  const script = path.join(job, "runtime/scripts/qc.mjs");
  const body = await fs.readFile(script, "utf8");
  // Complete only after the replacement server has observed the surviving run.
  await fs.writeFile(script, `while (!await import("node:fs/promises").then((fs) => fs.access(new URL("../../release", import.meta.url)).then(() => true, () => false))) await new Promise((resolve) => setTimeout(resolve, 50));\n` + body);
  const first = await connectMcp(context.root);
  let id: string;
  try {
    const result = envelope<"qc">(await first.call("job_qc", { job: "job & 全角 空白", stage: "pre", wait_ms: 0 }));
    assert.ok(result.ok, JSON.stringify(result)); assert.equal(result.run?.status, "running"); id = result.run!.id;
  } finally { await first.close(); }
  const second = await connectMcp(context.root, ["--read-only"]);
  try {
    const surviving = envelope<"run_get">(await second.call("run_get", { job: "job & 全角 空白", run_id: id, wait_ms: 0, log_tail: 0 }));
    assert.ok(surviving.ok, JSON.stringify(surviving)); assert.equal(surviving.run?.status, "running");
    await fs.writeFile(path.join(job, "release"), "continue\n");
    const result = envelope<"run_get">(await second.call("run_get", { job: "job & 全角 空白", run_id: id, wait_ms: 50000, log_tail: 0 }));
    assert.ok(result.ok, JSON.stringify(result)); assert.equal(result.run?.status, "completed"); assert.equal(result.result.verdict, "pass");
    const listed = envelope<"run_list">(await second.call("run_list", { job: "job & 全角 空白" })); assert.ok(listed.ok); assert.equal(listed.result.runs[0].id, id);
  } finally { await second.close(); }
});
