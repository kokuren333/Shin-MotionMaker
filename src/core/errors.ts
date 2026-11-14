import type { SmmError } from "./types.ts";

export function formError(messages: string[]): SmmError & Error {
  return Object.assign(new Error(messages.join("\n")), {
    code: "E_FORM_INVALID" as const,
    hint: "入力項目と添付ファイルを確認し、列挙された内容を修正してください。",
    details: messages,
  });
}

export function internalError(message: string): SmmError & Error {
  return Object.assign(new Error(message), {
    code: "E_INTERNAL" as const,
    hint: "同梱テンプレートとファイルの構成を確認してください。",
  });
}
