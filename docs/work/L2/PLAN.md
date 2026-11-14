<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# Shin-MotionMaker 統括計画（L2 確定版）

- 作成：L2（Opus 5.5 高）、2026-11-14
- 正本：`docs/REQUIREMENTS.md`（PM Fable 5.2）。本計画と食い違えば正本が優先。
- 本計画は REQUIREMENTS.md §11 の案を確定したもの。PM 決定（§12）は再検討しない。

## 1. 工程（確定）

```
M0 ──▶ M1 ──▶ M2a ──▶ M2b ──┐
 │      │        └──▶ M3 ───┤
 │      └──▶ M4 ────────────┼──▶ M6(仕上げ) ──▶ M7 ──▶ M8(Q-01 待ち) ──▶ [M9 は別途 Fable]
 └──▶ M5 ───────────────────┘
```

| # | 担当 L3 | 作業ブランチ／作業ツリー | 交差レビュー | 受け入れ条件（§11.2） |
| --- | --- | --- | --- | --- |
| M0 | Codex 6.1 sol 高 | `main`（プロジェクトルートで `git init`） | CONTRACT.md を Opus 5.5（別コンテキスト）が確認 | 基線フィクスチャと PROVENANCE.md／基線テスト件数／骨格で ci-local 合格（git 検出テスト含む）／CONTRACT 確認／宣言文 |
| M1 | Codex 6.1 sol 高 | `m1-core` @ `..\Shin-MotionMaker-wt\m1` | Opus 5.5（別コンテキスト）が差分を読む | TS-01／JT-11／AR-03／PORTING_LEDGER P1〜P4 のみ／交差レビュー |
| M5 | Opus 5.5 中 | `m5-icons` @ `..\Shin-MotionMaker-wt\m5` | 見た目を別の Opus コンテキストが確認 | TS-09／`.csprite` が CyberSprite 検証合格／見た目確認／NOTICE と manifest |
| M2a | Codex 6.1 sol 高 | `m2a-host` @ `..\Shin-MotionMaker-wt\m2a` | Opus 5.5（パス検査・run の安全）| TS-07（windows 実機。ubuntu はリモート作成後の CI）／CL-11・MC-02／AR-06 |
| M4 | Opus 5.5 中 | `m4-gui` @ `..\Shin-MotionMaker-wt\m4` | Codex 6.1 sol（実装者以外）| TS-08／GU-02 全項目 e2e／スクリーンショット／レビュー |
| M2b | Codex 6.1 sol 高 | `m2b-cli` @ `..\Shin-MotionMaker-wt\m2b` | （必要に応じ）| TS-02・TS-03／CLI と GUI 経路のバイト一致 |
| M3 | Codex 6.1 sol 高 | `m3-mcp` @ `..\Shin-MotionMaker-wt\m3` | Opus 5.5（安全検査）| TS-04（A・B）・TS-05／スナップショット／交差レビュー |
| M6 | Opus 5.5 中 | `m6-docs` @ `..\Shin-MotionMaker-wt\m6` | L2 が実行確認 | TS-06／文書のコマンド例を実行した記録 |
| M7 | Codex 6.1 sol 高（統合・Tier C 実機）＋ G4 統合レビュー（Opus 5.5 別コンテキスト） | `m7-integration` | G4 | 全テスト／Tier C を CLI・MCP 両方／JT-12／ci-local／G4 |
| M8 | L2 | — | — | **Q-01 の回答待ちで停止**。リモート作成・push・Pages は行わない |

## 2. 運用規則

- 発注書：`_handoff/<MS>/DIRECTION.md`。L3 に渡すプロンプトは共通部（`_handoff/COMMON_CODEX.md` または `_handoff/COMMON_OPUS.md`）＋ DIRECTION を連結した `_handoff/<MS>/PROMPT.md`。
- 起動：`_handoff/run_<task>.bat` をスケジュールタスク（`schtasks /create /sc once /it` → `/run`）で起動。開始マーカー `<task>.started`、ログ `<task>.log`、終了マーカー `<task>.done`。
- L3 の報告：repo 内 `docs/work/<MS>/REPORT.md`（ローカル絶対パスを書かない）と、Codex の最終メッセージ `_handoff/<MS>/LAST.md`。
- レビュー：`docs/work/<MS>/REVIEW.md`。
- 完了判定：L2 が受け入れ条件を実測（テスト・ビルド・ci-local を自分で実行）し、`_handoff/<MS>/ACCEPTANCE.md` に証拠を残してから `main` へマージ（ローカル。`--no-ff`）。
- 契約（`docs/CONTRACT.md`、操作定義表、封筒スキーマ）の変更：L3 は勝手に変えず `docs/work/<MS>/QUESTIONS.md` に書いて止まる。L2 が調整する。
- リモートが無い間（Q-01）：CI は `tools/ci-local.mjs` で代替。ubuntu での実行は記録上「未実施（リモート作成後）」として残課題に積む。
