# M1 REPORT — コア・制作ハーネス・原典テストの移植

## M1-fix

交差レビュー M1R と L2 の差し戻し裁定を反映した。以下は実行証拠の報告であり、受け入れ判定は L2 に委ねる。初回報告の実行件数・版・判断は後段に履歴として残し、この節と末尾の許容差分表を最新とする。

### 起動時チェック

- L3 工学担当、Codex 6.1 sol / high の発注。モデル切替・サブエージェント利用なし（レベル1相当）、自己判定になるゲートなし。
- 指定ブランチ m1-core、着手時 HEAD 43b6d8517670b0a0449cf5855019d6edee53ab55、作業ツリーはクリーン。Windows / Node v24.15.0。コマンド・対話・ネットワーク利用可。
- REQUIREMENTS の指定節、AGENTS、CONTRACT 全文、WORKFLOW、REVIEW 全文、既存 REPORT と PORTING_LEDGER を確認。差し戻し発注書は会話中の DIRECTION を使用した（作業ツリーに DIRECTION.md はない）。原典 262c798 は読み取り専用の git show で位置と原文を確認し、原典でコード実行・依存導入・変更は行っていない。
- 実装修正コミット: 3919845（M1: preserve validation output and restore upstream test assertions）。

### 指摘と対応

| 指摘 | 対応と証拠 |
| --- | --- |
| M-1 | tests/generate-job.test.ts の15ケースを復元。構造エラー12ケースは details.pointer の集合を完全一致で比較し、validateForm の3ケースは原典の正規表現を details の連結文字列に適用。2項目同時エラー・MV 完成音源必須・混在・必須文言を検査。全体テストで実行 |
| M-2 | validate.mjs の R4 書出しだけを try/catch で包み、allowed-diffs.json の appends も更新。reports がファイルのケースで原典・追加後とも status 0、stderr 空、stdout 完全一致。report の不在と既存ファイルの保持も表明 |
| R-1 | AGENTS.md の MV・解説2箇所の免責を「Shin-MotionMaker（GUI・CLI・MCP）の」へ変更。ゴースト結果・チェックリストの GUI 表記を維持し、R1 の置換対を9対へ分割。JT-11 の逆変換・基線照合で検査 |
| R-2 | baseline.test.ts で原典 explainer.test.ts L110〜115 の解説 form と L225〜226 の設定2組・歌詞・尺から入力を構成。explanation であることを確認後 switchVideoMode(..., "mv") を呼び、golden 2ケースの form に完全一致 |
| R-3 | 解説 brief に Opus が残らないこと、biim・mixed の R5 対象分岐に置換先が存在することを逆変換前に表明。golden 全11ケースを実行 |
| R-4(a) | テストで書き出した添付を loadAssets から読み、mimeTypeFor が決める .PDF・.glb・.WAV・.unknown の MIME・サイズ・本文を独立した期待値と完全一致で比較。モード5件で読み込み結果を buildJobFiles へ渡した。独立したテンプレート読み込みとの比較は専用 test.todo と機械可読・文書台帳に M2a への移送を明記 |
| R-5 | 原典 262c798 を読み、generate-job の準備 L16〜65・モード L68〜140・最小 L142〜153・拒否 L155〜186・出力先 L188〜206・usage L208〜218、explainer の基線 L209〜252 に台帳を修正 |
| I-4 | mimeTypeFor は先頭のドットだけの名前を拡張子なしとして扱う。.md・folder/.PDF は application/octet-stream、..wav・.notes.MD は実拡張子の MIME となることも検査 |
| I-6 | no-git.test.ts の走査を tools 全体へ拡大。開発専用の tools/ci-local.mjs と tools/capture-baseline.mjs だけを名前で明示除外。陽性サンプルとともに実行 |
| I-7 | R4 の差分実行に解説の通常検査を追加。status 0、stdout・stderr が原典と完全一致し、report が pass であることを表明 |
| I-8 | explainer.test.ts の未使用 import 3件を除去。porting-ledger.test.ts は基線81件の全 ID（ファイル名＋テスト名）と機械可読台帳・文書の行の1対1対応、各対応先の一意な実在、種別も表明 |

