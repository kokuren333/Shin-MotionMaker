# DESIGN — Shin-MotionMaker GUI のデザイン言語

- 状態：M4 の初版（実装に合わせて記述）
- 根拠：要件定義書 `docs/REQUIREMENTS.md` §7（GU-01〜GU-17）、§2.2 の PH-03・PH-04。出発点は原典 BiimMotion の `docs/DESIGN.md`（コミット 262c798、確定版）で、原典 Amendment 03（製品ファミリーテーマへの統一）を引き継ぐ
- 対象：`gui/`（`index.html`、`src/App.tsx`、`src/components/`、`src/style.css`、`src/theme/tokens.css`、`public/icons/`）。**出力映像の仕様（biim-standard-v1、字幕帯域、QC 規則）は対象外で、ここでは変えない**
- 本書と実装が食い違ったときは、実装を確かめたうえで本書を直すか、本書に合わせる修正を別タスクとして起こす。本書だけを書き換えて規則を変えない

## 1. 採用宣言と正本

Shin-MotionMaker の GUI は、CyberSprite・MankoMIX・BiimMotion と同じ製品ファミリーテーマ **「Circuit White / Solder Mask」** を使う。

- **値の正本**：CyberSprite リポジトリの `gui/src/theme/tokens.css`（コミット `20f787d`。`a00433c` でも同一）
- **アイコンの正本**：再利用分は CyberSprite の `assets/ui/icons/`（`a00433c`）、固有分は本 repo の `assets/ui/icons/`（M5 で CyberSprite を使って描いたもの）。由来は `gui/public/icons/manifest.json`
- 本書は独自のパレットを定義しない。ファミリーの正本を参照し、**Shin-MotionMaker 固有の差分だけ**を規定する。

## 2. 取り込んだトークン（写し）と所在

写しは `gui/src/theme/tokens.css` の**第1部**にある。正本のファイルを1バイトも変えずに埋め込み、先頭のコメントに採取元のコミットを書いた。同じバイトを `tests/fixtures/cybersprite-tokens-20f787d.css` に置き、`gui/tests/theme.test.ts` が両方の theme ブロックの `--cs-*`・`--ui-*` を全件照合する（テストから CyberSprite のパスは読まない）。自動同期の仕組みは作らない。正本の値が変わったら、正本から第1部を丸ごと写し直し、フィクスチャも同じバイトに替える。

| 種類 | 取り込んだもの | 原典 BiimMotion からの差 |
| --- | --- | --- |
| 基礎トークン | `--cs-*` の15個（board・panel・pad・pad-shade・trace・trace-soft・trace-deep・ink・ink-soft・warn・error・agent・canvas-surround・checker-a・checker-b） | 同じ |
| 役割トークン | `--ui-*` の全項目 | 同じ |
| 高コントラスト | `:root[data-contrast="high"]` の全項目 | **追加**。原典は取り込まなかった。情報ダイアログの「高コントラスト表示」と、OS の `prefers-contrast: more` で `data-contrast="high"` を付ける |
| 寸法 | `--font-ui`、`--font-mono`、`--fs`、`--fs-s`、`--bw`、`--notch`、`--gap`、`--ph-h`、`--tab-h`、`--pad-h`、`--row-h`、`--chamfer` ほか | 正本の metrics ブロックを丸ごと写した（エディタ固有の `--layer-w` なども含むが、使わない） |

**色の直値は `tokens.css` にだけ書く（GU-08）。** `tokens.css` の第2部は、出力映像を写すプレビューの例外（§4.2 の `--biim-*`）だけを持つ。その他の場所の例外は次の2つだけで、`gui/tests/theme.test.ts` が機械検査する。

- `index.html` の `<meta name="theme-color">`（`--cs-board` と同じ値。HTML の属性は CSS 変数を読めない）
- 利用者のデータ：字幕色は入力値を実行時に要素へ渡す（`style={{ color: … }}`、`--caption-color`）。GUI のソースに字幕色の直値は書かない。初期値は core の `defaults` が持つ

### 2.1 アイコン（M5 の26点）

