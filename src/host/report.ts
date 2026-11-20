import fs from "node:fs/promises";
import path from "node:path";
import type { HostContext, ReportResult } from "./types.ts";
import { assertRelative, jobFile, resolveJob, openVerified } from "./paths.ts";
import { hostError, isMissing } from "./errors.ts";

export function utf8Prefix(bytes: Uint8Array, limit = bytes.length): { text: string; consumed: number } {
  let end = Math.min(bytes.length, limit);
  let start = end - 1;
  while (start >= 0 && (bytes[start] & 0xc0) === 0x80) start--;
  if (start >= 0) {
    const lead = bytes[start];
    const length = lead < 0x80 ? 1 : lead >= 0xf0 ? 4 : lead >= 0xe0 ? 3 : 2;
    if (start + length > end) end = start;
  }
  return { text: Buffer.from(bytes.subarray(0, end)).toString("utf8"), consumed: end };
}
export async function getReport(context: HostContext, relative: string, name: string): Promise<ReportResult> {
  assertRelative(name);
  const extension = path.extname(name).toLowerCase();
  const text = [".md", ".json", ".txt", ".csv"].includes(extension);
  const png = extension === ".png";
  const directory = name.startsWith("reports/") || name.startsWith("plan/");
  if (!(directory && (text || png) || ["brief.md", "AGENTS.md", "README.md"].includes(name) || /^output\/[^/]+\.png$/i.test(name) || /^seedance\/out\/[^/]+\.(png|json)$/i.test(name))) throw hostError("E_PATH_DENIED", "このファイルは report で取得できません。");
  const job = await resolveJob(context, relative);
  let handle;
  try { handle = await openVerified(await jobFile(job, name), () => jobFile(job, name), context.restrictToRoot); }
  catch (error) { if (isMissing(error)) throw hostError("E_INPUT_INVALID", "指定した記録がありません。"); throw error; }
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw hostError("E_PATH_DENIED", "通常ファイルだけを取得できます。");
    if (png && context.restrictToRoot && stat.size > 6 * 1024 * 1024)
      throw hostError("E_INPUT_INVALID", "MCP で取得する PNG は 6 MiB までです。", "CLI の smm report を使うか、画像を縮小してから取得してください。");
    if (png && stat.size > 8 * 1024 * 1024) throw hostError("E_INPUT_INVALID", "PNG が 8 MiB を超えています。", "画像を縮小してから取得してください。");
    const limit = png ? stat.size : Math.min(stat.size, 256 * 1024);
    const bytes = Buffer.alloc(limit);
    const { bytesRead } = await handle.read(bytes, 0, limit, 0);
    if (png) return { path: name, mime_type: "image/png", truncated: false, data: new Uint8Array(bytes.subarray(0, bytesRead)) };
    return { path: name, mime_type: extension === ".json" ? "application/json" : "text/plain", truncated: stat.size > limit, text: utf8Prefix(bytes.subarray(0, bytesRead)).text };
  } finally { await handle.close(); }
}
