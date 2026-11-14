import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import JSZip from "jszip";
import ts from "typescript";
import {
  agentPromptFor, buildJobFiles, createBrief, defaults, switchVideoMode, validateForm,
  validateRequest, zipJobFiles, PACKAGE_VERSION, TEMPLATE_VERSION, TEMPLATE_MANIFEST_SHA256,
  type Attachment, type JobAssets, type MotionForm,
} from "../src/core/index.ts";
import { baseline, repository, readJson, hash, fileMap, loadAssets, loadTemplates } from "./helpers/templates.ts";

const diffs = await readJson("allowed-diffs.json");
const r1Occurrences = [2, 1, 1, 1, 1, 1, 1, 1, 1];
// Files whose bytes reverse through enumerated replacements/appends (R1 R3 R4 R6).
const reversible = ["AGENTS.md", "README.md", "runtime/scripts/validate.mjs", "runtime/scripts/run.mjs", "runtime/scripts/ghost-check.mjs"];
// Files the template adds to the baseline: R3 NOTICE and R6 encoder.mjs only.
const addedFiles = diffs.rules.filter((rule: { id: string }) => ["R3", "R6"].includes(rule.id)).flatMap((rule: { added_files: { path: string; sha256: string }[] }) => rule.added_files);
assert.deepEqual(diffs.rules.find((rule: { id: string }) => rule.id === "R6").added_files.map((entry: { path: string }) => entry.path), ["runtime/scripts/encoder.mjs"]);
assert.deepEqual(addedFiles.map((entry: { path: string }) => entry.path), ["NOTICE", "runtime/scripts/encoder.mjs"]);
assert.equal(diffs.rules[0].replacements.length, r1Occurrences.length);
function reverseText(name: string, text: string): string {
  for (const rule of [...diffs.rules].reverse()) {
    for (const append of rule.appends ?? []) if (append.path === name) {
      assert.ok(text.endsWith(append.text), `missing ${rule.id} suffix: ${name}`);
      text = text.slice(0, -append.text.length);
    }
    for (const pair of [...(rule.replacements ?? [])].reverse() as { path?: string; from: string; to: string }[]) {
      if (pair.path !== name) continue;
      assert.ok(text.includes(pair.to), `missing ${rule.id} replacement: ${name}`);
      if (rule.id === "R1") {
        const index = rule.replacements.indexOf(pair);
        assert.equal(text.split(pair.to).length - 1, r1Occurrences[index], `R1 occurrence count: ${name} / ${pair.to}`);
      }
      text = text.replaceAll(pair.to, pair.from);
    }
  }
  return text;
}

function normalizeGenerated(name: string, bytes: Uint8Array, mv: boolean, styleMode: string): Uint8Array {
  let text: string;
  if (name === "project.json") {
    text = new TextDecoder().decode(bytes);
    const project = JSON.parse(text);
    assert.deepEqual(Object.keys(project).slice(0, 2), ["schema_version", "generator"]);
    assert.deepEqual(project.generator, { name: "shin-motionmaker", version: PACKAGE_VERSION, template_version: TEMPLATE_VERSION });
    assert.deepEqual(Object.keys(project.generator), ["name", "version", "template_version"]);
    const generator = JSON.stringify(project.generator, null, 2).replaceAll("\n", "\n  ");
    const expected = `"schema_version": "0.5",\n  "generator": ${generator},`;
    assert.ok(text.includes(expected));
    return new TextEncoder().encode(text.replace(expected, '"schema_version": "0.4",'));
  }
  if (name === "brief.md" && !mv) {
    text = new TextDecoder().decode(bytes);
    assert.doesNotMatch(text, /Opus/i);
    for (const pair of diffs.rules.find((rule: { id: string }) => rule.id === "R5").replacements) {
      if (["biim", "mixed"].includes(styleMode)) assert.ok(text.includes(pair.to), `missing R5 replacement: ${styleMode}`);
      text = text.replaceAll(pair.to, pair.from);
    }
    return new TextEncoder().encode(text);
  }
  if (reversible.includes(name))
    return new TextEncoder().encode(reverseText(name, new TextDecoder().decode(bytes)));
  return bytes;
}

