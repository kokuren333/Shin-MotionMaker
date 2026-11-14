<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# M5 受け入れ判定（L2）

- 判定：**合格**（2026-11-14 16:53、main へ --no-ff マージ）

| 受け入れ条件（§11.2 M5） | 証拠 |
| --- | --- |
| TS-09 | tests/icons.test.ts（16×16、manifest の SHA-256 一致、由来項目、過不足なし）。L2 実測：m5 で 9/9、main マージ後 10/10、ci-local 合格 |
| 各 .csprite が CyberSprite 検証に合格 | 制作者 REPORT：26点 error 0／warning 0、書き出し 27点 validation_ok・verified。L2 抜き取り再実行（advisory・gate・app）ok:true。M5R2 も直した5点を再実行 |
| 見た目を別コンテキストが確認 | M5R（Opus 高）条件付き承認 → M5-fix → M5R2（Opus 中）**承認**、新たな必須なし |
| NOTICE と manifest に由来 | gui/public/icons/manifest.json、NOTICE のアイコン節。再利用13点の project.json は CyberSprite a00433c と全件一致（M5R） |
| CyberSprite 無変更 | git status 前後とも空（L2 確認） |

申し送り（M4）：アイコンを ink の面に置かない。参考 S-3・S-7 は任意。
