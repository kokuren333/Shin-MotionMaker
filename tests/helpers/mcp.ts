import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult, JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import type { Envelope, OperationId, OperationResults } from "../../src/host/index.ts";
import type { TestContext } from "node:test";
import { workspace } from "./host.ts";

export const mcpEntry = fileURLToPath(new URL("../../dist/mcp/main.js", import.meta.url));
export async function connectMcp(root: string, flags: string[] = [], entry = [mcpEntry], env?: Record<string, string>) {
  const transport = new StdioClientTransport({ command: process.execPath,
    args: [...entry, "--root", root, ...flags], stderr: "pipe", ...(env ? { env } : {}) });
  let stderr = "";
  transport.stderr!.on("data", (chunk) => { stderr += chunk.toString(); });
  const client = new Client({ name: "smm-mcp-verifier", version: "1.0.0" });
  const errors: Error[] = [], messages: JSONRPCMessage[] = [];
  client.onerror = (error) => errors.push(error);
  const start = transport.start.bind(transport);
  transport.start = async () => {
    await start();
    const onmessage = transport.onmessage!;
    transport.onmessage = (message) => { messages.push(message); onmessage(message); };
  };
  await client.connect(transport);
  await client.listTools();
  async function call(name: string, args: Record<string, unknown> = {}, progress?: (value: unknown) => void): Promise<CallToolResult> {
    const response = CallToolResultSchema.parse(await client.callTool({ name, arguments: args }, CallToolResultSchema, { timeout: 65000, ...(progress ? { onprogress: progress } : {}) }));
    const text = response.content[0]; assert.equal(text.type, "text");
    assert.deepEqual(JSON.parse((text as { text: string }).text), response.structuredContent);
    assert.equal(response.isError, response.structuredContent?.ok === false);
    return response;
  }
  async function close() { await client.close(); assert.deepEqual(errors, []); }
  return { client, transport, call, close, errors, messages, stderr: () => stderr };
}
export function envelope<K extends OperationId>(response: CallToolResult): Envelope<OperationResults[K]> {
  return response.structuredContent as unknown as Envelope<OperationResults[K]>;
}
export async function mcpWorkspace(t: TestContext, flags: string[] = []) {
  const context = await workspace(t);
  const connection = await connectMcp(context.root, flags);
  t.after(() => connection.close());
  return { context, ...connection };
}
