import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { readJobBytes } from "./paths.ts";
import { isMissing } from "./errors.ts";

export function processExists(pid: number | null): boolean {
  if (!pid || !Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    if (process.platform === "linux") {
      const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
      if (stat.slice(stat.lastIndexOf(")") + 2).startsWith("Z ")) return false;
    }
    return true;
  }
  catch (error) { return !(error && typeof error === "object" && "code" in error && error.code === "ESRCH"); }
}
export type ProcessIdentity = { pid: number; birth: string };
export type ProcessOwners = { worker?: ProcessIdentity; script?: ProcessIdentity; token: string };
let selfIdentity: ProcessIdentity | undefined;
let selfLookup: Promise<ProcessIdentity | null | undefined> | undefined;
export async function identifyProcess(pid: number | null): Promise<ProcessIdentity | null | undefined> {
  if (pid !== process.pid) return inspectProcess(pid);
  selfLookup ??= inspectProcess(pid);
  const result = await selfLookup;
  if (!result) selfLookup = undefined;
  return result;
}
async function inspectProcess(pid: number | null): Promise<ProcessIdentity | null | undefined> {
  if (!processExists(pid)) return null;
  if (pid === process.pid && selfIdentity) return selfIdentity;
  try {
    if (process.platform === "linux") {
      const stat = await fs.readFile(`/proc/${pid}/stat`, "utf8");
      const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      if (fields[0] === "Z") return null;
      return { pid: pid!, birth: fields[19] };
    }
    if (process.platform === "win32") {
      const executable = path.join(process.env.SystemRoot ?? "C:/Windows", "System32/WindowsPowerShell/v1.0/powershell.exe");
      const value = await new Promise<string>((resolve, reject) => {
        // Call .NET directly: cmdlets trigger module discovery, which takes over 20 seconds under the
        // reduced environment MCP clients pass to stdio servers. Ticks are floored to microseconds so
        // both sources yield the same value as Win32_Process.CreationDate.
        const child = spawn(executable, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
          `$ErrorActionPreference='Stop'; $t=$null; try { $t=[System.Diagnostics.Process]::GetProcessById(${pid}).StartTime.ToUniversalTime().Ticks } catch { foreach($p in ([wmisearcher]'SELECT CreationDate FROM Win32_Process WHERE ProcessId=${pid}').Get()){ $t=[System.Management.ManagementDateTimeConverter]::ToDateTime($p.CreationDate).ToUniversalTime().Ticks } }; if($t -ne $null){ ($t - ($t % 10)).ToString() }`],
        { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
        let output = "";
        const timer = setTimeout(() => { child.kill(); reject(Error("identity_timeout")); }, 10000);
        child.stdout.on("data", (data: Buffer) => { output += data; });
        child.once("error", (error) => { clearTimeout(timer); reject(error); });
        child.once("close", (code) => { clearTimeout(timer); code === 0 ? resolve(output.trim()) : reject(Error("identity_unavailable")); });
      });
      const identity = /^\d+$/.test(value) ? { pid: pid!, birth: value } : processExists(pid) ? undefined : null;
      if (pid === process.pid && identity) selfIdentity = identity;
      return identity;
    }
  } catch { return processExists(pid) ? undefined : null; }
  return undefined;
}
// Unknown ownership remains busy, but is never permission to send a signal.
export async function processState(pid: number | null, identity?: ProcessIdentity): Promise<"same" | "absent" | "unknown"> {
  if (!processExists(pid)) return "absent";
  if (!identity) return "unknown";
  if (identity.pid !== pid) return "absent";
  const actual = await identifyProcess(pid);
  return actual === undefined ? "unknown" : actual?.birth === identity.birth ? "same" : "absent";
}
export async function readProcessOwners(job: string, id: string): Promise<ProcessOwners> {
  try { return JSON.parse((await readJobBytes(job, `.smm/runs/${id}/processes.json`)).toString("utf8")); }
  catch (error) { if (isMissing(error)) return { token: "" }; throw error; }
}
export async function descendantIdentities(parent: number): Promise<ProcessIdentity[]> {
  if (process.platform !== "linux") return [];
  const rows: { pid: number; parent: number; identity: ProcessIdentity }[] = [];
  for (const name of await fs.readdir("/proc")) if (/^\d+$/.test(name)) {
    try {
      const stat = await fs.readFile(`/proc/${name}/stat`, "utf8");
      const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      rows.push({ pid: Number(name), parent: Number(fields[1]), identity: { pid: Number(name), birth: fields[19] } });
    } catch {}
  }
  const found = new Set([parent]);
  for (let changed = true; changed;) {
    changed = false;
    for (const row of rows) if (found.has(row.parent) && !found.has(row.pid)) { found.add(row.pid); changed = true; }
  }
  return rows.filter((row) => row.pid !== parent && found.has(row.pid)).map((row) => row.identity);
}
