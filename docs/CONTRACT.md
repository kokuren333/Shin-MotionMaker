# Shin-MotionMaker 契約（M7-fix）

| 版 | 日付 | 改訂内容 |
| --- | --- | --- |
| SEEDANCE | 2026-11-20 | オーナー指示により操作 seedance_create・seedance_status・seedance_list を追加（§4 の3行と §12。既存の操作・既定値・エラーコードの列挙は変えない。SEEDANCE-Q1。report の許可に seedance/out/ 直下の PNG・JSON を追加。SEEDANCE-Q4） |
| CPU | 2026-11-15 | 要件改訂1（CPU 環境対応）に合わせる：job-template の差分を R1〜R6 に、テンプレート 0.5.3、ジョブ内スクリプトへの環境変数は host が解釈せず渡す（L2 の確認を受ける） |
| M7-fix | 2026-11-14 | M7-fix：G4 の R-2・R-6 を反映（L2 承認） |
| M7 | 2026-11-14 | M7：formChoices と shape の列挙検査（M4-Q1、L2 承認） |
| M3-fix | 2026-11-14 | M3-fix：MCP の画像は image ブロックだけで送る、MCP の PNG 上限 6 MiB（M3R M-1、L2 承認） |
| M0b | 2026-11-14 | M0R の M-1〜M-6、R-1〜R-14、I-1・I-4〜I-10 を L2 の裁定に従い反映 |
| M0 | 2026-11-14 | 初版 |

本書は要件定義書 §2〜§6 から後続 M1〜M4 の共通境界を書き起こしたものである。実装済み API の説明ではない。要件の正本は [REQUIREMENTS.md](REQUIREMENTS.md)。初版の交差レビューと採否は L2 が行う。本書・操作定義表・封筒・run・スキーマの変更は L2 の承認を要する。実装者は勝手に変更せず `docs/work/<作業ID>/QUESTIONS.md` に変更案と影響範囲を書き、非依存部分を進める。

## 1. 共通の型と不変条件

```ts
type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
type JsonObject = { [key: string]: JsonValue };
type Verdict = "pass" | "fail" | "not_applicable";
type Sha256 = string; // Lowercase hexadecimal, exactly 64 digits.
type JobPath = string;
type DisplayPath = string;
type VideoMode = "explanation" | "mv";
import type { StyleMode } from "../../job-template/runtime/scripts/caption-capacity.mjs";
export type { StyleMode } from "../../job-template/runtime/scripts/caption-capacity.mjs";
type Advisory = { id: string; source: string; message: string; details?: JsonValue };
type Warning = { code: string; message: string; hint?: string };
type Validation<T> =
  | { ok: true; value: T }
  | { ok: false; error: SmmError };
type Attachment = { name: string; data: Blob | Uint8Array; size: number; type: string };
type JobAssets = {
  sources: Attachment[];
  character?: Attachment; secondCharacter?: Attachment;
  bgm?: Attachment; music?: Attachment;
};
type AssetPaths = {
  sources?: string[];
  character?: string | null; secondCharacter?: string | null;
  bgm?: string | null; music?: string | null;
};
type Request = {
  form: Partial<Omit<MotionForm, "secondCharacter">> & {
    secondCharacter?: Partial<CharacterForm>;
  };
  assets?: AssetPaths;
};
type NormalizedRequest = { form: MotionForm; assets: AssetPaths };
type TemplateFiles = Record<JobPath, string | Uint8Array>;
type JobFiles = Record<JobPath, Uint8Array>;
type BuiltJob = {
  rootName: string; filename: string; files: JobFiles;
  project: Project; agentPrompt: string;
};
```

- `CharacterForm` は原典 `src/job.ts` L8〜20、`MotionForm` は L22〜74 の全キー・型をそのまま `src/core/form.ts` へ移す。`defaults` は原典 L101〜166 の全値（Aivis プリセットを含む）。M1 は元定義と fixture の full-form を照合する。新しい創造項目・列挙値を足さない。
- 自由記述は文字列のまま。`title`・`description`・`audience` の既存必須条件以外に内容の良否を検査しない。方向性・指示・差別化・理解ゴール等を候補リストに限定しない。
- `JobPath` はジョブ直下からの相対パス（ルート名を含めない）で `/` 区切り。絶対パス・空要素・`..`・バックスラッシュを拒否する。core のファイルマップ、report の path、artifacts、run.json 内のパスはこの型とする。host は実体パスも検査する。
- `DisplayPath` は入口が返す job・archive 等の表示用パス。MCP は root 相対で `..` 禁止、CLI は `process.cwd()` 相対で `..` を許す。いずれも `/` 区切り。TS-05 は CLI の cwd を MCP の root に揃えて比較する。
- `Project` は原典 `ReturnType<typeof createProject>` の形を維持し、`schema_version: "0.5"`、`generator: { name: "shin-motionmaker"; version: string; template_version: string }` の R2 だけを加える。原典0.4の読み取り型 `LegacyProject` では generator は存在しない。scenes は生成時に空。新しい設定 DB を作らない。
- 版の唯一の出どころは `src/core/data/version.ts` の `PACKAGE_VERSION`・`TEMPLATE_VERSION`・`TEMPLATE_MANIFEST_SHA256`。PACKAGE_VERSION と package.json の version の一致、job-template の実際の目録とハッシュの一致をテストで表明する。TEMPLATE_VERSION は job-template の semver（初版 `"0.5.0"`）。テンプレート変更時は版とハッシュを更新し、版ごとの目録ハッシュの対応もテストで固定する。許容差分（要件 §6.2）の追加でも同じで、R6（エンコーダ選択）を入れた版は `0.5.3` である。目録は job-template 全ファイルの `/` 区切り相対パスと本文 SHA-256 をパスのコード単位順で並べた `{path, sha256}[]` の JSON.stringify＋末尾 LF（UTF-8）とし、その SHA-256 を使う。
- generator は schema_version の直後に挿入し、内部キー順は name・version・template_version。値は `"shin-motionmaker"`・PACKAGE_VERSION・TEMPLATE_VERSION。allowed-diffs.json の R2 に位置を記録し、JT-11 は generator.version・generator.template_version の値を正規化して照合する。GUI の version.json も同じ版を使い、version・template_version を出力する（commit・built_at だけはビルド時に決める）。
- JSON のハッシュは実ファイルの UTF-8 バイト（末尾 LF を含む）の SHA-256。object を再シリアライズしたハッシュで代用しない。ZIP の圧縮バイトや日時は一致条件に含めず、展開パスと各本文のバイトを一致させる。

### フォーム型の契約

次は原典の型そのものであり、M1 でキー・列挙値を変更しない。

```ts
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

type ModeSettings = Pick<MotionForm,
  "design" | "instructions" | "fullScreen" | "biimUsage" | "voiceEngine"
  | "generateAudio" | "characterUsage" | "allowWebResearch" | "evidencePolicy">;
```

## 2. core 公開 API（M1 所有）

core は Node・DOM を import せず、ファイル・ネットワーク・プロセスに触れない。`Blob` はデータとして受け取って arrayBuffer を読むだけ。共通型は `types.ts`、公開再 export は `index.ts` に置く。原典 `job.ts`・`mv-assist.ts`・`explainer-assist.ts` の export は型も含めすべて同じ名前で index.ts から export する（directionAxes、explainerAxes、explainerAxesForContext、explainerStyles、assetBrief、mvDesign、mvInstructions、GhostCheck* 等も含む）。補助型の本体・返却構造は原典を維持する。StyleMode は二重定義せず、原典どおり caption-capacity.mjs から再 export する。core が参照してよい job-template のファイルは `runtime/scripts/caption-capacity.mjs` とその型宣言 `caption-capacity.d.mts` だけ。AR-03 のテストもこの例外だけを許し、両ファイルを配布物の files に含める。