### 実行結果

| コマンド | 結果 |
| --- | --- |
| npm run build | exit 0、strict 型検査完了 |
| npm test | exit 0、tests 119 / pass 109 / fail 0 / todo 10 / skipped 0。TODO は既存 M2b 9件と明示した M2a 1件 |
| node --experimental-strip-types tools/smoke-core.mjs | exit 0。Node は69ファイル、ZIP 7,726,528 bytes、schema 0.5。既存 Chrome で69ファイルすべての SHA-256 が Node と一致。空白・&・全角を含む一時パスで実生成 |
| node tools/ci-local.mjs | exit 0。3919845eeb7bf5bfd655e233f23e3edac7a82038 を深さ1で複製し npm ci → build → test → workspace test/build を完了。tests 119 / pass 109 / fail 0 / todo 10。npm ci の監査は vulnerabilities 0 |
| git diff --check 43b6d8517670b0a0449cf5855019d6edee53ab55 | exit 0（実装修正コミット前）。git diff --cached --check も exit 0 |

R4 差分実行は通常成功、final＋SKIP、分類なし GHOST、分類・二重レンダー付き GHOST、解説の通常成功、reports がファイル、TypeScript 不正＋走査例外の7条件。先頭6条件は status 0、最後は status 1 で、全条件で原典と stdout・stderr・status が一致した。

途中の対象テスト実行は tests 42 / pass 31 / fail 1 / todo 10。失敗は追加テストが ENOTDIR だけを期待した一方、Windows が report 不在を ENOENT で返したため。両方を受け付ける検査へ直し、上記の全体実行で fail 0 を確認した。

### 決定・質問・依存・残件

- テンプレート本文の変更を識別するため、CONTRACT §1 に従い TEMPLATE_VERSION を 0.5.1 に更新し、旧0.5.0の目録を保持したまま新目録と版→ハッシュを追加。新目録 SHA-256 は eca744e87e30d5e8985311a0593b8b781043f8aa84081769892118e70248df1a。PACKAGE_VERSION は0.1.0。
- R4 の記録失敗は無出力で吸収する。report が無い場合の host 側読取は既存契約どおり後続の責務とする。
- 添付の読み込みはテスト用ヘルパーを使い、host の実装は追加しない。独立した host・ブラウザのテンプレート比較だけを M2a に移送した。M2b の9件の移送範囲は維持。
- 契約・要件への新しい質問なし。QUESTIONS.md の状態は変わらない。CONTRACT・REQUIREMENTS の変更なし。
- 依存追加・更新なし。追加のライセンス確認対象なし。初回記録のライセンス選択と NOTICE を維持。
- I-2（ジョブ README のモデル名）・I-3（JT-11(2) と R4）は裁定どおり変更せず L2・L1 の扱いに委ねる。I-5（buildJobFiles の除外一元化とパス検査の厳格化）は既存契約に沿う差として記録を維持。
- L2 による再実測・判定が残る。Linux・Node22 は手元未実測。GUI の見た目・アイコン・README の推敲判断は行っていない。リモート repo 作成・push・npm 公開なし。


## 初回報告の起動時チェックと範囲

