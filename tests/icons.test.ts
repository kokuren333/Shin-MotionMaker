// TS-09: every shipped icon is a 16x16 PNG, matches manifest.json, and has a complete origin record.
// PNG dimensions are read from the IHDR chunk directly (no image dependency).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const iconsDir = path.join(root, "gui", "public", "icons");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type IconFile = { path: string; scale: number; width: number; height: number; sha256: string };
type IconEntry = {
  name: string;
  origin: string;
  source: string;
  source_sha256: string;
  author: string;
  cybersprite: { version: string; commit: string };
  png: string;
  sha256: string;
  files: IconFile[];
  source_repo?: string;
  source_commit?: string;
  source_last_changed_commit?: string;
  modified?: boolean;
};
type Manifest = {
  format: string;
  palette: string;
  size_policy: { rule: string; exceptions: { path: string; icon: string; scale: number; reason: string }[] };
  icons: IconEntry[];
};

const manifest = JSON.parse(await fs.readFile(path.join(iconsDir, "manifest.json"), "utf8")) as Manifest;
const reuseFixture = JSON.parse(
  await fs.readFile(new URL("./fixtures/cybersprite-icons-a00433c.json", import.meta.url), "utf8"),
) as { source_commit: string; palette_sha256: string; project_json_sha256: Record<string, string> };

// Original icons required by GU-11 and the ten reused icons required by GU-10.
const REQUIRED_ORIGINAL = [
  "app", "mode-mv", "mode-explainer", "style-biim", "style-anime", "style-motion", "style-mixed",
  "gate", "advisory", "ghost-check", "job-zip", "cli", "mcp",
];
const REQUIRED_REUSE = ["info", "validate-ok", "warning", "error", "folder", "sources", "add", "remove", "settings", "agent"];

function repoFile(rel: string): string {
  assert.ok(!path.isAbsolute(rel) && !rel.includes("\\") && !rel.split("/").includes(".."), `repo-relative path: ${rel}`);
  return path.join(root, ...rel.split("/"));
}

function pngSize(bytes: Buffer): { width: number; height: number } {
  assert.ok(bytes.subarray(0, 8).equals(PNG_SIGNATURE), "PNG signature");
  assert.equal(bytes.readUInt32BE(8), 13, "IHDR length");
  assert.equal(bytes.toString("latin1", 12, 16), "IHDR", "first chunk is IHDR");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

test("every PNG directly under gui/public/icons is 16x16", async () => {
  const pngs = (await fs.readdir(iconsDir)).filter((n) => n.toLowerCase().endsWith(".png"));
  assert.ok(pngs.length > 0);
  for (const name of pngs) {
    assert.deepEqual(pngSize(await fs.readFile(path.join(iconsDir, name))), { width: 16, height: 16 }, name);
  }
});

test("manifest lists exactly the PNGs that exist, with matching SHA-256 and sizes", async () => {
  const listed = new Set<string>();
  for (const icon of manifest.icons) {
    assert.equal(icon.png, `gui/public/icons/${icon.name}.png`, icon.name);
    assert.equal(icon.files[0].path, icon.png, icon.name);
    assert.equal(icon.files[0].sha256, icon.sha256, icon.name);
    for (const file of icon.files) {
      assert.ok(!listed.has(file.path), `listed once: ${file.path}`);
      listed.add(file.path);
      const bytes = await fs.readFile(repoFile(file.path));
      assert.equal(sha256(bytes), file.sha256, `sha256 ${file.path}`);
      assert.ok(Number.isInteger(file.scale) && file.scale >= 1, file.path);
      const size = pngSize(bytes);
      assert.deepEqual(size, { width: 16 * file.scale, height: 16 * file.scale }, file.path);
      assert.deepEqual(size, { width: file.width, height: file.height }, file.path);
      if (file.path.startsWith("gui/public/icons/")) {
        assert.equal(file.scale, 1, `only 16x16 inside gui/public/icons: ${file.path}`);
      } else {
        assert.ok(
          manifest.size_policy.exceptions.some((e) => e.path === file.path && e.icon === icon.name && e.scale === file.scale),
          `non-16x16 file is declared in size_policy.exceptions: ${file.path}`,
        );
      }
    }
  }
  const onDisk = (await fs.readdir(iconsDir)).filter((n) => n.toLowerCase().endsWith(".png")).map((n) => `gui/public/icons/${n}`);
  for (const file of onDisk) assert.ok(listed.has(file), `PNG not in manifest: ${file}`);
  for (const exception of manifest.size_policy.exceptions) assert.ok(listed.has(exception.path), exception.path);
  assert.ok(manifest.size_policy.rule.length > 0);
});

test("every manifest entry has a complete origin record and its .csprite source", async () => {
  const names = manifest.icons.map((i) => i.name);
  assert.equal(new Set(names).size, names.length, "unique names");
  for (const icon of manifest.icons) {
    assert.match(icon.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, "kebab-case name");
    assert.ok(["cybersprite-reuse", "shin-motionmaker-original"].includes(icon.origin), `${icon.name}: origin`);
    assert.equal(icon.source, `assets/ui/icons/${icon.name}.csprite`, icon.name);
    for (const key of ["author", "source_sha256"] as const) assert.ok(icon[key]?.trim(), `${icon.name}: ${key}`);
    assert.ok(icon.cybersprite?.version?.trim() && /^[0-9a-f]{7,40}$/.test(icon.cybersprite.commit), `${icon.name}: cybersprite version/commit`);
    const project = await fs.readFile(path.join(repoFile(icon.source), "project.json"));
    assert.equal(sha256(project), icon.source_sha256, `${icon.name}: source sha256`);
    const parsed = JSON.parse(project.toString("utf8"));
    assert.equal(parsed.format, "cybersprite-project", icon.name);
    assert.deepEqual([parsed.canvas.width, parsed.canvas.height, parsed.frames.length], [16, 16, 1], icon.name);
    if (icon.origin === "cybersprite-reuse") {
      assert.equal(icon.source_repo, "kokuren333/CyberSprite", icon.name);
      assert.equal(icon.source_commit, reuseFixture.source_commit, icon.name);
      assert.match(icon.source_last_changed_commit ?? "", /^[0-9a-f]{7,40}$/, icon.name);
      assert.equal(icon.modified, false, icon.name);
      assert.equal(icon.source_sha256, reuseFixture.project_json_sha256[icon.name], `${icon.name}: unmodified CyberSprite original`);
    } else {
      assert.equal(icon.author, "Claude Opus 5.5", icon.name);
    }
  }
  for (const name of REQUIRED_ORIGINAL) {
    assert.equal(manifest.icons.find((i) => i.name === name)?.origin, "shin-motionmaker-original", name);
  }
  for (const name of REQUIRED_REUSE) {
    assert.equal(manifest.icons.find((i) => i.name === name)?.origin, "cybersprite-reuse", name);
  }
});

test("every .csprite source has a manifest entry and the palette is CyberSprite's", async () => {
  const sources = (await fs.readdir(path.join(root, "assets", "ui", "icons"))).filter((n) => n.endsWith(".csprite"));
  assert.deepEqual(sources.map((n) => n.slice(0, -".csprite".length)).sort(), manifest.icons.map((i) => i.name).sort());
  assert.equal(sha256(await fs.readFile(repoFile(manifest.palette))), reuseFixture.palette_sha256);
});
