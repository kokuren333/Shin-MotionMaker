import { parseArgs, type ParseArgsConfig } from "node:util";
import type { JsonObject } from "../core/index.ts";
import type { OperationDefinition, OperationId } from "../host/index.ts";
import { hostError, operations } from "../host/index.ts";

const positionalFields: Partial<Record<OperationId, readonly string[]>> = {
  generate: ["request"], stats: ["text"], status: ["job"], project_get: ["job"],
  project_patch: ["job", "patch"], report: ["job", "path"], setup: ["job"],
  validate: ["job"], qc: ["job"], ghost_check: ["job"], render: ["job"],
  voice: ["job"], sound: ["job"], imagegen: ["job"], run_get: ["job", "run_id"],
  run_list: ["job"], run_cancel: ["job", "run_id"], doctor: ["job"], schema: ["name"], studio: ["job"],
};
export const cliCommands = operations.flatMap((operation) => operation.cli.map((command) => ({ command, operation })));
export type Invocation = { definition: OperationDefinition; command: string; input: Record<string, unknown>; human: boolean; detach: boolean };

export function parseCommand(argv: string[]): Invocation {
  const args = [...argv];
  let humanPrefix = false;
  if (args[0] === "--human") { humanPrefix = true; args.shift(); }
  const found = cliCommands.find(({ command }) => command.split(" ").every((word, index) => args[index] === word));
  if (!found) throw hostError("E_USAGE", "コマンドを指定してください。", `利用できるコマンド: ${cliCommands.map((item) => item.command).join(", ")}`);
  const { operation: definition, command } = found;
  const positionals = positionalFields[definition.id] ?? [];
  const properties = definition.inputSchema.properties as JsonObject;
  const options: NonNullable<ParseArgsConfig["options"]> = { human: { type: "boolean" } };
  const fieldNames = new Map<string, string>();
  for (const [field, schema] of Object.entries(properties)) {
    if (positionals.includes(field) || definition.id === "generate" && field === "format") continue;
    const name = field === "refs" ? "ref" : field.replaceAll("_", "-");
    const type = (schema as JsonObject).type;
    options[name] = { type: type === "boolean" ? "boolean" : "string", ...(type === "array" ? { multiple: true } : {}) };
    fieldNames.set(name, field);
  }
  if (definition.id === "generate") options.zip = { type: "boolean" };
  if (definition.kind === "run") options.detach = { type: "boolean" };
  let parsed;
  try { parsed = parseArgs({ args: args.slice(command.split(" ").length), options, allowPositionals: true, strict: true, tokens: true }); }
  catch { throw hostError("E_USAGE", "引数の指定が不正です。", "コマンドのオプション名・値・必要な位置引数を確認してください。"); }
  const seen = new Set<string>(humanPrefix ? ["human"] : []);
  for (const token of parsed.tokens) if (token.kind === "option") {
    if (seen.has(token.name) && !options[token.name].multiple) throw hostError("E_USAGE", "同じオプションを重複して指定できません。", `--${token.name} は1回だけ指定してください。`);
    seen.add(token.name);
  }
  const required = definition.inputSchema.required as string[];
  const minimum = positionals.filter((name) => required.includes(name)).length;
  if (parsed.positionals.length < minimum || parsed.positionals.length > positionals.length)
    throw hostError("E_USAGE", "位置引数の数が不正です。", `${command} の位置引数: ${positionals.join(", ") || "なし"}`);
  const input: Record<string, unknown> = Object.fromEntries(parsed.positionals.map((value, index) => [positionals[index], value]));
  for (const [name, field] of fieldNames) {
    const value = parsed.values[name];
    if (value === undefined) continue;
    const type = (properties[field] as JsonObject).type;
    if (type === "number" || type === "integer") {
      if (typeof value !== "string" || value.trim() === "" || !Number.isFinite(Number(value))) throw hostError("E_USAGE", "数値の引数が不正です。", `--${name} に有限の数値を指定してください。`);
      input[field] = Number(value);
    } else input[field] = value;
  }
  if (definition.id === "generate" && parsed.values.zip) input.format = "zip";
  if (definition.id === "generate" && input.out === "") throw hostError("E_USAGE", "出力先が空です。", "--out に出力先の親ディレクトリを指定してください。");
  for (const field of required) if (!(field in input)) throw hostError("E_USAGE", "必要な引数がありません。", `--${field.replaceAll("_", "-")} を指定してください。`);
  return { definition, command, input, human: humanPrefix || parsed.values.human === true, detach: parsed.values.detach === true };
}