- 層: L3 工学担当。発注指定は Codex 6.1 sol / high。モデル切替・サブエージェント起動なし。L4 を使わず順次実施したレベル1相当。自己判定になるゲートは設けず、受け入れは L2 と別製品の交差レビューに委ねる。
- 作業ブランチ: m1-core。着手時 HEAD: 6bb8c5bc3d1e6b8e1740ad3dc468cd455656d978。着手時の追跡変更なし。
- Windows、Node v24.15.0、npm 11.12.1。コマンド実行・ネットワーク利用可。起動時 npm test は pass 6 / fail 0。
- AGENTS、REQUIREMENTS の指定節、CONTRACT M0b、WORKFLOW、M0 REVIEW と QUESTIONS、基線 PROVENANCE を確認した。原典は発注で指定された既存の読み取り用スクラッチから読み、原典 repo・CyberSprite に書き込んでいない。
- 実装コミット: 9d9f9d2（M1: port the generation core and preserve upstream job baselines）。本報告は後続の文書コミットに収録する。
- CONTRACT・REQUIREMENTS・_handoff は変更していない。リモート作成・push・npm 公開は行っていない。

## 実装したもの

| 対象 | 内容 |
| --- | --- |
| src/core/form.ts・request.ts | 原典の型・既定値・モード切替・配置・validateForm。shape / complete の共通 validateRequest、JSON Pointer と日本語 hint を持つ構造化エラー |
| src/core/project.ts・brief.ts・prompt.ts | project / SVG / brief / 依頼文。project は R2 の schema 0.5 と generator の追加だけ。依頼文と MV brief は原典どおり |
| src/core/job-files.ts・zip.ts・template-paths.ts | テンプレート引数から Uint8Array の全ファイルを構築し ZIP 化。除外規則を一元化。フォーム不正 E_FORM_INVALID、テンプレート不足・不正パス・構築例外 E_INTERNAL |
| src/core/assist/・candidates.ts | 原典の入力支援本体を維持し、公開入口で seed 省略時の乱数・seed 返却・人数と向きの写し方を追加 |
| src/core/reports.ts・mime.ts・types.ts・index.ts | 元の ghost 読取と全 export、検査 JSON の読取、共通の MIME 表と型。ghost 件数と imagegen skipped は助言のまま |
| src/core/data/ | biim-standard と font-assets をそのまま移植。PACKAGE_VERSION=0.1.0、TEMPLATE_VERSION=0.5.0。テンプレート目録 SHA-256 は cc03a629475d87d4389e5526709c44a6454bd05325d6a8a74a838b84dd7d3413 |
| job-template/・job-assets/fonts/ | 原典テンプレートと2フォントをコピーし R1・R3・R4・R5 だけ適用。フォント置場の初期 .gitkeep を実ファイルへ置換 |
| tests/ | 原典8ファイル、JT-11、AR-03、TS-01、入力・候補・レポート・R4 の差分実行検査 |
| tools/make-fixture.ts・smoke-core.mjs | 原典テスト用の実生成ツールを移植。インストール済みブラウザと Node の実行・ZIP 本文比較ツールを追加（開発専用） |
| docs/PORTING_LEDGER.md・tests/fixtures/porting-ledger.json | 全81テスト名の対応と表明変更 P1〜P4。core-source-manifest は元の型・既定値・assist・データ・全 export の固定値 |
| package.json・lock・NOTICE・tsconfig | JSZip を固定導入、配布対象に caption-capacity の実装と型宣言を含む job-template 全体を指定。原典テストの型検査範囲を維持 |

## 受け入れ条件ごとの実行証拠

以下は実行結果の報告であり、L3 による受け入れ判定ではない。

