// Browser template loader (GU-02, AR-06). Vite reads job-template at build time;
// the exclusion rule is core includeTemplatePath, shared with the Node loader.
import { includeTemplatePath, type TemplateFiles } from "../../src/core/index.ts";
import fontAssets from "../../src/core/data/font-assets.json" with { type: "json" };

const entries = import.meta.glob("../../job-template/**/*", {
  eager: true, query: "?raw", import: "default",
}) as Record<string, string>;
const fontUrls = import.meta.glob("../../job-assets/fonts/*.ttf", {
  eager: true, query: "?url", import: "default",
}) as Record<string, string>;

const prefix = "../../job-template/";
export const templates: Record<string, string> = Object.fromEntries(
  Object.entries(entries)
    .map(([path, value]) => [path.slice(prefix.length), value] as const)
    .filter(([path]) => includeTemplatePath(path)),
);

const hex = (data: ArrayBuffer) =>
  Array.from(new Uint8Array(data), (byte) => byte.toString(16).padStart(2, "0")).join("");

export async function loadTemplates(): Promise<TemplateFiles> {
  const output: TemplateFiles = { ...templates };
  for (const asset of fontAssets) {
    const url = fontUrls[`../../job-assets/fonts/${asset.name}`];
    if (!url) throw new Error(`標準フォントがビルドに含まれていません: ${asset.name}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`標準フォントを取得できません: ${asset.name}`);
    const data = new Uint8Array(await response.arrayBuffer());
    if (hex(await crypto.subtle.digest("SHA-256", data)) !== asset.sha256)
      throw new Error(`標準フォントの整合性を確認できません: ${asset.name}`);
    output[`assets/fonts/${asset.name}`] = data;
  }
  return output;
}