| モジュール | 原典 | 公開名・役割 |
| --- | --- | --- |
| `form.ts` | job.ts の型・defaults・switch 関数・characterProfiles | フォーム型、既定値、Aivis プリセット、モード切替と配置 |
| `request.ts` | generate-job.ts L44〜115、job.ts validateForm | 入力検査の唯一の入口 `validateRequest`、既存 `validateForm` |
| `project.ts` | job.ts createProject・createBiimFrame | project と枠 SVG の生成 |
| `brief.ts` | job.ts createBrief・関連内部関数 | `createBrief` を主名のまま維持。ZIP 固有の追記は job-files.ts の内部関数 |
| `prompt.ts` | job.ts agentPromptFor | 依頼文（原典名を維持） |
| `job-files.ts` | job.ts generateJob の ZIP 前処理 | `buildJobFiles`。テンプレートを引数に取る |
| `zip.ts` | job.ts generateJob の ZIP 処理 | `zipJobFiles`、互換 `generateJob` |
| `assist/mv-assist.ts` | mv-assist.ts | 軸、候補、整形、歌詞統計、失敗チェックリスト |
| `assist/explainer-assist.ts` | explainer-assist.ts | 様式、軸、候補、整形、台本統計、23項目の助言 |
| `reports.ts` | job.ts parseGhostCheckReport・ghostCheckVerdict | 原典形式の読取と新しい検査結果 JSON の読取 |
| `data/` | biim-standard.json・font-assets.json | 値を変更せず移す |
| `mime.ts` | generate-job.ts L16〜42 | `mimeTypeFor(name)`。原典 CLI の拡張子表をそのまま移す |

```ts
const defaults: MotionForm;
const aivisPresets: Record<string, { styleId: number; label: string }>;
const explainerDesignDefaults: Record<StyleMode, string>;
function aivisStyleLabel(styleId: number): string;
function switchVideoMode(form: MotionForm, mode: VideoMode, saved?: ModeSettings): MotionForm;
function switchStyleMode(form: MotionForm, mode: StyleMode): MotionForm;
function modeSettingsFor(form: MotionForm): ModeSettings;
function characterProfiles(form: MotionForm): CharacterForm[];
function usesFullScreen(form: MotionForm): boolean;
function safeName(value: string): string;
function uniqueNames(files: Pick<Attachment, "name">[]): string[];
function urlLines(text: string): string[];
function mimeTypeFor(name: string): string;

type RequestCheck = { phase: "shape" } | { phase: "complete"; assets: JobAssets };
function validateRequest(input: unknown, check: RequestCheck): Validation<NormalizedRequest>;
function validateForm(form: MotionForm, assets?: JobAssets): string[];
function createProject(form: MotionForm, assets: JobAssets): Project;
function createBiimFrame(subtitleFrame: number[]): string;
function createBrief(form: MotionForm, assets: JobAssets): string;
function agentPromptFor(mode: VideoMode, styleMode?: StyleMode): string;
function buildJobFiles(form: MotionForm, assets: JobAssets, templates: TemplateFiles): Promise<BuiltJob>;
function zipJobFiles(job: BuiltJob, progress?: (percent: number) => void): Promise<{
  filename: string; data: Uint8Array;
}>;
function generateJob(form: MotionForm, assets: JobAssets, templates: TemplateFiles,
  progress?: (percent: number) => void): Promise<{ filename: string; data: Uint8Array }>;

function directionCandidates(seed?: number, count?: number): DirectionCandidate[];
function explainerCandidates(seed?: number, count?: number, context?: ExplainerContext): ExplainerCandidate[];
function candidatesFor(input: {
  mode: VideoMode; seed?: number; count?: number;
  characters?: "solo" | "duo" | "none"; orientation?: "landscape" | "portrait";
}): CandidatesResult;
function formatCandidate(candidate: DirectionCandidate): string;
function formatExplainerCandidate(candidate: ExplainerCandidate): string;
function lyricStats(text: string, longLine?: number): LyricStats;
function scriptStats(text: string, options: ScriptStatsOptions): ScriptStats;
const mvQualityChecklist: readonly string[];
const explainerQualityChecklist: readonly string[];

function parseGhostCheckReport(text: string): GhostCheckSummary | null;
function ghostCheckVerdict(summary: GhostCheckSummary): string;
type Inspection = {
  kind: "validate" | "qc" | "ghost-check" | "imagegen";
  raw: JsonObject; verdict?: Verdict; advisories: Advisory[];
};
function parseInspectionReport(kind: Inspection["kind"], text: string): Validation<Inspection>;
```

`validateRequest` の shape は未知キー・オブジェクト・型・有限数・assets のパス型と、原典 `validateForm` が検査する既存の列挙値を検査し、defaults と secondCharacter を合成する。列挙検査の条件も原典に合わせ、MV では styleMode・キャラクターの位置を検査せず、解説では1人目の位置と duo のときだけ2人目の位置を検査する。省略されたモード・人数には defaults を使う。入力スキーマも同じ条件を表す。未使用の項目でも型・未知キーは検査する。complete は同じ検査を通り、解決済み assets で原典の `validateForm` を呼ぶ。host は shape → パス検査と添付読取 → complete、GUI も同じ関数の complete を必ず通る。入力スキーマや検査を入口にコピーしない。構造・対象の列挙値の不正は `E_INPUT_INVALID`、原典 validateForm の文言は `E_FORM_INVALID` の details にそのまま入れる。パスの実体・ファイル有無は host の責務。MV の尺補完（CL-03）は host の complete 前に行う。

buildJobFiles は validateForm とテンプレート必須ファイルの検査を維持し、原典 generateJob と同じ本文を組み立てる。例外は SmmError に揃え、フォーム不正は E_FORM_INVALID、テンプレート不足は E_INTERNAL とする。`createBrief` の返却文字列と ZIP に含む brief（原典 generateJob の追記を含む）を混同しない。UTF-8、project の2空白インデント＋末尾 LF、入力歌詞・outline の改行を含む原文を維持する。ZIP 名は `<safeName(title)>-motion-job.zip`、ルートは safeName(title)。R1〜R6 以外の本文変更は禁止。

mimeTypeFor は拡張子を小文字にして原典 CLI の表を引き、未知なら application/octet-stream。host と GUI は必ずこれで Attachment.type を決め、ブラウザの File.type は使わない。これは AR-06 を満たすための契約上の決定であり、要件の改訂ではない。job-template と基線生成物は原典 CLI と同じ値になる。JT-11 の explainer-attachments は .md・.csv・.pdf・.png を含む。AR-06 の音源尺一致テストでは musicDurationSec を request に明示する（host 計測とブラウザ計測の小数差を持ち込まない）。

候補 count の既定は3、入口では整数1〜20、seed は有限の安全な整数を受け付ける。seed 省略時は core 内で `globalThis.crypto.getRandomValues` により毎回 seed を作る（固定値にしない）。明示 seed の演算と結果は原典のまま。候補はたたき台であり固定の正解ではない。呼出結果をフォームへ自動適用せず、合否・スコア・順位を付けない。character/context の入力は既存の人数・向きを写すだけで新たな創造列挙値ではない。

操作の結果には実際に使った seed を返す。省略時も乱数 seed の作成と候補生成を core の共通入口で行い、同じ値を返す。解説の文脈は characters:none → characterUsage:"none"、solo/duo → characterMode、orientation:portrait → width:1080,height:1920、landscape → width:1920,height:1080。axes は explainerAxesForContext(context)。MV は characters・orientation を受け付けて無視し、その旨を結果の notes に書く。MV の axes は directionAxes。

stats の kind:script で request があれば validateRequest の shape を通し、添付は読まず `createProject(form, {sources: []})` 相当で前提を導く。キャラクターの有無は form から決める。request が無ければ defaults を使う。speed は GUI と同じく voiceSpeed が有限かつ正ならその値、そうでなければ1とする。

parseInspectionReport は形式を読み取り、検査を再実装しない。ghost の件数・原典 ghostCheckVerdict の文言は助言であり、Inspection.verdict に変換しない。QC は原典の verdict、validate はジョブの出力（R4）を使う。原典0.4の validate は host が終了コードと stdout から結果を構成する。

