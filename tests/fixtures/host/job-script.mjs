import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const job = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const project = JSON.parse(await fs.readFile(path.join(job, "project.json"), "utf8"));
const fixture = project.fixture ?? {};
if (fixture.delay) await new Promise((resolve) => setTimeout(resolve, fixture.delay));
if (fixture.scenario === "sleep") {
  const child = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { detached: fixture.detachedChild === true, shell: false, windowsHide: true, stdio: "ignore" });
  await fs.writeFile(path.join(job, "child.pid"), String(child.pid));
  console.log("子プロセスを開始しました。");
  await new Promise(() => {});
} else if (fixture.scenario === "crash") {
  console.error("Error: fixture failure"); process.exitCode = 1;
} else if (fixture.scenario !== "stale") {
  const verdict = fixture.scenario === "fail" ? "fail" : "pass";
  const filename = path.basename(fileURLToPath(import.meta.url));
  await fs.mkdir(path.join(job, "reports"), { recursive: true });
  if (filename === "qc.mjs") {
    if (project.mode !== "mv") {
      const stage = process.argv.find((value) => value.startsWith("--stage="))?.slice(8) ?? "pre";
      await fs.writeFile(path.join(job, `reports/qc-${stage}.json`), JSON.stringify({ kind: "biim-explainer-qc", schema_version: "1", stage, verdict: fixture.scenario === "mismatch" ? "fail" : verdict, gates: [], advisories: [{ id: "fixture", scope: "all", detail: "テストの助言です。", scene_ids: [] }], inputs: {}, waivers: [], review_mode: "self" }));
    }
  } else if (filename === "validate.mjs") {
    console.log("OK project");
    if (verdict === "pass") console.log("Structural checks passed. Visual and audio QA still requires watching and listening.");
    else console.error("project: fixture rejected");
    if (project.schema_version !== "0.4") await fs.writeFile(path.join(job, "reports/validate.json"), JSON.stringify({ schema: "smm.validate/1", final: false, double_render: false, verdict, checks: [{ name: "project", status: verdict === "pass" ? "ok" : "error", message: "確認しました。" }], advisories: [] }));
  }
  process.exitCode = verdict === "fail" ? 1 : 0;
}
