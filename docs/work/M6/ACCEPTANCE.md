<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# M6 受け入れ判定（L2）

- 判定：**合格**（2026-11-14 20:42、main に --no-ff マージ）

| 受け入れ条件 | 証拠（L2 実測） |
| --- | --- |
| TS-06 | m6 で npm test 209件（207 pass／2 skip／0 fail）。宣言文テスト・基線照合（R3 推敲後、TEMPLATE_VERSION 0.5.2・目録ハッシュ更新）合格 |
| 文書のコマンド例の実行記録 | docs/work/M6/command-log.md（113行）。L2 が README の例を一時フォルダで再実行：doctor rc0、generate rc0（jobs/最小入力、68ファイル）、status rc0、qc pre rc1（解説・記録なし＝ゲート不合格で正しい） |
| ローカル絶対パスなし | git grep（fixtures 除外）で該当はレビュー文書中の伏字の例示のみ |

持ち越し（M7 の追補で工学タスクとして処理）：tools/verify-cli.mjs が mcp serve の旧終了コード（3）を期待して落ちる、DC-05（依存全体のライセンス一覧スクリプトと CI 実行、SHOULD）、TS-06 の「編集する人・エージェントへ」見出しの明示テスト、tests/helpers/host.ts の template_version 表記。README の clone URL は M8 で追記。