QC の advisories[{id, scope, detail, scene_ids}] は `{id, source:"qc", message:detail, details:{scope, scene_ids}}` に写す。ghost の件数は `{id:"ghost-count", source:"ghost-check", message:件数の説明}`。imagegen の SKIPPED、validate の SKIP 行・GHOST 行も advisories へ写す。封筒の advisories は Inspection.advisories と同じものを使い、助言から verdict を作らない。

## 3. host 公開 API（M2a 所有）

host の `operations.ts` に入力スキーマ・日本語説明・ハンドラー・種別・許可フラグ・CLI/MCP対応を1つだけ置く。CLI と MCP は表から登録する。入力オプションは §4 に列挙したものだけを変換し、任意コマンドや任意引数の通過口を置かない。

```ts
type HostContext = {
  root: string;
  restrictToRoot: boolean;
  requestDirectory: string;
  allowDirs: readonly string[];
  allowEngineHosts: readonly string[];
  readOnly: boolean; enableGeneration: boolean;
  startedBy: "cli" | "mcp";
};
type OperationDefinition<K extends OperationId> = {
  id: K; cli: readonly string[]; mcp: string | null;
  kind: "read" | "write" | "run";
  inputSchema: JsonObject; description: string;
  exposedInReadOnly: boolean; enableGeneration: boolean;
  defaultWaitMs: number | null;
  timeoutMs: number | ((input: OperationInputs[K]) => number) | null;
  handle: (context: HostContext, input: OperationInputs[K]) => Promise<Envelope<OperationResults[K]>>;
};
const operations: readonly OperationDefinition<OperationId>[];
function execute<K extends OperationId>(context: HostContext, id: K,
  input: OperationInputs[K]): Promise<Envelope<OperationResults[K]>>;

function loadTemplates(): Promise<TemplateFiles>;
function readRequest(file: string, context: HostContext): Promise<{
  request: NormalizedRequest; assets: JobAssets;
}>;
function resolveAllowedPath(context: HostContext, relative: string,
  purpose: "read" | "write" | "attachment"): Promise<string>;
function writeJob(context: HostContext, job: BuiltJob, out: string,
  format: "dir" | "zip"): Promise<GenerateResult>;
function startRun<K extends RunKind>(context: HostContext, kind: K,
  input: OperationInputs[K]): Promise<Run>;
function getRun(context: HostContext, input: RunGetInput): Promise<Envelope<RunGetResult>>;
function listRuns(context: HostContext, job: string): Promise<Run[]>;
function cancelRun(context: HostContext, job: string, runId: string): Promise<Run>;
function readRunLog(job: string, runId: string, stream: "stdout" | "stderr",
  offset: number): Promise<{ text: string; next_offset: number }>;
function hasRuntimeDependencies(job: string): Promise<boolean>;
function acquireJobLock(context: HostContext, job: string, owner: string): Promise<{
  release(): Promise<void>;
}>;
function doctor(context: HostContext, job?: string): Promise<DoctorResult>;
function getProject(context: HostContext, job: string, pointer?: string): Promise<ProjectGetResult>;
function patchProject(context: HostContext, input: ProjectPatchInput): Promise<{ sha256: Sha256 }>;
function deriveJobStatus(context: HostContext, job: string): Promise<JobStatus>;
function getReport(context: HostContext, job: string, relative: string): Promise<ReportResult>;
```

`OperationId` は §4 の ID の和集合、`RunKind` は run 行の ID の和集合。`OperationInputs` はその行の入力型の対応表、`OperationResults` は §5 の対応表。CLI専用行は MCP 登録対象から除く。例外は execute が SmmError に正規化して封筒へ入れる。低水準関数は失敗を SmmError として投げてよい。

- loadTemplates は原典の Vite glob と同じ dot entries・node_modules の除外を行い、テキストを UTF-8、フォントを Uint8Array として読む。字体のファイル名・ハッシュは core/data/font-assets.json の1定義を使う。
- CLI の入力は BOM を除去して JSON.parse する。CLI は root=process.cwd()、restrictToRoot=false。添付は request ファイルの親から解決し、利用者指定パスは絶対・相対を許す。MCP は root=--root、restrictToRoot=true。inline request の添付は root 相対で解決する。ただし request.assets に限り、実体（realpath）が allowDirs 内の絶対パスを許す。それ以外の MCP 入力は root 相対だけで、`..`・絶対パスを拒否する。返す表示用パスは DisplayPath。Context の絶対パスを MCP 出力へ流さない。core へ渡す Attachment の name はファイル名だけ、type は mimeTypeFor(name) で決める。
- MCP のパスは実体（symlink・junction）と未作成の親を解決し root 内か検査する。allowDirs は添付の読取だけに適用し、出力・ジョブ・report の root 制限を緩めない。入口の文字列検査だけで済ませない。読取・書込直前にも実体を確認する。
- out は出力先の親ディレクトリ。dir は `<out>/<rootName>/`、zip は `<out>/<filename>` を新規作成する。dry_run は書き込まず project・検査結果・依頼文を返す。対象が存在すれば `E_OUTPUT_EXISTS`、全パス検査前に本文を作成しない。親を作成後、目的のフォルダまたは ZIP を排他的に予約する。zip のための中間ジョブフォルダは不要。
- ジョブ内スクリプトは `<job>/runtime` を cwd とし process.execPath＋配列引数＋shell:false で直接起動する。setup はジョブルートで npm の JavaScript entry を node から起動し、lock があれば ci、なければ install。npm.cmd を shell 経由で起動しない。依存を要求するのは validate・render・double_render 付き ghost_check だけ。hasRuntimeDependencies は `<job>/runtime` から @remotion/cli/package.json と typescript/bin/tsc の両方を resolve できるか判定し、事前検査・status・doctor が共有する。未導入なら実行前に E_DEPS_MISSING。render はブラウザの有無で事前拒否せず、doctor の報告だけに留める。
- ジョブ内スクリプトの環境変数は、起動元（CLI のプロセス、MCP サーバーのプロセス）の環境をそのまま継承する（spawn に env を渡さない）。host は `MOTION_JOB_ENCODER`（要件 JT-15）を含むジョブ内スクリプト向けの環境変数を解釈・追加・削除しない。エンコーダの選択と `[encoder]` 行はジョブ内の `runtime/scripts/encoder.mjs` だけが扱い、操作定義表・入力スキーマ・run・封筒に項目を足さない（要件 JT-14・JT-19）。MCP サーバーの環境はクライアントの登録で決まる（docs/MCP.md）。
- run の全種別・project_patch・CLI の studio は同じジョブ排他を取る。排他予約は原子的に行い `E_BUSY` に所有 run ID（studio・patch は所有操作）を入れる。read 系は設定の写しを持たない。依存不足・E_BUSY・E_DISABLED 等の事前検査失敗では run を作らず、台帳も残さない。
- project_get は実バイトの SHA-256 を内容と返す。pointer は RFC 6901。patch は JSON Merge Patch（RFC 7396）。現在 hash の不一致は E_CONFLICT。結果が object、schema_version・mode・generator の不変だけを検査する。一時ファイル＋rename で置換する。場面の質や構造を検査しない。
- report は reports/・plan/ 配下、brief.md・AGENTS.md・README.md、output/ 直下の PNG、および seedance/out/ 直下の PNG・JSON（SEEDANCE-Q4、§12）だけ。テキストの拡張子は .md・.json・.txt・.csv、画像は .png（reports/ghost-stills/ も含む）。それ以外は E_PATH_DENIED。text は UTF-8 を256 KiBまで読んで文字境界で切り詰め truncated を返す。PNG は CLI では8 MiBまで、超過は E_INPUT_INVALID（hint 付き）。MCP（restrictToRoot）は6 MiBまで、超過は E_INPUT_INVALID と CLI の smm report または縮小を案内する hint を返し、接続を継続する。PNG は bytes と MIME を host 内で返し、MCP の画像ブロックと CLI の base64 に変換する。設定・認証情報の任意読取口を作らない。
- doctor は Node・npm・依存・ffmpeg（FFMPEG_PATH→PATH→Remotion compositor）・ブラウザ・必要な Aivis 接続と Style ID・必要な Codex・空き容量を報告するだけ。自動導入しない。MCP の voice は非 loopback 接続を allowEngineHosts で明示許可された host に限る。MCP の doctor の Aivis 疎通も同じ許可に従い、未許可のホストへ接続せず「未確認」と報告する。CLI の voice・doctor は明示呼び出しを接続の許可とみなす。
- readRunLog の offset・next_offset は UTF-8 ログのバイト位置（0開始）。不完全な末尾文字は次回へ残し、text と next_offset が対応するように読む。CLI の前面待ちはこれで stdout/stderr の差分を標準エラーへ欠落・重複なく流す。MCP の run_get は log_tail のままとし、log_offset は追加しない。