| 条件 | 状態・コマンド・出力の要点 |
| --- | --- |
| npm test・件数 | exit 0、118件 / pass 109 / fail 0 / todo 9 / skipped 0。元81件のうち CLI 固有9件を移送し、その7件の core 部分を実行。全体移送は2件で比較母数79件、現在の実行109件はこれを上回る |
| TS-01 | tests/porting-ledger.test.ts が原典81件との集合一致、対応先の実在・active/TODOの区別、台帳記載、P1〜P4のみを検査。81件すべてに対応先あり |
| JT-11(1) | 基線60ファイル（テンプレート58＋フォント2）のハッシュ・バイト長が R1/R3/R4 逆変換後に一致。基線外は R3 の NOTICE 1ファイルだけ |
| JT-11(2) | golden 全11ケースの ZIP 全パス・各本文 SHA-256・バイト長が一致。project の R2 と解説 brief の R5、同梱文書の R1/R3/R4だけ逆変換。MV 2件の brief・歌詞・依頼文は無正規化でバイト一致 |
| JT-11(3) | 原典38文言の集合と各入力の配列が一致。ソースの全 errors.push 表明も集合一致。URL 行番号のみ正規化し、1・2人目は個別保持。URL の1・2・4行目の実文言も検査 |
| AR-03 | 既存ディレクトリの import/export/dynamic import/require を AST 走査し違反0。禁止先の陽性サンプル14件と許容例を検査。未存在の層は空として扱う |
| 台帳 | docs/PORTING_LEDGER.md の各変更は P1〜P4。imagegen.test.ts と voice.test.ts は元のまま。表明の追加ゲート・主観の合否化なし |
| R4 | tests/validate-report.test.ts が元スクリプトと追加後を同じジョブで比較。通常成功、final＋SKIP、分類なしGHOST、分類・二重レンダー付きGHOST、TypeScript不正＋走査例外の5条件で stdout・stderr・終了コードが完全一致。report の合否は errors の有無だけで、SKIP/GHOST は advisories のみ |
| ブラウザ/Node 実行 | node --experimental-strip-types tools/smoke-core.mjs → exit 0。Node: 69ファイル / ZIP 7,726,507 bytes / schema 0.5。Chrome: 全69ファイルの SHA-256 が一致。Node専用 API のない変換後 core を HTTP 経由で直接実行。ブラウザを自動導入していない |
| build | npm run build → exit 0（strict 型検査）。移植した7テストは原典が src のみ型検査していた範囲を維持し、明示除外して Node で実行。core と新規テスト・ヘルパーは型検査対象 |
| ci-local | node tools/ci-local.mjs → exit 0。実装コミット9d9f9d2を深さ1で複製し npm ci → build → test → workspace test/build を完了。tests 118 / pass 109 / fail 0 / todo 9。GUI は現段階ではスクリプト未定義で if-present の対象外 |
| 交差レビュー | 未実施。発注どおり L2 が別途 Opus へ依頼する。L3 は合否を判定しない |

## テスト・実行コマンド

- npm install --save-exact jszip@3.10.1: exit 0、audit の報告は vulnerabilities 0。
- npm run build: exit 0。
- npm test: exit 0、tests 118 / pass 109 / fail 0 / todo 9。
- node --experimental-strip-types --test tests/core.test.ts tests/validate-report.test.ts tests/generate-job.test.ts: exit 0、22件 / pass 13 / fail 0 / todo 9。
- node --experimental-strip-types --test tests/porting-ledger.test.ts: exit 0、2件 / pass 2 / fail 0。
- node --experimental-strip-types tools/smoke-core.mjs: exit 0、ブラウザと Node で69ファイルの展開本文が一致。空白・&・全角文字のある一時パスを利用。
- node tools/ci-local.mjs: exit 0。`CI と同じコマンドが完了しました: 9d9f9d2bab20badc7739c41de69846259103d594`。深さ1の複製でも tests 118 / pass 109 / fail 0 / todo 9。
- Windows PowerShell の `2>&1` が git clone の進捗を NativeCommandError として扱ったため、同じコマンドを Node の spawn（shell:false）で捕捉し、子プロセスの終了コードを直接確認した。製品コードの変更は不要だった。
- git diff --check 6bb8c5bc3d1e6b8e1740ad3dc468cd455656d978...HEAD: 原典の job-template/runtime/scripts/imagegen.mjs L262 の末尾空行1件を報告。基線のバイト保持対象なので変更しない。git -c core.whitespace=-blank-at-eof diff --cached --check は exit 0（コミット前）。
- tests から git を起動せず、履歴・作業ツリーを読む検査もない。no-git.test.ts が陽性サンプルを含めて実行済み。

