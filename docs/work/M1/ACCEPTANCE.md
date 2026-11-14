<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# M1 受け入れ判定（L2）

- 判定：**合格**（2026-11-14 17:24、main 288b0ab に --no-ff マージ）

| 受け入れ条件（§11.2 M1） | 証拠（L2 実測） |
| --- | --- |
| TS-01 の件数と対応づけ | 基線 81 件。m1 で 119 件（109 pass／10 todo／0 fail）。todo 10 件は M2b（CLI 固有）・M2a（独立テンプレート読み込み比較）への移送で台帳に明記。porting-ledger.test.ts が基線全テスト名の1対1対応を表明 |
| JT-11 合格 | tests/baseline.test.ts：テンプレート・フォントのハッシュ（逆変換）、11 ケースの出力、validateForm 文言集合。M1R の変異テストで 13 件中 11 件検出、R5 の検出漏れは M1-fix R-3 で補強 |
| AR-03 合格 | tests/architecture.test.ts pass |
| PORTING_LEDGER が P1〜P4 のみ | M1R が確認。行番号誤りは M1-fix R-5 で修正 |
| 交差レビュー | M1R（Opus 高）条件付き承認 → M1-fix で必須 M-1（拒否テストの期待値復元：pointer 集合・原典正規表現を確認）・M-2（validate.json 書き込みを try/catch、reports がファイルのケースのテスト）を解消。L2 が再実測（レビュー者の承認条件） |
| ci-local | main マージ後 123 件（113 pass／10 todo／0 fail）、RC=0 |

MV 非退行：MV の brief・lyrics・依頼文は正規化なしでバイト一致（M1R）。job-template と原典の差分は R1・R3・R4 のみ（L2 も diff で確認。原典作業ツリーの CRLF 残りは基線＝git blob と無関係）。
L1 への質問：_handoff/QUESTIONS_FOR_L1.md（L2-Q1 ジョブ README のモデル名、L2-Q2 JT-11(2) の文言）。