## 4. 操作定義表（AR-05）

入力名は共通の snake_case。CLI は対応する kebab-case オプションに変換する。すべての操作の外側の入力は additionalProperties:false。form は既存の自由記述、patch と既存 JSON 本文は任意キーを許す明示的な型とする。`job` は必須と記した行ではジョブフォルダへの利用者指定パス（CLI は cwd 基準、MCP は root 相対）。wait_ms は全 run と run_get で整数0〜50,000、log_tail は整数0〜2,000（既定100行）。表の上限はプロセスの実行時間であり、1呼出の待ち時間とは別である。

入力スキーマには全 run の wait_ms の default を載せる。validate は final 省略時の45,000を基本とし、final:true の分岐には0を記す。default は注釈であり、実際の省略値は host の共通 defaultWait が決める。

| ID | CLI | MCP | 種別 | 入力の要旨 | read-only 公開 | enable-generation | 既定 wait_ms | 上限 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| generate | generate | job_generate | 同期・書込 | request:Request, out:string, format?:dir/zip=dir, dry_run?:boolean=false | しない | 不要 | — | — |
| candidates | candidates | direction_candidates | 同期・読取 | mode:VideoMode, seed?:integer, count?:integer=3, characters?:solo/duo/none=solo, orientation?:landscape/portrait=landscape | する | 不要 | — | — |
| stats | stats | text_stats | 同期・読取 | kind:lyrics/script, text:string, request?:Request（scriptのproject設定） | する | 不要 | — | — |
| status | status | job_status | 同期・読取 | job | する | 不要 | — | — |
| project_get | project get | project_get | 同期・読取 | job, pointer?:string | する | 不要 | — | — |
| project_patch | project patch | project_patch | 同期・書込 | job, patch:JsonValue, expect_sha256:Sha256 | しない | 不要 | — | — |
| report | report | report_get | 同期・読取 | job, path:string | する | 不要 | — | — |
| setup | setup | job_setup | run | job, wait_ms? | しない | 不要 | 0 | 1,800,000 |
| validate | validate | job_validate | run | job, final?:boolean=false, double_render?:boolean=false, wait_ms? | しない | 不要 | final=false:45,000 / true:0 | 7,200,000 |
| qc | qc | job_qc | run | job, stage:pre/post, wait_ms? | しない | 不要 | 45,000 | 300,000 |
| ghost_check | ghost-check | job_ghost_check | run | job, target?:preview/final=final, video?:string, double_render?:boolean=false, keep?:boolean=false, no_stills?:boolean=false, max_stills?:integer, tile_threshold?:number, min_tiles?:integer, wait_ms? | しない | 不要 | 0 | 7,200,000 |
| render | render | job_render | run | job, target:preview/final/still, frame?:integer（0以上、stillのみ）, wait_ms? | しない | 不要 | 0 | 7,200,000 |
| voice | voice | job_voice | run | job, wait_ms?（原典に追加オプションなし） | しない | 不要 | 0 | 3,600,000 |
| sound | sound | job_sound | run | job, wait_ms?（原典に追加オプションなし） | しない | 不要 | 45,000 | 300,000 |
| imagegen | imagegen | job_imagegen | run | job, name:string, prompt?:string, prompt_file?:string, kind?:string, refs?:string[], style?:string, size?:string, timeout?:number=900秒, force?:boolean=false, dry_run?:boolean=false, strict?:boolean=false, wait_ms? | しない | 必要 | 0 | timeout × 1000 + 300,000 |
| run_get | runs get / runs wait / runs logs | run_get | 同期・読取 | job, run_id:string, wait_ms?:integer=0, log_tail?:integer=100 | する | 不要 | 0 | — |
| run_list | runs list | run_list | 同期・読取 | job | する | 不要 | — | — |
| run_cancel | runs cancel | run_cancel | 同期・書込 | job, run_id:string | しない | 不要 | — | — |
| doctor | doctor | doctor | 同期・読取 | job?:string | する | 不要 | — | — |
| schema | schema | schema_get | 同期・読取 | name?:string（省略時一覧） | する | 不要 | — | — |
| studio | studio | — | CLI対話 | job（人が Remotion Studio を使う。stdio ツールにしない） | — | 不要 | — | — |
| mcp_serve | mcp serve | — | CLI常駐 | root, allow-dir[], read-only, enable-generation, allow-engine-host[]（サーバー自身の起動） | — | 不要 | — | — |
| version | version | — | CLI同期・読取 | なし（MCP では初期化応答の serverInfo が版を返す） | — | 不要 | — | — |
| seedance_create | seedance create | seedance_create | 同期・書込 | job, shot_id:string, prompt:string, model?:string=seedance-2-0-mini, mode?:text/image/reference=text, first_frame?:string, last_frame?:string, reference_images?:string[], reference_videos?:string[], reference_audios?:string[], resolution?:480p/720p/1080p/4k=720p, ratio?:16:9/4:3/1:1/3:4/9:16/21:9/adaptive=16:9, duration?:integer 1〜15=5, seed?:integer -1〜4294967295, generate_audio?:boolean=false, watermark?:boolean=false, wait_ms?:integer 0〜50,000=45,000, force?:boolean=false（§12） | しない | 必要 | 45,000（操作内の待機。run ではない） | — |
| seedance_status | seedance status | seedance_status | 同期・書込 | job, task_id?:string, shot_id?:string（どちらか一方が必須）, wait_ms?:integer 0〜50,000=0（成功済みで未保存なら保存する。§12） | しない | 不要 | 0（操作内の待機。run ではない） | — |
| seedance_list | seedance list | seedance_list | 同期・読取 | job（§12） | する | 不要 | — | — |

- CLI generate は request ファイルを読み込んで共通 request にする。--zip は format:zip、--dry-run は dry_run:true。stats の file も host が text に変換する。run 系は --detach がなければ共通 run_get を繰り返して完了まで待つ。runs wait は同じ操作を50秒以下ずつ繰り返し、前面待ちと同じく終端 run.exit_code（CL-07）で終了する。runs get/list/logs は取得成功なら0、logs は wait_ms:0。--detach は開始成功なら0。
- read-only は結果として書かない run を推測せず、すべての run を非公開にする。generate の dry_run も同じ書込操作なので非公開。無効操作を直接呼ばれた場合は E_DISABLED。imagegen の enable-generation は MCP の公開条件であり、CLI の明示 imagegen 呼出を認可とする。
- ghost_check の video は job 内の output/ 下に限定。max_stills・tile_threshold・min_tiles は原典既定を保持し、それぞれ有限の0以上整数・0以上数・1以上整数。上限は原典の検査を保つ。原典にない場面操作や表現規則は足さない。
- imagegen の kind は原典の background・transparent・character-sheet・motion・texture・prop をそのまま使う（新設しない）。prompt または prompt_file が必要。refs は CLI の --ref の繰返しに対応する。prompt_file/style は plan/・sources/、refs は assets/・sources/ に限定し、root の安全検査も行う。timeout は0超〜1,800秒。任意の Codex フラグを受け付けない。
- win32 の imagegen は refs とジョブルートの実パスに `%`・`"`・改行（CR/LF）があれば host が実行前に E_PATH_DENIED と hint（該当文字のない場所へ移す）で拒否する。CL-11 は host の起動を縛り、原典 imagegen.mjs の内側の shell 使用・本文は D-10 に従い変えない。
- スクリプト対応: validate→validate.mjs、qc→qc.mjs、ghost_check→ghost-check.mjs、render→run.mjs（preview→preview、final→build、still→still）、voice→aivis.mjs、sound→sound-design.mjs、imagegen→imagegen.mjs。studio は run.mjs studio を前面で起動する。
- コマンド名 command は通常 CLI の主名（ghost-check 等）、project と runs は空白を含む完全名（project get、runs get 等）。MCP も対応 CLI 名を返す。run_get の alias は command を各 alias 名にするが result は共通である。