## 決定

- 公開の候補関数は薄いラッパーとし、assist 本体の指定 seed の計算・文字列・型を維持した。seed 省略時は CONTRACT 指定の globalThis.crypto.getRandomValues を使う。
- R1 は機能を正しく示す GUI 名へ8対を確定した。AGENTS には CLI/MCP を前提にした記述を入れず、README の追加節で共存を説明する。
- 除外は dot entry と node_modules のどの階層にも適用し、安全な JobPath の検査後に処理する。読み込み側は同じ includeTemplatePath を利用できる。
- buildJobFiles は Error の message を持つ SmmError で投げることで原典の assert.rejects の表明を維持し、validateRequest の戻り値はシリアライズできる構造にする。
- 原典7テストの型エラーに合わせて表明を書き換えず、元の型検査対象外という運用を維持した。P4 の core テストと新規テストは strict 対象に含めた。
- R4 は元の console.log の引数を記録関数で包み、同じ文字列を返す。単文 if の制御範囲も変えず、JSON 書出しだけ末尾へ加える。
- テンプレート版0.5.0の全ファイル目録と版→ハッシュ対応を tests/fixtures へ固定した。フォントは別途元の font-assets のハッシュで保護する。
- 基線の元本文は変更せず、allowed-diffs.json だけ M1 で確定した。新しいソース照合・全テスト対応のメタデータは別フィクスチャに置く。

## 契約・要件への質問

なし。[QUESTIONS.md](QUESTIONS.md) に記録。CONTRACT・要件の変更は不要だった。

## 追加依存とライセンス確認

直接依存は jszip 3.10.1 だけ。全13パッケージ（直接1＋推移12）の版は package-lock の integrity とともに固定した。実物の LICENSE（isarray は README の License 節）を読み、NOTICE に版・許諾・権利者を記録した。JSZip は MIT を選択し GPLv3 を採用しない。pako は root の MIT と lib/zlib/README・ソース先頭の Zlib を両方確認した。フォント2種の実物の OFL 本文も確認し、元の本文・権利表示を保持した。

| パッケージ | 版 | 許諾 | 確認した配布物内の本文 |
| --- | --- | --- | --- |
| jszip | 3.10.1 | MIT を選択 | LICENSE.markdown |
| lie | 3.3.0 | MIT | license.md |
| immediate | 3.0.6 | MIT | LICENSE.txt |
| pako | 1.0.11 | MIT AND Zlib | LICENSE / lib/zlib/README / lib/zlib/inflate.js / lib/zlib/deflate.js |
| readable-stream | 2.3.8 | MIT | LICENSE |
| core-util-is | 1.0.3 | MIT | LICENSE |
| inherits | 2.0.4 | ISC | LICENSE |
| isarray | 1.0.0 | MIT | README.md の License 節 |
| process-nextick-args | 2.0.1 | MIT | license.md |
| safe-buffer | 5.1.2 | MIT | LICENSE |
| setimmediate | 1.0.5 | MIT | LICENSE.txt |
| string_decoder | 1.1.1 | MIT | LICENSE |
| util-deprecate | 1.0.2 | MIT | LICENSE |

## M2b へ移送した検査

全体移送2件（既存出力先・usage）と、core 部分を実施した7件の CLI 部分を TODO 9件として残す。原典名との厳密な対応は台帳を参照。

- M2b: generate-job CLI matches the WebUI ZIP file paths and bytes for biim; BOM, cwd, exclusive rerun
- M2b: generate-job CLI matches the WebUI ZIP file paths and bytes for anime; cwd, exclusive rerun
- M2b: generate-job CLI matches the WebUI ZIP file paths and bytes for motion; cwd, exclusive rerun
- M2b: generate-job CLI matches the WebUI ZIP file paths and bytes for mixed; cwd, exclusive rerun
- M2b: generate-job CLI matches the WebUI ZIP file paths and bytes for mv; cwd, exclusive rerun
- M2b: generate-job accepts a minimal form and omitted assets using defaults; CLI launch and output
- M2b: generate-job rejects invalid JSON, unknown keys, invalid types and validation errors before writing; missing attachment, exit code and no output
- M2b: generate-job rejects existing empty directories and files without changing siblings
- M2b: generate-job reports usage and exits 1 for missing, duplicate or unsupported arguments; use contract exit codes

