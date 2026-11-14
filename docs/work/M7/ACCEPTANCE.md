<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# M7 受け入れ判定（L2）

- 判定：**合格**（2026-11-14 23:00、main 17d8112）

| 受け入れ条件（§11.2 M7） | 証拠 |
| --- | --- |
| 全テスト合格 | L2 実測：main 17d8112 で ci-local RC=0（npm ci → ライセンス確認 → build → 本体 219件：217 pass／2 skip（linux・POSIX 専用、理由付き）／0 fail → GUI 単体 34/34 → 実ブラウザ e2e 42/42 → GUI build） |
| Tier C を Windows 実機で CLI と MCP の両方から | VERIFICATION.md・docs/work/M7-fix/evidence：CLI 8 run・MCP 8 run（run_get wait_ms ポーリング）すべて completed、ジョブ名に & 全角 空白（実測 c0d10ca、テンプレート 0.5.2。最終 HEAD との実行経路の差分なしを L2 と G4R2 が確認）。M7 本体（506a5a8、0.5.1）でも同様に通過。L2 は preview.png を目視 |
| JT-12（原典生成 0.4 の互換） | 原典 CLI で生成した 0.4 ジョブで status・validate（validate.json なしで終了コードと stdout から組み立て）・qc・ghost・render の 10 run |
| ci-local 合格 | 上記 |
| G4 統合レビュー | G4（Opus 高）条件付き合格 → 必須 G4-M1・G4-M2 解消 → G4R2 条件付き合格（必須は工程記録の G4R2-M1 のみ、コードの必須なし）→ L2 が台帳で G4R2-M1 を解消（本記録・STATUS・ORCH_LOG・ENVIRONMENT の転記）、推奨 G4R2-R1 は M7-detector で解消、G4R2-R2 は ENVIRONMENT と OWNER_QUESTIONS に規則を記載 |

持ち越し（M8 の前提）：ubuntu／Node 22 の CI 実行、main をリモートへ出す経路（CI-05）、Q-01、author のメールアドレス、公開コミットの Tier C（引用か取り直しかの規則は ENVIRONMENT）。
