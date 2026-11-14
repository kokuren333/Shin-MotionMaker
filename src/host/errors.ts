import type { ErrorCode, JsonValue, SmmError } from "../core/index.ts";

export function hostError(code: ErrorCode, message: string, hint = "入力とジョブ内のファイルを確認してください。", details?: JsonValue): SmmError & Error {
  return Object.assign(new Error(message), { code, hint, ...(details === undefined ? {} : { details }) });
}
export function normalizeError(value: unknown): SmmError {
  if (value && typeof value === "object" && "code" in value && "hint" in value && "message" in value) {
    const error = value as SmmError;
    return { code: error.code, message: error.message, hint: error.hint, ...(error.details === undefined ? {} : { details: error.details }) };
  }
  const reason = value && typeof value === "object" && "code" in value ? String(value.code) : value instanceof Error ? value.name : "unknown";
  return { code: "E_INTERNAL", message: "処理中に予期しないエラーが発生しました。", hint: "run のログとジョブのファイルを確認してください。", details: { reason } };
}
export function errorExitCode(code: ErrorCode): 2 | 3 | 4 {
  if (["E_USAGE", "E_INPUT_INVALID", "E_FORM_INVALID", "E_PATH_DENIED", "E_OUTPUT_EXISTS"].includes(code)) return 2;
  if (["E_RUN_LOST", "E_TIMEOUT", "E_INTERNAL"].includes(code)) return 4;
  return 3;
}
export const isMissing = (error: unknown) => !!error && typeof error === "object" && "code" in error && error.code === "ENOENT";
