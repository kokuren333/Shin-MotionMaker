import { internalError } from "./errors.ts";

export function assertJobPath(value: string): void {
  if (!value || value.includes("\\") || /^[A-Za-z]:/.test(value) || value.includes("\0") ||
      value.split("/").some((part) => part === ".." || part === "." || part === ""))
    throw internalError("不正なテンプレートパス");
}

/** Match the upstream Vite glob and Node loader exclusions. */
export function includeTemplatePath(value: string): boolean {
  return value.split("/").every((part) => !part.startsWith(".") && part !== "node_modules");
}
