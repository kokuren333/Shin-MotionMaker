# Shin-MotionMaker 要件定義書（正本）

| 項目 | 内容 |
| --- | --- |
| 作成 | PM（Fable 5.2）、2026-11-14。本書は要件と設計だけを定める。実装と repo の初期化は含まない |
| 対象 | 新規 repo `kokuren333/Shin-MotionMaker`（Apache-2.0） |
| 継承元（以下「原典」） | BiimMotion（`kokuren333/BiimMotionWebUI`）コミット `262c798`。原典の repo には一切手を入れない |
| 参照 | CyberSprite `a00433c`（テーマ正本 `gui/src/theme/tokens.css` は `20f787d`、アイコン原本 `assets/ui/icons/` は `93a433f`）、MankoMIX `_handoff/RENOVATION_PACKET_V2.md` |
| 次の受け手 | L2 オーケストレーター（Opus 5.5 高）。§11 の分解は案であり、計画の確定は L2 が行う |

## 0. 読み方と実査範囲

- 要件には ID を付ける（`PH` 思想、`AR` アーキテクチャ、`CL` CLI、`MC` MCP、`JT` 生成ジョブ、`GU` GUI、`CI` CI と公開、`TS` テスト、`DC` 文書）。**MUST** は受け入れに必須、**SHOULD** は理由を記録すれば見送れる。
- 「決定」は PM が決めたもので、L2 は再検討しない。変えたい場合は `docs/work/<作業ID>/QUESTIONS.md` で差し戻す。一覧は §12。
- 原典の引用は `原典:<パス> <節または行>` と書く。行番号は `262c798` 時点のもの。
- この文書は repo に入るので、ローカルの絶対パスを書かない。参照 repo の所在は発注書（`_handoff/PROMPT_PM.md`）にある。

**実査したもの**：原典の `AGENTS.md` 全文、`job-template/AGENTS.md` 全文、`docs/requirements/2026-11-13-explainer-ui-harness.md` の §0〜§3.4 と決定一覧、Amendment 03、`docs/WORKFLOW.md` §1〜§3、`src/job.ts`（型・`validateForm`・`createProject`・`generateJob`・依頼文）、`src/templates.ts`、`tools/generate-job.ts` 全文、`tools/prepare-runtime-smoke.mjs`、`job-template/` の `package.json`・`runtime/package.json`・`runtime/scripts/{run,lib,validate}.mjs`、`README.md` の前半、`tests/` のテスト名全件と基線比較テスト、`.github/workflows/pages.yml`、`docs/DESIGN.md` の §2.1。CyberSprite の `tokens.css` 全文、`gui/public/icons/` の一覧、`docs/MCP.md`、`AGENTS.md` §5.1、`gui/scripts/build-icons.mjs`、Pages のワークフロー。

**実査していないもの**（L2 が M0 で確かめる）：

- 原典の `npm test` を実行していない。「81 テスト」は発注書の値で、実数とテスト名の一覧は M0 で採取する（JT-10）。
- 原典の `src/App.tsx`・`src/style.css` の本体。GUI の機能一覧は原典要件書 UI-11 と `docs/DESIGN.md` に依った。
- `qc.mjs`・`ghost-check.mjs`・`aivis.mjs`・`imagegen.mjs`・`sound-design.mjs` は、引数と終了コードの箇所だけを読んだ。
- Remotion のレンダー、Aivis、Codex imagegen の実機動作。MCP SDK の API（レジストリで版を照会しただけ）。CyberSprite の MCP 実装コード（文書だけを読んだ）。

## 1. 目的と非目的

### 1.1 目的

1. BiimMotion の制作ハーネスと生成コアを、思想を変えずに新 repo へ移す。
2. 人間用の GUI に加えて、**CLI と MCP を正式な入口にする**。3つの入口は同じコアを通り、同じ入力から同じジョブを作る。
3. 決定論の部分を「生成・検証・安全の床」に限定し、創造の判断を制作エージェントに残す構造を、入口が増えても保つ。
4. 原典で起きた公開事故（§8.1）の型を、規則と機械検査で防ぐ。

### 1.2 非目的

| # | やらないこと | 理由 |
| --- | --- | --- |
| N1 | 原典 repo（BiimMotionWebUI）の変更 | オーナー決定 |
| N2 | 制作原則・制作工程・ゲートの内容の変更。ghost-check の検出ロジック・しきい値・「検出件数は助言」の変更。MV への QC 規則の追加 | 原典の非目的 N1・N2・N10 を継承する（§2.1） |
| N3 | 場面を表す DSL、場面や演出を追加・編集する操作（Op）、演出の一覧から選ばせる必須入力 | 決定論カタログが創造の天井になる（§2.4） |
| N4 | 主観的な質の採点、スコア、それによる合否 | PH-03 |
| N5 | ジョブ内 npm スクリプトの廃止、CLI が無いと制作できないジョブ | ジョブは単体で完結する（§4.5） |
| N6 | 前作ジョブの複製、前作のスタイルを引き継ぐコマンド | 「前作・既定値の組み合わせを踏襲しない」（PH-06） |
| N7 | MCP の HTTP トランスポート、GUI とローカルサーバの連携（v0.1） | Q-03・Q-04 |
| N8 | Remotion・React・Three.js など、ジョブのランタイム依存の更新 | 原典と同じ版で移す。更新は別件 |
| N9 | Aivis・Codex・ffmpeg・ブラウザなど外部ツールの自動インストール | 原典:`job-template/AGENTS.md` L236・L364 |
| N10 | Muse スペース版（MV-E2E）との連携の実装 | Q-05 |

## 2. 継承する設計思想（交渉不可）

### 2.1 原典の所在

| 継承する条項 | 原典の所在 | 原文（抜粋） |
| --- | --- | --- |
| ハーネスは意図的に緩い | 原典:`AGENTS.md` §6（L71） | 「**制作ハーネスは意図的に緩く作ってある。** 原則を示し、フォーマット（構成・演出・様式・ファイルの書き方）は固定しない。モデルの能力を引き出し、作品が型にはまらないようにするためである。」 |
| ゲートの範囲 | 原典:`AGENTS.md` §6（L72）。同じ線引きが要件書 §2.6（L182）と決定 D4（L622）にある | 「**合否ゲートにするのは、客観的に判定できて、外すと視聴者に実害が出るものだけ**（誤情報、読めない字幕、切れる音声、未確認のままの納品、記録の欠落）。」 |
| 主観は助言 | 原典:`AGENTS.md` §6（L73） | 「**主観的な質**（面白さ、演出の巧拙、スロップ感、テンポ）は合否に入れず、**助言に留める**。」 |
| 締め付けの禁止 | 原典:`AGENTS.md` §6（L74）。ジョブ側は `job-template/AGENTS.md`「ゲートと助言の線引き」（L333） | 「**将来ハーネスを編集するエージェントは、この緩さを「改善」と称して締め付けてはならない。** 主観的な質の規則化、表現手法の禁止・固定、出力フォーマットの固定、助言の合否化は締め付けにあたる。新しいゲートを足すなら、上の「客観的に判定できて視聴者に実害がある」を満たすことを要件書で示す。」 |
| MV に QC 規則は無い | 原典:`job-template/AGENTS.md` L330、要件書の非目的 N10（L64）、EX-19（L230） | 「MVは「MVの制作工程」に従い、qcの規則は無い（MVのジョブでnpm run qcを実行しても検査はしない）。」 |
| MV の仕様を変えない | 原典: 要件書の非目的 N1（L55） | 「MV モードの制作原則・工程・検証の仕様変更。許すのは、章の移動・共通化と、F9 のテストが通る範囲の文言整理だけ」 |
| ゴースト検出件数は助言 | 原典: 要件書の決定 D5（L623）、`job-template/AGENTS.md` L286 | 「ghost 走査の検出件数は助言のまま。ゲートにするのは実施と照合記録」 |
| MV：思想が先 | 原典:`job-template/AGENTS.md`「思想先的設計」（L37） | 「**何を表現するかが先、生成手段は後。**」 |
| 解説：理解が先 | 原典:`job-template/AGENTS.md`「理解先的設計」（L101） | 「**理解ゴールが先、見せ方は後。**」 |
| 方向性3案と変化の軸 | 原典:`job-template/AGENTS.md` L46（MV）、L171（解説） | 「方向性を**3案**書く。各案は次の**変化の軸**のうち少なくとも3軸で互いに異なるようにする」／解説は「6軸のうち**3軸以上**で互いに異なり、かつ「説明の骨格」か「図解の核」の少なくとも一方が必ず異なる」 |
| 差別化メモ | 原典:`job-template/AGENTS.md` L33・L185 | 「project.direction.differentiationに差別化メモがあれば方向性の決定で必ず考慮する。」 |
| 候補はたたき台、踏襲しない | 原典:`job-template/AGENTS.md` L49・L185 | 「前作・過去事例・motion-kitやスターターシーンの既定値（色・動き・構図）の組み合わせをそのまま踏襲しない。WebUIの「方向性のたたき台」がデザイン方向性に含まれていても、それは候補の一つであり固定の正解ではない。」 |
| 様式モード | 原典:`job-template/AGENTS.md`「様式モード」（L113）、`AGENTS.md` §7（L83） | 「**`biim`は既定であって必須ではない。**」 |
| `project.json` が正本 | 原典:`src/job.ts` `createProject`（L550〜737）、`job-template/AGENTS.md` L210 | 「project.json の scenes は意図的に空。制作時…に各場面の id / script / note_top / note_bottom / duration_sec を記録する。」 |
| 免除はオーナーだけ | 原典:`job-template/AGENTS.md` L288 | 「**免除（waiver）はオーナーだけが出せる。**」 |
| MankoMIX の失敗の型 | MankoMIX `_handoff/RENOVATION_PACKET_V2.md` §1・§2 | 「カタログが事実上の天井になっている」「目的関数が拒否権しか持たず、発議権を持たない」 |

