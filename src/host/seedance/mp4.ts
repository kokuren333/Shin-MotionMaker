import fs from "node:fs/promises";

// Objective MP4 container check: ftyp first, moov and a non-empty mdat at the top level,
// mvhd with a positive duration, and a track header with a positive width and height.
export type Mp4Facts = { duration_seconds: number; width: number; height: number; major_brand: string };
export type Mp4Inspection = ({ ok: true } & Mp4Facts) | { ok: false; reason: string };

const MAX_MOOV_BYTES = 64 * 1024 * 1024;
type Box = { type: string; start: number; header: number; size: number };

function readBoxes(view: Buffer, start: number, end: number): Box[] | string {
  const boxes: Box[] = [];
  for (let offset = start; offset < end;) {
    if (end - offset < 8) return "truncated_box_header";
    let size = view.readUInt32BE(offset), header = 8;
    const type = view.toString("latin1", offset + 4, offset + 8);
    if (size === 1) {
      if (end - offset < 16) return "truncated_box_header";
      const large = view.readBigUInt64BE(offset + 8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) return "box_too_large";
      size = Number(large); header = 16;
    } else if (size === 0) size = end - offset;
    if (size < header || offset + size > end) return `invalid_box_size:${type}`;
    boxes.push({ type, start: offset, header, size });
    offset += size;
  }
  return boxes;
}
function parseMoov(moov: Buffer): Mp4Facts | string {
  const children = readBoxes(moov, 0, moov.length);
  if (typeof children === "string") return children;
  const mvhd = children.find((box) => box.type === "mvhd");
  if (!mvhd) return "missing_mvhd";
  const body = mvhd.start + mvhd.header;
  const version = moov[body];
  const need = version === 1 ? 32 : 20;
  if (mvhd.size - mvhd.header < need) return "truncated_mvhd";
  const timescale = moov.readUInt32BE(body + (version === 1 ? 20 : 12));
  const duration = version === 1 ? Number(moov.readBigUInt64BE(body + 24)) : moov.readUInt32BE(body + 16);
  if (!timescale || !duration || !Number.isFinite(duration / timescale)) return "invalid_mvhd_duration";
  let width = 0, height = 0;
  for (const trak of children.filter((box) => box.type === "trak")) {
    const inner = readBoxes(moov, trak.start + trak.header, trak.start + trak.size);
    if (typeof inner === "string") return inner;
    const tkhd = inner.find((box) => box.type === "tkhd");
    if (!tkhd) continue;
    const at = tkhd.start + tkhd.header;
    const offset = moov[at] === 1 ? 88 : 76;
    if (tkhd.size - tkhd.header < offset + 8) return "truncated_tkhd";
    const w = moov.readUInt32BE(at + offset) / 65536, h = moov.readUInt32BE(at + offset + 4) / 65536;
    if (w > 0 && h > 0) { width = Math.round(w); height = Math.round(h); break; }
  }
  if (!width || !height) return "missing_video_track_size";
  return { duration_seconds: Math.round(duration / timescale * 1000) / 1000, width, height, major_brand: "" };
}
function finish(top: Box[], moov: Buffer | null, ftyp: Buffer | null): Mp4Inspection {
  if (!top.length || top[0].type !== "ftyp" || !ftyp || ftyp.length < 4) return { ok: false, reason: "missing_ftyp" };
  if (!moov) return { ok: false, reason: "missing_moov" };
  const mdat = top.find((box) => box.type === "mdat" && box.size > box.header);
  if (!mdat) return { ok: false, reason: "missing_mdat" };
  const facts = parseMoov(moov);
  if (typeof facts === "string") return { ok: false, reason: facts };
  return { ok: true, ...facts, major_brand: ftyp.toString("latin1", 0, 4) };
}
export function inspectMp4(bytes: Uint8Array): Mp4Inspection {
  const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const top = readBoxes(view, 0, view.length);
  if (typeof top === "string") return { ok: false, reason: top };
  const moov = top.find((box) => box.type === "moov"), ftyp = top.find((box) => box.type === "ftyp");
  return finish(top, moov ? view.subarray(moov.start + moov.header, moov.start + moov.size) : null, ftyp ? view.subarray(ftyp.start + ftyp.header, ftyp.start + ftyp.size) : null);
}
/** Same check without loading the media data: only box headers, ftyp and moov are read. */
export async function inspectMp4File(file: string): Promise<Mp4Inspection> {
  const handle = await fs.open(file, "r");
  try {
    const end = (await handle.stat()).size;
    const top: Box[] = [];
    let moov: Buffer | null = null, ftyp: Buffer | null = null;
    const header = Buffer.alloc(16);
    for (let offset = 0; offset < end;) {
      const { bytesRead } = await handle.read(header, 0, Math.min(16, end - offset), offset);
      if (bytesRead < 8) return { ok: false, reason: "truncated_box_header" };
      let size = header.readUInt32BE(0), length = 8;
      const type = header.toString("latin1", 4, 8);
      if (size === 1) {
        if (bytesRead < 16) return { ok: false, reason: "truncated_box_header" };
        const large = header.readBigUInt64BE(8);
        if (large > BigInt(Number.MAX_SAFE_INTEGER)) return { ok: false, reason: "box_too_large" };
        size = Number(large); length = 16;
      } else if (size === 0) size = end - offset;
      if (size < length || offset + size > end) return { ok: false, reason: `invalid_box_size:${type}` };
      top.push({ type, start: offset, header: length, size });
      if ((type === "moov" && !moov) || (type === "ftyp" && !ftyp)) {
        if (size - length > MAX_MOOV_BYTES) return { ok: false, reason: "moov_too_large" };
        const body = Buffer.alloc(size - length);
        await handle.read(body, 0, body.length, offset + length);
        if (type === "moov") moov = body; else ftyp = body;
      }
      offset += size;
    }
    return finish(top, moov, ftyp);
  } finally { await handle.close(); }
}
