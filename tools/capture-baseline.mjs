import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { npmCommand } from "./npm-command.mjs";

// Manual development tool. Never import or execute this tool from tests or CI.
const { values } = parseArgs({ options: { source: { type: "string" }, out: { type: "string" } } });
if (!values.source) throw new Error("--source に依存導入済みの原典の複製を指定してください。");
const source = path.resolve(values.source);
if (!source.split(path.sep).includes("_smm_scratch")) throw new Error("採取元は _smm_scratch 配下の複製に限定します。");
const output = values.out ? path.resolve(values.out) : fileURLToPath(new URL("../tests/fixtures/baseline-biimmotion-262c798/", import.meta.url));
function run(file, args, cwd = source) {
  const result = spawnSync(file, args, { cwd, encoding: "utf8", shell: false, maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`${path.basename(file)} が失敗しました。\n${result.stderr}\n${result.stdout}`);
  return result.stdout;
}
const commit = run("git", ["rev-parse", "HEAD"]).trim();
if (commit !== "262c79876a9c4635377114902d58ce783e7578b1") throw new Error("採取元のコミットが異なります。");
if (run("git", ["status", "--porcelain"]).trim()) throw new Error("採取元の複製に変更があります。");
await fs.mkdir(output, { recursive: true });
const write = async (name, data) => {
  const file = path.join(output, name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
};
const json = (name, value) => write(name, JSON.stringify(value, null, 2) + "\n");
const hash = (data) => createHash("sha256").update(data).digest("hex");
const normalize = (name) => name.split(path.sep).join("/");
async function walk(directory) {
  const files = [];
  for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file));
    else files.push(file);
  }
  return files;
}
const requireSource = createRequire(path.join(source, "package.json"));
const JSZip = requireSource("jszip");
const core = await import(pathToFileURL(path.join(source, "src/job.ts")).href);
const fontAssets = JSON.parse(await fs.readFile(path.join(source, "src/font-assets.json"), "utf8"));
const templates = {};
const manifest = [];
for (const directory of ["job-template", "public/job-assets/fonts"]) {
  for (const file of await walk(path.join(source, directory))) {
    const relative = normalize(path.relative(path.join(source, directory), file));
    const font = directory !== "job-template";
    const excluded = font ? !fontAssets.some((item) => item.name === relative) : relative.split("/").some((part) => part.startsWith(".") || part === "node_modules");
    const data = await fs.readFile(file);
    const zipPath = font ? `assets/fonts/${relative}` : relative;
    manifest.push({ path: `${directory}/${relative}`, zip_path: zipPath, sha256: hash(data), bytes: data.length, excluded, exclusion_rule: excluded ? (font ? "not-in-font-assets" : "vite-dot-entry-or-node_modules") : null });
    if (!excluded) templates[zipPath] = font ? new Uint8Array(data) : data.toString("utf8");
    if (font && !excluded && fontAssets.find((item) => item.name === relative).sha256 !== hash(data)) throw new Error("フォントのハッシュが異なります。");
  }
}
await json("template-manifest.json", { commit, rules: { template: "Vite glob と tools/generate-job.ts の dot entries・node_modules 除外", fonts: "src/font-assets.json" }, files: manifest });

// Preserve ZIP dates without modifying any upstream source. File contents do not
// use clocks or randomness; the archive's DOS timestamps are otherwise variable.
const RealDate = globalThis.Date;
const fixedTime = "2026-11-14T00:00:00.000Z";
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [fixedTime])); }
  static now() { return RealDate.parse(fixedTime); }
};

// A valid 30-second mono PCM WAV with an 8-kHz rate, compressed well in git/ZIP.
const wav = Buffer.alloc(44 + 30 * 8000 * 2);
wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(wav.length - 44, 40);
await write("assets/song.wav", wav);
await write("assets/reference.txt", "合成の参考資料。光は水滴で屈折・反射する。\n");
// Minimal valid GLB 2.0 container with a JSON-only scene.
const glbJson = Buffer.from(JSON.stringify({ asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [] }] }).padEnd(80, " "));
const glb = Buffer.alloc(20 + glbJson.length);
glb.write("glTF"); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8);
glb.writeUInt32LE(glbJson.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); glbJson.copy(glb, 20);
await write("assets/character.glb", glb);

