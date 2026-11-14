// request.json for the GUI (GU-04): the same {form, assets} shape as CLI/MCP generate.
// Shape checks and completion checks go through core validateRequest only (AR-04).
import {
  defaults, explainerStyles, mimeTypeFor, safeName, validateForm, validateRequest,
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
  const shaped = validateRequest(value, { phase: "shape" });
  if (!shaped.ok) return shaped;
  const choices = choiceIssues(shaped.value.form);
  if (choices.length) return { ok: false, error: {
    code: "E_INPUT_INVALID", message: "選べる値の決まっている項目に、使えない値があります。",
    hint: "details の pointer が指す項目を、画面で選べる値のどれかに直してください。読み込み前の入力と添付はそのままです。",
    details: choices,
  } };
  return shaped;
}

// Keys whose value is one of a fixed set. The sets themselves are not repeated here: a value
// is accepted only when core validateForm accepts it (and, for styleMode, when core
// explainerStyles has an entry, because the screen and agentPromptFor index into it).
// The shape check deliberately stops at types so that unfinished input can be imported;
// these keys are different because the screen cannot be drawn with an unknown value.
const choiceKeys = [
  "videoMode", "styleMode", "characterMode", "voiceEngine", "characterPosition",
  "tempo", "energy", "motionAmount", "biimUsage", "characterUsage", "evidencePolicy",
] as const;
/** A complete form (with a music file so that the MV probe is complete too) that core accepts. */
export const choiceProbe: MotionForm = {
  ...defaults, title: "probe", description: "probe", audience: "probe", characterMode: "duo", musicDurationSec: 1,
};
const probeAssets: JobAssets = { sources: [], music: { name: "probe.wav", data: new Uint8Array(1), size: 1, type: "audio/wav" } };
const coreRejects = (form: MotionForm) => {
  const base = new Set(validateForm(choiceProbe, probeAssets));
  return validateForm(form, probeAssets).filter((line) => !base.has(line));
};

/** Values of fixed-choice keys that core does not accept, as {pointer, reason}. */
export function choiceIssues(form: MotionForm): { pointer: string; reason: string }[] {
  const issues: { pointer: string; reason: string }[] = [];
  const report = (pointer: string, value: unknown, lines: string[]) =>
    issues.push({ pointer, reason: `${JSON.stringify(value)} は選べる値ではありません。${lines.join(" ")}`.trim() });
  for (const key of choiceKeys) {
    const value = form[key];
    const lines = coreRejects({ ...choiceProbe, [key]: value });
    if (key === "styleMode" && !Object.hasOwn(explainerStyles, String(value)) && !lines.length)
      lines.push("様式モードが不正です。");
    if (lines.length) report(`/form/${key}`, value, lines);
  }
  const position = form.secondCharacter.position;
  const lines = coreRejects({ ...choiceProbe, secondCharacter: { ...choiceProbe.secondCharacter, position } });
  if (lines.length) report("/form/secondCharacter/position", position, lines);
  return issues;
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
