# M1R レビュー — コア移植の交差レビュー（MV 共有コード）

- 作業 ID: M1R
- レビュー担当: Opus 5.5（実装者 Codex とは別の製品・別のコンテキスト）。コードは直していない。
- 対象: ブランチ `m1-core`。`main...m1-core` の全差分で、HEAD は `d2ec222`。
- 原典: BiimMotion `262c798`。原典 repo は `git archive` で作業ツリー外のスクラッチへ展開して読んだ。原典で依存導入・ビルド・テストはしていない。

## 結論

**条件付き承認（必須修正あり）**

MV 非退行の中核は守られている。

- `job-template/` の差分は R1・R3・R4 だけ。同梱フォントはバイト一致する。
- MV の `brief.md`・`plan/lyrics.txt`・依頼文は、正規化なしで基線とバイト一致する。
- `project.json` の差分は R2 だけ。
- 基線照合テストは、1バイトの変更を 13 件中 11 件検出した。適用できなかった1件を除くと、検出漏れは R5 の1件だけ。
- 層・契約・git 禁止・思想の観点にも違反は無い。

ただし必須が2件ある。

- 移植テストの1件で、表明が P1〜P4 の範囲を越えて弱められている。
- R4 の `validate.mjs` に、終了コードが変わる経路がある。

この2件を直し、L2 が再実測した時点で承認とする。

## 指摘

### 必須

#### M-1 generate-job の「拒否」テストで、ケースごとの表明が失われている

- 箇所: `tests/generate-job.test.ts:95-117`。原典は `tests/generate-job.test.ts:155-186`。
- 根拠: TS-01、JT-13、§9.1（表明を変えてよいのは P1〜P4 だけ）。
- 原典の表明:
  - 15 ケースそれぞれに固有の正規表現がある。
  - どのキーが報告されるか: `Unknown key: form.style_mode`、`form.secondCharacter.style_id`、`form.__proto__`、`assets.source`、`input.extra`。
  - 2件の誤りを並べて報告すること: `form.title must be string\nform.secondCharacter must be an object`。
  - validateForm の日本語文言: `様式「混在」`、`動画タイトル…何を説明する動画…対象視聴者`。MV の `完成音源をアップロード` も含む。
- 移植後の表明:
  - `error.code` が `E_INPUT_INVALID` か `E_FORM_INVALID` か。
  - message・hint・details が空でないこと。
  - たとえば `{form:{}}` が別の validateForm 文言1件を返しても合格してしまう。MV の音源必須の文言が消えても検出できない。
- P4 で許されるのは、旧 CLI の起動方法・終了コード・出力形式の変更である。「どのキー・どの文言で拒否するか」という core の性質は P4 の対象外。台帳 `docs/PORTING_LEDGER.md:26` には「details に置換」とあるが、details の中身は検査していない。M2b の TODO 名にもこの部分の移送は書かれていない。
- 直し方: 各ケースに期待値を戻す。
  - E_INPUT_INVALID のケース: `details` の `pointer` 集合を表明する。例は `/form/style_mode`、`/form/secondCharacter/style_id`、`/form/__proto__`、`/form/title` と `/form/secondCharacter` の2件、`/form/musicDurationSec`、`/assets/sources`、`/assets/music`、`/assets/source`、`/extra`、ルートの `""`、`/form`。
  - E_FORM_INVALID のケース: `details` に原典の文言が含まれることを表明する（正規表現は原典のまま）。
  - L4 の試算では、現在の `validateRequest` はこれらの pointer と文言をすでに返す。直すのはテストだけでよい。

#### M-2 R4: `reports/validate.json` を書けないと、合格する validate が終了コード 1 で落ちる

