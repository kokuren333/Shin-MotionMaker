<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# 発注書 M1 — コアの移植（core・job-template・同梱フォント・原典テスト・基線照合）

- 作業 ID：`M1`
- 担当：L3 Codex 6.1 sol 高
- 作業ツリー：`<作業ツリー>\m1`（ブランチ `m1-core`、`main` の M0 完了時点から分岐。L2 が作成済み）
- 入力：`docs/REQUIREMENTS.md` §2（全体。特に PH-01〜PH-08 と §2.4）、§3.1（AR-01〜AR-06）、§3.3（移植方針の表）、§4.2（CL-01・CL-02）、§6（全体）、§9.1（P1〜P4、TS-01）、§11.2 の M1 行。`docs/CONTRACT.md`（M0 で作成、L2 の交差レビュー済み。**契約に従う。変える必要があれば QUESTIONS.md**）。`tests/fixtures/baseline-biimmotion-262c798/`（M0 で採取した基線）と `PROVENANCE.md`。
- 原典：`<原典>`（`262c798`、読み取り専用。M0 の複製 `<スクラッチ>\biim-262c798` を使ってよい）

**この作業は MV と共有するコードを扱う危険度の高いタスクで、完了後に別製品（Claude Opus）による交差レビューが入る。** 表明の変更・許容差分の拡大は必ず台帳に残すこと。

**CONTRACT は M0R のレビューを受けて M0b で改訂済み**（`docs/work/M0/REVIEW.md` と CONTRACT 冒頭の改訂履歴を読む）。特に M1 に関わるもの：R-7（原典の export を core の `index.ts` から同名で全部 export、`StyleMode` は `caption-capacity.mjs` から再 export）、M-3（core の `mimeTypeFor`）、M-4（`src/core/data/version.ts`、`generator` のキー位置、`TEMPLATE_MANIFEST_SHA256`）、M-5（`reports/validate.json` の形）、R-3（`buildJobFiles` の例外を `SmmError` に）、R-8（候補の文脈の写し方と `seed` の返却）、`docs/work/M0/QUESTIONS.md` の回答（Q2：URL 行番号だけ正規化）。基線は 11 ケース（`explainer-attachments` を含む）。

## 1. やること

### 1.1 `src/core`（§3.3）

- 原典 `src/job.ts` を、CONTRACT.md のモジュール構成どおりに役割ごとに分割して移す。`MotionForm` のキー、既定値、`validateForm` の文言、`createProject` の出力は変えない（R2 の `schema_version: "0.5"` と `generator` の追加を除く）。
- `src/mv-assist.ts`・`src/explainer-assist.ts` → `src/core/assist/`、`src/biim-standard.json`・`src/font-assets.json` → `src/core/data/`。そのまま。
- 原典 `tools/generate-job.ts` L44〜115 の入力検査（未知キーの拒否、型の検査、`defaults` との合成、`validateForm`）を core の1つの関数（CONTRACT の `validateRequest`）へ移す（AR-04）。エラーは CONTRACT のエラーコード（`E_INPUT_INVALID`・`E_FORM_INVALID`）と `hint` を持つ構造で返す（F3）。`validateForm` のエラー種別を増やさない（F2）。
- ジョブのファイル一式の構築（`buildJobFiles` 相当）と ZIP 化を core に置く。テンプレートの中身は**引数**で受け取る（core は `node:*` と DOM を import しない）。原典 `src/templates.ts`（Vite glob）の除外規則と、`tools/generate-job.ts` L122〜124 の除外規則が同じ結果になるよう、除外規則を core の1か所に定義する。ZIP の形（ファイル名 `<タイトル>-motion-job.zip`、ルート `safeName(タイトル)`）を保つ。
- 方向性のたたき台：PH-06（seed 省略時に固定値にしない。指定時は同じ結果）。core は純粋なので、seed 省略時の乱数源は呼び出し側から注入する形でよい（CONTRACT に従う）。
- `src/core` は ブラウザと Node の両方で動くこと。

### 1.2 `job-template/` と同梱フォント（§6）

