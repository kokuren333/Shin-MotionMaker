import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { execute, operations } from "../src/host/index.ts";
import { cliCommands } from "../src/cli/commands.ts";
import { cli, builtCliMain } from "./helpers/cli.ts";
import { fakeJob, workspace } from "./helpers/host.ts";
import { connectMcp, envelope, mcpWorkspace } from "./helpers/mcp.ts";

const jobName = "job & 全角 空白";
const request = { form: { title: "回帰試験", description: "M3 修正", audience: "開発者", voiceEngine: "none", generateAudio: false } };
const digest = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

function pngOfSize(size: number): Buffer {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1EAAAAASUVORK5CYII=", "base64");
  // A private ancillary chunk keeps the PNG valid at an exact transport boundary.
  const chunk = Buffer.alloc(size - png.length);
  chunk.writeUInt32BE(chunk.length - 12); chunk.write("sMMx", 4, "ascii");
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, chunk.length - 4);
  return Buffer.concat([png.subarray(0, -12), chunk, png.subarray(-12)]);
}

test("TS-04 default SDK buffer receives a 6 MiB PNG once and survives an oversized rejection; CLI keeps 8 MiB", async (t) => {
  const { context, call, messages } = await mcpWorkspace(t); const job = await fakeJob(context);
  await fs.mkdir(path.join(job, "output"));
  const data = pngOfSize(6 * 1024 * 1024), file = path.join(job, "output", "still.png");
  await fs.writeFile(file, data);
  const response = await call("report_get", { job: jobName, path: "output/still.png" });
  assert.equal(response.isError, false); assert.equal(response.content.length, 2);
  const result = response.structuredContent!.result as Record<string, unknown>;
  assert.equal(result.data, null); assert.equal(result.bytes, data.length); assert.equal(result.sha256, digest(data)); assert.equal(result.delivered_as, "image");
  const image = response.content[1]; assert.equal(image.type, "image");
  assert.deepEqual(Buffer.from(image.data, "base64"), data);
  const wire = JSON.stringify(messages.at(-1));
  assert.ok(Buffer.byteLength(wire) < 10 * 1024 * 1024);
  assert.equal(wire.split(image.data).length - 1, 1);
  await fs.writeFile(file, pngOfSize(data.length + 1));
  const denied = envelope(await call("report_get", { job: jobName, path: "output/still.png" }));
  assert.ok(!denied.ok); assert.equal(denied.error.code, "E_INPUT_INVALID"); assert.match(denied.error.hint, /smm report/);
  assert.ok(envelope(await call("project_get", { job: jobName })).ok);
  const cliData = pngOfSize(8 * 1024 * 1024); await fs.writeFile(file, cliData);
  const output = await cli(["report", jobName, "output/still.png"], context.root, true);
  assert.equal(output.code, 0); assert.ok(output.envelope.ok);
  assert.equal(output.envelope.result.encoding, "base64"); assert.deepEqual(Buffer.from(output.envelope.result.data, "base64"), cliData);
  await fs.writeFile(file, pngOfSize(cliData.length + 1));
  const oversizedCli = await cli(["report", jobName, "output/still.png"], context.root, true);
  assert.equal(oversizedCli.code, 2); assert.ok(!oversizedCli.envelope.ok); assert.equal(oversizedCli.envelope.error.code, "E_PATH_DENIED");
});

test("MC-01 built CLI mcp serve forwards every server flag through the SDK", async (t) => {
  const context = await workspace(t), outside = await workspace(t);
  await fs.writeFile(path.join(outside.root, "source.txt"), "添付");
  const connection = await connectMcp(context.root, ["--enable-generation", "--allow-dir", outside.root, "--allow-engine-host", "example.invalid"], [builtCliMain, "mcp", "serve"]);
  try {
    assert.ok((await connection.client.listTools()).tools.some((tool) => tool.name === "job_imagegen"));
    const generated = envelope<"generate">(await connection.call("job_generate", { request: { ...request, assets: { sources: [path.join(outside.root, "source.txt")] } }, out: ".", dry_run: true }));
    assert.ok(generated.ok);
    assert.equal(connection.stderr(), "");
  } finally { await connection.close(); }
  const readOnly = await connectMcp(context.root, ["--read-only", "--enable-generation"], [builtCliMain, "mcp", "serve"]);
  try { assert.ok((await readOnly.client.listTools()).tools.every((tool) => !["job_generate", "job_imagegen", "job_qc"].includes(tool.name))); }
  finally { await readOnly.close(); }
});

