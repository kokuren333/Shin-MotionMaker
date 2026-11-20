# SEEDANCE — 設計メモ（L2 確定版）

発注の正本は [DIRECTION.md](DIRECTION.md)。この文書は L3 への共通の仕様であり、逸脱は [QUESTIONS.md](QUESTIONS.md) を経由する。

## 1. 方式

- **REST API を Node 標準の `fetch` で実装する。Python SDK（arkruntime）は使わない。**
  - repo は TS／Node の単一ランタイムで、SDK を使うと Python のサイドカーが要り、再開・台帳・テストの面が二重になる（AGENTS.md 規則13・14）。
  - SDK は手元に未導入（2026-11-20 実測）。オーナー指示は「Python SDK または REST API」であり、REST で充足する。
- 新規 npm 依存はゼロ。

## 2. 配置（追加のみ）

| ファイル | 役割 |
| --- | --- |
| `src/host/seedance/models.ts` | モデル登録表（別名・ID・解像度・単価・参照上限・寸法表）と見積り関数 |
| `src/host/seedance/request.ts` | 入力の検査と `content[]`・リクエスト本文の構築（mode ごとの role、混在拒否、参照上限） |
| `src/host/seedance/client.ts` | REST クライアント（作成・取得・一覧・取消・ダウンロード）、エラー分類、リトライ。`fetch` を参照してよいのはこのファイルだけ |
| `src/host/seedance/mock.ts` | DRY_RUN 用のモック transport（client と同じインターフェース）。ネットワークに出ない |
| `src/host/seedance/mock-video.ts` | モック MP4 の埋め込みバイト（base64）。生成手順は `tools/make-seedance-mock.mjs` |
| `src/host/seedance/mp4.ts` | MP4 の箱構造の検査（ftyp・moov・mdat、mvhd の長さ、tkhd の幅高さ）。ffprobe 相当の客観検査 |
| `src/host/seedance/store.ts` | `<job>/seedance/tasks.json` の読み書き（ロック＋原子的書き込み）、キャッシュ検索、予算集計 |
| `src/host/seedance/service.ts` | 操作の本体：`seedanceCreate`・`seedanceStatus`・`seedanceList`・`seedanceDoctorCheck` |
| `src/host/seedance/index.ts` | 公開名の再輸出 |

`src/host/index.ts` から `seedance/index.ts` を再輸出する。core は変えない。GUI・job-template・フォーム型は変えない。

## 3. 環境変数

| 変数 | 既定 | 意味 |
| --- | --- | --- |
| `ARK_API_KEY` | なし | API キー。環境変数からのみ読む。値はどこにも書かない・返さない |
| `SEEDANCE_DRY_RUN` | 未設定＝true | 値が `false` または `0`（大小無視、前後空白無視）のときだけ false。それ以外はすべて true |
| `SEEDANCE_BUDGET_USD` | 10 | プロジェクト（ジョブ）単位の上限。0 以上の有限数でなければ作成を拒否（E_INPUT_INVALID） |
| `SEEDANCE_POLL_INTERVAL_MS` | 5000 | 実 API のポーリング間隔。1000 未満は 1000 に丸める |

Base URL は公式の `https://ark.ap-southeast.bytepluses.com/api/v3` に固定（環境変数で変えない）。

## 4. 操作（操作定義表へ追加）

| ID | CLI | MCP | 種別 | read-only 公開 | enable-generation |
| --- | --- | --- | --- | --- | --- |
| seedance_create | `seedance create` | `seedance_create` | 同期・書込 | しない | 必要（imagegen と同じく費用が発生しうるため） |
| seedance_status | `seedance status` | `seedance_status` | 同期・書込（成功済み未保存なら保存） | しない | 不要（新しい課金を起こさない） |
| seedance_list | `seedance list` | `seedance_list` | 同期・読取 | する | 不要 |

CLI の位置引数はどれも `job`。run の仕組みは使わない（同期操作の中で上限時間つきのポーリング）。

### 4.1 seedance_create の入力（閉じたスキーマ）