test("JT-11 template and font bytes reverse only the enumerated R1 R3 R4 R6 differences", async () => {
  const manifest = await readJson("template-manifest.json");
  const files = { ...Object.fromEntries(Object.entries(await fileMap(path.join(repository, "job-template"))).map(([name, bytes]) => [`job-template/${name}`, bytes])),
    ...Object.fromEntries(Object.entries(await fileMap(path.join(repository, "job-assets/fonts"))).map(([name, bytes]) => [`public/job-assets/fonts/${name}`, bytes])) };
  const added = addedFiles;
  assert.deepEqual(Object.keys(files).sort(), [...manifest.files.map((entry: { path: string }) => entry.path),
    ...added.map((entry: { path: string }) => `job-template/${entry.path}`)].sort());
  for (const entry of manifest.files) {
    let data = files[entry.path];
    const name = entry.path.replace(/^job-template\//, "");
    if (reversible.includes(name))
      data = new TextEncoder().encode(reverseText(name, new TextDecoder().decode(data)));
    assert.equal(hash(data), entry.sha256, entry.path);
    assert.equal(data.byteLength, entry.bytes, entry.path);
  }
  for (const entry of added) assert.equal(hash(files[`job-template/${entry.path}`]), entry.sha256);
});

test("template version identifies the complete installed template manifest", async () => {
  const files = await fileMap(path.join(repository, "job-template"));
  const entries = Object.keys(files).sort().map((name) => ({ path: name, sha256: hash(files[name]) }));
  const text = JSON.stringify(entries) + "\n";
  assert.equal(hash(text), TEMPLATE_MANIFEST_SHA256);
  const versions = JSON.parse(await fs.readFile(new URL("./fixtures/template-versions.json", import.meta.url), "utf8"));
  assert.equal(versions[TEMPLATE_VERSION], TEMPLATE_MANIFEST_SHA256);
  assert.equal(text, await fs.readFile(new URL(`./fixtures/template-manifest-${TEMPLATE_VERSION}.json`, import.meta.url), "utf8"));
  assert.equal(PACKAGE_VERSION, JSON.parse(await fs.readFile(path.join(repository, "package.json"), "utf8")).version);
});

for (const name of await fs.readdir(path.join(baseline, "golden"))) {
  test(`JT-11 golden paths and bytes: ${name}`, async () => {
    const prefix = `golden/${name}`;
    const request = await readJson(`${prefix}/request.json`);
    const assets = await loadAssets(request.assets, path.join(baseline, prefix));
    const validated = validateRequest(request, { phase: "complete", assets });
    assert.ok(validated.ok);
    const form = validated.value.form;
    const mv = form.videoMode === "mv";
    const job = await buildJobFiles(form, assets, await loadTemplates());
    const expected = await readJson(`${prefix}/zip-manifest.json`);
    assert.equal(job.filename, expected.filename);
    assert.equal(job.rootName, expected.root);
    assert.equal(job.agentPrompt, await fs.readFile(path.join(baseline, prefix, "agent-prompt.txt"), "utf8"));
    const zip = await JSZip.loadAsync((await zipJobFiles(job)).data);
    const extra = addedFiles;
    assert.deepEqual(Object.keys(zip.files).sort(), [...expected.entries.map((entry: { path: string }) => entry.path),
      ...extra.map((entry: { path: string }) => `${job.rootName}/${entry.path}`)].sort());
    for (const entry of expected.entries) {
      const item = zip.files[entry.path];
      assert.equal(item.dir, entry.directory, entry.path);
      const relative = entry.path.slice(job.rootName.length + 1);
      const bytes = entry.directory ? new Uint8Array() : normalizeGenerated(relative, await item.async("uint8array"), mv, form.styleMode);
      assert.equal(hash(bytes), entry.sha256, `${name}: ${relative}`);
      assert.equal(bytes.byteLength, entry.bytes, `${name}: ${relative}`);
      if (!entry.directory) assert.deepEqual(await item.async("uint8array"), job.files[relative]);
    }
    for (const file of ["brief.md", "project.json", ...(mv ? ["plan/lyrics.txt"] : form.outline.trim() ? ["plan/outline.txt"] : [])])
      assert.deepEqual(Buffer.from(normalizeGenerated(file, job.files[file], mv, form.styleMode)), await fs.readFile(path.join(baseline, prefix, file)), file);
    if (mv) {
      assert.deepEqual(Buffer.from(createBrief(form, assets)), await fs.readFile(path.join(baseline, prefix, "brief.md")));
      assert.equal(agentPromptFor("mv"), job.agentPrompt);
      assert.equal(job.files["plan/outline.txt"], undefined);
      for (const key of ["style_mode", "takeaway", "prior_knowledge", "outline"]) assert.equal(key in job.project.direction, false);
    }
  });
}

test("MV form settings, prompt, brief, project and lyrics match the captured baseline without history", async () => {
  const request = await readJson("golden/mv-landscape/request.json");
  const second = await readJson("golden/mv-portrait-options/request.json");
  const form: MotionForm = {
    ...defaults, title: "虹のしくみ", description: "光の分散を説明する", audience: "中高生",
    takeaway: "太陽の反対側に虹が見える理由を言える", priorKnowledge: "光は直進する。雨粒の色が虹になるという誤解。",
    outline: "## 問い\r\n\r\n虹はなぜ見える？\r\n雨粒の中で光が曲がる。\n42度の方向を確かめる。\n",
    differentiation: "MV用のメモ", explainerDifferentiation: "前作のチャート中心から、光の経路を育てる図へ",
  };
  const settings = [{}, { width: 1080, height: 1920, design: "歌詞を巨大文字で見せる", instructions: "音に同期", videoGeneration: true }];
  for (const [index, expected] of [request.form, second.form].entries()) {
    const input = { ...form, ...settings[index], musicDurationSec: 30, musicLyrics: "[Verse]\r\n一行目\n二行目\n" };
    assert.equal(input.videoMode, "explanation");
    const actual = switchVideoMode(input, "mv");
    assert.deepEqual(actual, expected);
  }
});

test("JT-11 validateForm preserves the complete baseline message set and concrete character numbers", async () => {
  const fixture = await readJson("validate-form-messages.json");
  const messages = new Set<string>();
  for (const input of fixture.inputs) {
    const form = { ...defaults, ...input.form, secondCharacter: { ...defaults.secondCharacter, ...input.form.secondCharacter } } as MotionForm;
    const attachment = (metadata: { name: string; size: number }): Attachment => ({ ...metadata, data: new Uint8Array(), type: "application/octet-stream" });
    const assets: JobAssets = { sources: input.assets.sources.map(attachment) };
    for (const key of ["character", "secondCharacter", "bgm", "music"] as const)
      if (input.assets[key]) assets[key] = attachment(input.assets[key]);
    const actual = validateForm(form, assets);
    assert.deepEqual(actual, input.messages, input.id);
    for (const message of actual) messages.add(message.replace(/参考URLの\d+行目/, "参考URLの1行目"));
  }
  assert.deepEqual([...messages].sort(), fixture.messages);
  const errors = validateForm({ ...defaults, urls: "ftp://one\nftp://two\nhttps://example.com\nftp://four" });
  for (const index of [1, 2, 4]) assert.ok(errors.includes(`参考URLの${index}行目を確認してください（HTTP / HTTPSのみ）。`));
  const source = await fs.readFile(path.join(repository, "src/core/request.ts"), "utf8");
  const ast = ts.createSourceFile("request.ts", source, ts.ScriptTarget.Latest, true);
  const declared = new Set<string>();
  function collect(node: ts.Expression) {
    if (ts.isStringLiteral(node)) declared.add(node.text);
    else if (ts.isConditionalExpression(node)) { collect(node.whenTrue); collect(node.whenFalse); }
    else if (ts.isTemplateExpression(node)) {
      assert.equal(node.templateSpans.length, 1);
      const span = node.templateSpans[0];
      const expression = span.expression.getText(ast);
      const values = expression === "i + 1" ? (node.head.text === "参考URLの" ? ["1"] : ["1", "2"]) : expression === "key" ?
        ["tempo", "energy", "motionAmount", "biimUsage", "characterUsage", "evidencePolicy"] : [];
      assert.ok(values.length, expression);
      for (const value of values) declared.add(node.head.text + value + span.literal.text);
    } else assert.fail(`unrecognized validation message: ${node.getText(ast)}`);
  }
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "errors.push") for (const argument of node.arguments) collect(argument);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.deepEqual([...declared].sort(), fixture.messages);
});