### スクリプト argv のひな形

以下は process.execPath に渡す配列。角括弧内の任意要素は指定されたときだけ追加し、boolean は true のときだけフラグを付ける。パスは host が安全検査後にスクリプトの基準へ変換する。シェルのクォートを配列要素へ加えない。

| 操作 | argv（cwd は setup 以外 runtime） |
| --- | --- |
| setup | `[npmJavaScriptEntry, lock ? "ci" : "install"]`（cwd はジョブルート） |
| validate | `["scripts/validate.mjs", 任意"--final", 任意"--double-render"]` |
| qc | `["scripts/qc.mjs", "--stage=<stage>"]` |
| ghost_check | `["scripts/ghost-check.mjs", "--target=<target>", 任意"--video=<path>", 任意"--double-render", 任意"--keep", 任意"--no-stills", 任意"--max-stills=<N>", 任意"--tile-threshold=<N>", 任意"--min-tiles=<N>"]` |
| render | `["scripts/run.mjs", target が final なら "build"、他は target, still で frame 指定時 "--frame=<N>"]` |
| voice | `["scripts/aivis.mjs"]` |
| sound | `["scripts/sound-design.mjs"]` |
| imagegen | `["scripts/imagegen.mjs", "--name", name, 任意"--prompt", prompt, 任意"--prompt-file", path, 任意"--kind", kind, 各refごと"--ref", path, 任意"--style", path, 任意"--size", size, "--timeout", String(timeout), 任意"--force", 任意"--dry-run", 任意"--strict"]` |
| studio | `["scripts/run.mjs", "studio"]` |

ghost_check の値に `=` が含まれる場合は E_INPUT_INVALID で拒否する（原典の split("=") による値の切断を避ける）。任意の argv を追加する口は設けない。

## 5. 結果と封筒（M2a、CLI整形 M2b、MCP M3）

```ts
type ErrorCode = "E_USAGE" | "E_INPUT_INVALID" | "E_FORM_INVALID" | "E_PATH_DENIED"
  | "E_JOB_NOT_FOUND" | "E_NOT_A_JOB" | "E_OUTPUT_EXISTS" | "E_DEPS_MISSING"
  | "E_TOOL_MISSING" | "E_ENGINE_UNREACHABLE" | "E_BUSY" | "E_CONFLICT"
  | "E_RUN_NOT_FOUND" | "E_RUN_LOST" | "E_TIMEOUT" | "E_DISABLED" | "E_INTERNAL";
type SmmError = { code: ErrorCode; message: string; hint: string; details?: JsonValue };
type Envelope<T> = {
  schema: "smm.envelope/1"; command: string; job?: DisplayPath;
} & (
  | { ok: true; result: T; advisories: Advisory[]; warnings: Warning[]; run?: Run }
  | { ok: false; error: SmmError; run?: Run }
);
type GenerateResult = {
  job: DisplayPath | null; archive: DisplayPath | null; dry_run: boolean;
  file_count: number; project: Project; project_sha256: Sha256; agent_prompt: string;
};
type CandidatesResult = {
  message: string; seed: number; notes: string[];
  candidates: (DirectionCandidate | ExplainerCandidate)[];
  axes: DirectionAxis[]; formatted: string[];
};
type ProjectGetResult = { project: JsonValue; sha256: Sha256; pointer?: string };
type ProjectPatchInput = { job: string; patch: JsonValue; expect_sha256: Sha256 };
type ReportResult = {
  path: JobPath; mime_type: string; truncated: boolean;
} & ({ text: string } | { data: Uint8Array });
type CheckResult = {
  verdict?: Verdict; report: JsonObject | null; artifacts: JobPath[];
};
```

| 操作 | result |
| --- | --- |
| generate | GenerateResult（dry_run は job・archive が null） |
| candidates | CandidatesResult。message は「たたき台であり固定の正解ではない」を含む |
| stats | 原典 LyricStats または ScriptStats（各フィールドを変更しない） |
| status | JobStatus |
| project_get / project_patch | ProjectGetResult / `{sha256}` |
| report | ReportResult。CLI の data は base64 文字列にし encoding:base64 を加える。MCP の画像は下記のメタデータ表現にする |
| run 系の開始 | 終了後は CheckResult そのもの、走行中は null。run 情報は封筒の run だけに置く |
| run_get | RunGetResult。CheckResult のフィールドを平らに置き、ログ末尾も付ける。run 情報は封筒の run だけに置く |
| run_list | `{runs:Run[]}` |
| run_cancel | null。取り消し後の run は封筒の run に置く |
| doctor | `{checks:{id:string, available:boolean, message:string, details?:JsonValue}[]}` |
| schema | `{name:string, schema:JsonObject}` または `{schemas:{name:string,file:string}[]}` |
| version | `{version:string, commit:string|null, template_version:string}` |

封筒の advisory/warning/message/hint は日本語。主観的助言は ok・verdict・終了コード・MCP isError を変えない。QC fail は ok:true。MCP は同じ封筒を structuredContent と先頭 text ブロックへ入れる。report の PNG は、その両方の result を `{path, mime_type:"image/png", truncated:false, data:null, bytes, sha256, delivered_as:"image"}` とする。bytes は元画像のバイト数、sha256 は元画像の小文字16進64桁。encoding は付けず、画像本体の base64 は後続 image ブロックだけに1回入れる。MCP の JSON 表現に Uint8Array を出さない。isError は ok:false と同値で、fail のみでは true にしない。CLI 標準出力は封筒1個（--human 時だけ人向け要約）。進捗・子の stdout/stderr は CLI 標準エラーまたは run ログへ流す。

run の開始要求は予約・起動できれば running の ok:true、result:null。wait_ms 内で終了し completed なら result に CheckResult を直接付けて ok:true（fail でも同じ）。どの操作でも合否は envelope.result.verdict で読める。終了まで待った開始操作が failed/cancelled/timed_out/lost を観測した場合は run と error を付けた ok:false。run_get/list/cancel 自体は台帳の取得・取り消しを実行できれば ok:true であり、過去 run の error は run の中に保持する。CLI の前面待ちと runs wait は終端 run.exit_code（CL-07）をプロセスの終了コードに使う。runs get/list/logs は取得成功なら0、--detach の開始成功も0。これにより非同期の状態取得と元操作の成否を混同しない。

## 6. run 台帳（smm.run/1）

```ts
type RunStatus = "running" | "completed" | "failed" | "cancelled" | "timed_out" | "lost";
type RunRecord = {
  schema: "smm.run/1"; id: string; kind: RunKind;
  args: JsonObject; status: RunStatus; exit_code: 0 | 1 | 2 | 3 | 4 | null;
  pid: number | null; script_pid: number | null;
  started_at: string; heartbeat_at: string; ended_at: string | null;
  progress: { ratio: number | null; text: string };
  artifacts: JobPath[]; started_by: "cli" | "mcp";
  result?: CheckResult; error?: SmmError; script_exit_code?: number | null;
};
type Run = RunRecord & { job: DisplayPath };
type RunGetInput = { job: string; run_id: string; wait_ms?: number; log_tail?: number };
type RunGetResult = {
  stdout_tail: string[]; stderr_tail: string[];
  verdict?: Verdict; report: JsonObject | null; artifacts: JobPath[];
};
```

