import fs from "node:fs/promises";
import { toolDefinitions } from "../src/mcp/index.ts";
import type { HostContext } from "../src/host/index.ts";

const context: HostContext = { root: process.cwd(), requestDirectory: process.cwd(), restrictToRoot: true,
  allowDirs: [], allowEngineHosts: [], readOnly: false, enableGeneration: true, startedBy: "mcp" };
const definitions = toolDefinitions(context);
// All tools use the same envelope; keep its full schema once for a reviewable snapshot.
const snapshot = { outputSchema: definitions[0].outputSchema,
  tools: definitions.map((tool) => ({ ...tool, outputSchema: { $ref: "#/outputSchema" } })) };
await fs.writeFile(new URL("../tests/fixtures/mcp-tools.json", import.meta.url), `${JSON.stringify(snapshot, null, 2)}\n`);
