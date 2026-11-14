// Video encoder selection for the renders that encode a video: run.mjs
// preview and build, and the second render of ghost-check.mjs
// --double-render. The Remotion arguments of every run.mjs mode live here
// so that the GPU and CPU variants are assembled in one place.
//
// Remotion's --hardware-acceleration if-possible picks h264_nvenc on
// Windows and Linux whenever the bundled ffmpeg was built with it, which is
// always the case, so machines without a usable NVIDIA GPU fail mid-render.
// Before rendering, this module therefore encodes one real frame with
// h264_nvenc using the same ffmpeg Remotion renders with:
//
//   success          -> GPU: --hardware-acceleration if-possible plus an
//                       explicit --video-bitrate (NVENC ignores CRF and
//                       defaults to ~2 Mbps; 16M for final, matching measured
//                       libx264 CRF18 finals of 8-14 Mbps at 1080p30, and 8M
//                       for the half-scale preview)
//   anything else    -> CPU: --hardware-acceleration disable and no bitrate,
//                       i.e. Remotion's default libx264 at CRF 18
//
// MOTION_JOB_ENCODER=auto (default) | cpu | gpu overrides the choice. The
// chosen path is printed as one "[encoder] ..." line on stderr before the
// render starts. A failed render is never retried with the other encoder:
// the cause (scene code, assets, encoder) cannot be told apart here, and a
// retry would bury the real error and render twice. The encoder never
// affects validate, qc or ghost-check verdicts.
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { deflateSync } from "node:zlib";

const require = createRequire(import.meta.url);

export const ENCODER_ENV = "MOTION_JOB_ENCODER";
export const ENCODER_SETTINGS = ["auto", "cpu", "gpu"];
export const PROBE_TIMEOUT_MS = 20000;
/** run.mjs modes, in the order of its usage message. */
export const RUN_MODES = ["studio", "preview", "still", "build"];
/** Renders that encode a video and therefore select an encoder. */
export const ENCODED_RENDERS = ["preview", "build", "double-render"];

const VIDEO_FLAGS = ["--codec=h264", "--audio-codec=aac", "--pixel-format=yuv420p"];
const GPU_BITRATE = { preview: "8M", build: "16M", "double-render": "16M" };

/**
 * Remotion CLI arguments for a run.mjs mode or the ghost-check second
 * render. `encoder` is the result of selectEncoder() for encoded renders
 * and is ignored for studio and still.
 */
export function remotionArgs(mode, encoder, output) {
  if (mode === "studio") return ["studio", "src/index.ts"];
  if (mode === "still")
    return ["still", "src/index.ts", "MainVideo", "../output/preview.png"];
  if (!ENCODED_RENDERS.includes(mode)) throw new Error("Unknown render mode: " + mode);
  if (encoder?.route !== "gpu" && encoder?.route !== "cpu")
    throw new Error("An encoder selection is required for " + mode);
  const target =
    mode === "preview"
      ? ["../output/preview.mp4", "--scale=0.5"]
      : [mode === "build" ? "../output/final.mp4" : output];
  if (typeof target[0] !== "string" || !target[0])
    throw new Error("An output path is required for " + mode);
  const acceleration =
    encoder.route === "gpu"
      ? ["--hardware-acceleration", "if-possible", "--video-bitrate", GPU_BITRATE[mode]]
      : ["--hardware-acceleration", "disable"];
  return ["render", "src/index.ts", "MainVideo", ...target, ...VIDEO_FLAGS, ...acceleration];
}

/** Read MOTION_JOB_ENCODER. Unset and empty mean auto; other values throw. */
export function readEncoderSetting(env = process.env) {
  const raw = env[ENCODER_ENV];
  if (raw === undefined || raw === "") return { setting: "auto", raw: raw ?? null };
  if (ENCODER_SETTINGS.includes(raw)) return { setting: raw, raw };
  throw new Error(
    `[encoder] ${ENCODER_ENV} must be auto, cpu or gpu (got ${JSON.stringify(raw)}). No render was started.`,
  );
}

/**
 * Choose the encoder. `probe` defaults to a real h264_nvenc test encode and
 * is only called for auto on Windows and Linux.
 */
