import path from "node:path";
import { execute, errorExitCode, hostError, normalizeError, readJsonInput, readTextInput, readRunLog, type Envelope, type HostContext, type OperationInputs, type Run } from "../host/index.ts";
import { parseCommand, type Invocation } from "./commands.ts";

type Output = { stdout: (text: string) => void; stderr: (text: string) => void };
export function cliContext(cwd: string): HostContext {
  return { root: cwd, requestDirectory: cwd, restrictToRoot: false, allowDirs: [], allowEngineHosts: [], readOnly: false, enableGeneration: true, startedBy: "cli" };
}
async function convertFiles(invocation: Invocation, context: HostContext): Promise<void> {
  const { definition, input } = invocation;
  if (definition.id === "generate") {
    const file = input.request as string;
    input.request = await readJsonInput(file, context);
    context.requestDirectory = path.dirname(path.resolve(context.root, file));
  } else if (definition.id === "stats") {
    input.text = await readTextInput(input.text as string, context);
    if (typeof input.request === "string") input.request = await readJsonInput(input.request, context);
  } else if (definition.id === "project_patch") input.patch = await readJsonInput(input.patch as string, context);
}

async function followRun(context: HostContext, invocation: Invocation, initial: Envelope<unknown>, stderr: Output["stderr"]): Promise<Envelope<unknown>> {
  let current = initial;
  const run = initial.run!;
  const job = invocation.input.job as string;
  const offsets = { stdout: 0, stderr: 0 };
  for (;;) {
    for (const stream of ["stdout", "stderr"] as const) {
      const chunk = await readRunLog(path.resolve(context.root, job), run.id, stream, offsets[stream]);
      if (chunk.text) stderr(chunk.text);
      offsets[stream] = chunk.next_offset;
    }
    if (!current.ok || !current.run || current.run.status !== "running") break;
    await new Promise((resolve) => setTimeout(resolve, 100));
    current = await execute(context, "run_get", { job, run_id: run.id, log_tail: (invocation.input.log_tail as number | undefined) ?? 100, wait_ms: 0 });
  }
  if (!current.run) return { ...current, command: invocation.command, run };
  if (invocation.definition.kind !== "run") return { ...current, command: invocation.command };
  const terminal = current.run;
  if (!terminal || !current.ok) return { ...current, command: invocation.command };
  if (terminal.error) return { schema: "smm.envelope/1", command: invocation.command, job: terminal.job, ok: false, error: terminal.error, run: terminal };
  return { ...current, command: invocation.command, result: terminal.result ?? null };
}
export function serializeEnvelope(envelope: Envelope<unknown>): string {
  return JSON.stringify(envelope, (_key, value) => value instanceof Uint8Array ? Buffer.from(value).toString("base64") : value);
}
function encodeReport(envelope: Envelope<unknown>): Envelope<unknown> {
  if (envelope.ok && envelope.command === "report" && envelope.result && typeof envelope.result === "object" && "data" in envelope.result)
    return { ...envelope, result: { ...envelope.result, data: Buffer.from(envelope.result.data as Uint8Array).toString("base64"), encoding: "base64" } };
  return envelope;
}
function humanSummary(envelope: Envelope<unknown>): string {
  if (!envelope.ok) return `${envelope.command}: ${envelope.error.code}\n${envelope.error.message}\n${envelope.error.hint}\n`;
  const verdict = envelope.result && typeof envelope.result === "object" && "verdict" in envelope.result ? ` / ${envelope.result.verdict}` : "";
  return `${envelope.command}: 実行結果を取得しました${verdict}\n${envelope.run ? `run: ${envelope.run.id} (${envelope.run.status})\n` : ""}${JSON.stringify(envelope.result, null, 2)}\n`;
}
export async function runCli(argv: string[], cwd: string, output: Output): Promise<number> {
  let invocation: Invocation | undefined;
  let envelope: Envelope<unknown>;
  let terminal: Run | undefined;
  let observedRun: Run | undefined;
  try {
    invocation = parseCommand(argv);
    const context = cliContext(cwd);
    if (invocation.definition.id === "mcp_serve") throw hostError("E_DISABLED", "MCP サーバーの入口は未接続です。", "M3 のサーバーを統合した版で実行してください。");
    await convertFiles(invocation, context);
    if (invocation.definition.kind === "run") invocation.input.wait_ms = 0;
    if (invocation.command === "runs wait" || invocation.command === "runs logs") invocation.input.wait_ms = 0;
    envelope = await execute(context, invocation.definition.id, invocation.input as OperationInputs[typeof invocation.definition.id]);
    envelope = { ...envelope, command: invocation.command };
    observedRun = envelope.run;
    if (envelope.run && (invocation.definition.kind === "run" && !invocation.detach || invocation.command === "runs wait")) {
      envelope = await followRun(context, invocation, envelope, output.stderr);
      terminal = envelope.run;
    }
    envelope = encodeReport(envelope);
  } catch (error) {
    envelope = { schema: "smm.envelope/1", command: invocation?.command ?? argv.slice(0, 2).join(" "), ok: false, error: normalizeError(error), ...(observedRun ? { run: observedRun, job: observedRun.job } : {}) };
  }
  output.stdout(invocation?.human || !invocation && argv.includes("--human") ? humanSummary(envelope) : serializeEnvelope(envelope) + "\n");
  if (!envelope.ok) return errorExitCode(envelope.error.code);
  return terminal?.exit_code ?? 0;
}