- 箇所: `job-template/runtime/scripts/validate.mjs:310-318`。これは allowed-diffs.json R4 の `appends` でもある。
- 根拠: §6.2 R4（「標準出力と終了コードは変えない」）、CONTRACT §9「R4」、PH-02（validate は既存のゲート）。
- 実測: 作業ツリー外の一時コピーで、R4 の差分実行テストを改変して確かめた。ジョブの `reports` をファイルにし、引数なしの合格ケースを実行した。
  - 原典スクリプト: `status 0`、stderr は空。
  - 新しいスクリプト: `status 1`、stderr に `Error: EEXIST: file already exists, mkdir '…\reports'` のスタックトレース。
- 書き込み権限が無い場合や、ファイルがロックされている場合も同じになる。付加の記録が書けないだけで構造検査の合否が反転する。これは R4 の「追加だけ」を満たさない。
- 直し方:
  - 末尾の `mkdir` と `writeFile` を `try { … } catch {}` で包み、失敗しても標準出力・標準エラー・終了コードに影響させない。
  - レポートが無い場合は、host が終了コードと標準出力から組み立てる（JT-12 と同じ経路）。
  - 書き込めないケースを `tests/validate-report.test.ts` に1件足し、原典との stdout・stderr・status の一致を表明する。
  - 逆変換用に、allowed-diffs.json の R4 `appends` も合わせて更新する。

### 推奨

#### R-1 R1 の置換で「方向性のたたき台」の免責の対象が GUI に狭まった

- 箇所: `job-template/AGENTS.md:49`（MV）と `:185`（解説）。allowed-diffs.json R1 の「WebUIの」の対。
- 根拠: PH-04（GUI・CLI・MCP が出す候補はたたき台）、§2.1「候補はたたき台、踏襲しない」、§6.2 R1 の例示（「Shin-MotionMaker（GUI・CLI・MCP）」）。
- 原典では WebUI が唯一の入口だったので、「WebUI の『方向性のたたき台』」はすべての候補を指していた。置換後は「Shin-MotionMaker（GUI）の」になり、CLI・MCP の `direction_candidates` が返す候補は文面上この免責に入らない。`formatCandidate` は同じ「方向性のたたき台」というラベルを出すので実害は小さい。それでも、思想の保護文の意味が狭まる方向の置換である。
- 直し方: この2箇所の置換先を、限定語の無い「Shin-MotionMakerの」か、要件の例どおりの「Shin-MotionMaker（GUI・CLI・MCP）の」にする。候補の出どころを挙げるだけなので、CLI・MCP を前提にした書き方（JT-03）にはあたらない。
  - 「Shin-MotionMakerの」は、AGENTS.md:343 の GUI 固有の文（ゴースト結果を開く）にも一致する。対を1件で済ませるなら、:343 は「（GUI）」付きの別の対として分ける。
  - チェックリストの文（:293）と、ゴースト結果を開く文（:343）は GUI 固有なので現状のままでよい。

#### R-2 MV フォーム設定の置換テストが、原典の入力を使っていない

- 箇所: `tests/baseline.test.ts:121-128`。原典は `tests/explainer.test.ts:222-226`。
- 根拠: §6.3 の表「MV のフォーム設定…が基線とバイト一致する」、JT-13、§9.1 P3。
- 原典の入力: 解説モードの form に設定（縦・design・instructions・videoGeneration）を重ね、そこから `switchVideoMode(…, "mv")` を呼んでいた。
- 移植後の入力: 期待値そのもの（`videoMode` はすでに `"mv"`）に `modeSettingsFor(defaults)` を重ねたもの。そのため、解説→MV の遷移や `videoMode` の付け替えが退行しても検出できない。
- 確認済み: 原典 `explainer.test.ts:110-115` の form に、原典の設定2組と golden の歌詞・尺を重ねて `switchVideoMode(…, "mv")` を通すと、golden 2ケースの `request.form` と deepEqual で一致した（スクラッチで実測）。
- 直し方: 上の原典の入力を、テストの中で組み立てて比較する。

#### R-3 R5 が適用されていることを積極的に表明していない

