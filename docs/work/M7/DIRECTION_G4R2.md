<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# レビュー発注書 G4R2 — G4 必須指摘の解消確認と M7-fix・M7-gui・M7-final の差分レビュー

- 作業 ID：`G4R2`
- 担当：Opus 5.5 高（これまでの実装・レビューとは別コンテキスト）。**コードと文書を直さない。**
- 作業場所：`main`（`<repo>`、HEAD `ec800cb`）。書き込んでよいのは `docs/work/M7/G4_REVIEW.md` への「再確認（G4R2）」節の追記だけ（コミット `G4R2: re-review integration`）。
- 入力：`docs/work/M7/G4_REVIEW.md`（前回の G4。必須 G4-M1・G4-M2、推奨 R-1〜R-10、§6）、`docs/work/M7-gui/`・`docs/work/M7-fix/`・`docs/work/M7-final/` の REPORT・DIRECTION、`docs/work/L2/`（STATUS・ENVIRONMENT・OWNER_QUESTIONS・QUESTIONS）、`VERIFICATION.md`、`git diff 14c6f16 ec800cb`。REQUIREMENTS（§2、§3、§4、§6、§8、§9）。

## 観点

1. G4-M1：現在の GUI と `VERIFICATION.md` のスクリーンショット表が一致するか（最終コミットで GUI の表示に差が出ていないか。M7-final の GUI 変更はテストだけか）。
2. G4-M2：各作業の発注・判定・レビューが追跡ファイル（`docs/work/`）から辿れるか。ローカルの絶対パス・メールアドレス・ユーザー名が無いか（`git grep`）。
3. M7-fix の差分（R-1〜R-9、S-1、S-7、S-10）：指摘どおりか、原典互換（F2、R-2 の duo/MV 条件）を壊していないか、MV 非退行（JT-11）と §2 の思想に反しないか、テストが弱められていないか。CONTRACT の改訂が L2 の裁定の範囲か。
4. M7-gui の差分（R-10）：core の文言を変えずに GUI で補ったか、助言・ゲートの見せ方（PH-03）に影響が無いか、列挙値の直書きが無いか。
5. M7-final：GUI テストの期待値の変更が M4R R1 の意図を弱めていないか。
6. §6（M8 の前提）が `docs/work/L2/OWNER_QUESTIONS.md` と `ENVIRONMENT.md` に正しく整理されているか。

実行してよいもの：`npm ci`・`npm test`・`node tools/ci-local.mjs`（作業ツリーを汚さないこと）。

## 出力

追記節に：結論（`合格`／`条件付き合格（必須修正あり）`／`不合格`）、新たな指摘（`必須`／`推奨`／`参考`）。最終メッセージにも結論と必須指摘。