| 項目 | 型 | 既定 | 備考 |
| --- | --- | --- | --- |
| job | string | 必須 | |
| shot_id | string | 必須 | `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$` |
| prompt | string | 必須 | 1 文字以上 |
| model | string | `seedance-2-0-mini` | 別名またはモデル ID。表に無ければ E_INPUT_INVALID |
| mode | `text`/`image`/`reference` | `text` | |
| first_frame, last_frame | string | — | image のみ。first_frame は image で必須 |
| reference_images, reference_videos, reference_audios | string[] | — | reference のみ。少なくとも1つ。モデルの参照上限を超えたら拒否 |
| resolution | `480p`/`720p`/`1080p`/`4k` | `720p` | モデルの対応解像度でなければ拒否 |
| ratio | `16:9`/`4:3`/`1:1`/`3:4`/`9:16`/`21:9`/`adaptive` | `16:9` | |
| duration | integer 1〜15 | 5 | モデルごとの細かな範囲は API が検証する |
| seed | integer -1〜4294967295 | — | 省略時は送らない |
| generate_audio | boolean | false | |
| watermark | boolean | false | |
| wait_ms | integer 0〜50000 | 45000 | 作成後に待つ上限。0 なら作成だけして返す（status で再開） |

入力素材の値：ジョブ内の相対パス（`/` 区切り、`assertRelative` を通す）または URL。URL は `https://` と `asset://` だけ受け付ける。
- 画像のローカルファイル（png/jpg/jpeg/webp、30 MiB 以下）は `data:image/...;base64,` にして送る。SHA-256 を記録する。
- 動画・音声のローカルファイルは v1 では受け付けない（E_INPUT_INVALID、hint で URL か `asset://` を案内）。

mode と content の対応（混在は E_INPUT_INVALID）：
- text：`[{type:"text", text}]`。素材を1つでも指定したら拒否。
- image：text ＋ `image_url` role `first_frame`（必須）／`last_frame`（任意）。reference_* を指定したら拒否。
- reference：text ＋ `image_url` role `reference_image`、`video_url` role `reference_video`、`audio_url` role `reference_audio`。first/last を指定したら拒否。

リクエスト本文：`{ model: <ID>, content, resolution, ratio, duration, generate_audio, watermark, seed?(指定時) }`。`callback_url`・`return_last_frame`・`camera_fixed`・`draft_task` は v1 で送らない。

### 4.2 seedance_status の入力

`job`（必須）、`task_id` または `shot_id`（どちらか一方が必須。shot_id のときはそのショットの最新レコード）、`wait_ms`（0〜50000、既定 0）。成功済みで未保存なら MP4・サイドカー・PNG の保存まで行う。

### 4.3 seedance_list の入力

`job`（必須）。

### 4.4 結果

- create／status：`{ task: SeedanceTask, cached: boolean }`。注意事項は envelope の `advisories`（source は `seedance`）に入れる。
- list：`{ tasks: SeedanceTask[], summary: { count, by_status: {<status>: n}, dry_run, api_key_present, budget_usd, real_spent_usd, reserved_usd, remaining_usd, mock_count } }`。

## 5. 見積り

- トークン＝`(入力動画秒数 + 出力秒数) × 幅 × 高さ × 24 / 1024`。
- 寸法（16:9）：720p＝1280×720、1080p＝1920×1080、4k＝3840×2160。480p は 2.5 系（2.5・2.5 Flash）が 854×480、2.0 系が 864×496（公式の5秒例と一致させるための値）。16:9 以外の比率は、同じ解像度の 16:9 と同じ画素数として見積もる（`estimate_basis: "area-16:9"`）。
- 単価（USD／1M トークン、動画入力なし／あり）：

| 別名 | ID | 解像度 | 480p・720p | 1080p | 4k | 参照上限 画像/動画/音声 |
| --- | --- | --- | --- | --- | --- | --- |
| seedance-2-5 | dreamina-seedance-2-5-260628 | 480p/720p/1080p/4k | 10.7／6.4 | 11.7／7.0 | 未登録（作成を拒否） | 30/10/10 |
| seedance-2-5-flash | dreamina-seedance-2-5-flash-261115 | 480p/720p | 7.0／4.3 | — | — | 10/5/5 |
| seedance-2-0 | dreamina-seedance-2-0-260128 | 480p/720p/1080p/4k | 7.0／4.3 | 7.7／4.7 | 4.0／2.4 | 9/3/3 |
| seedance-2-0-fast | dreamina-seedance-2-0-fast-260128 | 480p/720p | 5.6／3.3 | — | — | 9/3/3 |
| seedance-2-0-mini | dreamina-seedance-2-0-mini-260615 | 480p/720p | 3.5／2.1 | — | — | 9/3/3 |

