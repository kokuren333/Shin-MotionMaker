# CLI

Node.js 22 以上で使用する。実行ファイル名は `shin-motionmaker` と `smm`。配布する入口はビルド済みの `dist/cli/main.js` である。CLI は共通の host 操作定義表にある名前・入力スキーマからコマンドを登録する。

以下の表は構文であり、山括弧は利用者が指定する値を示す。実行済みの例と結果は後述の記録を参照する。

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

`--human` は通常の封筒を人向けの要約へ切り替える。`mcp serve` の標準出力は指定の有無によらず JSON-RPC 専用である。run の開始コマンドには `--detach` と `--wait-ms` もある。CLI は通常完了まで前面で待つため、開始時の wait-ms にかかわらず短い取得を繰り返す。detach では待たない。runs wait も終端まで取得を繰り返す。runs logs は即時取得、runs get だけは wait-ms の指定時間（最大50,000ms）まで取得を待てる。log-tail は0〜2,000行で既定100行。

imagegen の kind は原典の background / transparent / character-sheet / motion / texture / prop。refs は assets/・sources/、prompt-file と style は plan/・sources/ に限る。任意の子プロセス引数を通す口はない。

## 入力と出力先

request は `{ "form": {...}, "assets": {...} }`。省略したフォーム値は原典の既定値になる。創造に関わる方向性・指示・理解ゴール等は自由記述の文字列である。assets の sources はパス配列、character / secondCharacter / bgm / music はパスまたは null。添付は request ファイルの親から解決する。UTF-8 BOM を受け付ける。

out は親ディレクトリであり、フォルダはその下の safeName(title)、ZIP はその下の safeName(title)-motion-job.zip に作成する。既存のファイル・空フォルダも上書きしない。未知キー・型・validateForm のエラーは本文の書出し前に拒否する。dry-run は生成内容を返し、出力親も作らない。MV の音源尺を補完できなければ、musicDurationSec の指定を案内する。

## 封筒

通常の標準出力は `smm.envelope/1` の JSON 1個と末尾 LF だけである。子プロセスの stdout / stderr は差分を読んで CLI の標準エラーへ流す。標準出力が1個かどうかは、本文中の改行文字ではなく JSON 全体を parse して判断できる。PNG は data が base64 文字列、encoding が base64 となる。

- 成功: schema / command / ok:true / result / advisories / warnings。run 操作では run と job も返す。
- 失敗: schema / command / ok:false / error:{code,message,hint,details?}。開始済みなら run も返す。
- ok は操作結果を得たこと、result.verdict は検査の pass / fail / not_applicable。QC fail でも ok:true。
- 助言は advisories。件数・主観・SKIPPED は通常の ok・verdict・終了コードを変えない。imagegen の strict だけは記録済み SKIPPED を fail とする。
- run_get 相当の runs get / wait / logs は台帳の取得に成功すれば ok:true。元の失敗は run.error に保持する。
- human は標準出力を日本語の要約へ切り替える。JSON 封筒を必要とする呼出側では指定しない。

封筒・run・結果の定義は schemas/ にある。version の結果も smm.version/1 を持つ。

## 終了コード

| 値 | 意味 |
| --- | --- |
| 0 | 成功、対象外、助言だけの実行 |
| 1 | 完了した検査の不合格、imagegen strict の未生成 |
| 2 | 使い方・入力・出力先の誤り |
| 3 | 環境・前提の不足 |
| 4 | 内部エラー・異常終了・取消・時間切れ・lost |

前面 run と runs wait は終端 run.exit_code を使う。runs wait は元の run が失敗しても台帳取得の ok は true のままで、終了コードだけは元の run と同じになる。runs get / list / logs / cancel は取得・取消操作が成功すれば0。detach は開始に成功すれば0で、以後の結果は台帳から得る。

| 値 | エラーコード |
| --- | --- |
| 2 | E_USAGE, E_INPUT_INVALID, E_FORM_INVALID, E_PATH_DENIED, E_OUTPUT_EXISTS |
| 3 | E_JOB_NOT_FOUND, E_NOT_A_JOB, E_DEPS_MISSING, E_TOOL_MISSING, E_ENGINE_UNREACHABLE, E_BUSY, E_CONFLICT, E_RUN_NOT_FOUND, E_DISABLED |
| 4 | E_RUN_LOST, E_TIMEOUT, E_INTERNAL |

message と hint は日本語。引数不足・重複・非対応オプションは E_USAGE。引数を解釈できてもスキーマに合わない値は E_INPUT_INVALID。validateForm の文言は原典のまま details に入る。依存不足・排他・無効操作の事前拒否では run を作らない。

## ジョブ内スクリプトからの対応

