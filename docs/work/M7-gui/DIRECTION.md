<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# 発注書 M7-gui — G4-M1（スクリーンショットの撮り直し）と R-10（読み込みエラーの文面）

- 作業 ID：`M7-gui`
- 担当：L3 Opus 5.5 中（M4 の見た目・文面の担当と同じ役割）
- 作業ツリー：`<作業ツリー>\m7gui`（ブランチ `m7-gui`、main `14c6f16` から分岐。L2 作成済み）
- 入力：`docs/work/M7/G4_REVIEW.md` の G4-M1・R-10、`VERIFICATION.md`、`docs/DESIGN.md`、`docs/work/M4/REPORT.md`、`gui/`

## やること

1. **R-10**：M7 で request.json の読み込みエラーが core の `validateRequest` の文言（「入力の構造に誤りがあります。」／hint「details の pointer が指す項目のキー・型・列挙値を修正してください。」）に変わり、GUI 利用者への「読み込み前の入力と添付はそのまま」の説明が消えた。**core の文言は変えずに**、GUI が表示するときに利用者向けの説明を補う（例：pointer を画面の項目名に対応づけて示す、入力と添付が保たれている旨を添える）。判断と理由を REPORT に。列挙値の集合を GUI に直書きしない（core の `formChoices` を使う）。e2e の R1 テストを合わせる。
2. **G4-M1**：現在のコミットで主要状態のスクリーンショットを撮り直す（`npm run shots --workspace gui` 等、M4 と同じ手順。S12 を含む全状態）。`VERIFICATION.md` の表（ファイル名・SHA-256・コミット）を更新。見た目の差（M4 時点との違い）を REPORT に書く。
3. `npm test`、GUI のテスト・e2e、`node tools/ci-local.mjs` が合格すること。

**触らないもの**：`src/`（core・host・cli・mcp）、`job-template/`、`docs/CONTRACT.md`。並行して Codex が `m7-fix` ブランチで `src/` を直している。

## 報告

`docs/work/M7-gui/REPORT.md`。コミット先頭 `M7-gui:`。作業ツリーをクリーンに。
