import type { StyleMode } from "../../job-template/runtime/scripts/caption-capacity.mjs";
export type { StyleMode } from "../../job-template/runtime/scripts/caption-capacity.mjs";
import type { Attachment } from "./types.ts";

/** Existing fixed choices, shared by request shape checks and validateForm. */
export const formChoices = {
  videoMode: ["explanation", "mv"],
  styleMode: ["biim", "anime", "motion", "mixed"],
  characterMode: ["solo", "duo"],
  voiceEngine: ["aivis", "none"],
  characterPosition: ["left", "right"],
  tempo: ["slow", "balanced", "fast"],
  energy: ["restrained", "balanced", "bold"],
  motionAmount: ["minimal", "balanced", "rich"],
  biimUsage: ["never", "sometimes", "mostly"],
  characterUsage: ["none", "occasional", "frequent"],
  evidencePolicy: ["primary", "supplied-only", "balanced"],
  fps: [24, 25, 30, 60],
  secondCharacter: { position: ["left", "right"] },
} as const;

export interface CharacterForm {
  name: string;
  reading: string;
  personality: string;
  speakingStyle: string;
  role: string;
  position: "left" | "right";
  notes: string;
  subtitleColor: string;
  styleId: number;
  voiceSpeed: number;
  voiceNotes: string;
}

export interface MotionForm {
  videoMode: "explanation" | "mv";
  styleMode: StyleMode;
  takeaway: string;
  priorKnowledge: string;
  outline: string;
  explainerDifferentiation: string;
  musicMood: string;
  musicLyrics: string;
  musicDurationSec: number | null;
  /** MV: what should differ from previous works / what to avoid. */
  differentiation: string;
  /** Allow still-asset generation through Codex CLI + imagegen skill. */
  imageGeneration: boolean;
  /** Allow video-generation AI (Seedance etc.). Off unless the user opts in. */
  videoGeneration: boolean;
  title: string;
  description: string;
  audience: string;
  durationSec: number;
  urls: string;
  instructions: string;
  design: string;
  characterNotes: string;
  characterMode: "solo" | "duo";
  characterName: string;
  characterReading: string;
  characterPersonality: string;
  characterSpeakingStyle: string;
  characterRole: string;
  characterPosition: "left" | "right";
  subtitleColor: string;
  secondCharacter: CharacterForm;
  fullScreen: boolean;
  voiceEngine: "aivis" | "none";
  engineUrl: string;
  styleId: number;
  voiceSpeed: number;
  voiceNotes: string;
  generateAudio: boolean;
  audioNotes: string;
  width: number;
  height: number;
  fps: number;
  tempo: "slow" | "balanced" | "fast";
  energy: "restrained" | "balanced" | "bold";
  motionAmount: "minimal" | "balanced" | "rich";
  biimUsage: "never" | "sometimes" | "mostly";
  characterUsage: "none" | "occasional" | "frequent";
  diagramPolicy: string;
  allowWebResearch: boolean;
  evidencePolicy: "primary" | "supplied-only" | "balanced";
}

export const aivisPresets = {
  kokurenThird: { styleId: 1069147200, label: "kokuren_3rd（ノーマル）" },
  nattoZ: { styleId: 1566366592, label: "natto-z（ノーマル）" },
};

export const aivisStyleLabel = (styleId: number) =>
  Object.values(aivisPresets).find((preset) => preset.styleId === styleId)
    ?.label ?? "カスタムStyle ID";

