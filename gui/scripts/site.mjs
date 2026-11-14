// Build the static site (GU-01, GU-14, GU-15) without touching version control.
// The commit and build time are inputs; scripts/build.mjs resolves them for humans and CI.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const gui = fileURLToPath(new URL("../", import.meta.url));
const repository = path.resolve(gui, "..");

/** Read PACKAGE_VERSION and TEMPLATE_VERSION from the single version source of core. */
export async function coreVersions() {
  const source = await fs.readFile(path.join(repository, "src", "core", "data", "version.ts"), "utf8");
  const read = (name) => {
    const match = source.match(new RegExp(`export const ${name} = "([^"]+)"`));
    if (!match) throw new Error(`${name} が src/core/data/version.ts にありません。`);
    return match[1];
  };
  return { version: read("PACKAGE_VERSION"), template_version: read("TEMPLATE_VERSION") };
}

/**
 * @param {{ outDir?: string, commit: string, builtAt: string, quiet?: boolean }} options
 * @returns {Promise<{ outDir: string, stamp: object }>}
 */
export async function buildSite({ outDir = path.join(gui, "dist"), commit, builtAt, quiet = false }) {
  if (typeof commit !== "string" || !commit.trim()) throw new Error("commit を指定してください。");
  if (Number.isNaN(Date.parse(builtAt))) throw new Error("built_at は ISO 8601 の日時で指定してください。");
  const stamp = { ...(await coreVersions()), commit: commit.trim(), built_at: builtAt };
  await build({
    configFile: path.join(gui, "vite.config.mjs"),
    logLevel: quiet ? "warn" : "info",
    build: { outDir: path.resolve(outDir), emptyOutDir: true },
    define: { __SMM_BUILD__: JSON.stringify({ commit: stamp.commit, built_at: stamp.built_at }) },
  });
  await fs.writeFile(path.join(path.resolve(outDir), "version.json"), JSON.stringify(stamp, null, 2) + "\n");
  return { outDir: path.resolve(outDir), stamp };
}
