import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { connectMcp, envelope } from "../tests/helpers/mcp.ts";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "smm-mcp-tier-b-"));
const connection = await connectMcp(root);
let job: string | undefined;
async function wait(response: CallToolResult) {
  let current = envelope<"run_get">(response);
  assert.ok(current.ok, JSON.stringify(current));
  assert.ok(current.run);
  while (current.run.status === "running") {
    current = envelope<"run_get">(await connection.call("run_get", { job, run_id: current.run.id, wait_ms: 50000, log_tail: 20 }));
    assert.ok(current.ok, JSON.stringify(current)); assert.ok(current.run);
    process.stderr.write(`run: ${current.run.kind} / ${current.run.status}\n`);
  }
  assert.equal(current.run.status, "completed", JSON.stringify(current));
  assert.equal(current.run.exit_code, 0, JSON.stringify(current));
  return current;
}
try {
  const generated = envelope<"generate">(await connection.call("job_generate", { request: { form: { title: "MCP Tier B & 全角 空白", description: "実ジョブの依存導入と構造検査", audience: "開発者", voiceEngine: "none", generateAudio: false } }, out: "." }));
  assert.ok(generated.ok, JSON.stringify(generated)); job = generated.result.job!;
  const setup = await wait(await connection.call("job_setup", { job }));
  const validated = await wait(await connection.call("job_validate", { job }));
  assert.equal(validated.result.verdict, "pass");
  const status = envelope<"status">(await connection.call("job_status", { job })); assert.ok(status.ok); assert.equal(status.result.deps.installed, true);
  const report = envelope<"report">(await connection.call("report_get", { job, path: "reports/validate.json" })); assert.ok(report.ok);
  process.stdout.write(`${JSON.stringify({ tier: "B", generated_files: generated.result.file_count, setup: setup.run?.status, setup_exit_code: setup.run?.exit_code,
    validate: validated.run?.status, verdict: validated.result.verdict, validate_exit_code: validated.run?.exit_code, deps_installed: status.result.deps.installed, protocol_errors: connection.errors.length })}\n`);
} finally {
  if (job) {
    const runs = envelope<"run_list">(await connection.call("run_list", { job }));
    if (runs.ok) for (const run of runs.result.runs) if (run.status === "running") await connection.call("run_cancel", { job, run_id: run.id });
  }
  await connection.close();
  const target = path.resolve(root);
  if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith("smm-mcp-tier-b-")) throw Error("Unexpected cleanup target");
  await fs.rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
