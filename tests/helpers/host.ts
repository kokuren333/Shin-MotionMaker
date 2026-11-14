import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { cancelRun, listRuns, type HostContext } from "../../src/host/index.ts";

export async function workspace(t: TestContext): Promise<HostContext> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "smm-host-"));
  const context: HostContext = { root, requestDirectory: root, restrictToRoot: true, allowDirs: [], allowEngineHosts: [], readOnly: false, enableGeneration: false, startedBy: "mcp" };
  t.after(async () => {
    try { for (const run of await listRuns(context, "job & 全角 空白")) if (run.status === "running" || run.status === "lost") await cancelRun(context, "job & 全角 空白", run.id); } catch {}
    const resolved = path.resolve(root);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("smm-host-")) throw Error("Unexpected cleanup target");
    await fs.rm(resolved, { force: true, recursive: true, maxRetries: 10, retryDelay: 100 });
  });
  return context;
}
export async function fakeJob(context: HostContext, fixture: Record<string, unknown> = {}, legacy = false): Promise<string> {
  const job = path.join(context.root, "job & 全角 空白");
  await fs.mkdir(path.join(job, "runtime", "scripts"), { recursive: true });
  const script = await fs.readFile(new URL("../fixtures/host/job-script.mjs", import.meta.url));
  for (const name of ["qc", "validate", "sound-design", "aivis", "ghost-check", "run", "imagegen"]) await fs.writeFile(path.join(job, "runtime", "scripts", `${name}.mjs`), script);
  await fs.writeFile(path.join(job, "project.json"), JSON.stringify({ schema_version: legacy ? "0.4" : "0.5", ...(legacy ? {} : { generator: { name: "shin-motionmaker", version: "0.1.0", template_version: "0.5.1" } }), title: "Fixture", mode: "explanation", scenes: [], voice: { engine: "none" }, fixture }));
  // Lightweight resolution stubs are exclusive to the fake job, never runtime dependencies.
  for (const [name, body] of [["@remotion/cli/package.json", "{}"], ["typescript/bin/tsc", ""]]) {
    const target = path.join(job, "runtime", "node_modules", name);
    await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, body);
  }
  return job;
}
export const hostModule = fileURLToPath(new URL("../../src/host/index.ts", import.meta.url));
export const workerModule = fileURLToPath(new URL("../../src/host/worker.ts", import.meta.url));
export const fixtureModule = (name: string) => fileURLToPath(new URL(`../fixtures/host/${name}.mjs`, import.meta.url));