- 原典 `job-template/**` を `job-template/**` へ、原典 `public/job-assets/fonts/` を `job-assets/fonts/` へ、**バイト単位で**写す。そのうえで許容差分 R1・R3・R4・R5 だけを当てる（R2 は `createProject`）。
  - R1：製品名・入口名の置換。置換の対を1件ずつ `allowed-diffs.json` に列挙する（M0 の初版を確定させる）。
  - R3：ジョブの `NOTICE` の追加と、ジョブ `README.md` への「CLI・MCP から使う」節の追記（追加だけ。ジョブ単体では `npm run` が正であると書く。節は明確な見出しで区切る。文面の推敲は M6 で Opus が行うので、ここでは正確で簡潔な初版でよい）。**JT-03：`job-template/AGENTS.md` には CLI・MCP を前提にした記述も repo 文書へのリンクも入れない。**
  - R4：`runtime/scripts/validate.mjs` が `reports/validate.json`（各検査の名前・状態・メッセージ、助言）も書く。**標準出力と終了コードは変えない。** MV で `validate --final` が解説の記録を要求しないことも変えない。スキーマ名は CONTRACT に従う（`smm.validate-report/1` 等）。
  - R5：解説の `brief.md` の特定モデル名（「Opusが記入する」など）を「制作エージェント」に。MV の生成物には触れない。
- JT-02：`job-template/` に開発用のメモ・ログ・下書きを置かない。JT-04：ひな形は `plan/templates/` に置き、検査対象のパスに置かない（原典どおり）。

### 1.3 原典テストの移植（§9.1）

- 原典の8ファイルをすべて `tests/` へ移す。表明を変えてよいのは P1〜P4 だけ。変えた箇所は `docs/PORTING_LEDGER.md` に1件ずつ（原典の位置、変更後、種別）記録する。
- `explainer.test.ts` L210 付近の基線テスト（`git show 955fa5c`）は、JT-11 の基線照合テストに置き換える（P3）。**`git` を起動しない。**
- `generate-job.test.ts` は CLI `generate` のテストとして M2b で完成させる（P4）。M1 では、core のレベルで検証できる性質（最小入力と既定値、未知キー・型の誤り・検査エラーの拒否、GUI と同じバイトになること＝core の `buildJobFiles` の出力）を core のテストとして移し、CLI 固有の部分（起動方法・終了コード・出力先の扱い）は `test.todo` などで残して台帳に「M2b に移送」と書く。
- TS-01：`docs/PORTING_LEDGER.md` に、基線 `test-inventory.json` の全テスト名ごとに、移植先のテスト名（または置き換え先、M2b への移送）を対応づける表を置く。削ったテストがあってはならない。この対応表が基線と一致することを表明するテスト（例：`tests/porting-ledger.test.ts`。台帳の機械可読部分を JSON で `tests/fixtures/` に置いてもよい）を置く。

### 1.4 基線照合テスト（JT-11）

`tests/baseline.test.ts`（名前は任意）で次を表明する：

1. `job-template/` と `job-assets/fonts/` の各ファイルのハッシュが、許容差分を除いて基線 `template-manifest.json` と一致する。許容差分のあるテキストは、置換の対を**逆に**当てた結果（R3・R4 の追加部分は取り除いた結果）が原典のハッシュと一致する（JT-01）。基線に無いファイル（R3 の `NOTICE` など）は許容差分表に載っているものだけ。
2. 各 golden ケースについて、`src/core` の出力（`project.json`・`brief.md`・依頼文・`plan/lyrics.txt`・ZIP の目録）が、許容差分（R1・R2・R5）を除いて基線とバイト一致する。**MV のケースで許す差分は R2 と、同梱文書の R1・R3 だけ。MV の `brief.md`・`plan/lyrics.txt`・依頼文はバイト一致。**
3. `validateForm` が返すエラー文言の集合が `validate-form-messages.json` と一致する。

### 1.5 アーキテクチャテスト（AR-03）

`tests/architecture.test.ts`：import 文を走査し、`src/core` が `node:*`・`src/host`・`src/cli`・`src/mcp`・`gui` を import しない／`src/cli` と `src/mcp` が互いを import せず、`node:fs`・`node:child_process`・`job-template` を直接 import しない／`gui` が `src/host`・`src/cli`・`src/mcp` を import しない。まだ存在しないディレクトリは空として扱い、走査が働くことを陽性サンプルで表明する。

## 2. 受け入れ条件（L2 が実測する）

- [ ] `npm test` が合格。移植後のテスト件数が基線の件数以上（M2b へ移送したものを除いた数と、移送分の一覧を明示）。
- [ ] TS-01：台帳の対応表が基線の全テスト名を覆う。
- [ ] JT-11 の3項目が合格。
- [ ] AR-03 が合格。
- [ ] `docs/PORTING_LEDGER.md` の変更種別が P1〜P4 だけ。
- [ ] `node tools/ci-local.mjs` が合格。
- [ ] 交差レビュー（Opus、L2 が別途発注）で重大な指摘が無い、または解消済み。

## 3. 報告

`docs/work/M1/REPORT.md`。許容差分 R1 の置換の対の一覧、`allowed-diffs.json` の最終形、移植で迷った箇所（MV に関わるもの）を必ず書く。
