# MCP

Shin-MotionMaker の MCP サーバーは、公式 TypeScript SDK 1.32.2 による stdio サーバーである。開発機の SDK クライアントとの初期化では、プロトコル `2025-11-25` を確認した。標準出力は JSON-RPC 専用で、起動の失敗と通信のログは標準エラーに出す。

## 起動とクライアント登録

正式な入口は CLI の `shin-motionmaker mcp serve` である。ビルド後は `node dist/cli/main.js mcp serve --root <dir>` でも起動できる。上位の `src/main.ts` が、CLI と `src/mcp/index.ts` の `serveMcp(options)` をつないでいる。

| オプション | 内容 |
| --- | --- |
| `--root <dir>` | 必須。MCP が読み書きできる範囲 |
| `--read-only` | run・patch・取消・generate のツールを公開しない（詳細は「安全の境界」） |
| `--enable-generation` | 画像生成のツールを公開する |
| `--allow-dir <dir>` | 繰り返し指定できる。`request.assets` の絶対パスの添付を読める範囲 |
| `--allow-engine-host <host>` | 繰り返し指定できる。ループバック以外の音声エンジンへの接続を許すホスト名 |

- 不明なオプションや必須値の欠落は `E_USAGE`。root・allow-dir が存在しないかディレクトリでないときは、接続を始める前に `E_PATH_DENIED` と hint を返して終わる。どちらも終了コード2で、標準出力には何も書かない。

### 登録例

[クライアント登録例](mcp-client.example.json) は次の設定である。

```json
{
  "mcpServers": {
    "shin-motionmaker": {
      "command": "node",
      "args": ["dist/cli/main.js", "mcp", "serve", "--root", ".", "--read-only"]
    }
  }
}
```

- 読み取り専用の登録である。先に `npm run build` を実行して、ビルド済みの JavaScript を用意しておく。
- Node 22 以上で、作業ディレクトリをこの repo のルートにして起動する。公式 SDK の `StdioClientTransport` にこの `command`・`args` を渡し、初期化・ツール一覧・候補の取得まで実行して確かめた（`tests/mcp-docs.test.ts`）。
- クライアント側の設定ファイルの場所や登録画面は、各クライアントに従う。作業ディレクトリを指定できないクライアントでは、エントリと root のパスを利用環境のものに置き換える。

## ツールと封筒

ツールの名前・入力スキーマ・日本語の説明は、host の共通の操作定義表から取る。CLI 専用の `studio`・`mcp serve`・`version` は公開しない。版は初期化応答の `serverInfo.version` で返す。

| ツール | 主な入力 | 内容 |
| --- | --- | --- |
| `job_generate` | request, out, format?, dry_run? | `{form, assets}` からジョブまたは ZIP を新規作成 |
| `direction_candidates` | mode, seed?, count?, characters?, orientation? | たたき台であり固定の正解ではない候補。自動適用しない |
| `text_stats` | kind, text, request? | 歌詞・台本の統計 |
| `job_status` | job | ファイルから状態と助言 hints を導出 |
| `project_get` | job, pointer? | 本文と実バイトの SHA-256 |
| `project_patch` | job, patch, expect_sha256 | JSON Merge Patch。hash 不一致は E_CONFLICT |
| `report_get` | job, path | 許可された記録・PNG |
| `job_setup` | job, wait_ms? | ジョブの npm 依存を導入 |
| `job_validate` | job, final?, double_render?, wait_ms? | ジョブ内の構造検査 |
| `job_qc` | job, stage, wait_ms? | 事前・事後 QC。MV は対象外 |
| `job_ghost_check` | job, target?, video?, double_render?, keep?, no_stills?, max_stills?, tile_threshold?, min_tiles?, wait_ms? | ジョブ内の走査。検出件数は助言 |
| `job_render` | job, target, frame?, wait_ms? | preview・final・still |
| `job_voice` / `job_sound` | job, wait_ms? | ジョブ内の音声・音響生成 |
| `job_imagegen` | job, name, prompt? / prompt_file?, kind?, refs?, style?, size?, timeout?, force?, dry_run?, strict?, wait_ms? | 許可された画像生成オプションだけを渡す |
| `run_get` | job, run_id, wait_ms?, log_tail? | 状態・結果・ログ末尾 |
| `run_list` / `run_cancel` | job / job, run_id | 台帳取得・子孫を含む停止 |
| `doctor` | job? | 環境を報告。自動導入しない |
| `schema_get` | name? | スキーマ一覧または本文 |