- 「動画入力あり」の単価は reference_videos が1つ以上のとき使う。入力動画の秒数は URL からは分からないので、1本あたり 15 秒と保守的に仮定する（`estimate_basis` に記録）。動画入力時は公式の最低トークン消費が適用されるが、詳細表が外部（Lark）のため v1 は式ベースで見積もり、実績（`usage.completion_tokens`）を優先する。
- USD は小数第6位で丸めて記録する。公式例との一致は単体テストで確認する（2.0／720p／5秒＝108000 トークン＝$0.756、mini 720p 5秒＝$0.378 など）。

## 6. 安全と費用（合否ゲート級、すべて客観判定）

- DRY_RUN（既定）：モック transport を使い、`fetch` を一切呼ばない。task_id は `mock-` 接頭辞。モックの取得は常に succeeded を返し（状態を持たない）、`usage.completion_tokens` は見積りトークン、動画は埋め込み MP4 を書き出す。
- 実 API（DRY_RUN=false）の作成の前提は3つすべて：①`ARK_API_KEY` がある、②`project.json` の `asset_generation.video_generation === true`、③予算内。欠けたら E_DISABLED（details.reason＝`api_key_missing`／`video_generation_off`／`budget_exceeded`）。拒否時は台帳に何も書かない。
- DRY_RUN で opt-in が無い場合は作成を許し、advisory（`seedance-opt-in-required-for-real`）を付ける。
- 予算（DRY_RUN でも同じ計算をする）：`real_spent_usd`（mock でないレコードの `actual_usd`、未確定なら `estimate_usd`）＋`reserved_usd`（mock でない creating/queued/running の見積り）＋今回の見積り ＞ `SEEDANCE_BUDGET_USD` なら拒否。mock レコードは費用 0 として数える。
- 単価が未登録（2.5 の 4k）なら見積りできないので、モードにかかわらず E_INPUT_INVALID で拒否。
- キーは `Authorization: Bearer` ヘッダーを組み立てる client の1か所だけで読む。レコード・サイドカー・エラー・ログ・advisory にキーの値も断片も含めない。エラーの details に応答ヘッダーや要求ヘッダーを入れない。応答本文から取るのは `error.code` と `error.message`（512 文字まで）だけ。

## 7. クライアント

- 作成 `POST /contents/generations/tasks`、取得 `GET /contents/generations/tasks/{id}`、一覧 `GET /contents/generations/tasks`、取消 `DELETE /contents/generations/tasks/{id}`、ダウンロード（`content.video_url` の GET、Authorization を付けない）。
- エラー分類 `details.kind`：

| kind | 条件 | SmmError code |
| --- | --- | --- |
| auth | 401、または 403 で認証系の code | E_DISABLED |
| activation | 403／404 等でモデル未有効化・残高不足・アカウント系の code（`ModelNotOpen`、`AccountOverdue` 等を含む） | E_DISABLED |
| rate_limit | 429 | E_BUSY |
| invalid | その他の 4xx | E_INPUT_INVALID |
| server | 5xx | E_ENGINE_UNREACHABLE |
| network | 応答なし（接続失敗・タイムアウト） | E_ENGINE_UNREACHABLE |

  エラーコードの列挙（契約）は増やさない。

- リトライ：最大2回（計3回）、指数バックオフ（1s・2s、`sleep` は注入可能）。対象は 429・5xx・network だけ。その他の 4xx は即失敗。
  - **作成（POST）だけは課金の二重発生を避けるため狭める**：429 と 5xx の応答、および送信前に失敗したと判定できる接続エラー（`ECONNREFUSED`・`ENOTFOUND`・`EAI_AGAIN`）だけをリトライし、送信後のタイムアウト・切断はリトライしない（status `unknown` で記録し、コンソールで確認するよう hint を返す）。QUESTIONS.md の SEEDANCE-Q2。
- 各リクエストに `AbortSignal.timeout`（API 30 秒、ダウンロード 300 秒）。ダウンロードは 1 GiB 上限、一時ファイルに書いてから rename。

## 8. 永続化・キャッシュ・再開

