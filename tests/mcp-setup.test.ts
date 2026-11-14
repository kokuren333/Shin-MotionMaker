import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fakeJob } from "./helpers/host.ts";
import { mcpWorkspace, envelope } from "./helpers/mcp.ts";

test("M3 setup resolves npm workspace URLs in a Windows path with spaces ampersands and fullwidth characters", async (t) => {
  const { context, call } = await mcpWorkspace(t);
  const job = await fakeJob(context);
  await fs.writeFile(path.join(job, "package.json"), JSON.stringify({ name: "mcp-setup-fixture", private: true, workspaces: ["runtime"] }));
  await fs.writeFile(path.join(job, "runtime", "package.json"), JSON.stringify({ name: "mcp-runtime-fixture", version: "1.0.0", private: true }));
  await fs.writeFile(path.join(job, ".npmrc"), "audit=false\nfund=false\nupdate-notifier=false\n");
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = envelope<"setup">(await call("job_setup", { job: "job & 全角 空白", wait_ms: 50000 }));
    assert.ok(result.ok, JSON.stringify(result)); assert.equal(result.run?.status, "completed", JSON.stringify(result)); assert.equal(result.run.exit_code, 0);
  }
  assert.ok((await fs.stat(path.join(job, "package-lock.json"))).isFile());
});
