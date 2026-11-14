<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# 発注書 M7-fix — G4 推奨指摘の反映（コード・テスト・契約本文）

- 作業 ID：`M7-fix`
- 担当：L3 Codex 6.1 sol 高
- 作業ツリー：`<作業ツリー>\m7fix`（ブランチ `m7-fix`、main `14c6f16` から分岐。L2 作成済み）
- 入力：`docs/work/M7/G4_REVIEW.md`（**全文**。特に §5 推奨 R-1〜R-9 と参考 S-1〜S-12）、`docs/CONTRACT.md`、`docs/CLI.md`、`docs/MCP.md`

## L2 の裁定（直すもの）

1. **R-1**：`--detach` で worker の起動自体に失敗した場合は `ok:false`・終了4のまま返す。スクリプトがすぐ終わった場合と区別し、テストを足す。
2. **R-2**：shape 段の列挙検査を、原典 `validateForm` と同じ条件にそろえる（MV では `styleMode`・キャラクターの位置などを見ない、`duo` のときだけ2人目を見る等）。原典が受け付けていた入力を拒否しない（F2）。テストと CONTRACT の shape の説明を更新。
3. **R-3**：`allowed-diffs.json` の SHA-256 をテストで固定し、加えて R1 の対の件数と、逆変換時の各対の出現回数を照合する。
4. **R-4**：全 run 種別の `wait_ms` 既定値を表で表明するテスト。入力スキーマに `default` を載せる（MCP のスナップショットを更新）。
5. **R-5**：少なくとも generate と run の1経路のテストで、全角記号（`＆`・`（）`・全角空白・`・`）を含むパスを使う。
6. **R-6・R-9・S-10**：`docs/CONTRACT.md` の本文を実装に合わせる（qc・imagegen の入力不正のコード、shape の説明、表題の版表記）。改訂履歴に「M7-fix：G4 の R-2・R-6 を反映（L2 承認）」を足す。`docs/CLI.md` の終了コードの根拠に `docs/work/M7/evidence/cli-add.json` を加える。`VERIFICATION.md` の Tier C 表で legacy の行を「CLI（原典 0.4 ジョブ）」と明記。
7. **R-7**：`package.json` の `engines` を `>=22.12.0` にし、README の必要環境を合わせる（README の該当1行だけ。文面は既存の調子）。
8. **R-8**：`tools/runtime-smoke.mjs`・`tools/tier-b.mjs` は、実行時に HEAD のコミットと作業ツリーがクリーンであることを確かめて記録する（開発ツール。テストではない）。
9. **S-7**：PNG のサイズ超過のエラーコードを CLI と MCP でそろえる（`E_INPUT_INVALID`。上限値は CLI 8 MiB・MCP 6 MiB のまま）。
10. **L2 の所見**：`tools/verify-cli.mjs` が追跡ファイル `docs/work/M2b/CLI-EXAMPLES.json` を毎回書き換える。出力先を引数で指定する形にし、既定では追跡外（例 `.agent-work/`）に書く。
11. **S-1**：`git-detector` に `run("git"` 型のラッパー呼び出し（関数名を問わず第1引数が `"git"` の呼び出し）も検出させ、`tests/`・`gui/` のほかテストから import される `tools/` を走査対象に含める（開発ツールとして git を使う既知のファイルは名前で除外し、理由を書く）。

## 最後に：公開候補コミットでの Tier C の取り直し（G4 §6 の 5）

上の修正をすべてコミットしたあと、**main を取り込む（`git merge main`。並行の `m7-gui` が先にマージされていればそれも含む）**。そのうえで最終コミットで次を実行し、`VERIFICATION.md` に追記する：`node tools/ci-local.mjs`、Tier B（CLI・MCP）、Tier C（CLI・MCP・原典 0.4。M7 と同じ手順、ジョブ名に全角記号を含める）。記録には HEAD とテンプレートの版（0.5.2）を書く。

**触らないもの**：`gui/`（並行して Opus が `m7-gui` で文面とスクリーンショットを直している。GUI に影響する core の変更があれば REPORT に書く）、`job-template/`。

## 受け入れ条件

- `npm test`、GUI のテスト・e2e、`node tools/ci-local.mjs`、`tools/check-licenses.mjs`、`tools/verify-cli.mjs` が合格し、作業ツリーがクリーン。
- REPORT（`docs/work/M7-fix/REPORT.md`）に指摘 → 対応 → テスト名の表と、Tier B／C の再実行の要点。コミット先頭 `M7-fix:`。
