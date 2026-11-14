import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";
import { execute } from "../src/host/index.ts";
import { cliContext } from "../src/cli/index.ts";
import { fakeJob, workspace } from "./helpers/host.ts";
import { cli } from "./helpers/cli.ts";
import { connectMcp, envelope } from "./helpers/mcp.ts";
import { repository } from "./helpers/templates.ts";

// TS-10: encoder selection in job-template/runtime/scripts/encoder.mjs (R6, JT-14..JT-19).
// No GPU, Remotion or real ffmpeg is used: the probe's process launcher is replaced.
const scripts = path.join(repository, "job-template/runtime/scripts");
const encoder = await import(pathToFileURL(path.join(scripts, "encoder.mjs")).href);
const video = ["--codec=h264", "--audio-codec=aac", "--pixel-format=yuv420p"];
// Original BiimMotion 262c798 arrays (run.mjs modes and ghost-check.mjs renderSecondCopy).
const original = {
  studio: ["studio", "src/index.ts"],
  preview: ["render", "src/index.ts", "MainVideo", "../output/preview.mp4", "--scale=0.5", ...video, "--hardware-acceleration", "if-possible", "--video-bitrate", "8M"],
  build: ["render", "src/index.ts", "MainVideo", "../output/final.mp4", ...video, "--hardware-acceleration", "if-possible", "--video-bitrate", "16M"],
  "double-render": ["render", "src/index.ts", "MainVideo", "../output/final.ghostcheck.mp4", ...video, "--hardware-acceleration", "if-possible", "--video-bitrate", "16M"],
  still: ["still", "src/index.ts", "MainVideo", "../output/preview.png"],
};
const gpu = { route: "gpu", encoder: "h264_nvenc", setting: "auto", raw: null, reason: "test" };
const cpu = { route: "cpu", encoder: "libx264", setting: "cpu", raw: "cpu", reason: "test" };
const args = (mode: string, selection: object) => encoder.remotionArgs(mode, selection, mode === "double-render" ? "../output/final.ghostcheck.mp4" : undefined);

test("TS-10.1 MOTION_JOB_ENCODER accepts unset empty auto cpu gpu and rejects every other value", () => {
  assert.equal(encoder.ENCODER_ENV, "MOTION_JOB_ENCODER");
  assert.deepEqual(encoder.readEncoderSetting({}), { setting: "auto", raw: null });
  assert.deepEqual(encoder.readEncoderSetting({ MOTION_JOB_ENCODER: "" }), { setting: "auto", raw: "" });
  for (const value of ["auto", "cpu", "gpu"]) assert.deepEqual(encoder.readEncoderSetting({ MOTION_JOB_ENCODER: value }), { setting: value, raw: value });
  for (const value of ["CPU", " cpu", "nvenc", "libx264", "disable", "1"]) {
    assert.throws(() => encoder.readEncoderSetting({ MOTION_JOB_ENCODER: value }), (error: Error) =>
      error.message.startsWith("[encoder] MOTION_JOB_ENCODER must be auto, cpu or gpu") && error.message.includes(JSON.stringify(value)));
    let probed = false;
    assert.throws(() => encoder.selectEncoder({ env: { MOTION_JOB_ENCODER: value }, platform: "win32", probe: () => { probed = true; return { ok: true }; } }));
    assert.equal(probed, false);
  }
});

test("TS-10.2 GPU arguments equal the original arrays for preview build and the double render", () => {
  for (const mode of ["preview", "build", "double-render"]) assert.deepEqual(args(mode, gpu), original[mode as keyof typeof original], mode);
  assert.deepEqual(encoder.ENCODED_RENDERS, ["preview", "build", "double-render"]);
});