### 2.2 要件

- **PH-01（MUST）** 制作ハーネス本文（`job-template/AGENTS.md`）は、原典の内容を保ったまま移す。変えてよいのは §6.2 の許容差分だけである。
- **PH-02（MUST）** 合否ゲートは原典のものだけとする（解説の事前ゲート PRE-1〜8、事後ゲート POST-1〜8、`validate` の構造検査）。コア・CLI・MCP・GUI は新しいゲートを足さない。MV のジョブに QC 規則を足さない。
- **PH-03（MUST）** 主観的な質に関する出力は、すべて `advisories`（助言）として返す。助言は `ok`・`verdict`・終了コード・`isError` のどれも変えない。GUI は助言を不合格の見た目で表示しない。
- **PH-04（MUST）** GUI・CLI・MCP が出す方向性の候補は「たたき台」と明示する。候補を選ばなくても生成できる。候補は自動で入力に入らず、呼び出し側が明示的に入れたときだけ入る。
- **PH-05（MUST）** 生成後のジョブ設定の正本は `project.json` だけである。CLI・MCP・GUI は設定の写しや状態 DB を持たない。ジョブの状態は毎回ファイルから導出する。実行記録（§5.3 の run）は設定ではない。
- **PH-06（MUST）** 候補生成の既定の seed を固定値にしない（seed を省いた呼び出しが毎回同じ3案を返すと、それが事実上の既定になる）。seed を指定した場合は同じ結果を返す。
- **PH-07（MUST）** §2.3 の宣言文を新 repo のルート `AGENTS.md` に置き、`job-template/AGENTS.md` の「このファイルを編集する人・エージェントへ」の段落（原典 L333）を消さない。両方の存在をテストで表明する（TS-06）。
- **PH-08（MUST）** §2.4 の規則を守る。

### 2.3 ルート AGENTS.md に置く宣言文（規範文）

次の節を、文言を変えずに新 repo のルート `AGENTS.md` に置く。節番号と見出しの番号だけは調整してよい。

```markdown
## 制作ハーネスと3つの入口の設計思想

`job-template/AGENTS.md`、およびコア・CLI・MCP・GUI を編集するエージェントは、次の思想を守ること。

- **制作ハーネスは意図的に緩く作ってある。** 原則を示し、フォーマット（構成・演出・様式・ファイルの書き方）は固定しない。モデルの能力を引き出し、作品が型にはまらないようにするためである。
- **合否ゲートにするのは、客観的に判定できて、外すと視聴者に実害が出るものだけ**（誤情報、読めない字幕、切れる音声、未確認のままの納品、記録の欠落）。MV に QC 規則は無い。
- **主観的な質**（面白さ、演出の巧拙、スロップ感、テンポ）は合否に入れず、**助言に留める**。
- **思想と理解が先、手段は後。** MV は何を表現するか、解説は何を理解させるかを先に決める。GUI・CLI・MCP が出す候補はたたき台であり、正解ではない。
- **決定論の部分は床であって、天井ではない。** コア・CLI・MCP が決定論で担うのは、生成・検証・安全だけである。創造の判断は制作エージェントに残す。候補の一覧や列挙値を、そこからしか選べない入口にしない。
- **将来このハーネスと入口を編集するエージェントは、この緩さを「改善」と称して締め付けてはならない。** 主観的な質の規則化、表現手法の禁止・固定、出力フォーマットの固定、助言の合否化、創造に関わる入力のカタログ化（自由記述を受け付けなくすること）、場面や演出を操作する固定の命令体系の追加は、締め付けにあたる。新しいゲートを足すなら、「客観的に判定できて視聴者に実害がある」を満たすことを要件書で示す。

この宣言は BiimMotion のルート AGENTS.md §6（コミット 262c798）を継承し、入口が3つになったことに合わせて第4〜6項を加えたものである。
```

### 2.4 床と天井の設計規則

MankoMIX では、認可済みの操作カタログが指揮の語彙の上限になり、意図は受理か却下しかされなかった。Shin-MotionMaker の入口は次の規則で同じ型を避ける。

| # | 規則 | 機械的な担保 |
| --- | --- | --- |
| F1 | 創造に関わる入力（デザイン方向性、動画全体への指示、差別化メモ、理解ゴール、構成メモ、曲の雰囲気など）は自由記述が第一である。候補はその補助にすぎない | 入力スキーマでこれらを文字列型のままにする（TS-03） |
| F2 | 入力の検査が拒否するのは構造だけである（必須項目の欠落、型、範囲、ファイル形式、パスの安全性）。内容の良し悪しでは拒否しない | `validateForm` のエラー種別を原典から増やさない（基線照合、JT-11） |
| F3 | 拒否するときは、エラーコード・理由・直し方（`hint`）を返す。受理か却下だけを返さない | 封筒の `error.hint` を必須にする（CL-05） |
| F4 | 列挙値を持つ既存の項目（`tempo`・`energy`・`motionAmount`・`biimUsage`・`characterUsage`・`evidencePolicy`・`styleMode`）は原典のまま持つ。創造に関わる列挙値を新しく足すには要件書が要る | 入力スキーマのスナップショットテスト（TS-03） |
| F5 | 入口は場面・演出・シーン実装を操作しない。制作エージェントはジョブのファイルを直接編集する。入口が担うのは、生成、状態の読み取り、ジョブ内スクリプトの実行だけである | 操作定義表（AR-05）に場面操作の種別を置かない |
| F6 | ジョブ状態の「次にやること」は助言（`hints`）であり、工程の順序を強制しない。工程を止めるのはゲートだけである | `job_status` の結果に合否の項目を置かない（MC-07） |

## 3. アーキテクチャ

### 3.1 層と依存方向

```
gui/ ───────────────────────────┐
                                ▼
src/cli ─┐                  src/core ──▶ job-template/runtime/scripts/caption-capacity.mjs
         ├──▶ src/host ──▶      ▲        （ジョブと共有する定義。原典と同じ参照）
src/mcp ─┘        │
                  └──（子プロセス）──▶ <ジョブ>/runtime/scripts/*.mjs
```

| 層 | 責務 | 制約 |
| --- | --- | --- |
| `src/core` | 入力の検査、`project.json`・`brief.md`・依頼文の生成、ジョブのファイル一式の構築、ZIP 化、方向性のたたき台、歌詞・台本の統計、失敗チェックリスト、検査結果 JSON の読み取り | ブラウザと Node の両方で動く。`node:*` と DOM を import しない。入出力はすべて引数と戻り値 |
| `src/host` | テンプレートの読み込み、ジョブフォルダの書き出し、パスの安全検査、ジョブ内スクリプトの実行、run 台帳、排他、`doctor`、`project.json` の読み書き、ジョブ状態の導出 | Node 専用。ファイルと子プロセスに触れる唯一の層 |
| `src/cli` | 引数を解釈して host を呼び、封筒を出力する | ロジックを持たない |
| `src/mcp` | ツール呼び出しを受けて host を呼び、封筒を返す | ロジックを持たない |
| `gui/` | フォーム、プレビュー、検査結果の表示。core をブラウザで実行して ZIP を作る | host・cli・mcp を import しない |
| `job-template/` | 製品。生成ジョブの雛形 | §6 |

- **AR-01（MUST）二重実装の禁止。** CLI と MCP は同じ host 関数を呼ぶ薄いラッパーとし、入力の検査・生成・判定のロジックを自分で持たない。GUI は core を直接使い、生成ロジックを再実装しない。
- **AR-02（MUST）検査の実装は1つ。** `validate`・`qc`・`ghost-check`・レンダー・音声・画像生成の実装は、ジョブ内の `runtime/scripts/*.mjs` だけに置く。CLI と MCP はそれを子プロセスとして実行し、結果の JSON を読んで返す（§4.5）。core と host に同じ判定を書かない。
- **AR-03（MUST）依存方向の機械検査。** `tests/architecture.test.ts` が import 文を走査し、次を表明する：`src/core` が `node:*`・`src/host`・`src/cli`・`src/mcp`・`gui` を import しない／`src/cli` と `src/mcp` が互いを import せず、`node:fs`・`node:child_process`・`job-template` を直接 import しない／`gui` が `src/host`・`src/cli`・`src/mcp` を import しない。
- **AR-04（MUST）入力スキーマの定義は1箇所。** 生成の入力（`request`）の検査は core の1つの関数に置き、CLI・MCP・GUI の読み込みが同じ関数を通る。原典の `tools/generate-job.ts` L44〜115 の検査（未知キーの拒否、型の検査、`defaults` との合成、`validateForm`）をここへ移す。
- **AR-05（MUST）操作定義表。** host に操作の一覧（操作 ID、入力スキーマ、処理関数、読み取りか書き込みか、run にするか）を1つ持ち、CLI のサブコマンドと MCP のツールをそこから作る。CLI と MCP の操作が一致することをテストで表明する（TS-05）。CLI だけに置く操作（`studio`、`mcp serve`、`version`）は表に理由を書く。
- **AR-06（MUST）生成結果の同一性。** 同じ `request` と添付ファイルから、GUI の ZIP の中身と CLI・MCP が書き出すフォルダの中身が、パスとバイトで一致する（原典 `tests/generate-job.test.ts` の性質を継承）。

### 3.2 リポジトリ構成（決定）

