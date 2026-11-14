// request.json for the GUI (GU-04): the same {form, assets} shape as CLI/MCP generate.
// Shape checks and completion checks go through core validateRequest only (AR-04).
import {
  formChoices, mimeTypeFor, safeName, validateRequest,
  type AssetPaths, type Attachment, type JobAssets, type MotionForm, type NormalizedRequest,
  type Request, type SmmError, type Validation,
} from "../../../src/core/index.ts";

/** Files the user picked in the browser, before mode filtering. */
export type NamedBlob = Blob & { name: string };
export type PickedFiles = {
  sources: NamedBlob[];
  character?: NamedBlob; secondCharacter?: NamedBlob; bgm?: NamedBlob; music?: NamedBlob;
};

const attachment = (file: NamedBlob): Attachment =>
  // Contract §2: the MIME type comes from mimeTypeFor, never from File.type (AR-06).
  ({ name: file.name, data: file, size: file.size, type: mimeTypeFor(file.name) });

/** The attachments that a job of this mode actually uses (same filter as the upstream GUI). */
export function assetsFor(form: MotionForm, picked: PickedFiles): JobAssets {
  const mv = form.videoMode === "mv";
  return {
    sources: picked.sources.map(attachment),
    character: !mv && picked.character ? attachment(picked.character) : undefined,
    secondCharacter: !mv && form.characterMode === "duo" && picked.secondCharacter
      ? attachment(picked.secondCharacter) : undefined,
    bgm: !mv && picked.bgm ? attachment(picked.bgm) : undefined,
    music: mv && picked.music ? attachment(picked.music) : undefined,
  };
}

/** request.json content. Attachments are written as bare file names (GU-04). */
export function requestFor(form: MotionForm, assets: JobAssets): Request {
  const paths: AssetPaths = { sources: assets.sources.map((file) => file.name) };
  for (const key of ["character", "secondCharacter", "bgm", "music"] as const)
    if (assets[key]) paths[key] = assets[key]!.name;
  return { form: structuredClone(form), assets: paths };
}

export const requestText = (request: Request) => JSON.stringify(request, null, 2) + "\n";

export const requestFilename = (form: MotionForm) =>
  `${form.title.trim() ? safeName(form.title) : "request"}.request.json`;

/** Names that appear more than once would overwrite each other next to request.json. */
export function duplicateNames(request: Request): string[] {
  const names = [...(request.assets?.sources ?? []),
    ...(["character", "secondCharacter", "bgm", "music"] as const)
      .map((key) => request.assets?.[key]).filter((name): name is string => typeof name === "string")];
  return [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
}

/** Completion check before ZIP generation: the same core function as CLI/MCP. */
export const checkComplete = (form: MotionForm, assets: JobAssets): Validation<NormalizedRequest> =>
  validateRequest(requestFor(form, assets), { phase: "complete", assets });

/** Parse an imported request.json (BOM allowed, as in CL-01) and check its shape with core. */
export function parseRequestText(text: string): Validation<NormalizedRequest> {
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^﻿/, ""));
  } catch (error) {
    return { ok: false, error: {
      code: "E_INPUT_INVALID", message: "request.json を JSON として読み取れません。",
      hint: "CLI・MCP の generate に渡す request.json（{\"form\": {...}, \"assets\": {...}}）を選んでください。",
      details: [{ pointer: "", reason: error instanceof Error ? error.message : String(error) }],
    } };
  }
  return validateRequest(value, { phase: "shape" });
}

/** File names to pick again after an import (request paths may contain folders). */
export function attachmentsToReselect(form: MotionForm, assets: AssetPaths): { label: string; name: string }[] {
  const leaf = (value: string) => value.split(/[\\/]/).pop() || value;
  const mv = form.videoMode === "mv";
  const list = (assets.sources ?? []).map((name) => ({ label: "参考資料", name: leaf(name) }));
  if (!mv && assets.character) list.push({ label: "1人目の3Dモデル", name: leaf(assets.character) });
  if (!mv && form.characterMode === "duo" && assets.secondCharacter)
    list.push({ label: "2人目の3Dモデル", name: leaf(assets.secondCharacter) });
  if (!mv && assets.bgm) list.push({ label: "BGM", name: leaf(assets.bgm) });
  if (mv && assets.music) list.push({ label: "完成音源", name: leaf(assets.music) });
  return list;
}

