<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# 差し戻し発注書 M1-fix — 交差レビュー M1R の反映

- 作業 ID：`M1`（修正）
- 担当：L3 Codex 6.1 sol 高（M1 の実装担当）
- 作業ツリー：`<作業ツリー>\m1`（ブランチ `m1-core`）
- 入力：`docs/work/M1/REVIEW.md`（Opus による交差レビュー。**全文を読む**）、`docs/work/M1/REPORT.md`、`docs/PORTING_LEDGER.md`、`docs/CONTRACT.md`、REQUIREMENTS §6・§9.1

## L2 の裁定（直すもの）

1. **必須 M-1**：`tests/generate-job.test.ts` の拒否テストに、原典のケースごとの期待値を戻す（E_INPUT_INVALID は `details` の `pointer` 集合、E_FORM_INVALID は原典の正規表現で文言を表明）。台帳を実態に合わせる。
2. **必須 M-2**：`validate.mjs` の R4 追加部分（`reports/validate.json` の書き出し）を `try/catch` で包み、失敗しても標準出力・標準エラー・終了コードに影響させない。書き込めないケース（`reports` がファイル）のテストを足し、原典との stdout・stderr・status の一致を表明。`allowed-diffs.json` の R4 `appends` を更新。
3. **R-1**：`job-template/AGENTS.md` の「方向性のたたき台」の免責（MV L49 付近・解説 L185 付近）の置換先を「Shin-MotionMaker（GUI・CLI・MCP）の」にする（要件 §6.2 R1 の例示どおり。候補の出どころを挙げるだけで JT-03 には当たらない）。GUI 固有の文（ゴースト結果を開く、チェックリスト）は現状のまま。R1 の置換対を分けて `allowed-diffs.json` に記録。
4. **R-2**：MV フォーム設定の照合を、原典 `explainer.test.ts` L110〜115・L222〜226 の入力（解説 form に設定を重ねて `switchVideoMode(…, "mv")`）から組み立てる形にする。
5. **R-3**：解説の brief で R5 の置換先が存在すること、特定のモデル名が残っていないことを積極的に表明する。
6. **R-4**：選択肢 (a)。書き出したファイルから host 相当の読み込み無しに検証できる範囲で、パス指定の添付の MIME・サイズ（`.PDF`、`.glb`、`.WAV`、`.unknown`）を `mimeTypeFor` で表明する。独立したテンプレート読み込みとの比較は M2a（host のテンプレート読み込み）で行うため、`test.todo` の名前に明記して台帳を「M2a に移送」と正確に書く。
7. **R-5**：台帳の原典行番号を `262c798` の実際の値に直す。
8. **I-4**：`mimeTypeFor` を原典 `path.extname` と同じ意味にする（ドットで始まる名前は拡張子なし → `application/octet-stream`）。
9. **I-6**：git 起動の検出対象に、テストから起動・import される `tools/` のファイルを足す（または `tools/` 全体を対象にして、開発ツールとして git を使う `tools/ci-local.mjs`・`tools/capture-baseline.mjs` を名前で明示的に除外する）。
10. **I-7**：R4 の差分実行テストに解説のケースを1件足す。
11. **I-8**：未使用 import の除去。`porting-ledger.test.ts` は件数のしきい値だけでなく、基線の全テスト名が台帳に1対1で載っていることを表明する。

I-2（ジョブ README のモデル名）・I-3（JT-11(2) の文言と R4）は L2 が L1 への質問として記録する。手を入れない。I-5 は記録のままでよい。

## 受け入れ条件

- `npm test` 合格、`node tools/ci-local.mjs` 合格。
- REPORT に「M1-fix」節（指摘 → 対応の表、実行結果）。
- コミット先頭 `M1:`。作業ツリーをクリーンに。
