import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { after, before, test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import type { HostContext } from "../src/host/index.ts";
import {
  MODELS, estimate, isDryRun, seedanceCreate, seedanceDoctorCheck, seedanceInputSchemas, seedanceList, seedanceOutputSchemas, seedanceStatus,
  type SeedanceDeps, type SeedanceTask,
} from "../src/host/seedance/index.ts";
import { buildBody, normalizeCreate, resolveAssets, type SeedanceCreateInput } from "../src/host/seedance/request.ts";
import { BASE_URL, classifyResponse, createArkTransport } from "../src/host/seedance/client.ts";
import { inspectMp4, inspectMp4File } from "../src/host/seedance/mp4.ts";
import { mockVideo } from "../src/host/seedance/mock-video.ts";
import { schemaIssues } from "../src/host/schema-validation.ts";
import { fakeJob, workspace } from "./helpers/host.ts";

// No test in this file may reach a network. The global fetch is a sentinel that fails and counts.
const SENTINEL_KEY = "test-sentinel-key-DO-NOT-USE-0000";
const JOB = "job & 全角 空白";
const seedanceDirectory = fileURLToPath(new URL("../src/host/seedance/", import.meta.url));
let sentinelCalls = 0;
let originalFetch: typeof globalThis.fetch;
before(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { sentinelCalls++; throw new Error("network access is forbidden in tests"); }) as typeof globalThis.fetch;
});
after(() => { globalThis.fetch = originalFetch; });

const noSleep = async () => {};
const noFfmpeg = async () => null;
type Call = { url: string; method: string; headers: Record<string, string>; body: string | undefined };
type Handler = (call: Call, index: number) => Response | Promise<Response>;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
/** Fake fetch for the real-API code path. Routes by method and URL; never touches a network. */
function fakeArk(routes: { create?: Handler; get?: Handler; list?: Handler; download?: Handler }) {
  const calls: Call[] = [];
  const counters = { create: 0, get: 0, list: 0, download: 0 };
  const impl = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const call: Call = { url: String(input), method: init.method ?? "GET", headers: { ...(init.headers as Record<string, string> | undefined) }, body: typeof init.body === "string" ? init.body : undefined };
    calls.push(call);
    const route = !call.url.startsWith(BASE_URL) ? "download" : call.method === "POST" ? "create" : /\/tasks\?/.test(call.url) ? "list" : "get";
    const handler = routes[route];
    if (!handler) throw new Error(`unexpected ${route} call`);
    return handler(call, counters[route]++);
  }) as typeof fetch;
  return { impl, calls };
}
const succeeded = (id: string, tokens = 108000, model = "dreamina-seedance-2-0-260128") => json({ id, model, status: "succeeded", created_at: Math.floor(Date.now() / 1000),
  content: { video_url: `https://cdn.example.test/out/${id}.mp4?X-Signature=signed-secret-value` }, usage: { completion_tokens: tokens, total_tokens: tokens } });
const videoResponse = () => new Response(mockVideo() as unknown as BodyInit, { status: 200, headers: { "content-length": String(mockVideo().length) } });

async function setup(t: TestContext, optIn = false): Promise<{ context: HostContext; job: string }> {
  const context = await workspace(t);
  const job = await fakeJob(context);
  if (optIn) {
    const project = JSON.parse(await fs.readFile(path.join(job, "project.json"), "utf8"));
    await fs.writeFile(path.join(job, "project.json"), JSON.stringify({ ...project, asset_generation: { video_generation: true } }));
  }
  return { context, job };
}
const ledgerPath = (job: string) => path.join(job, "seedance", "tasks.json");
async function ledger(job: string): Promise<SeedanceTask[]> { return JSON.parse(await fs.readFile(ledgerPath(job), "utf8")).tasks; }
async function exists(file: string) { try { await fs.access(file); return true; } catch { return false; } }
async function rejects(promise: Promise<unknown>, code: string, check: (error: { code: string; message: string; hint: string; details?: Record<string, unknown> }) => void = () => {}) {
  try { await promise; } catch (error) { assert.equal((error as { code: string }).code, code, JSON.stringify(error)); check(error as never); return error as { code: string; message: string; hint: string; details?: Record<string, unknown> }; }
  assert.fail(`expected ${code}`);
}
const realEnv = (extra: Record<string, string> = {}) => ({ SEEDANCE_DRY_RUN: "false", ARK_API_KEY: SENTINEL_KEY, ...extra });
const base = (extra: Partial<SeedanceCreateInput> = {}): SeedanceCreateInput => ({ job: JOB, shot_id: "s01", prompt: "夜明けの港を低空で滑るように進むカメラ", ...extra });
function fullError(error: unknown) { return JSON.stringify({ ...(error as object), message: (error as Error).message }); }