- 箇所: `tests/baseline.test.ts:43-48`。
- 根拠: §6.2 R5、JT-01、GU-13 の趣旨。
- 現状: 解説の brief の R5 正規化は `replaceAll(to→from)` だけで、`to` が存在するかを表明していない。`reverseText`（L23）は表明している。
- 実測: スクラッチで `src/core/job-files.ts` の「制作エージェントが記入する」を「Opusが記入する」に戻した。`tests/baseline.test.ts` は全件合格のままだった（変異 M7）。
- 直し方: 解説で、かつ R5 の対象の分岐（biim・mixed）のとき、`text.includes(pair.to)` を表明する。あわせて、特定のモデル名が残っていないことも表明する。

#### R-4 generate-job のモード5件の core 部分が、同じ経路どうしの比較になっている

- 箇所: `tests/generate-job.test.ts:16-78`。
- 根拠: AR-06、§9.1（generate-job の性質の保持）。
- 現状:
  - `generateJob` は `zipJobFiles(buildJobFiles(…))` そのものである。両辺が同じテンプレートと同じメモリ上の assets を使うので、ZIP の往復を確かめるだけになっている。
  - L20-37 で書き出した入力ファイルは読まれていない。
  - 次の性質は、実行もされず、M2b の TODO 名にも明示されていない。
    - パスから添付を読み、拡張子から MIME とサイズを決めること（`.PDF`、`.glb`→`model/gltf-binary`、`.WAV`→`audio/wav`、`.unknown`）。
    - Vite と同じ除外規則で読む、独立したテンプレート読み込みとの比較。
  - 台帳の「入力・添付…の本文比較を core で維持」（`docs/PORTING_LEDGER.md:24`）は、実態より強く書かれている。
- 直し方: どちらかを選ぶ。
  - (a) いま `loadAssets` と `mimeTypeFor` を使い、書き出したファイルから添付を組み立てて比較する。
  - (b) M2b の TODO 名に「パス指定の添付の MIME・サイズ」と「独立したテンプレート読み込み」を明記し、台帳の文言を実態に合わせる。

#### R-5 台帳の原典行番号が誤っている

- 箇所: `docs/PORTING_LEDGER.md:22-28`。
- 根拠: §9.1（原典の位置を1件ずつ記録する）。
- 原典 `generate-job.test.ts` は 218 行、`explainer.test.ts` は 252 行しかない。
  - 台帳の「L233–244」「L210–260」はファイルの範囲を越えている。
  - 実際の位置: 準備部 L16–65、モード L68–140、最小 L142–153、拒否 L155–186、既存出力先 L188–206、usage L208–218、explainer の基線テスト L209–252。
- 直し方: 行番号を `262c798` の実際の値に直す。

### 参考