`gui/public/icons/` の PNG を `PixelIcon` 部品が `import.meta.env.BASE_URL` 基準の相対パスで `alt=""` として表示する。**どれも文字ラベルと並べて置き、アイコンだけの操作は作らない（GU-10）。** M4 はアイコンを変更・追加していない。

| ファイル | 由来 | 使う場所 |
| --- | --- | --- |
| `app.png` | 固有 | アプリバーの表示名の前、favicon（`favicon.png`） |
| `info.png` | 再利用 | アプリバーの「Shin-MotionMaker について」、検査結果の「対象外」と run の通常状態 |
| `validate-ok.png` | 再利用 | 字幕帯の状態の一文（書き出せる状態）、ゲートの「合格」、request.json の読み込み完了 |
| `warning.png` | 再利用 | 字幕帯の状態の一文（必須項目が足りない状態）。**助言には使わない** |
| `error.png` | 再利用 | 字幕帯のエラーの要約、ゲートの「不合格」、run の異常終了。**助言には使わない** |
| `folder.png` | 再利用 | ファイルを選ぶ操作すべて（参考資料、音源、モデル、検査結果、request.json の読み込み） |
| `sources.png` | 再利用 | 02 のドロップ区域 |
| `add.png` | 再利用 | たたき台の「この案を追記」 |
| `remove.png` | 再利用 | 添付一覧の「削除」、検査結果の「表示を消す」 |
| `settings.png` | 再利用 | 「演出と調査の詳細」の開閉、情報ダイアログの「表示」 |
| `agent.png` | 再利用 | 「指示をコピー」、右下ノートの「制作エージェントへの指示」 |
| `mode-explainer.png`・`mode-mv.png` | 固有 | 01 の制作モードの選択肢 |
| `style-biim.png`・`style-anime.png`・`style-motion.png`・`style-mixed.png` | 固有 | 03 の様式モードの4枚のカード（同じ大きさ・同じ扱い） |
| `job-zip.png` | 固有 | 字幕帯の「ジョブのZIPを生成」、「request.json を書き出す」 |
| `gate.png` | 固有 | 「検査結果を見る」の見出し、検査結果カードの見出し |
| `advisory.png` | 固有 | 助言の区画の見出し（検査結果、右上ノートの「入力の助言」） |
| `ghost-check.png` | 固有 | ゴースト検査の結果カードの見出し |
| `eye.png` | 再利用 | ゴースト検査の静止画の見出し |
| `human.png` | 再利用 | 免除（オーナーだけが出せる）の見出し |
| `cli.png`・`mcp.png` | 固有 | 「CLI・MCP から生成する」の見出し・コマンド例・登録例とそのコピー |
| `link.png` | 再利用 | 文書へのリンクの見出し（CLI・MCP の区画、情報ダイアログ） |

**暗い面にアイコンを直接置かない（M5 からの申し送り）。** ink の 1px の輪郭と ink だけで描いた部分（`gate` の腕の輪郭、`mode-mv` の符幹、`link`・`settings` など）は、`--cs-ink`・`--ui-inverse-bg` や Biim 枠の黒地の上で消える。暗い面に置く必要があるときは `PixelIcon` の `chip` 指定で明るい面のチップ（`.ico-chip`：`--cs-panel` の地、`--ui-pad-line` の 1px 枠）に載せる。現在これを使うのは、Biim 枠の黒地である字幕帯の字幕表示部（状態の一文とエラーの要約）だけ。

## 3. 形と文字（ファミリーの様式）

原典と同じ。要点だけ再掲する。