export const explainerDesignDefaults: Record<StyleMode, string> = {
  biim: "Biim形式を軸に、タイポグラフィと図解の動きで理解を助ける。落ち着いた配色に、要所で大胆なアクセント。\nドパガキ向けに最後まで飽きずに見られるように、凝った演出やわかりやすいアニメーションを挿入するように努める。\nBiim枠での説明と、画面全体を使ったアニメーションはバランスよくどちらも取り入れる。各キャラクターの3Dモデルは必要に応じてサイズや位置を変更・移動できるようにする。",
  anime: "通常のアニメ解説として、キャラクターの演技と掛け合いを主役に説明する。枠やノート欄は使わず画面全体を使い、カット割り・寄り引き・リアクションで場面を見せる。字幕は画面下の標準字幕にする。\nドパガキ向けに最後まで飽きずに見られるように、テンポのよい掛け合いとわかりやすいアニメーションを挿入するように努める。各キャラクターの3Dモデルは必要に応じてサイズや位置を変更・移動できるようにする。",
  motion: "通常のモーション解説として、図形・タイポグラフィ・図解の動きを主役に説明する。枠やノート欄は使わず画面全体を使い、説明の構造を図の変化へ翻訳する。字幕は画面下の標準字幕にする。キャラクターは必要な場面だけ登場させてよい。\nドパガキ向けに最後まで飽きずに見られるように、凝った演出やわかりやすいアニメーションを挿入するように努める。",
  mixed: "Biim形式の区間と、通常のアニメ解説・モーション解説の区間を1本の中で織り交ぜる。区間ごとの様式はストーリーボードで場面単位に決め、Biim区間では枠・ノート・字幕の標準を守り、それ以外の区間では画面全体と標準字幕を使う。\nドパガキ向けに最後まで飽きずに見られるように、様式の切り替えを説明の転換点に合わせ、凝った演出やわかりやすいアニメーションを挿入するように努める。各キャラクターの3Dモデルは必要に応じてサイズや位置を変更・移動できるようにする。",
};

export function switchStyleMode(form: MotionForm, mode: StyleMode): MotionForm {
  return {
    ...form,
    styleMode: mode,
    design: form.design === explainerDesignDefaults[form.styleMode]
      ? explainerDesignDefaults[mode] : form.design,
  };
}

export const defaults: MotionForm = {
  videoMode: "explanation",
  styleMode: "biim",
  takeaway: "",
  priorKnowledge: "",
  outline: "",
  explainerDifferentiation: "",
  musicMood: "",
  musicLyrics: "",
  musicDurationSec: null,
  differentiation: "",
  imageGeneration: true,
  videoGeneration: false,
  title: "",
  description: "",
  audience: "",
  durationSec: 300,
  urls: "",
  instructions: "",
  design: explainerDesignDefaults.biim,
  characterNotes:
    "解説を一緒に進める演者。視線・指差し・リアクションを内容に合わせ、字幕や図解を隠さない。",
  characterMode: "solo",
  characterName: "",
  characterReading: "",
  characterPersonality: "落ち着いていて、説明が丁寧。",
  characterSpeakingStyle: "わかりやすいです・ます調。",
  characterRole: "解説役",
  characterPosition: "left",
  subtitleColor: "#0000ff",
  secondCharacter: {
    name: "",
    reading: "",
    personality: "好奇心旺盛で、素直に疑問を投げかける。",
    speakingStyle: "親しみやすい口調。",
    role: "聞き手・質問役",
    position: "right",
    notes: "相手の説明に合わせて視線やリアクションをつける。",
    subtitleColor: "#ff0000",
    styleId: aivisPresets.nattoZ.styleId,
    voiceSpeed: 1,
    voiceNotes: "質問と相づちに自然な抑揚をつける。",
  },
  fullScreen: false,
  voiceEngine: "aivis",
  engineUrl: "http://127.0.0.1:10101",
  styleId: aivisPresets.kokurenThird.styleId,
  voiceSpeed: 1,
  voiceNotes:
    "自然な日本語。専門用語の読みと、図解を理解するための間を調整する。",
  generateAudio: true,
  audioNotes:
    "場面に合う簡単なBGMとSEを作成する。説明中は控えめなループ、登場や強調には短いチャイム・スウィッシュ・インパクト。ナレーションを優先し、音の密度に緩急をつける。",
  width: 1920,
  height: 1080,
  fps: 30,
  tempo: "fast",
  energy: "balanced",
  motionAmount: "rich",
  biimUsage: "sometimes",
  characterUsage: "frequent",
  diagramPolicy:
    "数式は段階的に導入。図解は関係や因果を動きで説明。チャートは実データと出典を示し、装飾のために数値を作らない。",
  allowWebResearch: true,
  evidencePolicy: "primary",
};
export function safeName(value: string): string {
  const leaf = value.split(/[\\/]/).pop() || "file";
  const clean =
    leaf
      .normalize("NFC")
      .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "-")
      .replace(/^[. ]+|[. ]+$/g, "")
      .slice(0, 120)
      .replace(/[. ]+$/g, "") || "file";
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(clean)
    ? `_${clean}`
    : clean;
}

