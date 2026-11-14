# CPU — 質問（L2 経由で L1 へ）

## CPU-Q1 GPU の無い runner で、レンダーのあとの ghost-check が別の原因で失敗する（PM 判定 §2.4 停止条件1）

- 状態（当初）：**未回答。C1（CI-11）が満たせないため、PR #4 はマージしない。**
- 状態（更新）：**回答済み（2026-11-15 07:03、オーナー決定：案A）。** 対応は末尾の「CPU-Q1 の対応」。
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

- 状態（当初）：未回答。実装は変えずに、文言の確認だけを求める。
- 状態（更新）：**要件側の文言を揃えた（2026-11-15、継続実装担当。継続実装の発注書の作業2の指示による）。L2 確認事項。** 対応は末尾の「CPU-Q2 の対応」。
- 要件 §6.2 R6 の範囲は「`run.mjs`（`preview`・`build` の引数の組み立てと冒頭のコメント）、`ghost-check.mjs`（`renderSecondCopy` の引数の組み立てとそのコメント）」。一方、JT-14・JT-17・JT-18 は、二重レンダーでも選択・`[encoder]` 行・GPU 失敗時の案内を求めている。
- 実装では、`ghost-check.mjs` に import 1か所、`renderSecondCopy` の中に選択と記録の2行、spawn の後に `noteRenderExit(encoder, code);` の1行がある。`run.mjs` では、`studio`・`still` の配列も `encoder.mjs` に移し（TS-10.5 で原典と同じことを表明）、mode の検査を `RUN_MODES.includes(mode)` にした。
- 交差レビューの判断は「許容できる。要件の文言を『選択・記録・引数の組み立てと import』に直すことを勧める」。R6 の行の文言を直すかどうかは PM が決める。

## CPU-Q1 の対応（案A、2026-11-15）

- 決定：オーナーが案A を選んだ（2026-11-15 07:03）。「Tier C は既存のツールを使い、自動導入しない」（docs/CLI.md・§9.3）との整合は、**オーナーが案A を選んだことで承認済み**として扱う。この運用は利用者の機械と製品の動作（doctor・CLI・MCP は自動導入しない）についてのもので、CI の runner に検証用のツールを固定版で置くことはその例外として承認された。
- 実装：`.github/workflows/runtime-smoke.yml` に1ステップを足した。
  - 取得元：gyan.dev の公式 GitHub ミラー `GyanD/codexffmpeg` の release `8.1`、`ffmpeg-8.1-essentials_build.zip`。SHA-256 `8748283d821613d930b0e7be685aaa9df4ca6f0ad4d0c42fd02622b3623463c6`（GitHub の asset digest と、手元での取得の両方で一致）。
  - 照合に失敗したら、そのステップで失敗する。展開後に `-version` を表示し、`-muxers` に `rawvideo` があることを確かめる。
  - `FFMPEG_PATH` を `GITHUB_ENV` に、bin のフォルダを `GITHUB_PATH` に足す。MCP の検証で使う SDK の stdio クライアントは、`env` を渡さないと既定の変数（Windows では PATH を含む12個。`FFMPEG_PATH` は含まない）だけを子へ渡すので、MCP の経路は PATH で固定版を見つける。ジョブの `findFfmpeg`（FFMPEG_PATH → PATH → 同梱）は変えていない。
  - ライセンス：この build は GPLv3。CI の runner で一時的に使う外部ツールであり、npm の依存・成果物・ZIP に入らないので、`NOTICE` は変えない。
- 製品（job-template・src・CLI・MCP・GUI・スキーマ・操作表）に差分なし。案B・案C は採らない。
- 結果：REPORT.md の「継続実装（案A）」と `VERIFICATION.md` の新しい節に記録する。

## CPU-Q2 の対応（2026-11-15、L2 確認事項）

- `docs/REQUIREMENTS.md` §6.2 の R6 の行の「対象」を、次のとおり揃えた（実装は変えていない）。改訂表に「改訂1a」として1行足した。
  - 変更前：`run.mjs`（`preview`・`build` の引数の組み立てと冒頭のコメント）、`ghost-check.mjs`（`renderSecondCopy` の引数の組み立てとそのコメント）
  - 変更後：`run.mjs`（`encoder.mjs` の import、`preview`・`build` のエンコーダの選択と `[encoder]` 行の記録、各モードの引数の組み立て（`studio`・`still` の引数は原典と同じ配列を `encoder.mjs` へ移すだけ）、モード名の検査、レンダーの終了時の案内（JT-17）、冒頭のコメント）、`ghost-check.mjs`（`encoder.mjs` の import、`renderSecondCopy` のエンコーダの選択・`[encoder]` 行の記録・引数の組み立て・終了時の案内（JT-17）とそのコメント）
- 「変えないもの」の列（AGENTS.md、package.json、依存、ゴーストの検出・分類・照合のロジックとしきい値）は変えていない。
- 権限：要件書は L1 の正本である。今回の変更は、継続実装の発注書（作業2「R6 の範囲の文言を…REQUIREMENTS 側で揃える…L2 確認事項として残す」）の指示に従って実装担当が行った。交差レビューも「文言は正確だが、要件書の変更には L1 の確認を残すこと」と指摘した。**L2 が文面を確認し、L1 が追認するか差し戻すかを決める。** 差し戻しの場合は改訂1a の2行を戻せば済み、実装には影響しない。

## CPU-Q3 CI の runner に固定版の ffmpeg を置くことを、要件書にも書くか（提案、L1 判断）

- 状態：提案。要件書は変えていない。
- 内容：CPU-Q1 の案A で、`runtime-smoke.yml` は runner に版と SHA-256 を固定した ffmpeg を置く。これは CLI.md・この QUESTIONS・VERIFICATION にだけ書いてあり、要件書の §9.3 Tier C と CI-11 からは読み取れない（交差レビューの指摘、低）。
- 提案：§9.3 Tier C か CI-11 に「CI の runner には、ゴースト検査の走査のために、版と SHA-256 を固定した ffmpeg を置く（CPU-Q1、オーナー承認）。製品は自動導入しない」の1文と改訂表の1行を足す。CI-11 の「GPU の無い runner で通る」の条件自体は変わらない。

## 参考（既存の挙動、範囲外）：ffmpeg が PATH に無い利用者の ghost-check

- 交差レビューの参考指摘。PATH に ffmpeg が無い利用者の機械では、host の doctor・事前検査（`src/host/tools.ts`）とジョブの `findFfmpeg` が Remotion 同梱の ffmpeg を「ある」と扱い、ghost-check が runner と同じ `rawvideo` のエラーで失敗する。README の「必要な環境」は ffmpeg を必須に挙げているので、この PR を止めない。直すには CPU-Q1 の案B（host）か案C（job-template、要件の改訂が要る）を後続で検討する。L1 の判断に回す。