- **領域（パネル）**：白地に `--bw`（2px）の `--ui-panel-line`。左上に 45° のピクセルの切り欠き（`Notch`）。角丸は使わない。
- **ボタン（パッド）**：`--cs-pad` 地、2px の枠（左上が地と同色、右下が `--ui-pad-line`）、`--chamfer` の切り欠き。主操作（ZIP 生成）は `--ui-pad-on-bg`＋`--ui-on-line`。フォーカスは `--ui-focus` の 2px 輪郭を内側に描く。
- **入力欄**：白地、1px の `--ui-field-line`、角丸0。フォーカスは 2px 輪郭。
- **ラジオの選択肢（Shin-MotionMaker で追加）**：白地＋1px の `--ui-field-line` の枠。選択中は `--ui-sel-bg` の地＋2px の `--ui-on-line` の枠＋太字。フォーカスは選択肢全体に 2px 輪郭（`:focus-within`）。
- **書体**：`--font-ui`（日本語ゴシック系統）、数値・パス・コマンドは `--font-mono`。外部 CDN から取得しない。
- **動き**：`transition`・`animation`・`@keyframes` を指定しない。`prefers-reduced-motion: reduce` では `scroll-behavior: auto` と打ち消しを置く。

## 4. Shin-MotionMaker 固有の差分

寸法の値は `gui/src/style.css` 冒頭の `:root` に置く（色は置かない）。値は原典の `--bm-*`・`--bar-h`・`--band-h`・`--note-w`・`--region-gap`・`--field-h` と同じ。字幕書体の名前だけ `"SMM Caption"` に改めた。

### 4.1 4領域の骨格と追加した区画

骨格（アプリバー・主領域・右上ノート・右下ノート・字幕帯）、寸法、920px と 650px の切り替えは原典 §4.1 と同じ。追加・変更したものは次のとおり。

| 場所 | 追加・変更 | 理由 |
| --- | --- | --- |
| アプリバー | 表示名 `Shin-MotionMaker` の前に `app` アイコン。版の表示は `v<版>`（版は core の `PACKAGE_VERSION`）。**「request.json を読み込む」** を置いた | GU-13・GU-14・GU-04。読み込みは入力全体を置き換える操作なので、目次の行ではなくアプリの操作としてアプリバーに置いた（目次の行を原典と同じ1行に保つため） |
| 主領域 01 | 制作モードを、選択欄から**2つのラジオ**（`mode-explainer`・`mode-mv` のアイコン付き）に変えた | GU-10 のモードアイコンを文字と並べるため。値と切り替えの挙動（モード別の指示・デザイン文の保持）は原典と同じ |
| 主領域 03 | 様式モードを、選択欄＋説明の一覧から、**同じ大きさの4枚のラジオカード**に変えた。「既定」の目印をやめ、「初期値は Biim ですが、既定であって必須ではありません」と注記に書いた | GU-07（4つの様式モードを同格に並べる）。一覧の1枚だけに「既定」の札を付けると同格でなくなる |
| 主領域 03 | たたき台の札を「案 A」から**「たたき台 A」**に変え、説明に「どれも選ばれていません」を足した。「別の組み合わせ」は毎回新しい乱数の seed で引き直す | GU-07・PH-04・PH-06 |
| 主領域（読み込み後） | 目次の下に読み込みの結果（置き換えたこと、選び直す添付ファイルの名前）を出す | GU-04（添付は名前だけが記録され、人が選び直す） |
| 右下ノート | 「制作エージェントへの指示」の下に **「CLI・MCP から生成する」** を追加（request.json の書き出し、`generate` のコマンド例を PowerShell 用と POSIX シェル用に分けて2つ、MCP の登録例、文書へのリンク） | GU-04・GU-06 |
| 右下ノート | 「レンダーゴースト検査の結果」を **「検査結果を見る」** に広げた（validate・qc-pre・qc-post・ghost-check(-preview)・run.json・静止画） | GU-05。ゴースト検査の読み込みと静止画表示（GU-02）はこの中に含む |
| 右上ノート | 解説入力の注意を **「入力の助言」** として、助言の様式（§4.4）で出す | PH-03 |
| 字幕帯 | 状態の一文とエラーの要約のアイコンを明るいチップに載せた。ZIP 生成ボタンに `job-zip` | M5 の申し送り（§2.1）、GU-10 |
| 情報ダイアログ | 版・テンプレートの版・コミット・ビルド日時、文書へのリンク、「高コントラスト表示」 | GU-14、GU-06、GU-16 |