- **I-1 古い `reports/validate.json` が残る経路（M2a 向け）。** スクリプトが末尾に届く前に終わると、前回のレポートが残る。例は依存未導入での import 失敗や、check の外での例外。前回が `pass` なら、今回の失敗と食い違う。M2a・M2b では、終了コードとの突き合わせを必ず通すこと（CONTRACT §11 の鮮度の確認）。
- **I-2 R5 の範囲外に特定のモデル名が残っている。** `job-template/README.md:3`（「Opus 5.5等」）と `:89`（「Opusが記入します」）。R5 の範囲は解説の brief だけなので、M1 の違反ではない。直すなら要件の改訂（R6）が要る。L2・L1 で判断してほしい。
- **I-3 JT-11(2) の文言と R4 の関係。** 要件は「MV で許す差分は R2 と同梱文書の R1・R3 だけ」と書く。しかし R4 の `validate.mjs` は MV の ZIP にも同梱される。実装は R4 も逆変換して照合している。これは妥当だが、要件の文言が R4 を落としている。
- **I-4 `mimeTypeFor` のドットファイル。** `.md` のようにドットで始まる名前の扱いが原典と違う。原典は `path.extname` を使うので拡張子なし、つまり `application/octet-stream` になる。新実装は `text/markdown` を返す（`src/core/mime.ts:29-32`）。実害は小さいが、契約の「原典 CLI の表をそのまま」と厳密には違う。
- **I-5 `buildJobFiles` の挙動差。** 原典の `generateJob` には無かった処理が足されている。除外規則 `includeTemplatePath` と、より厳しい `assertJobPath`（`.` の要素、ドライブ名、NUL を拒否）である。原典は不正パスでは例外を投げ、除外は読み込み側で行っていた。CONTRACT の「除外を一元化」に沿った変更で、golden は一致する。記録として残す。
- **I-6 git 起動を検出する範囲。** `tests/no-git.test.ts:21` は `tests` と `gui` だけを走査する。テストから起動する `tools/make-fixture.ts` は対象外。現時点で git の起動は無い。対象に足すと堅くなる。
- **I-7 R4 の差分実行テストは MV のプロジェクトだけ。** `tests/validate-report.test.ts` は MV の project しか通していない。R4 の変更は分岐に依存しない包み込みなので影響は小さい。解説の1ケースを足すと網羅が上がる。
- **I-8 小さな後始末。**
  - `tests/explainer.test.ts` に未使用の import（`os`・`createHash`・`pathToFileURL`）が残っている。
  - `tests/porting-ledger.test.ts:64-65` は件数をしきい値（`>=`）で見るだけで、表明の中身は見ない。
- **I-9 ライセンス。** jszip は `(MIT OR GPL-3.0-or-later)` で、MIT の選択が NOTICE に記録されている。推移依存 12 件も NOTICE と報告に記録されている。GPL 系の追加は無い。

## 観点ごとの確認結果

| # | 観点 | 結果 |
| --- | --- | --- |
| 1 | MV 非退行 | `git diff --no-index`（原典 `job-template/` 対 新 `job-template/`）の差分は4ファイルだけ: AGENTS.md（R1 4行）、README.md（R1 7行と R3 の追記）、`runtime/scripts/validate.mjs`（R4）、NOTICE（R3 の追加）。同梱フォント2件は `cmp` で一致。MV の制作工程・原則・ゲートの文言に変更なし。R1 の置換は GUI 名だけで、過剰な置換は無い（狭まる方向の懸念は R-1）。R4 は原典との差分実行で stdout・stderr・終了コードが一致（5条件）。ただし書き込み失敗時に不一致（M-2） |
| 2 | テストの移植 | 原典 81 件すべてが `porting-ledger.json` で対応づけられている（L4 が台本で突き合わせた）。6ファイルの差分は P1（import・フォントのパス）だけ。imagegen と voice は無変更。explainer は P2（0.5）と P3。skip への逃がし・テストの削除・名前の変更による取りこぼしは無い。弱化は M-1、R-2、R-4 |
| 3 | 基線照合の強さ | 逆置換は、置換対の `to` の存在と追記の末尾一致を表明したうえで原典のハッシュと照合する。R2 は generator の完全一致・キー順・位置を表明し、その完全な文字列だけを戻す。ほかのキーは消さない。変異 13 件の結果は下表。未検出は R5 だけ（R-3） |
| 4 | git 履歴禁止 | `tests/`・`tests/helpers/`、テストから起動する `tools/make-fixture.ts`、`job-template/runtime/scripts/` に git の起動は無い（imagegen の `--skip-git-repo-check` は Codex の引数）。`no-git.test.ts` は陽性サンプル込みで合格 |
| 5 | 層と契約 | core は `node:*`・DOM・Node のグローバル（Buffer・process）を使わない。core が参照する job-template は caption-capacity だけ。`validateRequest` は `src/core/request.ts` だけにある。原典の export 52 名すべてが core から同名で出ている（台本で照合）。`directionCandidates` は index で seed 省略時に乱数を使う包み関数に解決される。`mimeTypeFor` の表は原典と同一（I-4 を除く）。`version.ts` の3定数は版の目録テストで固定。generator は schema_version の直後で、キー順も CONTRACT どおり。`reports/validate.json` の形は CONTRACT §9 に一致 |
| 6 | 思想 | フォーム型・defaults・validateForm は、原典との diff で移動以外の差分なし（validateForm は末尾の空行1行だけ）。JT-11(3) が文言の集合と、ソース中の `errors.push` の全件を表明しており、エラー種別は増えていない。候補は seed 省略時に `crypto.getRandomValues`、明示 seed は原典の計算。結果には「たたき台…自動で適用しません」が付き、合否・スコアは無い。assist の2ファイルは原典と同一（import のパスだけ違う） |
| 7 | ライセンス・追跡ファイル | NOTICE は依存 13 件と、フォント・原典・Remotion を記録している。`main...m1-core` の追跡ファイルに、ローカルの絶対パス・メールアドレス・認証情報は無い（grep で 0 件） |

