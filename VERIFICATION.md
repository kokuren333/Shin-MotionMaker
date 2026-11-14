# VERIFICATION — 公開と検証の証拠

この文書は検証の証拠の記録である。記録はオーナーの目視を待つ関門ではない（REQUIREMENTS GU-17、原典 Amendment 01 AM-1）。公開（M8）の記録は CI-08 の4条件に従って後から足す。

M7-add では main `7741d9594e30305339b8736ee6e2c49591c89384` を `6789f2a` で取り込み、現在のテンプレート版は **0.5.2**（目録 SHA-256 `9e01031edccf35664747a3c38528381b3a52469f74c64ed3164b00de4e30d70a`）になった。下記 Tier C の実測コミット `506a5a893cbb4da0aabfbfa82ecc1d75f6c00d3f` はテンプレート **0.5.1** を使用した記録であり、JSON 内の generator とハッシュをそのまま保持する。JT-12 の入力は原典262c798生成の schema_version 0.4・generator なしで、template_version は存在しない。今回のテンプレート差分は M6 の R3 README 追記の推敲だけであり、追補発注の指定どおり実レンダーは再実行していない。取り込み後の検証は [M7 REPORT の M7-add](docs/work/M7/REPORT.md#m7-add) に記録する。

## M4 GUI のスクリーンショット（GU-17）

- 対象：Pages 用ビルド（`gui/scripts/site.mjs`、`base: "./"`）。M4-fix（レビュー M4R の反映）後のコミット `9f08db52726416520362473c5b85cdbe1e1f3a80`（ビルドに `--commit` で埋め込み、情報ダイアログと `version.json` に出る）。M4R 前の記録（`28c7191`、13枚）はこの撮り直しで置き換えた
- 配信：`gui/e2e/shots.mjs` がビルドを一時フォルダに作り、ローカルの静的サーバーで **`/Shin-MotionMaker/` の下だけ**に配信した（GitHub Pages のプロジェクトサイトと同じサブパス）
- ブラウザ：手元の Chrome をヘッドレス（`--headless=new`、`--force-color-profile=srgb`、`deviceScaleFactor: 1`）で DevTools Protocol から操作
- 環境：Windows 11、Node v24.15.0、2026-11-14
- 実行：`npm run shots --workspace gui -- --commit=9f08db52726416520362473c5b85cdbe1e1f3a80`
- 結果：16枚（M4R 前の13枚＋S5c・S9b・S12）。すべて横あふれ 0px、コンソールエラー 0 件（スクリプトの出力で確認）。M4R 前と画素が変わったのは S1・S2・S3・S5・S5b・S6・S9（S2・S3 はたたき台の乱数、S6 はコミット、S5・S5b・S9 は右下ノートの CLI 区画が2例になって高さが変わったため。S1 は差分の原因を特定していない）。S1m・S4・S7・S8・S10・S11 は同じバイト

| # | 状態 | 画面 | ファイル（`docs/work/M4/screenshots/`） | SHA-256 |
| --- | --- | --- | --- | --- |
| S1 | 解説モードの初期表示。01 の制作モード・タイトル・説明・視聴者・希望尺がスクロールなしで見える | 1440×900 | `S1-explainer-initial-1440.png` | `ea0e0b4a7be7d877ec757610c79d920b57adff2c5412f1934e538bd62d02669b` |
| S1m | MV モードの初期表示（目次は 01〜03） | 1440×900 | `S1m-mv-initial-1440.png` | `339ec088c59fa9177b7108f5aa32678749e555a8a7046f19b05e0295ac8004a5` |
| S2 | 解説モードの入力済み。方向性のたたき台（どれも選ばれていない）と差別化メモ | 1440×900 | `S2-explainer-filled-direction-1440.png` | `c3342fe23e1721a88ad448d24fe2a86d54aecaba23ded1da39cc75ddbd144cd4` |
| S3 | MV モードの入力済み（完成音源 30 秒、歌詞、たたき台、準備度） | 1440×900 | `S3-mv-filled-1440.png` | `c4f98e67109b6e60059396077ce214d5b6404159b89d700a02a8650966bc91f7` |
| S4 | エラー：必須未入力で ZIP 生成を押した状態（字幕帯のエラーの要約にフォーカス） | 1440×900 | `S4-required-missing-error-1440.png` | `f8a60db965b99509fa1c56653a0010c1c99a6861f344d03d964e2f7f65d1bdec` |
| S5 | 検査結果の表示：QC 事前ゲート（不合格、`review_mode: self` の明示、免除、ゲートの表）。助言は別区画 | 1440×900 | `S5-inspection-results-1440.png` | `89800084bd829aee96b0f21f42676023f33c302d2945c137feef36b8282217c7` |
| S5b | 検査結果の表示：ゴースト検査（ゲートの区画なし、件数は助言の区画）と静止画 | 1440×900 | `S5b-inspection-ghost-stills-1440.png` | `8f342397c9cbf919680dd04cab94f56fa2545d196cfd0a1fab5aedc2033b2ea4` |
| S5c | 検査結果の表示：QC の run.json だけを開いた状態。実行の状態（完了）とゲートの判定（不合格）を分け、`review_mode: self`・免除 PRE-3・ゲートの表を直接の QC と同じ部品で出す（M4R R2） | 1440×900 | `S5c-inspection-run-qc-1440.png` | `8e0ee83c0870383706a849b9d4ed009c3e8cd99c01003a42631f2e9e618ec17d` |
| S6 | 情報ダイアログ（版・テンプレート版・コミット・ビルド日時、文書、表示） | 1440×900 | `S6-info-dialog-1440.png` | `4ad14ce5cc3c6b69c08eae5c89c7bc5d4bca2fa7d15daf7af5f4197a2d903784` |
| S7 | 幅 390px、解説モード | 390×844 | `S7-explainer-390.png` | `963204276e8fc827b6aed4f0fa0e6539ae57ca69b99d130a0848e56264181678` |
| S8 | 幅 390px、MV モード | 390×844 | `S8-mv-390.png` | `be320eabfdad51036e8429f6dcc92722386473c911a5033218dbdbb500e38c97` |
| S9 | CLI・MCP の区画（request.json の書き出し、generate のコマンド例の先頭） | 1440×900 | `S9-cli-mcp-request-1440.png` | `5e19a874fce53f9730081818c8a027cd883fedb4716c9564d10abb5bc3447ad7` |
| S9b | CLI のコマンド例をシェル別に2つ（PowerShell・POSIX シェル）。タイトル `虹の$(仕組み) it's` がそれぞれの単一引用符の規則で1引数になる（M4R R3） | 1440×900 | `S9b-cli-shell-examples-1440.png` | `2fb5e7cec422c9c36341db5e00b68ca1578f17bd45994437ef588bad1d29aea5` |
| S10 | request.json を読み込んだ状態（置き換えの通知と、選び直す添付ファイルの名前） | 1440×900 | `S10-request-imported-1440.png` | `3cb40794bb8f291a03950f3f43a21761807958ae4aaf22068ced847c011ec3bc` |
| S11 | 高コントラスト表示（正本の `data-contrast="high"` のトークン） | 1440×900 | `S11-high-contrast-1440.png` | `b5140931bdb0b0ea098d870baf1749d22dc5df73b3ad60fadd5bb06d998d9028` |
| S12 | サンプル入力の後に、様式が不正な値（`styleMode: "unknown"`）の request.json を読み込んだ状態。入力は残り、字幕帯に pointer つきの入力エラーを出す（M4R R1） | 1440×900 | `S12-request-invalid-choice-1440.png` | `0881bc56cc199c51496a3e5ea33c58ff0d73d0baa35bd02d80b081136d6856d8` |

S11 の撮影で、目次の現在地と選択中のタブの文字が高コントラストの塗り（ink）と同じ色になる不具合を見つけ、`28c7191` で直した（文字に役割トークン `--ui-ph-text-on` を使う）。同じ不具合を検出する e2e（描画後の全文字のコントラスト、通常・高コントラストの両方）を足し、直す前のスタイルで失敗し、直した後で合格することを確かめた。

## M4 GUI の機械検査

| 検査 | コマンド | 結果 |
| --- | --- | --- |
| 単体（トークン・色の直値・形・コントラスト・request.json・検査結果・コマンド例。コマンド例は Windows で powershell.exe、sh がある環境で sh に実際に渡す） | `npm run test:unit --workspace gui` | 33 / 33 合格（M4-fix 後） |
| e2e（GU-02 全項目、request.json の往復と不正な列挙値、検査結果と run.json、サブパス、390px、状態ごとのキーボード到達、`prefers-reduced-motion` とエラー時のスクロール、描画後のコントラスト、ZIP 生成中の状態、ブラウザの ZIP と core＋Node のファイルシステム読みのバイト一致） | `npm run test:e2e --workspace gui` | 42 / 42 合格（M4-fix 後） |

GU-02 の項目と e2e のテスト名の対応は `docs/work/M4/REPORT.md` にある。

## M7 統合・Windows 実機検証

対象コードは `506a5a893cbb4da0aabfbfa82ecc1d75f6c00d3f`。環境は Windows / Node v24.15.0。以下の日時は UTC（JST は +09:00）。これは実行証拠であり、G4・受け入れ判定は L2 が行う。公開は実行していない。

### 再現コマンド

build 後、repo ルートから実行した。SHA は各 JSON に保存した値を使用した。原典生成の source は、原典作業ツリーではなく M0 の別複製（HEAD 262c798、追跡変更なし）を指定した。

```text
npm run build
node tools/tier-b.mjs --commit <SHA>
node tools/runtime-smoke.mjs --entry cli --commit <SHA>
node tools/runtime-smoke.mjs --entry mcp --commit <SHA>
node tools/prepare-legacy-smoke.mjs --source <原典複製>
node tools/runtime-smoke.mjs --entry cli --legacy-job ".agent-work/m7-legacy-source/jobs/Legacy source" --commit <SHA>
node tools/verify-pages-local.mjs --commit <SHA>
node tools/ci-local.mjs
```

### Tier B・一致試験・列挙検査

- Tier B: コミット `f98dc051fff88ca4c7eefba4db60e9819913e349`、2026-11-14T11:11:18.620Z〜2026-11-14T11:20:34.741Z、556.119秒。CLI と MCP それぞれ68ファイルを実生成し、setup / validate は completed・元終了0・正規化終了0、validate は pass。6操作（生成2件・run4件）の記録は [tier-b.json](docs/work/M7/evidence/tier-b.json)。後続の最終コードの Tier C でも同じ生成→setup→validate を両入口で再実行した。
- AR-06: GUI のヘッドレスブラウザが出す ZIP（解説・添付ありと MV）を、CLI のフォルダ・ZIP、MCP の dir・zip と全パス・本文バイトで比較する e2e に固定した。生成の result も同一出力パスで比較する。
- TS-05: 操作表にある共有同期読取9種類すべて、CLI cwd = MCP root で result 全体を完全比較する。doctor の空き容量の観測だけを試験 preload で固定し、製品値の削除・正規化はしない。
- L2 承認の M4-Q1: formChoices と shape 検査を共通化。JT-11 の全 golden・文言集合、TS-03、GUI の R1 を既存表明のまま実行対象に保つ。

### Tier C と JT-12

| 経路 | 実行日時（UTC） | 合計時間 | 結果 |
| --- | --- | --- | --- |
| CLI | 2026-11-14T11:15:42.760Z〜2026-11-14T11:26:55.323Z | 672.551秒 | 8 run、すべて completed。8件が終了0、0件が期待する終了1 |
| MCP | 2026-11-14T11:15:03.010Z〜2026-11-14T11:25:00.555Z | 597.521秒 | 8 run、すべて completed。8件が終了0、0件が期待する終了1 |
| CLI | 2026-11-14T11:15:13.722Z〜2026-11-14T11:26:00.922Z | 647.180秒 | 10 run、すべて completed。8件が終了0、2件が期待する終了1 |

全経路で sound → validate → preview → still(frame 30) → ghost preview → final → ghost final を実行した。ジョブのフォルダ名は `Runtime & 全角 空白` または `Legacy & 全角 空白`。各 run の入力・開始終了時刻・stdout/stderr の SHA-256 と末尾・成果物 SHA-256 は経路別 JSON に保存した。MCP は開始 wait_ms:0、全 run で run_get wait_ms:50000 を繰り返し、プロトコルエラー0。

原典の0.4ジョブは tools/generate-job.ts が実生成したものを使用した。[legacy-origin.json](docs/work/M7/evidence/legacy-origin.json) の原典 validate スクリプト SHA-256 は `c4c8801931616bbc0a561023245acebb1b56e9212221a5e959a1dc825158cee7`（基線と一致）。status は schema_version:0.4 / generator:null。reports/validate.json がないことを確かめ、終了0 / stdout から pass、タイトルを一時的に空にした終了1 / stderr から fail を取得した。QC は制作記録未作成のため fail / completed / 終了1であり、道具の故障ではない。render・ghost はすべて終了0。

| 経路 | 操作 / 結果 | run ID | 状態 | 元 / 正規化終了 | 秒 | 成果物数 |
| --- | --- | --- | --- | --- | --- | --- |
| CLI | setup | `r-20261114T111546Z-abaf59ed` | completed | 0 / 0 | 240.669 | 0 |
| CLI | sound | `r-20261114T111947Z-0f9d5301` | completed | 0 / 0 | 8.830 | 5 |
| CLI | validate / pass | `r-20261114T111956Z-0d7bd752` | completed | 0 / 0 | 29.009 | 1 |
| CLI | render:preview | `r-20261114T112025Z-c2699fee` | completed | 0 / 0 | 197.471 | 1 |
| CLI | render:still | `r-20261114T112343Z-be432392` | completed | 0 / 0 | 71.075 | 1 |
| CLI | ghost_check:preview | `r-20261114T112455Z-7fd72505` | completed | 0 / 0 | 19.635 | 1 |
| CLI | render:final | `r-20261114T112513Z-d80105bc` | completed | 0 / 0 | 95.320 | 1 |
| CLI | ghost_check | `r-20261114T112648Z-16ef3129` | completed | 0 / 0 | 7.836 | 1 |
| MCP | setup | `r-20261114T111514Z-d4b7b1cf` | completed | 0 / 0 | 226.813 | 0 |
| MCP | sound | `r-20261114T111900Z-12c13d6c` | completed | 0 / 0 | 4.818 | 5 |
| MCP | validate / pass | `r-20261114T111905Z-ff3da719` | completed | 0 / 0 | 29.098 | 1 |
| MCP | render:preview | `r-20261114T111934Z-f7f4023b` | completed | 0 / 0 | 139.113 | 1 |
| MCP | render:still | `r-20261114T112153Z-e738a0a5` | completed | 0 / 0 | 59.535 | 1 |
| MCP | ghost_check:preview | `r-20261114T112254Z-70514396` | completed | 0 / 0 | 10.999 | 1 |
| MCP | render:final | `r-20261114T112304Z-a29a4afc` | completed | 0 / 0 | 107.856 | 1 |
| MCP | ghost_check | `r-20261114T112452Z-4048f2b7` | completed | 0 / 0 | 8.068 | 1 |
| CLI | setup | `r-20261114T111515Z-cd31c2e2` | completed | 0 / 0 | 221.341 | 0 |
| CLI | sound | `r-20261114T111858Z-bf53a62e` | completed | 0 / 0 | 8.079 | 5 |
| CLI | validate / pass | `r-20261114T111906Z-2075f7dc` | completed | 0 / 0 | 29.909 | 0 |
| CLI | validate / fail | `r-20261114T111936Z-5e66abfc` | completed | 1 / 1 | 26.534 | 0 |
| CLI | qc:pre / fail | `r-20261114T112003Z-dcab0419` | completed | 1 / 1 | 8.788 | 1 |
| CLI | render:preview | `r-20261114T112011Z-6bbdc87c` | completed | 0 / 0 | 122.131 | 1 |
| CLI | render:still | `r-20261114T112214Z-88e1561f` | completed | 0 / 0 | 68.536 | 1 |
| CLI | ghost_check:preview | `r-20261114T112323Z-55a27bae` | completed | 0 / 0 | 17.762 | 1 |
| CLI | render:final | `r-20261114T112340Z-334b6199` | completed | 0 / 0 | 121.181 | 1 |
| CLI | ghost_check | `r-20261114T112543Z-2d3e5816` | completed | 0 / 0 | 20.541 | 1 |

### 成果物

動画はすべて180フレーム・6秒の fixture。ghost の件数は助言であり、件数を受け入れ条件にしていない。静止画と ghost JSON のコピーは経路別の `*-artifacts/` に保持した。動画・生成ジョブの node_modules・一時ジョブはハッシュ採取後に削除した。

| 経路 | 一時ジョブ内の成果物 | bytes | SHA-256 |
| --- | --- | --- | --- |
| CLI | `output/final.mp4` | 643491 | `6858f6e28df197f966efcc0c14a48d575d15e9e696b39cb6d69de5dca7ad0b79` |
| CLI | `output/preview.mp4` | 495584 | `7a70f6bf36c0ae6a0ca418cd41e7d8ead32b970b53c241cd9661ab0c821e2b60` |
| CLI | `output/preview.png` | 27051 | `3d737258719e5b789ca6abd0275ebd0fca89307135746e2a88420527a58fae04` |
| CLI | `reports/ghost-check-preview.json` | 320 | `98aeb135ed51ab37ee3f779a4b9bc7914f762f6a799688417504955332c36fd3` |
| CLI | `reports/ghost-check.json` | 318 | `186e2127c0441a4422106f28046525b215bd5a75f3016761d9cc8c7ce3bdb954` |
| MCP | `output/final.mp4` | 643491 | `6858f6e28df197f966efcc0c14a48d575d15e9e696b39cb6d69de5dca7ad0b79` |
| MCP | `output/preview.mp4` | 495584 | `7a70f6bf36c0ae6a0ca418cd41e7d8ead32b970b53c241cd9661ab0c821e2b60` |
| MCP | `output/preview.png` | 27051 | `3d737258719e5b789ca6abd0275ebd0fca89307135746e2a88420527a58fae04` |
| MCP | `reports/ghost-check-preview.json` | 320 | `98aeb135ed51ab37ee3f779a4b9bc7914f762f6a799688417504955332c36fd3` |
| MCP | `reports/ghost-check.json` | 318 | `186e2127c0441a4422106f28046525b215bd5a75f3016761d9cc8c7ce3bdb954` |
| CLI | `output/final.mp4` | 643491 | `6858f6e28df197f966efcc0c14a48d575d15e9e696b39cb6d69de5dca7ad0b79` |
| CLI | `output/preview.mp4` | 495584 | `7a70f6bf36c0ae6a0ca418cd41e7d8ead32b970b53c241cd9661ab0c821e2b60` |
| CLI | `output/preview.png` | 27051 | `3d737258719e5b789ca6abd0275ebd0fca89307135746e2a88420527a58fae04` |
| CLI | `reports/ghost-check-preview.json` | 320 | `98aeb135ed51ab37ee3f779a4b9bc7914f762f6a799688417504955332c36fd3` |
| CLI | `reports/ghost-check.json` | 318 | `186e2127c0441a4422106f28046525b215bd5a75f3016761d9cc8c7ce3bdb954` |

### Pages ローカル検査（CI-07）

2026-11-14T11:17:24.985Z〜2026-11-14T11:18:24.704Z、コミット `506a5a893cbb4da0aabfbfa82ecc1d75f6c00d3f`。Pages ビルドを `/Shin-MotionMaker/` の下だけに配信し、verify-pages.mjs の CLI を実行して終了0。HTTP 200、title、version.json の commit、一致する JS/CSS 200、見出し「動画ジョブを作成」「ジョブの要点」「補足」と ZIP ボタン表示、コンソールエラー0を確認した。HTTP・title・commit・JS・CSS・console・見出し非表示・ZIP 非表示の8不一致はいずれも拒否。古い commit は2回目の再試行で成功した。

スクリーンショット [pages-local.png](docs/work/M7/evidence/pages-local.png) の SHA-256 は `3bfedde3aeda625194daeca2036212b397f4c48dbabed5c15bc5b0253bba5c0e`。M8 の公開前比較用に保持する。今回の検査 URL はローカルであり、実公開 URL の検査・画像比較は未実施。

### ci-local とテスト

最終の深さ1複製で、本体212件 / pass210 / fail0 / skip2 / TODO0（249659.3611ms）、GUI 単体33件 / pass32 / fail0 / skip1 / TODO0（2420.4563ms）、ブラウザ e2e42/42。ビルド・GUI ビルドを含め、すべて終了0。

`node tools/ci-local.mjs` はコミット `c055d99d819752d67022a1b1033d20f47ac7ded4` の深さ1複製で終了0。実行 2026-11-14T11:28:28.634Z〜2026-11-14T11:36:06.582Z。実行コマンドは npm ci → build → npm test → GUI test（e2e 含む）→ GUI build。出力ログは `.agent-work/m7-evidence/ci.log`、SHA-256 `bf7674444613902703b2d8c6351cb955a436c049aac12cd503755f01a770aa1d`。要約は [ci.json](docs/work/M7/evidence/ci.json)。

初回の npm test は212件 / pass209 / fail1 / skip2 / TODO0（333294.2302ms）。既存 MC-13 再起動試験の旧 assert が false になったが応答詳細がなく、初回の原因は確定できなかった。単独再実行は1件成功。その後、固定6秒待ちを release ファイルでの同期へ変更し、再起動後の running 取得を追加、対象1件成功。追加の統合試験3件、core / 基線20件、GUI 単体33件（pass32 / skip1）、AR-06 のブラウザ2件もそれぞれ終了0。

ubuntu Node22/24、リモート CI、G4 レビュー、実公開・公開後検査は未実施。Windows の既存 OS 限定 skip と symlink 権限不足の診断を隠していない。

### 証拠 JSON の SHA-256

全保持ファイル（PNG を含む）のサイズ・SHA-256 は [manifest.json](docs/work/M7/evidence/manifest.json)。

| 記録 | bytes | SHA-256 |
| --- | --- | --- |
| [ci.json](docs/work/M7/evidence/ci.json) | 1528 | `f3d59f284b52e9b1c9e59e8f654acf1f59fb36572fbaacf29fa06ac3a9f82002` |
| [legacy-origin.json](docs/work/M7/evidence/legacy-origin.json) | 483 | `fd06d2ab36f6eb1ebf4d048e4bfb9a36b8a1e71b1029b3d585e4c630660c01ee` |
| [pages-local.json](docs/work/M7/evidence/pages-local.json) | 1997 | `11be06fec0671a5422dfb3ea80d36360884df063b63e0557b34f6d0f7e472f8c` |
| [tier-b.json](docs/work/M7/evidence/tier-b.json) | 9006 | `1cfdfca2430c8862ad4f9f303dbc36fbba7a22c714802f5be4a074b54e8d140f` |
| [tier-c-cli.json](docs/work/M7/evidence/tier-c-cli.json) | 39135 | `fe91ef448adc9eeb2ec1edad18590951ff2b1ef31835596f04c8e272fa2f90ae` |
| [tier-c-legacy.json](docs/work/M7/evidence/tier-c-legacy.json) | 47074 | `82f437fe0ad5d6f8c5ec86b6b54a8d1515efce226611a3804d104d569c950983` |
| [tier-c-mcp.json](docs/work/M7/evidence/tier-c-mcp.json) | 45728 | `180409857f2b5c3ebf7837ca3e5fb4d5b157ce833ac66c95aa016dac312ec9d6` |