const originalForm = {
  ...core.defaults, title: "虹のしくみ", description: "光の分散を説明する", audience: "中高生",
  takeaway: "太陽の反対側に虹が見える理由を言える", priorKnowledge: "光は直進する。雨粒の色が虹になるという誤解。",
  outline: "## 問い\r\n\r\n虹はなぜ見える？\r\n雨粒の中で光が曲がる。\n42度の方向を確かめる。\n",
  differentiation: "MV用のメモ", explainerDifferentiation: "前作のチャート中心から、光の経路を育てる図へ",
};
const mvForm = (settings) => core.switchVideoMode({ ...originalForm, ...settings, musicDurationSec: 30, musicLyrics: "[Verse]\r\n一行目\n二行目\n" }, "mv");
const attachments = { sources: ["../../assets/reference.txt"], character: "../../assets/character.glb", bgm: "../../assets/song.wav" };
const cases = [
  ["mv-landscape", mvForm({}), { music: "../../assets/song.wav" }],
  ["mv-portrait-options", mvForm({ width: 1080, height: 1920, design: "歌詞を巨大文字で見せる", instructions: "音に同期", videoGeneration: true }), { music: "../../assets/song.wav" }],
  ["explainer-biim-solo", originalForm, attachments],
  ["explainer-biim-duo", { ...originalForm, characterMode: "duo" }, { ...attachments, secondCharacter: "../../assets/character.glb" }],
  ...["anime", "motion", "mixed"].map((style) => [`explainer-${style}`, core.switchStyleMode(originalForm, style), attachments]),
  ["explainer-fullscreen", { ...originalForm, fullScreen: true }, attachments],
  ["explainer-portrait", { ...originalForm, width: 1080, height: 1920 }, attachments],
  ["minimal", { title: "最小入力", description: "最小の解説入力", audience: "一般" }, {}],
];
const mime = { ".txt": "text/plain", ".wav": "audio/wav", ".glb": "model/gltf-binary" };
async function resolveAssets(request, directory) {
  const load = async (relative) => {
    const file = path.resolve(directory, relative);
    const data = new Uint8Array(await fs.readFile(file));
    return { name: path.basename(file), data, size: data.length, type: mime[path.extname(file)] ?? "application/octet-stream" };
  };
  const assets = { sources: [] };
  for (const relative of request.sources ?? []) assets.sources.push(await load(relative));
  for (const key of ["character", "secondCharacter", "bgm", "music"]) if (request[key]) assets[key] = await load(request[key]);
  return assets;
}
for (const [name, partial, paths] of cases) {
  const prefix = `golden/${name}`;
  await json(`${prefix}/request.json`, { form: partial, assets: paths });
  const form = { ...core.defaults, ...partial, secondCharacter: { ...core.defaults.secondCharacter, ...partial.secondCharacter } };
  const assets = await resolveAssets(paths, path.join(output, prefix));
  const errors = core.validateForm(form, assets);
  if (errors.length) throw new Error(`${name}: ${errors.join("\n")}`);
  const job = await core.generateJob(form, assets, templates);
  const zip = await JSZip.loadAsync(job.data);
  const root = core.safeName(form.title.trim());
  const entries = [];
  for (const [name, entry] of Object.entries(zip.files).sort(([a], [b]) => a.localeCompare(b, "en"))) {
    const data = entry.dir ? Buffer.alloc(0) : await entry.async("nodebuffer");
    entries.push({ path: name, directory: entry.dir, sha256: hash(data), bytes: data.length });
    const relative = name.slice(root.length + 1);
    // Store every added or overwritten body, including the generated frame SVG.
    const template = templates[relative];
    if (!entry.dir && (template === undefined || !data.equals(Buffer.from(template)))) await write(`${prefix}/${relative}`, data);
  }
  await write(`${prefix}/agent-prompt.txt`, core.agentPromptFor(form.videoMode, form.styleMode));
  await json(`${prefix}/zip-manifest.json`, { filename: job.filename, root, entries });
  console.log(`採取: ${name}（${entries.filter((item) => !item.directory).length} ファイル）`);
}
globalThis.Date = RealDate;

