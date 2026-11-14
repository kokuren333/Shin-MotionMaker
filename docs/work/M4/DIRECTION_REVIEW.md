<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# レビュー発注書 M4R — GUI の実装者以外によるレビュー

- 作業 ID：`M4R`
- 担当：Codex 6.1 sol 高（実装者 Opus とは別製品）。共通部の「最終報告（REPORT.md）」は、このレビューでは `REVIEW.md` に読み替える（REPORT.md は書かない）。**コードを直さない。** 指摘を書くだけ。見た目の好みは判断しない（要件に照らした客観的な点だけ）。
- 作業ツリー：`<作業ツリー>\m4`（ブランチ `m4-gui`）。書き込んでよいのは `docs/work/M4/REVIEW.md` だけ（コミット `M4R: review GUI`）。
- 入力：`docs/REQUIREMENTS.md` §7（GU-01〜GU-17）、§2.2（PH-03・PH-04・PH-06）、§3.1（AR-01・AR-03・AR-04・AR-06）、§9.2 TS-08。`docs/CONTRACT.md`、`docs/work/M4/REPORT.md`、`docs/DESIGN.md`、`git diff main...m4-gui`。原典（読み取り専用）`<原典>` の `src/App.tsx`・`docs/requirements/2026-11-13-explainer-ui-harness.md`（UI-11 の機能一覧 L356 付近）。

## 観点

1. **GU-02 機能の欠落**：原典 UI-11 の各機能が移植されているか。原典 `App.tsx` の機能（入力欄、モード別の保持、添付、統計、準備度、失敗チェックリスト、ゴースト結果の読み込み、サンプル、情報ダイアログ等）と新 GUI を1つずつ突き合わせ、落ちたもの・挙動が変わったものを列挙する。REPORT の「GU-02 → e2e テスト」の対応表が実際のテストと合っているか。
2. **生成の同一性**（AR-01・AR-06・GU-03・GU-04）：生成ロジックを再実装していないか（core を使っているか）。`request.json` の書き出し・読み込みが core の `validateRequest` を通るか。GUI 経路の ZIP が CLI 経路と同じバイトになることのテストが実際に比較しているか。`mimeTypeFor` を使っているか（CONTRACT M-3）。`version.json` と `generator` の値の出どころ（M-4）。
3. **PH-03・PH-04・PH-06**：助言を不合格の色・記号で表示していないか（GU-05）。ゲートと助言が別区画か。`review_mode: self` と免除の明示。候補が既定で選択されず、追記の操作をしたときだけ入るか。seed が固定でないか。4つの様式が同格か（並び、既定の強調）。
4. **GU-01・GU-08・GU-15・GU-16**：外部 CDN・永続化・バックエンドが無いか。色の直値が `tokens.css` の外に無いか（例外の範囲）。トークンが正本の値と一致するか。相対パス・サブパス。コントラスト・キーボード・390px・1440×900・reduced-motion のテストが実際に検証しているか。
5. **テスト**：`git` を起動していないか（ビルドスクリプトは可、テストは不可）。e2e がブラウザ不在で黙ってスキップしないか。ci-local（`npm test --workspaces --if-present`・`npm run build --workspaces --if-present`）で何が実行されるか。
6. **層**（AR-03）：`gui` が `src/host`・`src/cli`・`src/mcp` を import していないか。

実行してよいもの：作業ツリー内の `npm ci`・`npm test`・`npm run build`・GUI のテスト・e2e、`node tools/ci-local.mjs`。

## 出力

`docs/work/M4/REVIEW.md`：結論（`承認`／`条件付き承認（必須修正あり）`／`差し戻し`）、指摘（`必須`／`推奨`／`参考`、ファイルと行、根拠となる要件 ID、直し方）、GU-02 の突き合わせ表。最終メッセージにも結論と必須指摘。