test("MC-04 read-only rejects valid write inputs without changing any root file", async (t) => {
  const context = await workspace(t), job = await fakeJob(context);
  const current = await execute(context, "project_get", { job: jobName }); assert.ok(current.ok);
  async function files(directory: string): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) for (const [key, value] of Object.entries(await files(target))) result[`${entry.name}/${key}`] = value;
      else result[entry.name] = digest(await fs.readFile(target));
    }
    return result;
  }
  const before = await files(context.root);
  const connection = await connectMcp(context.root, ["--read-only", "--enable-generation"]);
  try {
    for (const [name, input] of [
      ["job_generate", { request, out: "." }], ["job_generate", { request, out: ".", dry_run: true }],
      ["project_patch", { job: jobName, patch: { title: "変更" }, expect_sha256: current.result.sha256 }],
      ["run_cancel", { job: jobName, run_id: "r-20261114T101500Z-1234abcd" }],
      ["job_imagegen", { job: jobName, name: "still", prompt: "自由記述" }],
      ["job_setup", { job: jobName }], ["job_validate", { job: jobName }], ["job_qc", { job: jobName, stage: "pre" }],
      ["job_ghost_check", { job: jobName }], ["job_render", { job: jobName, target: "still" }],
      ["job_voice", { job: jobName }], ["job_sound", { job: jobName }],
    ] as const) {
      const denied = envelope(await connection.call(name, input)); assert.ok(!denied.ok); assert.equal(denied.error.code, "E_DISABLED", name);
    }
    assert.deepEqual(await files(context.root), before);
    assert.deepEqual(await fs.readdir(job), ["project.json", "runtime"]);
  } finally { await connection.close(); }
});

test("MC-02 MCP rejects in-job junctions symlinks hardlinks and hardlinked attachments", async (t) => {
  const { context, call } = await mcpWorkspace(t), outside = await workspace(t), job = await fakeJob(context);
  const secret = path.join(outside.root, "secret.txt"); await fs.writeFile(secret, "秘密");
  const reports = path.join(job, "reports"); await fs.mkdir(reports);
  for (const type of process.platform === "win32" ? ["junction", "dir"] as const : ["dir"] as const) {
    try { await fs.symlink(outside.root, path.join(reports, `leak-${type}`), type); }
    catch (error) { if (type === "dir" && (error as NodeJS.ErrnoException).code === "EPERM") { t.diagnostic("dir symlink は EPERM。ジョブ内 junction は実行済み。"); continue; } throw error; }
    const denied = envelope(await call("report_get", { job: jobName, path: `reports/leak-${type}/secret.txt` }));
    assert.ok(!denied.ok); assert.equal(denied.error.code, "E_PATH_DENIED");
  }
  await fs.link(secret, path.join(reports, "hard.txt")); await fs.link(secret, path.join(context.root, "attachment.txt"));
  for (const [name, input] of [["report_get", { job: jobName, path: "reports/hard.txt" }],
    ["job_generate", { request: { ...request, assets: { sources: ["attachment.txt"] } }, out: "." }]] as const) {
    const denied = envelope(await call(name, input)); assert.ok(!denied.ok); assert.equal(denied.error.code, "E_PATH_DENIED");
  }
  assert.equal(await fs.readFile(secret, "utf8"), "秘密");
});

test("R-1 MCP displays home job and root paths relatively in logs nested reports and report text", async (t) => {
  const { context, call } = await mcpWorkspace(t), job = await fakeJob(context);
  const source = `import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const job = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const root = path.dirname(job), home = os.homedir();
const homes = [...new Set([home, await fs.realpath(home)])].flatMap(value => [value, value.replaceAll("\\\\", "/"), pathToFileURL(value).href]);
if (process.platform === "win32") homes.push(...homes.map(value => value.toUpperCase()));
const detail = "ENOENT open '" + path.join(job, "plan", "direction.md") + "' root=" + root + " " + homes.map(value => value + "/npm-cache/log.txt").join(" ");
console.error(detail);
await fs.mkdir(path.join(job, "reports"), {recursive:true});
await fs.writeFile(path.join(job, "reports/qc-pre.json"), JSON.stringify({kind:"biim-explainer-qc", stage:"pre", verdict:"fail", gates:[{detail}], advisories:[{id:"fixture",detail}],inputs:{}, nested:{detail}}));
process.exitCode = 1;
`;
  await fs.writeFile(path.join(job, "runtime/scripts/qc.mjs"), source);
  const checked = envelope<"qc">(await call("job_qc", { job: jobName, stage: "pre" })); assert.ok(checked.ok); assert.equal(checked.result?.verdict, "fail");
  const id = checked.run!.id;
  const outputs = [checked, envelope(await call("run_get", { job: jobName, run_id: id })),
    envelope(await call("run_list", { job: jobName })), envelope(await call("job_status", { job: jobName })),
    envelope(await call("report_get", { job: jobName, path: "reports/qc-pre.json" }))];
  const prefixes = [context.root, job, os.homedir(), await fs.realpath(os.homedir())].flatMap(value => [value, value.replaceAll("\\", "/"), pathToFileURL(value).href]);
  for (const output of outputs) {
    assert.ok(output.ok);
    const wire = JSON.stringify(output).toLowerCase();
    for (const prefix of prefixes) {
      assert.ok(!wire.includes(prefix.toLowerCase())); assert.ok(!wire.includes(JSON.stringify(prefix).slice(1, -1).toLowerCase()));
    }
    assert.match(wire, /~[\\/]/); assert.match(wire, /direction\.md/);
  }
  const log = await fs.readFile(path.join(job, `.smm/runs/${id}/stderr.log`), "utf8");
  assert.ok(log.includes(os.homedir())); assert.ok(log.includes(job));
  const raw = JSON.parse(await fs.readFile(path.join(job, "reports/qc-pre.json"), "utf8"));
  assert.ok(raw.nested.detail.includes(job)); assert.ok(raw.nested.detail.includes(os.homedir()));
});

