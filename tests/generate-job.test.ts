import assert from "node:assert/strict";
import { before, test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import fontAssets from "../src/core/data/font-assets.json" with { type: "json" };
import { defaults, generateJob, buildJobFiles, safeName, validateRequest,
  type CharacterForm, type JobAssets, type MotionForm, type TemplateFiles } from "../src/core/index.ts";
import { repository, loadAssets, loadTemplates } from "./helpers/templates.ts";
import { loadTemplates as hostTemplates } from "../src/host/index.ts";
type PartialForm = Omit<Partial<MotionForm>, "secondCharacter"> & { secondCharacter?: Partial<CharacterForm> };
let webTemplates: TemplateFiles;
before(async () => { webTemplates = await loadTemplates(); });

const minimal = { title: "虹: CLI?", description: "光の分散を説明する", audience: "中高生" };
for (const mode of ["biim", "anime", "motion", "mixed", "mv"] as const) {
  test(`generate-job core matches ZIP file paths and bytes for ${mode}`, async (t) => {
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "biim-job-entry-"));
    t.after(() => fs.rm(temporary, { recursive: true, force: true }));
    const inputDirectory = path.join(temporary, "input");
    await fs.mkdir(path.join(inputDirectory, "sources"), { recursive: true });
    await fs.mkdir(path.join(inputDirectory, "more"));
    const pdf = new Uint8Array([37, 80, 68, 70, 0, 255, 13, 10]);
    const text = new TextEncoder().encode("資料の原文\r\n2行目\n");
    const unknown = new Uint8Array([255, 0, 128, 1]);
    const model = new Uint8Array([103, 108, 84, 70, 0, 1]);
    const music = new Uint8Array([82, 73, 70, 70, 255, 0]);
    const files = [
      { path: "sources/資料.PDF", name: "資料.PDF", data: pdf, type: "application/pdf" },
      { path: "more/資料.PDF", name: "資料.PDF", data: text, type: "application/pdf" },
      { path: "sources/notes.txt", name: "notes.txt", data: text, type: "text/plain" },
      { path: "sources/raw.unknown", name: "raw.unknown", data: unknown, type: "application/octet-stream" },
    ];
    for (const file of files) await fs.writeFile(path.join(inputDirectory, file.path), file.data);
    await fs.writeFile(path.join(inputDirectory, "first.glb"), model);
    await fs.writeFile(path.join(inputDirectory, "second.glb"), unknown);
    await fs.writeFile(path.join(inputDirectory, "audio.WAV"), music);
    const partial: PartialForm = {
      ...minimal, title: `prefix/虹: CLI? ${mode} `,
      videoMode: mode === "mv" ? "mv" : "explanation",
      ...(mode === "mv" ? { musicDurationSec: 6.25, musicLyrics: "夜の街へ\n\n[サビ]\n光の向こうへ" }
        : { styleMode: mode, characterMode: "duo", secondCharacter: { name: "聞き手" },
          outline: "# 導入\n問いを提示する。\r\n# 結論\n理解を確かめる。" }),
    };
    const form: MotionForm = {
      ...defaults, ...partial,
      secondCharacter: { ...defaults.secondCharacter, ...partial.secondCharacter },
    };
    const assetPaths = {
      sources: files.map((file, i) => i === 2 ? path.join(inputDirectory, file.path) : file.path),
      character: mode === "mv" ? null : "first.glb",
      secondCharacter: mode === "mv" ? null : "second.glb",
      bgm: mode === "mv" ? null : "audio.WAV",
      music: mode === "mv" ? "audio.WAV" : null,
    };
    const assets: JobAssets = {
      sources: files.map(({ name, data, type }) => ({ name, data, type, size: data.byteLength })),
      ...(mode === "mv" ? { music: { name: "audio.WAV", data: music, size: music.byteLength, type: "audio/wav" } }
        : { character: { name: "first.glb", data: model, size: model.byteLength, type: "model/gltf-binary" },
          secondCharacter: { name: "second.glb", data: unknown, size: unknown.byteLength, type: "model/gltf-binary" },
          bgm: { name: "audio.WAV", data: music, size: music.byteLength, type: "audio/wav" } }),
    };
    const loadedAssets = await loadAssets(assetPaths, inputDirectory);
    assert.deepEqual(loadedAssets, assets);
    const checked = validateRequest({ form: partial, assets: assetPaths }, { phase: "complete", assets: loadedAssets });
    assert.ok(checked.ok);
    assert.deepEqual(checked.value.form, form);
    const job = await buildJobFiles(checked.value.form, loadedAssets, webTemplates);
    const actual = Object.fromEntries(Object.entries(job.files).map(([name, data]) => [job.rootName + "/" + name, data]));
    const webJob = await generateJob(form, assets, webTemplates);
    const webZip = await JSZip.loadAsync(webJob.data);
    const expectedFiles = Object.entries(webZip.files).filter(([, entry]) => !entry.dir);
    assert.deepEqual(Object.keys(actual).sort(), expectedFiles.map(([name]) => name).sort());
    for (const [name, entry] of expectedFiles)
      assert.deepEqual(actual[name], await entry.async("uint8array"), `bytes differ: ${name}`);
    const prefix = safeName(form.title.trim()) + "/";
    assert.ok(Object.keys(actual).every((name) => name.startsWith(prefix)));
    for (const font of fontAssets)
      assert.deepEqual(actual[prefix + "assets/fonts/" + font.name],
        new Uint8Array(await fs.readFile(path.join(repository, "job-assets/fonts", font.name))));

  });
}

