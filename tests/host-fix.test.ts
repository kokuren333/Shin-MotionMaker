import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { test } from "node:test";
import JSZip from "jszip";
import { generateJob } from "../src/core/index.ts";
import { resolveAllowedPath, resolveRequest, getReport, openVerified, withVerifiedParent, execute, startRun, getRun, cancelRun, acquireJobLock, atomicJson, deriveJobStatus, npmEntry, doctor, sha256 } from "../src/host/index.ts";
import { identifyProcess, processExists, processState, readProcessOwners } from "../src/host/processes.ts";
import { releaseOwnedLock } from "../src/host/locks.ts";
import { stopProcessTree } from "../src/host/worker.ts";
import { fakeJob, workspace } from "./helpers/host.ts";
import { loadTemplates as browserTemplates, fileMap } from "./helpers/templates.ts";

const relative = "job & 全角 空白";
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function childPid(job: string) {
  for (let count = 0; count < 100; count++) {
    try { return Number(await fs.readFile(path.join(job, "child.pid"), "utf8")); } catch { await pause(50); }
  }
  throw Error("Missing child PID");
}

test("M-1 denies absolute UNC device and outside attachments before filesystem access", async (t) => {
  const context = await workspace(t);
  let calls = 0;
  for (const method of ["realpath", "stat", "lstat"] as const) t.mock.method(fs, method, async () => { calls++; throw Error("Unexpected filesystem access"); });
  for (const allowDirs of [[], [context.root]]) for (const value of ["//192.0.2.1/share/x.png", "\\\\192.0.2.1\\share\\x.png", "//./pipe/nonexistent-smm", "\\\\?\\C:\\outside\\x.png", path.resolve(context.root, "../outside.png")]) {
    await assert.rejects(resolveAllowedPath({ ...context, allowDirs }, value, "attachment"), { code: "E_PATH_DENIED" });
  }
  assert.equal(calls, 0);
  t.mock.restoreAll();
});

test("P-1 invalid allow-dir differs from an absent attachment and safety errors are denied", async (t) => {
  const context = await workspace(t);
  const input = { form: {}, assets: { sources: ["missing.txt"] } };
  await assert.rejects(resolveRequest(input, { ...context, allowDirs: [path.join(context.root, "absent")] }), { code: "E_PATH_DENIED" });
  await assert.rejects(resolveRequest(input, context), { code: "E_INPUT_INVALID" });
  t.mock.method(fs, "realpath", async () => { throw Object.assign(Error(), { code: "EACCES" }); });
  await assert.rejects(resolveAllowedPath(context, "source.txt", "attachment"), { code: "E_PATH_DENIED" });
  t.mock.restoreAll();
});

test("R-1 rejects hardlinked reports and relative root attachments", async (t) => {
  const context = await workspace(t), outside = await workspace(t);
  const job = await fakeJob(context);
  const secret = path.join(outside.root, "secret.txt"); await fs.writeFile(secret, "OUTSIDE-SECRET");
  await fs.mkdir(path.join(job, "reports")); await fs.link(secret, path.join(job, "reports/leak.txt"));
  await fs.link(secret, path.join(context.root, "attachment.txt"));
  await assert.rejects(getReport(context, relative, "reports/leak.txt"), { code: "E_PATH_DENIED" });
  await assert.rejects(resolveRequest({ form: {}, assets: { sources: ["attachment.txt"] } }, context), { code: "E_PATH_DENIED" });
  assert.equal((await getReport({ ...context, restrictToRoot: false }, relative, "reports/leak.txt") as { text: string }).text, "OUTSIDE-SECRET");
});

