// Files the e2e and screenshot runs open in the browser. Attachments reuse the baseline
// fixtures; inspection reports follow the shapes written by job-template/runtime/scripts
// (qc.mjs, validate.mjs R4, ghost-check.mjs) and the smm.run/1 ledger of CONTRACT §6.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";

const repository = fileURLToPath(new URL("../../", import.meta.url));
export const baselineAssets = path.join(repository, "tests", "fixtures", "baseline-biimmotion-262c798", "assets");
export const asset = (name) => path.join(baselineAssets, name);

export const qcPre = {
  schema_version: "1", kind: "biim-explainer-qc", stage: "pre", mode: "explanation", style_mode: "biim",
  verdict: "fail",
  gates: [
    { id: "PRE-1", title: "理解設計の記録", kind: "machine", scope: "all", status: "pass", detail: "Checks passed" },
    { id: "PRE-2", title: "方向性の記録", kind: "machine", scope: "all", status: "fail", detail: "Write three nonempty direction candidates" },
    { id: "PRE-3", title: "根拠台帳の構造", kind: "machine", scope: "all", status: "waived", detail: "Invalid accessed date" },
    { id: "PRE-6", title: "字幕容量", kind: "machine", scope: "all", status: "not-applicable", detail: "No applicable scenes or voice" },
  ],
  advisories: [
    { id: "ADV-REVIEW-1", scope: "all", detail: "review_mode missing; recorded as self" },
    { id: "ADV-PRE-4", scope: "scene", detail: "C1: unknown scenes S9", scene_ids: ["S9"] },
  ],
  review_mode: "self",
  waivers: [{ gate_id: "PRE-3", reason: "社内資料のため日付なし（オーナー記入）" }],
  inputs: { "plan/direction.md": "0".repeat(64) },
};
export const validateReport = {
  schema: "smm.validate/1", final: false, double_render: false, verdict: "pass",
  checks: [
    { name: "project.json", status: "ok", message: "構造を確認しました" },
    { name: "scenes", status: "ok", message: "場面ファイルを確認しました" },
  ],
  advisories: [{ id: "validate-skip-1", source: "validate", message: "SKIP: preview.mp4 がまだありません" }],
};
export const ghostPreview = {
  kind: "biim-ghost-check", video: "output/preview.mp4", fps: 30, frames: 900, duration: "30.00s",
  counts: { singleFrameEvents: 4, isolated: 1, clusteredRuns: 1, clusteredEvents: 3 },
  isolated: [{ frame: 214, time: "7.13s", tiles: 6 }],
  clustered: [{ startFrame: 480, endFrame: 486, startTime: "16.00s", endTime: "16.20s", events: 3, maxTiles: 12 }],
  worst: [{ frame: 482, time: "16.07s", tiles: 12 }, { frame: 214, time: "7.13s", tiles: 6 }],
  stills: [
    { frame: 214, time: "7.13s", kind: "isolated", files: ["ghost-stills/f00214-prev.png", "ghost-stills/f00214.png"] },
    { frame: 482, time: "16.07s", kind: "clustered", files: ["ghost-stills/f00482-prev.png", "ghost-stills/f00482.png"] },
  ],
};
export const runRecord = {
  schema: "smm.run/1", id: "r-20261114T101500Z-ab12cd34", kind: "qc", args: { stage: "pre" },
  status: "completed", exit_code: 1, pid: 1234, script_pid: 1240,
  started_at: "2026-11-14T10:15:00.000Z", heartbeat_at: "2026-11-14T10:15:04.000Z", ended_at: "2026-11-14T10:15:04.000Z",
  progress: { ratio: 1, text: "" }, artifacts: ["reports/qc-pre.json"], started_by: "cli",
  result: { verdict: "fail", report: qcPre, artifacts: ["reports/qc-pre.json"] }, script_exit_code: 1,
};

function png(width, height, rgb) {
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set(rgb, 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** Write report files under realistic names into a temporary folder. */
export function writeReportFixtures(directory) {
  const reports = path.join(directory, "reports");
  const stillsDir = path.join(reports, "ghost-stills");
  fs.mkdirSync(stillsDir, { recursive: true });
  const write = (name, value) => {
    const file = path.join(reports, name);
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
    return file;
  };
  const stills = [["f00214-prev.png", [40, 40, 40]], ["f00214.png", [200, 200, 200]],
    ["f00482-prev.png", [40, 40, 40]], ["f00482.png", [120, 120, 120]]].map(([name, rgb]) => {
    const file = path.join(stillsDir, name);
    fs.writeFileSync(file, png(160, 90, rgb));
    return file;
  });
  const runDir = path.join(directory, ".smm", "runs", runRecord.id);
  fs.mkdirSync(runDir, { recursive: true });
  const run = path.join(runDir, "run.json");
  fs.writeFileSync(run, JSON.stringify(runRecord, null, 2) + "\n");
  const broken = path.join(directory, "not-a-report.json");
  fs.writeFileSync(broken, JSON.stringify({ hello: "world" }));
  return {
    qcPre: write("qc-pre.json", qcPre), validate: write("validate.json", validateReport),
    ghostPreview: write("ghost-check-preview.json", ghostPreview), stills, run, broken,
  };
}

export const MV_INPUT = {
  title: "夜明けのプリズム",
  description: "眠れない夜から朝へ向かう気持ちを、光が少しずつ色を取り戻す映像で表現したい。見終わった後に静かな前向きさを残す。",
  audience: "インディーポップが好きな10〜20代のリスナー",
  musicMood: "静かなAメロから広がるサビ。青から橙へ移る色、ガラスと光のモチーフ。",
  musicLyrics: ["[Verse]", "眠れない窓の外で", "街の灯りがひとつ消えた", "", "[Chorus]",
    "プリズムを抜けて 朝が来る", "まだ名前のない色を 君に見せたい", "", "[Verse 2]", "冷めたコーヒーと古い歌",
    "繰り返すほど 遠くなるのはどうしてなんだろう 答えはまだ見えない"].join("\n"),
};
