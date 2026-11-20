import { createHash } from "node:crypto";
import type { FileHandle } from "node:fs/promises";
import type { ErrorCode } from "../../core/index.ts";
import { hostError } from "../errors.ts";
import type { RemoteTask, Transport } from "./types.ts";

// The only module in src/host/seedance that may reference the global fetch.
export const BASE_URL = "https://ark.ap-southeast.bytepluses.com/api/v3";
export const API_TIMEOUT_MS = 30000;
export const DOWNLOAD_TIMEOUT_MS = 300000;
export const MAX_DOWNLOAD_BYTES = 1024 * 1024 * 1024;
export const MAX_RETRIES = 2;
const MAX_REDIRECTS = 3;

export type ErrorKind = "auth" | "activation" | "rate_limit" | "invalid" | "server" | "network";
type Operation = "create" | "get" | "list" | "cancel" | "download";
export type ArkTransportOptions = {
  env: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

const kindCodes: Record<ErrorKind, ErrorCode> = { auth: "E_DISABLED", activation: "E_DISABLED", rate_limit: "E_BUSY", invalid: "E_INPUT_INVALID", server: "E_ENGINE_UNREACHABLE", network: "E_ENGINE_UNREACHABLE" };
const kindText: Record<ErrorKind, [string, string]> = {
  auth: ["Seedance API の認証に失敗しました。", "環境変数 ARK_API_KEY の値と、キーの有効期限・権限を BytePlus コンソールで確認してください。"],
  activation: ["Seedance のモデルが有効化されていないか、アカウントの状態により利用できません。", "BytePlus コンソールでモデルの有効化（Activate）と残高・支払い状態を確認してください。"],
  rate_limit: ["Seedance API の利用頻度の上限に達しました。", "しばらく待ってから再試行してください。"],
  invalid: ["Seedance API が要求を受け付けませんでした。", "モデル・解像度・比率・長さ・素材の組み合わせを確認してください。"],
  server: ["Seedance API がサーバーエラーを返しました。", "しばらく待ってから再試行してください。"],
  network: ["Seedance API に接続できませんでした。", "ネットワーク接続を確認してから再試行してください。"],
};
const activationPattern = /ModelNotOpen|NotOpen|NotActivat|Unactivat|Overdue|InsufficientBalance|Balance|Arrear|AccountDisabled|AccountSuspend|AccountFrozen|AccountNotFound|QuotaExceeded|ServiceNotOpen/i;
/** Classify a non-2xx response. */
export function classifyResponse(status: number, code: string | undefined): ErrorKind {
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server";
  if (code && activationPattern.test(code)) return "activation";
  if (status === 401 || status === 403) return "auth";
  return "invalid";
}
function causes(error: unknown, depth = 0): unknown[] {
  if (!error || typeof error !== "object" || depth > 4) return [];
  const value = error as { cause?: unknown; errors?: unknown };
  return [error, ...causes(value.cause, depth + 1), ...(Array.isArray(value.errors) ? value.errors.flatMap((item) => causes(item, depth + 1)) : [])];
}
const fieldOf = (value: unknown, key: "code" | "name") => value && typeof value === "object" && key in value ? String((value as Record<string, unknown>)[key]) : "";
export function isTimeout(error: unknown): boolean {
  return causes(error).some((item) => ["TimeoutError", "AbortError"].includes(fieldOf(item, "name")) || ["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"].includes(fieldOf(item, "code")));
}
/** Connection errors that prove the request never left this machine. */
export function failedBeforeSending(error: unknown): boolean {
  return !isTimeout(error) && causes(error).some((item) => ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"].includes(fieldOf(item, "code")));
}
export function retryable(operation: Operation, outcome: { status: number } | { error: unknown }): boolean {
  if ("status" in outcome) return operation === "create" ? outcome.status === 429 || outcome.status === 503 : outcome.status === 429 || outcome.status >= 500;
  return operation === "create" ? failedBeforeSending(outcome.error) : true;
}
function apiKey(env: Record<string, string | undefined>): string {
  return (env.ARK_API_KEY ?? "").trim();
}
function redact(text: string, env: Record<string, string | undefined>): string {
  const key = apiKey(env);
  let result = key ? text.split(key).join("[redacted]") : text;
  result = result.replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
  return result.slice(0, 512);
}
function failure(kind: ErrorKind, operation: Operation, attempts: number, extra: Record<string, string | number | boolean> = {}): Error {
  const [message, hint] = kindText[kind];
  const uncertain = extra.uncertain === true;
  return hostError(kindCodes[kind], uncertain ? "Seedance のタスク作成の結果を確認できませんでした。作成済みの可能性があります。" : message,
    uncertain ? "二重課金を避けるため再送していません。seedance status で追跡するか、BytePlus コンソールのタスク一覧で確認してください。" : hint,
    { kind, operation, attempts, ...extra });
}
function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "" || host === "0.0.0.0" || host === "::" || host === "::1") return true;
  const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const v4 = (mapped ? mapped[1] : host).match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  return /^(fc|fd)[0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host);
}
export function safeDownloadUrl(value: string): URL | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  return url.protocol === "https:" && !url.username && !url.password && !isPrivateHost(url.hostname) ? url : null;
}