```
Shin-MotionMaker/
├─ AGENTS.md  CLAUDE.md  README.md  LICENSE  NOTICE  VERIFICATION.md
├─ package.json          npm パッケージ shin-motionmaker。bin は shin-motionmaker と smm。workspaces は gui
├─ src/core/  src/host/  src/cli/  src/mcp/
├─ job-template/         製品（生成ジョブの雛形）
├─ job-assets/fonts/     同梱フォント（SHA-256 で検査）
├─ schemas/              JSON Schema（request、project、封筒、run、各検査結果）
├─ gui/                  React／TypeScript／Vite。Pages 用の静的ビルド
├─ assets/ui/icons/      アイコンの原本（.csprite）
├─ tests/                node --test。fixtures/ に基線
├─ tools/                開発用スクリプト
├─ docs/                 REQUIREMENTS.md、WORKFLOW.md、DESIGN.md、CONTRACT.md、CLI.md、MCP.md、PORTING_LEDGER.md、work/
└─ .github/workflows/    ci.yml、pages.yml、runtime-smoke.yml
```

### 3.3 原典コードの移植方針

| 原典 | 移植先 | 方針 |
| --- | --- | --- |
| `src/job.ts`（1,008行） | `src/core/` | 役割ごとに分割して移す（フォーム型と既定値、検査、`project.json`、`brief.md`、依頼文、ゴースト結果の読み取り、ジョブ構築）。`MotionForm` のキーと `createProject` の出力は変えない。出力のバイトは基線フィクスチャで固定する（JT-11） |
| `src/mv-assist.ts`、`src/explainer-assist.ts` | `src/core/assist/` | そのまま移す |
| `src/biim-standard.json`、`src/font-assets.json` | `src/core/data/` | そのまま移す |
| `src/templates.ts`（Vite の glob） | `gui/src/templates.ts` | ブラウザ用の読み込み |
| `tools/generate-job.ts` | `src/core`（入力検査）、`src/host`（テンプレート読み込み、書き出し）、`src/cli`（`generate`） | 原典の性質を保つ：Vite の glob と同じ除外規則（L122〜124）、フォントの SHA-256 検査（L131〜135）、書き出し前の全パス検査と排他的な書き出し（L162〜175）。終了コードと出力は §4 の規約に改める |
| `tools/make-fixture.ts`、`tools/prepare-runtime-smoke.mjs`、`tools/ui-shots.mjs` | `tools/` | テストと検証に使うので移す |
| `job-template/**`、`public/job-assets/fonts/` | `job-template/**`、`job-assets/fonts/` | §6 |
| `src/App.tsx`、`src/style.css`、`src/main.tsx`、`index.html`、`public/icons/` | `gui/` | §7。機能は GU-02 の一覧で担保する。部品への分割は自由 |
| `tests/*.test.ts`（8ファイル） | `tests/` | §9 |
| `docs/WORKFLOW.md`、`docs/DESIGN.md` | `docs/` | 名称とコマンドを改めて移す |

### 3.4 技術選定（決定）

- **言語は TypeScript、実行環境は Node.js 22 以上。** 原典のコアが TypeScript で、ブラウザの GUI と共有する。ジョブのランタイムの下限も Node 22 である（原典:`job-template/package.json`）。CyberSprite と MankoMIX は Python だが、ここでは言語を増やさない。
- **配布物はビルド済みの JavaScript。** `--experimental-strip-types` での直接実行は開発とテストに限る（`node_modules` の中では型の除去が働かないため）。
- **MCP は公式 TypeScript SDK（`@modelcontextprotocol/sdk`）。** 2026-11-14 時点のレジストリ最新は 1.32.2。M0 で版を固定し、ライセンスを確認する。
- **依存は増やさない。** 実行時依存は `jszip` と MCP SDK を基本とし、CLI の引数解釈は `node:util` の `parseArgs` を使う。追加する場合は版を固定し、理由とライセンスを `NOTICE` と `docs/work/` に記録する。GUI の実行時依存は原典と同じ3つ（`jszip`・`react`・`react-dom`）とする。

## 4. CLI 仕様

### 4.1 コマンド一覧

実行ファイル名は `shin-motionmaker`、短縮名は `smm`。`<job>` はジョブフォルダ（`project.json` がある階層）へのパス。

| コマンド | 種別 | 実体 |
| --- | --- | --- |
| `generate <request.json> --out <dir> [--zip] [--dry-run]` | 同期・書込 | core の生成。`--zip` は GUI と同じ ZIP を書く。`--dry-run` は検査結果と `project.json` の内容だけを返す |
| `candidates --mode mv\|explanation [--seed N] [--count N] [--characters solo\|duo\|none] [--orientation landscape\|portrait]` | 同期・読取 | 方向性のたたき台（`directionCandidates`・`explainerCandidates`） |
| `stats --kind lyrics\|script <file> [--request <request.json>]` | 同期・読取 | `lyricStats`・`scriptStats` |
| `status <job>` | 同期・読取 | ジョブ状態の導出（§5.4） |
| `project get <job> [--pointer /a/b]`、`project patch <job> <patch.json> --expect-sha256 <hash>` | 同期・読取／書込 | `project.json` の読み書き（MC-08） |
| `report <job> <相対パス>` | 同期・読取 | ジョブ内の記録・検査結果・静止画の取得 |
| `setup <job>` | run・書込 | ジョブのルートで `npm install`（`package-lock.json` があれば `npm ci`） |
| `validate <job> [--final] [--double-render]` | run | `runtime/scripts/validate.mjs` |
| `qc <job> --stage pre\|post` | run | `runtime/scripts/qc.mjs` |
| `ghost-check <job> [--target preview\|final] [--double-render] [ほか原典のオプション]` | run | `runtime/scripts/ghost-check.mjs` |
| `render <job> --target preview\|final\|still [--frame N]` | run | `runtime/scripts/run.mjs` の `preview`・`build`・`still` |
| `voice <job>`、`sound <job>`、`imagegen <job> --name <id> --prompt <text> [ほか原典のオプション]` | run | `aivis.mjs`、`sound-design.mjs`、`imagegen.mjs` |
| `runs list\|get\|wait\|logs\|cancel <job> [<run_id>]` | 同期 | run 台帳（§5.3） |
| `doctor [<job>]` | 同期・読取 | 環境の確認（CL-09） |
| `schema [<名前>]` | 同期・読取 | JSON Schema の出力 |
| `studio <job>` | 対話（CLI のみ） | Remotion Studio。人が画面で使うので MCP に置かない |
| `mcp serve --root <dir> [...]` | 常駐（CLI のみ） | §5 |
| `version` | 同期 | 版、コミット、テンプレートの版 |

### 4.2 入力

- **CL-01（MUST）** `generate` の入力は原典 `tools/generate-job.ts` と同じ形の JSON とする：`{"form": {...}, "assets": {"sources": [パス], "character": パス, "secondCharacter": パス, "bgm": パス, "music": パス}}`。`form` のキーは原典の `MotionForm`（`src/job.ts` L22〜74）で、省いたキーは既定値になる。`assets` のパスは `request.json` があるフォルダからの相対で解決する。BOM 付き UTF-8 を受け付ける。
- **CL-02（MUST）** 未知のキー、型の誤り、`validateForm` のエラーがあれば、何も書き出さずに終了コード2で終える。出力先に同名のフォルダまたはファイルがあれば上書きせずに終える（原典 L153〜159・L171）。
- **CL-03（SHOULD）** MV で `musicDurationSec` が `null` のとき、host が音源の尺を測って補う（WAV はヘッダから、それ以外は ffmpeg があれば使う）。測れなければ `E_FORM_INVALID` と直し方を返す。原典では GUI がブラウザで測っていた値である。

### 4.3 出力と終了コード

- **CL-04（MUST）** 標準出力には JSON の封筒を1個だけ書く。進捗・子プロセスの出力・人向けの説明は標準エラーに書く。`--human` を付けたときだけ、標準出力を人向けの要約に切り替える。
- **CL-05（MUST）** 封筒の形：

```json
{"schema": "smm.envelope/1", "ok": true, "command": "qc", "job": "jobs/虹の仕組み",
 "result": {"verdict": "fail", "gates": [], "review_mode": "self"},
 "advisories": [{"id": "ghost-count", "source": "ghost-check", "message": "…"}],
 "warnings": [], "run": {"id": "r-20261114T101500Z-ab12", "status": "completed", "exit_code": 1}}
```

```json
{"schema": "smm.envelope/1", "ok": false, "command": "generate",
 "error": {"code": "E_FORM_INVALID", "message": "…", "hint": "…", "details": ["動画タイトルを入力してください。"]}}
```

- **CL-06（MUST）`ok` と `verdict` を分ける。** `ok` は「コマンドが実行でき、結果を得た」ことを表す。ゲートの合否は `result.verdict`（`pass`・`fail`・`not_applicable`）に入れる。ゲートが不合格でも `ok` は `true` である。道具の故障とゲートの不合格を、呼び出し側が取り違えないようにするためである。
- **CL-07（MUST）** 終了コード：

| コード | 意味 | 例 |
| --- | --- | --- |
| 0 | 成功。ゲート系は合格または対象外 | MV のジョブでの `qc`（原典 EX-19 のとおり検査せず0） |
| 1 | 検査の不合格 | `validate` のエラー、`qc` の `verdict: fail`、`imagegen --strict` の未生成 |
| 2 | 使い方・入力の誤り | 引数の誤り、JSON の不正、未知キー、`validateForm` のエラー |
| 3 | 環境・前提の不足 | ジョブが無い、依存が未導入、ffmpeg・ブラウザ・Aivis・Codex が無い、別の run が実行中 |
| 4 | 内部エラー・異常終了 | スクリプトの想定外の終了、タイムアウト、キャンセル |

  ジョブ内スクリプトの終了コード（`qc.mjs` は 0・1・2、ほかは 0・1）から上の表への対応を `docs/CLI.md` に載せ、テストで固定する。**助言だけが出た実行は0で終わる**（ゴーストの検出件数、`imagegen` の SKIPPED を含む。原典:`job-template/AGENTS.md` L286・L364）。