右下ノートの並びは、3タブ（イメージ・同梱ファイル・JSON）→ 制作エージェントへの指示 → CLI・MCP から生成する → 失敗パターン → 検査結果を見る。650px 以下では原典どおり3タブとその中身を隠し、ほかは残す。

### 4.2 Biim 枠モチーフと字幕様式の適用範囲

原典 §4.2 と同じ。Biim 枠の見た目はステージ／プレビュー（レイアウト図、字幕色の見本、字幕帯の字幕表示部）にだけ使い、シェルには使わない。

| 変数 | 値 | 根拠（テストで照合） |
| --- | --- | --- |
| `--biim-bg` | `#1e1e1e` | `src/core/data/biim-standard.json` の `colors.background` |
| `--biim-line` | `#cccccc` | 同 `colors.border` |
| `--biim-text` | `#f4f4f4` | 同 `colors.note` |
| `--biim-stroke` | `#FFFFFF` | `createProject` が書く字幕の `subtitle_outline` |

03 の説明文に出る枠の色（「黒系背景（#1e1e1e）」など）も、ソースに直値を書かず `biim-standard.json` から表示する。字幕書体は `@font-face`（`"SMM Caption"`、太さ 800、`font-display: swap`）で、OS の M PLUS Rounded 1c ExtraBold、無ければ `job-assets/fonts/` の同梱フォント（Vite がビルドに含める）を読む。

### 4.3 文字サイズ

原典 §4.3 と同じ。px だけで指定し、本文 14px、補助 12px、12px 未満は使わない（`gui/tests/theme.test.ts` が検査する）。

### 4.4 ゲートと助言の見せ方（PH-03、GU-05）

**助言を不合格の見た目で出さない。** ここが原典の見た目から意図して変えた中心である。

| 種類 | 見た目 | 使うもの |
| --- | --- | --- |
| ゲートの合格 | `--ui-pad-on-bg` の地、`--ui-on-line` の左線、`validate-ok` | 「判定：合格」 |
| ゲートの不合格 | `--ui-error-bg` の地、`--cs-error` の左線、`error` | 「判定：不合格」、表の不合格の行の結果欄 |
| ゲートの対象外 | `--cs-pad` の地、`info` | MV の QC など |
| **助言** | **`--cs-pad` の地、`--ui-on-line` の左線、`advisory` だけ** | 検査結果の「助言（合否・終了コードに影響しません）」、右上ノートの「入力の助言」、統計の目立たせ（太字＋`--ui-on-line` の枠） |
| run の状態 | 通常は `--cs-pad`＋`info`。`failed`・`cancelled`・`timed_out`・`lost` だけ `--ui-error-bg`＋`error` | 道具の故障はゲートの不合格と別の行に出す（CL-06 と同じ分け方） |

- 1つの検査結果カードの中で、**「ゲート（合否）」と「助言」は別の区画**に置き、助言の区画をゲートの区画の中に入れない。e2e が DOM の入れ子と計算後の色（助言に `--ui-error-bg`・`--ui-warn-bg`・`--cs-error`・`--cs-warn` を使っていないこと）を検査する。
- **ゴースト検査の件数はゲートにしない。** ゴースト検査のカードにはゲートの区画を置かず、件数と原典 `ghostCheckVerdict` の文言（「要注意：…」を含む）を助言の区画に出す。原典はこの文言を `--ui-warn-bg` の地で出していたが、助言なので中立の様式に改めた。
- 原典では構成メモの「字幕容量超過」と歌詞の「20文字超」を `--ui-warn-bg`＋`--cs-warn` で目立たせていた。これも入力の統計（助言）なので、太字と `--ui-on-line` の枠に改めた。
- QC の `review_mode: self` は点線の枠で「自己レビュー。制作したエージェント自身が確認した記録で、独立したレビューではありません」と明示する。免除は `human` アイコンと「オーナーだけが出せる」の説明つきで列挙し、無ければ「免除：なし」と書く。
- この画面は検査を実行せず、判定もし直さない。読み取りは core の `parseInspectionReport`・`parseGhostCheckReport` だけを使う。

