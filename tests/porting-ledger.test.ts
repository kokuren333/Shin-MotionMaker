import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";
import * as core from "../src/core/index.ts";
import { hash, readJson, repository } from "./helpers/templates.ts";

type Target = { file: string; name: string; status: "active" | "M2b" };
type Mapping = { source: { file: string; name: string }; targets: Target[]; changes: string[] };

function namedTests(file: string, source: string): Target[] {
  const found: Target[] = [];
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ["test", "test.todo"].includes(node.expression.getText(ast))) {
      const title = node.arguments[0];
      const status = node.expression.getText(ast) === "test.todo" ? "M2b" : "active";
      if (ts.isStringLiteralLike(title)) found.push({ file, name: title.text, status });
      else if (ts.isTemplateExpression(title)) {
        assert.equal(title.templateSpans.length, 1, file);
        const variable = title.templateSpans[0].expression.getText(ast);
        assert.ok(["mode", "style", "name"].includes(variable), variable);
        const values = variable === "name" ? ["explainer-anime", "explainer-attachments", "explainer-biim-duo", "explainer-biim-solo", "explainer-fullscreen", "explainer-mixed", "explainer-motion", "explainer-portrait", "minimal", "mv-landscape", "mv-portrait-options"] :
          file.endsWith("generate-job.test.ts") ? ["biim", "anime", "motion", "mixed", "mv"] : ["biim", "anime", "motion", "mixed"];
        for (const value of values) found.push({ file, name: title.head.text + value + title.templateSpans[0].literal.text, status });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return found;
}

test("TS-01 ledger covers every baseline test and points to existing active tests or explicit M2b todos", async () => {
  const inventory = await readJson("test-inventory.json");
  const ledger = JSON.parse(await fs.readFile(new URL("./fixtures/porting-ledger.json", import.meta.url), "utf8")) as { source_count: number; mappings: Mapping[] };
  const id = (item: { file: string; name: string }) => `${item.file}\0${item.name}`;
  assert.equal(ledger.source_count, inventory.count);
  assert.equal(ledger.mappings.length, inventory.count);
  assert.deepEqual(ledger.mappings.map((item) => id(item.source)).sort(), inventory.tests.map(id).sort());
  const files = new Map<string, Target[]>();
  for (const filename of await fs.readdir(path.join(repository, "tests"))) if (filename.endsWith(".test.ts")) {
    const file = `tests/${filename}`;
    files.set(file, namedTests(file, await fs.readFile(path.join(repository, file), "utf8")));
  }
  const doc = await fs.readFile(path.join(repository, "docs/PORTING_LEDGER.md"), "utf8");
  const active = new Set<string>();
  const todos = new Set<string>();
  let entirelyTransferred = 0;
  for (const mapping of ledger.mappings) {
    assert.ok(doc.includes(mapping.source.name), mapping.source.name);
    assert.ok(mapping.targets.length);
    assert.ok(mapping.changes.every((kind) => ["P1", "P2", "P3", "P4"].includes(kind)));
    if (!mapping.targets.some((target) => target.status === "active")) entirelyTransferred++;
    for (const target of mapping.targets) {
      assert.ok(files.get(target.file)?.some((existing) => id(existing) === id(target) && existing.status === target.status), target.name);
      assert.ok(doc.includes(target.name), target.name);
      (target.status === "active" ? active : todos).add(id(target));
    }
  }
  assert.equal(entirelyTransferred, 2);
  assert.equal(todos.size, 9);
  assert.ok(active.size >= inventory.count - entirelyTransferred);
  assert.ok([...files.values()].flat().filter((entry) => entry.status === "active").length >= inventory.count - entirelyTransferred);
});

test("upstream form definitions defaults assist data and public exports remain intact", async () => {
  const fixture = JSON.parse(await fs.readFile(new URL("./fixtures/core-source-manifest.json", import.meta.url), "utf8"));
  for (const chunk of fixture.chunks) {
    const body = await fs.readFile(path.join(repository, chunk.target), "utf8");
    const start = body.indexOf(chunk.start);
    const end = body.indexOf(chunk.end, start);
    assert.ok(start >= 0 && end > start);
    assert.equal(hash(body.slice(start, end).trimEnd()), chunk.sha256, chunk.source);
  }
  for (const copy of fixture.copies) {
    const bytes = await fs.readFile(path.join(repository, copy.target));
    const original = copy.target.endsWith("explainer-assist.ts") ? Buffer.from(bytes.toString("utf8").replace("../../../job-template/", "../job-template/")) : bytes;
    assert.equal(hash(original), copy.sha256, copy.source);
  }
  const entry = path.join(repository, "src/core/index.ts");
  const program = ts.createProgram([entry], { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, resolveJsonModule: true, allowImportingTsExtensions: true, noEmit: true });
  const checker = program.getTypeChecker();
  const symbol = checker.getSymbolAtLocation(program.getSourceFile(entry)!)!;
  const exports = new Set(checker.getExportsOfModule(symbol).map((entry) => entry.name));
  for (const item of fixture.exports) {
    assert.ok(exports.has(item.name), `missing public export: ${item.name}`);
    if (item.kind === "value") assert.ok(Object.hasOwn(core, item.name), item.name);
  }
});