- **CL-08（MUST）** エラーコードは次の集合とし、CLI と MCP で共有する：`E_USAGE`、`E_INPUT_INVALID`、`E_FORM_INVALID`、`E_PATH_DENIED`、`E_JOB_NOT_FOUND`、`E_NOT_A_JOB`、`E_OUTPUT_EXISTS`、`E_DEPS_MISSING`、`E_TOOL_MISSING`、`E_ENGINE_UNREACHABLE`、`E_BUSY`、`E_CONFLICT`、`E_RUN_NOT_FOUND`、`E_RUN_LOST`、`E_TIMEOUT`、`E_DISABLED`、`E_INTERNAL`。
- **CL-09（MUST）** `doctor` は次を確かめて報告するだけで、何もインストールしない：Node の版、npm、ジョブの依存の導入状況、ffmpeg の所在（`FFMPEG_PATH`・PATH・Remotion の compositor）、レンダー用ブラウザ、Aivis への疎通と Style ID の存在（ジョブが Aivis を使う場合）、Codex CLI の有無（画像生成が有効な場合）、空き容量。
- **CL-10（MUST）** run 系のコマンドは、既定では完了まで前面で待ち、子プロセスの出力を標準エラーへ流す。`--detach` を付けると run ID を返してすぐ終わる。どちらも同じ run 台帳に記録する。
- **CL-11（MUST）** 子プロセスはシェルを介さず、引数を配列で渡して起動する（`<ジョブ>/runtime` を作業フォルダにし、`node` で各スクリプトを直接実行する）。パスに `&`・全角記号・空白が入っても動くことをテストする。オーナーのワークスペースには、そういうパスが実在する。
- **CL-12（MUST）** すべての JSON 出力に JSON Schema を用意し、`schemas/` に置き、`schema` コマンドで取得できるようにする。スキーマ名は `smm.<名前>/<メジャー版>` とし、互換性を壊す変更ではメジャー版を上げる。

### 4.4 エラー文言

エラーコードは英語の識別子、`message` と `hint` は日本語とする。`validateForm` の文言は原典のまま使う（基線照合の対象）。

### 4.5 ジョブ内 npm スクリプトとの関係（決定：併存。実装はジョブ側の1つ）

ジョブ内の npm スクリプト（原典:`job-template/runtime/package.json`）は残し、CLI と MCP はそれと同じスクリプトを起動する入口とする。置き換えない。

理由：

1. **ジョブは単体で完結する。** Pages の GUI で ZIP を落とした利用者は、CLI を入れなくても `npm install` と `npm run` で制作できる。
2. **制作ハーネス本文は `npm run` を指示している。** ここを変えなければ、原典の文面と MV の工程をそのまま保てる。
3. **検査の実装が1つで済む（AR-02）。** 検査の版はジョブと一緒に動くので、古いジョブを新しい CLI で扱っても判定が変わらない。
4. **原典が生成したジョブ（`schema_version` 0.4）も同じ入口で扱える（JT-12）。**

## 5. MCP 仕様

### 5.1 起動と安全

- **MC-01（MUST）** トランスポートは stdio。`shin-motionmaker mcp serve --root <dir>` で起動する。標準出力にはプロトコルのメッセージだけを書き、ログは標準エラーに書く。
- **MC-02（MUST）** パスはすべて `--root` からの相対で受け取り、相対で返す（区切りは `/`）。シンボリックリンクとジャンクションの実体を解決して、`--root` の外を拒否する（`E_PATH_DENIED`）。生成の添付ファイルを別の場所から読む場合は `--allow-dir <dir>` で明示する。CyberSprite の規約（`docs/MCP.md`）と同じである。
- **MC-03（MUST）** 任意のコマンドを実行するツールを置かない。実行できるのは操作定義表のジョブ内スクリプトだけで、渡せるオプションも表で列挙する。ジョブ内スクリプトはジョブのフォルダにあるコードなので、その実行は `npm run` と同じ信頼の範囲であることを `docs/MCP.md` に書く。
- **MC-04（MUST）** `--read-only` では読み取りのツールだけを公開する。`job_imagegen`（Codex を起動し費用が発生しうる）は `--enable-generation` を付けたときだけ公開する。`job_voice` は、`project.json` の `voice.engine_url` がループバック以外のとき、`--allow-engine-host <host>` で許可されていなければ `E_DISABLED` を返す。
- **MC-05（MUST）** 1つのジョブで同時に動かせる書き込み系の run は1つとする（レンダーと `validate` は `runtime/public/assets` を作り直すため。原典:`runtime/scripts/lib.mjs` の `prepare`）。衝突したら、実行中の run ID を付けて `E_BUSY` を返す。

### 5.2 ツール一覧

入力スキーマは `additionalProperties: false`。出力は全ツール共通の封筒（CL-05）で、`structuredContent` と先頭のテキストブロックに同じ JSON を入れる。静止画は後続の画像ブロックで返す。

| ツール | 種別 | 入力の要旨 | 結果の要旨 |
| --- | --- | --- | --- |
| `job_generate` | 同期・書込 | `request`（CL-01 と同じ形）、`out`、`format`（`dir`・`zip`）、`dry_run` | ジョブのパス、ファイル数、`project.json` の SHA-256、制作エージェントへの依頼文（`agentPromptFor`） |
| `direction_candidates` | 同期・読取 | `mode`、`seed`、`count`、`characters`、`orientation` | 候補の配列、軸の定義、追記用の1行。結果に「たたき台であり固定の正解ではない」と明記する（PH-04） |
| `text_stats` | 同期・読取 | `kind`（`lyrics`・`script`）、`text`、任意で `request` | 原典の統計値 |
| `job_status` | 同期・読取 | `job` | §5.4 |
| `project_get` | 同期・読取 | `job`、任意で `pointer` | `project.json` の内容と SHA-256 |
| `project_patch` | 同期・書込 | `job`、`patch`（JSON Merge Patch）、`expect_sha256` | 新しい SHA-256 |
| `report_get` | 同期・読取 | `job`、`path` | 記録・検査結果の本文、または静止画 |
| `job_setup` | run・書込 | `job`、`wait_ms` | run |
| `job_validate` | run | `job`、`final`、`double_render`、`wait_ms` | run と `reports/validate.json` の内容 |
| `job_qc` | run | `job`、`stage`、`wait_ms` | run と `reports/qc-<stage>.json` の内容 |
| `job_ghost_check` | run | `job`、`target`、`double_render` ほか、`wait_ms` | run と `reports/ghost-check(-preview).json` の要約 |
| `job_render` | run | `job`、`target`（`preview`・`final`・`still`）、`frame`、`wait_ms` | run と成果物のパス |
| `job_voice`、`job_sound`、`job_imagegen` | run | `job` と原典のオプション、`wait_ms` | run と生成物の目録 |
| `run_get` | 同期・読取 | `job`、`run_id`、`wait_ms`、`log_tail` | run の状態、ログの末尾、完了していれば結果 |
| `run_list` | 同期・読取 | `job` | 実行中と直近の run |
| `run_cancel` | 同期・書込 | `job`、`run_id` | 取り消し後の状態 |
| `doctor` | 同期・読取 | 任意で `job` | CL-09 |
| `schema_get` | 同期・読取 | `name` | JSON Schema |

- **MC-06（MUST）** ツール名・入力スキーマ・説明文をスナップショットとして repo に置き、変更を差分で見えるようにする（TS-05）。説明文は日本語とする（「たたき台であって正解ではない」などの含意を正確に渡すため）。
- **MC-07（MUST）** `job_status` と `direction_candidates` の結果に、合否・スコア・順位を置かない（§2.4 の F6）。
- **MC-08（MUST）** `project_patch` が検査するのは次だけである：結果が JSON オブジェクトであること、`schema_version`・`mode`・`generator` が変わっていないこと、`expect_sha256` が現在の内容と一致すること（不一致は `E_CONFLICT`）。書き込みは一時ファイルと rename で行う。内容の構造は、続けて `job_validate` で確かめる。場面の内容は検査しない（§2.4 の F5）。
- **MC-09（MUST）** `report_get` が読めるのは、ジョブ内の `reports/`・`plan/`・`brief.md`・`AGENTS.md`・`README.md`・`output/*.png` だけとする。テキストは 256 KiB までで、超えたら切り詰めて `truncated: true` を返す。

### 5.3 長時間処理の非同期モデル（run）

レンダー、ゴースト走査、音声合成、画像生成、依存の導入は、数十秒から数十分かかる。同期のツール呼び出しで抱えると、クライアントの期限で切れる。

- **MC-10（MUST）** ジョブ内スクリプトの実行はすべて **run** として扱う。run の記録はジョブの中の `.smm/runs/<run_id>/`（`run.json`、`stdout.log`、`stderr.log`）に置く。サーバーを再起動しても状態が残り、CLI が始めた run を MCP から、MCP が始めた run を CLI から見られる。
- **MC-11（MUST）** run の状態は `running`・`completed`・`failed`・`cancelled`・`timed_out`・`lost` とする。`completed` は「プロセスが想定内の終了コードで終わった」ことを表し、ゲートの合否は結果の `verdict` に入れる（CL-06）。`failed` は起動の失敗や想定外の終了を表す。

