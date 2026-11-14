import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { createProject, defaults, switchVideoMode, parseInspectionReport, type ValidateReport } from "../src/core/index.ts";
import { readJson, repository } from "./helpers/templates.ts";

test("R4 JSON preserves original stdout stderr and exit codes for pass fail SKIP and GHOST", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "smm validate & 全角 "));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    await fs.rm(directory, { recursive: true, force: true });
  });
  const scripts = path.join(directory, "runtime/scripts");
  await fs.cp(path.join(repository, "job-template/runtime/scripts"), scripts, { recursive: true });
  await fs.symlink(path.join(repository, "node_modules"), path.join(directory, "node_modules"), "junction");
  const write = async (name: string, body: string | Uint8Array) => {
    const filename = path.join(directory, name);
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, body);
  };
  const patched = await fs.readFile(path.join(scripts, "validate.mjs"), "utf8");
  const diffs = await readJson("allowed-diffs.json");
  const rule = diffs.rules.find((entry: { id: string }) => entry.id === "R4");
  let original = patched;
  for (const append of rule.appends) original = original.slice(0, -append.text.length);
  for (const pair of [...rule.replacements].reverse()) original = original.replaceAll(pair.to, pair.from);
  await write("runtime/tsconfig.json", JSON.stringify({ compilerOptions: { types: [], skipLibCheck: true }, files: ["check.ts"] }));
  await write("runtime/check.ts", "export const value = 1;\n");
  const input = { ...defaults, title: "report fixture", description: "検査結果", audience: "開発者", voiceEngine: "none" as const };
  const project = createProject(switchVideoMode(input, "mv"), { sources: [] });
  project.audio.music = "assets/music.wav";
  project.audio.music_duration_sec = 6;
  Object.assign(project, { scenes: [{ id: "s1", duration_sec: 6 }] });
  await write("project.json", JSON.stringify(project));
  for (const font of Object.values(project.layout.fonts)) await write(font.path, "fixture font");
  await write("assets/music.wav", new Uint8Array([1]));
  for (const name of ["plan/music-analysis.md", "plan/direction.md", "plan/storyboard.md", "plan/sources.md", "reports/visual-qa.md", "reports/delivery.md"])
    await write(name, "Completion record for a synthetic report fixture. ".repeat(3));
  const mp4 = Buffer.alloc(2048); mp4.write("ftyp", 4);
  for (const name of ["preview", "final"]) await write(`output/${name}.mp4`, mp4);
  const cases = [
    { args: [], ghost: { skipped: "fixture skipped" }, fail: false },
    { args: ["--final"], ghost: { skipped: "fixture skipped" }, fail: false },
    { args: ["--final"], ghost: { singleFrameEvents: [{ time: "0:01" }] }, fail: false },
    { args: ["--final", "--double-render"], ghost: { singleFrameEvents: [], classification: { isolatedCount: 0, clusteredEventCount: 0, clusteredRunCount: 0 }, doubleRender: { mismatches: [] } }, fail: false },
    { args: ["--final"], ghost: null, fail: true },
  ];
  for (const item of cases) {
    await write("runtime/scripts/ghost-check.mjs", item.ghost === null ?
      'export async function analyzeGhosts() { throw new Error("fixture scan error"); }\n' :
      `export async function analyzeGhosts() { return ${JSON.stringify(item.ghost)}; }\n`);
    if (item.fail) await write("runtime/check.ts", 'export const value: number = "invalid";\n');
    const run = async (body: string) => {
      await write("runtime/scripts/validate.mjs", body);
      return spawnSync(process.execPath, [path.join(scripts, "validate.mjs"), ...item.args], {
        cwd: path.join(directory, "runtime"), encoding: "utf8", shell: false, windowsHide: true,
      });
    };
    const before = await run(original);
    const after = await run(patched);
    assert.equal(after.status, item.fail ? 1 : 0, after.stdout + after.stderr);
    assert.equal(after.status, before.status);
    assert.equal(after.stdout, before.stdout);
    assert.equal(after.stderr, before.stderr);
    const text = await fs.readFile(path.join(directory, "reports/validate.json"), "utf8");
    const report = JSON.parse(text) as ValidateReport;
    assert.equal(report.schema, "smm.validate/1");
    assert.equal(report.verdict, item.fail ? "fail" : "pass");
    assert.equal(report.final, item.args.includes("--final"));
    assert.equal(report.double_render, item.args.includes("--double-render"));
    assert.equal(report.checks.some((entry) => entry.status === "error"), item.fail);
    assert.equal(report.checks.some((entry) => /SKIP|GHOST/.test(entry.message)), false);
    assert.equal(report.advisories.length > 0, item.args.includes("--final"));
    const parsed = parseInspectionReport("validate", text);
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.value.advisories, report.advisories);
  }
});
