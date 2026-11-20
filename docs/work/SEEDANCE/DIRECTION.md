# Shin-MotionMaker Seedance バックエンド追加 — 統括発注書（作業ID: SEEDANCE）

> L2 注：オーナー発注書（`_handoff` 配下、追跡対象外）の写し。追跡ファイルに絶対パスを書かない規則（AGENTS.md 規則6）に従い、作業フォルダの絶対パスだけを「repo ルート」に置き換えた。それ以外は原文のまま。

あなたは統括（L2、Opus 5.5 effort 高）です。シンJTC理論に従い、BytePlus ModelArk の Seedance API を Shin-MotionMaker の**独立した交換可能な動画生成バックエンド**として追加します。あなた自身は実装せず、計画・配分・進行・台帳・統合検証を担います。ただし本作業は単独セッションで完結させるため、L3 の起動が同セッション内で可能な範囲ではサブエージェント（Agent ツール）を使い分けてください。作業フォルダはプロジェクトルート （repo ルート） 自身です（必ずここを基点にし、対象フォルダへアクセスできていることを最初の台帳行で実測記録すること）。

## 0. オーナー指示（L1、正本）

- 目的：Seedance を独立バックエンドとして追加し、Fable / Opus / Codex のシンJTC制作フローから利用可能にする。既存の ImageGen、Three.js、Blender MCP、Remotion の機能は**置き換えない・弱めない**。
- 最終目標：Fable がショットごとに最適な制作手法を決め、必要な場合のみ Seedance を選べる状態。Seedance 導入自体は目的ではない。「AI」創作論 MV の表現力拡張のための部品。
- **有料 API は絶対に呼ばない**（オーナー承認はまだ無い）。初期状態 `DRY_RUN=true`。モックで E2E を確認するところまでが今回の範囲。
- API キーや認証情報を Git・ログ・成果物・台帳に含めない。チャット等でキー提示を求めない。

## 1. 実測済みの前提（2026-11-20、統括が再検証して台帳に記録すること）

- repo：main `b2d14a0`（v0.1.1）、Node v24.15.0、Python 3.12.10。層構造 core（純粋）／host（I/O）／cli／mcp。操作は `src/host/operations.ts`＋`tools.ts` の操作定義表が正本、CLI `smm` と MCP（20ツール）はその薄いラッパー。契約変更は本来 L2 承認事項だが、本件はオーナー自身の明示指示であり、その旨を `docs/work/SEEDANCE/QUESTIONS.md` に記録して進める。
- `MotionForm.videoGeneration: boolean` が既に存在する（「Allow video-generation AI (Seedance etc.). Off unless the user opts in.」）。**フォーム型・既定値は変えない**。Seedance 実行の前提条件としてこの opt-in を使う。
- **ARK_API_KEY は未設定**（Process／User／Machine すべて空、`.env` なし、2026-11-20 実測）。`arkruntime`／`volcenginesdkarkruntime` は未インストール。→ 実 API 接続は現時点では不可能であり、それを前提に設計する（doctor で検出可能にし、手順書を書く）。

## 2. 公式 API 仕様（BytePlus ModelArk 公式ドキュメント 2026-11-19 更新で確認済み）

- Base URL：`https://ark.ap-southeast.bytepluses.com/api/v3`
- 認証：`Authorization: Bearer <ARK_API_KEY>`（API Key 認証のみ）
- タスク作成：`POST /contents/generations/tasks`、取得：`GET /contents/generations/tasks/{id}`、一覧：`GET /contents/generations/tasks`、取消：`DELETE /contents/generations/tasks/{id}`
- リクエスト（直接パラメータ方式が推奨）：`model`、`content[]`、`resolution`、`ratio`、`duration`、`generate_audio`、`watermark`、`seed`、`camera_fixed`、`return_last_frame`、`callback_url`（v1 では callback は使わない）
- `content[]` の型：`text`／`image_url`（role：`first_frame`／`last_frame`／`reference_image`、URL・Base64 `data:image/...`・`asset://` 可）／`video_url`（role：`reference_video`）／`audio_url`（role：`reference_audio`）／`draft_task`。first/last frame 方式と omni reference 方式は混在不可。
- レスポンス：作成は task `id` を返す。取得は `status`（queued/running/succeeded/failed 等）、成功時 `content.video_url`、課金実績 `usage.completion_tokens`。**成功した生成のみ課金**。
- モデル有効化条件（2.5／2.0 系）：BytePlus アカウント残高 > USD 30、または AI Savings Plan USD 30 以上、または Seedance リソースパックの残量があること。