### 変異テスト（作業ツリー外の一時コピーで、`tests/baseline.test.ts` を実行）

| # | 変更 | 結果 |
| --- | --- | --- |
| M1 | job-template/AGENTS.md の MV「**3案**」→「**2案**」 | 検出 |
| M2 | MV の brief の1文字（「。」→「、」） | 検出（mv 2ケース） |
| M3 | 歌詞を `trim()` して書き出す | 検出（mv 2ケース） |
| M4 | MV の依頼文の1文字 | 検出 |
| M5 | validate.mjs の stdout `"OK "`→`"OK: "` | 検出 |
| M6 | README の R3 追記の1文字 | 検出 |
| M7 | R5 を戻す（「制作エージェント」→「Opus」） | **未検出**（R-3） |
| M8 | validateForm に新しい文言を追加 | 検出（JT-11(3)） |
| M9 | generator のキー順の入れ替え | 検出 |
| M10 | project.json の末尾 LF の削除 | 未適用（変更対象の文字列の照合に失敗し、実行していない） |
| M11 | job-template にファイルを1件追加 | 検出 |
| M12 | R4 のレポートにキーを1件追加 | 検出 |
| M13 | R1 の置換を1件戻す | 検出 |

## 実行したコマンドと結果

すべて Windows・Node v24 で実行した。作業ツリーで書き込んだのは本ファイルだけ。

| コマンド | 結果 |
| --- | --- |
| `npm test`（作業ツリー） | exit 0。tests 118 / pass 109 / fail 0 / todo 9 / skipped 0 |
| `node tools/ci-local.mjs`（作業ツリー） | exit 0。`CI と同じコマンドが完了しました: d2ec222c7e3c96953ca38e9d7e6fc30b99e5c0e6`。深さ1の複製で tests 118 / pass 109 / fail 0 / todo 9 |
| `git archive 262c798`（原典、読み取りのみ）→ スクラッチへ展開。`git diff --no-index <原典>/job-template job-template` | 差分は4ファイル（上記）。フォントは `cmp` で一致 |
| `diff`: 原典の `mv-assist.ts`・`explainer-assist.ts`・`createProject`・`createBrief`・`validateForm`・型と defaults 対 core | 移動・import・R2 以外の差分なし |
| export 名の照合（原典3ファイルの `export` 52 名 対 core） | 欠落 0 |
| 変異テスト 13 件（スクラッチの複製） | 上表 |
| R4 の書き込み失敗（スクラッチ、`reports` をファイルにする） | 原典 status 0 / 新 status 1（M-2） |
| 原典の入力による MV フォームの再現（スクラッチ） | golden 2ケースと一致（R-2 の直し方を確認） |
| `grep`（diff 内のローカルパス・メール） | 0 件 |
| L4 サブエージェント | 原典8ファイルと移植先の全ハンクを分類した。81 件の対応と台帳ラベルを台本で照合した。主な指摘（M-1、R-2〜R-5）は本レビュー担当が原文で再確認した |