- `<job>/seedance/tasks.json`：`{ "schema": "smm.seedance-tasks/1", "tasks": [SeedanceTask...] }`。書き込みは `<job>/seedance/.lock`（排他作成、古いロックは 10 分で破棄）を取ってから、一時ファイル＋rename。
- SeedanceTask：`local_id`（`s-<UTC時刻>-<hex8>`）、`shot_id`、`task_id`（null 可、mock は `mock-`）、`dry_run`、`model`（{alias, id}）、`mode`、`prompt`、`inputs[]`（{role, path?, url?, sha256?}）、`params`（{resolution, ratio, duration, seed?, generate_audio, watermark}）、`cache_key`、`cached`、`status`（`creating`/`queued`/`running`/`succeeded`/`failed`/`cancelled`/`expired`/`unknown`/`error`）、`estimate_usd`、`estimate_tokens`、`estimate_basis`、`usage_tokens`、`actual_usd`、`output`、`output_sha256`、`sidecar`、`thumbnail`、`error`、`created_at`、`updated_at`。パスはすべてジョブ相対の `/` 区切り。
- 作成の手順：レコードを `creating` で保存 → POST → task_id と `queued` を保存 → wait_ms までポーリング → succeeded なら保存処理。どの時点で落ちても、`seedance status` が tasks.json から追跡できる。
- 保存処理：ダウンロード（mock は埋め込みバイト）→ `mp4.ts` で検査（不合格なら status `error`、`details.kind: "invalid_output"`）→ `seedance/out/<出力名>.mp4` → サムネイル `<出力名>.png`（ffmpeg が使えれば先頭フレーム、失敗なら null）→ サイドカー `<出力名>.json`。
- 出力名：`<shot_id>`。同じ名前の MP4 が別の cache_key で既にあれば `<shot_id>-2`、`-3`… とし、既存の生成物（課金済みの成果）を上書きしない。
- キャッシュ：`cache_key`＝SHA-256(正規化 JSON {backend: "mock"|"ark", model_id, mode, prompt, params, inputs[{role, sha256|url}]})。backend を含めるので mock の結果が実 API のキャッシュとして返ることはない。同じキーの succeeded レコードがあり、出力 MP4 が実在して SHA-256 が一致すれば API を呼ばずに返す（返すレコードは元のレコードの複製で `cached: true`。新しいレコードは追加しない）。
- サイドカー：`{ schema: "smm.seedance-output/1", shot_id, local_id, task_id, dry_run, model, mode, prompt, inputs, params, estimate_usd, usage_tokens, actual_usd, video: {path, bytes, sha256, duration_seconds, width, height}, thumbnail, generated_at }`。

## 9. doctor

`seedance` チェックを常に追加する（既存チェックの順序と内容は変えない。`disk` の直前）。`available`＝`ARK_API_KEY` がある。details＝`{ api_key_present, dry_run, models: 5, budget_usd, video_generation }`（video_generation はジョブ指定時のみ真偽、それ以外は null）。message は日本語で、キー未設定なら「DRY_RUN のモックでのみ動作する」旨を述べる。

## 10. テスト（モックのみ）

- 有料呼び出しゼロの保証：テスト中は `globalThis.fetch` を「呼ばれたら失敗する」番兵に差し替え、DRY_RUN の作成〜保存の全経路で呼び出し 0 件を確かめる。実 API 側のロジックは注入した偽 `fetch` だけで試す。
- キー混入：番兵のキー文字列を環境に置いて実 API 側ロジックを偽 `fetch` で動かし、tasks.json・サイドカー・envelope・エラーに番兵が現れないことを確かめる。追跡ファイルに `ARK_API_KEY` へ実値を代入する記述が無いことを走査する。
- 既存の固定値（MCP ツール数 20、操作数 23、`tests/fixtures/mcp-tools.json`、`schemas/`）は追加分に合わせて更新し、更新は生成ツール（`tools/write-mcp-snapshot.ts`・`tools/write-schemas.ts`）で行う。

## 11. Fable ゲートの反映（2026-11-20、判定「進行可」、致命なし）

以下は §1〜§10 より優先する（矛盾する箇所はここが正）。

1. **プレビューの読み方**（重要1）：**（2026-11-20 13:22 JST のオーナー委任による Q4 決定で更新）`report_get` の許可に `seedance/out/` 直下の `.png`・`.json` を加えるだけとし、新規ツール・操作の変更はしない。MP4 は MCP では返さない。以下の当初案のうち「許可パスは変えない」は、この決定で置き換える。** 当初案：既存の `report_get` の許可パスは変えない（既存操作を変えない）。制作エージェントはジョブフォルダ内の `seedance/out/` をファイルとして直接読む前提とし、`docs/SEEDANCE.md` に明記する。create／status の結果のレコードにサイドカーの要点（output・thumbnail・sidecar のパス、video の寸法・長さ）を含める。MCP だけの利用者向けに `report_get` を `seedance/out/*.png|*.json` へ広げるかはオーナー確認事項（QUESTIONS Q4）。
2. **ネットワークに出ない保証**（重要2）：
   - DRY_RUN の評価は呼び出しごとに環境変数から行う（モジュール読込時に固定しない）。transport の選択は service の1関数 `selectTransport` に集約し、DRY_RUN のときは `client.ts` を動的 import しない。
   - `src/host/seedance/` の中で `fetch` を参照してよいのは `client.ts` だけ。これを静的に検査するテストを足す。
   - CLI・MCP の E2E は子プロセスへ**サニタイズした env**（`ARK_API_KEY`・`SEEDANCE_DRY_RUN` を削除）を明示して渡す。加えて子プロセスに `--import` で `fetch` 番兵（呼ばれたら例外＋標準エラーへ記録）を読み込ませ、呼び出し0件を確かめる。
