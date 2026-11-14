import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { cliCommands, parseCommand } from "../src/cli/commands.ts";
import { operations, schemas, execute } from "../src/host/index.ts";
import { cliContext } from "../src/cli/index.ts";
import { cli, cliMain } from "./helpers/cli.ts";
import { fakeJob, workspace } from "./helpers/host.ts";

test("TS-05 CLI registers every operation and alias from the shared table", () => {
  assert.deepEqual(cliCommands.map(({ command }) => command), operations.flatMap((definition) => definition.cli));
  assert.ok(operations.filter((definition) => definition.mcp === null).every((definition) => definition.cliOnlyReason));
  assert.deepEqual(parseCommand(["imagegen", "job", "--name", "asset", "--prompt", "空白 & 日本語", "--ref", "assets/a.png", "--ref", "sources/b.png", "--timeout", "12", "--strict"]).input,
    { job: "job", name: "asset", prompt: "空白 & 日本語", refs: ["assets/a.png", "sources/b.png"], timeout: 12, strict: true });
  assert.equal(parseCommand(["ghost-check", "job", "--tile-threshold", "0.125", "--min-tiles", "2", "--no-stills"]).input.no_stills, true);
  assert.throws(() => parseCommand(["candidates", "--mode", "mv", "--count", "NaN"]));
  assert.throws(() => parseCommand(["qc", "job", "--stage", "pre", "--detach", "--detach"]));
});

test("TS-03 request schema snapshot keeps free text and the original field types", async () => {
  const snapshot = JSON.parse(await fs.readFile(new URL("./fixtures/request-schema.snapshot.json", import.meta.url), "utf8"));
  assert.deepEqual(schemas.request, snapshot);
  const form = (schemas.request.properties as any).form.properties;
  for (const field of ["design", "instructions", "differentiation", "explainerDifferentiation", "takeaway", "priorKnowledge", "outline", "musicMood", "diagramPolicy", "audioNotes", "voiceNotes", "characterNotes"])
    assert.deepEqual(form[field], { type: "string" }, field);
});

test("TS-02 foreground streams child output only to stderr and preserves ok versus verdict for exits zero through four", async (t) => {
  const context = await workspace(t); const job = await fakeJob(context);
  for (const [scenario, code, ok, verdict] of [["pass", 0, true, "pass"], ["fail", 1, true, "fail"], ["crash", 4, false, undefined]] as const) {
    const project = JSON.parse(await fs.readFile(path.join(job, "project.json"), "utf8")); project.fixture = { scenario };
    await fs.writeFile(path.join(job, "project.json"), JSON.stringify(project));
    const result = await cli(["validate", job], context.root);
    assert.equal(result.code, code, result.stdout); assert.equal(result.envelope.ok, ok);
    if (result.envelope.ok) assert.equal(result.envelope.result.verdict, verdict);
    else assert.equal(result.envelope.error.code, "E_INTERNAL");
    assert.match(result.stderr, scenario === "crash" ? /fixture failure/ : /OK project/);
    assert.ok(result.stdout.startsWith('{"schema":"smm.envelope/1"'));
  }
  const input = await cli(["qc", job, "--stage", "invalid"], context.root);
  assert.equal(input.code, 2);
  const absent = await cli(["status", "missing"], context.root); assert.equal(absent.code, 3);
  assert.ok(!absent.envelope.ok); assert.equal(absent.envelope.error.code, "E_JOB_NOT_FOUND");
});

test("TS-02 detach survives the CLI and wait uses terminal exit while get logs list and cancel return retrieval success", async (t) => {
  const context = await workspace(t); const job = await fakeJob(context, { scenario: "fail" });
  const script = path.join(job, "runtime/scripts/qc.mjs");
  const body = await fs.readFile(script, "utf8");
  await fs.writeFile(script, `while (!await import("node:fs/promises").then((fs) => fs.access(new URL("../../release", import.meta.url)).then(() => true, () => false))) await new Promise((resolve) => setTimeout(resolve, 50));\n` + body);
  const started = await cli(["qc", job, "--stage", "pre", "--detach"], context.root);
  assert.equal(started.code, 0); assert.equal(started.envelope.run?.status, "running");
  const id = started.envelope.run!.id; assert.match(id, /^r-\d{8}T\d{6}Z-[a-f0-9]{8}$/);
  await fs.writeFile(path.join(job, "release"), "continue\n");
  const waited = await cli(["runs", "wait", job, id], context.root);
  assert.equal(waited.code, 1); assert.equal(waited.envelope.command, "runs wait"); assert.ok(waited.envelope.ok); assert.equal(waited.envelope.result.verdict, "fail");
  for (const command of ["get", "logs", "cancel"]) {
    const result = await cli(["runs", command, job, id], context.root); assert.equal(result.code, 0); assert.equal(result.envelope.command, `runs ${command}`);
  }
  assert.equal((await cli(["runs", "list", job], context.root)).code, 0);
  const crashed = await fakeJob(context, { scenario: "crash" });
  const crash = await cli(["qc", crashed, "--stage", "pre", "--detach"], context.root);
  assert.equal(crash.code, 0, crash.stdout); assert.ok(crash.envelope.ok);
  const waitCrash = await cli(["runs", "wait", crashed, crash.envelope.run!.id], context.root);
  assert.equal(waitCrash.code, 4); assert.ok(waitCrash.envelope.ok); assert.equal(waitCrash.envelope.run!.error?.code, "E_INTERNAL");
});