## 残った課題・TODO・見た目の判断

- L2 による再実測と別製品 Opus の交差レビュー。
- M2b で上の CLI 9件を完成させる。入力 BOM・壊れた JSON・添付不在・cwd・終了コード・書込前拒否・排他的出力と編集保持を含む。
- 独立した host とブラウザのテンプレート読込との比較は M2a に移送する（M1-fix の専用 TODO）。今回のブラウザ実行は core の実行と ZIP 本文比較であり、GUI の画面検査ではない。
- M6 で README の R3 追記の文面を Opus が推敲する。既存の特定モデル名など R5 の解説 brief 以外の本文は今回の許容範囲を越えて置換していない。
- Linux と Node22 は手元にないため未実測。Windows / Node24 の深さ1複製で確認した。実レンダーの CLI/MCP runtime-smoke は M7 の範囲。
- ツール prepare-runtime-smoke.mjs と ui-shots.mjs の用途別移植は M7 / M4 の担当で行う。今回の原典テストが使う make-fixture.ts は移植済み。
- 見た目・アイコン・README の推敲判断は行っていない。

## MV に関わる判断

- MV の brief・歌詞・依頼文は R1/R5 の対象にせず、生バイトで比較した。音源・BGM・キャラ無効時の扱い、全画面、音声合成なし・追加音響なしを元テストのまま確認した。
- MV の最終検査は解説記録を要求しないまま、既存の music-analysis 記録だけを検査する。R4 のレポート追加はこの分岐にも干渉しないことを元テストと差分実行で確認した。
- MV の方向性候補の指定 seed は原典のまま。人数・向きは契約に従って候補生成には使わず、notes で説明する。

## R1 置換対の一覧

| 適用先 | 置換前 | 置換後 |
| --- | --- | --- |
| AGENTS.md | WebUIの「方向性のたたき台」 | Shin-MotionMaker（GUI・CLI・MCP）の「方向性のたたき台」 |
| AGENTS.md | WebUIの「レンダーゴースト検査の結果」 | Shin-MotionMaker（GUI）の「レンダーゴースト検査の結果」 |
| AGENTS.md | WebUIとbrief.md | Shin-MotionMaker（GUI）とbrief.md |
| README.md | WebUI自身 | Shin-MotionMaker（GUI）自身 |
| README.md | WebUIで開ける | Shin-MotionMaker（GUI）で開ける |
| README.md | WebUI更新後 | Shin-MotionMaker更新後 |
| README.md | WebUIでは | Shin-MotionMaker（GUI）では |
| README.md | WebUIはAivis | Shin-MotionMaker（GUI）はAivis |
| README.md | WebUIで全画面 | Shin-MotionMaker（GUI）で全画面 |

## allowed-diffs.json の最終形

[最終ファイル](../../../tests/fixtures/baseline-biimmotion-262c798/allowed-diffs.json)。SHA-256: 24b1328930c385100a07e82ad963d12129fbcdcd566915a609ebb0575b73bc8b。M1-fix で R1 と R4 を更新した。以下はコミットする JSON の全文。

<details>
<summary>最終形（R1〜R5）</summary>