test("R-2 detects a read replacement after open and a parent replacement after creation", async (t) => {
  const context = await workspace(t);
  const file = path.join(context.root, "input.txt"); await fs.writeFile(file, "original");
  await assert.rejects(openVerified(file, async () => {
    await fs.rename(file, file + ".old"); await fs.writeFile(file, "replacement"); return file;
  }), { code: "E_PATH_DENIED" });
  const parent = path.join(context.root, "parent"); await fs.mkdir(parent);
  await assert.rejects(withVerifiedParent(path.join(parent, "new.txt"), async (target) => {
    await fs.writeFile(target, "new"); await fs.rename(parent, parent + ".old"); await fs.mkdir(parent);
  }), { code: "E_PATH_DENIED" });
});

for (const [name, role] of [["M-2 PID reuse script never kills unrelated process or blocks recovery", "script"], ["M-2 PID reuse worker never kills unrelated process or blocks recovery", "worker"]] as const) test(name, async (t) => {
  const context = await workspace(t), job = await fakeJob(context);
  const run = await startRun(context, "qc", { job: relative, stage: "pre" });
  await getRun(context, { job: relative, run_id: run.id, wait_ms: 10000 });
  const victim = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { shell: false, windowsHide: true, stdio: "ignore" });
  t.after(() => { victim.kill(); });
  const identity = await identifyProcess(victim.pid!); assert.ok(identity);
  const owners = await readProcessOwners(job, run.id);
  const mismatch = { ...identity, birth: identity.birth + "-other-process" };
  owners[role] = mismatch;
  await atomicJson(path.join(job, `.smm/runs/${run.id}/processes.json`), owners);
  const record = { ...run, pid: role === "worker" ? victim.pid : 2147483647, script_pid: role === "script" ? victim.pid : null, status: "running", heartbeat_at: "2000-01-01T00:00:00.000Z", exit_code: null, ended_at: null };
  delete (record as Partial<typeof record>).job;
  await atomicJson(path.join(job, `.smm/runs/${run.id}/run.json`), record);
  await atomicJson(path.join(job, ".smm/write.lock"), { owner: run.id, pid: record.pid, token: owners.token, identity: role === "worker" ? mismatch : undefined });
  assert.equal((await getRun(context, { job: relative, run_id: run.id })).run?.status, "lost");
  const reclaimed = await acquireJobLock(context, relative, "recovered-writer"); await reclaimed.release();
  await stopProcessTree(victim.pid!, mismatch);
  assert.equal((await cancelRun(context, relative, run.id)).status, "lost");
  assert.ok(processExists(victim.pid!));
  const next = await execute(context, "qc", { job: relative, stage: "pre", wait_ms: 10000 });
  assert.equal(next.run?.status, "completed", JSON.stringify(next));
  assert.ok(processExists(victim.pid!));
});

test("M-2 unknown process identity never receives a stop signal", async (t) => {
  const victim = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { shell: false, windowsHide: true, stdio: "ignore" });
  t.after(() => { victim.kill(); });
  await stopProcessTree(victim.pid!);
  assert.ok(processExists(victim.pid!));
});

test("R-3 releaseOwnedLock requires the matching token even for the same owner", async (t) => {
  const context = await workspace(t), job = await fakeJob(context);
  const lock = await acquireJobLock(context, relative, "same-owner");
  await releaseOwnedLock(job, "same-owner", "old-token");
  await assert.rejects(acquireJobLock(context, relative, "other"), { code: "E_BUSY" });
  await releaseOwnedLock(job, "same-owner", lock.token);
  const next = await acquireJobLock(context, relative, "other"); await next.release();
});

test("R-3 worker save preserves an externally written terminal record", async (t) => {
  const context = await workspace(t), job = await fakeJob(context, { scenario: "sleep" });
  const run = await startRun(context, "qc", { job: relative, stage: "pre" }); await childPid(job);
  const owners = await readProcessOwners(job, run.id);
  t.after(async () => { await stopProcessTree(run.script_pid, owners.script); });
  const file = path.join(job, `.smm/runs/${run.id}/run.json`);
  const record = JSON.parse(await fs.readFile(file, "utf8"));
  await atomicJson(file, { ...record, status: "cancelled", ended_at: new Date().toISOString(), exit_code: 4, progress: { ratio: null, text: "external-terminal" } });
  await fs.writeFile(path.join(job, `.smm/runs/${run.id}/cancel`), "");
  for (let count = 0; count < 50 && await processState(run.pid, owners.worker) !== "absent"; count++) await pause(100);
  assert.equal((await getRun(context, { job: relative, run_id: run.id })).run?.progress.text, "external-terminal");
  assert.equal(await processState(run.script_pid, owners.script), "absent");
});

