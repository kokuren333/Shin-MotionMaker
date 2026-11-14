import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { architectureViolations } from "./helpers/architecture.ts";
import { repository } from "./helpers/templates.ts";

test("AR-03 all existing layers obey import boundaries", async () => {
  const violations: string[] = [];
  async function scan(directory: string) {
    let entries;
    try { entries = await fs.readdir(directory, { withFileTypes: true }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
    for (const entry of entries) {
      if (["node_modules", "dist"].includes(entry.name)) continue;
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await scan(filename);
      else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
        const relative = path.relative(repository, filename).replaceAll("\\", "/");
        for (const specifier of architectureViolations(relative, await fs.readFile(filename, "utf8")))
          violations.push(`${relative}: ${specifier}`);
      }
    }
  }
  for (const name of ["src/core", "src/host", "src/cli", "src/mcp", "gui"]) await scan(path.join(repository, name));
  assert.deepEqual(violations, []);
});

test("AR-03 scanner detects positive imports and permits only caption sharing in core", () => {
  const forbidden: [string, string][] = [
    ["src/core/a.ts", 'import fs from "node:fs/promises";'],
    ["src/core/a.ts", 'import "../host/read.ts";'],
    ["src/core/a.ts", 'export * from "../cli/main.ts";'],
    ["src/core/a.ts", 'const m = import("../../gui/src/main.ts");'],
    ["src/core/a.ts", 'import "../../job-template/runtime/scripts/qc.mjs";'],
    ["src/core/assist/a.ts", 'import "../../mcp/main.ts";'],
    ["src/cli/a.ts", 'import "../mcp/main.ts";'],
    ["src/mcp/a.ts", 'const m = require("../cli/main.ts");'],
    ["src/mcp/a.ts", 'import fs = require("node:fs");'],
    ["src/cli/a.ts", 'import { spawn } from "node:child_process";'],
    ["src/cli/a.ts", 'import "../../job-template/README.md";'],
    ["gui/src/a.ts", 'import "../../src/host/io.ts";'],
    ["gui/src/a.ts", 'export * from "../../src/cli/main.ts";'],
    ["gui/src/a.ts", 'import("../../src/mcp/main.ts");'],
  ];
  for (const [name, source] of forbidden) assert.equal(architectureViolations(name, source).length, 1, `${name}: ${source}`);
  for (const source of ['import "../../job-template/runtime/scripts/caption-capacity.mjs";',
    'import type { StyleMode } from "../../job-template/runtime/scripts/caption-capacity.d.mts";',
    '// import fs from "node:fs";\nconst text = "node:fs";',
    'import JSZip from "jszip";']) assert.deepEqual(architectureViolations("src/core/a.ts", source), []);
});
