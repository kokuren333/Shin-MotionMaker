<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# レビュー発注書 M0R — `docs/CONTRACT.md` 初版の交差レビュー

- 作業 ID：`M0R`
- 担当：Opus 5.5（実装者 Codex とは別製品・別コンテキスト）。**コードを書かない。CONTRACT.md を直さない。** 指摘を書くだけ。
- 作業場所：プロジェクトルート `<repo>`（ブランチ `main`）。書き込んでよいのは `docs/work/M0/REVIEW.md` だけ（コミットする。メッセージ `M0R: review CONTRACT.md`）。
- 入力：`docs/REQUIREMENTS.md`（全文。特に §2.4、§3、§4、§5、§6.2、§12）、`docs/CONTRACT.md`、`docs/work/M0/REPORT.md`。必要に応じて原典 `<原典>`（読み取り専用）の `src/job.ts`・`tools/generate-job.ts`・`job-template/runtime/scripts/*.mjs`。

## 観点

1. **要件との一致**：CONTRACT が REQUIREMENTS の MUST（AR-01〜06、CL-01〜12、MC-01〜15、PH-03〜06、§2.4 F1〜F6、§5.4）と矛盾しないか。抜けている契約はないか（後続の M1・M2a・M2b・M3・M4 が並行で依存する）。
2. **床と天井**：操作定義表に場面・演出を操作する種別がないか（F5、D-09）。`job_status`・`direction_candidates` に合否・スコア・順位が無いか（MC-07）。助言が `ok`・`verdict`・終了コード・`isError` を変えない設計か（PH-03）。候補が自動で入力に入らないか（PH-04）。seed の扱い（PH-06）。
3. **層と依存**：core が純粋（`node:*`・DOM 不使用）で、テンプレート読み込みが host 側にあるか。CLI・MCP が host の同じ関数を呼ぶ構造か。
4. **曖昧さ**：並行する L3 が別々に解釈しうる箇所（型、エラーコードの使い分け、run の状態遷移、終了コードの対応、パスの表現、`wait_ms` の既定値、上限時間）。
5. **原典との対応**：原典の関数名との対応表が正しいか、`MotionForm` のキーを変えていないか。ジョブ内スクリプトの終了コード対応（CL-07）が原典のスクリプトの実際と合うか。

## 出力

`docs/work/M0/REVIEW.md`：

- 結論：`承認` ／ `条件付き承認（必須修正あり）` ／ `差し戻し`
- 指摘の一覧（重大度 `必須`／`推奨`／`参考`、CONTRACT の該当箇所、根拠となる要件 ID、直し方の提案）
- 標準出力の最終メッセージにも結論と必須指摘を書く。
