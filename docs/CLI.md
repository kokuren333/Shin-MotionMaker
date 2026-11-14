# CLI

Shin-MotionMaker の CLI は Node.js 22 以上で動く。実行ファイル名は `shin-motionmaker`、短縮名は `smm` で、実体はビルド済みの `dist/cli/main.js` である。導入は [README](../README.md#cli) を参照する。

CLI のコマンドは、host の共通の操作定義表にある名前と入力スキーマから登録している。MCP のツールも同じ表から作るので、両者の入力と結果は一致する。

## コマンド

次の表は構文で、山括弧は利用者が指定する値を表す。実際に実行した例と結果は、末尾の「実行済みの例」にある。

| 構文 | 内容 |
| --- | --- |
| `generate <request.json> --out <親ディレクトリ> [--zip] [--dry-run]` | フォルダまたは GUI と同じ内容の ZIP を新規作成する |
| `candidates --mode mv\|explanation [--seed N] [--count N] [--characters solo\|duo\|none] [--orientation landscape\|portrait]` | 方向性のたたき台。選択・適用を強制しない |
| `stats <file> --kind lyrics\|script [--request <request.json>]` | 歌詞・台本の統計 |
| `status <job>` | ファイルから導出したジョブ状態 |
| `project get <job> [--pointer /a/b]` | JSON Pointer と実バイトの SHA-256 |
| `project patch <job> <patch.json> --expect-sha256 <hash>` | SHA-256 を照合した JSON Merge Patch |
| `report <job> <相対パス>` | 許可された制作記録・PNG の取得 |
| `setup <job>` | lock があれば npm ci、なければ npm install |
| `validate <job> [--final] [--double-render]` | ジョブ内の構造検査 |
| `qc <job> --stage pre\|post` | ジョブ内の QC。MV は対象外 |
| `ghost-check <job> [--target preview\|final] [--video <output/内のパス>] [--double-render] [--keep] [--no-stills] [--max-stills N] [--tile-threshold N] [--min-tiles N]` | ゴースト走査。件数は助言 |
| `render <job> --target preview\|final\|still [--frame N]` | ジョブ内のレンダー。frame は still のみ |
| `voice <job>` / `sound <job>` | 音声合成・音響生成 |
| `imagegen <job> --name <id> [--prompt <text>] [--prompt-file <path>] [--kind <kind>] [--ref <path>] [--style <path>] [--size <size>] [--timeout N] [--force] [--dry-run] [--strict]` | 画像生成。prompt または prompt-file が必要。ref は繰返し指定可 |
| `runs list <job>` | run 一覧 |
| `runs get\|wait\|logs <job> <run_id> [--log-tail N] [--wait-ms N]` | 状態・待機・ログ末尾 |
| `runs cancel <job> <run_id>` | 子孫を含む停止。終端 run ではその状態を返す |
| `doctor [<job>]` | 環境の報告。自動導入しない |
| `schema [<名前>]` | スキーマ一覧または本文。request / smm.request/1 の両形を受け付ける |
| `studio <job>` | 排他を取得して Remotion Studio を前面起動 |
| `mcp serve --root <dir> [--allow-dir <dir>] [--read-only] [--enable-generation] [--allow-engine-host <host>]` | MCP stdio サーバーを起動する。allow-dir / allow-engine-host は繰返し指定可 |
| `version` | パッケージ版・コミット・テンプレート版。現在 commit は null |

### 共通のオプション

- `--human` は、標準出力を JSON の封筒から人向けの要約に切り替える。`mcp serve` の標準出力は、指定の有無によらず JSON-RPC 専用である。
- run を開始するコマンドには `--detach` と `--wait-ms` もある。
  - 既定では完了まで前面で待つ。開始時の `--wait-ms` の値にかかわらず、短い取得を繰り返して終端まで待つ。
  - `--detach` では待たずに run ID を返して終わる。
- `runs wait` は終端まで取得を繰り返す。`runs logs` はすぐに取得する。`runs get` だけは、`--wait-ms` で指定した時間（最大50,000ms）まで待って取得できる。
- `--log-tail` は0〜2,000行で、既定は100行。

### ジョブ内スクリプトへの環境変数

CLI が起動するジョブ内スクリプトは、CLI のプロセスの環境をそのまま受け継ぐ。CLI・host は環境変数を解釈・追加・削除しない。たとえば生成ジョブのレンダーのエンコーダ（テンプレート 0.5.3 以降、要件 §6.4）は `MOTION_JOB_ENCODER`（`auto`・`cpu`・`gpu`）で明示できる。既定の `auto` は NVENC を実際に試し、使えなければ CPU（libx264）で符号化するので、通常は設定しなくてよい。

```powershell
$env:MOTION_JOB_ENCODER = "cpu"; node dist/cli/main.js render "jobs/<タイトル>" --target preview
```

```sh
MOTION_JOB_ENCODER=cpu node dist/cli/main.js render "jobs/<タイトル>" --target preview
```

- 選んだ経路は、run の `stderr.log` の先頭近くにある `[encoder]` で始まる1行で確かめられる（`runs logs`）。
- 不正な値では、ジョブ内のレンダーが始まらずに終わる。封筒は下の対応表の run.mjs の行のとおり。
- 値の意味と自動のやり直しをしないことは、生成ジョブの README の「レンダーのエンコーダ（GPU・CPU）」節にある。

### imagegen の制限

- `--kind` は原典と同じ `background`・`transparent`・`character-sheet`・`motion`・`texture`・`prop`。
- `--ref` は `assets/`・`sources/` の中、`--prompt-file` と `--style` は `plan/`・`sources/` の中に限る。
- 任意の子プロセス引数を渡す口は無い。

## 入力と出力先

- request は `{ "form": {...}, "assets": {...} }` の形である。省いたフォームの値は原典の既定値になる。創造に関わる方向性・指示・理解ゴールなどは自由記述の文字列である。
- `assets` の `sources` はパスの配列、`character`・`secondCharacter`・`bgm`・`music` はパスまたは `null`。添付のパスは request ファイルがあるフォルダから解決する。UTF-8 の BOM を受け付ける。
- `--out` は親ディレクトリである。フォルダはその下の `safeName(title)` に、ZIP はその下の `safeName(title)-motion-job.zip` に作る。
- 既存のファイル・フォルダは、空のフォルダでも上書きしない。
- 未知のキー・型の誤り・`validateForm` のエラーは、本文を書き出す前に拒否する。
- 既存の列挙値（fps、1人目・2人目の配置を含む）は core の `formChoices` を共有し、原典 `validateForm` と同じモード・人数条件で shape 検査から確認する。MV では様式・配置を見ず、解説の2人目の配置は duo のときだけ確認する。対象の範囲外の値は `E_INPUT_INVALID` と JSON Pointer 付きの `details` で返す。GUI の request 読込と CLI/MCP の generate・台本統計に共通で適用する。未完成の自由記述は shape 検査で拒否せず、`validateForm` の文言・検査種別は原典のままである。
- `--dry-run` は生成内容を返すだけで、出力先の親フォルダも作らない。
- MV で音源の尺を補えないときは、`musicDurationSec` を指定するよう案内する。

## 封筒

通常の標準出力は、`smm.envelope/1` の JSON 1個と末尾の LF だけである。子プロセスの標準出力・標準エラーは、差分を読んで CLI の標準エラーへ流す。出力が JSON 1個であることは、本文中の改行の数ではなく、全体を JSON として parse できるかで判断できる。

- **成功**：`schema`・`command`・`ok: true`・`result`・`advisories`・`warnings`。run の操作では `run` と `job` も返す。
- **失敗**：`schema`・`command`・`ok: false`・`error: {code, message, hint, details?}`。run を開始済みなら `run` も返す。
- **`ok` と `verdict` は別物である。** `ok` は操作の結果を得たこと、`result.verdict` は検査の `pass`・`fail`・`not_applicable` を表す。QC が fail でも `ok: true` である。
- **助言は `advisories` に入れる。** 件数・主観的な指摘・SKIPPED は、`ok`・`verdict`・終了コードを変えない。例外は `imagegen --strict` だけで、記録された SKIPPED を fail とする。
- `runs get`・`runs wait`・`runs logs`（MCP の `run_get` にあたる）は、台帳を取得できれば `ok: true` である。元の run の失敗は `run.error` に残る。
- `report` で PNG を取得すると、`data` に base64 の文字列が入り、`encoding` は `base64` になる。
- `--human` は標準出力を日本語の要約に切り替える。JSON の封筒を読む呼び出し側では付けない。

封筒・run・各結果の定義は `schemas/` にあり、`schema` コマンドで取得できる。`version` の結果にも `smm.version/1` のスキーマがある。

## 終了コード

| 値 | 意味 |
| --- | --- |
| 0 | 成功、対象外、助言だけの実行 |
| 1 | 完了した検査の不合格、imagegen strict の未生成 |
| 2 | 使い方・入力・出力先の誤り |
| 3 | 環境・前提の不足 |
| 4 | 内部エラー・異常終了・取消・時間切れ・lost |

- 前面で待つ run と `runs wait` は、終端の `run.exit_code` で終わる。`runs wait` は、元の run が失敗しても台帳の取得としては `ok: true` のままで、終了コードだけが元の run と同じになる。
- `runs get`・`runs list`・`runs logs`・`runs cancel` は、取得・取消の操作が成功すれば0で終わる。
- `--detach` は開始に成功すれば0で終わる。その後の結果は台帳から得る。

### エラーコード

| 値 | エラーコード |
| --- | --- |
| 2 | E_USAGE, E_INPUT_INVALID, E_FORM_INVALID, E_PATH_DENIED, E_OUTPUT_EXISTS |
| 3 | E_JOB_NOT_FOUND, E_NOT_A_JOB, E_DEPS_MISSING, E_TOOL_MISSING, E_ENGINE_UNREACHABLE, E_BUSY, E_CONFLICT, E_RUN_NOT_FOUND, E_DISABLED |
| 4 | E_RUN_LOST, E_TIMEOUT, E_INTERNAL |

- `message` と `hint` は日本語である。
- 引数の不足・重複・対応しないオプションは `E_USAGE`。引数を解釈できても、値がスキーマに合わなければ `E_INPUT_INVALID`。
- `validateForm` の文言は原典のまま `details` に入る。
- 依存の不足・排他・無効な操作として事前に拒否したときは、run を作らない。

## ジョブ内スクリプトの終了コードとの対応

判定の実装は host の1箇所にあり、CLI は以下を再実装しない。スクリプトの元の終了コードは `run.script_exit_code` に、正規化した値は `run.exit_code` に残る。M0-Q3 で求められた実測の記録は [CLI-EXAMPLES.json](work/M2b/CLI-EXAMPLES.json) と [TIER-B.json](work/M2b/TIER-B.json) にある。現在の挙動の追補は [M7 cli-add.json](work/M7/evidence/cli-add.json) にあり、mcp serve の stdio EOF は終了0である。

| スクリプト | 実測した元の終了と証拠 | 正規化 |
| --- | --- | --- |
| validate.mjs | 依存導入後の成功0 / タイトル欠落の検査不合格1。R4 の report と終了を照合。依存未導入の直接実行も1 | 完了した pass は0、fail は1。依存不足を先に E_DEPS_MISSING / 3 と分類。完了の証拠がない異常は E_INTERNAL / 4 |
| 原典0.4 validate.mjs | R4 を基線の置換対で逆変換し、実依存で成功0 / 不合格1。report なしでも完了 stdout / OK 行・検査エラーを確認 | 成功0 / 不合格1。例外文・スタック等の未分類異常は E_INTERNAL / 4 |
| qc.mjs | 合成記録で pass=0、制作記録なしで fail=1、MV は report を作らず0。不正 stage は2。制作記録の読取対象がディレクトリでも catch の2 | 完了 report の pass=0 / fail=1、MV は not_applicable / 0。stage 不正は起動前 E_INPUT_INVALID / 2。未分類の読取異常は E_INTERNAL / 4 |
| ghost-check.mjs | 実 ffmpeg の走査は0。動画不在は1 | 走査完了は助言 / 0。動画不在を起動前 E_INPUT_INVALID / 2、ffmpeg 不在を E_TOOL_MISSING / 3 と分類。未分類1は E_INTERNAL / 4。検出件数から fail を作らない |
| imagegen.mjs | Codex 不在の SKIPPED は0、strict は1、必要引数不在も1 | SKIPPED は助言 / 0、strict の記録済み SKIPPED だけ fail / 1。入力不正を起動前に2、未分類異常を4とする |
| aivis.mjs | engine none は0、未対応 engine は1 | none は not_applicable / 0、明示的入力エラーは E_INPUT_INVALID / 2。必要時の疎通不足は E_ENGINE_UNREACHABLE / 3。未分類異常は4 |
| sound-design.mjs | 生成無効は0、有効な cue の WAV 合成は0、空の cues は1 | 対象外 / 成功0、明示的 plan エラーは E_INPUT_INVALID / 2、未分類異常は4 |
| run.mjs | 不正 mode は1、依存未導入の preview も1。M7 の CLI/MCP 実レンダーは元・正規化終了とも0。R6：`MOTION_JOB_ENCODER` が不正な値なら Remotion を起動せずに1（`[encoder]` の行を標準エラーへ。[CPU の実測](work/CPU/REPORT.md)） | CLI は既知 target だけを渡す。依存不足を起動前3とする。成功は0、実行後に判明した道具不足は3、未分類非0は4。`MOTION_JOB_ENCODER` の不正値は解釈せず、未分類の非0として `ok: false`・`E_INTERNAL`（details.reason `execution_failed`）・run は `failed`・終了コード4（`script_exit_code` は1） |
| setup（npm） | 実依存の install と、依存なし workspace の install / ci は0。Windows 拡張 cwd の npm URL エラーは1 | 成功0、npm 不在は3、導入失敗は4。拡張 cwd の不具合は host で修正 |

- 使う report は、run の開始日時以降に書かれた最新のものだけである。
- 元の終了コードが1というだけでは不合格と判定しない。完了の証拠と、終了コードとの一致を求める。
- FAT や一部のネットワークファイルシステムでは更新日時の粒度が粗く、新しい report でも採用されないことがある。

## 実行済みの例

以下は、repo のルートでビルドしたあとに実行した。入力と生成先は、検証専用の `.agent-work/cli-evidence/`（追跡しない）に置いた。入力の `request.json` は、BOM 付き UTF-8 の次の内容である。

```json
{"form":{"title":"CLI & 全角 空白","description":"CLI の実動確認","audience":"開発者","voiceEngine":"none","generateAudio":false}}
```

```powershell
node dist/cli/main.js version
node dist/cli/main.js schema request
node dist/cli/main.js candidates --mode explanation --seed 42 --count 3
node dist/cli/main.js generate .agent-work/cli-evidence/request.json --out .agent-work/cli-evidence/jobs
node dist/cli/main.js generate .agent-work/cli-evidence/request.json --out .agent-work/cli-evidence/archives --zip
node dist/cli/main.js qc ".agent-work/cli-evidence/jobs/CLI & 全角 空白" --stage pre
```

- 最初の5つは `ok: true`・終了コード0で終わる。
- 最後の例は、生成直後の解説ジョブなので制作記録が無く、`ok: true`・`verdict: fail`・終了コード1になる。道具の故障ではなく、ゲートの不合格である。
- 各例の結果は [M6 の command-log](work/M6/command-log.md) にある。M2b での実測（検証用の入力を変えた追加の実測を含む）は [CLI-EXAMPLES.json](work/M2b/CLI-EXAMPLES.json) に時系列で載っている。
- M2b では、ブラウザでの Studio 操作・実レンダー・Aivis の実エンジンへの接続・有償の画像生成は実測していない。

### 統合検証のコマンド

次の構文で、`<SHA>` は検証対象のコミット、`<原典生成ジョブ>` は原典の複製で実際に生成した schema_version 0.4 のジョブを指定する。実行結果・実際の引数・対象コミットは [M7 REPORT](work/M7/REPORT.md) と [VERIFICATION](../VERIFICATION.md) にある。

| コマンド | 内容 |
| --- | --- |
| `npm run test:tier-b -- --commit <SHA>` | CLI と MCP の生成→setup→validate。証拠は `.agent-work/m7-evidence/tier-b.json`。ハッシュ採取後に一時ジョブを削除する |
| `node tools/runtime-smoke.mjs --entry cli --commit <SHA>` | ビルド後に CLI の実レンダーを確認する |
| `node tools/runtime-smoke.mjs --entry mcp --commit <SHA>` | ビルド後に MCP の実レンダーと run のポーリングを確認する |
| `node tools/runtime-smoke.mjs --entry cli --legacy-job <原典生成ジョブ> --commit <SHA>` | 原典0.4ジョブの status・report なしの validate pass/fail・QC・レンダー・ghost を確認する |

Tier C は既存の Chrome/Edge を使い、自動導入しない。証拠 JSON・静止画・ghost report を保存し、成功時は一時ジョブの依存と動画を削除する。失敗時は調査用ジョブを保持する。動作確認用ジョブは voice none、音響はジョブ内の合成を使う。実 Aivis・有償画像生成はこの検証に含めない。

## MCP の起動

MCP サーバーは、ビルド後に repo のルートを作業ディレクトリにして、次の入口で起動する。公式 SDK のクライアントから、初期化・ツール一覧・ツール呼び出しまで確認した。

```json
{"command":"node","args":["dist/cli/main.js","mcp","serve","--root",".","--read-only"]}
```

`mcp serve` の標準出力は JSON-RPC 専用で、起動時のエラーは hint 付きの JSON を標準エラーに出す。root が存在しないかファイルのときは `E_PATH_DENIED`・終了コード2になる。詳しくは [MCP](MCP.md) と [M3 の REPORT](work/M3/REPORT.md) を参照する。
