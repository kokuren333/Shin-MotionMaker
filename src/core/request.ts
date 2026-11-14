import { defaults, formChoices, characterProfiles, urlLines, type MotionForm } from "./form.ts";
import type { JobAssets } from "./types.ts";
import type { AssetPaths, JsonObject, NormalizedRequest, RequestCheck, Validation } from "./types.ts";
import { formError } from "./errors.ts";

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const pointerKey = (key: string) => key.replaceAll("~", "~0").replaceAll("/", "~1");

export function validateRequest(input: unknown, check: RequestCheck): Validation<NormalizedRequest> {
  const issues: JsonObject[] = [];
  const issue = (pointer: string, reason: string) => { issues.push({ pointer, reason }); };
  const rejectUnknown = (value: Record<string, unknown>, schema: object, pointer: string) => {
    for (const key of Object.keys(value))
      if (!Object.hasOwn(schema, key)) issue(`${pointer}/${pointerKey(key)}`, "未知のキーです。");
  };
  const fields = (value: Record<string, unknown>, schema: object, pointer: string) => {
    rejectUnknown(value, schema, pointer);
    for (const [key, expected] of Object.entries(schema)) {
      if (!Object.hasOwn(value, key)) continue;
      const actual = value[key];
      const location = `${pointer}/${pointerKey(key)}`;
      if (isObject(expected)) {
        if (!isObject(actual)) issue(location, "オブジェクトを指定してください。");
        else fields(actual, expected, location);
      } else if (expected === null) {
        if (actual !== null && (typeof actual !== "number" || !Number.isFinite(actual)))
          issue(location, "有限の数値または null を指定してください。");
      } else if (typeof actual !== typeof expected || (typeof actual === "number" && !Number.isFinite(actual))) {
        issue(location, `型が不正です（${typeof expected}）。`);
      }
    }
  };
  if (!isObject(input)) issue("", "form と任意の assets を持つオブジェクトを指定してください。");
  else {
    rejectUnknown(input, { form: true, assets: true }, "");
    if (!isObject(input.form)) issue("/form", "オブジェクトを指定してください。");
    else {
      fields(input.form, defaults, "/form");
      for (const [key, choices] of Object.entries(formChoices)) {
        const nested = key === "secondCharacter";
        const value = nested && isObject(input.form.secondCharacter)
          ? input.form.secondCharacter.position : input.form[key];
        const allowed: readonly unknown[] = nested ? formChoices.secondCharacter.position : choices as readonly unknown[];
        if (value !== undefined && (nested ? typeof value === "string" : typeof value === typeof defaults[key as keyof MotionForm]) && !allowed.includes(value))
          issue(`/form/${nested ? "secondCharacter/position" : key}`, `${JSON.stringify(value)} は選べる値ではありません。`);
      }
    }
    const assets = input.assets === undefined ? {} : input.assets;
    if (!isObject(assets)) issue("/assets", "オブジェクトを指定してください。");
    else {
      rejectUnknown(assets, { sources: true, character: true, secondCharacter: true, bgm: true, music: true }, "/assets");
      if (assets.sources !== undefined && (!Array.isArray(assets.sources) ||
          assets.sources.some((item) => typeof item !== "string" || !item.trim())))
        issue("/assets/sources", "空でないファイルパスの配列を指定してください。");
      for (const key of ["character", "secondCharacter", "bgm", "music"])
        if (assets[key] !== undefined && assets[key] !== null &&
            (typeof assets[key] !== "string" || !(assets[key] as string).trim()))
          issue(`/assets/${key}`, "空でないファイルパスまたは null を指定してください。");
    }
  }
  if (issues.length) return { ok: false, error: {
    code: "E_INPUT_INVALID", message: "入力の構造に誤りがあります。",
    hint: "details の pointer が指す項目のキー・型・列挙値を修正してください。", details: issues,
  } };
  const valid = input as { form: Partial<MotionForm>; assets?: AssetPaths };
  const form: MotionForm = {
    ...defaults, ...valid.form,
    secondCharacter: { ...defaults.secondCharacter, ...valid.form.secondCharacter },
  };
  if (check.phase === "complete") {
    const errors = validateForm(form, check.assets);
    if (errors.length) {
      const error = formError(errors);
      return { ok: false, error: { code: error.code, message: error.message, hint: error.hint, details: error.details } };
    }
  }
  return { ok: true, value: { form, assets: { ...valid.assets,
    ...(valid.assets?.sources ? { sources: [...valid.assets.sources] } : {}),
  } } };
}

