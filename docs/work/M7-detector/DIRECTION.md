<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# 発注書 M7-detector — git 検出器の退行の修正（G4R2-R1）

- 作業 ID：`M7-detector`
- 担当：L3 Codex 6.1 sol 高
- 作業ツリー：`<作業ツリー>\m7det`（ブランチ `m7-detector`、main `7d92314` から分岐。L2 作成済み）
- 入力：`docs/work/M7/G4_REVIEW.md` の「再確認（G4R2）」節の推奨 G4R2-R1、`tests/helpers/git-detector.ts`、`tests/no-git.test.ts`、`tests/fixtures/git-detector-samples.json`、REQUIREMENTS §8.2 CI-01

## やること

M7-fix で AST 版になった git 検出器が、置換を含むテンプレートリテラル（例：``execSync(`git show ${ref}`)``、``spawn(`git`, …)``、``exec(`${tool} …`)`` のうち先頭が git のもの）を見逃すようになった（旧版は検出していた）。

1. テンプレートリテラルの静的な先頭部分（最初の置換より前の文字列）が `git`（の後に空白・終端・置換）で始まる場合を検出する。文字列連結（`"git " + ref`）も同様に。
2. `git-detector-samples.json` の陽性サンプルに上の形を足し、陰性サンプル（`digit`、`.gitkeep`、`gitignore` を含む文字列、コメント中の git）も保つ。旧版で検出できていた陽性サンプルが新版でもすべて検出されることを表明する。
3. このテスト自身が git を起動しないこと。

## 受け入れ条件

`npm test` と `node tools/ci-local.mjs` が合格。`docs/work/M7-detector/REPORT.md`、コミット先頭 `M7-detector:`、作業ツリーをクリーンに。
