import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { execute } from "../src/host/index.ts";
import { cliContext } from "../src/cli/index.ts";
import { workspace } from "./helpers/host.ts";
import { cli } from "./helpers/cli.ts";

test("M0-Q3 real scripts pin raw exits against CLI normalization without Remotion", async (t) => {
  const context = await workspace(t);
  const generated = await execute(cliContext(context.root), "generate", { request: { form: { title: "job & 全角 空白", description: "実スクリプト確認", audience: "開発者", voiceEngine: "none", generateAudio: false } }, out: "." });
  assert.ok(generated.ok); const job = path.join(context.root, generated.result.job!);
  async function raw(script: string, args: string[], expected: number, env = process.env) {
    const code = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(process.execPath, [`scripts/${script}.mjs`, ...args], { cwd: path.join(job, "runtime"), env, shell: false, windowsHide: true, stdio: "ignore" });
      child.once("error", reject); child.once("close", resolve);
    });
    assert.equal(code, expected, `${script} ${args.join(" ")}`);
  }
  async function normalized(args: string[], expected: number, error?: string, env = process.env) {
    const result = await cli(args, context.root, false, env); assert.equal(result.code, expected, result.stdout + result.stderr);
    if (error) { assert.ok(!result.envelope.ok); assert.equal(result.envelope.error.code, error); }
    return result;
  }
  await raw("qc", ["--stage=invalid"], 2);
  await normalized(["qc", job, "--stage", "invalid"], 2, "E_INPUT_INVALID");
  await raw("qc", ["--stage=pre"], 1);
  const qc = await normalized(["qc", job, "--stage", "pre"], 1); assert.ok(qc.envelope.ok); assert.equal(qc.envelope.result.verdict, "fail");
  await raw("aivis", [], 0); await normalized(["voice", job], 0);
  await raw("sound-design", [], 0); await normalized(["sound", job], 0);
  await raw("ghost-check", ["--target=preview"], 1); await normalized(["ghost-check", job, "--target", "preview"], 2, "E_INPUT_INVALID");
  await raw("run", ["unknown"], 1); await raw("run", ["preview"], 1); await normalized(["render", job, "--target", "preview"], 3, "E_DEPS_MISSING");
  const env = { ...process.env, CODEX_BIN: path.join(context.root, "absent-codex.mjs") };
  await raw("imagegen", ["--name", "raw", "--prompt", "抽象図"], 0, env);
  await raw("imagegen", ["--name", "raw-strict", "--prompt", "抽象図", "--strict"], 1, env);
  const image = await normalized(["imagegen", job, "--name", "skipped", "--prompt", "抽象図"], 0, undefined, env);
  assert.ok(image.envelope.ok); assert.ok(image.envelope.advisories.length); assert.equal(image.envelope.result.verdict, undefined);
  const strict = await normalized(["imagegen", job, "--name", "strict", "--prompt", "抽象図", "--strict"], 1, undefined, env);
  assert.ok(strict.envelope.ok); assert.equal(strict.envelope.result.verdict, "fail");
  const projectFile = path.join(job, "project.json"); const project = JSON.parse(await fs.readFile(projectFile, "utf8"));
  await fs.writeFile(projectFile, JSON.stringify({ ...project, voice: { ...project.voice, engine: "unsupported" } }));
  await raw("aivis", [], 1); await normalized(["voice", job], 2, "E_INPUT_INVALID");
  await fs.writeFile(projectFile, JSON.stringify({ ...project, audio: { ...project.audio, generate_bgm_se: true } }));
  await fs.writeFile(path.join(job, "plan/sound-design.json"), '{"cues":[]}');
  await raw("sound-design", [], 1); await normalized(["sound", job], 2, "E_INPUT_INVALID");
  await fs.writeFile(projectFile, JSON.stringify(project));
  const report = path.join(job, "reports/qc-review.md"); await fs.mkdir(report);
  await raw("qc", ["--stage=pre"], 2); await normalized(["qc", job, "--stage", "pre"], 4, "E_INTERNAL");
  await fs.rmdir(report);
  await fs.writeFile(projectFile, JSON.stringify({ ...project, mode: "mv" }));
  await raw("qc", ["--stage=pre"], 0);
  const mv = await normalized(["qc", job, "--stage", "pre"], 0); assert.ok(mv.envelope.ok); assert.equal(mv.envelope.result.verdict, "not_applicable");
});
