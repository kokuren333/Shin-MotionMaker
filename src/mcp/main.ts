import { parseArgs } from "node:util";
import { hostError, normalizeError, errorExitCode } from "../host/index.ts";
import { serveMcp } from "./server.ts";

try {
  const { values } = parseArgs({ options: {
    root: { type: "string" }, "read-only": { type: "boolean" }, "enable-generation": { type: "boolean" },
    "allow-dir": { type: "string", multiple: true }, "allow-engine-host": { type: "string", multiple: true },
  }, strict: true, allowPositionals: false });
  if (!values.root) throw hostError("E_USAGE", "root を指定してください。", "--root にジョブを置くフォルダを指定してください。");
  await serveMcp({ root: values.root, readOnly: values["read-only"], enableGeneration: values["enable-generation"],
    allowDirs: values["allow-dir"], allowEngineHosts: values["allow-engine-host"] });
} catch (error) {
  const parsed = error && typeof error === "object" && "code" in error && String(error.code).startsWith("ERR_PARSE_ARGS")
    ? hostError("E_USAGE", "起動オプションが不正です。", "root と公開・許可オプションを確認してください。") : error;
  const normalized = normalizeError(parsed);
  process.stderr.write(`${JSON.stringify(normalized)}\n`);
  process.exitCode = errorExitCode(normalized.code);
}
