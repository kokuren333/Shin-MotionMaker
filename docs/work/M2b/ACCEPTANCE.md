<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# M2b 受け入れ判定（L2）

- 判定：**合格**（2026-11-14 19:25、main 91c939f に --no-ff マージ）

| 受け入れ条件（§11.2 M2b ＋発注書） | 証拠（L2 実測） |
| --- | --- |
| TS-02・TS-03 | m2b で npm test 186件（184 pass／2 skip（OS 専用）／0 todo／0 fail）。マージ後 ci-local RC=0（GUI 単体 33、e2e 42/42 含む） |
| CLI と GUI 経路のバイト一致 | テストに含む（M2b REPORT）。3入口の最終一致は M7 で再確認 |
| PORTING_LEDGER 完成・TS-01 | todo 0（M1 の M2b 移送分を全部充足）。基線 81件の対応完了 |
| docs/CLI.md の実行記録 | docs/work/M2b/ に実測記録 54件＋Tier B 11件（M2b REPORT） |
| build 後の CLI の手動確認 | L2：npm run build → node dist/cli/main.js で version（rc0）、candidates（「たたき台」明示・seed 返却・rc0）、generate 未知キー（E_INPUT_INVALID、pointer 付き、rc2）、存在しない入力（rc2）、golden 要求から生成（72ファイル、generator 付き）、同名出力（E_OUTPUT_EXISTS、rc2）、status（合否項目なし）、qc pre（ok:true・result.verdict:fail・rc1） |

所見（M7 へ）：qc.mjs の report の detail に OS の絶対パスが含まれる（原典スクリプトの出力。CLI では問題にしない。MCP での扱いは M3R で確認）。run.result と envelope.result の重複は軽微。
