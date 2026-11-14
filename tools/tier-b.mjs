import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { cli, mcp, option, repository, owned, removeOwned, facts, saveEvidence, cancelActiveRuns } from "./verification-lib.mjs";

const commit = option("commit", process.env.GITHUB_SHA);
assert.ok(commit, "--commit に検証対象のコミットを指定してください。");
const evidence = { tier: "B", commit, node: process.version, platform: process.platform, started_at: new Date().toISOString(), records: [], success: false };
const evidenceFile = path.resolve(option("evidence", path.join(repository, ".agent-work/m7-evidence/tier-b.json")));
const started = Date.now();
try {
  for (const entry of ["cli", "mcp"]) {
    const root = owned(path.join(repository, ".agent-work", `m7-tier-b-${entry}`));
    await removeOwned(root); await fs.mkdir(root, { recursive: true });
    const connection = entry === "mcp" ? await mcp(root) : undefined;
    let job;
    try {
      const request = { form: { title: "Tier B & 全角 空白", description: "生成から実依存導入と構造検査", audience: "開発者", voiceEngine: "none", generateAudio: false } };
      await fs.writeFile(path.join(root, "request.json"), JSON.stringify(request));
      const generated = entry === "cli" ? (await cli(["generate", "request.json", "--out", "jobs"], root)).envelope
        : await connection.call("job_generate", { request, out: "jobs" });
      assert.ok(generated.ok, JSON.stringify(generated));
      job = generated.result.job;
      evidence.records.push({ entry, operation: "generate", file_count: generated.result.file_count, project_sha256: generated.result.project_sha256 });
      for (const kind of ["setup", "validate"]) {
        console.log(`実行: Tier B ${entry} ${kind}`);
        const begin = Date.now();
        let current, polls = 0;
        if (entry === "cli") {
          const result = await cli([kind, job], root);
          assert.equal(result.code, 0, result.stdout + result.stderr); current = result.envelope;
        } else {
          current = await connection.call(`job_${kind}`, { job, wait_ms: 0 });
          assert.ok(current.ok && current.run, JSON.stringify(current));
          do {
            current = await connection.call("run_get", { job, run_id: current.run.id, wait_ms: 50000, log_tail: 0 }); polls++;
          } while (current.run?.status === "running");
        }
        assert.ok(current.ok, JSON.stringify(current)); assert.equal(current.run.status, "completed"); assert.equal(current.run.exit_code, 0);
        if (kind === "validate") assert.equal(current.result.verdict, "pass");
        evidence.records.push({ entry, operation: kind, elapsed_ms: Date.now() - begin, polls, run: current.run, result: current.result,
          artifacts: await facts(path.join(root, job), current.run.artifacts) });
      }
      assert.equal(connection?.errors.length ?? 0, 0);
    } finally { if (job) await cancelActiveRuns(root, job); await connection?.close(); await removeOwned(root); }
  }
  evidence.success = true;
} catch (error) { evidence.error = error.message; process.exitCode = 1; console.error(error.message); }
finally { evidence.elapsed_ms = Date.now() - started; evidence.ended_at = new Date().toISOString(); await saveEvidence(evidenceFile, evidence); }