保存先は `<job>/.smm/runs/<id>/{run.json,stdout.log,stderr.log}`。永続するのは RunRecord で job を書かず、読む側が DisplayPath の job を補って Run として返す。run.json 内（args・result・report のパスも含む）のパスはジョブ相対とする。ID は `r-<UTC YYYYMMDDTHHmmssZ>-<ランダム8桁hex>`、日時は ISO 8601 UTC、ログは UTF-8。CLI.md の例も8桁に揃える。args に復元用の秘密・絶対パスを入れない。exit_code は CL-07 の正規化値、元スクリプトの終了コードは script_exit_code に保存する。永続結果は result.verdict、封筒では envelope.result.verdict に分離する。run_get は走行中もログを返し、verdict なし・report:null・artifacts:[] とする。

- detached worker がプロセスとログ・台帳を所有し、CLI/MCP 終了後も継続する。pid は worker の pid、script_pid は実行する script（setup は npm）の pid を記録し、起動前は null。run.json は一時ファイル＋rename で更新する。
- heartbeat は5秒ごと。15秒以上古く、かつ pid のプロセスが存在しない場合だけ lost。生存確認が権限不足なら不在と断定しない。lost は E_RUN_LOST と終了コード4。重複実行を避けるため排他を確認し、古い予約は所有プロセス不在の確認後だけ解放する。
- 想定内のスクリプト終了は completed（ゲート fail でも completed）。起動失敗・予期しない終了は failed。cancelled・timed_out・lost は終端状態。終端状態から再実行状態へ戻さず、新しい run を開始する。
- cancel と上限超過は子孫を含むプロセスツリーを停止し、終了を確認してからロック解放。Windows でも親だけを止めない。cancelled は E_INTERNAL（details.reason:cancelled）・4、timed_out は E_TIMEOUT・4。既に終端なら cancel はそのままの run を返す。
- read-only の run_get/list は読み取り専用であり、lost の導出は返却値へ反映する。書き戻し・ロック清掃は worker または次回の書込操作が行う。
- MCP クライアントが進捗トークンを渡した場合、M3 は待機中に Run.progress を進捗通知へ写す（MC-15）。

## 7. ジョブ状態（smm.job-status/1）

```ts
type FileFact = { path: JobPath; exists: boolean; bytes: number | null; modified_at: string | null };
type CheckFact = { available: boolean; summary?: JsonObject } & (
  | { kind: "validate" | "qc-pre" | "qc-post"; verdict?: Verdict;
      review_mode?: string; has_waiver?: boolean; stale?: boolean }
  | { kind: "ghost-check" | "ghost-check-preview" }
);
type JobStatus = {
  job: { title: string; mode: VideoMode; style_mode: StyleMode | null;
    schema_version: string; generator: JsonObject | null };
  deps: { installed: boolean };
  records: FileFact[]; scenes: number; outputs: FileFact[];
  checks: CheckFact[];
  runs: Run[]; hints: { operation: OperationId; input: JsonObject; note: string }[];
};
```

毎回 project・plan・reports・output・run 台帳から導出し、設定や状態の複製を置かない。records のパスは以下で固定する（原典 validate --final と QC の preFiles・postFiles の制作記録。project・動画は専用項目で返す）。存在とサイズ・更新時刻を報告し、記録の合否を再判定しない。

| モード | records のパス |
| --- | --- |
| 共通 | plan/direction.md、plan/storyboard.md、plan/sources.md、reports/visual-qa.md、reports/delivery.md |
| MV の追加 | plan/music-analysis.md |
| 解説の追加 | plan/script.md、plan/explanation-map.md、plan/evidence.json、plan/narration.json、reports/qc-review.md、assets/audio/narration.json、reports/ghost-check-preview.json、reports/ghost-check.json |

outputs は output/preview.mp4・output/final.mp4。checks は validate・qc-pre・qc-post・ghost-check・ghost-check-preview の既存レポートの値を読み、QC の保存済み inputs のハッシュと現在の本文が異なる場合 stale:true。ghost の項目に verdict は置かず件数は summary に入れる。原典 ghostCheckVerdict の「要注意」等を verdict へ写さない。MV の QC は not_applicable、style_mode は null。style_mode の無い0.4解説は原典 effectiveStyleMode と同じ biim。generator の無い0.4は null。checks 内の既存検査結果以外に、状態全体の合否・スコア・順位を付けない。hints は入口に依存しない `{operation, input, note}` の助言で工程の実行順を強制しない。

## 8. 終了コードとスクリプトの対応（初版、M2b で実測固定）

CL-07 の0成功・1検査不合格・2入力・3環境・4内部を共有する。エラーコードとの対応は以下で固定する。

| 終了コード | エラーコード |
| --- | --- |
| 2 | E_USAGE, E_INPUT_INVALID, E_FORM_INVALID, E_PATH_DENIED, E_OUTPUT_EXISTS |
| 3 | E_JOB_NOT_FOUND, E_NOT_A_JOB, E_DEPS_MISSING, E_TOOL_MISSING, E_ENGINE_UNREACHABLE, E_BUSY, E_CONFLICT, E_RUN_NOT_FOUND, E_DISABLED |
| 4 | E_RUN_LOST, E_TIMEOUT, E_INTERNAL |

| 条件 | コードと details・hint |
| --- | --- |
| ジョブのパスが無い | E_JOB_NOT_FOUND |
| project.json が無い | E_NOT_A_JOB |
| project.json が壊れた JSON | E_NOT_A_JOB、details.reason:"invalid_json" |
| ghost-check・still の対象動画が無い | E_INPUT_INVALID、hint で先に render を促す |
| 入力の shape・型・未知キーの不正 | E_INPUT_INVALID、details は `{pointer, reason}[]`（pointer は JSON Pointer）、message・hint は日本語 |
| validateForm の不正 | E_FORM_INVALID、details は原典文言の配列 |
| buildJobFiles のテンプレート不足 | E_INTERNAL |
| 依存不足・排他・無効操作 | E_DEPS_MISSING・E_BUSY・E_DISABLED。事前検査で拒否し run・台帳を作らない |

report は更新時刻が run.started_at 以降のものだけ採用する。古い report を今回の結果へ転用しない。QC は終了コード0/1と report の verdict:pass/fail を突き合わせ、食い違いは E_INTERNAL。ghost-check も終了コードと新しい report の skipped の有無・走査完了結果を突き合わせ、食い違いは E_INTERNAL（ghost に verdict を追加しない）。

| 原典スクリプト | 原典の終了と根拠 | host の正規化 |
| --- | --- | --- |
| validate.mjs | check が収集した errors があれば1、なければ0（末尾）。prepare・project 読取等の外側の例外も Node が1を返し得る | 検査完了0→pass/0、検査完了1→fail/1。依存不足等を事前分類し、検査完了の証拠なしの異常は E_INTERNAL/4。R4 report があればそれを読む |
| qc.mjs | MV は検査せず0で report なし。QC pass=0、fail=1、catch は2（末尾） | MV→not_applicable/0。report 付き0/1は completed、verdictをそのまま使う。stage の入力ミスは実行前 E_INPUT_INVALID/2、先に job・依存を検査済みで未分類の読取例外等なら E_INTERNAL/4 |
| ghost-check.mjs | analyzeGhosts の skipped は1、catch は1。検出件数に関係なく走査成功は0 | 成功0→助言/0（verdictを作らない）。ツール不足は E_TOOL_MISSING/3、動画不足は E_INPUT_INVALID/2 の事前検査。分類できない1だけ E_INTERNAL/4。件数で不合格にしない |
| imagegen.mjs | skipped は既定0、strictかつskippedだけ1。引数不正・catchは1 | skipped既定は助言/0。strictの記録済みskippedはfail/1。入力不正は実行前E_INPUT_INVALID/2、パス不正はE_PATH_DENIED/2、未分類異常はE_INTERNAL/4。Codex不在を通常モードの環境失敗にしない |
| aivis.mjs | 合成成功0、catch 1。voice.engine none は何もせず成功 | noneは対象外/0。必要時に疎通不足E_ENGINE_UNREACHABLE/3。場面・台本入力不正はE_INPUT_INVALID/2、未分類異常はE_INTERNAL/4 |
| sound-design.mjs | 成功0、catch 1。MV・生成無効は生成せず成功 | 対象外/0または生成成功/0。planの不正はE_INPUT_INVALID/2、未分類異常はE_INTERNAL/4 |
| run.mjs | 不明mode=1、prepare/catch=1、子Remotionの終了コードをそのまま転送しnullは1 | 操作表から既知modeのみ渡す。依存不足は事前にE_DEPS_MISSING/3。ブラウザの有無で事前拒否しない。実行後のブラウザ・ffmpeg不足は証拠でE_TOOL_MISSING/3に分類。成功0、予期しない非0はE_INTERNAL/4 |
| setup（npm） | npm ci/install の0または非0 | 0成功。npm不在E_TOOL_MISSING/3、導入失敗E_INTERNAL/4 |