M0-Q3 の実測は [CLI-EXAMPLES.json](work/M2b/CLI-EXAMPLES.json) と [TIER-B.json](work/M2b/TIER-B.json)。判定の実装は host の1箇所であり、CLI は以下を再実装しない。元の値は run.script_exit_code、正規化値は run.exit_code に残る。

| スクリプト | 実測した元の終了と証拠 | 正規化 |
| --- | --- | --- |
| validate.mjs | 依存導入後の成功0 / タイトル欠落の検査不合格1。R4 の report と終了を照合。依存未導入の直接実行も1 | 完了した pass は0、fail は1。依存不足を先に E_DEPS_MISSING / 3 と分類。完了の証拠がない異常は E_INTERNAL / 4 |
| 原典0.4 validate.mjs | R4 を基線の置換対で逆変換し、実依存で成功0 / 不合格1。report なしでも完了 stdout / OK 行・検査エラーを確認 | 成功0 / 不合格1。例外文・スタック等の未分類異常は E_INTERNAL / 4 |
| qc.mjs | 合成記録で pass=0、制作記録なしで fail=1、MV は report を作らず0。不正 stage は2。制作記録の読取対象がディレクトリでも catch の2 | 完了 report の pass=0 / fail=1、MV は not_applicable / 0。stage 不正は起動前 E_INPUT_INVALID / 2。未分類の読取異常は E_INTERNAL / 4 |
| ghost-check.mjs | 実 ffmpeg の走査は0。動画不在は1 | 走査完了は助言 / 0。動画不在を起動前 E_INPUT_INVALID / 2、ffmpeg 不在を E_TOOL_MISSING / 3 と分類。未分類1は E_INTERNAL / 4。検出件数から fail を作らない |
| imagegen.mjs | Codex 不在の SKIPPED は0、strict は1、必要引数不在も1 | SKIPPED は助言 / 0、strict の記録済み SKIPPED だけ fail / 1。入力不正を起動前に2、未分類異常を4とする |
| aivis.mjs | engine none は0、未対応 engine は1 | none は not_applicable / 0、明示的入力エラーは E_INPUT_INVALID / 2。必要時の疎通不足は E_ENGINE_UNREACHABLE / 3。未分類異常は4 |
| sound-design.mjs | 生成無効は0、有効な cue の WAV 合成は0、空の cues は1 | 対象外 / 成功0、明示的 plan エラーは E_INPUT_INVALID / 2、未分類異常は4 |
| run.mjs | 不正 mode は1、依存未導入の preview も1 | CLI は既知 target だけを渡す。依存不足を起動前3とする。成功は0、実行後に判明した道具不足は3、未分類非0は4。実レンダーは M7 |
| setup（npm） | 実依存の install と、依存なし workspace の install / ci は0。Windows 拡張 cwd の npm URL エラーは1 | 成功0、npm 不在は3、導入失敗は4。拡張 cwd の不具合は host で修正 |

最新 report は開始日時以降のものだけを使う。元の1だけで不合格とは判定せず、完了の証拠と終了値の一致を要求する。FAT・一部ネットワーク FS の粗い mtime では新しい report も拒否される場合がある。

## 実行済みの例

以下は repo ルートから実行した。入力と生成先は検証専用の .agent-work/cli-evidence/ に置いた。入力の作成を含む再現手順は tools/verify-cli.mjs、各例の結果は [CLI-EXAMPLES.json](work/M2b/CLI-EXAMPLES.json) にある。

```powershell
node dist/cli/main.js version
node dist/cli/main.js schema request
node dist/cli/main.js candidates --mode explanation --seed 42 --count 3
node dist/cli/main.js generate .agent-work/cli-evidence/request.json --out .agent-work/cli-evidence/jobs
node dist/cli/main.js generate .agent-work/cli-evidence/request.json --out .agent-work/cli-evidence/archives --zip
node dist/cli/main.js qc ".agent-work/cli-evidence/jobs/CLI & 全角 空白" --stage pre
```

最後の例は生成直後の解説では ok:true / verdict:fail / 終了1となる。検証用の入力を変更した追加実測も同じ記録に時系列で載せている。

M2b ではブラウザの Studio 操作・実レンダー・Aivis 実エンジン接続・有償の画像生成は未実測。

MCP の登録例はビルド後、repo ルートを作業ディレクトリとして次の入口を使う。SDK クライアントから初期化・一覧・ツール呼出まで確認した。

```json
{"command":"node","args":["dist/cli/main.js","mcp","serve","--root",".","--read-only"]}
```

`mcp serve` の標準出力は JSON-RPC 専用で、起動エラーは hint 付きの JSON を標準エラーへ出す。root が不在・ファイルの場合は E_PATH_DENIED / 終了2。詳細は [MCP](MCP.md) と [M3 REPORT](work/M3/REPORT.md) を参照する。