```json
{"schema": "smm.run/1", "id": "r-20261114T101500Z-ab12", "job": "jobs/虹の仕組み", "kind": "render",
 "args": {"target": "preview"}, "status": "running", "exit_code": null, "pid": 1234,
 "started_at": "…", "heartbeat_at": "…", "ended_at": null,
 "progress": {"ratio": 0.42, "text": "…"}, "artifacts": [], "started_by": "mcp"}
```

- **MC-12（MUST）** run 系のツールは `wait_ms`（0〜50,000）を受け取る。その時間内に終われば結果を付けて返し、終わらなければ `run.status: "running"` と run ID を返す。既定値は、`job_validate`（`final` なし）・`job_qc`・`job_sound` が 45,000、それ以外が 0 とする。呼び出し側は `run_get` を `wait_ms` 付きで繰り返して待つ。
- **MC-13（MUST）** run は切り離した子プロセスで実行し、サーバーや CLI が終わっても続く。実行側が `heartbeat_at` を更新し、更新が途絶えてプロセスも無ければ `lost`（`E_RUN_LOST`）とする。
- **MC-14（MUST）** `run_cancel` はプロセスツリーごと止める（Windows を含む）。run には種別ごとの上限時間を設け、超えたら止めて `timed_out` とする。
- **MC-15（SHOULD）** クライアントが進捗トークンを渡した場合、待っている間に進捗通知を送る。

### 5.4 ジョブ状態（`status`・`job_status`）

ファイルから毎回導出する（PH-05）。返すのは事実だけである。

| 項目 | 内容 |
| --- | --- |
| `job` | タイトル、`mode`、`style_mode`、`schema_version`、`generator`（原典生成のジョブでは `null`） |
| `deps` | 依存が導入済みか |
| `records` | モードごとの制作記録（`plan/`・`reports/`）の有無・サイズ・更新時刻 |
| `scenes` | `project.scenes` の件数 |
| `outputs` | `preview.mp4`・`final.mp4` の有無と更新時刻 |
| `checks` | 直近の `validate`・`qc-pre`・`qc-post`・`ghost-check` の結果の要約。QC は `verdict`・`review_mode`・免除の有無と、記録された入力ハッシュが現在のファイルと違う場合の `stale: true`。MV では QC を `not_applicable` とする |
| `runs` | 実行中と直近の run |
| `hints` | 次に実行できそうなコマンド（助言。§2.4 の F6） |

## 6. 生成ジョブ（job-template）の継承範囲

### 6.1 そのまま持つもの

原典の `job-template/` 配下と同梱フォントは、§6.2 に挙げる差分を除いてバイト単位で同じものを持つ。

| 対象 | 内容 |
| --- | --- |
| `AGENTS.md` | 制作ハーネス本文。冒頭の保護文（L3）、モードによる章の読み分け、MV 章、解説章（様式モード、理解先的設計、事前・事後 QC、失敗チェックリスト23項目）、両モード共通章（ゲートと助言の線引き、レンダーゴースト、素材生成、完成の条件） |
| `runtime/` | Remotion の構成、`scripts/`（`run`・`lib`・`validate`・`qc`・`ghost-check`・`ghost-analysis`・`caption-capacity`・`aivis`・`sound-design`・`imagegen`）、`src/` |
| `motion-kit/`、`scenes/`、`plan/`（`templates/` を含む）、`assets/` | そのまま |
| `package.json`、`runtime/package.json` | パッケージ名（`motion-job`・`motion-job-runtime`）、スクリプト名、依存の版をそのまま持つ |
| ZIP の形 | ファイル名 `<タイトル>-motion-job.zip`、ルートフォルダ名 `safeName(タイトル)`。オーナーの既存ワークスペースの取り込み手順がこの形に依っている |

### 6.2 変えるもの（許容差分。これ以外は要件の改訂が要る）

| 種別 | 差分 | 範囲 |
| --- | --- | --- |
| R1 | 製品名・入口名の置換（「WebUI」→「Shin-MotionMaker（GUI・CLI・MCP）」など） | `AGENTS.md`・`README.md`・`brief.md` の該当箇所。置換の対を1件ずつ列挙する |
| R2 | `project.json` の `schema_version` を `0.5` にし、`generator`（`name`・`version`・`template_version`）を足す | `createProject` |
| R3 | `NOTICE` の追加、ジョブの `README.md` への「CLI・MCP から使う」節の追記 | 追加だけ。ジョブ単体では `npm run` が正であることを書く |
| R4 | `validate.mjs` が `reports/validate.json`（各検査の名前・状態・メッセージ、助言）も書く | 追加だけ。標準出力と終了コードは変えない |
| R5 | 解説の `brief.md` にある特定モデル名（「Opusが記入する」）を「制作エージェント」に改める | 解説だけ。MV の生成物には無い |

- **JT-01（MUST）** 上の差分は `tests/fixtures/` の許容差分表に機械可読で載せる。テキストの差分は置換の対として持ち、逆に置換した結果が原典のハッシュと一致することをテストで表明する（JT-11）。
- **JT-02（MUST）** `job-template/` 配下に置いたファイルはすべてジョブに同梱される。開発用のメモ・ログ・下書きを置かない（原典:`AGENTS.md` §3 の規則5）。
- **JT-03（MUST）** `job-template/AGENTS.md` は ZIP の中で単独で読まれる。repo 側の文書へのリンクを書かない（原典:`AGENTS.md` §7「制作ハーネスとの境界」）。CLI・MCP を前提にした書き方もしない。
- **JT-04（MUST）** 記録のひな形は `plan/templates/` に置き、`validate`・`qc` が存在を検査するパスには置かない（原典の決定 D9）。

### 6.3 MV 非退行の担保

原典では、MV の性質を次のテストが守っている。新 repo でも同じ性質を、**git 履歴を使わず、repo に置いたフィクスチャで**守る。

| 性質 | 原典のテスト |
| --- | --- |
| MV の ZIP が完成音源をそのまま含み、全画面・音声合成なし・追加音響なしを強制する | `tests/job.test.ts` |
| MV のフォーム設定・依頼文・`brief.md`・`project.json`・歌詞が基線とバイト一致する | `tests/explainer.test.ts` L210〜252（`git show 955fa5c` に依存。§8.1 の事故の原因） |
| 制作ハーネスが MV の原則・3案・素材方針の文言を持つ（原典 F9 の11文言） | `tests/job.test.ts` |
| ゴースト走査は助言であり、`validate` を不合格にしない。検出と分類のロジック、文字レイヤーの分離が既定 | `tests/ghost.test.ts` |
| `validate --final` は MV に解説の記録を要求しない。MV で `qc` を実行すると検査せず0で終わる | `tests/qc.test.ts` |
| 検査対象のパスに、ひな形が同梱されていない（MV・解説とも） | `tests/harness-docs.test.ts` |
| 画像生成は、Codex が無くてもジョブを止めない | `tests/imagegen.test.ts` |

- **JT-10（MUST）基線フィクスチャ。** M0 で、原典 `262c798` の作業ツリーから次を採取し、`tests/fixtures/baseline-biimmotion-262c798/` に置く。採取スクリプトは `tools/` に置くが、CI では実行しない。
  - `template-manifest.json`：`job-template/` の全ファイルと同梱フォントの、相対パスと SHA-256。
  - `golden/<ケース>/`：`request.json` と、原典のコアが出力した `project.json`・`brief.md`・依頼文・ZIP の目録（パスと SHA-256）。ケースは、MV 横、MV 縦＋任意設定（原典 L225 の2設定）、解説の `biim` 1人・`biim` 2人・`anime`・`motion`・`mixed`・全画面・縦、最小入力。
  - `test-inventory.json`：原典の `npm test` が実行したテスト名の全件と件数。
  - `allowed-diffs.json`：§6.2 の許容差分。
  - `PROVENANCE.md`：採取元のコミット、採取コマンド、採取日。原典の基線テストが `955fa5c` との一致を表明していたことも記す。
- **JT-11（MUST）基線照合テスト。** 次を表明する。
  1. `job-template/` と同梱フォントの各ファイルのハッシュが、許容差分を除いて基線と一致する。
  2. 各ケースの出力が、許容差分（R1・R2・R5）を除いて基線とバイト一致する。**MV のケースで許す差分は R2 と、同梱文書の R1・R3 だけ**である。MV の `brief.md`・`plan/lyrics.txt`・依頼文はバイト一致する。
  3. `validateForm` が返すエラー文言の集合が基線と一致する。
- **JT-12（SHOULD）** 原典が生成したジョブ（`schema_version` 0.4、`generator` なし）を、`status`・`validate`・`qc`・`ghost-check`・`render` で扱える。`reports/validate.json` が無い場合は、終了コードと標準出力から結果を組み立てる。
- **JT-13（MUST）** 原典のテストのうち MV に関わるものは、表明の内容を変えずに移す。変えてよいのは §9.1 の台帳に載せた種別だけである。

## 7. GUI 仕様

### 7.1 役割分担

| 担い手 | 担うこと |
| --- | --- |
| GUI | 人がジョブの入力を書く。たたき台・統計・準備度・失敗チェックリストを見る。ZIP と `request.json` を書き出す。検査結果のファイルを開いて見る |
| CLI・MCP | エージェントと自動化の入口。生成、状態の読み取り、ジョブ内スクリプトの実行 |
| ジョブ内スクリプト | 検査・レンダー・音声・画像生成の実装 |
| 制作エージェント | 制作そのもの（分析、方向性、台本、ストーリーボード、シーン実装、確認）。ジョブの `AGENTS.md` に従う |

GUI はレンダーも検査も実行しない。ブラウザの中で完結し、入力を外部へ送らない（原典の非目的 N5 を継承）。

### 7.2 要件