原典は同じ1に検査不合格と例外を混在させるため、単なる code===1 の判定だけで fail にしない。M2b は保存済みreport・完了stdout・事前検査の対応を実測でテストに固定する（ジョブ側の判定を host へ再実装しない）。元コードを変える必要が生じたら L2 へ差し戻す。0.4の validate は `OK` 行と末尾の成功文／errors 出力の原典形式から完了を識別する。

## 9. JSON Schema の名前と所有

`schemas/<name>.schema.json` の $id は `smm.<name>/1`。本文の schema フィールドは封筒と run で必須とし、入れ子の result に重ねて要求しない。既存 project・検査レポートの本文は R2/R4 以外変えず、schema 識別子を本文に強制追加しない。既存 kind・schema_version で形式を識別する。各 result 定義は共通 envelope の $defs または以下のスキーマから参照し、出力を無定義のままにしない。

| 名前 | ファイル | 所有・内容 |
| --- | --- | --- |
| smm.request/1 | request.schema.json | M2a（M1 validateRequest と defaults から共有する形を確定）。form と assets、未知キー拒否 |
| smm.project/1 | project.schema.json | M2a。原典0.4とR2の0.5を読み取る。変更の正否を新しいゲートにしない |
| smm.envelope/1 | envelope.schema.json | M2a。成功／失敗、全操作のresultの型、error.hint必須 |
| smm.run/1 | run.schema.json | M2a。台帳・状態・正規化exit_code |
| smm.job-status/1 | job-status.schema.json | M2a。§7 |
| smm.generate/1 | generate.schema.json | M2a。GenerateResult |
| smm.candidates/1 | candidates.schema.json | M2a。CandidatesResult |
| smm.text-stats/1 | text-stats.schema.json | M2a。lyrics/scriptの原典統計 |
| smm.project-result/1 | project-result.schema.json | M2a。get/patchの結果 |
| smm.report/1 | report.schema.json | M2a。取得したtext/base64・切詰め |
| smm.check/1 | check.schema.json | M2a。CheckResult、runの完了結果 |
| smm.validate/1 | validate.schema.json | M2a。R4のreports/validate.json、検査名・状態・メッセージ・助言 |
| smm.qc/1 | qc.schema.json | M2a。既存QC JSON（kind:biim-explainer-qc） |
| smm.ghost-check/1 | ghost-check.schema.json | M2a。既存ghost JSON（kind:biim-ghost-check） |
| smm.imagegen/1 | imagegen.schema.json | M2a。既存生成manifest・skipped理由 |
| smm.audio/1 | audio.schema.json | M2a。既存narration/sound-designの目録 |
| smm.doctor/1 | doctor.schema.json | M2a。DoctorResult |
| smm.schema-list/1 | schema-list.schema.json | M2a。schema一覧と取得結果 |
| smm.version/1 | version.schema.json | M2b。version結果 |
| smm.operation-inputs/1 | operation-inputs.schema.json | M2a。操作IDごとの閉じた入力スキーマ |

M3 は操作表から MCP tools/list の入力スキーマ・名前・日本語説明の snapshot を作る。別に入力検査を実装しない。GUI の request 読み込みも同じ validateRequest を通る。互換性を壊すスキーマ変更はメジャー番号を上げ、L2 が利用者の追随を調整する。

MCP は全ツールの outputSchema に封筒スキーマを宣言し、MC-06 の snapshot は outputSchema も含める。run スキーマは永続用 RunRecord と表示用 Run（job を補ったもの）を区別する。

### R4: reports/validate.json の形

```ts
type ValidateReport = {
  schema: "smm.validate/1";
  final: boolean;
  double_render: boolean;
  verdict: "pass" | "fail";
  checks: { name: string; status: "ok" | "error" | "skip"; message: string }[];
  advisories: { id: string; source: "validate"; message: string }[];
};
```

verdict は errors の有無だけから決める（なければ pass、あれば fail）。SKIP 行・GHOST 行は advisories にだけ入れ、checks に重複させず verdict に影響させない。status:skip は形式上許すが、原典の SKIP 行を checks に入れる根拠にはしない。日時など毎回変わる値は入れない。標準出力・終了コード・検査ロジックは変えない。M1 が出力を追加し、M2a・M4 はこの形を読む。

## 10. MCP SDK と依存

採用する公式 TypeScript SDK は `@modelcontextprotocol/sdk` **1.32.2** に固定する。2026-11-14 に `npm view @modelcontextprotocol/sdk version license dist.tarball --json` で最新1.32.2・MITを確認。`npm pack @modelcontextprotocol/sdk@1.32.2` の配布物 `package/LICENSE` を実際に読み、MITの許諾・著作権・無保証条項を確認した。M0 では依存を追加しない。M3 はこの版の stdio server/client で TS-04 を実測し、追加する推移依存も版と LICENSE を記録する。配布物はビルド済み JS（TypeScript strip 実行は開発だけ）。

## 11. 後続の確認点

M0R の指摘は M0b の L2 裁定に従い反映した。M0-Q1〜Q3 の回答は `docs/work/M0/QUESTIONS.md` に記録する。URL 行番号だけを正規化し、`${i + 1}人目` は1・2の具体文字列を列挙する。原典スクリプトの exit 1 は report の鮮度・終了コードの突き合わせと事前分類を前提に M2b で実測し、docs/CLI.md の対応表とテストで固定する。分類できない exit 1 だけを E_INTERNAL/4 とする。要件の黙示変更はしない。

## 12. Seedance（SEEDANCE）

§4 の seedance_create・seedance_status・seedance_list は、BytePlus ModelArk の Seedance API を独立した交換可能な動画生成バックエンドとして呼ぶ操作である（オーナー指示、SEEDANCE-Q1）。既存の操作・入力・既定値・エラーコードの列挙は変えない。実装は `src/host/seedance/`、設計の正本は `docs/work/SEEDANCE/DESIGN.md`（§11 が優先）、利用者向けの説明は [SEEDANCE](SEEDANCE.md)。モデル・既定値・見積りは助言であり、プロンプトは自由記述のまま候補に限定しない。生成物の主観的な質を合否にしない。

### 入出力の要旨

