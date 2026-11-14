import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { repository } from "./helpers/templates.ts";

test("DC-03 MCP client registration example launches from the repository directory", async () => {
  const configuration = JSON.parse(await fs.readFile(new URL("../docs/mcp-client.example.json", import.meta.url), "utf8"));
  const transport = new StdioClientTransport({ ...configuration.mcpServers["shin-motionmaker"], cwd: repository, stderr: "pipe" });
  const client = new Client({ name: "documentation-check", version: "1" });
  let stderr = ""; transport.stderr!.on("data", (value) => { stderr += value; });
  try {
    await client.connect(transport);
    const tools = (await client.listTools()).tools;
    assert.ok(tools.some((tool) => tool.name === "job_status"));
    assert.equal(tools.some((tool) => tool.name === "job_generate"), false);
    const candidates = await client.callTool({ name: "direction_candidates", arguments: { mode: "mv", seed: 42 } });
    assert.equal(candidates.isError, false);
  } finally { await client.close(); }
  assert.equal(stderr, "");
});