/** One line per problem, in Japanese, for the error summary. */
export function errorLines(error: SmmError): string[] {
  if (error.code === "E_FORM_INVALID" && Array.isArray(error.details))
    return error.details.filter((line): line is string => typeof line === "string");
  const lines = [error.message];
  if (Array.isArray(error.details))
    for (const entry of error.details)
      if (entry && typeof entry === "object" && !Array.isArray(entry))
        lines.push(`${String(entry.pointer || "/")}：${String(entry.reason)}`);
  lines.push(error.hint);
  return lines;
}

// Import errors (R-10). core validateRequest speaks to people who write request.json by hand
// ("details の pointer …キー・型・列挙値"); the GUI keeps that message and every pointer, and adds
// what the screen user needs: the screen name of the item, the values core accepts for keys with
// a fixed set (taken from core formChoices, never repeated here), and that nothing was changed.

/** Screen names for request.json pointers. Only names; unknown pointers are shown as they are. */
const screenNames: Record<string, string> = {
  "/form/videoMode": "制作モード", "/form/styleMode": "様式モード", "/form/title": "動画タイトル",
  "/form/description": "何を説明する動画か／MVで表現したいこと", "/form/audience": "対象視聴者",
  "/form/durationSec": "希望尺", "/form/urls": "参考URL", "/form/instructions": "動画全体への指示",
  "/form/design": "デザイン方向性", "/form/characterMode": "キャラクターモード", "/form/voiceEngine": "音声エンジン",
  "/form/characterPosition": "1人目のキャラの初期配置", "/form/secondCharacter/position": "2人目のキャラの初期配置",
  "/form/tempo": "テンポ", "/form/energy": "派手さ", "/form/motionAmount": "モーショングラフィックス量",
  "/form/biimUsage": "Biimレイアウト使用率", "/form/characterUsage": "3Dキャラ登場頻度",
  "/form/evidencePolicy": "根拠資料の扱い", "/form/fps": "フレームレート",
  "/assets/sources": "参考資料", "/assets/character": "1人目の3Dモデル", "/assets/secondCharacter": "2人目の3Dモデル",
  "/assets/bgm": "BGM", "/assets/music": "完成音源",
};

/** Values core accepts at a pointer whose value is one of a fixed set (from core formChoices). */
function choicesAt(pointer: string): readonly unknown[] | undefined {
  if (pointer === "/form/secondCharacter/position") return formChoices.secondCharacter.position;
  const key = pointer.startsWith("/form/") ? pointer.slice("/form/".length) : "";
  if (key === "secondCharacter" || !Object.hasOwn(formChoices, key)) return undefined;
  return formChoices[key as keyof typeof formChoices] as readonly unknown[];
}

export const importKeptNote = "読み込み前の入力と添付はそのままです。";

/** Lines for a request.json that could not be imported: core message, one line per pointer, then guidance. */
export function importErrorLines(error: SmmError): string[] {
  if (!Array.isArray(error.details)) return [error.message, error.hint, importKeptNote];
  const lines = [error.message];
  let structural = false;
  for (const entry of error.details) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const pointer = String(entry.pointer ?? "");
    const name = screenNames[pointer];
    const choices = choicesAt(pointer);
    const values = choices ? `request.json に書ける値：${choices.map(String).join("、")}` : "";
    if (pointer) structural = true;
    lines.push(`${name ? `${name}（${pointer}）` : pointer || "/"}：${String(entry.reason)}${values ? `　${values}` : ""}`);
  }
  lines.push(structural
    ? "request.json の上の項目を直してから、もう一度読み込んでください。"
    : error.hint);
  lines.push(importKeptNote);
  return lines;
}