test("TS-05 CLI and MCP deterministic synchronous read results match at the same root", async (t) => {
  const { context, call } = await mcpWorkspace(t), job = await fakeJob(context);
  await fs.mkdir(path.join(job, "reports")); await fs.writeFile(path.join(job, "reports/note.txt"), "記録");
  await fs.writeFile(path.join(context.root, "text.txt"), "一行\n二行");
  await fs.writeFile(path.join(context.root, "request.json"), JSON.stringify(request));
  const completed = envelope<"qc">(await call("job_qc", { job: jobName, stage: "pre" })); assert.ok(completed.ok);
  assert.deepEqual(cliCommands.map(item => [item.operation.id, item.command]), operations.flatMap(operation => operation.cli.map(command => [operation.id, command])));
  for (const [name, input, args] of [
    ["direction_candidates", { mode: "explanation", seed: 417 }, ["candidates", "--mode", "explanation", "--seed", "417"]],
    ["text_stats", { kind: "lyrics", text: "一行\n二行" }, ["stats", "text.txt", "--kind", "lyrics"]],
    ["job_status", { job: jobName }, ["status", jobName]],
    ["project_get", { job: jobName }, ["project", "get", jobName]],
    ["report_get", { job: jobName, path: "reports/note.txt" }, ["report", jobName, "reports/note.txt"]],
    ["run_get", { job: jobName, run_id: completed.run!.id, log_tail: 0 }, ["runs", "get", jobName, completed.run!.id, "--log-tail", "0"]],
    ["run_list", { job: jobName }, ["runs", "list", jobName]],
    ["schema_get", {}, ["schema"]],
    ["schema_get", { name: "smm.envelope/1" }, ["schema", "smm.envelope/1"]],
    ["job_generate", { request, out: ".", dry_run: true }, ["generate", "request.json", "--out", ".", "--dry-run"]],
  ] as const) {
    const mcp = envelope(await call(name, input)), output = await cli([...args], context.root, true);
    assert.ok(mcp.ok); assert.ok(output.envelope.ok); assert.equal(output.code, 0);
    assert.deepEqual(mcp.result, output.envelope.result, name);
  }
  const doctor = envelope<"doctor">(await call("doctor", { job: jobName })), output = await cli(["doctor", jobName], context.root, true);
  assert.ok(doctor.ok); assert.ok(output.envelope.ok);
  // Free space is a live measurement; every other doctor field is compared exactly.
  const stable = (checks: typeof doctor.result.checks) => checks.map(check => check.id === "disk" ? { ...check, details: undefined } : check);
  assert.deepEqual(stable(doctor.result.checks), stable(output.envelope.result.checks));
});

test("P-3 host classifies a deeply nested patch as input error without changing the project", async (t) => {
  const { context, call } = await mcpWorkspace(t), job = await fakeJob(context);
  const before = await fs.readFile(path.join(job, "project.json"));
  const current = envelope<"project_get">(await call("project_get", { job: jobName })); assert.ok(current.ok);
  let patch: Record<string, unknown> = {};
  for (let depth = 0; depth < 5500; depth++) patch = { nested: patch };
  // SDK JSON.stringify reaches its own stack limit first; exercise the host boundary directly.
  const result = await execute(context, "project_patch", { job: jobName, patch: patch as import("../src/core/index.ts").JsonObject, expect_sha256: current.result.sha256 });
  assert.ok(!result.ok); assert.equal(result.error.code, "E_INPUT_INVALID");
  assert.deepEqual(await fs.readFile(path.join(job, "project.json")), before);
  assert.ok(envelope(await call("project_get", { job: jobName })).ok);
});
