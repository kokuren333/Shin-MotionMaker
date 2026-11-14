# M0b REPORT — 契約改訂と添付基線

- 実働：L3 Codex 6.1 sol / high。2026-11-14、main、Windows / Node v24.15.0。モデル切替・下請けなし（縮退レベル1相当）、自己判定ゲートなし。
- 実装：CONTRACT の M0R 裁定反映、M0 質問3件の回答、原典 CLI MIME 表による explainer-attachments 基線、11ケース検査、PDF binary 属性。
- 証拠：原典複製で基線再採取と81テスト成功・失敗0。新ケース72ファイルが原典 CLI 出力とパス・バイト・SHA-256一致。既存10ケース143本文は不変。`npm test` は6件成功・失敗0、`npm run build` は終了0、`node tools/ci-local.mjs` は深さ1の複製から全コマンド終了0。
- 決定：CLIログ差分は readRunLog、MCP log_offset は追加しない。候補のseed共通入口、run_getの平坦化、可変timeout、版目録の正規化方法、合成添付の形式を契約・採取ツールに明記した。
- 契約・要件への新規質問なし。M0-Q1〜Q3 は L2 回答を記録済み。
- 追加依存なし、ライセンス・NOTICE変更なし。
- 残課題：M1以降のAPI・スキーマ実装、M2bのexit 1実測、L2の受け入れ確認。見た目の判断なし。

発注指定の変更一覧、受け入れ条件ごとのコマンド・件数・出力、全レビュー項目 → CONTRACT の節の対応表、決定・残課題の詳細は [M0 REPORT の M0b 節](../M0/REPORT.md#m0b--m0r-の反映と添付基線の追加) に記録した。
