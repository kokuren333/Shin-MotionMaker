<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# 発注書 M7-final — GUI テスト期待値の整合（M7-fix-Q1 の回答）と統合コミットの最終確認

- 作業 ID：`M7-final`
- 担当：L3 Codex 6.1 sol 高
- 作業ツリー：`<作業ツリー>\m7final`（ブランチ `m7-final`、main から分岐。M7-gui と M7-fix はマージ済み。L2 作成済み）
- 入力：`docs/work/M7-fix/QUESTIONS.md`（M7-fix-Q1）、`docs/work/M7-fix/REPORT.md`、`docs/work/M7-gui/REPORT.md`、`docs/work/M7/G4_REVIEW.md` の R-2

## L2 の回答（M7-fix-Q1）

R-2 の原典互換（2人目は `characterMode: "duo"` のときだけ検査）が正しい。GUI のテストの期待値の方を直す。**この作業では `gui/tests/request-io.test.ts` と `gui/e2e/run.mjs` の該当2箇所の変更を許可する**：2人目の不正な配置を拒否する例には `characterMode: "duo"` を明示する。あわせて「solo のとき2人目の不正な値は拒否しない（原典どおり）」ことも同じテストで表明する。テストの意図（M4R R1：不正な列挙値で画面が消えない、入力と添付を残す）は弱めない。

`docs/work/M7-fix/QUESTIONS.md` の回答欄に上の回答を記入する。

## 最終確認

1. `npm ci` → `node tools/ci-local.mjs` が終了0（本体・GUI 単体・e2e・ライセンス・ビルド）。
2. `npm run build` 後に `node tools/verify-cli.mjs`（出力は追跡外）が終了0。
3. `VERIFICATION.md` が M7-gui と M7-fix の両方の追記を矛盾なく含むこと（マージで重複・食い違いがあれば整理する。記録の内容は変えない）。最終コミットと ci-local の結果を追記する。Tier C の実測コミット（`c0d10ca`）と最終コミットの差分が `gui/`・`docs/`・テストだけであることを `git diff --stat` で確かめて記録する（実行経路のコードに差が無いこと）。

## 報告

`docs/work/M7-final/REPORT.md`。コミット先頭 `M7-final:`。作業ツリーをクリーンに。