test("R-4 MCP log tails redact file URLs realpaths and host installation paths", async (t) => {
  const context = await workspace(t), job = await fakeJob(context, { scenario: "crash" });
  const result = await execute(context, "qc", { job: relative, stage: "pre", wait_ms: 10000 });
  const host = fileURLToPath(new URL("../", import.meta.url));
  const forms = [job, context.root, host, await fs.realpath(job), await fs.realpath(context.root)].flatMap((value) => [value, pathToFileURL(value).href, value.replaceAll("\\", "\\\\")]);
  await fs.appendFile(path.join(job, `.smm/runs/${result.run!.id}/stderr.log`), forms.join("\n") + "\n");
  const fetched = await getRun(context, { job: relative, run_id: result.run!.id });
  assert.ok(fetched.ok);
  const text = fetched.result.stderr_tail.join("\n");
  for (const value of forms) assert.ok(!text.includes(value), value);
  const stored = await fs.readFile(path.join(job, `.smm/runs/${result.run!.id}/stderr.log`), "utf8");
  const hostErrorLine = stored.split("\n").find((line) => line.startsWith('{"code"'))!;
  assert.deepEqual(Object.keys(JSON.parse(hostErrorLine)), ["code", "message", "reason"]);
});

for (const [name, survivingScript] of [["R-5 real worker death recovers after the script stops", false], ["R-5 real worker death retains startup grace and recovers a surviving script", true]] as const) test(name, async (t) => {
  const context = await workspace(t), job = await fakeJob(context, { scenario: "sleep" });
  const run = await startRun(context, "qc", { job: relative, stage: "pre" });
  await childPid(job);
  const owners = await readProcessOwners(job, run.id);
  t.after(async () => { await stopProcessTree(run.script_pid, owners.script); });
  process.kill(run.pid!, "SIGKILL");
  if (!survivingScript) await stopProcessTree(run.script_pid, owners.script);
  const early = await getRun(context, { job: relative, run_id: run.id });
  assert.equal(early.run?.status, "running");
  const pending = survivingScript ? cancelRun(context, relative, run.id) : undefined;
  if (pending) {
    await pause(200);
    await assert.rejects(acquireJobLock(context, relative, "too-early"), { code: "E_BUSY" });
    assert.equal((await getRun(context, { job: relative, run_id: run.id })).run?.status, "running");
  }
  if (pending) assert.equal((await pending).status, "lost");
  const done = await getRun(context, { job: relative, run_id: run.id, wait_ms: 20000 });
  assert.equal(done.run?.status, "lost");
  assert.equal((await cancelRun(context, relative, run.id)).status, "lost");
  assert.equal(await processState(run.script_pid, owners.script), "absent");
  await fakeJob(context);
  const next = await execute(context, "qc", { job: relative, stage: "pre", wait_ms: 10000 });
  assert.equal(next.run?.status, "completed", JSON.stringify(next));
});

test("R-5 startRun timeout uses runTimeout worker stop and next-run recovery", async (t) => {
  const context = await workspace(t); await fakeJob(context, { scenario: "sleep" });
  const previous = process.env.NODE_OPTIONS;
  process.env.NODE_OPTIONS = `${previous ?? ""} --import=${pathToFileURL(fileURLToPath(new URL("./fixtures/host/fast-timeout.mjs", import.meta.url))).href}`;
  let run;
  try { run = await startRun(context, "qc", { job: relative, stage: "pre" }); }
  finally { if (previous === undefined) delete process.env.NODE_OPTIONS; else process.env.NODE_OPTIONS = previous; }
  const done = await getRun(context, { job: relative, run_id: run.id, wait_ms: 20000 });
  assert.equal(done.run?.status, "timed_out"); assert.equal(done.run?.error?.code, "E_TIMEOUT");
  await fakeJob(context);
  assert.equal((await execute(context, "qc", { job: relative, stage: "pre", wait_ms: 10000 })).run?.status, "completed");
});

