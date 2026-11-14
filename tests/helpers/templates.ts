import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { includeTemplatePath, mimeTypeFor, type AssetPaths, type JobAssets, type TemplateFiles } from "../../src/core/index.ts";
import fontAssets from "../../src/core/data/font-assets.json" with { type: "json" };

export const repository = fileURLToPath(new URL("../../", import.meta.url));
export const baseline = path.join(repository, "tests/fixtures/baseline-biimmotion-262c798");
export const hash = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
export const readJson = async (name: string) => JSON.parse(await fs.readFile(path.join(baseline, name), "utf8"));

export async function fileMap(directory: string, prefix = ""): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {};
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    const relative = prefix + entry.name;
    if (entry.isDirectory()) Object.assign(files, await fileMap(filename, relative + "/"));
    else files[relative] = new Uint8Array(await fs.readFile(filename));
  }
  return files;
}

export async function loadTemplates(): Promise<TemplateFiles> {
  const result: TemplateFiles = {};
  for (const [name, bytes] of Object.entries(await fileMap(path.join(repository, "job-template"))))
    if (includeTemplatePath(name)) result[name] = new TextDecoder().decode(bytes);
  for (const font of fontAssets) {
    const bytes = new Uint8Array(await fs.readFile(path.join(repository, "job-assets/fonts", font.name)));
    if (hash(bytes) !== font.sha256) throw Error(font.name);
    result[`assets/fonts/${font.name}`] = bytes;
  }
  return result;
}

export async function loadAssets(paths: AssetPaths, directory: string): Promise<JobAssets> {
  const load = async (relative: string) => {
    const filename = path.resolve(directory, relative);
    const data = new Uint8Array(await fs.readFile(filename));
    const name = path.basename(filename);
    return { name, data, size: data.byteLength, type: mimeTypeFor(name) };
  };
  const assets: JobAssets = { sources: [] };
  for (const relative of paths.sources ?? []) assets.sources.push(await load(relative));
  for (const key of ["character", "secondCharacter", "bgm", "music"] as const)
    if (paths[key]) assets[key] = await load(paths[key]);
  return assets;
}
