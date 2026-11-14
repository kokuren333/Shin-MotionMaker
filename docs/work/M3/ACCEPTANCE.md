<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# M3 受け入れ判定（L2）

- 判定：**合格（条件付き：ubuntu／Node 22 の実行証拠は持ち越し）**（2026-11-14 19:58、main f40fb77 に --no-ff マージ）

| 受け入れ条件（§11.2 M3） | 証拠（L2 実測） |
| --- | --- |
| TS-04（Tier A） | m3 で npm test 209件（207 pass／2 skip（OS 専用）／0 fail）。SDK クライアントで stdio 起動、tools/list スナップショット、generate→status→project_get→qc、E_DEPS_MISSING、E_PATH_DENIED（junction・symlink・ジョブ内リンク・ハードリンク）、read-only、stdout の純度 |
| TS-04（Tier B） | 実装者がこの PC で generate→setup→validate pass を記録（M3 REPORT）。CI（ci.yml）に ubuntu の Tier B ジョブを追加（実行はリモート作成後） |
| TS-05 | MCP と host.execute、および CLI 封筒の result と MCP の structuredContent.result の一致テスト（M3-fix で CLI 側を追加） |
| スナップショット | tests/fixtures の MCP ツールのスナップショット（outputSchema 含む） |
| 交差レビュー | M3R（Opus 高）条件付き承認 → M3-fix。L2 が M3R の probe を再実行：PNG 2/3 MiB を既定クライアントで受信可（修正前は 3 MiB で接続断）、上限超は封筒で拒否・接続維持、run_get に利用者名なし（~ に置換）、深い入れ子は E_INPUT_INVALID。`smm mcp serve --root <存在しない>` は E_PATH_DENIED・rc2 |
| ci-local | マージ後 RC=0（ルート 207 pass、GUI 33、e2e 42） |

契約の変更（L2 承認）：MCP の画像は image ブロックだけで送る（structuredContent の data は null）、MCP の PNG 上限 6 MiB。
残課題：ubuntu／Node 22 での TS-04（symlink の dir 分岐、ExperimentalWarning の扱い）・Tier B の CI 実行。