for (const [name, platform] of [["R-6 linux cancellation stops a detached grandchild", "linux"], ["R-6 win32 cancellation stops a detached grandchild", "win32"]]) test(name, { skip: process.platform !== platform ? `${platform} 専用のプロセスツリー停止を対象 OS の CI で実行するため` : false }, async (t) => {
  const context = await workspace(t), job = await fakeJob(context, { scenario: "sleep", detachedChild: true });
  const run = await startRun(context, "qc", { job: relative, stage: "pre" });
  const descendant = await childPid(job), identity = await identifyProcess(descendant); assert.ok(identity);
  assert.equal((await cancelRun(context, relative, run.id)).status, "cancelled");
  assert.equal(await processState(descendant, identity), "absent");
});

test("P-2 POSIX generated filenames preserve browser bytes", { skip: process.platform === "win32" ? "POSIX で有効な ?・末尾ドットを含むファイル名を ubuntu CI で確認するため" : false }, async (t) => {
  const context = await workspace(t);
  const result = await execute(context, "generate", { request: { form: { title: "POSIX", description: "説明", audience: "読者" }, assets: { sources: [] } }, out: "out" });
  assert.equal(result.ok, true);
  await fs.writeFile(path.join(context.root, "source?.txt"), "POSIX");
  const generated = await execute(context, "generate", { request: { form: { title: "添付", description: "説明", audience: "読者" }, assets: { sources: ["source?.txt"] } }, out: "out" });
  assert.ok(generated.ok);
  // core.safeName maps "?" to "-" in both the browser ZIP and the host folder.
  assert.equal(await fs.readFile(path.join(context.root, generated.result.job!, "sources/source-.txt"), "utf8"), "POSIX");
  const resolved = await resolveRequest({ form: { title: "添付", description: "説明", audience: "読者" }, assets: { sources: ["source?.txt"] } }, context);
  const zip = await JSZip.loadAsync((await generateJob(resolved.request.form, resolved.assets, await browserTemplates())).data);
  const actual = await fileMap(path.join(context.root, generated.result.job!));
  for (const [name, entry] of Object.entries(zip.files)) if (!entry.dir)
    assert.deepEqual(actual[name.slice(name.indexOf("/") + 1)], await entry.async("uint8array"), name);
});

test("P-2 invalid QC input keys are stale and P-7 status keeps twenty recent runs", async (t) => {
  const context = await workspace(t), job = await fakeJob(context);
  await fs.mkdir(path.join(job, "reports"));
  await atomicJson(path.join(job, "reports/qc-pre.json"), { kind: "biim-explainer-qc", stage: "pre", verdict: "fail", gates: [], advisories: [], inputs: { "../outside": "hash" } });
  const run = await startRun(context, "qc", { job: relative, stage: "post" });
  await getRun(context, { job: relative, run_id: run.id, wait_ms: 10000 });
  for (let index = 0; index < 23; index++) {
    const id = `r-20261114T000000Z-${index.toString(16).padStart(8, "0")}`;
    await fs.mkdir(path.join(job, `.smm/runs/${id}`));
    await atomicJson(path.join(job, `.smm/runs/${id}/run.json`), { ...run, id, status: "completed" });
  }
  const status = await deriveJobStatus(context, relative);
  assert.equal(status.runs.length, 20);
  assert.equal((status.checks.find((check) => check.kind === "qc-pre") as { stale?: boolean })?.stale, true);
});

