import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import type { DoctorResult, HostContext } from "./types.ts";
import { hostError } from "./errors.ts";
import { jobFile, readProjectFile, resolveJob } from "./paths.ts";

export async function probe(file: string, args: string[], timeout = 5000): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let stdout = "", stderr = "";
    const child = spawn(file, args, { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => child.kill(), timeout);
    child.stdout.on("data", (bytes: Buffer) => { if (stdout.length < 1024 * 1024) stdout += bytes.toString("utf8"); });
    child.stderr.on("data", (bytes: Buffer) => { if (stderr.length < 1024 * 1024) stderr += bytes.toString("utf8"); });
    child.once("error", () => { clearTimeout(timer); resolve({ code: null, stdout, stderr }); });
    child.once("close", (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}
export async function npmEntry(): Promise<string> {
  const candidates: (string | undefined)[] = [process.env.npm_execpath,
    path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
    path.resolve(path.dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js")];
  for (const directory of (process.env.PATH ?? "").split(path.delimiter).filter((entry) => path.isAbsolute(entry))) {
    candidates.push(path.join(directory, "node_modules/npm/bin/npm-cli.js"));
    try { candidates.push(path.join(path.dirname(await fs.realpath(path.join(directory, "npm"))), "npm-cli.js")); } catch {}
  }
  for (const candidate of candidates) if (candidate && path.isAbsolute(candidate) && path.basename(candidate) === "npm-cli.js") {
    try { if ((await fs.stat(candidate)).isFile()) return candidate; } catch {}
  }
  throw hostError("E_TOOL_MISSING", "npm の JavaScript 実行ファイルが見つかりません。", "Node.js と npm の導入状態を確認してください。");
}
export async function hasRuntimeDependencies(job: string): Promise<boolean> {
  try {
    const require = createRequire(path.join(job, "runtime", "package.json"));
    require.resolve("@remotion/cli/package.json"); require.resolve("typescript/bin/tsc");
    return true;
  } catch { return false; }
}
export async function findFfmpeg(job?: string): Promise<string | null> {
  const candidates = [process.env.FFMPEG_PATH, "ffmpeg"];
  if (job) {
    const require = createRequire(path.join(job, "runtime", "package.json"));
    for (const suffix of [process.platform === "win32" ? "-msvc" : process.platform === "linux" ? "-gnu" : "", ""]) {
      try {
        const metadata = require.resolve(`@remotion/compositor-${process.platform}-${process.arch}${suffix}/package.json`);
        candidates.push(path.join(path.dirname(metadata), process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"));
      } catch {}
    }
  }
  for (const candidate of candidates) if (candidate && (await probe(candidate, ["-version"])).code === 0) return candidate;
  return null;
}
export async function measureAudio(data: Uint8Array, file: string): Promise<number | null> {
  const bytes = Buffer.from(data);
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WAVE") {
    let rate = 0, size = 0;
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const length = bytes.readUInt32LE(offset + 4);
      if (length > bytes.length - offset - 8) return null;
      const kind = bytes.toString("ascii", offset, offset + 4);
      if (kind === "fmt " && length >= 16) rate = bytes.readUInt32LE(offset + 16);
      if (kind === "data") size += length;
      offset += 8 + length + length % 2;
    }
    return rate > 0 && size > 0 ? size / rate : null;
  }
  const ffmpeg = await findFfmpeg();
  if (!ffmpeg) return null;
  const result = await probe(ffmpeg, ["-nostdin", "-hide_banner", "-i", file], 15000);
  const duration = result.stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return duration ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]) : null;
}
export async function executableExists(name: string): Promise<boolean> {
  const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const directory of (process.env.PATH ?? "").split(path.delimiter).filter((entry) => path.isAbsolute(entry))) for (const extension of extensions) {
    try { if ((await fs.stat(path.join(directory, name + extension))).isFile()) return true; } catch {}
  }
  return false;
}
export function engineAllowed(context: HostContext, engine: URL): boolean {
  return !context.restrictToRoot || ["localhost", "127.0.0.1", "[::1]"].includes(engine.hostname.toLowerCase()) || context.allowEngineHosts.some((host) => host.toLowerCase() === engine.hostname.toLowerCase());
}
export async function checkEngine(context: HostContext, project: Record<string, unknown>): Promise<{ available: boolean; message: string }> {
  const voice = project.voice as Record<string, unknown> | undefined;
  if (voice?.engine !== "aivis") return { available: true, message: "Aivis は対象外です。" };
  let engine: URL;
  try { engine = new URL(String(voice.engine_url)); if (!["http:", "https:"].includes(engine.protocol)) throw Error(); }
  catch { throw hostError("E_INPUT_INVALID", "音声エンジンの URL が不正です。"); }
  if (!engineAllowed(context, engine)) throw hostError("E_DISABLED", "音声エンジンの接続先が許可されていません。", "allow-engine-host に接続先ホストを指定してください。");
  try {
    const response = await fetch(new URL("speakers", engine.href.endsWith("/") ? engine : engine.href + "/"), { signal: AbortSignal.timeout(5000), redirect: "error" });
    if (!response.ok) throw Error();
    const speakers = await response.json() as { styles?: { id: number }[] }[];
    const ids = new Set(speakers.flatMap((speaker) => speaker.styles ?? []).map((style) => style.id));
    const characters = project.characters as { voice?: { style_id?: number } }[] | undefined;
    const requested = characters?.map((character) => character.voice?.style_id) ?? [voice.style_id];
    if (!requested.every((id) => typeof id === "number" && ids.has(id))) return { available: false, message: "指定された Style ID が見つかりません。" };
    return { available: true, message: "Aivis と Style ID を確認しました。" };
  } catch { return { available: false, message: "Aivis に接続できません。" }; }
}
export async function doctor(context: HostContext, relative?: string): Promise<DoctorResult> {
  const checks: DoctorResult["checks"] = [{ id: "node", available: Number(process.versions.node.split(".")[0]) >= 22, message: `Node.js ${process.versions.node}` }];
  try { checks.push({ id: "npm", available: (await probe(process.execPath, [await npmEntry(), "--version"])).code === 0, message: "npm の実行確認です。" }); }
  catch { checks.push({ id: "npm", available: false, message: "npm が見つかりません。" }); }
  const job = relative === undefined ? undefined : await resolveJob(context, relative);
  if (job) checks.push({ id: "dependencies", available: await hasRuntimeDependencies(job), message: "Remotion CLI と TypeScript の解決結果です。" });
  checks.push({ id: "ffmpeg", available: !!await findFfmpeg(job), message: "環境指定・PATH・Remotion compositor を確認しました。" });
  const browsers = [process.env.REMOTION_BROWSER_EXECUTABLE, process.env.CHROME_PATH,
    ...[process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter((item): item is string => !!item).flatMap((directory) => [path.join(directory, "Google/Chrome/Application/chrome.exe"), path.join(directory, "Microsoft/Edge/Application/msedge.exe")])];
  let browser = false;
  for (const file of browsers) if (file) { try { if ((await fs.stat(file)).isFile()) browser = true; } catch {} }
  for (const name of ["chromium", "chromium-browser", "google-chrome"]) if (await executableExists(name)) browser = true;
  if (job) { try { if ((await fs.readdir(await jobFile(job, "node_modules/.remotion"))).some((name) => name.includes("chrome"))) browser = true; } catch {} }
  checks.push({ id: "browser", available: browser, message: browser ? "レンダー用ブラウザの候補があります。" : "ブラウザは未確認です。レンダー実行時にも確認されます。" });
  if (job) {
    const { project } = await readProjectFile(job);
    try { checks.push({ id: "aivis", ...await checkEngine(context, project) }); }
    catch (error) { checks.push({ id: "aivis", available: false, message: error && typeof error === "object" && "message" in error ? String(error.message) : "音声エンジンを確認できません。" }); }
    const generation = project.asset_generation as Record<string, unknown> | undefined;
    if (generation?.image && generation.image !== "off")
      checks.push({ id: "codex", available: await executableExists("codex"), message: "Codex CLI の所在確認です。" });
  }
  try {
    const disk = await fs.statfs(job ?? context.root);
    checks.push({ id: "disk", available: disk.bavail > 0, message: "空き容量を確認しました。", details: { available_bytes: disk.bavail * disk.bsize } });
  } catch { checks.push({ id: "disk", available: false, message: "空き容量は未確認です。" }); }
  return { checks };
}
