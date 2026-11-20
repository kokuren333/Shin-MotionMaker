import type { FileHandle } from "node:fs/promises";
import type { SmmError } from "../../core/index.ts";

export type Resolution = "480p" | "720p" | "1080p" | "4k";
export type Ratio = "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9" | "adaptive";
export type SeedanceMode = "text" | "image" | "reference";
export type SeedanceStatus = "creating" | "queued" | "running" | "succeeded" | "failed" | "cancelled" | "expired" | "unknown" | "error";
export type InputRole = "first_frame" | "last_frame" | "reference_image" | "reference_video" | "reference_audio";

export type SeedanceParams = { resolution: Resolution; ratio: Ratio; duration: number; seed?: number; generate_audio: boolean; watermark: boolean };
export type SeedanceInputRecord = { role: InputRole; path?: string; url?: string; url_sha256?: string; sha256?: string };
export type SeedanceVideoFacts = { bytes: number; duration_seconds: number; width: number; height: number };
export type SeedanceTask = {
  local_id: string; shot_id: string; task_id: string | null; dry_run: boolean;
  model: { alias: string; id: string }; mode: SeedanceMode; prompt: string;
  inputs: SeedanceInputRecord[]; params: SeedanceParams; cache_key: string; cached: boolean;
  status: SeedanceStatus; estimate_usd: number; estimate_tokens: number; estimate_basis: string;
  usage_tokens: number | null; actual_usd: number | null;
  output: string | null; output_sha256: string | null; sidecar: string | null; thumbnail: string | null;
  video: SeedanceVideoFacts | null; error: SmmError | null; owner_pid: number | null;
  created_at: string; updated_at: string;
};
export type TasksDocument = { schema: "smm.seedance-tasks/1"; tasks: SeedanceTask[] };

/** Remote task as returned by the content generation API (only the fields used here). */
export type RemoteTask = {
  id: string; model?: string; status: string; created_at?: number; updated_at?: number;
  content?: { video_url?: string };
  usage?: { completion_tokens?: number; total_tokens?: number };
  error?: { code?: string; message?: string } | null;
};
export type DownloadResult = { bytes: number; sha256: string };
/** The mock and the REST client share this interface. */
export type Transport = {
  backend: "mock" | "ark";
  create(body: Record<string, unknown>): Promise<{ id: string }>;
  get(id: string, expected?: { model_id: string; estimate_tokens: number }): Promise<RemoteTask>;
  list(filter: { model_id: string }): Promise<RemoteTask[]>;
  cancel(id: string): Promise<void>;
  download(url: string, handle: FileHandle): Promise<DownloadResult>;
};
