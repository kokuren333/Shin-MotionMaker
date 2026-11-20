import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { defaults, formChoices, validateRequest } from "../src/core/index.ts";
import { operations } from "../src/host/index.ts";
import { cli } from "./helpers/cli.ts";
import { fakeJob, workspace } from "./helpers/host.ts";
import { connectMcp, envelope } from "./helpers/mcp.ts";

test("M7-fix shape checks existing choices only when validateForm checks them", () => {
  for (const videoMode of ["mv", "explanation"] as const) for (const characterMode of ["solo", "duo"] as const) {
  for (const [key, choices] of Object.entries(formChoices)) {
    const nested = key === "secondCharacter";
    const allowed = nested ? formChoices.secondCharacter.position : choices as readonly unknown[];
    for (const value of [...allowed, "unknown", "toString", ...(key === "fps" ? [29] : [])]) {
      const form = { ...defaults, videoMode, characterMode, ...(nested ? { secondCharacter: { ...defaults.secondCharacter, position: value } } : { [key]: value }) };
      const shaped = validateRequest({ form }, { phase: "shape" });
      const ignored = videoMode === "mv" && ["styleMode", "characterPosition", "secondCharacter"].includes(key) || nested && characterMode !== "duo";
      assert.equal(shaped.ok, ignored || allowed.includes(value), `${videoMode}/${characterMode}/${key}: ${value}`);
      if (!shaped.ok) {
        assert.equal(shaped.error.code, "E_INPUT_INVALID");
        assert.equal((shaped.error.details as { pointer: string }[])[0].pointer, `/form/${nested ? "secondCharacter/position" : key}`);
        assert.deepEqual(validateRequest({ form }, { phase: "complete", assets: { sources: [] } }), shaped);
      }
    }
  }
  }
  for (const field of [{ styleMode: "unknown" }, { characterPosition: "top" }, { secondCharacter: { position: "middle" } }])
    assert.equal(validateRequest({ form: { videoMode: "mv", ...field } }, { phase: "shape" }).ok, true);
  const wrongObject = validateRequest({ form: { secondCharacter: "wrong" } }, { phase: "shape" });
  assert.deepEqual(!wrongObject.ok && wrongObject.error.details, [{ pointer: "/form/secondCharacter", reason: "オブジェクトを指定してください。" }]);
  assert.ok(validateRequest({ form: { design: "自由な未登録の演出", instructions: "自由", title: "" } }, { phase: "shape" }).ok);
});

test("M7 CLI and MCP reject fixed choices through core before reading attachments or writing", async (t) => {
  const context = await workspace(t);
  const connection = await connectMcp(context.root);
  t.after(() => connection.close());
  for (const form of [{ videoMode: "film" }, { styleMode: "toString" }, { tempo: "x" }, { fps: 29 }, { characterMode: "duo", secondCharacter: { position: "middle" } }]) {
    const request = { form, assets: { sources: ["missing.pdf"] } };
    await fs.writeFile(path.join(context.root, "request.json"), JSON.stringify(request));
    const local = await cli(["generate", "request.json", "--out", "absent"], context.root, true);
    const remote = envelope(await connection.call("job_generate", { request, out: "absent" }));
    assert.equal(local.code, 2); assert.ok(!local.envelope.ok && !remote.ok);
    assert.equal(remote.error.code, "E_INPUT_INVALID");
    assert.deepEqual(local.envelope.error, remote.error);
    await assert.rejects(fs.access(path.join(context.root, "absent")));
  }
});

