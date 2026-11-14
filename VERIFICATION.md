# VERIFICATION — 公開と検証の証拠

この文書は検証の証拠の記録である。記録はオーナーの目視を待つ関門ではない（REQUIREMENTS GU-17、原典 Amendment 01 AM-1）。公開（M8）の記録は CI-08 の4条件に従って後から足す。

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