const invalid = {
  videoMode: "invalid", styleMode: "invalid", title: "", description: "", audience: "", durationSec: 0,
  width: 241, height: 1080, fps: 29, voiceEngine: "invalid", characterMode: "invalid", fullScreen: "invalid",
  imageGeneration: "invalid", videoGeneration: "invalid", characterPosition: "invalid", subtitleColor: "invalid",
  urls: "ftp://invalid.example", tempo: "invalid", energy: "invalid", motionAmount: "invalid", biimUsage: "invalid", characterUsage: "invalid", evidencePolicy: "invalid",
};
const badAttachment = { name: "invalid.bin", size: 0 };
const probes = [
  { id: "invalid-fields", form: invalid, assets: { sources: [] } },
  { id: "invalid-duo-voice", form: { characterMode: "duo", voiceEngine: "aivis", engineUrl: "invalid", styleId: -1, voiceSpeed: 0, characterPosition: "invalid", subtitleColor: "invalid", secondCharacter: { position: "invalid", subtitleColor: "invalid", styleId: -1, voiceSpeed: 0 } }, assets: { sources: [{ name: "large.txt", size: 500 * 1024 * 1024 + 1 }], character: badAttachment, secondCharacter: badAttachment, bgm: badAttachment } },
  { id: "mixed-portrait-fullscreen", form: { styleMode: "mixed", width: 1080, height: 1920, fullScreen: true }, assets: { sources: [] } },
  { id: "mv-missing", form: { videoMode: "mv", description: "" }, assets: { sources: [] } },
  { id: "mv-invalid", form: { videoMode: "mv", musicDurationSec: null }, assets: { sources: [], music: badAttachment } },
];
for (const probe of probes) {
  const form = { ...core.defaults, ...probe.form, secondCharacter: { ...core.defaults.secondCharacter, ...probe.form.secondCharacter } };
  const load = (asset) => ({ ...asset, data: new Uint8Array(), type: "application/octet-stream" });
  const assets = { sources: probe.assets.sources.map(load) };
  for (const key of ["character", "secondCharacter", "bgm", "music"]) if (probe.assets[key]) assets[key] = load(probe.assets[key]);
  probe.messages = core.validateForm(form, assets);
}
await json("validate-form-messages.json", {
  note: "form は defaults と secondCharacter を深く合成する。添付はサイズ・名前の合成メタデータであり巨大ファイルは作らない。URL行番号は1を代表とする（行数に上限がなく具体的文言の集合は無限）。",
  messages: [...new Set(probes.flatMap((probe) => probe.messages))].sort(),
  parameterized_messages: [{ template: "参考URLの${line}行目を確認してください（HTTP / HTTPSのみ）。", parameter: "line", minimum: 1 }],
  inputs: probes,
});

const reporter = new URL("./baseline-reporter.mjs", import.meta.url).href;
const npm = npmCommand([`--node-options=--test-reporter=${reporter}`, "test"]);
const raw = run(npm.file, npm.args);
const events = raw.split(/\r?\n/).filter((line) => line.startsWith('{"event":')).map((line) => JSON.parse(line));
const outcomes = events.filter((event) => ["test:pass", "test:fail"].includes(event.event) && event.file);
const tests = outcomes.filter((event) => event.type !== "suite").map((event) => ({ file: normalize(path.relative(source, event.file)), suite: [], name: event.name, status: event.event === "test:pass" ? "pass" : "fail" }));
const summary = events.findLast((event) => event.event === "test:summary");
if (!tests.length || summary?.counts?.tests !== tests.length) throw new Error("原典テストの件数を採取できません。");
await json("test-inventory.json", { commit, command: "npm --node-options=--test-reporter=<採取レポーターURL> test", count: tests.length, passed: tests.filter((test) => test.status === "pass").length, failed: tests.filter((test) => test.status === "fail").length, tests });
console.log(`原典テスト: ${tests.length} 件、失敗 ${tests.filter((test) => test.status === "fail").length} 件`);

