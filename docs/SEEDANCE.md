# Seedance

Shin-MotionMaker は、BytePlus ModelArk の Seedance API を動画生成のバックエンドとして呼び出せる。CLI は `smm seedance create|status|list`、MCP は `seedance_create`・`seedance_status`・`seedance_list` である。どちらも host の共通の操作定義表から作るので、入力と結果は一致する。契約上の定義は [CONTRACT](CONTRACT.md) の §12、設計の経緯は [SEEDANCE の設計メモ](work/SEEDANCE/DESIGN.md) と [QUESTIONS](work/SEEDANCE/QUESTIONS.md) にある。

## 位置づけ

- Seedance は**独立した、交換可能な動画生成バックエンド**である。既存の画像生成（imagegen）・Three.js・Blender・Remotion を置き換えず、弱めもしない。
- 使うかどうかは、制作エージェントがショットごとに決める。表現したいものに合う手法を選び、動画生成 AI が要るショットでだけ選ぶ部品である。Seedance を使うこと自体は目的ではない。
- 既定のモデル・推奨候補・見積りは**助言**であり、正解ではない。入口は特定のモデルや手法を押し付けない。プロンプトは自由記述で、場面や演出の固定の命令体系は無い。
- 生成した動画の質（面白さ、演出の巧拙、ねらいとの一致）は合否にしない。判断は制作エージェントに委ねる。ツールが合否として扱うのは、客観的に判定できる安全・費用・ファイルの健全性だけである。

## 実生成はオーナー承認制

- **既定は DRY_RUN（モック）である。** `SEEDANCE_DRY_RUN` が未設定なら DRY_RUN になり、ネットワークに一切出ない。モックは作成→完了→保存までを通し、ジョブ内に小さな実在の MP4 を書き出す。task_id は `mock-` で始まる。
- 有料の実生成（`SEEDANCE_DRY_RUN=false`）は、**オーナーの承認を得てからだけ**行う。承認前に `SEEDANCE_DRY_RUN=false` を設定しない。
- 実生成に進む手続きは、末尾の「実生成に進むためのオーナーの手続き」にまとめてある。

## セットアップ

### 1. API キーを発行する

BytePlus のコンソール（ModelArk）で API キーを発行する。認証は API キーだけで、`Authorization: Bearer` ヘッダーで送る。

### 2. モデルの有効化条件を満たす

Seedance 2.5・2.0 系のモデルを使うには、BytePlus アカウントが次のいずれかを満たす必要がある。

- アカウント残高が USD 30 を超えている
- AI Savings Plan が USD 30 以上ある
- Seedance のリソースパックの残量がある

これはアカウント側の条件であり、**Shin-MotionMaker からは確認できない**。コンソールで確かめる。満たしていないと、実 API はモデル未有効化・残高不足の応答を返し、ツールは `E_DISABLED`（`details.kind: "activation"`）で返す。

### 3. PC に API キーを設定する

Windows では、PowerShell またはコマンドプロンプトで次を実行する。`<あなたの API キー>` は自分のキーに置き換える。

```powershell
setx ARK_API_KEY "<あなたの API キー>"
```

- `setx` で設定した値は、**新しく開いた端末から**有効になる。実行した端末と、すでに開いている端末・エディター・MCP クライアントには反映されないので、開き直す。
- キーをチャット・Git・ファイル（`.env`、メモ、スクリーンショットを含む）に書かない。Shin-MotionMaker もキーの値を台帳・サイドカー・封筒・ログ・エラーに書かない。
- MCP から使う場合、サーバーの環境はクライアントの登録で決まる。下の「MCP」節を参照する。

### 4. doctor で確かめる

```powershell
smm doctor
```

`seedance` のチェックが加わっている。`available` は `ARK_API_KEY` があるかどうかで、`details` は `{ api_key_present, dry_run, models, budget_usd, video_generation }` である（`video_generation` はジョブを指定したときだけ真偽、それ以外は null）。**キーの値は表示しない。** キーが無いときは、DRY_RUN のモックでだけ動く旨を表示する。doctor は実 API へ接続しないので、アカウントの有効化状況は確かめられない。

### 実写の顔を含む参照素材

実在の人物の顔を含む画像・動画を参照素材にすると、API 側の制限で拒否されることがある。BytePlus のポータルで素材を資産として登録する手続きは、v1 の対象外である（`asset://` の URL を入力に渡すことはできる）。

