# M7 から M6・L2 への文書申し送り

M7 は README・AGENTS・CLI・MCP・DESIGN・WORKFLOW とジョブ README を編集していない。以下の技術的変更を、文面担当が必要に応じて反映する。

- `formChoices` は core の公開 API。原典が検査する既存集合のみ（fps・2人目の配置を含む）。shape 段から範囲外の列挙値を `E_INPUT_INVALID` と JSON Pointer 付き details で拒否する。GUI の request 読込にも、CLI/MCP の generate・script stats にも共通で適用される。未完成の自由記述は読み込める。`validateForm` の文言・種類は従来どおり。
- Tier B の共通入口は `npm run test:tier-b -- --commit <SHA>`。CLI と MCP の生成→setup→validate を実行し、証拠を `.agent-work/m7-evidence/tier-b.json` に保存する。ジョブはハッシュ採取後に削除する。古い `tools/test-cli-tier-b.mjs` は M2b の終了値分類の採取用として残す。
- Tier C は build 後に `node tools/runtime-smoke.mjs --entry cli --commit <SHA>` と `--entry mcp`。既存の Chrome/Edge を使い、自動導入しない。MCP は開始 `wait_ms:0`、取得 `run_get wait_ms:50000`。証拠 JSON・静止画・ghost report を保存し、成功時に一時ジョブの依存と動画を削除する。失敗時は調査用ジョブを保持する。
- JT-12 は `node tools/runtime-smoke.mjs --entry cli --legacy-job <原典生成ジョブ> --commit <SHA>`。原典の複製で実際に生成した0.4ジョブを入力する。検証用コピーに場面・GLB・音響を準備する。status、validate の stdout だけによる pass/fail、QC、レンダー、ghost を記録する。
- Pages の公開後確認は `node tools/verify-pages.mjs <末尾が / のURL> --expect-commit <SHA>`。既存ブラウザが必要。既定12回・5秒間隔で再試行する。`--attempts`・`--retry-ms`・`--screenshot`・`--output` を指定可能。HTTP・title・commit・JS/CSS・表示・コンソールを検査する。
- ローカル確認は `npm run verify:pages:local -- --commit <SHA>`。サブパス配信で正常経路、8種類の不一致、古い commit からの再試行を確認する。
- Pages は引き続き手動起動のみ。Runtime smoke は独立した workflow で手動と main push から動く。M8 で実公開 URL の検査とスクリーンショット比較を行う。
- 実 Aivis・有償の画像生成は、M7 の Tier C 発注範囲に含めていない。動作確認用ジョブは voice none、音響はジョブ内の合成で確認する。

実行結果と正確なコミット・ハッシュは REPORT と VERIFICATION の確定記録を参照する。
