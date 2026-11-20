# SEEDANCE — 進行台帳（L2）

時刻は UTC。秘密情報・絶対パス・メールアドレスは書かない（AGENTS.md 規則6）。

| # | 時刻 | 担当 | 内容 | 実測・証拠 |
| --- | --- | --- | --- | --- |
| 1 | 2026-11-20T03:49Z | L2 | 作業フォルダ（プロジェクトルート）へのアクセスを実測 | `pwd` がプロジェクトルート、`git log -1` = `b2d14a0`（main、作業ツリー clean）、`package.json` version 0.1.1。絶対パスは追跡対象外の `_handoff/SEEDANCE_LOG.md` に記録 |
| 2 | 03:49Z | L2 | 前提の再検証 | Node v24.15.0、Python 3.12.10。`ARK_API_KEY` は Process／User／Machine すべて未設定、repo 直下に `.env` 系ファイルなし、`SEEDANCE_DRY_RUN`・`SEEDANCE_BUDGET_USD` 未設定。Python の `arkruntime`・`volcenginesdkarkruntime` は `find_spec` が None（未導入）。ffmpeg 9.0.2（手元 PATH）。`gh` CLI は手元に無い（PR は push 後に作成手段を確認） |
| 3 | 03:49Z | L2 | 作業ブランチ `seedance-backend` を main `b2d14a0` から作成 | `git switch -c seedance-backend` |
| 4 | 03:55Z | L2 | 既存構造の把握と設計確定 | 操作定義表（`src/host/operations.ts`、23 操作、MCP 20 ツール）、`project.json` の opt-in は `asset_generation.video_generation`（`src/core/project.ts`）、エラーコード列挙は増やさない方針。設計メモ [DESIGN.md](DESIGN.md)、質問 [QUESTIONS.md](QUESTIONS.md) Q1〜Q3 |
| 5 | 03:58Z | L2→Fable | Fable ゲート（設計審査のみ、実装なし）を起動 | 起動時のモデル指定は `fable`（発注の「Fable 5.2」に相当する Fable 系。実体の版は実行環境の割り当てに従う） |
| 6 | 04:05Z | Fable→L2 | Fable ゲートの判定「進行可」（致命なし、重要6・軽微多数） | 重要：report 許可パス、E2E の env サニタイズ、予算判定の原子性、unknown の予約計上、POST の 5xx リトライ範囲、creating 孤児の回収。全件を [DESIGN.md](DESIGN.md) §11 に反映。孤児の creating は Fable 案の `error` ではなく、より安全な `unknown`（予算に予約したまま）へ落とす。report 許可パスはオーナー確認事項 Q4 |
| 7 | 04:10Z | L2→L3 | L3-A（バックエンド本体＋単体テスト）と L3-D（文書）を並行で起動 | 工学の第一候補 Codex 6.1 は本セッションのサブエージェントとして起動できないため、発注の代替指定どおり Opus 5.5（effort 中）を使う。L3-A の範囲は `src/host/seedance/*`・`tools/make-seedance-mock.mjs`・`tests/seedance.test.ts` の新規のみ、L3-D は `docs/SEEDANCE.md` 新規と CLI/MCP/CONTRACT への追加のみ。コミットは L2 |
| 8 | 04:15Z | L3-D→L2 | 文書の完了報告 | `docs/SEEDANCE.md` 新規 253 行、CONTRACT +101・CLI +21・MCP +24。`git diff docs/CLI.md docs/MCP.md docs/CONTRACT.md` の削除行 0（追加のみ）。`ARK_API_KEY` への代入はプレースホルダー2か所だけ。CONTRACT §12 の型と CLI オプション名は統合後に L2 が実装と照合する |
| 9 | 05:38Z | L2（後任） | 後任引き継ぎ（前任統括は 04:12Z、バックグラウンド待機の10分上限で停止。L3-A のサブエージェントも同時に停止） | `git log -1` = `91c8094`。未コミット：`docs/SEEDANCE.md`（新規）、CLI/MCP/CONTRACT の追記、`src/host/seedance/` 11 ファイル、`tests/seedance.test.ts`、`tools/make-seedance-mock.mjs`。オーナー委任の Q4 決定（`report_get` の許可に `seedance/out/` を追加するだけ、新規ツールなし）を受領。以後、実働は前面のみ・10分以内の単位で進め、区切りごとにこの台帳へ記録する |
| 10 | 05:45Z | L2 | L3-A の成果を実測で検査し、救済コミット | `tsc --noEmit` 成功。`node --test tests/seedance.test.ts` 14 件すべて成功（失敗 0）。秘密・絶対パス・メールの走査で該当なし。コミット `1a58ea8`（backend＋単体テスト＋モック生成ツール）、`9cf7491`（文書）。未了：操作定義表・入出力スキーマ・CLI・MCP・doctor への接続、`report_get` の許可追加（Q4 決定）、固定値の更新、CLI／MCP の E2E。L2 が統合として前面で実施する |
| 11 | 05:58Z | L2 | 統合の実装（前面）：操作定義表に3操作を追加、入出力スキーマ・型・doctor の `seedance` チェック（`disk` の直前）・`report_get` の許可に `seedance/out/*.png|*.json`（Q4 決定）・host の再輸出。`schemas/`（22 件）と `tests/fixtures/mcp-tools.json`（23 ツール）を生成ツールで更新。既存テストの固定値（MCP 20→23、操作 23→26）を更新 | `tsc --noEmit` 成功。この後、関係テストを実行する |
