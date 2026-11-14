import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { HostContext } from "./types.ts";

// Display copies only: persisted reports and logs retain their original bytes.
export async function displayHostOutput<T>(context: HostContext, value: T, job?: string): Promise<T> {
  if (!context.restrictToRoot) return value;
  const replacements: { pattern: RegExp; replacement: string }[] = [];
  const roots: [string, string][] = [
    ...(job ? [[job, "."] as [string, string]] : []), [context.root, "."],
    [fileURLToPath(new URL("../../", import.meta.url)), "."], [os.homedir(), "~"],
  ];
  const forms = new Map<string, string>();
  for (const [root, replacement] of roots) {
    let real = root;
    try { real = await fs.realpath(root); } catch { /* The display path may have been removed. */ }
    for (const form of new Set([root, real])) {
      for (const text of [form, form.replaceAll("\\", "/"), path.toNamespacedPath(form),
        form.replaceAll("\\", "\\\\"), pathToFileURL(form).href]) {
        const prefix = text.replace(/[\\/]$/, "");
        const key = process.platform === "win32" ? prefix.toLowerCase() : prefix;
        if (!forms.has(key)) forms.set(key, replacement);
      }
    }
  }
  for (const [prefix, replacement] of [...forms].sort(([a], [b]) => b.length - a.length))
    replacements.push({ pattern: new RegExp(prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), process.platform === "win32" ? "gi" : "g"), replacement });
  function copy(item: unknown): unknown {
    if (typeof item === "string") {
      for (const { pattern, replacement } of replacements) item = (item as string).replace(pattern, () => replacement);
      return item;
    }
    if (!item || typeof item !== "object" || item instanceof Uint8Array) return item;
    if (Array.isArray(item)) return item.map(copy);
    return Object.fromEntries(Object.entries(item).map(([key, nested]) => [key, copy(nested)]));
  }
  return copy(value) as T;
}