await json("allowed-diffs.json", {
  source_commit: commit, status: "M0初版。R1の置換対はM1で確定・増補しL2が確認する。",
  rules: [
    { id: "R1", scope: ["AGENTS.md", "README.md", "brief.md"], replacements: [{ from: "WebUI", to: "Shin-MotionMaker（GUI・CLI・MCP）" }], note: "原典で見つかる入口名の置換候補。MVのbrief・歌詞・依頼文への適用は禁止。" },
    { id: "R2", scope: ["project.json"], replace: { pointer: "/schema_version", from: "0.4", to: "0.5" }, add: { pointer: "/generator", keys: ["name", "version", "template_version"] } },
    { id: "R3", add_files: ["NOTICE"], append_only: ["README.md"], note: "CLI・MCP節を追加。ジョブ単体ではnpm runが正。" },
    { id: "R4", scope: ["runtime/scripts/validate.mjs"], add_outputs: ["reports/validate.json"], preserve: ["stdout", "exit_code", "validation-logic"], note: "追加コードはM1で逆変換可能なパッチとして確定する。" },
    { id: "R5", scope: ["brief.md"], mode: "explanation", replacements: [{ from: "Opusが記入する", to: "制作エージェントが記入する" }] },
  ],
});
const versionCommand = npmCommand(["--version"]);
const npmVersion = run(versionCommand.file, versionCommand.args).trim();
await write("PROVENANCE.md", `# 基線の採取記録\n\n- 採取元: BiimMotion（BiimMakerWebUI）、コミット \`${commit}\`。\n- 採取日: 2026-11-14（Asia/Tokyo）。Node ${process.version}、npm ${npmVersion}。\n- 原典の作業ツリーは読み取り専用。複製で依存導入・テスト・生成を実行した。\n\n## 採取コマンド\n\n\`\`\`text\ngit clone --no-hardlinks <原典> <原典の複製>\ngit -C <原典の複製> checkout --detach 262c798\nnpm ci（作業フォルダ: <原典の複製>）\nnode tools/capture-baseline.mjs --source <原典の複製>\n\`\`\`\n\n- 原典ソースは変更せず、src/job.tsを直接importしgenerateJob・agentPromptFor・validateFormを呼んだ。テンプレート読み込みは原典tools/generate-job.tsの除外・UTF-8復号・フォント検査を再現した。\n- 原典npm testをカスタムNodeレポーターで実行。${tests.length}件、全件pass。原典テストはトップレベルtestのみでsuiteは空配列。\n- 原典tests/explainer.test.ts L210付近はgit show 955fa5c:src/<file>で過去ソースを読み、MVフォーム・依頼文・brief・project・歌詞の一致を表明していた。浅いcheckoutで失敗する§8.1の原因である。今回だけ採取用複製の完全履歴で実行した。新repoのテストはgitを起動しない。\n- MV2ケースは原典L225付近のform・settingsをswitchVideoModeに渡す順序まで再現。元テストの3バイト疑似WAVは有効な30秒無音WAVへ置換したため音源サイズ・内容のハッシュのみ異なる。設定・歌詞は同じ。\n- 最小入力はformのtitle・description・audienceだけ。解説7ケースは同じ基礎フォームへ様式・人数・向き等を適用した。\n- 時刻は生成中だけDateを${fixedTime}に固定（ZIPエントリーの時刻）。コアソースは変更していない。乱数は生成関数の経路にない。ZIP本体・圧縮バイトは保存せず、全パス（ディレクトリ含む）と展開本文SHA-256を保存。\n- 原典生成物のCRLFを含む歌詞・構成メモはバイトのまま保存。新規開発ファイルはLF。テンプレートとの差分がある本文はgolden内にすべて保存した。\n- validateFormのURLエラーは行番号が任意なので文言集合は無限。全分岐の具体例とパラメーター付き文言を保存した。\n- 採取できなかった出力・固定できなかった生成内容: なし。実レンダー・音声合成・画像生成はM0の対象外。\n`);
