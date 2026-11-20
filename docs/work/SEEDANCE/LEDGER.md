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
