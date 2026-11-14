# CPU — CPU 環境対応（要件改訂1）実装報告

- 実装：Opus 5.5（high）、2026-11-15。Codex は使っていない。起点は公開済み main の先端 `34a7b47`（`6b4affc` の子）。
- PR：[#4](https://github.com/kokuren333/Shin-MotionMaker/pull/4)（ブランチ `cpu-encoder`）。**マージしていない。**
- 結論：R6 は実装して、GPU のある実機と GPU の無い runner の両方で、エンコーダの選択が働いたことを確かめた。ただし runner の runtime-smoke は、レンダーのあとの `ghost-check` で別の原因によって失敗した。PM 判定の停止条件1に当たるので、[CPU-Q1](QUESTIONS.md) を出して止めた。C1（CI-11）は未達。
- 自分の成果を合格とはしていない（絶対規則8）。判定は L2 と交差レビューが行う。
- **更新（2026-11-15、継続実装）**：CPU-Q1 はオーナーが案A に決め、C1 を満たした。上の結論は当時の記録として残す。続きは末尾の「継続実装（案A）」。

## 実装したもの

| ファイル | 内容 |
| --- | --- |
| `job-template/runtime/scripts/encoder.mjs`（新規） | run.mjs の各モードと二重レンダーの Remotion 引数表。`MOTION_JOB_ENCODER` の解釈、`h264_nvenc` の1フレームの実符号化による試行、`[encoder]` 行、GPU で失敗したときの案内 |
| `job-template/runtime/scripts/run.mjs` | 置換5対：`encoder.mjs` の読み込み、冒頭のコメント（Remotion 任せの「libx264 に落ちる」を実態に合わせた）、preview・build で選択と `[encoder]` 行、引数を `remotionArgs` から、終了時の案内 |
| `job-template/runtime/scripts/ghost-check.mjs` | 置換4対：`encoder.mjs` の読み込み、`renderSecondCopy` の JSDoc、選択と `[encoder]` 行、引数を `remotionArgs("double-render", …)` から、終了時の案内。検出・分類・照合の関数としきい値は変えていない |
| `job-template/README.md` | 末尾に「レンダーのエンコーダ（GPU・CPU）」節を追記（追加だけ） |
| `tests/fixtures/baseline-biimmotion-262c798/allowed-diffs.json` | R6（replacements 9対、appends 1、added_files `runtime/scripts/encoder.mjs`） |
| `tests/baseline.test.ts` | JT-11：R6 も逆変換して照合。追加ファイルは R3 の `NOTICE` と R6 の `encoder.mjs` だけと表明 |
| `tests/encoder.test.ts`（新規） | TS-10 の1〜7と、実物の `run.mjs` を偽の Remotion CLI で起動する検査 |
| `src/core/data/version.ts`、`tests/fixtures/template-versions.json`、`tests/fixtures/template-manifest-0.5.3.json` | テンプレート 0.5.3（目録 SHA-256 `6b5a207b…`） |
| `tests/fixtures-baseline.test.ts`、`tests/mcp.test.ts` | 固定値の更新：allowed-diffs のハッシュと規則一覧に R6、生成ファイル数 68→69 |
| `tools/runtime-smoke.mjs` | 各 run の `stderr.log` から `[encoder]` 行と `nvcuda` の件数を証拠に入れ、コンソールにも出す |
| `docs/REQUIREMENTS.md` | 改訂1の (a)〜(l)。PM 判定のコードブロックを機械的に転記した（文面の変更なし） |
| `AGENTS.md`、`docs/CONTRACT.md` | (m)：R1〜R6、CI-11、テンプレート 0.5.3、host は環境変数を解釈せずに渡すこと。CONTRACT は L2 の確認を受ける |
| `README.md`、`docs/CLI.md`、`docs/MCP.md`、`VERIFICATION.md` | D4〜D6 |

## 受け入れ条件ごとの状態と証拠

### A. 差分の範囲

| # | 状態 | 証拠 |
| --- | --- | --- |
| A1 | 4ファイルに収まる | `git diff --stat 34a7b47 -- job-template job-assets`：`README.md` +24、`encoder.mjs` +227（新規）、`ghost-check.mjs` 30、`run.mjs` 61。`job-assets/` は差分なし |
| A2 | 下記「決定」の注記つき | `ghost-check.mjs` の差分は import 1か所と `renderSecondCopy` の中だけ。`findFfmpeg`・`decodeTileSignatures`・`analyzeGhosts`・分類・照合・しきい値に差分なし。差分全文は PR #4 の Files と `allowed-diffs.json` の R6 の4対 |
| A3 | 済 | `run.mjs` 冒頭のコメントを書き直した |
| A4 | 済 | JT-11 の15件が合格。R6 を逆変換した `run.mjs`・`ghost-check.mjs`・`README.md` が基線のハッシュと一致。MV の `brief.md`・`plan/lyrics.txt`・依頼文は基線とバイト一致のまま |
| A5 | 済 | 0.5.2→0.5.3（patch：機能の入出力・スキーマを変えない修正のため。`schema_version` 0.5 とも揃う）。GUI はビルド時に `job-template` を読むので、AR-06 の一致テスト（generate-job の ZIP 比較など）が合格 |
| A6 | 差分なし | `git diff --stat 34a7b47 -- schemas tests/fixtures/mcp-tools.json tests/fixtures/request-schema.snapshot.json src/host src/cli src/mcp src/core/request.ts job-template/AGENTS.md` が空 |
| A7 | 差分なし | ルート・GUI・ジョブの `package.json` と lock に差分なし |
| A8 | 済 | MV に関わるテストの表明は変えていない。変えた固定値は上の2件だけ。テスト総数は 219（M8 時点）→227（TS-10 の8件を追加）。`npm test` は 227件：225 pass／2 skip／0 fail |

### B. テスト

| # | 状態 | 証拠 |
| --- | --- | --- |
| B1 | 済（`a67b042`） | PR の CI [run 43642548314](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43642548314)：ubuntu/24・ubuntu/22・windows/24・tier-b がすべて success。push の CI [run 43642509369](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43642509369) も success。TS-10 は GPU・Remotion・実物の ffmpeg を使わない |
| B2 | 済 | `tests/no-git.test.ts` が合格。新しいテストは git を起動しない |

### C. 実レンダー

| # | 状態 | 証拠 |
| --- | --- | --- |
| C1 | **未達（CPU-Q1）** | [run 43642555566](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43642555566)：CLI・MCP とも render preview・still は通り、ghost-check preview で失敗 |
| C2 | 部分 | runner の証拠 JSON に preview の `[encoder] route=cpu encoder=libx264 MOTION_JOB_ENCODER=auto (unset)` がある。`nvcuda` は全 run で0件。final は未到達 |
| C3 | 済 | 実機 Tier C、CLI 162秒・MCP 119秒、preview・final とも `gpu`／`h264_nvenc` |
| C4 | 済 | 実機 Tier C、CLI、`cpu`／`libx264` |
| C5 | 済 | 二重レンダー：auto の2本目は `gpu`（試行 327ms）、cpu の2本目は `cpu`／`libx264` |
| C6 | 済 | `runtime` で `npm run preview` を PowerShell・Git Bash の両方で `MOTION_JOB_ENCODER=cpu` 付きで実行、終了0 |
| C7 | 済 | CLI 終了4・`E_INTERNAL`（`execution_failed`）・run failed・`script_exit_code` 1、MCP も同じ。`docs/CLI.md` の対応表に記載 |
| C8 | 済 | 実機 327〜922ms（初回のような冷えた状態では、直接の試行で 1244ms を1回観測）、runner 577ms・614ms |

数値と行の全文は [VERIFICATION.md の CPU 節](../../../VERIFICATION.md#cpu-環境対応要件改訂1作業中) と `evidence/`。

### D. 文書

| # | 状態 | 内容 |
| --- | --- | --- |
| D1 | 済 | (a)〜(l) を転記 |
| D2 | 済 | AGENTS.md 規則4・§4、CONTRACT。過去の記録は書き換えていない |
| D3 | 済 | ジョブ README に追記。既存の本文（L3・L89 のモデル名を含む）は変えていない |
| D4 | 済（C1 の解決後に再確認が要る） | 「必要な環境」に GPU が必須でないこと、「BiimMotion との違い」節。§3 の事実だけで書き、X1〜X15 を避けた。L90 のツール数を 19／20／9 に直した（実測） |
| D5 | 済 | `docs/CLI.md`・`docs/MCP.md` に渡し方。MCP の `env` は実測してから書いた（[mcp-env.json](evidence/mcp-env.json)） |
| D6 | 部分 | VERIFICATION に新しい節。C1 が未達なので、M8 の残課題1は「まだ解消していない」と書いた |
| D7 | 済 | CLI の PowerShell・sh 形式、ジョブ README の PowerShell・sh 形式、MCP の `env` の登録は、すべて実行して確かめた |

### E. 手続き

| # | 状態 | 内容 |
| --- | --- | --- |
| E1 | 部分 | PR の CI は success（`681f42d`：[run 43644048172](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43644048172)）。`tools/ci-local.mjs` は `681f42d` で終了0（本体 227件 225 pass／2 skip／0 fail、GUI 34/34、e2e・両ビルドまで完了）。main へはまだ入れていない |
| E2 | 済（approve with notes） | 下記「交差レビュー」 |
| E3 | 未 | マージしていないので Pages の公開後確認は無い |
| E4 | 対象外 | タグは付けない（発注書） |

## テストのコマンドと結果

- `node --experimental-strip-types --test tests/encoder.test.ts`：8件 pass。
- `node --experimental-strip-types --test tests/baseline.test.ts`：15件 pass。
- `npm test`（Windows、Node v24.15.0）：227件、225 pass／2 skip（POSIX 分岐の理由付き skip、M8 と同じ）／0 fail。

## 決定

1. **引数表を `encoder.mjs` に置いた。** TS-10 の2・5が「preview・build・二重レンダー、still・studio の配列が原典と一致」を求めるので、全モードの配列を `encoder.mjs` の `remotionArgs` が返す。`run.mjs` の使い方の検査は `modes[mode]` から `RUN_MODES.includes(mode)` に変わった（同じ4モード）。still と studio はエンコーダを選ばず、`MOTION_JOB_ENCODER` も読まない（JT-14）。
2. **GPU 失敗時の案内（JT-17）は `noteRenderExit` にまとめた。** そのため `ghost-check.mjs` の `renderSecondCopy` に、spawn の後の1行（`noteRenderExit(encoder, code);`）が加わっている。PM 判定 A2 の列挙（引数の組み立て・コメント・読み込み）の外に見えるが、JT-17 は二重レンダーにも案内を求めるので、`renderSecondCopy` の中の最小の追加にした。レビューで判断してほしい。
3. **同梱 ffmpeg の特定は、Remotion と同じ解決順を公開の経路でたどる。** `@remotion/cli` → `@remotion/renderer` → `@remotion/compositor-<os>-<arch>[-msvc|-gnu|-musl]` を Node の `createRequire` で解決し、compositor パッケージの公開エクスポート `dir` を使う（Remotion の `get-executable-path.js` と同じ方法）。renderer の内部モジュールは読み込んでいない（停止条件3には当たらない）。
4. **試行の入力** はメモリ上で作る 256×256 の黒の PNG（zlib と自前の CRC32、依存なし）を `-f image2pipe -c:v png -i -` で渡し、`-frames:v 1 -c:v h264_nvenc -pix_fmt yuv420p -f null -` で捨てる。作業フォルダは ffmpeg のフォルダ、20秒で打ち切り。標準エラーは捨てる（`[encoder]` 行に ffmpeg の文言を入れない）。
5. **値の比較は厳密。** `CPU` や前後の空白は不正値として扱い、使える値を示して終了1。
6. **`[encoder]` の形式**：`[encoder] route=<gpu|cpu> encoder=<名前> MOTION_JOB_ENCODER=<auto (unset)|"値"> reason: <理由（試行の成否と ms）>`。試行の所要時間を行に入れたので、C8 は runner のログからも読める。
7. **テンプレート版は 0.5.3。** 互換を壊さない修正なので patch とした。PACKAGE_VERSION（0.1.0）は変えていない。

## 交差レビュー（E2）

別コンテキストの Opus（実装の結論を渡さず、差分と要件だけを渡した）が `34a7b47..681f42d` をレビューした。判定は **approve with notes**。

| 指摘 | 重さ | 対応 |
| --- | --- | --- |
| MV 非退行、R6 の4ファイル、JT-19（新しいゲート・入力なし）、encoder.mjs の JT-15〜18 | 問題なし | — |
| README の runner の記述が、全工程が通ったように読める | 中 | 直した（runner では preview・still まで、ghost-check で止まっていることと参照を明記） |
| Linux で時間切れのとき SIGTERM だけでは止まらない可能性 | 軽微 | `killSignal: "SIGKILL"` を足した（Windows の経路は同じ） |
| `ghost-check.mjs`・`run.mjs` の変更が R6 の行の文言より少し広い | 軽微 | 実装は変えず [CPU-Q2](QUESTIONS.md) で文言の確認を求めた |
| 試行の前に ffmpeg へ実行権を付けない、node_modules が無いと `[encoder]` 行のあとに本来のエラー | 軽微 | どちらも安全な側。変えていない |
| 失敗理由に ffmpeg の標準エラーを入れると調べやすい | 助言 | 入れていない。runner のログで「nvcuda の失敗が無い」を確かめる条件（C2）と紛れるため（決定4） |
| ジョブ README が `validate --final --double-render` も同じ選択を通ると書いていない | 軽微 | 実行して確かめていない用法なので書いていない（D7） |

- `killSignal` の追加で `encoder.mjs` が1行変わったため、最終の head は手元の Tier C を測った `a67b042` と、時間切れのときの停止シグナルだけが違う（Windows の経路は同じ）。CPU-Q1 の対応後に、最終の head で runner と実機の Tier C を取り直す。

## 質問

- [CPU-Q1](QUESTIONS.md)：runner の ghost-check が、ffmpeg の不在と同梱 ffmpeg の機能不足で失敗する件。推奨は案 A（CI で版を固定した ffmpeg を用意）。
- [CPU-Q2](QUESTIONS.md)：R6 の範囲の文言の確認（軽微）。

## 残課題

- CPU-Q1 の回答後：対応を入れた head で runtime-smoke を再実行し、C1・C2 を満たしたら PR をマージし、main の push で runtime-smoke・CI・Pages を確かめ（E3）、VERIFICATION の節を完了にする。README の CPU の記述（P2・P5）もそのとき再確認する。
- v0.1.1 のタグを付けるなら、`package.json` と `PACKAGE_VERSION` を 0.1.1 に上げる PR が先に要る（現在は 0.1.0 のまま）。
- 検証用 worktree `Shin-MotionMaker-wt/cputc` は検証後に削除した（IMPL_CPU_LOG に記録）。

## 継続実装（案A）

- 実装：Opus 5.5（high）、2026-11-15。Codex は使っていない。台帳は追跡外の `_handoff/IMPL_CPU2_LOG.md`。記録の正本は [VERIFICATION の新しい節](../../../VERIFICATION.md#cpu-環境対応--c1-の解決cpu-q1-案a)。

### 変更

| ファイル | 内容 |
| --- | --- |
| `.github/workflows/runtime-smoke.yml` | gyan.dev の ffmpeg 8.1（essentials）を、版と SHA-256 を固定して取得するステップ。照合に失敗したら失敗にする。`rawvideo` の有無も確かめる。`FFMPEG_PATH` と PATH に置き、取得は3回まで再試行する |
| `docs/REQUIREMENTS.md` | §6.2 R6 の「対象」の文言を揃えた（CPU-Q2、改訂1a。L2 確認・L1 追認待ち） |
| `docs/work/CPU/QUESTIONS.md` | CPU-Q1・Q2 の対応、CPU-Q3（要件書にも CI の ffmpeg を書くかの提案）、範囲外の参考指摘 |
| `docs/CLI.md` | CI だけ固定版の ffmpeg を取得する旨の1文 |
| `VERIFICATION.md`・`README.md` | 新しい節、CPU の記述の更新 |

製品（`job-template/`・`src/`・`gui/`・スキーマ・操作表・依存）に差分は無い。

### 受け入れ条件の更新

| # | 状態 | 証拠 |
| --- | --- | --- |
| C1 | **済** | [run 43646343947](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43646343947)（`44a0dda`）：CLI・MCP とも8 run completed、protocol_errors 0 |
| C2 | **済** | 同じ run の preview・final とも `route=cpu encoder=libx264 MOTION_JOB_ENCODER=auto (unset)`、`nvcuda` 0件。[runner-43646343947-cli.json](evidence/runner-43646343947-cli.json)、[runner-43646343947-mcp.json](evidence/runner-43646343947-mcp.json) |
| C3 | 済（取り直し） | `ff26214` の実機 Tier C：CLI・MCP とも preview・final は `gpu`／`h264_nvenc`。[CLI](evidence/tier-c-ff26214-cli-auto.json)、[MCP](evidence/tier-c-ff26214-mcp-auto.json) |
| C4 | 済（取り直し） | `ff26214`、`MOTION_JOB_ENCODER=cpu` の CLI Tier C：`cpu`／`libx264`。[証拠](evidence/tier-c-ff26214-cli-cpu.json) |
| D6 | マージ後に完了 | M8 の残課題1は、main の push で runtime-smoke が成功した時点で解消とし、後続の PR で記録する |
| E2 | 済 | 交差レビュー（別コンテキストの Opus）：approve with notes。下表 |

### 交差レビュー（継続実装）

| # | 指摘 | 対応 |
| --- | --- | --- |
| 1（中） | 要件書の変更は L1 の権限。実装担当が変えている | 発注書の作業2の指示によることを QUESTIONS と改訂表に明記し、L2 確認・L1 追認待ちとした。差し戻しなら改訂1a の2行を戻すだけ |
| 2（中） | README・VERIFICATION・REPORT の状態の記述が古い。runtime-smoke を新しい head で実行していない | run 43646343947 の成功を確認してから、新しい節・この節・README を書いた。過去の節は書き換えていない |
| 3（低） | CI の例外が要件書に無い | 要件書は変えず、CPU-Q3 として L1 に提案した |
| 4（低） | QUESTIONS の当初の状態の行を上書きした | 当初の行を戻し、更新の行を別に足した |
| 5（低） | 取得に再試行が無い | `-MaximumRetryCount 3 -RetryIntervalSec 5` と進捗表示の停止を足した |
| 6（参考） | PATH に ffmpeg が無い利用者でも doctor が「ある」と報告し、ghost-check が失敗する（既存の挙動） | 範囲外。QUESTIONS の参考に記録し、L1 に回した |

### 残課題

- PR #4 のマージ後：main の push で CI・Pages（公開後確認を含む）・runtime-smoke が成功したことを、後続の PR で VERIFICATION に記録する。
- CPU-Q2（改訂1a）の L1 の追認、CPU-Q3 の判断、範囲外の参考指摘（doctor の ffmpeg 判定）。
- 版 0.1.1 の PR（`package.json` と `PACKAGE_VERSION`）。タグはオーナー承認の範囲で付ける。
