# M7-add コマンド例の確認

文書の推敲は行わず、M6 の文面に M7 の実装・検証手順を追随させた。README・CLI・MCP の追加例にある `<SHA>`・`<原典生成ジョブ>`・`<URL>` は構文上の値である。実行した値と結果は以下の記録を参照する。

| 文書に反映した構文・内容 | 実行証拠 |
| --- | --- |
| `npm run test:tier-b -- --commit <SHA>` | M7 本体の `f98dc051fff88ca4c7eefba4db60e9819913e349`、[tier-b.json](evidence/tier-b.json)。CLI/MCP とも生成68ファイル・setup/validate 終了0 |
| `node tools/runtime-smoke.mjs --entry cli --commit <SHA>` | M7 本体の `506a5a893cbb4da0aabfbfa82ecc1d75f6c00d3f`、[tier-c-cli.json](evidence/tier-c-cli.json)。8 run、すべて completed・終了0、実測テンプレート0.5.1 |
| `node tools/runtime-smoke.mjs --entry mcp --commit <SHA>` | 同じ M7 本体コミット、[tier-c-mcp.json](evidence/tier-c-mcp.json)。8 run、すべて completed・終了0。開始 wait_ms:0、run_get wait_ms:50000、実測テンプレート0.5.1 |
| `node tools/runtime-smoke.mjs --entry cli --legacy-job <原典生成ジョブ> --commit <SHA>` | 同じ M7 本体コミット、[tier-c-legacy.json](evidence/tier-c-legacy.json)、[legacy-origin.json](evidence/legacy-origin.json)。原典262c798の実生成0.4ジョブ。10 run、report なしの validate pass/0・fail/1、QC fail/1、レンダー・ghost 終了0 |
| `npm run verify:pages:local -- --commit <SHA>` | M7 本体の [pages-local.json](evidence/pages-local.json)。追補でも取り込み後のコミットで再実行し、結果を REPORT に追記する |
| `node tools/verify-pages.mjs <URL> --expect-commit <SHA>` | 上記のローカル検証が、同じコミットをサブパスで配信して verifier CLI を実行した。`--attempts 1`・`--screenshot`・`--output` 付きで終了0。実公開 URL には実行していない |
| 列挙値の shape 検査と JSON Pointer | M7 本体の tests/integration.test.ts・GUI e2e の AR-06 と request 読込検証。追補でも全テスト・GUI e2e を実行する |

追補の CLI 実動確認は `node tools/verify-cli.mjs --output docs/work/M7/evidence/cli-add.json` を実行して終了0、54記録を [cli-add.json](evidence/cli-add.json) に保存した。MCP は stdin の EOF で終了0・stdout 空であり、JSON 封筒の parse 対象にしない。既存 M2b の実測ファイルは保持した。

実レンダーの既存記録を0.5.2の実測として書き換えていない。M6 の R3 README 推敲を取り込んだ0.5.2との関係は [VERIFICATION](../../../VERIFICATION.md) と REPORT に記載した。追補発注の指定に従い、実レンダーは再実行していない。