## 環境変数

| 変数 | 既定 | 意味 |
| --- | --- | --- |
| `ARK_API_KEY` | なし | API キー。環境変数からだけ読む。値はどこにも書かず、返さない |
| `SEEDANCE_DRY_RUN` | 未設定＝true | 値が `false` または `0`（大小文字と前後の空白は無視）のときだけ実 API を使う。それ以外はすべて DRY_RUN。呼び出しごとに読む |
| `SEEDANCE_BUDGET_USD` | 10 | ジョブ単位の費用の上限（USD）。0 以上の有限数でなければ作成を `E_INPUT_INVALID` で拒否する |
| `SEEDANCE_POLL_INTERVAL_MS` | 5000 | 実 API のポーリング間隔。1000 未満は 1000 に丸める |

接続先は公式の `https://ark.ap-southeast.bytepluses.com/api/v3` に固定で、環境変数では変えられない。

## CLI

| 構文 | 内容 |
| --- | --- |
| `seedance create <job> --shot-id <id> --prompt <text> [オプション]` | 生成タスクを作り、`--wait-ms` まで完了を待つ。完了すれば MP4・サイドカー・PNG を保存する |
| `seedance status <job> (--task-id <id> \| --shot-id <id>) [--wait-ms N]` | 状態を取得する。成功済みで未保存なら保存まで行う（再開の経路） |
| `seedance list <job>` | ジョブ内の全タスクと費用の集計 |

`seedance create` のオプション（入力名の snake_case を kebab-case にしたもの）：

| オプション | 既定 | 内容 |
| --- | --- | --- |
| `--shot-id` | 必須 | `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`。出力名にも使う |
| `--prompt` | 必須 | 自由記述のプロンプト（1文字以上） |
| `--model` | `seedance-2-0-mini` | 別名またはモデル ID（下の表） |
| `--mode` | `text` | `text`・`image`・`reference` |
| `--first-frame` / `--last-frame` | — | image のみ。first-frame は image で必須 |
| `--reference-images` / `--reference-videos` / `--reference-audios` | — | reference のみ。繰り返し指定できる。少なくとも1つ。モデルの参照上限を超えると拒否 |
| `--resolution` | `720p` | `480p`・`720p`・`1080p`・`4k`。モデルが対応しない解像度は拒否 |
| `--ratio` | `16:9` | `16:9`・`4:3`・`1:1`・`3:4`・`9:16`・`21:9`・`adaptive` |
| `--duration` | 5 | 整数 1〜15 秒。モデルごとの細かな範囲は API が検証する |
| `--seed` | — | 整数 -1〜4294967295。省略時は送らない |
| `--generate-audio` | false | 音声付きで生成する |
| `--watermark` | false | 透かしを付ける |
| `--wait-ms` | 45000 | 作成後に待つ上限（0〜50000）。0 なら作成だけして返し、`seedance status` で続ける |
| `--force` | false | キャッシュを見ずに新しく作る（別テイク）。同じキャッシュキーの既存レコードは残る |

- mode と素材の組み合わせは固定である。text で素材を指定する、image で reference 系を指定する、reference で first/last を指定する、のいずれも `E_INPUT_INVALID`。
- 素材の値は、ジョブ内の相対パス（`/` 区切り）か、`https://`・`asset://` の URL。画像のローカルファイル（png・jpg・jpeg・webp、30 MiB 以下）は Base64 の data URI にして送る。動画・音声のローカルファイルは v1 では受け付けないので、URL か `asset://` を使う。
- run の仕組みは使わない。操作の中で上限時間つきのポーリングをして、途中の状態でもレコードを残して正常に返る。

### テストショットの例

固定のテストショット `test-horseshoe`（text・5 秒・16:9・720p・`seedance-2-0-mini`）を DRY_RUN で作る例。`<job>` は生成済みのジョブフォルダである。

```powershell
smm seedance create "<job>" --shot-id test-horseshoe --mode text --duration 5 --ratio 16:9 --resolution 720p --model seedance-2-0-mini --prompt "Psychedelic surreal short film: a giant glowing horseshoe magnet floating in a kaleidoscopic void, iron filings and sparks spiraling toward both poles, two opposing crowds of abstract silhouettes pressing against an invisible glass ceiling that cracks with rainbow light, liquid chrome colors melting and reforming, symmetrical morphing, 1960s psychedelic poster aesthetic, intensely saturated colors, no text, no watermark"
smm seedance status "<job>" --shot-id test-horseshoe
smm seedance list "<job>"
```

