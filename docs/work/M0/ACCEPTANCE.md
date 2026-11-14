<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# M0 受け入れ判定（L2）

- 判定：**合格**（2026-11-14 16:40、main HEAD 6bb8c5b）

| 受け入れ条件（§11.2 M0） | 証拠（L2 が実測） |
| --- | --- |
| 基線フィクスチャと PROVENANCE.md がコミット | `tests/fixtures/baseline-biimmotion-262c798/`：template-manifest（60項目）、golden 11ケース（M0b で explainer-attachments 追加）、validate-form-messages、test-inventory、allowed-diffs、PROVENANCE.md |
| 基線のテスト件数が記録 | test-inventory.json：count 81、tests 配列 81件、passed 81 |
| 骨格で CI と同じコマンドが合格（git 検出テスト含む） | `node tools/ci-local.mjs` RC=0（35b3c20 で 5/5、6bb8c5b で 6/6 pass）。no-git.test.ts を含む |
| CONTRACT.md を別コンテキストが確認 | M0R（Opus 5.5 高）docs/work/M0/REVIEW.md：条件付き承認 → M0b で M-1〜M-6・R-1〜R-14 を反映。L2 がキーワード照合（restrictToRoot、JobPath/DisplayPath、mimeTypeFor、TEMPLATE_MANIFEST_SHA256、smm.validate/1、readRunLog、exposedInReadOnly、outputSchema、log_offset 等）で反映を確認 |
| ルート AGENTS.md に宣言文 | agents-declaration.test.ts pass（期待値は REQUIREMENTS §2.3 から機械抽出） |
| その他 | `git ls-files _handoff` 0件、ローカル絶対パス・メールの git grep 0件、原典 status 空・HEAD 262c798、リモート 0 件 |

残課題：ubuntu／Node 22 での実行はリモート作成後（Q-01）。