- **GU-01（MUST）** GUI は静的サイトとする。同じビルドを GitHub Pages とローカルで使う。バックエンド、外部 CDN、入力の永続化を持たない。
- **GU-02（MUST）機能を落とさない。** 原典要件書 UI-11 の機能一覧（L356）が、すべて使えること：制作モードの切り替えとモード別の指示・デザイン文の保持／様式モードの選択／全入力欄／MV での非表示項目／参考資料のドラッグ＆ドロップ・選択・削除／完成音源・BGM・GLB の添付と音源尺の確認／方向性のたたき台と差別化メモ（両モード）／歌詞統計・台本統計／準備度一覧（両モード）／素材生成の設定／キャラクター設定と字幕色／Aivis 設定／解像度・向き・fps／レイアウト図・同梱ファイル・JSON の表示／必須項目のエラー表示とフォーカス移動／ZIP 生成と進捗／指示のコピー／失敗パターン一覧（両モード）／ゴースト検査結果の読み込みと静止画表示／サンプル入力／情報ダイアログ。
- **GU-03（MUST）** 生成は core を使う。同じ入力で CLI と同じバイトのジョブになる（AR-06）。
- **GU-04（MUST）`request.json` の書き出しと読み込み。** フォームの内容を CLI・MCP の `generate` と同じ形で書き出し、読み込める。読み込みの検査は core の同じ関数を通る（AR-04）。添付ファイルはファイル名だけを書き出し、読み込み後に人が選び直す。
- **GU-05（MUST）検査結果の表示。** `reports/` の JSON（`ghost-check`・`ghost-check-preview`・`qc-pre`・`qc-post`・`validate`）と `run.json` を、ファイル選択またはドロップで読んで表示する。**ゲートと助言を別の区画に分け、助言を不合格の色や記号で表示しない**（PH-03）。`review_mode: self` と免除は明示する。
- **GU-06（MUST）** CLI・MCP の使い方を示す区画を置く：現在の入力に対する `generate` のコマンド例、MCP の登録例、文書へのリンク。
- **GU-07（MUST）たたき台の表示。** 候補には「たたき台」と表示し、「別の組み合わせ」で引き直せる。候補は既定で選択されず、追記の操作をしたときだけデザイン方向性に入る。4つの様式モードを同格に並べる。
- **GU-08（MUST）テーマ。** CyberSprite ファミリーテーマ「Circuit White / Solder Mask」を使う。`gui/src/theme/tokens.css` に、正本の `--cs-*` 15トークン（通常と高コントラスト）を値を変えずに写し、採取元のコミットを記す。色の直値はこのファイルにだけ書く。例外は、利用者のデータ（字幕色など）と、出力映像を写すプレビュー（Biim 枠の色は `biim-standard.json` の値）である。独自のパレットは定義しない（原典 Amendment 03）。
- **GU-09（MUST）デザインの正本。** 原典 `docs/DESIGN.md` を出発点に `docs/DESIGN.md` を作り、Shin-MotionMaker 固有の差分（表示名、追加の区画、追加のアイコン）を書く。Biim 枠の見た目は、様式 `biim` のプレビューのモチーフとして残す。
- **GU-10（MUST）アイコンの再利用。** CyberSprite の 16×16 アイコンは、意味が合うものを無加工で再利用する（原本 `.csprite` と書き出した PNG を写す）。原典が使っていた10点（`info`・`validate-ok`・`warning`・`error`・`folder`・`sources`・`add`・`remove`・`settings`・`agent`）は同じ用途で引き継ぐ。アイコンは文字のラベルと並べて置き、アイコンだけの操作を作らない。
- **GU-11（MUST）固有アイコンの制作。** Shin-MotionMaker 固有のアイコンは、**CyberSprite を使って描く**（CLI または MCP を使う制作タスク。CyberSprite の `AGENTS.md` §6 の手順と、クリーンルームの規則に従う）。様式は正本と同じ 16×16・同じパレット。最低限の対象：アプリの印（favicon を兼ねる）、MV モード、解説モード、様式4種（`biim`・`anime`・`motion`・`mixed`）、ゲート、助言、ゴースト検査、ジョブ（ZIP）、CLI、MCP。原本の `.csprite` を `assets/ui/icons/` に、書き出した PNG を `gui/public/icons/` にコミットする（CI に CyberSprite の実行環境を要求しない）。
- **GU-12（MUST）アイコンの由来の記録。** `gui/public/icons/manifest.json` に、各アイコンの名前、由来（CyberSprite からの再利用とその採取元コミット、または Shin-MotionMaker の新規制作）、制作に使った CyberSprite の版、制作者（モデル名）、SHA-256 を記録する。`NOTICE` に要約を書く。
- **GU-13（MUST）表示名。** UI・`<title>`・README の表示名を `Shin-MotionMaker` に統一する。制作者の呼称は「制作エージェント」とし、特定のモデル名を固定で書かない。
- **GU-14（MUST）版の表示。** ビルドに版とコミットを埋め込む：サイトのルートの `version.json`（`version`・`commit`・`built_at`）と、情報ダイアログの表示。§8 の公開後確認に使う。
- **GU-15（MUST）Pages 用ビルド。** 資産の参照は相対パスにし、サブパス（`/Shin-MotionMaker/`）の下で動くことを e2e で確かめる（CyberSprite の `gui/scripts/demo-check.mjs` と同じやり方）。
- **GU-16（MUST）アクセシビリティと画面幅。** 本文のコントラスト比 4.5:1 以上（トークンから機械検査する）、キーボードで全操作に届く、フォーカスが見える、幅 390px で横スクロールが出ない、1440×900 で最初の入力欄がスクロールなしで見える。`prefers-reduced-motion` に対応する。
- **GU-17（MUST）スクリーンショットの記録。** Pages 用ビルドをローカルで配信して、主要な状態（両モードの初期表示、入力済み、エラー、検査結果の表示、情報ダイアログ、幅 390px）を撮り、`VERIFICATION.md` に記録する。記録は証拠であり、オーナーの目視を待つ関門にしない（原典 Amendment 01 AM-1）。

## 8. CI と公開

### 8.1 教訓（2026-11-14、原典で起きたこと）

原典の `tests/explainer.test.ts` L210〜215 は、基線を `git show 955fa5c:src/<file>` で読む。CI の `actions/checkout` は既定で最新の1コミットしか取らないので、このテストが CI でだけ落ち、main への push が成功したあとも Pages は旧 UI のままだった。原典は `fetch-depth: 0` で回避した（`262c798`）。新 repo は原因の側を無くす。

### 8.2 要件

- **CI-01（MUST）git 履歴に依存するテストの禁止。** テストは `git` を起動せず、履歴・ブランチ・タグ・作業ツリーの状態を読まない。基線が要るものは `tests/fixtures/` のファイルと比べる。`tests/` と `gui/` のテストコードを走査して `git` の起動を検出するテストを置く。
- **CI-02（MUST）** CI の `actions/checkout` は既定の深さ（1）のままにする。`fetch-depth: 0` を回避策として使わない。
- **CI-03（MUST）** `ci.yml` は PR と push の両方で、同じテスト一式を実行する：`npm ci`、ビルド、`npm test`、GUI のテストとビルド。OS は ubuntu と windows の両方、Node は 24（ubuntu では 22 も）。オーナーの環境は Windows であり、パスとプロセスの扱いが違う。
- **CI-04（MUST）手元の確認を CI と同じ条件にする。** `tools/ci-local.mjs` を置く：現在のコミットを深さ1で一時フォルダへ複製し、`npm ci` から CI と同じコマンドを実行する。追跡していないファイルや履歴への依存を、push の前に検出する。G4 の条件に含める。
- **CI-05（MUST）main への直接 push をしない。** main へ入れるのは、同じコミットで PR の CI が合格したものだけとする。ローカルでマージして push する経路を使わない。強制 push をしない。
- **CI-06（MUST）Pages のワークフロー。** `pages.yml` は「ビルド → デプロイ → 公開後確認」の3ジョブとする。公開後確認ジョブは `tools/verify-pages.mjs` を実行し、不一致ならワークフローを失敗にする。M8 までは手動実行（`workflow_dispatch`）だけにし、M8 で main への push を契機に加える。
- **CI-07（MUST）公開後確認の内容。** `tools/verify-pages.mjs <URL> --expect-commit <SHA>` は、公開 URL を（キャッシュを避けて）取得し、次を確かめる：HTTP 200／`<title>` が `Shin-MotionMaker` を含む／`version.json` の `commit` がデプロイしたコミットと一致する／参照している JS と CSS が 200 で取れる／ヘッドレスブラウザで開いて、主要な見出しと ZIP 生成ボタンが表示され、コンソールにエラーが無い。反映の遅れに備えて、一定時間は再試行する。
- **CI-08（MUST）公開の完了条件。** 次がすべて揃って「公開した」と言える。push の成功だけでは公開の成功としない。
  1. main のコミットに対するワークフローが、3ジョブとも成功で終わった（結論を `gh run watch --exit-status` などで確かめる。打ち切りと失敗を成功と区別する）。
  2. L2 が手元からも `tools/verify-pages.mjs` を公開 URL に実行して合格した。
  3. 公開 URL のスクリーンショットを撮り、公開前の記録と見比べた。
  4. 実行の URL、コミット、確認の出力、スクリーンショットを `VERIFICATION.md` に記録した。
- **CI-09（MUST）** 公開後確認に失敗したら、完了を宣言しない。原因を直すか、マージを打ち消す PR を出す（巻き戻しは新しいコミットで行う）。
- **CI-10（SHOULD）** `runtime-smoke.yml`（§9.3 の Tier C）は Pages のデプロイと切り離す。レンダーの不安定さで公開が止まらないようにし、失敗は別に報告する。

