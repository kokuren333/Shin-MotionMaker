import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const lock = JSON.parse(await fs.readFile(path.join(root, "package-lock.json"), "utf8"));
const visited = new Set();
const inventory = [];
function resolvePackage(from, name) {
  let directory = path.join(root, from);
  while (true) {
    const relative = path.relative(root, path.join(directory, "node_modules", name)).split(path.sep).join("/");
    if (Object.hasOwn(lock.packages, relative)) return relative;
    if (directory === root) return undefined;
    const parent = path.dirname(directory);
    if (parent === directory || path.relative(root, parent).startsWith("..")) return undefined;
    directory = parent;
  }
}
async function inspect(relative) {
  if (visited.has(relative)) return;
  visited.add(relative);
  const directory = path.join(root, relative);
  const manifest = JSON.parse(await fs.readFile(path.join(directory, "package.json"), "utf8"));
  const files = (await fs.readdir(directory)).filter((name) => /^(?:licen[cs]e|copying)(?:[.-]|$)/i.test(name)).sort();
  if (!files.length) throw Error(`License text missing: ${manifest.name}`);
  const licenseFiles = [];
  for (const name of files) {
    const bytes = await fs.readFile(path.join(directory, name));
    const text = bytes.toString("utf8");
    const license = manifest.license;
    if (!(["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause"].includes(license))) throw Error(`Unapproved license: ${manifest.name}`);
    const valid = license === "MIT" ? /Permission is hereby granted/i.test(text) && /THE SOFTWARE IS PROVIDED/i.test(text)
      : license === "ISC" ? /Permission to use, copy, modify/i.test(text) && /THE SOFTWARE IS PROVIDED/i.test(text)
      : /Redistribution and use/i.test(text) && /THIS SOFTWARE IS PROVIDED/i.test(text);
    if (!valid) throw Error(`License clauses require review: ${manifest.name}/${name}`);
    licenseFiles.push({ path: `${relative}/${name}`, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  inventory.push({ name: manifest.name, version: manifest.version, license: manifest.license, files: licenseFiles });
  const dependencies = { ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies };
  for (const name of Object.keys(dependencies)) {
    const resolved = resolvePackage(relative, name);
    if (resolved) await inspect(resolved);
    else if (!manifest.peerDependenciesMeta?.[name]?.optional && !manifest.optionalDependencies?.[name]) throw Error(`Dependency missing: ${name}`);
  }
}
await inspect("node_modules/@modelcontextprotocol/sdk");
inventory.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : left.version.localeCompare(right.version));
const output = { sdk: "@modelcontextprotocol/sdk@1.32.2", packages: inventory };
if (process.argv.includes("--write")) {
  await fs.mkdir(new URL("../docs/work/M3/", import.meta.url), { recursive: true });
  await fs.writeFile(new URL("../docs/work/M3/dependency-licenses.json", import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
} else {
  const saved = JSON.parse(await fs.readFile(new URL("../docs/work/M3/dependency-licenses.json", import.meta.url), "utf8"));
  if (JSON.stringify(output) !== JSON.stringify(saved)) throw Error("License inventory changed");
}
process.stdout.write(`${JSON.stringify({ packages: inventory.length, licenses: Object.fromEntries([...new Set(inventory.map((entry) => entry.license))].map((license) => [license, inventory.filter((entry) => entry.license === license).length])), verified: true })}\n`);