### 4.5 名称文字列の所在

表示名は `Shin-MotionMaker`、制作者の呼称は「制作エージェント」（特定のモデル名を書かない。GU-13）。

| 所在 | 文字列 |
| --- | --- |
| `gui/index.html` の `<title>` | `Shin-MotionMaker` |
| アプリバーの表示名と `aria-label` | `Shin-MotionMaker`、`Shin-MotionMaker トップ` |
| アプリバーのボタン、情報ダイアログの見出し | `Shin-MotionMaker について` |
| 主領域のフッター | `Shin-MotionMaker` |
| 情報ダイアログの本文 | `Shin-MotionMaker は、…` |

`index.html` の description は製品名を含まない事実の文。原典の名前（BiimMotion）は、情報ダイアログの継承元の説明とリンクにだけ出る。

### 4.6 favicon

M5 の `app` アイコン（`gui/public/favicon.png`、16×16、ファミリーのパレット）を `<link rel="icon" type="image/png">` で置く。原典は SVG のデータ URI を `index.html` に直値で書いていたが、Shin-MotionMaker は PNG の資産にしたので、`index.html` の色の直値は `theme-color` だけになった。

## 5. 禁止リスト

原典 §5 を引き継ぐ。Shin-MotionMaker で足した項目に「追加」と書く。

- 影、グラデーション、ぼかし、半透明の重ね。例外：ファイル入力を覆う透明な `<input type=file>`。
- `tokens.css` 以外への色の直値（§2 の例外を除く）。シェルの色はトークン経由だけ。Biim 枠モチーフの色は `--biim-*` 経由だけ。
- シェルの地色・枠線に `--biim-*` を使うこと。SVG に `fill`・`stroke` の直値を書くこと。
- **追加：助言を `--ui-error-bg`・`--ui-warn-bg`・`--cs-error`・`--cs-warn` や `error`・`warning` のアイコンで出すこと。ゴースト検査の件数をゲートの区画に入れること。**
- **追加：暗い面（`--cs-ink`、Biim 枠の黒地）にアイコンを直接置くこと。チップに載せる。**
- **追加：たたき台を既定で選択状態にすること、たたき台を自動でデザイン方向性に入れること、様式モードの1つだけを目立たせること。**
- 意味を持たない装飾（飾りのアイコン、英語の飾りラベル、キャッチコピー、操作できないタグ）。記号は完了の印 ✓ と外部リンクの ↗ だけ。
- 角丸、12px 未満の文字、em／rem の文字サイズ、`transition`・`animation`。
- 外部 CDN からのフォント・アイコン・スタイルの取得。入力の永続化（localStorage など）。バックエンドへの送信。
- 制作者を特定のモデル名で呼ぶこと。

## 6. 保持する接続点

原典 §6 を引き継ぐ。

- セクションの `id`（`concept`／`sources`／`direction`／`character`／`voice`）、目次の現在地判定と `scroll-padding-top`。
- `role=tab/tabpanel`・`aria-selected`・`aria-expanded/aria-controls`・エラー領域の `role=alert` とフォーカス移動。
- ファイル入力の覆い構造（`.file-button` の中の透明な `<input type=file>`、`:focus-within` の輪郭）。
- `isMV` による表示・必須条件の分岐。必須条件の判定は core の `validateRequest`（`complete`）を通す（原典は `validateForm` を直接呼んでいた。中身は同じ関数）。

## 7. 検証の所在

| 何を | どこで |
| --- | --- |
| トークンの写し・色の直値・形の規則 | `gui/tests/theme.test.ts` |
| 本文のコントラスト（通常・高コントラストの両方） | `gui/tests/contrast.test.ts` |
| GU-02 の各機能、request.json の往復、検査結果の区画分け、サブパス配信、390px、キーボード、`prefers-reduced-motion`、GUI と Node の ZIP のバイト一致 | `gui/e2e/run.mjs`（`npm test --workspace gui`） |
| スクリーンショット | `gui/e2e/shots.mjs` → `docs/work/M4/screenshots/`、記録は `VERIFICATION.md` |