## 9. テスト方針

### 9.1 原典のテストの移植

原典の8ファイルをすべて移す。表明を変えてよいのは次の種別だけで、変えた箇所は `docs/PORTING_LEDGER.md` に1件ずつ記録する（原典の位置、変更後、種別）。

| 種別 | 内容 |
| --- | --- |
| P1 | import のパスと、分割後のモジュール名 |
| P2 | §6.2 の許容差分（R1〜R5）に対応する文言・値 |
| P3 | git 履歴に依存する基線の読み取りを、フィクスチャに替える |
| P4 | 旧 CLI（`tools/generate-job.ts`）の起動方法・終了コード・出力を、§4 の規約に合わせる |

| 原典のファイル | 扱い |
| --- | --- |
| `job.test.ts`、`ghost.test.ts`、`imagegen.test.ts`、`voice.test.ts`、`qc.test.ts`、`harness-docs.test.ts` | 移す（P1・P2） |
| `explainer.test.ts` | 移す。L210 の基線テストは JT-11 に置き換える（P3） |
| `generate-job.test.ts` | CLI `generate` のテストとして移す（P4）。性質は保つ：GUI と同じバイト、最小入力と既定値、未知キー・型の誤り・検査エラーを書き出し前に拒否、既存の出力先を変えない |

- **TS-01（MUST）** 移植後のテスト件数は、基線の件数（JT-10 の `test-inventory.json`）以上とする。基線のテスト名ごとに、移植先のテスト名または置き換え先を台帳で対応づける。削ったテストがあってはならない。

### 9.2 新規のテスト

- **TS-02（MUST）CLI の入出力。** 標準出力が JSON 1個だけであること／封筒がスキーマに合うこと／終了コード 0〜4 のそれぞれ／助言だけの実行が0で終わること／BOM 付き入力／`&`・全角記号・空白を含むパス／`--detach` と `runs wait`。
- **TS-03（MUST）入力スキーマのスナップショット。** `request` のスキーマと、創造に関わる項目が文字列型のままであること（§2.4 の F1・F4）。
- **TS-04（MUST）MCP のプロトコル往復。** 公式 SDK のクライアントから stdio でサーバーを起動して、次を実行する。
  1. 初期化して `tools/list` を取り、ツール名の集合と各入力スキーマがスナップショットと一致する。
  2. `job_generate` → `job_status` → `project_get` → `job_qc`（`stage: pre`）。解説のジョブでは、生成直後は記録が無いので `verdict: fail` になり、`isError` は偽である。MV のジョブでは `not_applicable` になる。
  3. **`job_generate` → `job_setup` → `job_validate` が合格する**（Tier B。ジョブの依存を導入した状態）。
  4. 依存が未導入のジョブで `job_validate` が `E_DEPS_MISSING` を返す。
  5. `--root` の外のパスが `E_PATH_DENIED` になる（ジャンクションとシンボリックリンクを含む）。`--read-only` で書き込みのツールが公開されない。
  6. 標準出力にプロトコル以外の出力が混ざらない。
- **TS-05（MUST）CLI と MCP の一致。** 操作定義表の各操作が、CLI と MCP の両方にある（CLI だけの操作は表の理由と一致する）。同じ入力に対して、CLI の封筒の `result` と MCP の `structuredContent.result` が一致する。
- **TS-06（MUST）思想の表明。** ルート `AGENTS.md` に §2.3 の宣言文があること。`job-template/AGENTS.md` に保護文（L3）と「編集する人・エージェントへ」の段落があること。`direction_candidates` の説明文と結果に「たたき台」の明示があること。seed を省いた候補生成が、固定の結果を返さないこと。
- **TS-07（MUST）run の生存期間。** 偽のジョブスクリプト（Remotion を使わない）で、完了・不合格・異常終了・取り消し・時間切れ・`lost`・排他（`E_BUSY`）を、ubuntu と windows で確かめる。
- **TS-08（MUST）GUI。** 単体テスト、トークンの写しが正本の値と一致すること（値は repo 内のフィクスチャと比べる）、色の直値が `tokens.css` の外に無いこと、コントラスト検査、e2e（GU-02 の機能一覧、`request.json` の往復、検査結果の表示、サブパス配信、幅 390px）。
- **TS-09（MUST）アイコン。** 全アイコンが 16×16 の PNG で、`manifest.json` の SHA-256 と一致し、由来の記録が埋まっていること。

### 9.3 テストの段

| 段 | 内容 | 実行する場面 |
| --- | --- | --- |
| Tier A | ジョブの依存を導入しないテスト（上のほぼすべて） | PR と push のたび。ubuntu と windows |
| Tier B | 生成したジョブに依存を導入して、`validate` と MCP の generate → validate を通す | PR と push のたび。ubuntu。依存はキャッシュする |
| Tier C | 実レンダー：動作確認用の場面（原典 `tools/prepare-runtime-smoke.mjs` の構成）で `sound` → `validate` → `preview` → `still` → `ghost-check --target=preview` → `build` → `ghost-check` を、CLI と MCP（run のポーリング）の両方から通す | M7 と公開の前に Windows の実機で必ず実行して `VERIFICATION.md` に記録する。CI では手動と main で実行する（CI-10） |

## 10. 文書とライセンス

- **DC-01（MUST）** ルート `AGENTS.md` は開発ハーネスの正本とし、次を含む：開発ハーネスと制作ハーネスを混同しない旨（原典 §1）、絶対規則（要件が先、main へ直接 push しない、MV を弱めない、`job-template/` は製品、追跡ファイルにローカルの絶対パス・メールアドレス・認証情報を書かない、自分の成果を自分で合格にしない、取り消しにくい操作は手前で止める）、§2.3 の宣言文、§8 の公開規則、正本の一覧。`CLAUDE.md` は `@AGENTS.md` を読み込む。
- **DC-02（MUST）** `docs/WORKFLOW.md` に、層（L1〜L4）、ゲート（G1〜G4）、受け渡しファイル（`docs/work/<作業ID>/` の `PLAN.md`・`DIRECTION.md`・`REPORT.md`・`REVIEW.md`・`QUESTIONS.md`・`ENVIRONMENT.md`・`RETRO.md`）を、原典 `docs/WORKFLOW.md` から移す。
- **DC-03（MUST）** `README.md`（人向けの使い方：GUI、CLI、MCP の登録例、必要な環境）、`docs/CLI.md`（コマンド、封筒、終了コード、エラーコード）、`docs/MCP.md`（起動、ツール、run の待ち方、安全）、`docs/CONTRACT.md`（core と host の API、操作定義表、スキーマ）を置く。文書中のコマンド例は、実際に実行して確かめたものだけを載せる。
- **DC-04（MUST）`LICENSE` と `NOTICE`。** ライセンスは Apache-2.0。`NOTICE` に次を書く：著作権表示／**BiimMotion（BiimMotionWebUI、Apache-2.0、同一オーナー）のコミット `262c798` に由来する設計とコード**（生成コア、入力支援、job-template、テスト、デザイン文書）／CyberSprite（Apache-2.0、同一オーナー）に由来するテーマトークンとアイコン、その採取元コミット／固有アイコンは CyberSprite で制作したこと／同梱フォント（Noto Sans JP、M PLUS Rounded 1c。SIL OFL）／同梱する第三者ソフトウェア／Remotion はジョブが別途導入するもので、利用条件は公式の条件に従うこと（原典のジョブ README の記述を継承）。
- **DC-05（SHOULD）** 依存のライセンスを一覧にして確認するスクリプトを置き、CI で実行する。

## 11. 工程分解（案）

### 11.1 体制

| 層 | 担当 | 役割 |
| --- | --- | --- |
| L1 | Fable 5.2 | 本書。差し戻された質問への回答。完成後のレビュー（最大3回） |
| L2 | Opus 5.5（effort 高） | 計画の確定、発注、統合、検証、公開。自分では実装しない |
| L3 | Codex 6.1 sol（effort 高） | 見た目の判断を含まない工学タスク（コア移植、host、CLI、MCP、テスト、CI） |
| L3 | Opus 5.5（effort 中） | 見た目と文面の判断を含むタスク（GUI、テーマ、アイコン、文書の文面） |
| L4 | サブエージェント | 調査の掃き出し、機械的な置換、スクリーンショットなど |

割り当ては CyberSprite の先例（`AGENTS.md` §5.1）に合わせた。危険度の高いタスク（M1 の MV と共有するコード、契約文書、M3 の安全検査）は、実装者と別の製品が差分を読む交差レビューを付ける。

### 11.2 マイルストーンと受け入れ条件