- CLI の位置引数はどれも `job`。run の仕組みは使わず、同期操作の中で上限時間（wait_ms）つきのポーリングを行い、途中の状態でもレコードを残して ok:true で返す。
- create の mode と content の対応は固定で、混在は E_INPUT_INVALID：text は素材なし、image は first_frame（必須）と last_frame（任意）、reference は reference_images・reference_videos・reference_audios（少なくとも1つ、モデルの参照上限以内）。素材はジョブ相対パス（`/` 区切り）または `https://`・`asset://` の URL。画像のローカルファイル（png/jpg/jpeg/webp、30 MiB 以下）は data URI で送り、動画・音声のローカルファイルは v1 では E_INPUT_INVALID。
- shot_id は `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$` のうち、Windows の予約名（CON・PRN・AUX・NUL・COM0〜9・LPT0〜9、大小無視）を除いたもの。出力のファイル名に使うため、API を呼ぶ前に E_INPUT_INVALID で拒否する。
- model は5つの別名またはモデル ID（seedance-2-5、seedance-2-5-flash、seedance-2-0、seedance-2-0-fast、seedance-2-0-mini）。表に無いもの、対応しない解像度、単価未登録の組み合わせ（seedance-2-5 の 4k）は E_INPUT_INVALID。
- force:true はキャッシュを見ずに新しいレコードを作る（同じ cache_key の既存レコードは残す）。
- create／status の result は `{ task: SeedanceTask, cached: boolean }`。助言は封筒の advisories（source:`seedance`）に入れる（DRY_RUN で opt-in が無いときの `seedance-opt-in-required-for-real` など）。
- list の result は `{ tasks: SeedanceTask[], summary: { count, by_status, dry_run, api_key_present, budget_usd, budget_scope: "job", real_spent_usd, reserved_usd, remaining_usd, mock_count } }`。
- doctor に `seedance` チェックを `disk` の直前に加える（既存チェックの順序・内容は変えない）。available は `ARK_API_KEY` の有無、details は `{ api_key_present, dry_run, models: 5, budget_usd, video_generation }`。キーの値は返さない。

### 環境変数

| 変数 | 既定 | 意味 |
| --- | --- | --- |
| `ARK_API_KEY` | なし | API キー。環境変数からだけ読み、レコード・サイドカー・封筒・エラー・ログ・advisory に値も断片も含めない |
| `SEEDANCE_DRY_RUN` | 未設定＝true | `false` または `0`（大小無視、前後空白無視）のときだけ false。呼び出しごとに評価する。true のときはモックを使いネットワークに出ない |
| `SEEDANCE_BUDGET_USD` | 10 | ジョブ単位の上限（USD）。0 以上の有限数でなければ作成を E_INPUT_INVALID で拒否する。ジョブをまたぐ上限は無い |
| `SEEDANCE_POLL_INTERVAL_MS` | 5000 | 実 API のポーリング間隔。1000 未満は 1000 |

### 接続先と公開

- 接続先は公式の固定ホスト `https://ark.ap-southeast.bytepluses.com/api/v3` で、環境変数でも入力でも変えない。音声エンジン用の `allow-engine-host` の対象外である。
- MCP の seedance_create は enable-generation があるときだけ公開する（DRY_RUN でも同じ。モードで公開の可否を変えない）。CLI の明示呼び出しは認可とみなす。seedance_status は書き込みがあるので read-only では公開しない。seedance_list は read-only でも公開する。
- 実 API（DRY_RUN=false）の作成には、①`ARK_API_KEY` がある、②`project.json` の `asset_generation.video_generation === true`、③予算内、の3つすべてが要る。欠けたら E_DISABLED（details.reason は `api_key_missing`・`video_generation_off`・`budget_exceeded`）で拒否し、台帳に何も書かない。予算の判定は DRY_RUN でも同じ計算をする（モックの記録は費用0）。

### エラー

エラーコードの列挙は増やさない。実 API の失敗は既存のコードに写し、`details.kind` で分類する。details に要求・応答のヘッダーを入れず、応答本文からは `error.code` と `error.message`（512 文字まで）だけを取る。

| details.kind | 条件 | code |
| --- | --- | --- |
| auth | 401、または認証系の 403 | E_DISABLED |
| activation | モデル未有効化・残高不足・アカウント系の応答 | E_DISABLED |
| rate_limit | 429 | E_BUSY |
| invalid | その他の 4xx | E_INPUT_INVALID |
| server | 5xx | E_ENGINE_UNREACHABLE |
| network | 応答なし（接続失敗・タイムアウト） | E_ENGINE_UNREACHABLE |

保存した MP4 が構造検査（ftyp・moov・mdat）に通らないときは、レコードの status を `error`、`details.kind` を `invalid_output` とする。安全の三重条件の拒否は `details.reason` で示す。作成（POST）のやり直しは 429・503 と送信前の接続エラーだけで、500・502・504 と送信後のタイムアウト・切断は status `unknown` で記録する（SEEDANCE-Q2）。

### tasks.json とサイドカーの形

`<job>/seedance/tasks.json`：

```ts
type SeedanceStatus = "creating" | "queued" | "running" | "succeeded" | "failed"
  | "cancelled" | "expired" | "unknown" | "error";
type SeedanceTask = {
  local_id: string;            // s-<UTC time>-<hex8>
  shot_id: string;
  task_id: string | null;      // mock- prefix in DRY_RUN
  dry_run: boolean;
  model: { alias: string; id: string };
  mode: "text" | "image" | "reference";
  prompt: string;
  inputs: { role: string; path?: JobPath; url?: string; url_sha256?: Sha256; sha256?: Sha256 }[];
  params: { resolution: string; ratio: string; duration: number; seed?: number;
    generate_audio: boolean; watermark: boolean };
  cache_key: Sha256; cached: boolean; status: SeedanceStatus;
  estimate_usd: number; estimate_tokens: number; estimate_basis: string;
  usage_tokens: number | null; actual_usd: number | null;
  output: JobPath | null; output_sha256: Sha256 | null;
  sidecar: JobPath | null; thumbnail: JobPath | null;
  error: SmmError | null; created_at: string; updated_at: string;
};
type SeedanceTasksFile = { schema: "smm.seedance-tasks/1"; tasks: SeedanceTask[] };
```

- 書き込みは `<job>/seedance/.lock`（排他作成、中身は `{pid}`、所有プロセスが存在しないロックだけを破棄）を取り、既存の原子的書き込みで置き換える。読取・予算集計・creating レコードの追記は同じロック区間で行う。
- 入力 URL はクエリとフラグメントを落として保存し、完全な URL の SHA-256 を `url_sha256` に併記する。応答の署名付き `content.video_url` は保存しない。
- 出力は `<job>/seedance/out/<出力名>.mp4`・`.json`（サイドカー）・`.png`（サムネイル、作れなければ null）。出力名は shot_id、同じ名前の MP4 が別の cache_key で既にあれば `<shot_id>-2`、`-3`… とし、既存の生成物を上書きしない。
- cache_key は `{backend: "mock"|"ark", model_id, mode, prompt, params, inputs[{role, sha256|url_sha256}]}` の正規化 JSON の SHA-256。同じキーの succeeded レコードがあり、MP4 が実在して SHA-256 が一致すれば API を呼ばず、元レコードの複製を `cached: true` で返す（新しいレコードは足さない）。
- reserved の計上は実 API の creating・queued・running・unknown の見積り。task_id の無い creating は所有プロセスが存在しないか10分を超えたら unknown に落とす。

サイドカー `<job>/seedance/out/<出力名>.json`：

```ts
type SeedanceOutput = {
  schema: "smm.seedance-output/1";
  shot_id: string; local_id: string; task_id: string | null; dry_run: boolean;
  model: { alias: string; id: string }; mode: string; prompt: string;
  inputs: SeedanceTask["inputs"]; params: SeedanceTask["params"];
  estimate_usd: number; usage_tokens: number | null; actual_usd: number | null;
  video: { path: JobPath; bytes: number; sha256: Sha256;
    duration_seconds: number | null; width: number | null; height: number | null };
  thumbnail: JobPath | null; generated_at: string;
};
```

video の値は保存した実ファイルを測ったもので、要求の解像度・長さとは限らない（モックは固定バイト）。プレビューの閲覧のため、report（MCP の report_get）の許可に `seedance/out/` 直下の `.png`・`.json` だけを加える（SEEDANCE-Q4 の決定。操作の追加・入力の変更はしない）。PNG は既存規則どおり画像ブロックで返し、MCP では6 MiB を超えると E_INPUT_INVALID。MP4 本体は report では返さず、パスだけを結果に含める。

上の型は DESIGN.md §8・§11 の項目を書き起こしたもので、各項目の null 可否と数値の範囲は操作定義表から生成する `schemas/` と食い違えば L2 が揃える。