3. **予算判定の原子性**（重要3）：`読取 → 予算集計 → creating レコードの追記` を同じロック区間で行う。ロックは独立の `<job>/seedance/.lock`（排他作成、中身は `{pid}`）。所有プロセスが存在しない（`processes.ts` の `processExists` で判定）ロックは破棄して取り直す。時間基準の破棄はしない。
4. **unknown の予約計上と回収**（重要4・6）：
   - `reserved_usd` は mock でない `creating`・`queued`・`running`・`unknown` の見積りの合計。
   - task_id の無い `creating` レコードは、所有プロセスが存在しない、または 10 分を超えたら `unknown` に落とす（送信済みかどうか分からないので `error` にはしない＝予算から外さない）。この再整合は status・list・create の冒頭で行う。
   - 実 API モードの `seedance status` は、task_id の無い `unknown` レコードについて一覧 API（GET）を引き、同じモデル ID で、作成時刻がレコードの `created_at` の −60 秒〜＋600 秒にあり、他のレコードに紐づいていないタスクがちょうど1件なら、それを採用する。0 件または複数件なら `unknown` のまま、BytePlus コンソールで確かめるよう hint を返す。DRY_RUN では一覧を引かない（mock の unknown は発生しない）。
5. **POST のリトライ範囲**（重要5）：作成は 429・503 の応答と、送信前の接続エラー（`ECONNREFUSED`・`ENOTFOUND`・`EAI_AGAIN`）だけリトライする。500・502・504 と送信後のタイムアウト・切断はリトライせず `unknown` で記録する（作成済みの可能性があるため）。GET・DELETE・ダウンロードは発注どおり 429・5xx・network をリトライ。
6. **force**（軽微）：create に `force?: boolean`（既定 false）を足す。true ならキャッシュを見ずに新しいレコードを作る（同じ cache_key のレコードは残す）。QUESTIONS Q3 に記録。
7. **キー・URL の扱い**（軽微）：
   - client は `fetch` の例外を自前の SmmError に包み直して投げ、元の例外（`cause` を含む）を details に載せない。ヘッダーは関数内のローカル変数で組み立てる。
   - 応答の `content.video_url`（署名付き URL）はレコード・サイドカー・結果に保存しない。
   - 入力 URL は、レコード・サイドカーにはクエリとフラグメントを落として保存し、`url_sha256`（完全な URL の SHA-256）を併記する。キャッシュキーには `url_sha256` を使う。リクエスト本文には完全な URL を送る。
   - ダウンロードは `https:` だけ。`redirect: "manual"` で最大3回まで自前で追い、遷移先が `https:` でない、またはホストが localhost・`127.*`・`[::1]`・私設アドレスのときは拒否する。
8. **予算の範囲**（軽微）：予算はジョブ単位であり、ジョブをまたいだ合計の上限は v1 の対象外。`docs/SEEDANCE.md` と list の summary（`budget_scope: "job"`）で明示する。
9. **MCP の公開**（軽微）：`seedance_create` は DRY_RUN でも `--enable-generation` が無いと公開しない（モードで公開可否を変えない）。`docs/MCP.md` に明記する。
10. **接続先の許可**（軽微）：Seedance の接続先は公式の固定ホストであり、`allow-engine-host`（音声エンジン用）の対象外。MCP で実 API を呼べるのは `--enable-generation` を付けた場合だけで、さらに §6 の三重条件が要る。`docs/CONTRACT.md` に明記する。
11. **モック MP4 の寸法**（軽微）：モックは固定バイトなので、要求の解像度・長さとは一致しない。テストは寸法の一致を主張しない。サイドカーの `video` は実ファイルを `mp4.ts` で測った値を書く。ffmpeg が使える環境では E2E で実デコードも試す（使えなければその検査だけ省略し、その旨をテスト名で示す）。
12. **原子的書き込み**：tasks.json・サイドカーは既存の `io.ts` の `atomicJson` を使う。キー代入の走査はファイルシステムの走査で行う（git を起動しない、規則5）。