test("SEEDANCE models: five entries and estimates match the official examples", () => {
  assert.equal(MODELS.length, 5);
  const usd = (model: string, resolution: "480p" | "720p" | "1080p" | "4k") => estimate(model, { resolution, duration: 5 }).usd;
  const two = estimate("seedance-2-0", { resolution: "720p", duration: 5 });
  assert.equal(two.tokens, 108000); assert.equal(two.usd, 0.756);
  assert.equal(usd("seedance-2-0-mini", "720p"), 0.378);
  assert.equal(usd("seedance-2-5", "720p"), 1.1556);
  assert.equal(usd("seedance-2-5", "1080p"), 2.8431);
  assert.equal(usd("seedance-2-0", "1080p"), 1.8711);
  assert.equal(usd("seedance-2-0", "4k"), 3.888);
  assert.ok(Math.abs(usd("seedance-2-5-flash", "480p") - 0.34) < 0.005);
  assert.ok(Math.abs(usd("seedance-2-0", "480p") - 0.35) < 0.005);
  assert.ok(Math.abs(usd("seedance-2-0-mini", "480p") - 0.18) < 0.005);
  assert.equal(estimate("dreamina-seedance-2-0-260128", { resolution: "720p", duration: 5 }).usd, 0.756, "model IDs are accepted");
  assert.equal(estimate("seedance-2-0", { resolution: "720p", ratio: "9:16", duration: 5 }).basis, "area-16:9");
  const video = estimate("seedance-2-0", { resolution: "720p", duration: 5, referenceVideos: 1 });
  assert.equal(video.price_per_million, 4.3); assert.match(video.basis, /video-input-assumed-15s/);
  assert.throws(() => estimate("seedance-2-5", { resolution: "4k", duration: 5 }), (error: { code: string; details: { reason: string } }) => error.code === "E_INPUT_INVALID" && error.details.reason === "price_unregistered");
  for (const model of ["seedance-2-5-flash", "seedance-2-0-fast", "seedance-2-0-mini"])
    assert.throws(() => estimate(model, { resolution: "1080p", duration: 5 }), { code: "E_INPUT_INVALID" });
  assert.throws(() => estimate("seedance-9", { resolution: "720p", duration: 5 }), { code: "E_INPUT_INVALID" });
});

