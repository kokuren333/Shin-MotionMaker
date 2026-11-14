# VERIFICATION — 公開と検証の証拠

この文書は検証の証拠の記録である。記録はオーナーの目視を待つ関門ではない（REQUIREMENTS GU-17、原典 Amendment 01 AM-1）。公開（M8）の記録は CI-08 の4条件に従って後から足す。

> **コミットハッシュの読み替え（M8）**：公開前に、オーナーの決定で全コミットの author・committer を noreply に書き換えた。M7 以前の節に書かれた Shin-MotionMaker 自身のコミットハッシュは書き換え前の値であり、公開 repo では [COMMIT_MAP](docs/work/M8/COMMIT_MAP.md) で新しいハッシュに読み替える（例：Tier C 実測の `c0d10ca` → `85a1c6e`）。ファイル内容は変わっていない。詳細は末尾の [M8 公開](#m8-公開) 節。

最新の統合検証は末尾の [M7-final](#m7-final)。M7-fix-Q1 の L2 回答に従い GUI テストを整合させ、最終コードコミットの ci-local は終了0。Tier B/C の実測は [M7-fix](#m7-fix)（テンプレート0.5.2）に保持する。以下の既存節の結果・未達の記述は、それぞれの実行時点の履歴である。

M7-add では main `7741d9594e30305339b8736ee6e2c49591c89384` を `6789f2a` で取り込み、現在のテンプレート版は **0.5.2**（目録 SHA-256 `9e01031edccf35664747a3c38528381b3a52469f74c64ed3164b00de4e30d70a`）になった。下記 Tier C の実測コミット `506a5a893cbb4da0aabfbfa82ecc1d75f6c00d3f` はテンプレート **0.5.1** を使用した記録であり、JSON 内の generator とハッシュをそのまま保持する。JT-12 の入力は原典262c798生成の schema_version 0.4・generator なしで、template_version は存在しない。今回のテンプレート差分は M6 の R3 README 追記の推敲だけであり、追補発注の指定どおり実レンダーは再実行していない。取り込み後の検証は [M7 REPORT の M7-add](docs/work/M7/REPORT.md#m7-add) に記録する。

取り込み後のコミット `bc99306326622d9ff52cdb134b47bf22a0c2a423` は、深さ1複製の ci-local で終了0（本体215件/pass213/skip2/fail0、GUI33件/pass32/skip1/fail0、e2e42/42、ライセンス180項目、両ビルド）。[ci-add.json](docs/work/M7/evidence/ci-add.json) に日時・出力要約・ログハッシュを保存した。同じコミット・テンプレート0.5.2の [pages-add.json](docs/work/M7/evidence/pages-add.json) も正常経路・8不一致・再試行を確認し、verifier CLI は終了0。画面は既存 pages-local.png と同じ SHA-256 だった。実公開の確認ではなく、見た目の判定も行っていない。

## M7-gui GUI のスクリーンショット（GU-17、G4-M1）

G4 レビューの G4-M1（M7 で読み込みエラーの文言が変わったのに S12 が古い）を受けて、R-10 の反映後のコミットで全状態を撮り直した。現在の基準はこの表であり、下の M4 の表は履歴として残す（公開前後の比較（CI-08）の基準もこの表）。

- 対象：Pages 用ビルド。コミット `94ed115ff66bea5f49277e113d68582949aea131`（R-10 の反映。ビルドに `--commit` で埋め込み）。撮影手順・配信・ブラウザは M4 と同じ
- 環境：Windows 11、Node v24.15.0、2026-11-14
- 実行：`npm run shots --workspace gui -- --commit=94ed115ff66bea5f49277e113d68582949aea131 --out=../docs/work/M7-gui/screenshots`
- 結果：16枚。すべて横あふれ 0px、コンソールエラー 0 件（スクリプトの出力で確認）。M4（`9f08db5`）と同じバイトは 11枚、変わったのは S1・S2・S3・S6・S12。差の内訳は [M7-gui REPORT](docs/work/M7-gui/REPORT.md#見た目の差m4-との比較) に書いた

| # | 状態 | 画面 | ファイル（`docs/work/M7-gui/screenshots/`） | SHA-256 | M4 との比較 |
| --- | --- | --- | --- | --- | --- |
| S1 | 解説モードの初期表示。01 の制作モード・タイトル・説明・視聴者・希望尺がスクロールなしで見える | 1440×900 | `S1-explainer-initial-1440.png` | `3bfedde3aeda625194daeca2036212b397f4c48dbabed5c15bc5b0253bba5c0e` | 変化 |
| S1m | MV モードの初期表示（目次は 01〜03） | 1440×900 | `S1m-mv-initial-1440.png` | `339ec088c59fa9177b7108f5aa32678749e555a8a7046f19b05e0295ac8004a5` | 同じ |
| S2 | 解説モードの入力済み。方向性のたたき台（どれも選ばれていない）と差別化メモ | 1440×900 | `S2-explainer-filled-direction-1440.png` | `e92394a1e9ff8c11065df0a1b1c3bb39dfedbaa3983330a411525aa3355044b0` | 変化 |
| S3 | MV モードの入力済み（完成音源 30 秒、歌詞、たたき台、準備度） | 1440×900 | `S3-mv-filled-1440.png` | `58ea0bbe9e638907fcd1f85d8f43ef70b734d1d9bcc0670c1f9a02add9cd069c` | 変化 |
| S4 | エラー：必須未入力で ZIP 生成を押した状態（字幕帯のエラーの要約にフォーカス） | 1440×900 | `S4-required-missing-error-1440.png` | `f8a60db965b99509fa1c56653a0010c1c99a6861f344d03d964e2f7f65d1bdec` | 同じ |
| S5 | 検査結果の表示：QC 事前ゲート（不合格、`review_mode: self` の明示、免除、ゲートの表）。助言は別区画 | 1440×900 | `S5-inspection-results-1440.png` | `89800084bd829aee96b0f21f42676023f33c302d2945c137feef36b8282217c7` | 同じ |
| S5b | 検査結果の表示：ゴースト検査（ゲートの区画なし、件数は助言の区画）と静止画 | 1440×900 | `S5b-inspection-ghost-stills-1440.png` | `8f342397c9cbf919680dd04cab94f56fa2545d196cfd0a1fab5aedc2033b2ea4` | 同じ |
| S5c | 検査結果の表示：QC の run.json だけを開いた状態。実行の状態（完了）とゲートの判定（不合格）を分け、`review_mode: self`・免除 PRE-3・ゲートの表を直接の QC と同じ部品で出す（M4R R2） | 1440×900 | `S5c-inspection-run-qc-1440.png` | `8e0ee83c0870383706a849b9d4ed009c3e8cd99c01003a42631f2e9e618ec17d` | 同じ |
| S6 | 情報ダイアログ（版・テンプレート版・コミット・ビルド日時、文書、表示） | 1440×900 | `S6-info-dialog-1440.png` | `22a1af8c4bcc0971bf1aa6186a851f0118a19408cbbaac837f75a2c23de3f206` | 変化 |
| S7 | 幅 390px、解説モード | 390×844 | `S7-explainer-390.png` | `963204276e8fc827b6aed4f0fa0e6539ae57ca69b99d130a0848e56264181678` | 同じ |
| S8 | 幅 390px、MV モード | 390×844 | `S8-mv-390.png` | `be320eabfdad51036e8429f6dcc92722386473c911a5033218dbdbb500e38c97` | 同じ |
| S9 | CLI・MCP の区画（request.json の書き出し、generate のコマンド例の先頭） | 1440×900 | `S9-cli-mcp-request-1440.png` | `5e19a874fce53f9730081818c8a027cd883fedb4716c9564d10abb5bc3447ad7` | 同じ |
| S9b | CLI のコマンド例をシェル別に2つ（PowerShell・POSIX シェル）。タイトル `虹の$(仕組み) it's` がそれぞれの単一引用符の規則で1引数になる（M4R R3） | 1440×900 | `S9b-cli-shell-examples-1440.png` | `2fb5e7cec422c9c36341db5e00b68ca1578f17bd45994437ef588bad1d29aea5` | 同じ |
| S10 | request.json を読み込んだ状態（置き換えの通知と、選び直す添付ファイルの名前） | 1440×900 | `S10-request-imported-1440.png` | `3cb40794bb8f291a03950f3f43a21761807958ae4aaf22068ced847c011ec3bc` | 同じ |
| S11 | 高コントラスト表示（正本の `data-contrast="high"` のトークン） | 1440×900 | `S11-high-contrast-1440.png` | `b5140931bdb0b0ea098d870baf1749d22dc5df73b3ad60fadd5bb06d998d9028` | 同じ |
| S12 | サンプル入力の後に、様式が不正な値（`styleMode: "unknown"`）の request.json を読み込んだ状態。入力は残り、字幕帯に core の message、画面の項目名と pointer、core の `formChoices` の書ける値、直し方、「読み込み前の入力と添付はそのままです。」を出す（M4R R1、M7-gui R-10） | 1440×900 | `S12-request-invalid-choice-1440.png` | `f125766d9eb99b4064ccfd3e44ea17c9bb7768b511ddc91e8879c16e989c0d9c` | 変化 |

## M4 GUI のスクリーンショット（GU-17）

（履歴。現在の基準は上の M7-gui の表。）

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
| CLI（原典 0.4 ジョブ） | 2026-11-14T11:15:13.722Z〜2026-11-14T11:26:00.922Z | 647.180秒 | 10 run、すべて completed。8件が終了0、2件が期待する終了1 |

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
| CLI（原典 0.4 ジョブ） | setup | `r-20261114T111515Z-cd31c2e2` | completed | 0 / 0 | 221.341 | 0 |
| CLI（原典 0.4 ジョブ） | sound | `r-20261114T111858Z-bf53a62e` | completed | 0 / 0 | 8.079 | 5 |
| CLI（原典 0.4 ジョブ） | validate / pass | `r-20261114T111906Z-2075f7dc` | completed | 0 / 0 | 29.909 | 0 |
| CLI（原典 0.4 ジョブ） | validate / fail | `r-20261114T111936Z-5e66abfc` | completed | 1 / 1 | 26.534 | 0 |
| CLI（原典 0.4 ジョブ） | qc:pre / fail | `r-20261114T112003Z-dcab0419` | completed | 1 / 1 | 8.788 | 1 |
| CLI（原典 0.4 ジョブ） | render:preview | `r-20261114T112011Z-6bbdc87c` | completed | 0 / 0 | 122.131 | 1 |
| CLI（原典 0.4 ジョブ） | render:still | `r-20261114T112214Z-88e1561f` | completed | 0 / 0 | 68.536 | 1 |
| CLI（原典 0.4 ジョブ） | ghost_check:preview | `r-20261114T112323Z-55a27bae` | completed | 0 / 0 | 17.762 | 1 |
| CLI（原典 0.4 ジョブ） | render:final | `r-20261114T112340Z-334b6199` | completed | 0 / 0 | 121.181 | 1 |
| CLI（原典 0.4 ジョブ） | ghost_check | `r-20261114T112543Z-2d3e5816` | completed | 0 / 0 | 20.541 | 1 |

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
| CLI（原典 0.4 ジョブ） | `output/final.mp4` | 643491 | `6858f6e28df197f966efcc0c14a48d575d15e9e696b39cb6d69de5dca7ad0b79` |
| CLI（原典 0.4 ジョブ） | `output/preview.mp4` | 495584 | `7a70f6bf36c0ae6a0ca418cd41e7d8ead32b970b53c241cd9661ab0c821e2b60` |
| CLI（原典 0.4 ジョブ） | `output/preview.png` | 27051 | `3d737258719e5b789ca6abd0275ebd0fca89307135746e2a88420527a58fae04` |
| CLI（原典 0.4 ジョブ） | `reports/ghost-check-preview.json` | 320 | `98aeb135ed51ab37ee3f779a4b9bc7914f762f6a799688417504955332c36fd3` |
| CLI（原典 0.4 ジョブ） | `reports/ghost-check.json` | 318 | `186e2127c0441a4422106f28046525b215bd5a75f3016761d9cc8c7ce3bdb954` |

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

## M7-fix

- 実行環境：Windows、Node v24.15.0。実装・テストをコミット後に main `0df32f3` を含むことを確認した検証対象 HEAD は **`c0d10ca798b2689a50e91f3556dc73c09cfa3391`**。テンプレートは **0.5.2**、目録 SHA-256 は `9e01031edccf35664747a3c38528381b3a52469f74c64ed3164b00de4e30d70a`。
- Tier B/C の各ツールは開始時に実 HEAD・指定コミットとの一致・作業ツリーのクリーン状態を検査し、同じ HEAD から配布 JS を再ビルドした。証拠の `revision` にその値と時刻を記録した。以後のコミットはこの証拠と文書のみ。
- 詳細は [REPORT](docs/work/M7-fix/REPORT.md)、受け入れ未達の理由は [M7-fix-Q1](docs/work/M7-fix/QUESTIONS.md)。L3 による自己合格・公開の完了宣言は行わない。

### 全体検査

| コマンド・対象 | 結果 | 証拠 |
| --- | --- | --- |
| `node tools/ci-local.mjs`、上記 HEAD の深さ1複製 | 2026-11-14T12:41:57.074Z〜12:49:48.814Z、471.739秒。npm ci・ライセンス・ビルド・本体219件（pass217 / fail0 / skip2）完了。GUI 単体33件（pass31 / fail1 / skip1）で停止、全体終了1 | [ci-local-final.json](docs/work/M7-fix/evidence/ci-local-final.json) |
| GUI e2e の独立実行 | 41/42、終了1。solo の2人目配置を拒否すると期待する既存フィクスチャ。単体も非 duo の2人目配置まで検査すると期待する。gui/ の変更禁止により未修正 | [commands.json](docs/work/M7-fix/evidence/commands.json)、[QUESTIONS](docs/work/M7-fix/QUESTIONS.md) |
| GUI ビルド | 型検査・Vite とも終了0 | 同上 |
| `node tools/verify-cli.mjs` | 既定の追跡外へ54記録、終了0。M2b の証拠ファイルを上書きしない | [cli.json](docs/work/M7-fix/evidence/cli.json) |
| `node tools/check-licenses.mjs --output .agent-work/m7fix-licenses.json` | 180項目・導入済130・許容集合外なし、終了0。依存追加・版更新なし | [licenses.json](docs/work/M7-fix/evidence/licenses.json) |
| Tier B/C の開始前拒否 | 両ツールにコミット不一致・dirty の各条件を与え、4件すべて終了1で開始前に拒否 | [revision-rejections.json](docs/work/M7-fix/evidence/revision-rejections.json) |

最初の ci-local は MC-05/MC-15 の10秒の偽処理と10秒の待機枠の境界で停止した。完了・verdict・通知の表明を維持して待機を契約内の50秒に修正し、上記の深さ1再実行では当該テストも成功した。最初の失敗は [ci-local.json](docs/work/M7-fix/evidence/ci-local.json) に区別して保持している。既存 low1 の audit 表示は自動修正していない。

### Tier B/C

次のコマンドを実行した（実行時の --commit は HEAD で、ツールが上記 SHA に解決・照合）。

```powershell
node tools/tier-b.mjs --commit c0d10ca798b2689a50e91f3556dc73c09cfa3391 --evidence .agent-work/m7fix-evidence/tier-b.json
node tools/runtime-smoke.mjs --entry cli --commit c0d10ca798b2689a50e91f3556dc73c09cfa3391 --evidence .agent-work/m7fix-evidence/tier-c-cli.json
node tools/runtime-smoke.mjs --entry mcp --commit c0d10ca798b2689a50e91f3556dc73c09cfa3391 --evidence .agent-work/m7fix-evidence/tier-c-mcp.json
node tools/runtime-smoke.mjs --entry cli --legacy-job ".agent-work/m7-legacy-source/jobs/Legacy source" --commit c0d10ca798b2689a50e91f3556dc73c09cfa3391 --evidence .agent-work/m7fix-evidence/tier-c-legacy.json
```

| 経路 | 実行日時（UTC、2026-11-14） | 所要時間 | 観測結果 |
| --- | --- | --- | --- |
| Tier B CLI・MCP | 12:43:26.016〜12:51:51.850 | 505.834秒 | 各68ファイル生成、setup / validate の4 run が completed・元終了0・正規化終了0、validate は両方 pass。[tier-b.json](docs/work/M7-fix/evidence/tier-b.json) |
| Tier C CLI | 12:44:22.567〜12:52:40.926 | 498.343秒 | 8 run、すべて completed、元・正規化終了とも0。[tier-c-cli.json](docs/work/M7-fix/evidence/tier-c-cli.json) |
| Tier C MCP | 12:45:40.703〜12:52:46.347 | 425.614秒 | 8 run、すべて completed、元・正規化終了とも0。開始 wait_ms:0、run_get wait_ms:50000 を1〜4回、protocol_errors:0。[tier-c-mcp.json](docs/work/M7-fix/evidence/tier-c-mcp.json) |
| Tier C CLI（原典 0.4 ジョブ） | 12:47:00.175〜12:53:27.881 | 387.691秒 | 10 run、すべて completed。8件が元・正規化終了とも0、validate fail / QC fail の2件が期待どおり1。[tier-c-legacy.json](docs/work/M7-fix/evidence/tier-c-legacy.json) |

ジョブ名は `Tier B & ＆（全角）　・ 空白`、`Runtime & ＆（全角）　・ 空白`、`Legacy & ＆（全角）　・ 空白`。Tier C は既存の640×360・6秒・180フレームの fixture で setup → sound → validate → preview → still(frame30) → ghost preview → final → ghost final を通した。使用したのは既存ブラウザで、自動導入・実 Aivis・有償画像生成は行っていない。

原典0.4の入力は `git clone --no-hardlinks` で用意した専用スクラッチの原典262c798が実生成したもの。[legacy-origin.json](docs/work/M7-fix/evidence/legacy-origin.json) の validate スクリプト SHA-256 は基線と同じ `c4c8801931616bbc0a561023245acebb1b56e9212221a5e959a1dc825158cee7`。status の generator:null と、R4 report が無い状態で validate pass/fail を読めることも確認した。この入力は schema_version 0.4・generator なしであり、記録中の template_version:0.5.2 は検証したツールの現行テンプレート版を示す。

CLI/MCP の出力5ファイルはハッシュが一致した。全3経路の静止画は27051 bytes、SHA-256 `3d737258719e5b789ca6abd0275ebd0fca89307135746e2a88420527a58fae04`。PNG と ghost JSON を [CLI artifacts](docs/work/M7-fix/evidence/cli-artifacts/preview.png)、[MCP artifacts](docs/work/M7-fix/evidence/mcp-artifacts/preview.png)、[原典0.4 artifacts](docs/work/M7-fix/evidence/legacy-artifacts/preview.png) に保存し、動画・依存・一時ジョブはハッシュ採取後に削除した。ghost の件数は助言のままである。

証拠の [manifest.json](docs/work/M7-fix/evidence/manifest.json) は21ファイル・336917 bytes のパス・サイズ・SHA-256を記録する（目録自身を除く）。目録の SHA-256 は `cd39dac0c6817f6a4fd56682843b832cc9d494d69e842c3bda1bf1c13c0f6dec`。生ログは追跡外に保持し、そのハッシュだけを証拠へ記録した。以前の M7 の JSON・画像は変更していない。

## M7-final

検証対象の最終コードコミットは **`4cafdbe79cd2232361c8891f1485066d02d5b6ca`**（`M7-final: align GUI import fixtures with active character checks`）。M7-gui と M7-fix のマージ済み HEAD `f6b4153` に、L2 回答で許可された GUI 単体・e2e のテスト修正を加えた。2人目の不正な位置は duo で拒否し、solo では原典どおり受理して値を保持する。同じ e2e で拒否時の画面・入力・添付の保持も確認した。L2 回答は [M7-fix-Q1](docs/work/M7-fix/QUESTIONS.md) に記録した。

環境は Windows / Node v24.15.0 / npm 11.12.1。日時は UTC、2026-11-14。結果の保存は文書のみのコミット（`M7-final: record integrated verification and L2 answer`）に分け、検証後の実装・テスト変更は無い。受け入れ・G4 の判定は L2 に委ねる。

| コマンド・対象 | 観測結果 |
| --- | --- |
| `npm ci`（指定作業ツリー） | 終了0。131追加・133監査。既存 low1 の表示は自動修正していない |
| `node tools/ci-local.mjs`（最終コードコミットの深さ1複製） | 13:08:37.020Z〜13:13:12.945Z、275.924秒、終了0。本体219件（pass217 / fail0 / skip2）、GUI 単体34件（pass33 / fail0 / skip1）、e2e42/42。ライセンス180項目・導入済130・verified:true、本体と GUI のビルド完了。末尾は「CI と同じコマンドが完了しました」と対象の完全 SHA |
| `npm run build` → `node tools/verify-cli.mjs`（指定作業ツリー） | 両方終了0。build は13:08:57.162Z〜13:09:03.915Z、verify-cli は13:09:04.095Z〜13:10:39.214Z。54件の実動記録を既定の追跡外 `.agent-work/cli-verification.json` に出力 |

本体の skip2 は Linux 専用の子孫停止と POSIX ファイル名、GUI の skip1 は sh 不在。Windows の junction 検査は実行され、ディレクトリ symlink の EPERM 診断も記録された。ci-local の生ログは追跡外 `.agent-work/m7final-ci.log`、SHA-256 `67401bd69ac03a5a99d0ba1a73394519350c5f3e23629293ecd06e14b1f64cb9`。時刻・件数・各コマンドの終了値とログハッシュは [verification.json](docs/work/M7-final/evidence/verification.json)、詳細は [REPORT](docs/work/M7-final/REPORT.md) に保存した。

`VERIFICATION.md` の M7-gui 節はマージ前 `e10f571`、M7-fix 節はマージ後 `f6b4153` と本文一致し、重複・食い違いは無かった。既存の16画像と M7-fix の21証拠ファイル（336917 bytes）のサイズ・SHA-256 もすべて一致。記録は変更せず、今回の結果を追記した。

Tier C 実測コミット **`c0d10ca798b2689a50e91f3556dc73c09cfa3391`** から最終コードコミットへの `git diff --stat` は46ファイル・9120追加・15削除（[diff-stat.txt](docs/work/M7-final/evidence/diff-stat.txt)）。差分は `gui/`・`docs/` とルートの証拠文書 `VERIFICATION.md` のみ。`git diff --exit-code c0d10ca798b2689a50e91f3556dc73c09cfa3391 4cafdbe79cd2232361c8891f1485066d02d5b6ca -- src tools schemas job-template job-assets package.json package-lock.json` は出力なし・終了0で、core・host・CLI・MCP・テンプレート・実行ツール・依存のコードに差分は無い。証拠を保存する後続コミットも文書のみ。今回 Tier C は再実行していない。

## M8 公開

### 履歴の author・committer の書き換え（オーナー決定）

- 決定：2026-11-14 23:38、オーナーが「push の前に、ローカル履歴の全コミットの author・committer を noreply に書き換える」と決定した。プロジェクトの「履歴を書き換えない」原則（AGENTS §4、CI-09）に対する、公開前の一度だけの例外である。リモートはまだ無く、書き換えた履歴を一度も公開していない状態で行った。
- 書き換え先：`kokuren333 <50736503+kokuren333@users.noreply.github.com>`（CyberSprite と同じ）。repo の `user.name`・`user.email` も以後これに設定した。
- 実施：`git filter-branch --env-filter …（author・committer の名前とメールを置き換え）-- --all`。対象は 113 コミット、13 ref（main と残っていた 12 ブランチ）。タグは無かった。木・著者日時・メッセージ・親子関係は変えていない。書き換え前の全 ref はバンドルで repo の外に退避した。
- 確認：`git log --all --format='%ae %ce'` は 113 行すべて noreply で、個人のメールアドレスは 0 件。全履歴の追跡ファイルの内容にも個人のメールアドレスは 0 件（`git grep` を全コミットに対して実行）。
- 影響：Shin-MotionMaker 自身のコミットハッシュがすべて変わった（main は `d34de11` → `20f93e9`）。旧→新の対応は [COMMIT_MAP](docs/work/M8/COMMIT_MAP.md)（113 件、木・著者日時・件名・親で一意に対応）。既存の記録は当時の証拠として書き換えずに残す。原典 BiimMotion のハッシュ（`262c798` など）は影響を受けない。テストは git 履歴を読まない（CI-01）ので、書き換え後のコミットで深さ1の ci-local を実行して確かめた（下記）。
- 書き換え後の ci-local：`node tools/ci-local.mjs`（書き換え後の main `20f93e9d3697d3da2967c4d7cd95412a17ef6c39` の深さ1複製）、2026-11-14T14:41:58Z〜14:47:26Z、終了0。npm ci・ライセンス照合・ビルド・本体219件（pass217 / fail0 / skip2）・GUI 単体34件（pass34 / fail0）・e2e 42/42・GUI ビルド。skip2 は書き換え前と同じ Linux 専用・POSIX 専用のテスト。生ログは追跡外、SHA-256 `da65e8ea5a688cd1ec4fd1bfc9b380ee0cf11f69350377544140f9a36922e18d`。

### リモートの作成と main への取り込み（経路 (a)）

- repo：`kokuren333/Shin-MotionMaker`（public）を 2026-11-14 に作成した（オーナー承認 Q-01）。npm には公開していない（Q-02 の既定）。
- remote main はルートコミット `e53dd3a`（`docs/REQUIREMENTS.md` だけ、workflow なし）で作成し、残りの履歴をブランチ `m8-publish` から [PR #1](https://github.com/kokuren333/Shin-MotionMaker/pull/1) で入れた。PR の CI が全ジョブ成功した head `72461a6` を GitHub のマージ（マージコミット）で取り込み、main は **`9d3314e6d2d948cefc6934a21bad97136e81a558`**。マージコミットの木は検証済み head と同じ（`70f726e`）。ローカルでマージして push する経路と強制 push は使っていない。
- 初めての GitHub Actions で、手元（Windows）では出なかった失敗が出た。原因を実測して直し、5回目で全ジョブが成功した。直した内容と原因は [M8 REPORT](docs/work/M8/REPORT.md#ci-で見つかった不具合と修正)。git 履歴を読むテストは混入していなかった（CI-01 の検出テストも全 OS で成功）。修正は別コンテキストの Opus が交差レビューし（approve with notes）、指摘のうち契約と矛盾する mtime の猶予は撤回した。
- 実行の記録：[ci-runs.json](docs/work/M8/evidence/ci-runs.json)（全ラウンドの run・job・結論・URL）、[ci-test-summary.json](docs/work/M8/evidence/ci-test-summary.json)（最終 head とマージコミットの件数と対象テストの行）。

| コミット | ワークフロー | 結果 | ジョブ |
| --- | --- | --- | --- |
| `72461a6`（PR head） | CI（pull_request）[run](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43613619394) | success | ubuntu/24・ubuntu/22・windows/24・tier-b すべて success |
| `72461a6` | CI（push）[run](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43613613909) | success | 同上 |
| `9d3314e`（main） | CI（push）[run](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43614102184) | success | 同上 |
| `9d3314e` | Pages（workflow_dispatch）[run](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43615717685) | success | build・deploy・verify すべて success |
| `9d3314e` | Runtime smoke（push）[run](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43614102329) | failure | 下記「残課題」。CI-10 により Pages とは独立 |

- 件数（各 test ジョブ）：本体 219件（pass217 / fail0 / skip2）、GUI 単体 34件（ubuntu は pass33 / skip1、windows は pass34）、e2e 42/42。skip は OS 専用のテストで、理由付き（ubuntu：MC-02 win32・R-6 win32・PowerShell 引数、windows：P-2 POSIX・R-6 linux）。
- **POSIX 分岐の初めての実行証拠（M2a・M3 の条件付き合格の解消）**：ubuntu の Node 22 と 24 で、TS-07 の8件（完了・不合格・異常終了・取り消し・時間切れ・lost・排他・detached）、TS-04 の3件、CL-11、MC-02 の5件、R-6 linux、P-2 POSIX が成功した。windows では MC-02 win32 と R-6 win32 が成功した。Tier B（ubuntu、CLI と MCP の generate → setup → validate）も成功した。

### 公開コミットでの Tier C（Windows 実機）

`c0d10ca`（M7 の Tier C）から公開コミットまでに `src/host/`（paths・processes・worker）の差分があるため、M7 の記録は引用せず取り直した（G4R2-R2）。公開コミット `9d3314e` を detached の worktree に置き、`npm ci`・`npm run build` のあと次を実行した（Windows 11、Node v24.15.0、2026-11-14 UTC）。

```powershell
node tools/runtime-smoke.mjs --entry cli --commit 9d3314e6d2d948cefc6934a21bad97136e81a558 --evidence <追跡外>/tier-c-cli.json
node tools/runtime-smoke.mjs --entry mcp --commit 9d3314e6d2d948cefc6934a21bad97136e81a558 --evidence <追跡外>/tier-c-mcp.json
```

| 経路 | 実行（UTC） | 観測結果 |
| --- | --- | --- |
| CLI | 16:10:31〜16:19:30 | setup → sound → validate → preview → still → ghost preview → final → ghost final の 8 run がすべて completed。[tier-c-cli.json](docs/work/M8/evidence/tier-c-cli.json) |
| MCP | 16:19:49〜16:26:48 | 同じ 8 run がすべて completed、protocol_errors 0。[tier-c-mcp.json](docs/work/M8/evidence/tier-c-mcp.json) |

ジョブ名は `Runtime & ＆（全角）　・ 空白`、テンプレート 0.5.2。静止画（27051 bytes、`3d737258…`）・ghost の2つの JSON・final.mp4 は CLI と MCP で同じバイト。preview.mp4 は CLI と MCP でバイトが異なった（M7 では一致。同じ機械の同時刻に別セッションのレンダーが走っており、GPU エンコーダの割り当てでソフトウェア符号化に落ちたと推定。判定には使わない）。ghost の件数は助言のまま。

### Pages の公開と公開後確認（CI-08）

GitHub Pages を「GitHub Actions」から配信する設定で有効化し、main `9d3314e` に対して Pages を手動起動した（初回デプロイ）。

1. **ワークフローの3ジョブ**：[run 43615717685](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43615717685) の build（16:27:45〜16:30:44）・deploy（〜16:30:57）・verify（〜16:31:20）がすべて `conclusion: success`。結論は API の `status: completed`・`conclusion` で確かめ、打ち切り・失敗と区別した。
2. **手元からの公開後確認**：`node tools/verify-pages.mjs https://kokuren333.github.io/Shin-MotionMaker/ --expect-commit 9d3314e6d2d948cefc6934a21bad97136e81a558 --screenshot … --output …`、2026-11-14T16:31:40Z〜16:31:49Z、終了0、1回目で合格。HTTP 200、`<title>Shin-MotionMaker</title>`、`version.json` の commit が `9d3314e…` と一致（version 0.1.0、template_version 0.5.2、built_at 16:30:37Z）、JS・CSS が 200、ヘッドレスブラウザで見出し「動画ジョブを作成」・7区画・「ジョブのZIPを生成」ボタン、コンソールエラー 0。未ログインの経路（認証なしの fetch と新しいブラウザプロファイル）。出力は [verify-pages-9d3314e.json](docs/work/M8/evidence/verify-pages-9d3314e.json)。別に `curl` でも repo のページ（200）・`version.json`・`<title>` を認証なしで取得した。
3. **公開前後のスクリーンショット**：公開 URL の画面 [pages-public-9d3314e.png](docs/work/M8/evidence/pages-public-9d3314e.png)（1440×900）を、公開前の基準 M7-gui の S1（`docs/work/M7-gui/screenshots/S1-explainer-initial-1440.png`）と比べた。SHA-256 はどちらも `3bfedde3aeda625194daeca2036212b397f4c48dbabed5c15bc5b0253bba5c0e` で、**同じバイト**（ffmpeg の SSIM 1.000000、PSNR inf）。目視でも差は無い。
4. **記録**：この節。

以上で、main `9d3314e` の公開は CI-08 の4条件を満たした。

### main への push での公開（PR #2 のマージ後）

[PR #2](https://github.com/kokuren333/Shin-MotionMaker/pull/2)（上の記録・README・`pages.yml` の push 契機）は、PR の CI 8ジョブが成功した head `efdd1ea` をマージし、main は `29382a3e293502ac8337a0ec74fcac7b0dc26d7b` になった（木は head と同じ）。run の一覧は [ci-runs-pr2.json](docs/work/M8/evidence/ci-runs-pr2.json)。

- push を契機に Pages が自動で動き、[run 43616863781](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43616863781) の build・deploy・verify がすべて success。手元の `verify-pages`（2026-11-14T16:45Z 台）も1回目で合格し、`version.json` の commit は `29382a3…`（[verify-pages-29382a3.json](docs/work/M8/evidence/verify-pages-29382a3.json)）。スクリーンショットは公開前の基準 S1 と同じバイト（SHA-256 `3bfedde3…`）。
- 同じコミットの CI（push）[run 43616863870](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43616863870) は ubuntu/22 の e2e 1件が失敗した（他の3ジョブは成功）。GU-04「request.json の読み込みは core validateRequest で検査する」が、2つ目のファイルを読み込んだ直後に、まだ画面に残っている1つ目のエラーを読んでいた（テストの待ち合わせの競合。手元と PR の CI では出ていなかった）。待ち合わせを「今回のファイルのエラー文が出るまで」に直した（この節を含む PR）。製品の挙動は変えていない。
- Runtime smoke は同じ `nvcuda.dll` の理由で失敗した（残課題）。

**版のタグ**：`v0.1.0` は、この節を含む PR のマージコミットに付ける。付ける条件は、そのコミットの main の CI（4ジョブ）と Pages（3ジョブ）の成功、手元からの `verify-pages` の合格。公開コミット `9d3314e` からの差分は文書・テスト・`pages.yml`・README だけで、実行経路（`src/`・`job-template/`・`tools/runtime-smoke.mjs`・`tools/tier-b.mjs`・依存の lock）に差分は無いので、Tier C は `9d3314e` の記録を引用する。

### 残課題（M8 時点）

- **Runtime smoke の CI（windows runner）が失敗する。** 生成ジョブの `runtime/scripts/run.mjs` が `--hardware-acceleration if-possible` を渡し、GPU の無い runner でも Remotion が `h264_nvenc` を選んで `nvcuda.dll` を読めずに変換に失敗する（`Cannot load nvcuda.dll` → `Conversion failed!`）。原典 `262c798` から引き継いだ挙動で、NVIDIA GPU の無い Windows 機の利用者でも起こりうる。`job-template/` は R1〜R5 以外を変えられないので M8 では直していない。L1 の判断（要件 §6.2 の改訂）が要る。Windows 実機（NVIDIA GPU あり）の Tier C は上記のとおり成功している。
- `readJobBytes` の再試行が「5回続けて実体が食い違えば拒否する」ことを直接確かめるテストは無い（レビューの参考指摘）。

## CPU 環境対応（要件改訂1、作業中）

要件改訂1（§6.4、JT-14〜19、CI-11）の実装を [PR #4](https://github.com/kokuren333/Shin-MotionMaker/pull/4) で検証した記録。テンプレートは **0.5.3**。詳細は [docs/work/CPU/REPORT.md](docs/work/CPU/REPORT.md)、証拠は [docs/work/CPU/evidence/](docs/work/CPU/evidence/)。

**状態：未完了。** GPU の無い runner で、レンダーは CPU の経路で通るようになったが、そのあとの `ghost-check` が別の原因（runner に ffmpeg が無く、Remotion 同梱の ffmpeg は `rawvideo` を出力できない）で失敗した。PM 判定の停止条件1に当たるので、[CPU-Q1](docs/work/CPU/QUESTIONS.md) で L1 の判断を待つ。PR #4 はマージしていないので、M8 の残課題1は**まだ解消していない**。

### GPU の無い GitHub Windows runner（C1・C2）

- PR head `a67b042a38daf75302a6b924b268d01f7a75d44c` の手動実行 [run 43642555566](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43642555566)（windows-2025-vs2026 20261103.298）：**failure**。
- CLI・MCP とも `render preview` は completed。`[encoder] route=cpu encoder=libx264 MOTION_JOB_ENCODER=auto (unset) reason: h264_nvenc test encode failed: exit code 4294967295`（試行 614ms／577ms）。`render still` も completed。各 run のログに `nvcuda` は0件。
- 次の `ghost-check --target=preview` が `Requested output format 'rawvideo' is not known` で failed（E_INTERNAL／4）。`render final` には到達していない。artifact の証拠：[runner-43642555566-cli.json](docs/work/CPU/evidence/runner-43642555566-cli.json)、[runner-43642555566-mcp.json](docs/work/CPU/evidence/runner-43642555566-mcp.json)。

### Windows 実機（GPU あり、C3〜C8）

実機は Windows 11、RTX 3080（ドライバ 610.88）、Node v24.15.0。対象コミットは `a67b042`（検証用 worktree、クリーンな木で `tools/runtime-smoke.mjs` を実行）。

| # | 実行 | 結果 | `[encoder]` の行 |
| --- | --- | --- | --- |
| C3 | Tier C、CLI、指定なし | success、162秒、8 run completed | preview・final とも `route=gpu encoder=h264_nvenc MOTION_JOB_ENCODER=auto (unset)`（試行 922ms・431ms） |
| C3 | Tier C、MCP、指定なし | success、119秒、protocol_errors 0 | preview・final とも `gpu`／`h264_nvenc`（試行 829ms・650ms） |
| C4 | Tier C、CLI、`MOTION_JOB_ENCODER=cpu` | success、144秒 | preview・final とも `route=cpu encoder=libx264 MOTION_JOB_ENCODER="cpu"` |
| C5 | `ghost-check --double-render`、指定なし | completed、25秒 | 2本目 `gpu`／`h264_nvenc`（試行 327ms） |
| C5 | `ghost-check --double-render`、`cpu` | completed、25秒、180フレーム照合で不一致0 | 2本目 `cpu`／`libx264` |
| C6 | CLI を使わず `runtime` で `$env:MOTION_JOB_ENCODER = "cpu"; npm run preview`（PowerShell）と `MOTION_JOB_ENCODER=cpu npm run preview`（Git Bash） | どちらも終了0（PowerShell 28秒） | `cpu`／`libx264` |
| C7 | `MOTION_JOB_ENCODER=nvenc` で `render --target preview`（CLI・MCP） | CLI 終了4、`ok:false`・`E_INTERNAL`（`execution_failed`）、run failed、`script_exit_code` 1。`prepare()` 前に終了。MCP も同じ | `[encoder] MOTION_JOB_ENCODER must be auto, cpu or gpu (got "nvenc"). No render was started.` |
| C8 | 試行の所要時間 | 実機 327〜922ms（レンダーの前の6回）。runner 577ms・614ms | — |

証拠：[tier-c-cli-auto.json](docs/work/CPU/evidence/tier-c-cli-auto.json)、[tier-c-mcp-auto.json](docs/work/CPU/evidence/tier-c-mcp-auto.json)、[tier-c-cli-cpu.json](docs/work/CPU/evidence/tier-c-cli-cpu.json)、[manual-c5-c7.json](docs/work/CPU/evidence/manual-c5-c7.json)、MCP の環境変数の実測 [mcp-env.json](docs/work/CPU/evidence/mcp-env.json)。

## CPU 環境対応 — C1 の解決（CPU-Q1 案A）

上の「CPU 環境対応（要件改訂1、作業中）」節の続き。その節は当時の記録として書き換えない。

### 決定と変更

- **決定**：2026-11-15 07:03、オーナーが [CPU-Q1](docs/work/CPU/QUESTIONS.md) の案A を選んだ。`runtime-smoke.yml` で、版と SHA-256 を固定した ffmpeg を取得して使う。「Tier C は既存のツールを使い、自動導入しない」（[CLI](docs/CLI.md)）の運用との整合は、**オーナーが案A を選んだことで承認済み**として扱う。製品（doctor・CLI・MCP・ジョブ）は今も ffmpeg を自動導入しない。
- **変更**：`.github/workflows/runtime-smoke.yml` に1ステップを足しただけ。製品（`job-template/`・`src/`・`gui/`・スキーマ・操作表・依存）は変えていない。
  - 取得元：gyan.dev の公式 GitHub ミラー `GyanD/codexffmpeg` の release `8.1` の `ffmpeg-8.1-essentials_build.zip`（108,771,139 バイト）。
  - SHA-256：`8748283d821613d930b0e7be685aaa9df4ca6f0ad4d0c42fd02622b3623463c6`。GitHub の asset digest と手元での取得の両方で一致した。不一致ならステップが失敗する。
  - 展開後に `-version` を表示し、`-muxers` に `rawvideo` があることを確かめる。そのうえで `FFMPEG_PATH` を設定し、bin のフォルダを PATH の先頭に足す。
  - PATH にも足す理由：MCP の検証で使う SDK の stdio クライアントは、Windows では既定の12変数（PATH を含み、`FFMPEG_PATH` は含まない）だけを子へ渡す。ジョブの `findFfmpeg`（FFMPEG_PATH → PATH → Remotion 同梱）は変えていない。
  - この build は GPLv3。CI の runner で一時的に使う外部ツールで、npm の依存・成果物・ZIP には入らないので、`NOTICE` は変えない。
  - 交差レビューの指摘で、取得に再試行（3回）を付け、進捗表示を止めた。
- **CPU-Q2**：要件 §6.2 R6 の「対象」の文言を、実装（選択・記録・import・終了時の案内）に合わせて揃えた（改訂1a）。継続実装の発注書の指示による。L2 の確認と L1 の追認を待つ。実装は変えていない。

### GPU の無い GitHub Windows runner（C1・C2）

- PR head `44a0dda0116efafb618ca6bdc1343c1d9fcbb21e` の手動実行 [run 43646343947](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43646343947)：**success**。Runner Image は 20261103.298.1。
- 所要時間：ffmpeg の取得ステップが5秒（`ffmpeg version 8.1-essentials_build-www.gyan.dev`）。CLI は 22:07:28〜22:09:17、MCP は 22:09:17〜22:11:04（UTC）。
- 結果：CLI・MCP とも、setup → sound → validate → preview → still → ghost preview → final → ghost の8 run がすべて completed。protocol_errors は 0、各 run のログの `nvcuda` は 0件。ghost の件数は 0（助言）。
- preview と final の `[encoder]` の行（CLI・MCP とも同じ形）：`route=cpu encoder=libx264 MOTION_JOB_ENCODER=auto (unset) reason: h264_nvenc test encode failed: exit code 4294967295`。試行は CLI が 584ms・560ms、MCP が 584ms・562ms。
- 証拠：artifact 14133907579（sha256 `83d8a932…`）から、[runner-43646343947-cli.json](docs/work/CPU/evidence/runner-43646343947-cli.json) と [runner-43646343947-mcp.json](docs/work/CPU/evidence/runner-43646343947-mcp.json)。

これで **C1（CI-11）を満たした**。C2 も、preview と final の両方の行で満たした。

### Windows 実機（GPU あり）の取り直し

- 対象：`ff26214`（`44a0dda` に文書だけを足したコミット）。検証用の detached worktree で `npm ci`・`npm run build` のあと、クリーンな木で `tools/runtime-smoke.mjs` を実行した（Windows 11、RTX 3080、ドライバ 610.88、Node v24.15.0）。
- 手元の PATH の ffmpeg は 9.0.2（gyan.dev、scoop）。
- 以後の PR head との差分は、`runtime-smoke.yml`（取得の再試行）と文書だけ。実行経路（`src/`・`job-template/`・`tools/`・依存の lock）は同じ。

| 経路 | 実行（UTC） | 結果 | `[encoder]` の行 |
| --- | --- | --- | --- |
| CLI、指定なし | 22:10:56〜22:16:19 | success、8 run completed（setup は新しい worktree の依存導入で 140秒） | preview・final とも `route=gpu encoder=h264_nvenc MOTION_JOB_ENCODER=auto (unset)`（試行 1361ms・539ms） |
| MCP、指定なし | 22:16:35〜22:19:03 | success、8 run completed、protocol_errors 0 | preview・final とも `gpu`／`h264_nvenc`（試行 823ms・341ms） |
| CLI、`MOTION_JOB_ENCODER=cpu` | 22:19:10〜22:21:19 | success、8 run completed | preview・final とも `route=cpu encoder=libx264 MOTION_JOB_ENCODER="cpu" reason: probe skipped (set explicitly)` |

証拠：[tier-c-ff26214-cli-auto.json](docs/work/CPU/evidence/tier-c-ff26214-cli-auto.json)、[tier-c-ff26214-mcp-auto.json](docs/work/CPU/evidence/tier-c-ff26214-mcp-auto.json)、[tier-c-ff26214-cli-cpu.json](docs/work/CPU/evidence/tier-c-ff26214-cli-cpu.json)。

### CI の不安定なテスト（参考）

`44a0dda` の push の CI（[run 43646337055](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43646337055)）で、ubuntu/22 の TS-07「lost derivation is read only and stale lock recovery checks process existence」が1回失敗した（`'running' !== 'lost'`、`tests/host-run.test.ts:123`）。同じコミットの PR の CI（run 43646341698）では成功しており、このコミットの差分は workflow だけである。完了直後の worker の PID がまだ生きているか、再利用されると起きる、既存のテストの競合と推定した。失敗したジョブだけを再実行し、成功した（同じ run の attempt 2。ubuntu/22 は 22:13:14〜22:16:07 で success、run 全体が success）。テストは変えていない。

### M8 の残課題1

M8 の残課題1（「Runtime smoke の CI（windows runner）が失敗する」）は、PR #4 を main にマージし、main の push で `runtime-smoke.yml` が成功した時点で解消とする。マージ後の main の run は、後続の PR でこの節の続きとして記録する。

### PR #4 のマージと main の push

- PR head `9bb143d1864b6e81dd6236b4d96d8bafa048a7e1` で、CI（[PR run 43647846207](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43647846207)・[push run 43647843379](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43647843379)）の全8ジョブと、Runtime smoke の手動実行 [run 43647851377](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43647851377) が success だった。runtime smoke では CLI・MCP とも8 run completed、preview・final は `cpu`／`libx264`（試行 588・559ms／568・550ms）。
- 同じ head の ci-local（`node tools/ci-local.mjs`、深さ1の複製）も終了0だった。本体 227件（pass225 / fail0 / skip2）、GUI 単体 34件（pass34）、e2e 42/42、GUI ビルド。生ログは追跡外で、SHA-256 は `4c5a9dfe97dd40a4ec4c8b2289e1ac76d54a111f5e483065b76773b1a8e1e392`。
- 交差レビューの判定：approve with notes。指摘への対応は [REPORT](docs/work/CPU/REPORT.md#交差レビュー継続実装)。
- [PR #4](https://github.com/kokuren333/Shin-MotionMaker/pull/4) は GitHub のマージ（マージコミット）で取り込み、head の SHA を指定した。main は **`5b9558c576cc00ab28869b83ddd8a8b37902d6e2`** になった。マージコミットの木（`a3e74fd`）は検証済みの head と同じ。ローカルでのマージと強制 push は使っていない。

main の push での実行（すべて `status: completed`、`conclusion: success`）：

| ワークフロー | run | ジョブ |
| --- | --- | --- |
| CI | [43648499517](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43648499517) | ubuntu/24・ubuntu/22・windows/24・tier-b すべて success |
| Pages | [43648499515](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43648499515) | build（22:31:07〜22:34:27）・deploy（〜22:34:46）・verify（〜22:35:25）すべて success |
| Runtime smoke | [43648499601](https://github.com/kokuren333/Shin-MotionMaker/actions/runs/43648499601) | success。CLI（22:31:36〜22:33:02）・MCP（22:33:05〜22:34:51）とも8 run completed、protocol_errors 0、`nvcuda` 0件。preview・final は `route=cpu encoder=libx264 MOTION_JOB_ENCODER=auto (unset)`（試行 567・552ms／566・549ms）。[runner-43648499601-cli.json](docs/work/CPU/evidence/runner-43648499601-cli.json)、[runner-43648499601-mcp.json](docs/work/CPU/evidence/runner-43648499601-mcp.json) |

- **手元からの公開後確認**：次のコマンドを 2026-11-14T22:36Z 頃に実行し、終了0、1回目で合格した。

  ```
  node tools/verify-pages.mjs https://kokuren333.github.io/Shin-MotionMaker/ --expect-commit 5b9558c576cc00ab28869b83ddd8a8b37902d6e2 --screenshot … --output …
  ```

  - `version.json` の commit は `5b9558c…` と一致した（version 0.1.0、template_version **0.5.3**、built_at 22:34:21Z）。
  - JS・CSS が取得できた。見出し「動画ジョブを作成」・7区画・「ジョブのZIPを生成」ボタンがあり、コンソールエラーは 0。
  - 出力は [verify-pages-5b9558c.json](docs/work/CPU/evidence/verify-pages-5b9558c.json)。
- **公開前後のスクリーンショット**：公開 URL の画面（1440×900）の SHA-256 は `3bfedde3aeda625194daeca2036212b397f4c48dbabed5c15bc5b0253bba5c0e`。公開前の基準 M7-gui の S1 と**同じバイト**だった。

**M8 の残課題1は、これで解消した。** GPU の無い GitHub Windows runner で、main の push の Runtime smoke が CLI・MCP の両経路とも成功した（CI-11）。M8 の残課題2（`readJobBytes` の再試行のテスト）は残っている。

### 版 0.1.1 とタグの条件

- この節を含む PR で、`package.json`・`package-lock.json`（ルート）・`src/core/data/version.ts` の `PACKAGE_VERSION` を **0.1.1** に上げる。版を表明するテスト `tests/cli.test.ts` も合わせる。
  - テンプレートの版（0.5.3）とスキーマは変えない。
  - `gui/package.json`（非公開の workspace、0.1.0）は変えない。画面の版の表示は core の `PACKAGE_VERSION` を使う。
- **タグ `v0.1.1` は、この PR のマージコミットに付ける。** 付ける条件は、そのコミットの main の push で次がすべて成功し、手元からの `verify-pages` が合格していること（CI-11）。
  - `ci.yml`（4ジョブ）
  - `pages.yml`（3ジョブ。公開後確認 CI-08 を含む）
  - `runtime-smoke.yml`
- タグと push は、オーナーの承認の範囲で行う。実装担当はタグを付けていない。