### モデル登録表（全5モデル必須）

| 別名 | モデルID | 解像度 | 単価 USD/1M tokens（動画入力なし／あり、480p・720p） | 5秒 16:9 例（入力なし）480p／720p／1080p |
| --- | --- | --- | --- | --- |
| seedance-2-5 | `dreamina-seedance-2-5-260628` | 480p/720p/1080p/4K | 10.70／6.40（1080p は 11.7／7.0） | $0.514／$1.156／$2.843 |
| seedance-2-5-flash | `dreamina-seedance-2-5-flash-261115` | 480p/720p のみ | 7.0／4.3 | $0.34／$0.76／― |
| seedance-2-0 | `dreamina-seedance-2-0-260128` | 480p/720p/1080p/4K | 7.0／4.3（1080p 7.7／4.7、4K 4.0／2.4） | $0.35／$0.76／$1.87（4K $3.89） |
| seedance-2-0-fast | `dreamina-seedance-2-0-fast-260128` | 480p/720p のみ | 5.6／3.3 | $0.28／$0.60／― |
| seedance-2-0-mini | `dreamina-seedance-2-0-mini-260615` | 480p/720p のみ | 3.5／2.1 | $0.18／$0.38／― |

- 推定トークン式：`(入力動画秒数＋出力秒数) × 出力幅 × 出力高さ × fps / 1024`。実績は `usage.completion_tokens` で確定させる。動画入力時は最低トークン消費が適用される旨を台帳コメントに残す（詳細表は外部 Lark のため v1 では式ベース推定＋実績優先でよい）。
- 参照上限：2.5 は画像30／動画10／音声10、2.5 Flash は 10／5／5、2.0 系は 9／3／3。実写の顔を含む参照素材は制限がある（ポータル資産の扱いは v1 対象外、手順書に注意書きのみ）。

## 3. 実装設計（統括が確定し、逸脱は QUESTIONS.md 経由）

### 3.1 方式の決定
- **REST API を TypeScript の `fetch`（Node 標準）で実装する**。理由：repo は TS/Node 単一ランタイムであり、新規ランタイム依存を足さない（AGENTS.md 規則13）。Python SDK（arkruntime）は未インストールで、サイドカー化すると再開・台帳・テストの面が二重化する。オーナー指示は「Python SDK **または** REST API」であり REST で充足する。SDK は使わない判断と理由を `docs/work/SEEDANCE/` の設計メモに明記する。
- 新規 npm 依存は原則ゼロ。必要になった場合は版固定＋LICENSE 確認＋NOTICE 追記（規則13）。

### 3.2 配置（既存の層・契約に沿う、追加のみ）
- `src/host/seedance/models.ts`：モデル登録表（ID・対応解像度・単価・参照上限）と見積り関数（トークン式→USD）。
- `src/host/seedance/client.ts`：REST クライアント。作成／取得／一覧／取消、ポーリング（間隔と上限を設定可能に）、MP4 ダウンロード保存、エラー分類（認証／有効化不足／レート制限／入力不正／サーバ）。**リトライは最大2回・指数バックオフ、対象は 429・5xx・ネットワークエラーのみ**。4xx（429除く）は即失敗。
- `src/host/seedance/store.ts`：ジョブ内永続化とキャッシュ（3.4）。
- `src/host/operations.ts`／`tools.ts`／入出力スキーマ：新規操作を**追加**する（既存操作の変更・削除は禁止）。
  - `seedance_create`（CLI `seedance create`、MCP `seedance_create`）：入力＝job、shot_id、model（別名またはID）、prompt、mode（text／image／reference）、first_frame／last_frame／reference_images[]／reference_videos[]／reference_audios[]（ジョブ内相対パスまたは URL）、resolution、ratio、duration、seed、generate_audio、watermark。出力＝task レコード（下記）。
  - `seedance_status`（CLI `seedance status`、MCP 同名）：job＋task_id（または shot_id）で状態取得。成功済みで未保存なら保存まで行う（再開経路）。
  - `seedance_list`（CLI `seedance list`、MCP 同名）：ジョブ内の全タスク・費用台帳サマリ。