/** REST transport for the BytePlus ModelArk content generation API. */
export function createArkTransport(options: ArkTransportOptions): Transport {
  const env = options.env;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const call = (url: string, init: RequestInit) => (options.fetchImpl ?? fetch)(url, init);

  async function api(operation: Exclude<Operation, "download">, method: "GET" | "POST" | "DELETE", route: string, body?: unknown): Promise<unknown> {
    for (let attempt = 1; ; attempt++) {
      let response: Response;
      try {
        // Headers are local to this call and never stored or reported.
        const headers: Record<string, string> = { Authorization: `Bearer ${apiKey(env)}`, Accept: "application/json" };
        if (body !== undefined) headers["Content-Type"] = "application/json";
        response = await call(`${BASE_URL}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(API_TIMEOUT_MS), redirect: "error" });
      } catch (error) {
        if (attempt <= MAX_RETRIES && retryable(operation, { error })) { await sleep(1000 * 2 ** (attempt - 1)); continue; }
        // The original exception (and its cause) is never forwarded.
        throw failure("network", operation, attempt, { timeout: isTimeout(error), ...(operation === "create" && !failedBeforeSending(error) ? { uncertain: true } : {}) });
      }
      if (response.ok) {
        let text: string;
        // A body lost after a 2xx create means the task may exist: keep it uncertain (unknown, still reserved).
        try { text = await response.text(); }
        catch (error) { throw failure("network", operation, attempt, { timeout: isTimeout(error), reason: "body_lost", ...(operation === "create" ? { uncertain: true } : {}) }); }
        if (!text.trim()) return {};
        try { return JSON.parse(text); }
        catch { throw failure("server", operation, attempt, { status: response.status, reason: "invalid_json", ...(operation === "create" ? { uncertain: true } : {}) }); }
      }
      let apiCode: string | undefined, apiMessage: string | undefined;
      try {
        const parsed = JSON.parse((await response.text()).slice(0, 65536)) as { error?: { code?: unknown; message?: unknown } };
        if (parsed?.error && typeof parsed.error.code === "string") apiCode = redact(parsed.error.code, env).slice(0, 128);
        if (parsed?.error && typeof parsed.error.message === "string") apiMessage = redact(parsed.error.message, env);
      } catch {}
      if (attempt <= MAX_RETRIES && retryable(operation, { status: response.status })) { await sleep(1000 * 2 ** (attempt - 1)); continue; }
      const kind = classifyResponse(response.status, apiCode);
      const uncertain = operation === "create" && response.status >= 500 && response.status !== 503;
      throw failure(kind, operation, attempt, { status: response.status, ...(apiCode ? { api_code: apiCode } : {}), ...(apiMessage ? { api_message: apiMessage } : {}), ...(uncertain ? { uncertain: true } : {}) });
    }
  }
  function remoteTask(value: unknown, operation: Operation): RemoteTask {
    if (!value || typeof value !== "object" || typeof (value as RemoteTask).id !== "string") throw failure("server", operation, 1, { reason: "invalid_task" });
    const task = value as RemoteTask;
    return { id: task.id, model: typeof task.model === "string" ? task.model : undefined, status: typeof task.status === "string" ? task.status : "unknown",
      created_at: typeof task.created_at === "number" ? task.created_at : undefined, updated_at: typeof task.updated_at === "number" ? task.updated_at : undefined,
      content: task.content && typeof task.content.video_url === "string" ? { video_url: task.content.video_url } : undefined,
      usage: task.usage && typeof task.usage === "object" ? { completion_tokens: typeof task.usage.completion_tokens === "number" ? task.usage.completion_tokens : undefined, total_tokens: typeof task.usage.total_tokens === "number" ? task.usage.total_tokens : undefined } : undefined,
      error: task.error && typeof task.error === "object" ? { code: typeof task.error.code === "string" ? redact(task.error.code, env).slice(0, 128) : undefined, message: typeof task.error.message === "string" ? redact(task.error.message, env) : undefined } : null };
  }
  async function downloadOnce(start: URL, handle: FileHandle): Promise<{ bytes: number; sha256: string } | { status: number } > {
    let url = start;
    for (let hop = 0; ; hop++) {
      // No Authorization header: the signed URL carries its own credentials.
      const response = await call(url.toString(), { method: "GET", redirect: "manual", signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        const next = location ? safeDownloadUrl(new URL(location, url).toString()) : null;
        if (!next || hop >= MAX_REDIRECTS) throw hostError("E_ENGINE_UNREACHABLE", "動画のダウンロード先が安全でないか、転送が多すぎます。", "BytePlus コンソールで動画を確認してください。", { kind: "unsafe_url", operation: "download" });
        url = next; continue;
      }
      if (!response.ok) return { status: response.status };
      const declared = Number(response.headers.get("content-length") ?? "0");
      if (declared > MAX_DOWNLOAD_BYTES) throw hostError("E_ENGINE_UNREACHABLE", "動画が 1 GiB の上限を超えています。", "BytePlus コンソールで動画を確認してください。", { kind: "invalid_output", operation: "download" });
      await handle.truncate(0);
      const hash = createHash("sha256");
      let total = 0;
      if (response.body) for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
        total += chunk.byteLength;
        if (total > MAX_DOWNLOAD_BYTES) throw hostError("E_ENGINE_UNREACHABLE", "動画が 1 GiB の上限を超えています。", "BytePlus コンソールで動画を確認してください。", { kind: "invalid_output", operation: "download" });
        hash.update(chunk);
        await handle.write(chunk, 0, chunk.byteLength, total - chunk.byteLength);
      }
      return { bytes: total, sha256: hash.digest("hex") };
    }
  }

  return {
    backend: "ark",
    async create(body) {
      const value = await api("create", "POST", "/contents/generations/tasks", body) as { id?: unknown };
      if (!value || typeof value.id !== "string" || !value.id) throw failure("server", "create", 1, { reason: "missing_task_id", uncertain: true });
      return { id: value.id };
    },
    async get(id) {
      return remoteTask(await api("get", "GET", `/contents/generations/tasks/${encodeURIComponent(id)}`), "get");
    },
    async list(filter) {
      const query = new URLSearchParams({ page_num: "1", page_size: "100", "filter.model": filter.model_id });
      const value = await api("list", "GET", `/contents/generations/tasks?${query}`) as { items?: unknown };
      return Array.isArray(value?.items) ? value.items.map((item) => remoteTask(item, "list")) : [];
    },
    async cancel(id) {
      await api("cancel", "DELETE", `/contents/generations/tasks/${encodeURIComponent(id)}`);
    },
    async download(value, handle) {
      const start = safeDownloadUrl(value);
      if (!start) throw hostError("E_ENGINE_UNREACHABLE", "動画の URL が https でないか、許可されないホストです。", "BytePlus コンソールで動画を確認してください。", { kind: "unsafe_url", operation: "download" });
      for (let attempt = 1; ; attempt++) {
        let outcome: Awaited<ReturnType<typeof downloadOnce>>;
        try { outcome = await downloadOnce(start, handle); }
        catch (error) {
          if (error && typeof error === "object" && "hint" in error) throw error;
          if (attempt <= MAX_RETRIES) { await sleep(1000 * 2 ** (attempt - 1)); continue; }
          throw failure("network", "download", attempt, { timeout: isTimeout(error) });
        }
        if ("sha256" in outcome) return outcome;
        if (attempt <= MAX_RETRIES && retryable("download", outcome)) { await sleep(1000 * 2 ** (attempt - 1)); continue; }
        throw failure(classifyResponse(outcome.status, undefined), "download", attempt, { status: outcome.status });
      }
    },
  };
}