export function validateForm(form: MotionForm, assets?: JobAssets): string[] {
  const errors: string[] = [];
  const mv = form.videoMode === "mv";
  if (!mv) {
    if (!(formChoices.styleMode as readonly string[]).includes(form.styleMode))
      errors.push("様式モードが不正です。");
    if (form.styleMode === "mixed" && form.height > form.width)
      errors.push("縦向きの出力ではBiim枠を置けないため、様式「混在」は選べません。横向きにするか、別の様式を選んでください。");
    if (form.styleMode === "mixed" && (form.fullScreen || form.biimUsage === "never"))
      errors.push("様式「混在」ではBiim区間が必要なため、全画面モードとBiim使用率「使わない」は選べません。");
  }
  if (!(formChoices.videoMode as readonly string[]).includes(form.videoMode))
    errors.push("動画モードが不正です。");
  if (!form.title.trim()) errors.push("動画タイトルを入力してください。");
  if (!form.description.trim())
    errors.push(
      mv
        ? "MVで表現したいことを入力してください。"
        : "何を説明する動画かを入力してください。",
    );
  if (!form.audience.trim()) errors.push("対象視聴者を入力してください。");
  if (
    !Number.isInteger(form.durationSec) ||
    form.durationSec < 5 ||
    form.durationSec > 7200
  )
    errors.push("希望尺は5〜7,200秒の整数で指定してください。");
  if (
    ![form.width, form.height].every(
      (x) => Number.isInteger(x) && x >= 240 && x <= 7680 && x % 2 === 0,
    )
  )
    errors.push("解像度は240〜7,680pxの偶数で指定してください。");
  if (!(formChoices.fps as readonly number[]).includes(form.fps))
    errors.push("フレームレートは24 / 25 / 30 / 60fpsから選択してください。");
  if (!(formChoices.voiceEngine as readonly string[]).includes(form.voiceEngine))
    errors.push("音声エンジンが不正です。");
  if (!(formChoices.characterMode as readonly string[]).includes(form.characterMode))
    errors.push("キャラクターモードが不正です。");
  if (typeof form.fullScreen !== "boolean")
    errors.push("全画面モードが不正です。");
  if (
    typeof form.imageGeneration !== "boolean" ||
    typeof form.videoGeneration !== "boolean"
  )
    errors.push("素材生成の設定が不正です。");
  (mv ? [] : characterProfiles(form)).forEach((character, i) => {
    if (!(formChoices.characterPosition as readonly string[]).includes(character.position))
      errors.push(`${i + 1}人目の配置が不正です。`);
    if (!/^#[0-9a-f]{6}$/i.test(character.subtitleColor))
      errors.push(`${i + 1}人目の字幕色は6桁のHEXカラーで指定してください。`);
    if (!mv && form.voiceEngine === "aivis" && i > 0) {
      if (!Number.isSafeInteger(character.styleId) || character.styleId < 0)
        errors.push("2人目のAivis Style IDは0以上の整数で指定してください。");
      if (
        !Number.isFinite(character.voiceSpeed) ||
        character.voiceSpeed < 0.5 ||
        character.voiceSpeed > 2
      )
        errors.push("2人目の話速は0.5〜2.0で指定してください。");
    }
  });
  if (!mv && form.voiceEngine === "aivis") {
    try {
      if (!["http:", "https:"].includes(new URL(form.engineUrl).protocol))
        throw Error();
    } catch {
      errors.push("Aivis Engine URLにはHTTP / HTTPS URLを指定してください。");
    }
    if (!Number.isSafeInteger(form.styleId) || form.styleId < 0)
      errors.push("Aivis Style IDは0以上の整数で指定してください。");
    if (
      !Number.isFinite(form.voiceSpeed) ||
      form.voiceSpeed < 0.5 ||
      form.voiceSpeed > 2
    )
      errors.push("話速は0.5〜2.0で指定してください。");
  }
  urlLines(form.urls).forEach((url, i) => {
    try {
      if (!["http:", "https:"].includes(new URL(url).protocol)) throw Error();
    } catch {
      errors.push(
        `参考URLの${i + 1}行目を確認してください（HTTP / HTTPSのみ）。`,
      );
    }
  });
  for (const key of ["tempo", "energy", "motionAmount", "biimUsage", "characterUsage", "evidencePolicy"] as const) {
    if (!(formChoices[key] as readonly string[]).includes(String(form[key])))
      errors.push(`設定 ${key} が不正です。`);
  }
  for (const model of mv
    ? []
    : [
        assets?.character,
        ...(form.characterMode === "duo" ? [assets?.secondCharacter] : []),
      ])
    if (model && !/\.glb$/i.test(model.name))
      errors.push("3Dキャラクターは.glbファイルを選択してください。");
  if (!mv && assets?.bgm && !/\.(mp3|wav|ogg|m4a|aac)$/i.test(assets.bgm.name))
    errors.push("BGMはMP3 / WAV / OGG / M4A / AACを選択してください。");
  if (mv) {
    if (!assets?.music)
      errors.push("MVで使用する完成音源をアップロードしてください。");
    else if (!/\.(mp3|wav|ogg|m4a|aac)$/i.test(assets.music.name))
      errors.push("完成音源はMP3 / WAV / OGG / M4A / AACを選択してください。");
    if (
      assets?.music &&
      (!Number.isFinite(form.musicDurationSec) ||
        form.musicDurationSec! <= 0 ||
        form.musicDurationSec! > 7200)
    )
      errors.push(
        "完成音源の尺を確認してください（0秒超〜7,200秒）。音源の読み込み完了後に生成できます。",
      );
  }
  const all = [
    ...(assets?.sources ?? []),
    ...(!mv && assets?.character ? [assets.character] : []),
    ...(!mv && form.characterMode === "duo" && assets?.secondCharacter
      ? [assets.secondCharacter]
      : []),
    ...(mv
      ? assets?.music
        ? [assets.music]
        : []
      : assets?.bgm
        ? [assets.bgm]
        : []),
  ];
  if (all.some((x) => x.size <= 0))
    errors.push("空の添付ファイルは除いてください。");
  if (all.reduce((total, x) => total + x.size, 0) > 500 * 1024 * 1024)
    errors.push("添付ファイルの合計を500MB以内にしてください。");
  return errors;
}