- `doctor` に `seedance` チェックを追加：API キー有無（値は出さない）、DRY_RUN 状態、有効モデル数。既存チェックの挙動は変えない。
- GUI は変更しない。job-template は**一切変更しない**（R1〜R6 の範囲外）。

### 3.3 安全と費用（合否ゲート級。すべて客観判定可能）
- `SEEDANCE_DRY_RUN`：**未設定時は true**。DRY_RUN ではネットワークへ一切出ず、モック応答で作成→完了→保存までを通す（モック MP4 は実在する小さい MP4 を ffmpeg で生成するか、テスト用 fixture をコピーする。Remotion/FFmpeg で開ける実ファイルであること）。
- 実 API 実行（DRY_RUN=false）の三重条件：①`ARK_API_KEY` がある、②対象ジョブの `project.json` で `videoGeneration` が opt-in 済み、③見積額が残予算内。1つでも欠ければ E_DISABLED 系で拒否し、理由を日本語 message/hint で返す。
- 予算：`SEEDANCE_BUDGET_USD`（プロジェクト単位の上限、未設定時の既定は 10）。台帳の実績合計＋今回見積額が上限を超える場合は作成を拒否。見積りは作成前に必ず計算し、レコードに残す。
- キーは環境変数からのみ読む。コード・テスト fixture・ログ・レコードにキーの値や断片を含めない（テストで検査する）。

### 3.4 永続化・キャッシュ・再開・プレビュー連携（ジョブ内、すべて job 相対パス）
- `<job>/seedance/tasks.json`：タスク台帳。各レコード＝{local_id, shot_id, task_id（モック時は mock- 接頭辞）, model, mode, prompt, inputs[{path/url, role, sha256（ローカル時）}], params, cache_key, status, estimate_usd, usage_tokens, actual_usd, output（MP4 相対パス）, sidecar（JSON 相対パス）, error, created_at, updated_at}。
- 出力：`<job>/seedance/out/<shot_id>.mp4`（Remotion/FFmpeg で扱えるローカル MP4）。
- サイドカー：`<job>/seedance/out/<shot_id>.json`＝生成メタデータ一式（モデル・プロンプト・入力・パラメータ・task_id・usage・費用・生成時刻）＋サムネイル `<shot_id>.png`（ffmpeg で先頭フレーム抽出、失敗時は null で記録）。Fable の品質判定はこの MP4＋PNG＋サイドカーをプレビューとして読む前提で、パス規約を `docs/SEEDANCE.md` に明記する。
- キャッシュ：cache_key＝SHA-256（model＋prompt＋params の正規化 JSON＋入力ファイルの sha256 群）。同一キーの succeeded レコードと MP4 実在があれば API を呼ばずキャッシュヒットとして返す（レコードに `cached: true`）。
- 再開：プロセスが落ちても tasks.json から未完了タスクを `seedance status` で追跡・保存できること。ポーリングは操作内では上限時間を持ち、途中状態でもレコードを残して正常終了する（run の仕組みに寄せる必要はない）。

### 3.5 テスト（モックのみ、有料呼び出しゼロを保証）
- 単体：モデル表と見積り（公式 5 秒例と一致すること：例 2.0／720p／5秒＝$0.76 相当のトークン計算）、リクエスト構築（text／image first+last／reference の role 付け、混在の拒否）、エラー分類、予算超過の拒否、DRY_RUN 時に fetch が呼ばれないこと、キャッシュヒット、台帳の読み書きと再開。
- E2E（モック）：テストジョブで `seedance create`（下記テストショット）→ status → MP4 実在・ffprobe 相当で開けること・サイドカーと PNG の生成、CLI と MCP の両経路。
- 既存テスト全件＋`tools/ci-local.mjs` が合格すること。テストで git を起動しない（規則5）。キー文字列が repo 内ファイルに現れないことの検査も含める。

### 3.6 テストショット（モック E2E の固定入力）
- shot_id：`test-horseshoe`、mode：text、duration：5、ratio：16:9、resolution：720p、model 既定：`seedance-2-0-mini`（初回実生成の推奨候補。見積り $0.38）
- prompt（英語正文）：`Psychedelic surreal short film: a giant glowing horseshoe magnet floating in a kaleidoscopic void, iron filings and sparks spiraling toward both poles, two opposing crowds of abstract silhouettes pressing against an invisible glass ceiling that cracks with rainbow light, liquid chrome colors melting and reforming, symmetrical morphing, 1960s psychedelic poster aesthetic, intensely saturated colors, no text, no watermark`
- 対訳メモ（台帳用）：「蹄鉄理論で地頭限界」— 蹄鉄型磁石の両極へ引き寄せられる両極端と、見えない天井（地頭の限界）に張り付く群衆をサイケデリックに描く。

