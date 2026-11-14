import path from "node:path";
import { createHash } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult, Tool, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { PACKAGE_VERSION } from "../core/index.ts";
import { execute, exposedOperations, operations, hostError, normalizeError, resolveAllowedPath, validateAllowDirectories, validateRootDirectory } from "../host/index.ts";
import type { Envelope, HostContext, OperationDefinition, OperationInputs, OperationResults, OperationId, Run } from "../host/index.ts";
import { envelopeSchema } from "./schema.ts";

export type ServeOptions = {
  root: string; readOnly?: boolean; enableGeneration?: boolean;
  allowDirs?: readonly string[]; allowEngineHosts?: readonly string[];
};

export async function mcpContext(options: ServeOptions): Promise<HostContext> {
  const root = path.resolve(options.root);
  await validateRootDirectory(root);
  const context: HostContext = { root, requestDirectory: root, restrictToRoot: true,
    allowDirs: [...options.allowDirs ?? []], allowEngineHosts: [...options.allowEngineHosts ?? []],
    readOnly: options.readOnly ?? false, enableGeneration: options.enableGeneration ?? false, startedBy: "mcp" };
  await validateAllowDirectories(context);
  await resolveAllowedPath(context, ".", "read");
  return context;
}

export function toolDefinitions(context: HostContext): Tool[] {
  const outputSchema = envelopeSchema() as Tool["outputSchema"];
  return exposedOperations(context).map((operation) => ({ name: operation.mcp!, description: operation.description,
    inputSchema: operation.inputSchema as Tool["inputSchema"], outputSchema }));
}

export function toolResult(envelope: Envelope<OperationResults[OperationId]>): CallToolResult {
  const content: CallToolResult["content"] = [];
  let wire: Record<string, unknown> = envelope;
  if (envelope.ok && envelope.result && typeof envelope.result === "object" && "data" in envelope.result && envelope.result.data instanceof Uint8Array) {
    const result = envelope.result;
    const data = Buffer.from(result.data).toString("base64");
    wire = { ...envelope, result: { ...result, data: null, bytes: result.data.byteLength,
      sha256: createHash("sha256").update(result.data).digest("hex"), delivered_as: "image" } };
    content.push({ type: "image", mimeType: result.mime_type, data });
  }
  content.unshift({ type: "text", text: JSON.stringify(wire) });
  return { structuredContent: wire, content, isError: !envelope.ok };
}

// Observation only: host owns all waiting, results, locks, and script execution.
async function progressObserver(context: HostContext, operation: OperationDefinition, input: OperationInputs[OperationId], token: string | number,
  send: (notification: ServerNotification) => Promise<void>, signal: AbortSignal): Promise<void> {
  if (operation.kind !== "run" && operation.id !== "run_get") return;
  const value = input as OperationInputs["run_get"];
  const started = Date.now();
  let progress = 0;
  while (!signal.aborted) {
    await new Promise<void>((resolve) => {
      const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", finish); resolve(); };
      const timer = setTimeout(finish, 1000);
      signal.addEventListener("abort", finish, { once: true });
    });
    if (signal.aborted) break;
    try {
      let run: Run | undefined;
      if (operation.id === "run_get") {
        run = (await execute(context, "run_get", { job: value.job, run_id: value.run_id, wait_ms: 0, log_tail: 0 })).run;
      } else {
        const listed = await execute(context, "run_list", { job: value.job });
        if (listed.ok) run = listed.result.runs.find((item) => item.kind === operation.id && item.started_by === "mcp" && Date.parse(item.started_at) >= started);
      }
      if (run && !signal.aborted) {
        const message = run.progress.ratio === null ? run.progress.text : `${run.progress.text} (${Math.round(run.progress.ratio * 100)}%)`;
        await send({ method: "notifications/progress", params: { progressToken: token, progress: ++progress, message } });
      }
    } catch { /* Progress is advisory and cannot change an operation's outcome. */ }
  }
}

export async function createMcpServer(options: ServeOptions): Promise<Server> {
  const context = await mcpContext(options);
  const tools = toolDefinitions(context);
  const server = new Server({ name: "shin-motionmaker", version: PACKAGE_VERSION }, { capabilities: { tools: {} },
    instructions: "方向性の候補はたたき台であり固定の正解ではありません。設定の正本は生成後の project.json です。" });
  server.onerror = () => { process.stderr.write("MCP の通信処理でエラーが発生しました。\n"); };
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const operation = operations.find((item) => item.mcp === request.params.name);
    if (!operation) return toolResult({ schema: "smm.envelope/1", command: request.params.name, ok: false,
      error: normalizeError(hostError("E_USAGE", "指定したツールがありません。", "tools/list のツール名を指定してください。")) });
    const input = (request.params.arguments ?? {}) as OperationInputs[OperationId];
    const stop = new AbortController();
    const abort = () => stop.abort();
    extra.signal.addEventListener("abort", abort, { once: true });
    const token = request.params._meta?.progressToken;
    const observer = token === undefined ? undefined : progressObserver(context, operation, input, token, extra.sendNotification, stop.signal);
    try { return toolResult(await execute(context, operation.id, input)); }
    finally { stop.abort(); extra.signal.removeEventListener("abort", abort); await observer; }
  });
  return server;
}

export async function serveMcp(options: ServeOptions): Promise<Server> {
  const server = await createMcpServer(options);
  await server.connect(new StdioServerTransport());
  return server;
}
