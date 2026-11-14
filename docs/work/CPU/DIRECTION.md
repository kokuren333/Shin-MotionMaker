# CPU — CPU 環境対応（要件改訂1）の実装発注の要旨

- 発注：L2（オーナー指示 2026-11-15 に基づく）。実装：Opus 5.5（high）。Codex は使わない。
- 要件：[REQUIREMENTS.md](../../REQUIREMENTS.md) の改訂1（§1.2 N11、§6.2 R6、§6.4 JT-14〜19、JT-11、CI-10・CI-11、TS-10、§9.3 Tier C、D-10・D-19）。改訂文面は PM（Fable 5.2）の判定どおりに反映する。
- 範囲：
  1. job-template の R6（`runtime/scripts/encoder.mjs` の新設、`run.mjs`・`ghost-check.mjs` の引数の組み立て、ジョブ `README.md` への追記）。
  2. 基線フィクスチャの R6 と JT-11、TS-10、テンプレート版の更新。
  3. 実レンダー：GPU の無い GitHub Windows runner の runtime-smoke（CLI・MCP、PR の head と マージ後の main）、GPU のある Windows 実機の Tier C（`auto`・`cpu`）、二重レンダー、ジョブ単体の `npm run preview`、不正値、試行の所要時間。
  4. 文書：ルート README（必要な環境、BiimMotion との違い）、`docs/CLI.md`・`docs/MCP.md` の環境変数、`VERIFICATION.md` の新しい節。
- やらないこと：自動の再レンダー、NVENC 以外のハードウェアエンコーダ、`doctor` へのエンコーダ判定、CLI・MCP・`project.json`・GUI への項目追加、`job-template/AGENTS.md` の変更、run の上限時間・依存の変更、版のタグと npm 公開。
- 受け入れ条件：PM 判定の A1〜A8、B1〜B2、C1〜C8、D1〜D7、E1〜E4。結果は [REPORT.md](REPORT.md)。