- 外側の入力は `additionalProperties: false`。自由記述と任意の patch 本文を、候補の一覧に制限しない。正確な型と範囲は `tools/list` と [CONTRACT](CONTRACT.md) に従う。
- request の既存の列挙値は core の `formChoices` を共有し、generate・台本統計と GUI の request 読込で同じ shape 検査を通る。原典 `validateForm` と同じ条件で、MV では様式・配置を見ず、解説の2人目の配置は duo のときだけ確認する。対象の範囲外の列挙値は `E_INPUT_INVALID` と JSON Pointer 付き `details` で返す。未完成の自由記述は shape 検査で拒否しない。
- ツールのスナップショットは `tests/fixtures/mcp-tools.json` にある。共通の outputSchema を1回だけ格納し、各ツールから参照している。

### 封筒と isError

- 各ツールは、CLI と同じ封筒の JSON を `structuredContent` と先頭の text ブロックに返す。
- `isError` が true になるのは `ok: false` のときだけである。実行できた QC の fail は `ok: true`・`isError: false` で、MV の QC は `verdict: not_applicable` になる。
- 候補とジョブ状態の全体には、合否・スコア・順位を付けない。状態の `checks` は、保存済みの検査の verdict をそのまま示す。
- 全ツールの outputSchema は host の封筒スキーマで、外部ファイルの参照はローカルの `$defs` にまとめてある。
- 未知のツール名には、`isError: true` と `E_USAGE` の封筒を返す。

### PNG の受け渡しと上限

- `report_get` で PNG を取得すると、JSON の中は `data: null`・`mime_type: "image/png"`・元画像の `bytes`・`sha256`・`delivered_as: "image"` になる。base64 の本体は、後に続く image ブロックに1回だけ入る。
- MCP の上限は6 MiB で、符号化後は約8 MiB になり、SDK の既定の受信上限10 MiB に収まる。超えたときは `E_INPUT_INVALID` と、CLI の `smm report` か縮小を案内する hint を返し、接続は続ける。
- CLI は従来どおり8 MiB まで扱い、JSON の `data` に base64 を入れて返す。検証用の SDK クライアントも受信上限を変えていない。
- クライアントから SDK の既定の受信上限10 MiB を超える1行を送ると、SDK の stdio transport が閉じてサーバーは終了する。切り離した run は続く。

## run の待ち方

レンダーや検査などの長い処理は run として実行する。

- run の `wait_ms` は0〜50,000の整数。既定は `job_validate`（`final=false`）・`job_qc`・`job_sound` が45,000、それ以外と `job_validate`（`final=true`）が0。`run_get` の既定は0である。
- 待ち時間のうちに終われば、`result` に検査結果が入る。走行中なら、開始した操作の `result` は `null` で、封筒の `run` に ID と `running` が入る。
- 走行中の `run_get` は、`report: null`・`artifacts: []` とログの末尾を返す。`log_tail` は0〜2,000で既定100行。`log_offset` は受け付けない。

呼び出し側は、同じ `job` と `run_id` で `run_get` を繰り返す。

- `completed` は、処理が想定どおりに終わったことを表す。ゲートの合否は `result.verdict` で読む。
- `run_get` 自体が取得できれば、過去の run が failed でも `ok: true` で、run の中の `error` を保つ。
- 台帳とログはジョブ内の `.smm/runs/` にある。サーバーを終了しても worker は続く。止めるときは `run_cancel` を明示して呼ぶ。クライアントの要求キャンセルは `run_cancel` の代わりにならない。

### 進捗の通知

- 進捗トークンがある run 操作と `run_get` は、待っている間に host の状態を約1秒おきに観測し、`notifications/progress` を返す。トークンが無ければ追加の観測はしない。
- `progress` は通知の連番で、`message` には `Run.progress.text` と、あれば比率を表示する。
- 操作の開始時の通知は、その呼び出しの開始以降に作られた同じ種類の MCP の run を観測できたときだけ送る。
- 進捗は補助の情報である。待機・結果・排他は host が持つ。

## 安全の境界