DRY_RUN では `<job>/seedance/out/test-horseshoe.mp4`・`.json`・`.png`（ffmpeg が無ければ PNG は作らず null）ができる。モックの MP4 は固定のバイトなので、寸法と長さは要求の値と一致しない。

## MCP

| ツール | 主な入力 | 公開の条件 |
| --- | --- | --- |
| `seedance_create` | job, shot_id, prompt, model?, mode?, first_frame?, last_frame?, reference_images?, reference_videos?, reference_audios?, resolution?, ratio?, duration?, seed?, generate_audio?, watermark?, wait_ms?, force? | `--enable-generation` が必要。read-only では公開しない |
| `seedance_status` | job, task_id? / shot_id?, wait_ms? | read-only では公開しない（保存の書き込みがあるため） |
| `seedance_list` | job | read-only でも公開する |

- `seedance_create` は、DRY_RUN でも `--enable-generation` が無ければ公開しない。モードで公開の可否を変えない。
- MCP で実 API を呼べるのは `--enable-generation` を付けた場合だけで、さらに下の三重条件が要る。
- MCP サーバーの環境変数はクライアントの登録で決まる。公式 SDK の stdio クライアントは既定で限られた変数しか引き継がないので、`ARK_API_KEY` などは登録の `env` で渡す必要がある（[MCP](MCP.md#ジョブ内スクリプトへの環境変数)）。登録ファイルにキーの値を書かずに済むよう、クライアントが環境変数の参照に対応していればそれを使う。

## 費用の読み方

### トークン式

費用はトークンで決まる。

```text
トークン = (入力動画の秒数 + 出力の秒数) × 幅 × 高さ × 24 / 1024
USD = トークン × 単価 / 1,000,000
```

- 寸法（16:9）：720p＝1280×720、1080p＝1920×1080、4k＝3840×2160。480p は 2.5 系が 854×480、2.0 系が 864×496。16:9 以外の比率は、同じ解像度の 16:9 と同じ画素数として見積もる（`estimate_basis: "area-16:9"`）。
- 参照動画（`reference_videos`）が1つ以上あるときは「動画入力あり」の単価を使い、入力動画は1本あたり 15 秒と保守的に仮定する。動画入力のときは公式の**最低トークン消費**が適用されるが、その詳細表は外部にあるため v1 は式で見積もる。実際の請求は見積りと違うことがある。

### モデル

単価は USD／100 万トークン（動画入力なし／あり）。

| 別名 | モデル ID | 解像度 | 480p・720p | 1080p | 4k | 参照上限 画像/動画/音声 |
| --- | --- | --- | --- | --- | --- | --- |
| seedance-2-5 | dreamina-seedance-2-5-260628 | 480p/720p/1080p/4k | 10.7／6.4 | 11.7／7.0 | 未登録（作成を拒否） | 30/10/10 |
| seedance-2-5-flash | dreamina-seedance-2-5-flash-261115 | 480p/720p | 7.0／4.3 | — | — | 10/5/5 |
| seedance-2-0 | dreamina-seedance-2-0-260128 | 480p/720p/1080p/4k | 7.0／4.3 | 7.7／4.7 | 4.0／2.4 | 9/3/3 |
| seedance-2-0-fast | dreamina-seedance-2-0-fast-260128 | 480p/720p | 5.6／3.3 | — | — | 9/3/3 |
| seedance-2-0-mini | dreamina-seedance-2-0-mini-260615 | 480p/720p | 3.5／2.1 | — | — | 9/3/3 |

seedance-2-5 の 4k は単価が分からず見積もれないので、DRY_RUN を含めて `E_INPUT_INVALID` で拒否する。

### テストショットの見積り

テストショット `test-horseshoe`（text・5 秒・16:9・720p）は 5 × 1280 × 720 × 24 / 1024 ＝ **108,000 トークン**である。

| モデル | 見積り（USD） |
| --- | --- |
| seedance-2-5 | 1.1556 |
| seedance-2-5-flash | 0.756 |
| seedance-2-0 | 0.756 |
| seedance-2-0-fast | 0.6048 |
| seedance-2-0-mini | 0.378 |

初回の実生成の候補は、最も安い `seedance-2-0-mini` である。これは費用の面からの助言であり、表現に合うモデルは制作エージェントが選ぶ。

### 予算と実績

- `SEEDANCE_BUDGET_USD`（既定 10）は**ジョブ単位**の上限である。ジョブをまたいだ合計の上限は無い（`seedance list` の summary の `budget_scope: "job"`）。
- 作成の前に必ず見積もり、レコードに `estimate_usd`・`estimate_tokens`・`estimate_basis` を残す。
- 課金されるのは**成功した生成だけ**である。実績は応答の `usage.completion_tokens` で確定し、`usage_tokens`・`actual_usd` に記録する。
- 予算の判定：実 API の記録の費用（`actual_usd`、未確定なら `estimate_usd`）＋予約中（実 API の `creating`・`queued`・`running`・`unknown` の見積り）＋今回の見積りが上限を超えると拒否する。モックの記録は費用 0 として数える。DRY_RUN でも同じ計算をする。
- `seedance list` の summary で `real_spent_usd`・`reserved_usd`・`remaining_usd`・`mock_count` を確かめられる。

## 安全の三重条件

実 API（`SEEDANCE_DRY_RUN=false`）での作成には、次の3つがすべて要る。欠けると `E_DISABLED` で拒否し、台帳に何も書かない。

| 条件 | 欠けたときの `details.reason` |
| --- | --- |
| `ARK_API_KEY` がある | `api_key_missing` |
| ジョブの `project.json` の `asset_generation.video_generation` が `true`（フォームの「動画生成 AI を許可」、`videoGeneration`） | `video_generation_off` |
| 見積りが残りの予算に収まる | `budget_exceeded` |

- DRY_RUN では、`video_generation` が off でも作成を許し、`advisories` に `seedance-opt-in-required-for-real` を付ける。予算の判定は DRY_RUN でも行う。
- `video_generation` は生成時のフォームで決まる。あとから変えるときは `project patch` を使う（設定の正本は `project.json` だけ）。

### 実 API のエラー

エラーコードの列挙は増やさず、`details.kind` で分類する。

| `details.kind` | 条件 | コード |
| --- | --- | --- |
| auth | 401、または認証系の 403 | E_DISABLED |
| activation | モデル未有効化・残高不足・アカウント系の応答 | E_DISABLED |
| rate_limit | 429 | E_BUSY |
| invalid | その他の 4xx | E_INPUT_INVALID |
| server | 5xx | E_ENGINE_UNREACHABLE |
| network | 応答なし（接続失敗・タイムアウト） | E_ENGINE_UNREACHABLE |
| invalid_output | 保存した MP4 の構造検査に失敗（レコードの status は `error`） | — |

- 取得・一覧・ダウンロードは、429・5xx・network を最大2回（計3回）、1 秒・2 秒の間隔でやり直す。
- **作成だけは、二重課金を避けるためにやり直しを狭める。** やり直すのは 429・503 と、送信前に失敗したと分かる接続エラーだけである。500・502・504 と、送信後のタイムアウト・切断はやり直さず、`unknown` で記録する。

## 永続化とプレビュー連携

### ファイルの規約

すべてジョブフォルダ内にあり、記録の中のパスはジョブ相対の `/` 区切りである。

| パス | 内容 |
| --- | --- |
| `<job>/seedance/tasks.json` | タスク台帳 `{ "schema": "smm.seedance-tasks/1", "tasks": [...] }` |
| `<job>/seedance/out/<出力名>.mp4` | 生成した動画。Remotion・FFmpeg で扱えるローカル MP4 |
| `<job>/seedance/out/<出力名>.json` | サイドカー（生成メタデータ） |
| `<job>/seedance/out/<出力名>.png` | サムネイル（ffmpeg で先頭フレームを抜く。失敗したら作らず、記録は null） |

- 出力名は `shot_id` である。同じ名前の MP4 が別のキャッシュキーで既にあれば `<shot_id>-2`、`-3`… とし、課金済みの生成物を上書きしない。
- サイドカーの項目：`schema`（`smm.seedance-output/1`）、`shot_id`、`local_id`、`task_id`、`dry_run`、`model`、`mode`、`prompt`、`inputs`、`params`、`estimate_usd`、`usage_tokens`、`actual_usd`、`video`（`path`・`bytes`・`sha256`・`duration_seconds`・`width`・`height`、実ファイルを測った値）、`thumbnail`、`generated_at`。
- 応答の署名付きダウンロード URL は保存しない。入力の URL は、クエリとフラグメントを落として保存し、完全な URL の SHA-256（`url_sha256`）を併記する。

### プレビューの読み方

- 制作エージェントは、ジョブフォルダ内の `seedance/out/` の MP4・PNG・JSON を**ファイルとして直接読む**。
- MCP の `report_get` では `seedance/out/` を読めない（`E_PATH_DENIED`）。`report_get` の許可範囲を広げるかはオーナーの確認事項である（[QUESTIONS](work/SEEDANCE/QUESTIONS.md) の Q4）。
- `seedance create`・`seedance status` の結果のレコードには、`output`・`thumbnail`・`sidecar` のパスと、動画の寸法・長さが入る。
- 見た目がねらいに合うか、使うか、作り直すかは制作エージェントが判断する。ツールはこれを合否にしない。

### キャッシュ

- キャッシュキーは、バックエンド（mock か実 API か）・モデル ID・mode・プロンプト・パラメータ・入力（ローカルは SHA-256、URL は `url_sha256`）の正規化 JSON の SHA-256 である。モックの結果が実 API のキャッシュとして返ることは無い。
- 同じキーの succeeded レコードがあり、MP4 が実在して SHA-256 が一致すれば、API を呼ばずに `cached: true` で返す。新しいレコードは足さない。
- 同じ条件で別テイクを作るときは `--force`（MCP は `force: true`）を使う。

### 再開と unknown

- 作成は「`creating` で記録 → 送信 → task_id と `queued` を記録 → 待機 → 成功なら保存」の順に進む。途中でプロセスが落ちても、`seedance status` で tasks.json から追跡して保存できる。`--wait-ms 0` で作成だけして、あとで `status` を呼んでもよい。
- `unknown` は「送信したかどうか、またはサーバーが受け付けたかどうかが分からない」状態である。課金されている可能性があるので、予算には予約として数え続ける。
  - 送信後の切断や 500・502・504 のときと、task_id の無い `creating` が所有プロセスの消滅または 10 分経過で残ったときに `unknown` になる。
  - 実 API モードの `seedance status` は、task_id の無い `unknown` について一覧 API を引き、同じモデル・作成時刻が近い・他に紐づいていないタスクがちょうど1件なら、それを採用する。見つからないか複数あるときは `unknown` のままで、BytePlus のコンソールのタスク一覧で確かめるよう hint を返す。

## 実装の方式

- REST API を Node 標準の `fetch` で呼ぶ。Python SDK（arkruntime）は使わない。repo は TypeScript／Node の単一ランタイムであり、SDK を使うと Python のサイドカーが必要になって、再開・台帳・テストの面が二重になるためである。新しい npm 依存も無い。
- DRY_RUN のときは実 API のクライアントを読み込まず、`fetch` を呼ばない。テストは `fetch` を「呼ばれたら失敗する」番兵に差し替えて、呼び出しが 0 件であることを確かめている。

## 実生成に進むためのオーナーの手続き

1. **承認する。** 有料の実生成を始めることを、オーナーが明示して承認する。
2. **キーを設定する。** BytePlus コンソールで API キーを発行し、`setx ARK_API_KEY "<あなたの API キー>"` で設定して、新しい端末を開く。`smm doctor` の `seedance` で `api_key_present: true` を確かめる。
3. **アカウントを有効化する。** 残高 USD 30 超・AI Savings Plan USD 30 以上・Seedance リソースパックのいずれかを満たし、使うモデルがコンソールで有効になっていることを確かめる。
4. **予算を決める。** 必要なら `SEEDANCE_BUDGET_USD` をジョブ単位の上限として設定する（既定 10）。
5. **ジョブで動画生成を許可する。** 対象ジョブの `project.json` の `asset_generation.video_generation` を `true` にする。
6. **承認後にだけ** `SEEDANCE_DRY_RUN=false` を設定し、まず見積りの小さいショット（例：テストショットを `seedance-2-0-mini` で、見積り USD 0.378）で試す。実績は `seedance list` とサイドカーの `usage_tokens`・`actual_usd` で確かめる。
