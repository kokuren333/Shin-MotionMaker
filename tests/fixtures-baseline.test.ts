import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const base = path.resolve(fileURLToPath(new URL("./fixtures/baseline-biimmotion-262c798/", import.meta.url)));
const cases = ["mv-landscape", "mv-portrait-options", "explainer-biim-solo", "explainer-biim-duo", "explainer-anime", "explainer-motion", "explainer-mixed", "explainer-fullscreen", "explainer-portrait", "minimal"];
const readJson = async (file: string) => JSON.parse(await fs.readFile(path.join(base, file), "utf8"));

test("baseline metadata is complete and inventory counts match its named tests", async () => {
  const manifest = await readJson("template-manifest.json");
  assert.ok(manifest.files.length > 0);
  for (const file of manifest.files) {
    assert.match(file.path, /^(job-template|public\/job-assets\/fonts)\//);
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isInteger(file.bytes) && file.bytes >= 0);
    assert.equal(typeof file.excluded, "boolean");
  }
  assert.equal(new Set(manifest.files.map((file: { path: string }) => file.path)).size, manifest.files.length);
  const inventory = await readJson("test-inventory.json");
  assert.ok(inventory.count > 0);
  assert.equal(inventory.count, inventory.tests.length);
  assert.equal(inventory.count, inventory.passed + inventory.failed);
  assert.equal(inventory.passed, inventory.tests.filter((entry: { status: string }) => entry.status === "pass").length);
  for (const entry of inventory.tests) {
    assert.ok(entry.file.endsWith(".test.ts"));
    assert.ok(Array.isArray(entry.suite));
    assert.ok(entry.name.length > 0);
    assert.ok(["pass", "fail"].includes(entry.status));
  }
  const messages = await readJson("validate-form-messages.json");
  assert.ok(messages.messages.length > 0);
  assert.equal(messages.messages.length, new Set(messages.messages).size);
  assert.ok(messages.inputs.every((entry: { messages: string[] }) => entry.messages.length > 0));
  assert.deepEqual(new Set(messages.inputs.flatMap((entry: { messages: string[] }) => entry.messages)), new Set(messages.messages));
  const diffs = await readJson("allowed-diffs.json");
  assert.deepEqual(diffs.rules.map((rule: { id: string }) => rule.id), ["R1", "R2", "R3", "R4", "R5"]);
  assert.ok((await fs.readFile(path.join(base, "PROVENANCE.md"), "utf8")).includes("955fa5c"));
});

test("all ten golden cases contain requests, generated bodies and complete ZIP manifests", async () => {
  assert.deepEqual((await fs.readdir(path.join(base, "golden"))).sort(), [...cases].sort());
  const templates = (await readJson("template-manifest.json")).files;
  for (const name of cases) {
    const prefix = `golden/${name}`;
    const request = await readJson(`${prefix}/request.json`);
    assert.equal(typeof request.form, "object");
    assert.equal(typeof request.assets, "object");
    const project = await readJson(`${prefix}/project.json`);
    assert.equal(project.schema_version, "0.4");
    for (const file of ["brief.md", "agent-prompt.txt"]) assert.ok((await fs.stat(path.join(base, prefix, file))).size > 0);
    if (name.startsWith("mv-")) assert.ok((await fs.stat(path.join(base, prefix, "plan/lyrics.txt"))).size > 0);
    const manifest = await readJson(`${prefix}/zip-manifest.json`);
    assert.equal(manifest.filename, `${manifest.root}-motion-job.zip`);
    assert.ok(manifest.entries.length > 0);
    assert.equal(new Set(manifest.entries.map((entry: { path: string }) => entry.path)).size, manifest.entries.length);
    for (const entry of manifest.entries) {
      assert.ok(entry.path.startsWith(`${manifest.root}/`));
      assert.match(entry.sha256, /^[a-f0-9]{64}$/);
      assert.equal(typeof entry.directory, "boolean");
      assert.ok(Number.isInteger(entry.bytes) && entry.bytes >= 0);
    }
    for (const entry of manifest.entries) {
      if (entry.directory) continue;
      const file = entry.path.slice(manifest.root.length + 1);
      const template = templates.find((item: { zip_path: string; excluded: boolean }) => !item.excluded && item.zip_path === file);
      if (template?.sha256 === entry.sha256 && template.bytes === entry.bytes) continue;
      const body = await fs.readFile(path.join(base, prefix, file));
      assert.equal(entry.bytes, body.length);
      assert.equal(entry.sha256, createHash("sha256").update(body).digest("hex"));
    }
    for (const item of ["sources", "character", "secondCharacter", "bgm", "music"]) {
      const paths = request.assets[item];
      for (const relative of Array.isArray(paths) ? paths : paths ? [paths] : []) {
        const asset = path.resolve(base, prefix, relative);
        assert.ok(asset.startsWith(base + path.sep), relative);
        assert.ok((await fs.stat(asset)).size > 0);
      }
    }
  }
});