test("generate-job core accepts a minimal form and omitted assets using defaults", async () => {
  const checked = validateRequest({ form: minimal }, { phase: "complete", assets: { sources: [] } });
  assert.ok(checked.ok);
  assert.deepEqual(checked.value.form, { ...defaults, ...minimal });
  assert.deepEqual(checked.value.assets, {});
  const built = await buildJobFiles(checked.value.form, { sources: [] }, webTemplates);
  const zip = await JSZip.loadAsync((await generateJob({ ...defaults, ...minimal }, { sources: [] }, webTemplates)).data);
  const expected = Object.entries(zip.files).filter(([, entry]) => !entry.dir);
  assert.deepEqual(Object.keys(built.files).sort(), expected.map(([name]) => name.slice(built.rootName.length + 1)).sort());
  for (const [name, entry] of expected) assert.deepEqual(built.files[name.slice(built.rootName.length + 1)], await entry.async("uint8array"), name);
});

test("generate-job core rejects unknown keys, invalid types and validation errors", () => {
  const cases: [unknown, string[] | RegExp][] = [
    [null, [""]], [[], [""]], [{}, ["/form"]],
    [{ form: { ...minimal, style_mode: "anime" } }, ["/form/style_mode"]],
    [{ form: { ...minimal, secondCharacter: { style_id: 123 } } }, ["/form/secondCharacter/style_id"]],
    [JSON.parse('{"form":{"__proto__":{}}}'), ["/form/__proto__"]],
    [{ form: { ...minimal, title: 42, secondCharacter: null } }, ["/form/title", "/form/secondCharacter"]],
    [{ form: { ...minimal, musicDurationSec: "30" } }, ["/form/musicDurationSec"]],
    [{ form: { ...minimal, styleMode: "mixed", fullScreen: true } }, /様式「混在」/],
    [{ form: {} }, /動画タイトル[\s\S]*何を説明する動画[\s\S]*対象視聴者/],
    [{ form: { ...minimal, videoMode: "mv" } }, /完成音源をアップロード/],
    [{ form: minimal, assets: { sources: [null] } }, ["/assets/sources"]],
    [{ form: minimal, assets: { music: false } }, ["/assets/music"]],
    [{ form: minimal, assets: { source: [] } }, ["/assets/source"]],
    [{ form: minimal, extra: {} }, ["/extra"]],
  ];
  for (const [input, expected] of cases) {
    const result = validateRequest(input, { phase: "complete", assets: { sources: [] } });
    assert.equal(result.ok, false, JSON.stringify(input));
    if (result.ok) continue;
    assert.equal(result.error.code, Array.isArray(expected) ? "E_INPUT_INVALID" : "E_FORM_INVALID");
    assert.ok(result.error.message.length && result.error.hint.length);
    assert.ok(Array.isArray(result.error.details) && result.error.details.length);
    if (Array.isArray(expected)) {
      const pointers = result.error.details.map((detail) => {
        assert.ok(detail !== null && typeof detail === "object" && !Array.isArray(detail));
        return detail.pointer;
      });
      assert.deepEqual(pointers.sort(), [...expected].sort(), JSON.stringify(input));
    } else {
      assert.ok(result.error.details.every((detail) => typeof detail === "string"));
      assert.match(result.error.details.join("\n"), expected);
    }
  }
});

test("M2a: generate-job compares independent host template loading with the browser template paths and bytes", async () => {
  const actual = await hostTemplates();
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(webTemplates).sort());
  for (const [name, body] of Object.entries(webTemplates)) assert.deepEqual(actual[name], body, name);
});

test.todo("M2b: generate-job CLI matches the WebUI ZIP file paths and bytes for biim; BOM, cwd, exclusive rerun");
test.todo("M2b: generate-job CLI matches the WebUI ZIP file paths and bytes for anime; cwd, exclusive rerun");
test.todo("M2b: generate-job CLI matches the WebUI ZIP file paths and bytes for motion; cwd, exclusive rerun");
test.todo("M2b: generate-job CLI matches the WebUI ZIP file paths and bytes for mixed; cwd, exclusive rerun");
test.todo("M2b: generate-job CLI matches the WebUI ZIP file paths and bytes for mv; cwd, exclusive rerun");
test.todo("M2b: generate-job accepts a minimal form and omitted assets using defaults; CLI launch and output");
test.todo("M2b: generate-job rejects invalid JSON, unknown keys, invalid types and validation errors before writing; missing attachment, exit code and no output");
test.todo("M2b: generate-job rejects existing empty directories and files without changing siblings");
test.todo("M2b: generate-job reports usage and exits 1 for missing, duplicate or unsupported arguments; use contract exit codes");