test("SEEDANCE request: roles per mode, mixing and limits, data URIs and URL rules", async (t) => {
  const { job } = await setup(t);
  await fs.mkdir(path.join(job, "assets"), { recursive: true });
  await fs.writeFile(path.join(job, "assets", "first.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]));
  const text = normalizeCreate(base());
  assert.equal(text.model.alias, "seedance-2-0-mini"); assert.deepEqual(text.params, { resolution: "720p", ratio: "16:9", duration: 5, generate_audio: false, watermark: false });
  const textBody = buildBody(text.model, text.prompt, await resolveAssets(job, text.assets), text.params);
  assert.deepEqual(textBody.content, [{ type: "text", text: text.prompt }]);
  assert.equal(textBody.model, "dreamina-seedance-2-0-mini-260615"); assert.equal("seed" in textBody, false);
  assert.equal(buildBody(text.model, text.prompt, [], normalizeCreate(base({ seed: 7 })).params).seed, 7);

  const image = normalizeCreate(base({ mode: "image", first_frame: "assets/first.png", last_frame: "https://img.example.test/last.png?token=abc#frag" }));
  const imageAssets = await resolveAssets(job, image.assets);
  const imageBody = buildBody(image.model, image.prompt, imageAssets, image.params) as { content: Record<string, unknown>[] };
  assert.deepEqual(imageBody.content.map((part) => [part.type, part.role]), [["text", undefined], ["image_url", "first_frame"], ["image_url", "last_frame"]]);
  assert.match((imageBody.content[1].image_url as { url: string }).url, /^data:image\/png;base64,/);
  assert.equal((imageBody.content[2].image_url as { url: string }).url, "https://img.example.test/last.png?token=abc#frag", "the full URL is sent");
  assert.match(imageAssets[0].record.sha256!, /^[a-f0-9]{64}$/); assert.equal(imageAssets[0].record.path, "assets/first.png");
  assert.equal(imageAssets[1].record.url, "https://img.example.test/last.png", "query and fragment are not stored");
  assert.match(imageAssets[1].record.url_sha256!, /^[a-f0-9]{64}$/);

  const reference = normalizeCreate(base({ model: "seedance-2-0", mode: "reference", reference_images: ["asset://img-1"], reference_videos: ["https://v.example.test/a.mp4"], reference_audios: ["asset://aud-1"] }));
  const referenceBody = buildBody(reference.model, reference.prompt, await resolveAssets(job, reference.assets), reference.params) as { content: Record<string, unknown>[] };
  assert.deepEqual(referenceBody.content.map((part) => [part.type, part.role]), [["text", undefined], ["image_url", "reference_image"], ["video_url", "reference_video"], ["audio_url", "reference_audio"]]);
  assert.equal(reference.estimate.price_per_million, 4.3, "video input price applies");

  for (const input of [base({ first_frame: "assets/first.png" }), base({ reference_images: ["asset://x"] }), base({ mode: "image", first_frame: "assets/first.png", reference_images: ["asset://x"] }),
    base({ mode: "reference", reference_images: ["asset://x"], last_frame: "asset://y" }), base({ mode: "image" }), base({ mode: "reference" }), base({ mode: "image", last_frame: "asset://y" }),
    base({ shot_id: "../x" }), base({ prompt: "" }), base({ duration: 16 }), base({ resolution: "1080p" }), base({ unknown: 1 } as never)])
    assert.throws(() => normalizeCreate(input), { code: "E_INPUT_INVALID" }, JSON.stringify(input));
  assert.throws(() => normalizeCreate(base({ mode: "reference", reference_images: Array.from({ length: 10 }, (_, index) => `asset://i${index}`) })),
    (error: { code: string; details: { limit: number } }) => error.code === "E_INPUT_INVALID" && error.details.limit === 9);
  assert.doesNotThrow(() => normalizeCreate(base({ model: "seedance-2-5", mode: "reference", reference_images: Array.from({ length: 30 }, (_, index) => `asset://i${index}`) })));
  assert.throws(() => normalizeCreate(base({ model: "seedance-2-0", mode: "reference", reference_videos: ["asset://1", "asset://2", "asset://3", "asset://4"] })), { code: "E_INPUT_INVALID" });

  const resolveOne = (input: SeedanceCreateInput) => resolveAssets(job, normalizeCreate(input).assets);
  await rejects(resolveOne(base({ mode: "reference", reference_videos: ["clips/a.mp4"] })), "E_INPUT_INVALID", (error) => assert.match(error.hint, /asset:\/\//));
  await rejects(resolveOne(base({ mode: "reference", reference_audios: ["voice.wav"] })), "E_INPUT_INVALID");
  await rejects(resolveOne(base({ mode: "reference", reference_images: ["http://img.example.test/a.png"] })), "E_INPUT_INVALID");
  await rejects(resolveOne(base({ mode: "reference", reference_images: ["file:///etc/passwd"] })), "E_INPUT_INVALID");
  await rejects(resolveOne(base({ mode: "reference", reference_images: ["data:image/png;base64,AAAA"] })), "E_INPUT_INVALID");
  await rejects(resolveOne(base({ mode: "reference", reference_images: ["assets/missing.png"] })), "E_INPUT_INVALID");
  await rejects(resolveOne(base({ mode: "reference", reference_images: ["assets/first.gif"] })), "E_INPUT_INVALID");
  await rejects(resolveOne(base({ mode: "reference", reference_images: ["../outside.png"] })), "E_PATH_DENIED");
});

test("SEEDANCE client: error kinds and retry counts (GET wide, POST narrow)", async () => {
  assert.equal(classifyResponse(401, undefined), "auth");
  assert.equal(classifyResponse(403, "AuthenticationError"), "auth");
  assert.equal(classifyResponse(403, "ModelNotOpen"), "activation");
  assert.equal(classifyResponse(404, "ModelNotOpen"), "activation");
  assert.equal(classifyResponse(403, "AccountOverdueError"), "activation");
  assert.equal(classifyResponse(429, undefined), "rate_limit");
  assert.equal(classifyResponse(400, "InvalidParameter"), "invalid");
  assert.equal(classifyResponse(500, undefined), "server");
  const network = (code: string) => Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error(code), { code }) });
  const timeout = () => new DOMException("The operation was aborted due to timeout", "TimeoutError");
  async function run(operation: "get" | "create", responses: (() => Response | Error)[]) {
    const sleeps: number[] = [];
    let index = 0;
    const fake = fakeArk({ [operation]: () => { const next = responses[Math.min(index++, responses.length - 1)](); if (next instanceof Error) throw next; return next; } });
    const transport = createArkTransport({ env: realEnv(), fetchImpl: fake.impl, sleep: async (ms) => { sleeps.push(ms); } });
    try { const value = operation === "get" ? await transport.get("cgt-1") : await transport.create({ model: "m" }); return { value, error: null, calls: fake.calls.length, sleeps }; }
    catch (error) { return { value: null, error: error as { code: string; details: Record<string, unknown> }, calls: fake.calls.length, sleeps }; }
  }
  const ok = () => json({ id: "cgt-1", status: "running" });
  const status = (code: number, body: unknown = {}) => () => json(body, code);
  // GET: 429, 5xx and network are retried up to twice with 1 s and 2 s backoff.
  let result = await run("get", [status(500), status(502), ok]);
  assert.equal(result.calls, 3); assert.deepEqual(result.sleeps, [1000, 2000]); assert.equal(result.error, null);
  result = await run("get", [status(500)]);
  assert.equal(result.calls, 3); assert.equal(result.error?.code, "E_ENGINE_UNREACHABLE"); assert.equal(result.error?.details.kind, "server"); assert.equal(result.error?.details.attempts, 3);
  result = await run("get", [() => network("ECONNRESET")]);
  assert.equal(result.calls, 3); assert.equal(result.error?.details.kind, "network");
  result = await run("get", [() => timeout()]);
  assert.equal(result.calls, 3); assert.equal(result.error?.details.timeout, true);
  result = await run("get", [status(429)]);
  assert.equal(result.calls, 3); assert.equal(result.error?.code, "E_BUSY"); assert.equal(result.error?.details.kind, "rate_limit");
  for (const [code, body, expected, kind] of [[401, {}, "E_DISABLED", "auth"], [403, { error: { code: "AuthenticationError", message: "bad" } }, "E_DISABLED", "auth"],
    [403, { error: { code: "ModelNotOpen", message: "activate" } }, "E_DISABLED", "activation"], [400, { error: { code: "InvalidParameter", message: "x" } }, "E_INPUT_INVALID", "invalid"]] as const) {
    result = await run("get", [status(code, body)]);
    assert.equal(result.calls, 1, String(code)); assert.equal(result.error?.code, expected); assert.equal(result.error?.details.kind, kind);
  }
  // POST: only 429, 503 and pre-send connection errors are retried.
  for (const code of [500, 502, 504]) {
    result = await run("create", [status(code)]);
    assert.equal(result.calls, 1, String(code)); assert.equal(result.error?.details.kind, "server"); assert.equal(result.error?.details.uncertain, true);
  }
  result = await run("create", [status(503), () => json({ id: "cgt-9" })]);
  assert.equal(result.calls, 2); assert.deepEqual(result.value, { id: "cgt-9" });
  result = await run("create", [status(429)]);
  assert.equal(result.calls, 3); assert.equal(result.error?.code, "E_BUSY"); assert.equal(result.error?.details.uncertain, undefined);
  for (const code of ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"]) {
    result = await run("create", [() => network(code), () => json({ id: "cgt-2" })]);
    assert.equal(result.calls, 2, code); assert.deepEqual(result.value, { id: "cgt-2" });
  }
  result = await run("create", [() => timeout()]);
  assert.equal(result.calls, 1); assert.equal(result.error?.details.uncertain, true); assert.equal(result.error?.code, "E_ENGINE_UNREACHABLE");
  result = await run("create", [() => network("ECONNRESET")]);
  assert.equal(result.calls, 1); assert.equal(result.error?.details.uncertain, true);
  result = await run("create", [status(400, { error: { code: "InvalidParameter", message: "m".repeat(2000) } })]);
  assert.equal(result.calls, 1); assert.equal((result.error?.details.api_message as string).length, 512);
  assert.equal(sentinelCalls, 0);
});

test("SEEDANCE DRY_RUN create saves a checked MP4, sidecar and thumbnail without any fetch (ffmpeg thumbnail skipped when unavailable)", async (t) => {
  const { context, job } = await setup(t);
  const before = sentinelCalls;
  const { result, advisories } = await seedanceCreate(context, base(), { env: {}, sleep: noSleep });
  assert.equal(result.cached, false);
  const task = result.task;
  assert.equal(task.status, "succeeded"); assert.equal(task.dry_run, true); assert.match(task.task_id!, /^mock-/);
  assert.equal(task.output, "seedance/out/s01.mp4"); assert.equal(task.sidecar, "seedance/out/s01.json");
  assert.equal(task.actual_usd, 0); assert.equal(task.usage_tokens, task.estimate_tokens); assert.equal(task.estimate_usd, 0.378);
  const video = path.join(job, "seedance", "out", "s01.mp4");
  const check = await inspectMp4File(video);
  assert.equal(check.ok, true, JSON.stringify(check));
  assert.deepEqual(task.video, { bytes: mockVideo().length, duration_seconds: 5, width: 320, height: 180 });
  const sidecar = JSON.parse(await fs.readFile(path.join(job, "seedance", "out", "s01.json"), "utf8"));
  assert.equal(sidecar.schema, "smm.seedance-output/1"); assert.equal(sidecar.video.path, "seedance/out/s01.mp4"); assert.equal(sidecar.video.sha256, task.output_sha256);
  assert.equal(sidecar.local_id, task.local_id); assert.equal(sidecar.dry_run, true);
  if (task.thumbnail) {
    const png = await fs.readFile(path.join(job, ...task.thumbnail.split("/")));
    assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  } else t.diagnostic("ffmpeg unavailable: thumbnail check skipped");
  assert.ok(advisories.some((item) => item.id === "seedance-opt-in-required-for-real"));
  assert.ok(advisories.every((item) => item.source === "seedance"));
  assert.deepEqual((await fs.readdir(path.join(job, "seedance", "out"))).filter((name) => name.endsWith(".tmp") || name.includes(".tmp.")), []);
  assert.equal(await exists(path.join(job, "seedance", ".lock")), false);
  assert.equal(schemaIssues(seedanceOutputSchemas["seedance-task"], result).length, 0, JSON.stringify(schemaIssues(seedanceOutputSchemas["seedance-task"], result)));

  // wait_ms 0 leaves the task queued; status resumes and saves it.
  const queued = await seedanceCreate(context, base({ shot_id: "s02", prompt: "雨の路地を歩く猫", wait_ms: 0 }), { env: {}, sleep: noSleep, findFfmpeg: noFfmpeg });
  assert.equal(queued.result.task.status, "queued"); assert.equal(queued.result.task.output, null);
  const resumed = await seedanceStatus(context, { job: JOB, shot_id: "s02" }, { env: {}, findFfmpeg: noFfmpeg });
  assert.equal(resumed.result.task.status, "succeeded"); assert.equal(resumed.result.task.output, "seedance/out/s02.mp4");
  assert.equal(resumed.result.task.thumbnail, null);
  assert.equal(inspectMp4(await fs.readFile(path.join(job, "seedance", "out", "s02.mp4"))).ok, true);
  const again = await seedanceStatus(context, { job: JOB, task_id: queued.result.task.task_id! }, { env: {} });
  assert.equal(again.result.task.status, "succeeded");
  const listed = await seedanceList(context, { job: JOB }, { env: {} });
  assert.equal(listed.result.summary.count, 2); assert.equal(listed.result.summary.mock_count, 2); assert.equal(listed.result.summary.real_spent_usd, 0);
  assert.equal(listed.result.summary.dry_run, true); assert.equal(listed.result.summary.budget_usd, 10); assert.equal(listed.result.summary.budget_scope, "job");
  assert.equal(schemaIssues(seedanceOutputSchemas["seedance-list"], listed.result).length, 0);
  assert.equal(sentinelCalls, before, "the global fetch was never called");
});

test("SEEDANCE DRY_RUN is evaluated per call; only false or 0 disable it", () => {
  for (const value of [undefined, "", "true", "1", "no", "off"]) assert.equal(isDryRun({ SEEDANCE_DRY_RUN: value }), true, String(value));
  for (const value of ["false", "FALSE", " False ", "0", " 0"]) assert.equal(isDryRun({ SEEDANCE_DRY_RUN: value }), false, value);
});

test("SEEDANCE real mode needs key, opt-in and budget; refusals write nothing", async (t) => {
  const fake = fakeArk({});
  const deps = (env: Record<string, string>): SeedanceDeps => ({ env, fetch: fake.impl, sleep: noSleep, findFfmpeg: noFfmpeg });
  const { context: plain, job: plainJob } = await setup(t);
  await rejects(seedanceCreate(plain, base(), deps({ SEEDANCE_DRY_RUN: "false" })), "E_DISABLED", (error) => assert.equal(error.details?.reason, "api_key_missing"));
  await rejects(seedanceCreate(plain, base(), deps(realEnv())), "E_DISABLED", (error) => assert.equal(error.details?.reason, "video_generation_off"));
  assert.equal(await exists(ledgerPath(plainJob)), false);
  const { context, job } = await setup(t, true);
  await rejects(seedanceCreate(context, base({ model: "seedance-2-0" }), deps(realEnv({ SEEDANCE_BUDGET_USD: "0.5" }))), "E_DISABLED", (error) => assert.equal(error.details?.reason, "budget_exceeded"));
  await rejects(seedanceCreate(context, base(), deps(realEnv({ SEEDANCE_BUDGET_USD: "-1" }))), "E_INPUT_INVALID");
  await rejects(seedanceCreate(context, base({ model: "seedance-2-5", resolution: "4k" }), deps(realEnv())), "E_INPUT_INVALID");
  assert.equal(await exists(ledgerPath(job)), false);
  assert.equal(fake.calls.length, 0); assert.equal(sentinelCalls, 0);
  // DRY_RUN also applies the budget calculation.
  await rejects(seedanceCreate(context, base(), { env: { SEEDANCE_BUDGET_USD: "0.1" }, sleep: noSleep }), "E_DISABLED", (error) => assert.equal(error.details?.reason, "budget_exceeded"));
});

test("SEEDANCE real mode create, poll and download through an injected fake fetch; cost from usage; key and signed URL stay out of records", async (t) => {
  const { context, job } = await setup(t, true);
  const sleeps: number[] = [];
  const fake = fakeArk({
    create: () => json({ id: "cgt-100" }),
    get: (_, index) => index === 0 ? json({ id: "cgt-100", status: "running" }) : succeeded("cgt-100", 100000),
    download: () => videoResponse(),
  });
  const { result } = await seedanceCreate(context, base({ model: "seedance-2-0" }), { env: realEnv({ SEEDANCE_POLL_INTERVAL_MS: "10" }), fetch: fake.impl, sleep: async (ms) => { sleeps.push(ms); }, findFfmpeg: noFfmpeg });
  assert.equal(result.task.status, "succeeded"); assert.equal(result.task.task_id, "cgt-100"); assert.equal(result.task.dry_run, false);
  assert.equal(result.task.usage_tokens, 100000); assert.equal(result.task.actual_usd, 0.7); assert.equal(result.task.estimate_usd, 0.756);
  assert.deepEqual(sleeps, [1000], "poll interval is at least 1 s");
  assert.deepEqual(fake.calls.map((call) => call.method + " " + (call.url.startsWith(BASE_URL) ? call.url.slice(BASE_URL.length).replace(/\?.*$/, "") : "download")),
    ["POST /contents/generations/tasks", "GET /contents/generations/tasks/cgt-100", "GET /contents/generations/tasks/cgt-100", "GET download"]);
  const body = JSON.parse(fake.calls[0].body!);
  assert.equal(body.model, "dreamina-seedance-2-0-260128"); assert.equal(body.resolution, "720p"); assert.equal(body.duration, 5);
  for (const call of fake.calls.slice(0, 3)) assert.equal(call.headers.Authorization, `Bearer ${SENTINEL_KEY}`);
  assert.equal(fake.calls[3].headers.Authorization, undefined, "the download carries no Authorization header");
  const files = [await fs.readFile(ledgerPath(job), "utf8"), await fs.readFile(path.join(job, "seedance", "out", "s01.json"), "utf8"), JSON.stringify(result)];
  for (const text of files) {
    assert.equal(text.includes(SENTINEL_KEY), false); assert.equal(text.includes("signed-secret-value"), false); assert.equal(text.includes("cdn.example.test"), false);
  }
  const listed = await seedanceList(context, { job: JOB }, { env: realEnv() });
  assert.equal(listed.result.summary.real_spent_usd, 0.7); assert.equal(listed.result.summary.remaining_usd, 9.3); assert.equal(listed.result.summary.api_key_present, true);
  // A real-API record is never polled while DRY_RUN is active.
  const pending = await seedanceCreate(context, base({ model: "seedance-2-0", shot_id: "s02", prompt: "別のショット", wait_ms: 0 }), { env: realEnv(), fetch: fake.impl, sleep: noSleep });
  assert.equal(pending.result.task.status, "queued");
  const before = fake.calls.length;
  const quiet = await seedanceStatus(context, { job: JOB, shot_id: "s02", wait_ms: 1000 }, { env: {}, fetch: fake.impl });
  assert.equal(quiet.result.task.status, "queued"); assert.equal(fake.calls.length, before);
  assert.ok(quiet.advisories.some((entry) => entry.id === "seedance-dry-run-active"));
  assert.equal(sentinelCalls, 0);
});

test("SEEDANCE key never leaks through failure paths", async (t) => {
  const { context, job } = await setup(t, true);
  const fake = fakeArk({ create: () => json({ error: { code: "AuthenticationError", message: `The API key ${SENTINEL_KEY} is invalid (Bearer ${SENTINEL_KEY})` } }, 401) });
  const error = await rejects(seedanceCreate(context, base(), { env: realEnv(), fetch: fake.impl, sleep: noSleep }), "E_DISABLED", (value) => assert.equal(value.details?.kind, "auth"));
  assert.equal(fake.calls[0].headers.Authorization, `Bearer ${SENTINEL_KEY}`);
  assert.equal(fullError(error).includes(SENTINEL_KEY), false, fullError(error));
  assert.equal((error.details?.api_message as string).includes("[redacted]"), true);
  assert.equal(JSON.stringify(error.details).includes("Authorization"), false);
  const text = await fs.readFile(ledgerPath(job), "utf8");
  assert.equal(text.includes(SENTINEL_KEY), false);
  assert.equal((await ledger(job))[0].status, "error", "a definite refusal is not reserved");
  const networkFake = fakeArk({ create: () => { throw Object.assign(new TypeError(`fetch failed ${SENTINEL_KEY}`), { cause: { code: "ECONNRESET", key: SENTINEL_KEY } }); } });
  const networkError = await rejects(seedanceCreate(context, base({ shot_id: "s02" }), { env: realEnv(), fetch: networkFake.impl, sleep: noSleep }), "E_ENGINE_UNREACHABLE");
  assert.equal(fullError(networkError).includes(SENTINEL_KEY), false); assert.equal(JSON.stringify(networkError.details).includes("cause"), false);
  assert.equal((await fs.readFile(ledgerPath(job), "utf8")).includes(SENTINEL_KEY), false);
  // Tracked Seedance sources assign no literal value to ARK_API_KEY other than this test's sentinel.
  const sources = [...(await fs.readdir(seedanceDirectory)).map((name) => path.join(seedanceDirectory, name)), fileURLToPath(new URL("../tools/make-seedance-mock.mjs", import.meta.url)), fileURLToPath(import.meta.url)];
  for (const file of sources) for (const match of (await fs.readFile(file, "utf8")).matchAll(/ARK_API_KEY\s*[:=]\s*["'`]([^"'`]+)["'`]/g))
    assert.match(match[1], /DO-NOT-USE/, `${path.basename(file)} assigns ARK_API_KEY`);
  assert.equal(sentinelCalls, 0);
});

test("SEEDANCE budget: concurrent creates pass one at a time, unknown and creating stay reserved, orphans fall to unknown", async (t) => {
  const { context, job } = await setup(t, true);
  let created = 0;
  const fake = fakeArk({ create: () => json({ id: `cgt-${++created}` }), get: (call) => json({ id: call.url.split("/").pop(), status: "running" }) });
  const deps: SeedanceDeps = { env: realEnv({ SEEDANCE_BUDGET_USD: "0.756" }), fetch: fake.impl, sleep: noSleep, findFfmpeg: noFfmpeg };
  const settled = await Promise.allSettled([seedanceCreate(context, base({ model: "seedance-2-0", wait_ms: 0 }), deps), seedanceCreate(context, base({ model: "seedance-2-0", shot_id: "s02", wait_ms: 0 }), deps)]);
  assert.deepEqual(settled.map((item) => item.status).sort(), ["fulfilled", "rejected"]);
  const rejected = settled.find((item) => item.status === "rejected") as PromiseRejectedResult;
  assert.equal(rejected.reason.code, "E_DISABLED"); assert.equal(rejected.reason.details.reason, "budget_exceeded");
  assert.equal(created, 1); assert.equal((await ledger(job)).length, 1);
  let summary = (await seedanceList(context, { job: JOB }, deps)).result.summary;
  assert.equal(summary.reserved_usd, 0.756); assert.equal(summary.remaining_usd, 0);

  // A 500 on create is recorded as unknown and stays reserved.
  const { context: second, job: secondJob } = await setup(t, true);
  const failing = fakeArk({ create: () => json({}, 500) });
  await rejects(seedanceCreate(second, base({ model: "seedance-2-0" }), { env: realEnv(), fetch: failing.impl, sleep: noSleep }), "E_ENGINE_UNREACHABLE", (error) => assert.match(error.details?.local_id as string, /^s-/));
  assert.equal(failing.calls.length, 1);
  const [unknown] = await ledger(secondJob);
  assert.equal(unknown.status, "unknown"); assert.equal(unknown.task_id, null);
  summary = (await seedanceList(second, { job: JOB }, { env: realEnv() })).result.summary;
  assert.equal(summary.reserved_usd, 0.756);

  // creating: a live owner within 10 minutes stays creating (reserved); a dead owner or an old record becomes unknown.
  const template = unknown;
  const now = Date.now();
  const make = (local: string, owner: number, ageMs: number): SeedanceTask => ({ ...template, local_id: local, status: "creating", owner_pid: owner, error: null, created_at: new Date(now - ageMs).toISOString(), updated_at: new Date(now - ageMs).toISOString() });
  const document = { schema: "smm.seedance-tasks/1", tasks: [make("s-20261120T000000Z-0000000a", process.pid, 1000), make("s-20261120T000000Z-0000000b", 2147483640, 1000), make("s-20261120T000000Z-0000000c", process.pid, 11 * 60 * 1000)] };
  await fs.writeFile(ledgerPath(secondJob), JSON.stringify(document));
  const listed = await seedanceList(second, { job: JOB }, { env: realEnv() });
  assert.deepEqual(listed.result.tasks.map((task) => task.status), ["creating", "unknown", "unknown"]);
  assert.equal(listed.result.summary.reserved_usd, roundTo(0.756 * 3));
  assert.deepEqual((await ledger(secondJob)).map((task) => task.status), ["creating", "creating", "creating"], "list does not write");
  await seedanceStatus(second, { job: JOB, task_id: "s-20261120T000000Z-0000000a" }, { env: realEnv(), fetch: failing.impl });
  assert.deepEqual((await ledger(secondJob)).map((task) => task.status), ["creating", "unknown", "unknown"], "status persists the reconciliation");
  assert.equal(sentinelCalls, 0);
});
const roundTo = (value: number) => Math.round(value * 1e6) / 1e6;

test("SEEDANCE status recovers an unknown task only from exactly one list match", async (t) => {
  const { context, job } = await setup(t, true);
  await rejects(seedanceCreate(context, base({ model: "seedance-2-0" }), { env: realEnv(), fetch: fakeArk({ create: () => json({}, 504) }).impl, sleep: noSleep }), "E_ENGINE_UNREACHABLE");
  const [record] = await ledger(job);
  const at = Math.floor(Date.parse(record.created_at) / 1000);
  const item = (id: string, offset: number, model = record.model.id) => ({ id, model, status: "running", created_at: at + offset });
  const ambiguous = fakeArk({ list: () => json({ items: [item("cgt-a", 5), item("cgt-b", 30), item("cgt-old", -3600), item("cgt-other", 5, "other-model")] }) });
  const first = await seedanceStatus(context, { job: JOB, task_id: record.local_id }, { env: realEnv(), fetch: ambiguous.impl, sleep: noSleep });
  assert.equal(first.result.task.status, "unknown"); assert.ok(first.advisories.some((entry) => entry.id === "seedance-unknown-task"));
  assert.equal(ambiguous.calls.length, 1);
  const single = fakeArk({ list: () => json({ items: [item("cgt-a", 5), item("cgt-old", -3600)] }), get: () => succeeded("cgt-a"), download: () => videoResponse() });
  const second = await seedanceStatus(context, { job: JOB, shot_id: "s01" }, { env: realEnv(), fetch: single.impl, sleep: noSleep, findFfmpeg: noFfmpeg });
  assert.equal(second.result.task.task_id, "cgt-a"); assert.equal(second.result.task.status, "succeeded"); assert.equal(second.result.task.output, "seedance/out/s01.mp4");
  await rejects(seedanceStatus(context, { job: JOB }, { env: {} }), "E_INPUT_INVALID");
  await rejects(seedanceStatus(context, { job: JOB, task_id: "x", shot_id: "s01" }, { env: {} }), "E_INPUT_INVALID");
  assert.equal(sentinelCalls, 0);
});

test("SEEDANCE cache: hits skip the API, verify the MP4 hash, separate mock from ark, and force recreates", async (t) => {
  const { context, job } = await setup(t, true);
  let posts = 0;
  const fake = fakeArk({ create: () => json({ id: `cgt-${++posts}` }), get: (call) => succeeded(call.url.split("/").pop()!), download: () => videoResponse() });
  const real: SeedanceDeps = { env: realEnv(), fetch: fake.impl, sleep: noSleep, findFfmpeg: noFfmpeg };
  const dry: SeedanceDeps = { env: {}, sleep: noSleep, findFfmpeg: noFfmpeg };
  const input = base({ model: "seedance-2-0" });
  const first = await seedanceCreate(context, input, real);
  assert.equal(first.result.cached, false); assert.equal(posts, 1);
  const calls = fake.calls.length;
  const hit = await seedanceCreate(context, input, real);
  assert.equal(hit.result.cached, true); assert.equal(hit.result.task.cached, true); assert.equal(hit.result.task.local_id, first.result.task.local_id);
  assert.equal(fake.calls.length, calls, "no API call on a cache hit"); assert.equal((await ledger(job)).length, 1, "a hit appends no record");
  assert.equal((await ledger(job))[0].cached, false, "the stored record is unchanged");
  // The mock never answers for the real backend and vice versa.
  const mock = await seedanceCreate(context, input, dry);
  assert.equal(mock.result.cached, false); assert.equal(mock.result.task.output, "seedance/out/s01-2.mp4");
  assert.equal((await seedanceCreate(context, input, dry)).result.cached, true);
  // A changed or missing MP4 is not a hit.
  await fs.appendFile(path.join(job, "seedance", "out", "s01-2.mp4"), "x");
  const changed = await seedanceCreate(context, input, dry);
  assert.equal(changed.result.cached, false); assert.equal(changed.result.task.output, "seedance/out/s01-3.mp4");
  await fs.rm(path.join(job, "seedance", "out", "s01.mp4"));
  const missing = await seedanceCreate(context, input, real);
  assert.equal(missing.result.cached, false); assert.equal(posts, 2); assert.equal(missing.result.task.output, "seedance/out/s01-4.mp4", "names claimed by records are not reused");
  const rehit = await seedanceCreate(context, input, real);
  assert.equal(rehit.result.cached, true); assert.equal(rehit.result.task.local_id, missing.result.task.local_id);
  const recreated = await seedanceCreate(context, { ...input, force: true }, real);
  assert.equal(recreated.result.cached, false); assert.equal(posts, 3); assert.equal(recreated.result.task.output, "seedance/out/s01-5.mp4");
  assert.equal(recreated.result.task.cache_key, missing.result.task.cache_key);
  assert.equal((await ledger(job)).length, 5);
  assert.equal(sentinelCalls, 0);
});

test("SEEDANCE invalid output is recorded as error with kind invalid_output", async (t) => {
  const { context, job } = await setup(t, true);
  const fake = fakeArk({ create: () => json({ id: "cgt-bad" }), get: () => succeeded("cgt-bad"), download: () => new Response("not an mp4 at all", { status: 200 }) });
  await rejects(seedanceCreate(context, base(), { env: realEnv(), fetch: fake.impl, sleep: noSleep, findFfmpeg: noFfmpeg }), "E_ENGINE_UNREACHABLE", (error) => assert.equal(error.details?.kind, "invalid_output"));
  const [record] = await ledger(job);
  assert.equal(record.status, "error"); assert.equal(record.output, null);
  assert.deepEqual((await fs.readdir(path.join(job, "seedance", "out"))), []);
  const unsafe = fakeArk({ create: () => json({ id: "cgt-u" }), get: () => json({ id: "cgt-u", status: "succeeded", content: { video_url: "http://127.0.0.1/v.mp4" } }) });
  await rejects(seedanceCreate(context, base({ shot_id: "s02" }), { env: realEnv(), fetch: unsafe.impl, sleep: noSleep, findFfmpeg: noFfmpeg }), "E_ENGINE_UNREACHABLE", (error) => assert.equal(error.details?.kind, "unsafe_url"));
  assert.equal(unsafe.calls.some((call) => call.url.startsWith("http://")), false);
  assert.equal(sentinelCalls, 0);
});

test("SEEDANCE review fixes: Windows device names refused before POST, lost create body stays unknown, failed output keeps its cost", async (t) => {
  const { context, job } = await setup(t, true);
  const never = fakeArk({ create: () => json({ id: "cgt-never" }) });
  for (const shot_id of ["CON", "nul", "Com1", "LPT9", "aux", "prn"]) {
    await rejects(seedanceCreate(context, base({ shot_id }), { env: realEnv(), fetch: never.impl, sleep: noSleep, findFfmpeg: noFfmpeg }), "E_INPUT_INVALID");
    assert.notDeepEqual(schemaIssues(seedanceInputSchemas.seedance_create, { job: "j", shot_id, prompt: "p" }), []);
  }
  for (const shot_id of ["CON-2", "console", "com10", "nul_take"]) assert.deepEqual(schemaIssues(seedanceInputSchemas.seedance_create, { job: "j", shot_id, prompt: "p" }), []);
  assert.equal(never.calls.length, 0);

  const lost = fakeArk({ create: () => new Response(new ReadableStream({ start(controller) { controller.error(new Error("connection reset")); } }), { status: 200 }) });
  await rejects(seedanceCreate(context, base({ shot_id: "lost" }), { env: realEnv(), fetch: lost.impl, sleep: noSleep, findFfmpeg: noFfmpeg }), "E_ENGINE_UNREACHABLE");
  assert.equal(lost.calls.filter((call) => call.method === "POST").length, 1);
  const [unknown] = await ledger(job);
  assert.equal(unknown.status, "unknown"); assert.equal(unknown.task_id, null);
  let summary = (await seedanceList(context, { job: JOB }, { env: realEnv() })).result.summary;
  assert.equal(summary.reserved_usd, unknown.estimate_usd);

  const bad = fakeArk({ create: () => json({ id: "cgt-bad2" }), get: () => succeeded("cgt-bad2", 108000, "dreamina-seedance-2-0-mini-260615"), download: () => new Response("not an mp4", { status: 200 }) });
  await rejects(seedanceCreate(context, base({ shot_id: "bad" }), { env: realEnv(), fetch: bad.impl, sleep: noSleep, findFfmpeg: noFfmpeg }), "E_ENGINE_UNREACHABLE");
  const failed = (await ledger(job)).find((task) => task.shot_id === "bad")!;
  assert.equal(failed.status, "error"); assert.equal(failed.usage_tokens, 108000); assert.equal(failed.actual_usd, 0.378);
  summary = (await seedanceList(context, { job: JOB }, { env: realEnv() })).result.summary;
  assert.equal(summary.real_spent_usd, 0.378);
  assert.equal(sentinelCalls, 0);
});

test("SEEDANCE doctor check and schemas", async () => {
  const none = seedanceDoctorCheck({});
  assert.equal(none.id, "seedance"); assert.equal(none.available, false); assert.match(none.message, /DRY_RUN/);
  assert.deepEqual(none.details, { api_key_present: false, dry_run: true, models: 5, budget_usd: 10, video_generation: null });
  const keyed = seedanceDoctorCheck({ ARK_API_KEY: SENTINEL_KEY, SEEDANCE_DRY_RUN: "false" }, { asset_generation: { video_generation: true } });
  assert.equal(keyed.available, true); assert.equal(keyed.details.video_generation, true); assert.equal(JSON.stringify(keyed).includes(SENTINEL_KEY), false);
  for (const schema of Object.values(seedanceInputSchemas)) { assert.equal(schema.additionalProperties, false); assert.equal(schema.type, "object"); }
  assert.deepEqual(schemaIssues(seedanceInputSchemas.seedance_create, { job: "j", shot_id: "s01", prompt: "p" }), []);
  assert.notDeepEqual(schemaIssues(seedanceInputSchemas.seedance_create, { job: "j", shot_id: "s01", prompt: "p", extra: 1 }), []);
  assert.notDeepEqual(schemaIssues(seedanceInputSchemas.seedance_create, { job: "j", shot_id: "s01", prompt: "p", resolution: "8k" }), []);
  assert.deepEqual(schemaIssues(seedanceInputSchemas.seedance_status, { job: "j", shot_id: "s01" }), []);
  assert.deepEqual(schemaIssues(seedanceInputSchemas.seedance_list, { job: "j" }), []);
});

test("SEEDANCE only client.ts references fetch, and nothing imports client.ts statically", async () => {
  const names = (await fs.readdir(seedanceDirectory)).filter((name) => name.endsWith(".ts"));
  assert.ok(names.includes("client.ts") && names.includes("service.ts"));
  for (const name of names) {
    if (name === "client.ts") continue;
    const source = await fs.readFile(path.join(seedanceDirectory, name), "utf8");
    assert.equal(/\bfetch\s*\(/.test(source), false, `${name} calls fetch(`);
    assert.equal(/globalThis\s*\.\s*fetch/.test(source), false, `${name} references globalThis.fetch`);
    assert.equal(/(?:from|import)\s*["']\.\/client\.ts["']/.test(source), false, `${name} imports client.ts statically`);
  }
});
