<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# マイルストーンの最終判定（L2）

各作業の発注書は `docs/work/<作業ID>/DIRECTION*.md`、L2 の受け入れ判定と証拠は `docs/work/<作業ID>/ACCEPTANCE.md`、レビューは `REVIEW.md`。進行の全記録は `docs/work/L2/ORCH_LOG.md`。

| 作業 | 内容 | 判定 | main のコミット | レビュー |
| --- | --- | --- | --- | --- |
| M0 | 立ち上げと基線採取 | 合格 | 6bb8c5b | M0R（Opus）→ M0b で CONTRACT 改訂 |
| M5 | アイコン | 合格 | main へ 8c984d4 でマージ | M5R → M5-fix → M5R2 承認 |
| M1 | コアの移植 | 合格 | 288b0ab | M1R（Opus）→ M1-fix、L2 再実測 |
| M2a | host | 合格（条件付き：ubuntu 未実行） | 0787aea | M2aR（Opus）→ M2a-fix、probe 再実行 |
| M4 | GUI | 合格 | 00065e3 | M4R（Codex）差し戻し → M4-fix |
| M2b | CLI | 合格 | 91c939f | L2 の手動確認 |
| M3 | MCP | 合格（条件付き：ubuntu/Node22 未実行） | f40fb77 | M3R（Opus）→ M3-fix、probe 再実行 |
| M6 | 文書 | 合格 | 7741d95 | L2 がコマンド例を再実行 |
| M7 | 統合と実機検証（M7・M7-add・M7-gui・M7-fix・M7-final・M7-detector） | 合格 | 17d8112 | G4（Opus）条件付き合格 → 必須解消 → G4R2 条件付き合格（工程記録のみ）→ L2 台帳で解消 |

縮退と持ち越し：`docs/work/L2/ENVIRONMENT.md`。オーナーへの質問：`docs/work/L2/OWNER_QUESTIONS.md`。L1 への質問：`docs/work/L2/QUESTIONS.md`。

## M8 以降

| 作業 | 状態 |
| --- | --- |
| M8 公開 | **停止（オーナー判断待ち）**：Q-01、main をリモートへ出す経路、author のメールアドレス。`OWNER_QUESTIONS.md` |
| M9 Fable レビュー | M8 完了後に別途起動（L2 は起動しない） |