test("TS-02 advisory-only execution exits zero and CLI results match shared operations", async (t) => {
  const context = await workspace(t); const job = await fakeJob(context);
  const result = await cli(["qc", job, "--stage", "pre"], context.root);
  assert.equal(result.code, 0); assert.ok(result.envelope.ok); assert.equal(result.envelope.advisories.length, 1);
  const candidates = await cli(["candidates", "--mode", "explanation", "--seed", "42", "--count", "2"], context.root);
  const shared = await execute(cliContext(context.root), "candidates", { mode: "explanation", seed: 42, count: 2 });
  assert.ok(shared.ok && candidates.envelope.ok); assert.deepEqual(candidates.envelope.result, shared.result);
  const version = await cli(["version"], context.root, true); assert.equal(version.code, 0); assert.ok(version.envelope.ok); assert.equal(version.envelope.result.version, "0.1.0");
  const disabled = await cli(["mcp", "serve", "--root", context.root], context.root); assert.equal(disabled.code, 3); assert.ok(!disabled.envelope.ok); assert.equal(disabled.envelope.error.code, "E_DISABLED");
});

test("CLI reads BOM text patch and request files returns PNG base64 and offers a human summary", async (t) => {
  const context = await workspace(t); const job = await fakeJob(context);
  await fs.writeFile(path.join(context.root, "text.txt"), "\uFEFF# 台本\n本文です。\n");
  await fs.writeFile(path.join(context.root, "request.json"), '\uFEFF{"form":{"instructions":"自由な指示"}}');
  const stats = await cli(["stats", "text.txt", "--kind", "script", "--request", "request.json"], context.root); assert.equal(stats.code, 0);
  const get = await cli(["project", "get", job], context.root); assert.ok(get.envelope.ok);
  await fs.writeFile(path.join(context.root, "patch.json"), '\uFEFF{"title":"更新"}');
  const patch = await cli(["project", "patch", job, "patch.json", "--expect-sha256", get.envelope.result.sha256], context.root); assert.equal(patch.code, 0);
  const pointer = await cli(["project", "get", job, "--pointer", "/title"], context.root); assert.ok(pointer.envelope.ok); assert.equal(pointer.envelope.result.project, "更新");
  await fs.mkdir(path.join(job, "output")); const bytes = new Uint8Array([137, 80, 78, 71, 0, 255]); await fs.writeFile(path.join(job, "output/still.png"), bytes);
  const png = await cli(["report", job, "output/still.png"], context.root); assert.ok(png.envelope.ok); assert.equal(png.envelope.result.encoding, "base64"); assert.deepEqual(new Uint8Array(Buffer.from(png.envelope.result.data, "base64")), bytes);
  const text = await new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", cliMain, "version", "--human"], { shell: false, windowsHide: true }); let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; }); child.once("error", reject); child.once("close", (code) => { assert.equal(code, 0); resolve(output); });
  });
  assert.match(text, /実行結果を取得しました/);
});

test("CLI setup installs and reuses a workspace lock below spaces ampersands and Japanese characters", async (t) => {
  const context = await workspace(t); const job = await fakeJob(context);
  await fs.writeFile(path.join(job, "package.json"), JSON.stringify({ name: "cli-setup-fixture", private: true, workspaces: ["runtime"] }));
  await fs.writeFile(path.join(job, "runtime/package.json"), JSON.stringify({ name: "cli-setup-runtime", version: "1.0.0", private: true }));
  await fs.writeFile(path.join(job, ".npmrc"), "audit=false\nfund=false\nupdate-notifier=false\n");
  for (const command of ["install", "ci"]) {
    const result = await cli(["setup", job], context.root);
    assert.equal(result.code, 0, result.stdout + result.stderr); assert.equal(result.envelope.run?.script_exit_code, 0);
    assert.ok((await fs.stat(path.join(job, "package-lock.json"))).isFile(), command);
  }
});

test("CLI foreground drains each UTF-8 log byte once including an incomplete character", async (t) => {
  const context = await workspace(t); const job = await fakeJob(context);
  await fs.writeFile(path.join(job, "runtime/scripts/qc.mjs"), `import fs from "node:fs/promises";
const bytes = Buffer.from("流れ\\n");
process.stdout.write(bytes.subarray(0, 2));
await new Promise((resolve) => setTimeout(resolve, 300));
process.stdout.write(bytes.subarray(2));
process.stderr.write("注意\\n");
await new Promise((resolve) => setTimeout(resolve, 300));
await fs.mkdir("../reports", { recursive: true });
await fs.writeFile("../reports/qc-pre.json", JSON.stringify({ kind: "biim-explainer-qc", stage: "pre", verdict: "pass", gates: [], advisories: [], inputs: {} }));
`);
  const result = await cli(["qc", job, "--stage", "pre"], context.root);
  assert.equal(result.code, 0, result.stdout); assert.equal(result.stderr, "流れ\n注意\n");
});