export function uniqueNames(files: Pick<Attachment, "name">[]): string[] {
  const used = new Set<string>();
  return files.map((file) => {
    const base = safeName(file.name);
    const dot = base.lastIndexOf(".");
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : "";
    let name = base;
    let i = 2;
    while (used.has(name.toLowerCase())) name = `${stem}-${i++}${ext}`;
    used.add(name.toLowerCase());
    return name;
  });
}
export const urlLines = (text: string) => [
  ...new Set(
    text
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean),
  ),
];

export const usesFullScreen = (form: MotionForm) =>
  form.videoMode === "mv" ||
  form.styleMode === "anime" || form.styleMode === "motion" ||
  form.fullScreen ||
  form.height > form.width ||
  form.biimUsage === "never";

export const mvDesign =
  "完成音源の曲調・感情・世界観に合ったモーショングラフィックスのMVを制作する。何を表現するかを先に決め、楽曲のセクション・ビート・盛り上がりの変化を映像の構造的な変化へ翻訳する。タイポグラフィ、図形、色彩、パーティクル、カメラの動きを構成し、強調する区間と抑える区間を作って全編をクライマックスにしない。\n歌詞は構図の要素として設計する。冒頭のフックでは大きく提示し、字幕的な表示と巨大タイポグラフィの緩急をつけ、歌詞・キャラ・背景の居場所を構図段階で決める。\nこの曲だけの一貫したスタイルを定義し、凡庸で無個性な絵作りや前作の焼き直しを避ける。アップロードされた画像・歌詞・資料・データを演出に取り入れ、画面全体を使って音源の実測尺に合わせて最後まで構成する。";
export const mvInstructions =
  "アップロードした完成音源と参考資料を基に、曲の雰囲気に合うモーショングラフィックス系のMVを制作してください。音源を最初から最後までそのまま使用し、楽曲の展開と映像を同期してください。";
const modeKeys = [
  "design",
  "instructions",
  "fullScreen",
  "biimUsage",
  "voiceEngine",
  "generateAudio",
  "characterUsage",
  "allowWebResearch",
  "evidencePolicy",
] as const;
export type ModeSettings = Pick<MotionForm, (typeof modeKeys)[number]>;
export const modeSettingsFor = (form: MotionForm): ModeSettings =>
  Object.fromEntries(modeKeys.map((key) => [key, form[key]])) as ModeSettings;
export function switchVideoMode(
  form: MotionForm,
  mode: MotionForm["videoMode"],
  saved?: ModeSettings,
): MotionForm {
  const settings =
    saved ??
    (mode === "mv"
      ? {
          ...modeSettingsFor(defaults),
          design: mvDesign,
          instructions: mvInstructions,
          fullScreen: true,
          biimUsage: "never",
          voiceEngine: "none",
          generateAudio: false,
          characterUsage: "none",
          allowWebResearch: false,
          evidencePolicy: "supplied-only",
        }
      : { ...modeSettingsFor(defaults), design: explainerDesignDefaults[form.styleMode] });
  return { ...form, ...settings, videoMode: mode };
}

export function characterProfiles(form: MotionForm): CharacterForm[] {
  const first: CharacterForm = {
    name: form.characterName,
    reading: form.characterReading,
    personality: form.characterPersonality,
    speakingStyle: form.characterSpeakingStyle,
    role: form.characterRole,
    position: form.characterPosition,
    notes: form.characterNotes,
    subtitleColor: form.subtitleColor,
    styleId: form.styleId,
    voiceSpeed: form.voiceSpeed,
    voiceNotes: form.voiceNotes,
  };
  return form.characterMode === "duo" ? [first, form.secondCharacter] : [first];
}
