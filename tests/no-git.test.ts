import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { gitLaunches } from "./helpers/git-detector.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
test("test code and helpers never launch the version-control executable", async () => {
  const violations: string[] = [];
  async function scan(directory: string) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const file = path.join(directory, entry.name);
      if (["tools/ci-local.mjs", "tools/capture-baseline.mjs"].some((name) => file === path.join(root, name))) continue;
      if (entry.isDirectory()) await scan(file);
      else if (/\.(?:[cm]?[jt]sx?)$/.test(file)) {
        for (const match of gitLaunches(await fs.readFile(file, "utf8"))) violations.push(`${path.relative(root, file)}: ${match}`);
      }
    }
  }
  for (const directory of ["tests", "gui", "tools"]) await scan(path.join(root, directory));
  assert.deepEqual(violations, []);
});

test("the process-launch guard detects positive fixture strings without executing them", async () => {
  const samples = JSON.parse(await fs.readFile(new URL("./fixtures/git-detector-samples.json", import.meta.url), "utf8")) as { positive: string[]; negative: string[] };
  for (const source of samples.positive) assert.ok(gitLaunches(source).length > 0, source);
  for (const source of samples.negative) assert.deepEqual(gitLaunches(source), [], source);
});
