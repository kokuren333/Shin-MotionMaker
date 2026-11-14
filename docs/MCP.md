# MCP

MCP は公式 TypeScript SDK 1.32.2 による stdio サーバーである。この PC の SDK クライアントとの初期化ではプロトコル `2025-11-25` を確認した。標準出力は JSON-RPC 専用で、起動失敗と通信ログは標準エラーに出す。

## 起動とクライアント登録

正式な CLI 入口は `shin-motionmaker mcp serve`。ビルド後は `node dist/cli/main.js mcp serve --root <dir>` でも起動できる。上位の `src/main.ts` が CLI と `src/mcp/index.ts` の `serveMcp(options)` を結線する。

`--root` は必須である。`--read-only`、`--enable-generation`、繰り返せる `--allow-dir` と `--allow-engine-host` を受け付ける。不明なオプション・必須値の欠落は `E_USAGE`、不在またはディレクトリでない root / allow-dir は接続開始前に `E_PATH_DENIED` と hint で終了する。どちらも終了コード2で、stdout には何も書かない。

[クライアント登録例](mcp-client.example.json) は次の設定である。Node 22 以上で、作業ディレクトリをこの repo のルートにして起動する。公式 SDK の `StdioClientTransport` へこの `command`・`args` を渡し、初期化・ツール一覧・候補取得まで実行した。クライアント側の設定ファイルの場所や登録 UI は各クライアントに従う。作業ディレクトリを指定できないクライアントでは、利用環境のエントリと root のパスへ置き換える。

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

この例は読み取り専用登録である。先に `npm run build` を実行して、ビルド済み JavaScript を用意する。

## ツールと封筒

名前・入力スキーマ・日本語説明は host の共通操作定義表から取得する。CLI 専用の `studio`・`mcp serve`・`version` は公開しない。版は初期化応答の `serverInfo.version` に返す。

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

外側の入力は `additionalProperties:false`。自由記述と任意の patch 本文を候補一覧に制限しない。正確な型・範囲は `tools/list` と [CONTRACT](CONTRACT.md) に従う。ツールのスナップショットは `tests/fixtures/mcp-tools.json` にあり、共通 outputSchema を1回格納し、各ツールから参照している。

各ツールは同じ封筒 JSON を `structuredContent` と先頭の text ブロックに返す。`isError` は `ok:false` のときだけ true。実行できた QC の fail は `ok:true`・`isError:false` であり、MV の QC は `verdict:not_applicable`。候補とジョブ状態全体には合否・スコア・順位を付けない。状態の checks は保存済み検査の verdict をそのまま示す。

全ツールの outputSchema は host の封筒スキーマで、外部ファイル参照をローカル `$defs` にまとめる。report の PNG は JSON 内で `data:null`、`mime_type:"image/png"`、元画像の `bytes`・`sha256`、`delivered_as:"image"` を返す。本体の base64 は後続の image ブロックだけに1回入れる。MCP の上限は6 MiBで、符号化後は約8 MiBとなり SDK 既定の受信上限10 MiBに収まる。超過時は `E_INPUT_INVALID` と CLI の `smm report` または縮小を案内する hint を返し、接続を続ける。CLI は従来どおり8 MiBまで、JSON の data に base64 を返す。検証用 SDK クライアントも受信上限を変更しない。

SDK 既定の受信上限10 MiBを超える入力1行をクライアントから送ると、SDK の stdio transport が閉じ、サーバーは終了する。切り離した run は継続する。未知のツール名には `isError:true` と `E_USAGE` の封筒を返す。

## run の待ち方

run の `wait_ms` は整数0〜50,000。`job_validate` の final=false、`job_qc`、`job_sound` の既定は45,000。それ以外と `job_validate` の final=true は0。run_get の既定は0である。

待ち時間内に終われば result に検査結果、走行中なら開始操作の result は null、封筒の run に ID と running を返す。run_get は走行中も report:null・artifacts:[] とログ末尾を返す。`log_tail` は0〜2,000、既定100行。`log_offset` は受け付けない。

呼び出し側は同じ job と run_id で run_get を繰り返す。completed は処理が想定内に終了したことを表し、ゲートの合否は `result.verdict` で読む。run_get 自体が取得できれば、過去 run が failed でも `ok:true` で、run 内の error を保持する。台帳とログはジョブ内の `.smm/runs/` にあり、サーバーを終了しても worker は継続する。取り消す場合は run_cancel を明示して呼ぶ。

進捗トークンがある run 操作・run_get は、待機中に host の状態を約1秒間隔で観測し `notifications/progress` を返す。progress は通知の連番で、message に Run.progress.text と、存在すれば比率を表示する。操作開始時の通知は、その呼び出し開始以降に作られた同種の MCP run を観測できたときだけ送る。進捗は補助情報で、待機・結果・排他は host が所有する。トークンがない場合は追加の観測をしない。クライアントの要求キャンセルは run_cancel の代わりにならない。

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

この PC の Windows / Node 24 で以下を実行した。Tier B は実際に生成したジョブに依存を導入する。Tier A の通常テストには含めない。

```powershell
node --experimental-strip-types --test tests/mcp.test.ts tests/mcp-fix.test.ts tests/mcp-setup.test.ts
node --experimental-strip-types --test tests/mcp-docs.test.ts
node --experimental-strip-types tools/smoke-mcp.ts
node tools/audit-mcp-licenses.mjs
```

Tier B は68ファイルの生成、setup の completed / exit 0、validate の completed / pass / exit 0、依存導入済み、プロトコルエラー0を確認した。同じコマンドを ubuntu の CI ジョブに置き、ジョブ依存の npm キャッシュを設定する。Windows の symlink 作成はこの PC では EPERM で、junction の外向き拒否を実測した。Linux / Node 22 の実測は L2 がリモート作成後の CI へ持ち越す。証拠と残課題は [M3 REPORT](work/M3/REPORT.md) に記録する。文面の推敲は M6 担当へ渡す。