test("R-7 npm entry ignores yarn and relative PATH entries", async (t) => {
  const context = await workspace(t);
  const yarn = path.join(context.root, "yarn.js"); await fs.writeFile(yarn, "throw Error('must not run')");
  const previous = process.env.npm_execpath, previousPath = process.env.PATH;
  process.env.npm_execpath = yarn; process.env.PATH = ["", ".", "relative", previousPath].join(path.delimiter);
  try { assert.equal(path.basename(await npmEntry()), "npm-cli.js"); assert.ok(path.isAbsolute(await npmEntry())); }
  finally { if (previous === undefined) delete process.env.npm_execpath; else process.env.npm_execpath = previous; process.env.PATH = previousPath; }
  process.env.PATH = ["", ".", "relative"].join(path.delimiter);
  let relativeProbes = 0;
  t.mock.method(fs, "stat", async (file: string) => {
    if (!path.isAbsolute(String(file))) { relativeProbes++; return { isFile: () => true }; }
    throw Object.assign(Error(), { code: "ENOENT" });
  });
  try { await assert.rejects(npmEntry(), { code: "E_TOOL_MISSING" }); assert.equal(relativeProbes, 0); }
  finally { t.mock.restoreAll(); process.env.PATH = previousPath; }
});

test("P-4 a post-start observation failure keeps the active run in the error", async (t) => {
  const context = await workspace(t); await fakeJob(context, { scenario: "sleep" });
  const original = fs.open;
  let projectReads = 0;
  t.mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => {
    if (String(args[0]).endsWith("project.json") && ++projectReads === 3) throw Object.assign(Error("denied"), { code: "EACCES" });
    return original(...args);
  });
  const result = await execute(context, "qc", { job: relative, stage: "pre", wait_ms: 0 });
  t.mock.restoreAll();
  assert.equal(result.ok, false); assert.ok(result.run); assert.equal(result.run.status, "running");
  await cancelRun(context, relative, result.run.id);
});

test("P-5 voice authorization is rechecked after lock acquisition without creating a run", async (t) => {
  const context = await workspace(t), job = await fakeJob(context);
  const original = fs.open;
  t.mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => {
    const handle = await original(...args);
    if (String(args[0]).endsWith("write.lock") && args[1] === "wx") {
      const file = path.join(job, "project.json"), project = JSON.parse(await fs.readFile(file, "utf8"));
      project.voice = { engine: "aivis", engine_url: "http://unapproved.invalid:10101" };
      await fs.writeFile(file, JSON.stringify(project));
    }
    return handle;
  });
  const result = await execute(context, "voice", { job: relative }); t.mock.restoreAll();
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, "E_DISABLED");
  assert.equal(result.run, undefined);
  await assert.rejects(fs.access(path.join(job, ".smm/runs")), { code: "ENOENT" });
});

test("P-6 doctor reports an invalid engine URL accurately", async (t) => {
  const context = await workspace(t), job = await fakeJob(context);
  const file = path.join(job, "project.json"), project = JSON.parse(await fs.readFile(file, "utf8"));
  project.voice = { engine: "aivis", engine_url: "invalid" }; await atomicJson(file, project);
  assert.match((await doctor(context, relative)).checks.find((check) => check.id === "aivis")!.message, /URL が不正/);
});

test("P-8 damaged reservation hints name job-relative recovery files", async (t) => {
  const context = await workspace(t), job = await fakeJob(context);
  await fs.mkdir(path.join(job, ".smm")); await fs.writeFile(path.join(job, ".smm/write.lock"), "broken");
  await assert.rejects(acquireJobLock(context, relative, "test"), (error: unknown) => !!error && typeof error === "object" && "hint" in error && String(error.hint).includes(".smm/write.lock"));
  await atomicJson(path.join(job, ".smm/write.lock"), { owner: "old", pid: 2147483647, token: "old" });
  await fs.writeFile(path.join(job, ".smm/reclaim.lock"), "old");
  await assert.rejects(acquireJobLock(context, relative, "test"), (error: unknown) => !!error && typeof error === "object" && "hint" in error && String(error.hint).includes(".smm/reclaim.lock"));
});
