import biimStandard from "./data/biim-standard.json" with { type: "json" };
import { characterProfiles, defaults, uniqueNames, urlLines, usesFullScreen, type MotionForm } from "./form.ts";
import type { JobAssets } from "./types.ts";
import { PACKAGE_VERSION, TEMPLATE_VERSION } from "./data/version.ts";

export function createProject(form: MotionForm, assets: JobAssets) {
  const mv = form.videoMode === "mv";
  const fullScreen = usesFullScreen(form);
  const portrait = form.height > form.width;
  const characters = characterProfiles(mv ? defaults : form).map(
    (character, i) => {
      const model = mv
        ? undefined
        : i === 0
          ? assets.character
          : assets.secondCharacter;
      return {
        id: `character${i + 1}`,
        name: character.name.trim(),
        reading: character.reading.trim(),
        personality: character.personality,
        speaking_style: character.speakingStyle,
        role: character.role,
        notes: character.notes,
        position: character.position,
        model: model ? `assets/character${i === 0 ? "" : "2"}.glb` : null,
        original_name: model?.name ?? null,
        subtitle_color: character.subtitleColor,
        subtitle_outline: "#ffffff",
        voice: {
          style_id: character.styleId,
          speed: character.voiceSpeed,
          notes: character.voiceNotes,
        },
      };
    },
  );
  const layout = structuredClone(biimStandard);
  const fullscreenRegions = portrait
    ? {
        main: [0, 0, 1080, 1920],
        note_top: [0, 0, 0, 0],
        note_bottom: [0, 0, 0, 0],
        character: [32, 1370, 270, 330],
        character_second: [778, 1370, 270, 330],
        subtitle: [54, 1715, 972, 170],
      }
    : {
        main: [0, 0, 1920, 1080],
        note_top: [0, 0, 0, 0],
        note_bottom: [0, 0, 0, 0],
        character: [24, 700, 300, 240],
        character_second: [1596, 700, 300, 240],
        subtitle: [96, 950, 1728, 110],
      };
  const biimRegions = {
    ...layout.regions,
    character_second: [1620, 840, 300, 232],
  };
  const visibleCharacters = form.characterUsage === "none" ? [] : characters;
  const leftCount = visibleCharacters.filter(
    (character) => character.position === "left",
  ).length;
  const rightCount = visibleCharacters.length - leftCount;
  const sideCounts = { left: 0, right: 0 };
  characters.forEach((character, i) => {
    const offset = sideCounts[character.position]++;
    const key = i === 0 ? "character" : "character_second";
    if (form.characterMode === "duo" || character.position === "right")
      biimRegions[key] = [
        character.position === "left"
          ? offset * 300
          : 1920 - (offset + 1) * 300,
        840,
        300,
        232,
      ];
    const w = fullscreenRegions[key][2];
    fullscreenRegions[key][0] =
      character.position === "left"
        ? 32 + offset * (w + 18)
        : (portrait ? 1080 : 1920) - 32 - w - offset * (w + 18);
  });
  let subtitleFrame = [300, 846, 1612, 226];
  if (
    form.characterMode === "duo" ||
    form.characterPosition === "right" ||
    form.characterUsage === "none"
  ) {
    const left = leftCount * 300 + (leftCount ? 10 : 42);
    const right = rightCount * 300 + (rightCount ? 10 : 42);
    biimRegions.subtitle = [left, 870, 1920 - left - right, 178];
    subtitleFrame = [left - 10, 846, 1920 - left - right + 20, 226];
  }
  layout.colors.subtitle = form.subtitleColor;
  if (fullScreen) {
    layout.base_width = portrait ? 1080 : 1920;
    layout.base_height = portrait ? 1920 : 1080;
    layout.fonts.subtitle.size = portrait ? 54 : 52;
  }
  return {
    schema_version: "0.5" as const,
    generator: { name: "shin-motionmaker" as const, version: PACKAGE_VERSION, template_version: TEMPLATE_VERSION },
    mode: form.videoMode,
    title: form.title.trim(),
    video: {
      width: form.width,
      height: form.height,
      fps: form.fps,
      orientation: portrait ? "portrait" : "landscape",
      target_duration_sec: form.durationSec,
    },
    layout: {
      ...layout,
      mode: fullScreen ? "fullscreen" : "biim",
      preset: fullScreen ? "fullscreen-v1" : layout.preset,
      frame: fullScreen ? null : layout.frame,
      regions: fullScreen ? fullscreenRegions : biimRegions,
      fullscreen_regions: fullscreenRegions,
      subtitle_frame: subtitleFrame,
    },
    direction: {
      music_mood: mv ? form.musicMood : "",
      music_lyrics: mv ? form.musicLyrics : "",
      differentiation: mv ? form.differentiation : form.explainerDifferentiation,
      audience: form.audience,
      description: form.description,
      instructions: form.instructions,
      design: form.design,
      tempo: mv ? "balanced" : form.tempo,
      energy: mv ? "balanced" : form.energy,
      motion_amount: mv ? "rich" : form.motionAmount,
      biim_usage: fullScreen ? "never" : form.biimUsage,
      character_usage: mv ? "none" : form.characterUsage,
      diagram_policy: mv ? "" : form.diagramPolicy,
      ...(!mv ? {
        style_mode: form.styleMode,
        takeaway: form.takeaway,
        prior_knowledge: form.priorKnowledge,
        outline: form.outline,
      } : {}),
    },
    voice: {
      engine: mv ? "none" : form.voiceEngine,
      engine_url: form.engineUrl,
      style_id: form.styleId,
      speed: form.voiceSpeed,
      notes: form.voiceNotes,
    },
    character_mode: mv ? "solo" : form.characterMode,
    characters,
    character: characters[0],
    audio: {
      music:
        mv && assets.music
          ? `assets/music${assets.music.name.slice(assets.music.name.lastIndexOf(".")).toLowerCase()}`
          : null,
      music_original_name: mv ? (assets.music?.name ?? null) : null,
      music_duration_sec: mv ? form.musicDurationSec : null,
      bgm:
        !mv && assets.bgm
          ? `assets/bgm${assets.bgm.name.slice(assets.bgm.name.lastIndexOf(".")).toLowerCase()}`
          : null,
      bgm_volume: 0.12,
      generate_bgm_se: mv ? false : form.generateAudio,
      instructions: mv
        ? "完成音源を通常音量で最初から最後まで一度だけ再生する。音声合成と追加音響は行わない。"
        : form.audioNotes,
    },
    asset_generation: {
      image: form.imageGeneration ? "codex-imagegen" : "off",
      image_command: form.imageGeneration
        ? 'npm run imagegen -- --name <id> --kind <kind> --prompt "<内容>"'
        : null,
      output_dir: "assets/generated",
      video_generation: form.videoGeneration,
    },
    research: {
      allow_web_research: mv ? false : form.allowWebResearch,
      evidence_policy: mv ? "supplied-only" : form.evidencePolicy,
    },
    sources: [
      ...urlLines(form.urls).map((url) => ({ kind: "url" as const, url })),
      ...uniqueNames(assets.sources).map((name, i) => ({
        kind: "file" as const,
        path: `sources/${name}`,
        original_name: assets.sources[i].name,
        size: assets.sources[i].size,
        mime_type: assets.sources[i].type,
      })),
    ],
    scenes: [],
  };
}

export function createBiimFrame([x, y, width, height]: number[]): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" shape-rendering="crispEdges">
  <title>Biim frame with character-aware subtitle region</title>
  <path fill="#1e1e1e" fill-rule="evenodd" d="M0 0H1920V1080H0Z M16 16H1456V826H16Z" />
  <g fill="#cccccc">
    <path fill-rule="evenodd" d="M8 8H1464V834H8Z M16 16H1456V826H16Z" />
    <rect x="1476" y="8" width="436" height="226" />
    <rect x="1476" y="246" width="436" height="588" />
    <rect x="${x}" y="${y}" width="${width}" height="${height}" />
  </g>
  <g fill="#1e1e1e">
    <rect x="1484" y="16" width="420" height="210" />
    <rect x="1484" y="254" width="420" height="573" />
    <rect x="${x + 8}" y="${y + 8}" width="${width - 16}" height="${height - 16}" />
  </g>
</svg>\n`;
}
