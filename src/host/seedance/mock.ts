import { randomBytes } from "node:crypto";
import { sha256 } from "../io.ts";
import { hostError } from "../errors.ts";
import { mockVideo } from "./mock-video.ts";
import type { Transport } from "./types.ts";

export const MOCK_PREFIX = "mock-";
export const MOCK_VIDEO_URL = "mock://seedance/video.mp4";

/** DRY_RUN transport. Never touches the network and keeps no state: every task has succeeded. */
export function createMockTransport(): Transport {
  return {
    backend: "mock",
    async create(body) {
      if (!body || typeof body.model !== "string") throw hostError("E_INTERNAL", "モックへの作成要求が不正です。");
      return { id: `${MOCK_PREFIX}${randomBytes(8).toString("hex")}` };
    },
    async get(id, expected) {
      if (!id.startsWith(MOCK_PREFIX)) throw hostError("E_INPUT_INVALID", "モックのタスク ID ではありません。", "DRY_RUN で作ったタスクだけをモックで追跡できます。");
      const now = Math.floor(Date.now() / 1000);
      return { id, model: expected?.model_id, status: "succeeded", created_at: now, updated_at: now,
        content: { video_url: MOCK_VIDEO_URL }, usage: { completion_tokens: expected?.estimate_tokens ?? 0, total_tokens: expected?.estimate_tokens ?? 0 } };
    },
    async list() { return []; },
    async cancel() {},
    async download(url, handle) {
      if (url !== MOCK_VIDEO_URL) throw hostError("E_INTERNAL", "モックの動画 URL ではありません。");
      const bytes = mockVideo();
      await handle.write(bytes, 0, bytes.length, 0);
      return { bytes: bytes.length, sha256: sha256(bytes) };
    },
  };
}