### 3.7 文書
- `docs/SEEDANCE.md`（新規）：セットアップ手順（BytePlus コンソールで API キー発行→モデル有効化条件（残高 $30 等）→PC への設定方法 `setx ARK_API_KEY "..."`（値は各自のもの、例示に実キーを書かない）／環境変数一覧／CLI・MCP の使い方／費用の読み方／プレビュー連携（サイドカー規約）／実生成はオーナー承認制であること）。
- `docs/CLI.md`・`docs/MCP.md`・`docs/CONTRACT.md` への追記（追加分のみ、既存記述の変更禁止）。README は変更しない（統括判断で必要なら差分案を台帳に残し、勝手に変えない）。

## 4. 進め方（シンJTC、並行最大化とチェックポイント）

1. **Fable ゲート（短時間）**：実装前に Fable 5.2 へ本書の設計要点（配置・操作3つ・安全三重条件・キャッシュ/台帳設計）だけを渡し、要件の抜けと設計リスクの判定を受ける（実装はさせない）。指摘は台帳に記録し、致命的なものは統括が設計に反映してから進む。Fable が使えない場合はその旨を台帳に記録し、Opus 高の自己レビューで代替する（開始を止めない）。
2. **実装（L3）**：工学は Codex 6.1 sol 高を優先（使えない場合は Opus 5.5 中）。モデル表／クライアント／store／操作追加／doctor／テスト／文書を論理単位で分割し、並行可能なものは並行に。**実働は前面で完走させるか10分以内に区切れる単位に分割**し、区切りごとに台帳へ成果と実測を記録する（過去の統括死亡事故の教訓）。長い処理は別セッション＋状態ポーリング。
3. **交差レビュー**：実装者と別コンテキストでレビュー（最低1回）。特に「DRY_RUN で本当にネットワークに出ないか」「キー混入がないか」「既存操作・job-template への差分がないか」を実測で確認する。
4. **統合**：全テスト＋ci-local、モック E2E（CLI・MCP 両経路）の証拠を台帳へ。
5. **Git**：作業ブランチ `seedance-backend` で論理コミット（件名は `SEEDANCE:` 始まりの英語）。**main へ直接 push しない**。ブランチを push し PR を作るところまで可（PR の CI 結果を台帳に記録）。**マージはしない**（オーナー確認待ち）。コミット author は従来どおり noreply を使うこと。

## 5. 完了条件と報告（`_handoff\SEEDANCE_SUMMARY.md`、最終行 `SEEDANCE_DONE`）

サマリには次を必ず含める（オーナーへの本番前報告の材料）：
1. API 接続準備状況（キー未設定であること、doctor の実測結果、実接続は未実施であること）
2. モデル有効化状況（アカウント側条件のため未確認であること、有効化の条件と確認手順）
3. 実装場所と呼び出し方法（追加ファイル一覧、CLI コマンド、MCP ツール名）
4. 1回の生成見積額（テストショットについて全5モデル×720p の見積表＋推奨）
5. 使用する入力素材（テストショットは text のみ、素材なし）
6. DRY_RUN 検証結果（モック E2E の実測：コマンド、生成された MP4 のパスと検証方法、テスト件数）
7. 残課題と、実生成に進むためにオーナーが必要な手続き（キー設定と承認）

## 6. 禁止事項

- 有料 API の呼び出し（DRY_RUN=false での実行を含む）。モック／DRY_RUN 以外で `ark.ap-southeast.bytepluses.com` へリクエストを送らない（テストも含む）。
- 既存バックエンド（ImageGen／Three.js／Blender／Remotion）と job-template、フォーム型・既定値の変更。
- 主観品質を合否ゲート化する実装（ハーネスの緩さを守る）。
- キー・個人メール・絶対パスの追跡ファイルへの記録（規則6）。`_handoff\` は編集しない（追跡対象外フォルダとしての従来運用＝発注・台帳置き場としての使用は可、ただし秘密情報は書かない）。