test("TS-10.3 CPU arguments drop the bitrate, disable hardware acceleration and keep every other original argument", () => {
  for (const mode of ["preview", "build", "double-render"]) {
    const actual: string[] = args(mode, cpu);
    assert.equal(actual.includes("--video-bitrate"), false, mode);
    assert.equal(actual.filter((value) => value === "--hardware-acceleration").length, 1, mode);
    assert.equal(actual[actual.indexOf("--hardware-acceleration") + 1], "disable", mode);
    const base = original[mode as keyof typeof original].slice(0, -4);
    assert.deepEqual(actual, [...base, "--hardware-acceleration", "disable"], mode);
  }
  assert.throws(() => encoder.remotionArgs("preview", null));
  assert.throws(() => encoder.remotionArgs("double-render", cpu));
});

test("TS-10.4 auto chooses GPU only when the real h264_nvenc test encode exits 0", () => {
  const cases: [string, object, string][] = [
    ["success", { status: 0, signal: null }, "gpu"],
    ["non-zero exit", { status: 1, signal: null }, "cpu"],
    ["launch failure", { status: null, signal: null, error: Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" }) }, "cpu"],
    ["timeout", { status: null, signal: "SIGTERM", error: Object.assign(new Error("spawnSync ETIMEDOUT"), { code: "ETIMEDOUT" }) }, "cpu"],
  ];
  for (const [name, result, route] of cases) {
    const calls: { command: string; argv: string[]; options: Record<string, any> }[] = [];
    const probe = () => encoder.probeNvenc({ ffmpeg: path.join("compositor dir", "ffmpeg.exe"),
      spawn: (command: string, argv: string[], options: Record<string, any>) => { calls.push({ command, argv, options }); return result; } });
    const selected = encoder.selectEncoder({ env: {}, platform: "win32", probe });
    assert.equal(selected.route, route, name);
    assert.equal(selected.encoder, route === "gpu" ? "h264_nvenc" : "libx264", name);
    assert.equal(calls.length, 1, name);
    const [{ command, argv, options }] = calls;
    assert.equal(command, path.join("compositor dir", "ffmpeg.exe"));
    assert.equal(options.cwd, "compositor dir");
    assert.equal(options.timeout, 20000);
    assert.equal(argv.includes("-encoders"), false);
    assert.equal(argv[argv.indexOf("-c:v", argv.indexOf("-i")) + 1], "h264_nvenc");
    assert.deepEqual(argv.slice(argv.indexOf("-frames:v"), argv.indexOf("-frames:v") + 2), ["-frames:v", "1"]);
    assert.deepEqual(argv.slice(-3), ["-f", "null", "-"]);
    assert.ok(Buffer.isBuffer(options.input) && options.input.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")));
    const line: string = encoder.encoderLine(selected);
    assert.match(line, new RegExp(`^\\[encoder\\] route=${route} encoder=${selected.encoder} MOTION_JOB_ENCODER=auto \\(unset\\) reason: h264_nvenc test encode ${route === "gpu" ? "succeeded" : "failed"}`));
    assert.equal(line.includes("\n"), false);
  }
  const missing = encoder.selectEncoder({ env: {}, platform: "linux", probe: () => encoder.probeNvenc({ ffmpeg: null, spawn: () => assert.fail("no ffmpeg to start") }) });
  assert.equal(missing.route, "cpu"); assert.match(missing.reason, /bundled ffmpeg not found/);
  const never = () => assert.fail("explicit settings and macOS do not probe");
  assert.deepEqual([encoder.selectEncoder({ env: { MOTION_JOB_ENCODER: "cpu" }, platform: "win32", probe: never }).route,
    encoder.selectEncoder({ env: { MOTION_JOB_ENCODER: "gpu" }, platform: "linux", probe: never }).route,
    encoder.selectEncoder({ env: {}, platform: "darwin", probe: never }).encoder], ["cpu", "gpu", "h264_videotoolbox"]);
});

test("TS-10.5 still and studio arguments equal the original arrays", () => {
  for (const mode of ["still", "studio"]) {
    assert.deepEqual(encoder.remotionArgs(mode, null), original[mode as keyof typeof original]);
    assert.deepEqual(encoder.remotionArgs(mode, gpu), original[mode as keyof typeof original]);
  }
  assert.deepEqual(encoder.RUN_MODES, ["studio", "preview", "still", "build"]);
});

test("TS-10.6 run.mjs and ghost-check.mjs build encoder arguments only through encoder.mjs", async () => {
  for (const name of ["run.mjs", "ghost-check.mjs"]) {
    const source = await fs.readFile(path.join(scripts, name), "utf8");
    assert.equal(source.includes("--hardware-acceleration"), false, name);
    assert.equal(source.includes("--video-bitrate"), false, name);
    assert.match(source, /from "\.\/encoder\.mjs";/, name);
    for (const usage of ["selectEncoder()", "encoderLine(encoder)", "noteRenderExit(encoder,", "remotionArgs("]) assert.ok(source.includes(usage), `${name}: ${usage}`);
  }
  const others = (await fs.readdir(scripts)).filter((name) => !["encoder.mjs", "run.mjs", "ghost-check.mjs"].includes(name));
  for (const name of others) assert.equal((await fs.readFile(path.join(scripts, name), "utf8")).includes("hardware-acceleration"), false, name);
});

test("TS-10 real run.mjs records the encoder line, rejects invalid values before rendering and never retries", async (t) => {
  const context = await workspace(t);
  const generated = await execute(cliContext(context.root), "generate", { request: { form: { title: "encoder & 全角 空白", description: "エンコーダ選択の確認", audience: "開発者", voiceEngine: "none", generateAudio: false } }, out: "." });
  assert.ok(generated.ok); const job = path.join(context.root, generated.result.job!);
  // A stand-in Remotion CLI that records its arguments and exits with the requested code.
  const cliPackage = path.join(job, "runtime/node_modules/@remotion/cli");
  await fs.mkdir(cliPackage, { recursive: true });
  await fs.writeFile(path.join(cliPackage, "package.json"), JSON.stringify({ name: "@remotion/cli", bin: { remotion: "fake.mjs" } }));
  await fs.writeFile(path.join(cliPackage, "fake.mjs"), `import fs from "node:fs";\nfs.appendFileSync(process.env.FAKE_REMOTION_LOG, JSON.stringify(process.argv.slice(2)) + "\\n");\nprocess.exitCode = Number(process.env.FAKE_REMOTION_EXIT ?? 0);\n`);
  const log = path.join(context.root, "remotion-calls.jsonl");
  const run = (mode: string, env: Record<string, string>) => new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/run.mjs", mode], { cwd: path.join(job, "runtime"), shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, MOTION_JOB_ENCODER: "", FAKE_REMOTION_LOG: log, FAKE_REMOTION_EXIT: "0", ...env } });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8").on("data", (text) => { stdout += text; });
    child.stderr.setEncoding("utf8").on("data", (text) => { stderr += text; });
    child.once("error", reject); child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
  const calls = async () => (await fs.readFile(log, "utf8").catch(() => "")).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));

  const invalid = await run("preview", { MOTION_JOB_ENCODER: "nvenc" });
  assert.equal(invalid.code, 1); assert.equal(invalid.stdout, "");
  assert.match(invalid.stderr, /^\[encoder\] MOTION_JOB_ENCODER must be auto, cpu or gpu \(got "nvenc"\)\. No render was started\./);
  assert.deepEqual(await calls(), []);
  // prepare() was not reached: it would create runtime/public before rendering.
  await assert.rejects(fs.access(path.join(job, "runtime/public")), { code: "ENOENT" });

  // auto without Remotion's renderer installed: no bundled ffmpeg, so CPU without failing.
  const auto = await run("preview", {});
  assert.equal(auto.code, 0, auto.stderr);
  assert.match(auto.stderr, /^\[encoder\] route=cpu encoder=libx264 MOTION_JOB_ENCODER="" reason: h264_nvenc test encode failed: bundled ffmpeg not found \(\d+ ms\)\n/);
  const cpuBuild = await run("build", { MOTION_JOB_ENCODER: "cpu" });
  assert.equal(cpuBuild.code, 0); assert.match(cpuBuild.stderr, /^\[encoder\] route=cpu encoder=libx264 MOTION_JOB_ENCODER="cpu" reason: probe skipped/);
  const gpuFailure = await run("build", { MOTION_JOB_ENCODER: "gpu", FAKE_REMOTION_EXIT: "3" });
  assert.equal(gpuFailure.code, 3);
  const lines = gpuFailure.stderr.trim().split(/\r?\n/);
  assert.match(lines[0], /^\[encoder\] route=gpu encoder=h264_nvenc MOTION_JOB_ENCODER="gpu" reason: probe skipped/);
  assert.equal(lines.at(-1), "[encoder] The render failed with the GPU encoder (h264_nvenc). Set MOTION_JOB_ENCODER=cpu to encode on the CPU instead.");
  const cpuFailure = await run("preview", { MOTION_JOB_ENCODER: "cpu", FAKE_REMOTION_EXIT: "2" });
  assert.equal(cpuFailure.code, 2); assert.equal(cpuFailure.stderr.includes("GPU encoder"), false);
  const still = await run("still", { MOTION_JOB_ENCODER: "invalid-but-unused" });
  assert.equal(still.code, 0); assert.equal(still.stderr.includes("[encoder]"), false);
  // One Remotion invocation per run: no automatic re-render after a failure.
  assert.deepEqual(await calls(), [original.preview.slice(0, -4).concat("--hardware-acceleration", "disable"),
    original.build.slice(0, -4).concat("--hardware-acceleration", "disable"), original.build,
    original.preview.slice(0, -4).concat("--hardware-acceleration", "disable"), original.still]);
});

