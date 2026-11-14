// Token parsing for the theme tests: declaration blocks, var() resolution, WCAG contrast.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const gui = fileURLToPath(new URL("../", import.meta.url));
export const repository = path.resolve(gui, "..");
export const read = (...parts: string[]) => fs.readFileSync(path.join(...parts), "utf8");

export type Block = Map<string, string>;
/** Declarations of the first rule whose selector (including any leading marker) matches exactly. */
export function block(css: string, selector: string): Block {
  const start = css.indexOf(`${selector} {`);
  if (start < 0 || (start > 0 && css[start - 1] !== "\n")) throw new Error(`rule not found: ${selector}`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const result: Block = new Map();
  for (const line of body.split("\n")) {
    const declaration = line.trim().match(/^(--[\w-]+)\s*:\s*(.+?);$/);
    if (declaration) result.set(declaration[1], declaration[2].trim());
  }
  return result;
}

export function themes(css: string): { normal: Block; high: Block } {
  const normal = block(css, ":root");
  const high = new Map([...normal, ...block(css, ':root[data-contrast="high"]')]);
  return { normal, high };
}

export function resolve(theme: Block, value: string, depth = 0): string {
  const reference = value.match(/^var\((--[\w-]+)\)$/);
  if (!reference) return value;
  if (depth > 10 || !theme.has(reference[1])) throw new Error(`unresolved ${value}`);
  return resolve(theme, theme.get(reference[1])!, depth + 1);
}

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
export function luminance(hex: string): number {
  const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) throw new Error(`not #RRGGBB: ${hex}`);
  const [r, g, b] = match.slice(1).map((part) => channel(parseInt(part, 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Every file under a directory (posix-relative), skipping build output and binaries. */
export function walk(directory: string, prefix = ""): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", "public"].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(full, `${prefix}${entry.name}/`));
    else files.push(`${prefix}${entry.name}`);
  }
  return files;
}
