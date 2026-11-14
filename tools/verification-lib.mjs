import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export const repository = fileURLToPath(new URL("../", import.meta.url));
export const cliEntry = path.join(repository, "dist/cli/main.js");
export const sha256 = (data) => createHash("sha256").update(data).digest("hex");
export const relative = (file) => path.relative(repository, file).split(path.sep).join("/");
export function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? fallback : process.argv[index + 1];
}
export function owned(file) {
  const target = path.resolve(file), base = path.join(repository, ".agent-work");
  assert.ok(target.startsWith(base + path.sep), "検証用のパスは .agent-work/ 配下にしてください。");
  return target;
}
export async function removeOwned(file) {
  await fs.rm(owned(file), { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
export function scrub(value, root = repository) {
  let text = JSON.stringify(value);
  for (const source of [root, repository, os.homedir()].sort((a, b) => b.length - a.length))
    for (const version of [source, source.split(path.sep).join("/")])
      text = text.split(JSON.stringify(version).slice(1, -1)).join(source === os.homedir() ? "~" : ".");
  return JSON.parse(text);
}
export async function processResult(file, args, cwd = repository, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd, env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8").on("data", (text) => { stdout += text; });
    child.stderr.setEncoding("utf8").on("data", (text) => { stderr += text; });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}
export async function cli(args, root) {
  const result = await processResult(process.execPath, [cliEntry, ...args], root);
  let envelope;
  try { envelope = JSON.parse(result.stdout); }
  catch { throw Error(`CLI の封筒を読めません: ${result.stderr}`); }
  return { ...result, envelope };
}
export async function cancelActiveRuns(root, job) {
  const listed = await cli(["runs", "list", job], root);
  assert.ok(listed.envelope.ok, JSON.stringify(listed.envelope));
  for (const run of listed.envelope.result.runs) if (run.status === "running") {
    const cancelled = await cli(["runs", "cancel", job, run.id], root);
    assert.equal(cancelled.code, 0, JSON.stringify(cancelled.envelope));
  }
}
export async function mcp(root) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [cliEntry, "mcp", "serve", "--root", root], stderr: "pipe" });
  const client = new Client({ name: "smm-integration-verifier", version: "1.0.0" });
  const errors = [];
  client.onerror = (error) => errors.push(error.message);
  transport.stderr.on("data", () => {});
  await client.connect(transport);
  return {
    errors,
    async call(name, args) {
      const response = await client.callTool({ name, arguments: args }, undefined, { timeout: 65000 });
      assert.deepEqual(JSON.parse(response.content[0].text), response.structuredContent);
      assert.equal(response.isError, response.structuredContent.ok === false);
      return response.structuredContent;
    },
    async close() { await client.close(); assert.deepEqual(errors, []); },
  };
}
export async function facts(job, names) {
  const result = [];
  for (const name of [...new Set(names)].sort()) {
    const file = path.resolve(job, name);
    assert.ok(file.startsWith(path.resolve(job) + path.sep));
    const data = await fs.readFile(file);
    result.push({ path: name, bytes: data.length, sha256: sha256(data) });
  }
  return result;
}
export async function saveEvidence(file, evidence, root) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(scrub(evidence, root), null, 2) + "\n");
  console.log(JSON.stringify({ evidence: relative(file), sha256: sha256(await fs.readFile(file)), success: evidence.success }));
}
