import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const allowed = new Set(["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "Zlib"]);
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const supports = (values, current) => !values?.length || (!values.includes(`!${current}`) &&
  (!values.some((value) => !value.startsWith("!")) || values.includes(current) || values.includes("any")));

export function supportsPlatform(entry, platform, arch, libc) {
  return supports(entry.os, platform) && supports(entry.cpu, arch) && (platform !== "linux" || supports(entry.libc, libc));
}

export function selectLicense(name, expression) {
  if (name === "jszip" && expression === "(MIT OR GPL-3.0-or-later)") return "MIT";
  if (expression === "(MIT AND Zlib)") return "MIT AND Zlib";
  if (!allowed.has(expression)) throw Error(`未許可のライセンスです: ${name}: ${expression ?? "未記載"}`);
  return expression;
}

export async function checkLicenses(root) {
  const lock = JSON.parse(await fs.readFile(path.join(root, "package-lock.json"), "utf8"));
  const libc = process.platform === "linux" ? (process.report.getReport().header.glibcVersionRuntime ? "glibc" : "musl") : undefined;
  const packages = [];
  for (const [relative, entry] of Object.entries(lock.packages).sort(([a], [b]) => compare(a, b))) {
    if (!relative.includes("node_modules/") || entry.link) continue;
    if (path.isAbsolute(relative) || relative.includes("\\") || relative.split("/").includes("..")) throw Error("lockfile のパスが不正です。");
    const name = relative.slice(relative.lastIndexOf("node_modules/") + "node_modules/".length);
    const selected = selectLicense(name, entry.license);
    if (!entry.version) throw Error(`版がありません: ${name}`);
    const directory = path.join(root, relative);
    let manifest;
    try { manifest = JSON.parse(await fs.readFile(path.join(directory, "package.json"), "utf8")); }
    catch (error) {
      if (error.code !== "ENOENT" || !entry.optional || supportsPlatform(entry, process.platform, process.arch, libc)) throw error;
    }
    const files = [];
    let evidence = "platform-optional-lockfile";
    if (manifest) {
      if (manifest.version !== entry.version || selectLicense(name, manifest.license) !== selected) throw Error(`導入済みの版・ライセンスが lockfile と異なります: ${name}`);
      for (const filename of (await fs.readdir(directory)).filter((value) => /^(?:licen[cs]e|copying)(?:[.-]|$)/i.test(value) || (name === "isarray" && /^readme\.md$/i.test(value))).sort(compare)) {
        const file = path.join(directory, filename);
        if (!(await fs.stat(file)).isFile()) continue;
        const bytes = await fs.readFile(file);
        if (!bytes.toString("utf8").trim()) throw Error(`LICENSE が空です: ${name}/${filename}`);
        if (name === "isarray" && !/Permission is hereby granted[\s\S]*THE SOFTWARE IS PROVIDED/.test(bytes.toString("utf8"))) throw Error("isarray README の MIT 本文がありません。");
        files.push({ path: `${relative}/${filename}`, sha256: createHash("sha256").update(bytes).digest("hex") });
      }
      // Platform binary packages ship metadata only; their parent ships the license text.
      if (!files.length && !/^@(?:esbuild|rollup)\//.test(name)) throw Error(`LICENSE 本文がありません: ${name}`);
      evidence = files.length ? "installed-license-files" : "platform-binary-metadata";
    }
    packages.push({ path: relative, name, version: entry.version, license: entry.license, selected,
      development: entry.dev === true, optional: entry.optional === true,
      installed: Boolean(manifest), evidence, files });
  }
  return { scope: "root-and-gui-runtime-and-development", allowed: [...allowed], packages };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const inventory = await checkLicenses(root);
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex >= 0) {
    if (!process.argv[outputIndex + 1]) throw Error("--output に保存先を指定してください。");
    const target = path.resolve(root, process.argv[outputIndex + 1]);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, JSON.stringify(inventory, null, 2) + "\n");
  } else process.stdout.write(JSON.stringify(inventory, null, 2) + "\n");
  process.stderr.write(JSON.stringify({ packages: inventory.packages.length,
    installed: inventory.packages.filter((entry) => entry.installed).length,
    licenses: Object.fromEntries([...new Set(inventory.packages.map((entry) => entry.selected))].sort(compare)
      .map((license) => [license, inventory.packages.filter((entry) => entry.selected === license).length])), verified: true }) + "\n");
}