test("M7-fix inactive choices survive complete validation and CLI MCP schemas", async (t) => {
  const context = await workspace(t);
  const connection = await connectMcp(context.root); t.after(() => connection.close());
  await fs.writeFile(path.join(context.root, "music.wav"), "fixture music");
  await fs.writeFile(path.join(context.root, "script.txt"), "自由な台本");
  for (const inactive of [
    { videoMode: "mv", styleMode: "bogus", characterPosition: "center", characterMode: "duo", secondCharacter: { position: "center" }, musicDurationSec: 30 },
    { videoMode: "explanation", characterMode: "solo", secondCharacter: { position: "center" } },
  ]) {
    const request = { form: { title: "互換", description: "原典で未使用の設定", audience: "開発者", voiceEngine: "none", ...inactive },
      ...(inactive.videoMode === "mv" ? { assets: { music: "music.wav" } } : {}) };
    const complete = validateRequest(request, { phase: "complete", assets: { sources: [], ...(inactive.videoMode === "mv" ? {
      music: { name: "music.wav", data: new Uint8Array([1]), size: 1, type: "audio/wav" },
    } : {}) } });
    assert.ok(complete.ok, JSON.stringify(complete));
    await fs.writeFile(path.join(context.root, "request.json"), JSON.stringify(request));
    const local = await cli(["generate", "request.json", "--out", "unused", "--dry-run"], context.root, true);
    const remote = envelope(await connection.call("job_generate", { request, out: "unused", dry_run: true }));
    assert.equal(local.code, 0, local.stdout); assert.ok(remote.ok, JSON.stringify(remote));
    const stats = envelope(await connection.call("text_stats", { kind: "script", text: "自由な台本", request }));
    assert.ok(stats.ok, JSON.stringify(stats));
    assert.equal((await cli(["stats", "script.txt", "--kind", "script", "--request", "request.json"], context.root, true)).code, 0);
  }
});

test("TS-05 every shared synchronous read operation returns equal CLI and MCP results", async (t) => {
  const context = await workspace(t);
  await fakeJob(context);
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} --import="${new URL("./fixtures/doctor-disk.mjs", import.meta.url).href}"`;
  const connection = await connectMcp(context.root, [], undefined, env);
  t.after(() => connection.close());
  const job = "job & 全角 空白";
  await fs.mkdir(path.join(context.root, job, "plan"), { recursive: true });
  await fs.writeFile(path.join(context.root, job, "plan/direction.md"), "自由な方向性\n");
  await fs.writeFile(path.join(context.root, "text.txt"), "一行\n二行");
  const run = await cli(["qc", job, "--stage", "pre"], context.root, true);
  assert.ok(run.envelope.ok && run.envelope.run);
  const run_id = run.envelope.run.id;
  const cases: { id: string; args: string[]; input: Record<string, unknown> }[] = [
    { id: "candidates", args: ["candidates", "--mode", "explanation", "--seed", "42"], input: { mode: "explanation", seed: 42 } },
    { id: "candidates", args: ["candidates", "--mode", "mv", "--seed", "42"], input: { mode: "mv", seed: 42 } },
    ...["lyrics", "script"].map((kind) => ({ id: "stats", args: ["stats", "text.txt", "--kind", kind], input: { kind, text: "一行\n二行" } })),
    { id: "status", args: ["status", job], input: { job } },
    { id: "project_get", args: ["project", "get", job], input: { job } },
    { id: "project_get", args: ["project", "get", job, "--pointer", "/title"], input: { job, pointer: "/title" } },
    { id: "report", args: ["report", job, "plan/direction.md"], input: { job, path: "plan/direction.md" } },
    ...["get", "wait", "logs"].map((alias) => ({ id: "run_get", args: ["runs", alias, job, run_id, "--log-tail", "0"], input: { job, run_id, log_tail: 0 } })),
    { id: "run_list", args: ["runs", "list", job], input: { job } },
    { id: "doctor", args: ["doctor", job], input: { job } },
    { id: "schema", args: ["schema"], input: {} },
    { id: "schema", args: ["schema", "request"], input: { name: "request" } },
    { id: "seedance_list", args: ["seedance", "list", job], input: { job } },
  ];
  assert.deepEqual([...new Set(cases.map(({ id }) => id))].sort(), operations.filter((op) => op.kind === "read" && op.mcp).map((op) => op.id).sort());
  for (const scenario of cases) {
    const local = await cli(scenario.args, context.root, true, env);
    const definition = operations.find((op) => op.id === scenario.id)!;
    const remote = envelope(await connection.call(definition.mcp!, scenario.input));
    assert.equal(local.code, 0, local.stdout + local.stderr);
    assert.ok(local.envelope.ok && remote.ok, JSON.stringify(remote));
    assert.deepEqual(local.envelope.result, remote.result, scenario.args.join(" "));
  }
});