```json
{
  "source_commit": "262c79876a9c4635377114902d58ce783e7578b1",
  "status": "M1確定。逆変換と基線照合の対象。採否はL2が判定する。",
  "rules": [
    {
      "id": "R1",
      "scope": [
        "AGENTS.md",
        "README.md",
        "brief.md"
      ],
      "replacements": [
        {
          "path": "AGENTS.md",
          "from": "WebUIの「方向性のたたき台」",
          "to": "Shin-MotionMaker（GUI・CLI・MCP）の「方向性のたたき台」"
        },
        {
          "path": "AGENTS.md",
          "from": "WebUIの「レンダーゴースト検査の結果」",
          "to": "Shin-MotionMaker（GUI）の「レンダーゴースト検査の結果」"
        },
        {
          "path": "AGENTS.md",
          "from": "WebUIとbrief.md",
          "to": "Shin-MotionMaker（GUI）とbrief.md"
        },
        {
          "path": "README.md",
          "from": "WebUI自身",
          "to": "Shin-MotionMaker（GUI）自身"
        },
        {
          "path": "README.md",
          "from": "WebUIで開ける",
          "to": "Shin-MotionMaker（GUI）で開ける"
        },
        {
          "path": "README.md",
          "from": "WebUI更新後",
          "to": "Shin-MotionMaker更新後"
        },
        {
          "path": "README.md",
          "from": "WebUIでは",
          "to": "Shin-MotionMaker（GUI）では"
        },
        {
          "path": "README.md",
          "from": "WebUIはAivis",
          "to": "Shin-MotionMaker（GUI）はAivis"
        },
        {
          "path": "README.md",
          "from": "WebUIで全画面",
          "to": "Shin-MotionMaker（GUI）で全画面"
        }
      ],
      "note": "確定した9対。候補の免責はGUI・CLI・MCP、GUI固有の操作はGUI名を示す。MVのbrief・歌詞・依頼文への適用は禁止。"
    },
    {
      "id": "R2",
      "scope": [
        "project.json"
      ],
      "replace": {
        "pointer": "/schema_version",
        "from": "0.4",
        "to": "0.5"
      },
      "add": {
        "pointer": "/generator",
        "after": "schema_version",
        "keys": [
          "name",
          "version",
          "template_version"
        ],
        "name": "shin-motionmaker",
        "version_source": "src/core/data/version.ts",
        "normalize_values": [
          "/generator/version",
          "/generator/template_version"
        ]
      }
    },
    {
      "id": "R3",
      "add_files": [
        "NOTICE"
      ],
      "append_only": [
        "README.md"
      ],
      "note": "CLI・MCP節を追加。ジョブ単体ではnpm runが正。",
      "appends": [
        {
          "path": "README.md",
          "text": "\n## CLI・MCP から使う\n\nShin-MotionMaker の CLI・MCP は、ジョブ生成とジョブ内スクリプトの実行を呼び出す入口です。生成後の設定の正本は project.json です。\nジョブ単体では、この README にある npm run の手順が正です。CLI・MCP を導入しなくても制作できます。\n"
        }
      ],
      "added_files": [
        {
          "path": "NOTICE",
          "sha256": "93835a5c60462d0e762a51b07ea9c161c354aa333d1fb29c1eace487a2d5318a"
        }
      ]
    },
    {
      "id": "R4",
      "scope": [
        "runtime/scripts/validate.mjs"
      ],
      "add_outputs": [
        "reports/validate.json"
      ],
      "preserve": [
        "stdout",
        "exit_code",
        "validation-logic"
      ],
      "note": "replacementsとappendsは追加箇所の逆変換用。標準出力・終了コード・検査ロジックを維持する。",
      "replacements": [
        {
          "path": "runtime/scripts/validate.mjs",
          "from": "const errors = [];",
          "to": "const errors = [];\nconst reportChecks = [];\nconst reportAdvisories = [];\nconst reportAdvisory = (message) => {\n  reportAdvisories.push({ id: `validate-advisory-${reportAdvisories.length + 1}`, source: \"validate\", message });\n  return message;\n};"
        },
        {
          "path": "runtime/scripts/validate.mjs",
          "from": "    await fn();\n    console.log(\"OK \" + label);",
          "to": "    await fn();\n    reportChecks.push({ name: label, status: \"ok\", message: \"OK \" + label });\n    console.log(\"OK \" + label);"
        },
        {
          "path": "runtime/scripts/validate.mjs",
          "from": "    errors.push(label + \": \" + error.message);",
          "to": "    errors.push(label + \": \" + error.message);\n    reportChecks.push({ name: label, status: \"error\", message: error.message });"
        },
        {
          "path": "runtime/scripts/validate.mjs",
          "from": "console.log(\"SKIP \" + label + \": \" + error.message)",
          "to": "console.log(reportAdvisory(\"SKIP \" + label + \": \" + error.message))"
        },
        {
          "path": "runtime/scripts/validate.mjs",
          "from": "console.log(\"SKIP ghost scan: \" + result.skipped)",
          "to": "console.log(reportAdvisory(\"SKIP ghost scan: \" + result.skipped))"
        },
        {
          "path": "runtime/scripts/validate.mjs",
          "from": "console.log(\n      `GHOST single-frame events in final.mp4: ${events.length}` +\n        (events.length\n          ? \" (\" +\n            events\n              .slice(0, 10)\n              .map((event) => event.time)\n              .join(\", \") +\n            \")\"\n          : \"\"),\n    )",
          "to": "console.log(\n      reportAdvisory(`GHOST single-frame events in final.mp4: ${events.length}` +\n        (events.length\n          ? \" (\" +\n            events\n              .slice(0, 10)\n              .map((event) => event.time)\n              .join(\", \") +\n            \")\"\n          : \"\")),\n    )"
        },
        {
          "path": "runtime/scripts/validate.mjs",
          "from": "console.log(\n        `GHOST classification: isolated ${result.classification.isolatedCount} (ghost suspects — check stills), clustered ${result.classification.clusteredEventCount} in ${result.classification.clusteredRunCount} runs (likely transitions/motion). Details: reports/ghost-check.json`,\n      )",
          "to": "console.log(\n        reportAdvisory(`GHOST classification: isolated ${result.classification.isolatedCount} (ghost suspects — check stills), clustered ${result.classification.clusteredEventCount} in ${result.classification.clusteredRunCount} runs (likely transitions/motion). Details: reports/ghost-check.json`),\n      )"
        },
        {
          "path": "runtime/scripts/validate.mjs",
          "from": "console.log(\n        `GHOST double-render mismatches: ${result.doubleRender.mismatches.length} frames`,\n      )",
          "to": "console.log(\n        reportAdvisory(`GHOST double-render mismatches: ${result.doubleRender.mismatches.length} frames`),\n      )"
        },
        {
          "path": "runtime/scripts/validate.mjs",
          "from": "console.log(\n        \"GHOST details recorded in reports/ghost-check.md — confirm flagged frames with stills before delivery.\",\n      )",
          "to": "console.log(\n        reportAdvisory(\"GHOST details recorded in reports/ghost-check.md — confirm flagged frames with stills before delivery.\"),\n      )"
        }
      ],
      "appends": [
        {
          "path": "runtime/scripts/validate.mjs",
          "text": "\ntry {\n  await fs.mkdir(path.join(root, \"reports\"), { recursive: true });\n  await fs.writeFile(path.join(root, \"reports/validate.json\"), JSON.stringify({\n    schema: \"smm.validate/1\",\n    final: process.argv.includes(\"--final\"),\n    double_render: process.argv.includes(\"--double-render\"),\n    verdict: errors.length ? \"fail\" : \"pass\",\n    checks: reportChecks,\n    advisories: reportAdvisories,\n  }, null, 2) + \"\\n\");\n} catch {}\n"
        }
      ]
    },
    {
      "id": "R5",
      "scope": [
        "brief.md"
      ],
      "mode": "explanation",
      "replacements": [
        {
          "from": "Opusが記入する",
          "to": "制作エージェントが記入する"
        }
      ]
    }
  ]
}
```

</details>
