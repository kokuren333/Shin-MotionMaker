# CPU — 質問（L2 経由で L1 へ）

## CPU-Q1 GPU の無い runner で、レンダーのあとの ghost-check が別の原因で失敗する（PM 判定 §2.4 停止条件1）

- 状態：**未回答。C1（CI-11）が満たせないため、PR #4 はマージしない。**
- 観測：PR head `a67b042` の `runtime-smoke.yml` 手動実行（run 43642555566、windows-2025-vs2026 20261103.298）。
  - R6 は働いた。CLI・MCP とも `render preview` が `[encoder] route=cpu encoder=libx264 MOTION_JOB_ENCODER=auto (unset) reason: h264_nvenc test encode failed: exit code 4294967295`（試行 614ms／577ms）で成功し、`render still` も成功した。`nvcuda` による変換の失敗は出ていない。
  - 次の `ghost-check --target=preview` が、`ffmpeg failed to decode .\output\preview.mp4: … Requested output format 'rawvideo' is not known` で失敗した（スクリプトの終了1、host の正規化 E_INTERNAL／4）。`render final` と最後の `ghost-check` には到達していない。
- 原因（確認済みの事実）：
  1. runner イメージの同梱ソフトウェア一覧（runner-images `win25-vs2026/20261103.298` の Readme）に ffmpeg は無い。
  2. `job-template/runtime/scripts/ghost-check.mjs` の `findFfmpeg` は「`FFMPEG_PATH` → PATH → Remotion 同梱」の順で探す（原典 262c798 のまま）。runner では同梱の ffmpeg が選ばれる。
  3. Remotion 4.0.532 同梱の ffmpeg（`@remotion/compositor-win32-x64-msvc`）は `rawvideo` の muxer を持たない（手元で `-muxers` を確認。`mp4`・`null` はある）。ghost-check の走査は `-f rawvideo -` へ出力するので、同梱の ffmpeg では走査できない。
  4. host の事前検査と `doctor`（`src/host/tools.ts` の `findFfmpeg`、CONTRACT「ffmpeg（FFMPEG_PATH→PATH→Remotion compositor）」）も同梱の ffmpeg を「ある」と扱うので、`E_TOOL_MISSING` ではなく実行後の E_INTERNAL になる。
  5. これまで runner の runtime-smoke は `render preview` で止まっていたため、この段は一度も実行されていなかった。手元の機械は PATH に ffmpeg があるので起きない。
- R6 の範囲では直せない：`ghost-check.mjs` の `findFfmpeg` を変えるのは R6 の対象外（要件 R6 の範囲は `renderSecondCopy` の引数の組み立てだけ。停止条件4）。
- 選択肢（どれも実装していない）：

| 案 | 内容 | 影響 |
| --- | --- | --- |
| A（推奨） | `runtime-smoke.yml` に、版と SHA-256 を固定した ffmpeg を取得して `FFMPEG_PATH` に設定する手順を足す。製品は変えない | 要件 README「必要な環境」の ffmpeg を runner に用意するだけ。ただし §9.3／docs/CLI.md の「Tier C は既存のツールを使い、自動導入しない」の運用と、CI-11 の「GPU の無い runner で通る」の前提（何を runner に置いてよいか）に L1 の判断が要る |
| B | host の `findFfmpeg`（事前検査・doctor）が、`rawvideo` を出力できない ffmpeg を「無い」と扱い、ghost-check を `E_TOOL_MISSING`／3 で事前に断る | 利用者には正しい案内になるが、runtime-smoke は成功しない（A と併用する性質）。CONTRACT の ffmpeg の探索順の記述と CL の対応表が変わる |
| C | 許容差分 R7 として、ジョブの `findFfmpeg` が同梱の ffmpeg を候補から外す、または能力で選ぶ | job-template の変更で要件の改訂が要る。ジョブ単体の利用者（PATH に ffmpeg が無い）にも効く |

- 依存しない範囲は進めた：手元の GPU 機の Tier C（auto・cpu）、二重レンダー、ジョブ単体の `npm run preview`、不正値、試行時間、文書、TS-10、PR の CI。結果は REPORT.md。

## CPU-Q2 R6 の範囲の文言と、二重レンダーの実装の字面が合わない（交差レビューの指摘、軽微）

- 状態：未回答。実装は変えずに、文言の確認だけを求める。
- 要件 §6.2 R6 の範囲は「`run.mjs`（`preview`・`build` の引数の組み立てと冒頭のコメント）、`ghost-check.mjs`（`renderSecondCopy` の引数の組み立てとそのコメント）」。一方、JT-14・JT-17・JT-18 は、二重レンダーでも選択・`[encoder]` 行・GPU 失敗時の案内を求めている。
- 実装では、`ghost-check.mjs` に import 1か所、`renderSecondCopy` の中に選択と記録の2行、spawn の後に `noteRenderExit(encoder, code);` の1行がある。`run.mjs` では、`studio`・`still` の配列も `encoder.mjs` に移し（TS-10.5 で原典と同じことを表明）、mode の検査を `RUN_MODES.includes(mode)` にした。
- 交差レビューの判断は「許容できる。要件の文言を『選択・記録・引数の組み立てと import』に直すことを勧める」。R6 の行の文言を直すかどうかは PM が決める。
