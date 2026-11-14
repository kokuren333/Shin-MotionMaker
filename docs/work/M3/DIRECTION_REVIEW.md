<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# レビュー発注書 M3R — MCP の交差レビュー（安全検査）

- 作業 ID：`M3R`
- 担当：Opus 5.5（実装者 Codex とは別製品・別コンテキスト）。**コードを直さない。** 指摘を書くだけ。
- 作業ツリー：`<作業ツリー>\m3`（ブランチ `m3-mcp`）。書き込んでよいのは `docs/work/M3/REVIEW.md` だけ（コミット `M3R: review MCP`）。
- 入力：`docs/REQUIREMENTS.md`（§2.4、§5 全体、§9.2 TS-04〜TS-06）、`docs/CONTRACT.md`、`docs/work/M3/REPORT.md`、`docs/MCP.md`、`docs/work/M2a/REVIEW.md`（host のレビュー。既知の残るリスク）、`git diff main...m3-mcp`。

## 観点（危険度順）

1. **公開面の制御**（MC-03、MC-04）：任意コマンド実行の経路がないか（ツールの入力からスクリプト名・オプション・環境変数・作業フォルダを差し込めないか）。`--read-only` で書き込み・run のツールが本当に公開されないか（`tools/list` と、非公開ツールの名前を直接 `tools/call` した場合の両方）。`job_imagegen` が `--enable-generation` なしで呼べないか。`job_voice` の engine_url の許可、`doctor` の Aivis 疎通の許可。
2. **パス**（MC-02、CONTRACT M-2）：すべてのツールのパス引数が host の検査を通るか（取りこぼしたツールがないか）。`--allow-dir` は `request.assets` の絶対パスだけか。出力（`structuredContent`・テキスト・画像・ログ末尾・エラーの details）に root の外の絶対パス・利用者名が漏れないか。
3. **プロトコル**（MC-01、TS-04-6）：標準出力にプロトコル以外が混ざらないか（子プロセスの出力、警告、`console.log`、SDK の警告）。異常系（不正な JSON-RPC、巨大な入力、未知のツール）でサーバーが落ちないか。
4. **入力スキーマ**（§5.2、MC-06、F1・F5）：`additionalProperties: false`。創造に関わる入力が自由記述の文字列のままか。場面・演出を操作するツールがないか（D-09）。スナップショットが実物と一致するか。
5. **結果**（PH-03、MC-07、CL-06、M-1）：`isError` が `ok:false` のときだけ真か。ゲートの fail で真にしていないか。助言が合否を変えないか。`job_status`・`direction_candidates` に合否・スコア・順位がないか。「たたき台」の明示（PH-04）、seed の非固定（PH-06）。
6. **run の待ち方**（MC-12〜MC-15）：`wait_ms` の範囲と既定値、`run_get`、取り消し、進捗通知。
7. **テスト**：TS-04 の各項目（特に 5：ジャンクション・シンボリックリンク・read-only）が実際に SDK のクライアント経由で検証しているか。Tier B の記録。`git` を起動していないか。
8. **依存**：SDK の版の固定、推移依存のライセンス、NOTICE。

実行してよいもの：作業ツリー内の `npm ci`・`npm test`・`node tools/ci-local.mjs`、作業ツリー外の一時フォルダ（`<スクラッチ>\m3r\`）での試行（SDK のクライアントで実際にサーバーを起動して攻撃的な入力を試してよい）。

## 出力

`docs/work/M3/REVIEW.md`：結論（`承認`／`条件付き承認（必須修正あり）`／`差し戻し`）、指摘（`必須`／`推奨`／`参考`、ファイルと行、根拠、再現手順、直し方）。最終メッセージにも結論と必須指摘。