test("TS-10.7 CLI and MCP pass the caller's MOTION_JOB_ENCODER through to job scripts without interpreting it", async (t) => {
  const context = await workspace(t); const job = await fakeJob(context);
  await fs.writeFile(path.join(job, "runtime/scripts/run.mjs"), `import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const job = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
console.error("[encoder-env] " + JSON.stringify(process.env.MOTION_JOB_ENCODER ?? null) + " " + process.argv.slice(2).join(" "));
await fs.mkdir(path.join(job, "output"), { recursive: true });
await fs.writeFile(path.join(job, "output", process.argv[2] === "build" ? "final.mp4" : "preview.mp4"), "fixture");
`);
  const relative = path.basename(job);
  const stderrOf = async (id: string) => fs.readFile(path.join(job, ".smm/runs", id, "stderr.log"), "utf8");
  for (const value of ["cpu", "gpu", "not-a-choice"]) {
    const result = await cli(["render", relative, "--target", "preview"], context.root, false, { ...process.env, MOTION_JOB_ENCODER: value });
    assert.equal(result.code, 0, result.stdout); assert.equal(result.envelope.run?.status, "completed");
    assert.match(await stderrOf(result.envelope.run!.id), new RegExp(`^\\[encoder-env\\] ${JSON.stringify(JSON.stringify(value)).slice(1, -1)} preview`));
    assert.equal(JSON.stringify(result.envelope).includes("MOTION_JOB_ENCODER"), false);
  }
  const connection = await connectMcp(context.root, [], undefined, { ...getDefaultEnvironment(), MOTION_JOB_ENCODER: "cpu" });
  try {
    let current = envelope<"render">(await connection.call("job_render", { job: relative, target: "final", wait_ms: 0 }));
    assert.ok(current.ok && current.run, JSON.stringify(current));
    const id = current.run!.id;
    for (let attempt = 0; current.run?.status === "running" && attempt < 20; attempt++)
      current = envelope<"render">(await connection.call("run_get", { job: relative, run_id: id, wait_ms: 5000 }));
    assert.equal(current.run?.status, "completed", JSON.stringify(current));
    assert.match(await stderrOf(id), /^\[encoder-env\] "cpu" build/);
  } finally { await connection.close(); }
});
