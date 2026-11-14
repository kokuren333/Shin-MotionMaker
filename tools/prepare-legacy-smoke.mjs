import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { option, repository, owned, removeOwned, processResult, sha256, saveEvidence } from "./verification-lib.mjs";

// Run only against a separately cloned original repository, never its working tree.
const source = path.resolve(option("source"));
const root = owned(path.join(repository, ".agent-work/m7-legacy-source"));
const manifest = JSON.parse(await fs.readFile(path.join(repository, "tests/fixtures/baseline-biimmotion-262c798/template-manifest.json"), "utf8"));
const script = await fs.readFile(path.join(source, "job-template/runtime/scripts/validate.mjs"));
const entries = Array.isArray(manifest) ? manifest : manifest.files;
assert.equal(sha256(script), entries.find((entry) => entry.path === "job-template/runtime/scripts/validate.mjs").sha256);
await removeOwned(root); await fs.mkdir(root, { recursive: true });
const input = path.join(root, "request.json");
await fs.writeFile(input, JSON.stringify({ form: { title: "Legacy source", description: "原典生成ジョブの互換検証", audience: "開発者",
  width: 640, height: 360, durationSec: 30, voiceEngine: "none", generateAudio: true, imageGeneration: false } }));
const result = await processResult(process.execPath, ["--experimental-strip-types", path.join(source, "tools/generate-job.ts"), input, `--out=${path.join(root, "jobs")}`], source);
assert.equal(result.code, 0, result.stderr);
const job = path.join(root, "jobs/Legacy source");
const project = await fs.readFile(path.join(job, "project.json"));
assert.equal(JSON.parse(project).schema_version, "0.4"); assert.equal(JSON.parse(project).generator, undefined);
const generatedScript = await fs.readFile(path.join(job, "runtime/scripts/validate.mjs"));
assert.equal(sha256(generatedScript), sha256(script));
await saveEvidence(path.join(root, "origin.json"), { success: true, source: "BiimMotion 262c79876a9c4635377114902d58ce783e7578b1",
  command: ["node", "--experimental-strip-types", "tools/generate-job.ts", "<request.json>", "--out=<scratch jobs>"],
  schema_version: "0.4", generator: null, exit_code: result.code, project_sha256: sha256(project), validate_script_sha256: sha256(generatedScript) });