- MCP の入力パスは root 相対で `/` 区切り。`..`・絶対パス・外向き symlink / junction は `E_PATH_DENIED`。未作成の親も実体を解決する。返す表示パスも root 相対である。
- 例外は `request.assets` だけで、allow-dir 内の実体を持つ絶対パスの添付を読める。allow-dir は存在する絶対パスのディレクトリを指定する。ジョブ・出力・report・画像生成の参照パスの制限は緩めない。添付のファイル名だけを core に渡す。
- read-only は操作表の公開フラグに従い、全 run・patch・取消・generate を非公開にする。dry_run も generate のため非公開。非公開ツールを直接呼んでも `E_DISABLED`。
- job_imagegen は enable-generation がある場合だけ公開する。画像生成は費用が発生する場合がある。
- voice の非ループバック接続は allow-engine-host のホスト名の明示許可が必要。doctor の Aivis 疎通も同じ許可に従い、未許可なら接続せず未確認として報告する。host の疎通確認は URL のリダイレクト先へ許可を引き継がない。ジョブ内スクリプトの fetch はそのスクリプトの挙動に従う。
- 任意のコマンドや任意 argv を実行するツールはない。操作表のジョブ内スクリプトだけを host が配列引数・shell:false で起動する。同じジョブの書込・run は排他的で、衝突は所有 run を示す `E_BUSY`。
- report_get は reports/・plan/、brief.md・AGENTS.md・README.md、output/ 直下の PNG に限定する。テキストは256 KiBで切り詰め、PNG は6 MiBを超えると拒否する。
- host の表示用変換で、MCP に返すログ・report の文字列に含まれるホームを `~`、ジョブ・root・導入先の絶対パスを相対表現へ置き換える。realpath、`/` 区切り、file URL、Windows の大文字小文字の違いも対象とする。保存済みのファイルは変更しない。

**ジョブ内スクリプトの実行は `npm run` と同じ信頼の範囲であり、sandbox ではない。** 信頼できるジョブだけを実行する。スクリプト自身のファイル・ネットワークアクセスを隔離する仕組みではない。

パス検査は Node のパスベース API によるもので、OS のディレクトリハンドルに対する相対 open / rename ではない。同じ権限で親を差し替えて元へ戻す競合、照合直後のリンク・本文の変更を完全には排除できない。書込後に変化を検出しても、既に起きた副作用は巻き戻さない。通常の atomic rename と読取の競合でも拒否される場合がある。

プロセスの同一性照合と停止も OS の単一操作ではない。Linux の子孫採取後に別セッションへ逃げるプロセスなどを完全には拘束しない。Windows の Job Object を常時所有する隔離とも異なる。時刻粒度が粗いファイルシステムでは、新しいレポートが開始時刻より古く見えて採用されない可能性もある。

## 実行した検証

開発機の Windows・Node 24 で、repo のルートから次を実行した。

```powershell
node --experimental-strip-types --test tests/mcp.test.ts tests/mcp-fix.test.ts tests/mcp-setup.test.ts
node --experimental-strip-types --test tests/mcp-docs.test.ts
node --experimental-strip-types tools/smoke-mcp.ts
node tools/audit-mcp-licenses.mjs
```

- 1行目は MCP のプロトコル往復・安全・setup のテスト、2行目は上の登録例での起動の確認である。
- `tools/smoke-mcp.ts` は M3 の Tier B の記録で、実際に生成したジョブに依存を導入した。68ファイルの生成、setup の `completed`・終了0、validate の `completed`・`pass`・終了0、依存の導入済み、プロトコルエラー0を確認した。現在の共通入口は `npm run test:tier-b -- --commit <SHA>`（構文）で、CLI と MCP の生成→setup→validate を確認する。ubuntu の CI も共通の `tools/tier-b.mjs` を使い、ジョブの依存の npm キャッシュを設定している。通常のテスト（Tier A）には含めない。
- `tools/audit-mcp-licenses.mjs` は、MCP SDK とその推移依存の LICENSE を `docs/work/M3/dependency-licenses.json` の記録と照合する。
- この開発機の Windows では symlink の作成が EPERM になるため、junction の外向きの拒否を実測した。Linux・Node 22 での実測は、リモートの作成後の CI へ持ち越している。

各回の結果は [M3 の REPORT](work/M3/REPORT.md) と [M6 の command-log](work/M6/command-log.md) にある。

M7 では Windows の CLI/MCP 両経路で実レンダー（Tier C）も確認した。MCP は各操作を `wait_ms:0` で開始し、同じ job・run_id の `run_get` を `wait_ms:50000` で繰り返して完了結果を取得した。実行コマンド・証拠の保存先と削除範囲は [CLI の統合検証](CLI.md#統合検証のコマンド)、コミット・run ごとの終了値は [M7 REPORT](work/M7/REPORT.md) と [VERIFICATION](../VERIFICATION.md) にある。
