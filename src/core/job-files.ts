import { safeName, uniqueNames, usesFullScreen, type MotionForm } from "./form.ts";
import { validateForm } from "./request.ts";
import { createProject, createBiimFrame } from "./project.ts";
import { createBrief } from "./brief.ts";
import { agentPromptFor } from "./prompt.ts";
import { formError, internalError } from "./errors.ts";
import { assertJobPath, includeTemplatePath } from "./template-paths.ts";
import type { Attachment, BuiltJob, JobAssets, JobFiles, TemplateFiles } from "./types.ts";

export async function buildJobFiles(
  form: MotionForm,
  assets: JobAssets,
  templates: TemplateFiles,
): Promise<BuiltJob> {
  try { return await assembleJobFiles(form, assets, templates); }
  catch (error) {
    if (error && typeof error === "object" && "code" in error && "hint" in error) throw error;
    throw internalError(error instanceof Error ? `ジョブの構築に失敗しました: ${error.message}` : "ジョブの構築に失敗しました。");
  }
}

async function assembleJobFiles(
  form: MotionForm,
  assets: JobAssets,
  templates: TemplateFiles,
): Promise<BuiltJob> {
  const errors = validateForm(form, assets);
  if (errors.length) throw formError(errors);
  for (const required of [
    "AGENTS.md",
    "runtime/package.json",
    "runtime/src/Root.tsx",
    "runtime/scripts/aivis.mjs",
    "runtime/scripts/validate.mjs",
    "assets/fonts/NotoSansJP-Variable.ttf",
    "assets/fonts/MPLUSRounded1c-ExtraBold.ttf",
    "assets/biim-frame.svg",
  ]) {
    if (!templates[required])
      throw internalError(`同梱テンプレートが不足しています: ${required}`);
  }
  const rootName = safeName(form.title.trim());
  const files: JobFiles = {};
  const encoder = new TextEncoder();
  const root = { file(name: string, data: string | Uint8Array) { files[name] = typeof data === "string" ? encoder.encode(data) : new Uint8Array(data); } };
  for (const [path, data] of Object.entries(templates)) {
    assertJobPath(path);
    if (!includeTemplatePath(path)) continue;
    root.file(path, data);
  }
  const project = createProject(form, assets);
  root.file("project.json", JSON.stringify(project, null, 2) + "\n");
  root.file(
    "assets/biim-frame.svg",
    createBiimFrame(project.layout.subtitle_frame),
  );
  root.file(
    "brief.md",
    createBrief(form, assets) +
      (form.videoMode === "mv"
        ? ""
        : form.styleMode === "anime" || form.styleMode === "motion"
          ? `\n## 全画面の演出\n画面全体を使い、縦画面では縦向けに構図・文字・キャラの位置を設計する。FullscreenStageのcharacterStyle / secondCharacterStyleでキャラの位置や大きさを調整できる。\n\n## 場面テキストと字幕\nscenes[].script（読み上げ・標準字幕）またはdialogueにspeaker_id (character1 / character2)とtextを記入する。plan/narration.jsonのsegmentsで上書きする場合もscene_idを付ける。字幕は画面下の既定位置に固定する。キャラは基本位置を保ちつつ、必要な場面で位置・サイズを変更できる。映像は自由なReact/Remotionシーンとして実装する。npm run voiceは台本から音声と字幕を生成し、話者ごとの設定を使う。字幕の名前は表記、音声は読み仮名を使い、音声だけ別の読みはspoken_textを指定する。\n\n## 場面に合わせたBGM・SE制作\n簡単なBGM / SEの作成: ${form.generateAudio ? "許可・希望する" : "行わない（添付音源のみ使用可）"}\n${form.audioNotes}\n添付BGMを優先し、生成時はruntime/scripts/sound-design.mjsか独自実装を使う。音はstoryboardの説明意図に合わせ、会話を邪魔しない音量でミックスする。出典・利用条件を記録し、previewを音声付きで確認する。\n`
        : `${usesFullScreen(form) ? "\n## 全画面の演出\nBiim枠や固定ノート欄は使わない。縦画面は縦向けに構図・文字・キャラの位置を設計する。BiimScene / BiimOverlayも枠なしで画面全体を使用する。\n" : ""}\n## 場面テキストと字幕\nBiimを使う設定の場面ではproject.layoutの枠・ノートの標準座標、同梱SVG、同梱フォントを使用する。字幕位置はレイアウトごとの既定位置に固定する。キャラは基本位置を保ちつつ、必要な場面で位置・サイズを自由に変更できる。全画面・縦画面ではBiim枠を使わない。場面ごとにnote_top（右上）、note_bottom（右下）、script（読み上げ・字幕）を制作エージェントが記入する。BiimSceneコンポーネントがノートを枠に配置し、npm run voiceはscriptから音声と字幕を生成できる。映像は自由なReact/Remotionシーンとして実装する。掛け合いはscenes[].dialogueにspeaker_id (character1 / character2) とtextを記入するか、plan/narration.jsonのsegmentsで指定する。音声と字幕は話者ごとの設定を使用し、字幕の名前は表記、音声は読み仮名を使う。音声だけ別の読みを指定する場合はspoken_textを記入する。\n\n## 場面に合わせたBGM・SE制作\n簡単なBGM / SEの作成: ${form.generateAudio ? "許可・希望する" : "行わない（添付音源のみ使用可）"}\n${form.audioNotes}\n添付BGMがある場合はそれを優先。生成を希望する場合はruntime/scripts/sound-design.mjsを使うか、必要に応じて独自実装する。音の出現はstoryboardの説明意図に合わせ、会話を邪魔しない音量でミックスする。音源の作り方・出典・利用条件を記録し、previewを音声付きで確認する。\n`),
  );
  const names = uniqueNames(assets.sources);
  // Normalize Blobs to bytes for both browsers and Node-based verification.
  const bytes = async (data: Attachment["data"]) =>
    data instanceof Uint8Array
      ? data
      : new Uint8Array(await data.arrayBuffer());
  for (let i = 0; i < assets.sources.length; i++)
    root.file(`sources/${names[i]}`, await bytes(assets.sources[i].data));
  if (form.videoMode !== "mv" && assets.character)
    root.file("assets/character.glb", await bytes(assets.character.data));
  if (
    form.videoMode !== "mv" &&
    form.characterMode === "duo" &&
    assets.secondCharacter
  )
    root.file(
      "assets/character2.glb",
      await bytes(assets.secondCharacter.data),
    );
  if (project.audio.bgm && assets.bgm)
    root.file(project.audio.bgm, await bytes(assets.bgm.data));
  if (project.audio.music && assets.music)
    root.file(project.audio.music, await bytes(assets.music.data));
  if (form.videoMode === "mv" && form.musicLyrics.trim())
    root.file("plan/lyrics.txt", form.musicLyrics);
  if (form.videoMode === "explanation" && form.outline.trim())
    root.file("plan/outline.txt", form.outline);
  for (const folder of ["sources", "assets", "reports", "output", "plan"])
    root.file(`${folder}/.gitkeep`, "");
  return { rootName, filename: `${rootName}-motion-job.zip`, files, project, agentPrompt: agentPromptFor(form.videoMode, form.styleMode) };
}