export function selectEncoder({
  env = process.env,
  platform = process.platform,
  probe = probeNvenc,
} = {}) {
  const { setting, raw } = readEncoderSetting(env);
  const gpuEncoder = platform === "darwin" ? "h264_videotoolbox" : "h264_nvenc";
  const gpu = (reason) => ({ route: "gpu", encoder: gpuEncoder, setting, raw, reason });
  const cpu = (reason) => ({ route: "cpu", encoder: "libx264", setting, raw, reason });
  if (setting === "cpu") return cpu("probe skipped (set explicitly)");
  if (setting === "gpu") return gpu("probe skipped (set explicitly)");
  if (platform === "darwin") return gpu("probe skipped (macOS)");
  const result = probe();
  return result.ok
    ? gpu(`h264_nvenc test encode succeeded (${result.ms} ms)`)
    : cpu(`h264_nvenc test encode failed: ${result.detail} (${result.ms} ms)`);
}

/** The single stderr line that records the chosen encoder. */
export function encoderLine(selection) {
  const value = selection.raw === null ? "auto (unset)" : JSON.stringify(selection.raw);
  return `[encoder] route=${selection.route} encoder=${selection.encoder} ${ENCODER_ENV}=${value} reason: ${selection.reason}`;
}

/** After a render exits: point at the CPU override when the GPU path failed. */
export function noteRenderExit(selection, code) {
  if (selection?.route === "gpu" && code !== 0)
    console.error(
      `[encoder] The render failed with the GPU encoder (${selection.encoder}). Set ${ENCODER_ENV}=cpu to encode on the CPU instead.`,
    );
}

/** Remotion's compositor package for this platform (where its ffmpeg lives). */
export function compositorPackage(platform = process.platform, arch = process.arch) {
  if (platform === "win32") return arch === "x64" ? "@remotion/compositor-win32-x64-msvc" : null;
  if (platform === "darwin") return `@remotion/compositor-darwin-${arch}`;
  if (platform !== "linux" || !["x64", "arm64"].includes(arch)) return null;
  const header = process.report?.getReport?.()?.header;
  const musl = header ? !header.glibcVersionRuntime : false;
  return `@remotion/compositor-linux-${arch}-${musl ? "musl" : "gnu"}`;
}

/**
 * Path of the ffmpeg binary Remotion encodes with, resolved the way
 * @remotion/renderer does: the compositor package's exported `dir`. Not the
 * PATH ffmpeg, which can be a different build.
 */
export function bundledFfmpeg() {
  try {
    const name = compositorPackage();
    if (!name) return null;
    const cli = require.resolve("@remotion/cli/package.json");
    const renderer = createRequire(cli).resolve("@remotion/renderer/package.json");
    const { dir } = createRequire(renderer)(name);
    if (typeof dir !== "string") return null;
    return path.join(dir, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  } catch {
    return null;
  }
}

/**
 * Encode one 256x256 frame with h264_nvenc and discard the output. Returns
 * { ok, detail, ms }. Never throws; every failure means "not usable".
 */
export function probeNvenc({
  ffmpeg = bundledFfmpeg(),
  spawn = spawnSync,
  now = Date.now,
} = {}) {
  const started = now();
  const done = (ok, detail) => ({ ok, detail, ms: Math.max(0, Math.round(now() - started)) });
  if (!ffmpeg) return done(false, "bundled ffmpeg not found");
  const result = spawn(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "image2pipe",
      "-c:v",
      "png",
      "-i",
      "-",
      "-frames:v",
      "1",
      "-c:v",
      "h264_nvenc",
      "-pix_fmt",
      "yuv420p",
      "-f",
      "null",
      "-",
    ],
    {
      cwd: path.dirname(ffmpeg),
      input: testFrame(),
      stdio: ["pipe", "ignore", "pipe"],
      timeout: PROBE_TIMEOUT_MS,
      windowsHide: true,
    },
  );
  if (result.error?.code === "ETIMEDOUT")
    return done(false, `no exit within ${PROBE_TIMEOUT_MS / 1000} s`);
  if (result.error) return done(false, `could not start ffmpeg (${result.error.code ?? result.error.message})`);
  if (result.status !== 0)
    return done(false, result.status === null ? `ffmpeg stopped by ${result.signal}` : `exit code ${result.status}`);
  return done(true, "exit code 0");
}

let frame;
/** A black 256x256 RGB PNG built in memory (no file is written). */
export function testFrame() {
  if (frame) return frame;
  const size = 256;
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  frame = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.alloc(size * (1 + size * 3)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return frame;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