| # | 内容 | 受け入れ条件（ゲート） | 依存 |
| --- | --- | --- | --- |
| M0 | 立ち上げと基線採取。repo の骨格（`LICENSE`・`NOTICE`・`AGENTS.md`・`CLAUDE.md`・`docs/WORKFLOW.md`・パッケージ構成・CI の骨格）、基線フィクスチャの採取（JT-10）、`docs/CONTRACT.md` の初版 | 基線フィクスチャと `PROVENANCE.md` がコミットされている／基線のテスト件数が記録されている／骨格で CI と同じコマンドが合格（git 検出テストを含む。リモートが未作成の間は `tools/ci-local.mjs` で代える。Q-01）／`CONTRACT.md` を別コンテキストが確認した／ルート `AGENTS.md` に宣言文がある | — |
| M1 | コアの移植。`src/core`、`job-template`、同梱フォント、原典テストの移植、基線照合テスト | TS-01 の件数と対応づけ／JT-11 が合格／AR-03 が合格／`PORTING_LEDGER.md` が P1〜P4 だけで埋まっている／交差レビュー | M0 |
| M2a | host。テンプレート読み込み、ジョブ書き出し、パス検査、スクリプト実行、run 台帳、排他、`doctor`、`project` の読み書き、状態の導出、操作定義表 | TS-07 が ubuntu と windows で合格／パスのテスト（CL-11、MC-02）／AR-06 | M1 |
| M2b | CLI。操作定義表からのコマンド、封筒、`docs/CLI.md` | TS-02・TS-03／CLI と GUI 経路のバイト一致 | M2a |
| M3 | MCP。stdio サーバー、ツール、安全、`docs/MCP.md` | TS-04（Tier A と Tier B）・TS-05／ツールのスナップショット／交差レビュー | M2a |
| M4 | GUI。テーマ、原典機能の移植、`request.json` の往復、検査結果の表示、CLI・MCP の区画、`docs/DESIGN.md` | TS-08／GU-02 の全項目を e2e で確認／スクリーンショットの記録／実装者以外のレビュー | M1 |
| M5 | 固有アイコンの制作（CyberSprite で描く） | TS-09／各 `.csprite` が CyberSprite の検証に合格／見た目を別コンテキスト（Opus）が確認／`NOTICE` と `manifest.json` に由来がある | M0 |
| M6 | 文書。`README.md`、ジョブ README の追記、`AGENTS.md` の完成 | TS-06／文書のコマンド例を実行して確かめた記録 | M2b・M3・M4 に追随 |
| M7 | 統合と実機検証 | 全テスト合格／Tier C を Windows 実機で CLI と MCP の両方から通した記録／原典生成ジョブ（0.4）の互換確認（JT-12）／`tools/ci-local.mjs` が合格／G4 の統合レビュー | M2b・M3・M4・M5・M6 |
| M8 | 公開。GitHub への公開、Pages のデプロイ、公開後確認、版のタグ | CI-08 の4条件／`VERIFICATION.md` の記録 | M7、Q-01 |
| M9 | Fable レビューループ（最大3回） | Fable が本書に照らして確認する。§2 の思想に反する点は必ず差し戻す。3回で残った指摘は一覧にしてオーナーへ上げる | M8 |

### 11.3 並行できる範囲

```
M0 ──▶ M1 ──▶ M2a ──▶ M2b ──┐
 │      │        └──▶ M3 ───┤
 │      └──▶ M4 ────────────┼──▶ M7 ──▶ M8 ──▶ M9
 └──▶ M5 ───────────────────┤
        M6（M1 以降、各成果に追随）┘
```

- M1 と M5 は並行できる。M1 の完了と `CONTRACT.md` の確定のあと、M2a と M4 を並行できる。M2a のあと、M2b と M3 を並行できる。
- 並行するタスクは作業ツリーを分ける。全員が依存する契約（`CONTRACT.md`、操作定義表、封筒のスキーマ）を変えるときは、L2 が止めて調整する。
- 最長の経路は M0 → M1 → M2a →（M2b・M3）→ M7 → M8 → M9 である。

## 12. 決定一覧

| # | 決定 | 節 |
| --- | --- | --- |
| D-01 | 言語は TypeScript、Node 22 以上。npm パッケージ1つ（core・host・cli・mcp）と GUI のワークスペース | §3.2、§3.4 |
| D-02 | 層は core（純粋）・host（Node）・cli・mcp・gui。CLI と MCP は操作定義表から作る薄いラッパー | §3.1 |
| D-03 | 検査・レンダーの実装はジョブ内スクリプトの1つだけ。ジョブ内 npm スクリプトは残し、CLI・MCP はそれを起動する | §3.1、§4.5 |
| D-04 | 生成の入力は原典と同じ `{form, assets}`。`MotionForm` のキーを変えない | §4.2 |
| D-05 | CLI の標準出力は JSON の封筒1個。`ok`（実行できたか）と `verdict`（ゲートの合否）を分ける | §4.3 |
| D-06 | 終了コードは 0（成功）・1（不合格）・2（入力）・3（環境）・4（内部） | §4.3 |
| D-07 | MCP は stdio。パスは `--root` の中だけ。任意コマンドの実行ツールは置かない | §5.1 |
| D-08 | 長時間処理は run として切り離し、ジョブ内の `.smm/runs/` に記録する。待つのは `wait_ms` 付きの `run_get` | §5.3 |
| D-09 | 入口は場面・演出を操作しない。場面の DSL と Op を作らない | §1.2、§2.4 |
| D-10 | job-template は原典と同じ。差分は R1〜R5 だけ。`schema_version` は 0.5 | §6 |
| D-11 | MV 非退行は基線フィクスチャで担保する。git 履歴を読むテストは禁止 | §6.3、§8.2 |
| D-12 | GUI は静的・ブラウザ内完結。レンダーも検査も実行しない。`request.json` で CLI・MCP とつながる | §7 |
| D-13 | テーマは CyberSprite の `--cs-*` を値のまま写す。固有アイコンは CyberSprite で描き、PNG をコミットする | §7.2 |
| D-14 | Pages は M8 まで手動デプロイ。M8 以降は main への push で自動デプロイし、公開後確認ジョブを必ず通す | §8.2 |
| D-15 | 表示名は `Shin-MotionMaker`。npm パッケージ名と実行ファイル名は `shin-motionmaker`、短縮名は `smm` | §3.2、§4.1 |
| D-16 | エラーコードは英語、メッセージと MCP の説明文は日本語 | §4.4、§5.2 |
| D-17 | 原典の既定値（Aivis の Style ID のプリセットを含む）はそのまま持つ | §3.3、Q-07 |
| D-18 | 原典の今後の修正は自動では取り込まない。取り込むときは基線フィクスチャを採り直し、差分を台帳に記録する | §6.3 |

## 13. オーナーへの質問

回答が無い間は「既定」で進める。どれも M1 までの作業を止めない。

| # | 質問 | 推奨 | 既定（回答が無い間） |
| --- | --- | --- | --- |
| Q-01 | **GitHub の repo を、いつ・どの公開状態で作るか。** repo の作成は外向きの操作なので、L2 は許可なしに実行しない | M0 で `kokuren333/Shin-MotionMaker` を public で作る。秘密にするものが無く、無料プランの Pages は public repo が前提で、CI も早く回せる。README には開発中と書き、Pages は M8 まで出さない | ローカルの repo で M1 まで進める。リモートの作成はオーナーの指示を待つ。CI の初回実行はリモートの作成後になる（M2 の着手前までに必要） |
| Q-02 | **初回公開（v0.1.0）に npm レジストリへの公開を含めるか。** パッケージ名 `shin-motionmaker` は 2026-11-14 時点で未登録。短縮名 `smm` は同名の別パッケージがあるが、実行ファイルの別名としては使える | v0.1.0 は GitHub からの導入（clone して `npm ci`・ビルド・`npm link`）だけにし、Fable レビューの合格後に `shin-motionmaker` の名前で npm に公開する。レジストリへの公開は取り消しにくい | npm には公開しない |
| Q-03 | **MCP に HTTP トランスポートを足すか** | 足さない。stdio だけにする。必要になったら、CyberSprite と同じ「ループバック限定・ステートレス」で足せる構造にしておく（host は入口に依存しない） | stdio だけ |
| Q-04 | **GUI をローカルのジョブとつなぐモード**（`smm gui` がローカルサーバーを立て、GUI からジョブの状態や run を見る）を v0.1 に入れるか | 入れない。HTTP の待ち受けと認可が増え、初回の範囲が広がる。v0.1 は検査結果のファイルを開く方式（GU-05）で足りる | 入れない |
| Q-05 | **Muse スペース版（MV-E2E）を Shin-MotionMaker の CLI・MCP に切り替えるか** | 本件の範囲外とする。入力の形を原典と同じにしてあるので、あとで切り替えられる | 範囲外 |
| Q-06 | **公開後、原典（BiimMotion）の README に後継の案内を出すか、保守を止めるか** | v0.1.0 の公開と Fable レビューが済むまでは何もしない。その後にオーナーが決める | 原典に触れない |
| Q-07 | **公開製品の既定値に、オーナー個人の Aivis Style ID のプリセットを持ち続けるか** | 持つ（D-17）。原典でも公開済みで、変えると解説の基線照合に許容差分が増える。変える場合は R6 として足す | 持つ |

## 14. リスク

| リスク | 対処 |
| --- | --- |
| GUI の移植で機能が落ちる（原典の `App.tsx` は約10万バイトの単一ファイル） | GU-02 の一覧を e2e で1項目ずつ確かめる。M4 を実装者以外がレビューする |
| Windows でのプロセスツリーの停止、切り離した子プロセス、長いパスや記号を含むパス | TS-07 と CL-11 を windows の CI で実行し、M7 で実機確認する |
| ジョブの依存の導入が重い（原典の運用では1プロジェクト 1.5〜2 GB） | Tier B はキャッシュを使う。Tier C は Pages のデプロイと切り離す（CI-10） |
| MCP の SDK とプロトコルの版の変化 | M0 で版を固定する。TS-04 は SDK のクライアントで往復させ、手書きのメッセージに依らない |
| 原典とのずれが気づかれずに広がる | 許容差分は機械可読で、照合テストが落ちる（JT-11）。原典の更新は自動で取り込まない（D-18） |
| 入口が増えたことで、将来「便利な」カタログや Op が足される | §2.3 の宣言文、§2.4 の規則、TS-03・TS-06 のテスト、Fable レビューでの必須確認（M9） |
| Remotion の利用条件（企業での利用には別の条件がある） | `NOTICE` と README に原典と同じ注意を書く（DC-04）。Remotion は同梱しない |
