# VERIFICATION — 公開と検証の証拠

この文書は検証の証拠の記録である。記録はオーナーの目視を待つ関門ではない（REQUIREMENTS GU-17、原典 Amendment 01 AM-1）。公開（M8）の記録は CI-08 の4条件に従って後から足す。

## M4 GUI のスクリーンショット（GU-17）

- 対象：Pages 用ビルド（`gui/scripts/site.mjs`、`base: "./"`）。コード上のコミット `28c71915807917421038b976e86c3f3df15fbcb2`（ビルドに `--commit` で埋め込み、情報ダイアログと `version.json` に出る）
- 配信：`gui/e2e/shots.mjs` がビルドを一時フォルダに作り、ローカルの静的サーバーで **`/Shin-MotionMaker/` の下だけ**に配信した（GitHub Pages のプロジェクトサイトと同じサブパス）
- ブラウザ：手元の Chrome をヘッドレス（`--headless=new`、`--force-color-profile=srgb`、`deviceScaleFactor: 1`）で DevTools Protocol から操作
- 環境：Windows 11、Node v24.15.0、2026-11-14
- 実行：`npm run shots --workspace gui -- --commit=28c71915807917421038b976e86c3f3df15fbcb2`
- 結果：13枚。すべて横あふれ 0px、コンソールエラー 0 件（スクリプトの出力で確認）

| # | 状態 | 画面 | ファイル（`docs/work/M4/screenshots/`） | SHA-256 |
| --- | --- | --- | --- | --- |
| S1 | 解説モードの初期表示。01 の制作モード・タイトル・説明・視聴者・希望尺がスクロールなしで見える | 1440×900 | `S1-explainer-initial-1440.png` | `3bfedde3aeda625194daeca2036212b397f4c48dbabed5c15bc5b0253bba5c0e` |
| S1m | MV モードの初期表示（目次は 01〜03） | 1440×900 | `S1m-mv-initial-1440.png` | `339ec088c59fa9177b7108f5aa32678749e555a8a7046f19b05e0295ac8004a5` |
| S2 | 解説モードの入力済み。方向性のたたき台（どれも選ばれていない）と差別化メモ | 1440×900 | `S2-explainer-filled-direction-1440.png` | `173b7cac534a609ed94ef1dd9d69a329864097cc043980248c72680276fe785f` |
| S3 | MV モードの入力済み（完成音源 30 秒、歌詞、たたき台、準備度） | 1440×900 | `S3-mv-filled-1440.png` | `cb78d2b656b93ae1bbe7142d34285471f5d2324a26f6cb16728262592f7811f4` |
| S4 | エラー：必須未入力で ZIP 生成を押した状態（字幕帯のエラーの要約にフォーカス） | 1440×900 | `S4-required-missing-error-1440.png` | `f8a60db965b99509fa1c56653a0010c1c99a6861f344d03d964e2f7f65d1bdec` |
| S5 | 検査結果の表示：QC 事前ゲート（不合格、`review_mode: self` の明示、免除、ゲートの表）。助言は別区画 | 1440×900 | `S5-inspection-results-1440.png` | `8662dcf4656c97452909482e3a86d7dec226ad1a1b44eadb8c2cdc354f8eb73f` |
| S5b | 検査結果の表示：ゴースト検査（ゲートの区画なし、件数は助言の区画）と静止画 | 1440×900 | `S5b-inspection-ghost-stills-1440.png` | `2527f19d3945812191e207e85caef1b9adc12d0d6904e73d43c846ca58afdf94` |
| S6 | 情報ダイアログ（版・テンプレート版・コミット・ビルド日時、文書、表示） | 1440×900 | `S6-info-dialog-1440.png` | `41758541dee9b8e576fac7239e523f77df4001349f3e8a4de384f326846c38d7` |
| S7 | 幅 390px、解説モード | 390×844 | `S7-explainer-390.png` | `963204276e8fc827b6aed4f0fa0e6539ae57ca69b99d130a0848e56264181678` |
| S8 | 幅 390px、MV モード | 390×844 | `S8-mv-390.png` | `be320eabfdad51036e8429f6dcc92722386473c911a5033218dbdbb500e38c97` |
| S9 | CLI・MCP の区画（request.json の書き出し、generate のコマンド例、MCP の登録例） | 1440×900 | `S9-cli-mcp-request-1440.png` | `865fed6d6c053a0c529e54e6e2877d57ac697fcbf1243f69fa8cd748eb717a8c` |
| S10 | request.json を読み込んだ状態（置き換えの通知と、選び直す添付ファイルの名前） | 1440×900 | `S10-request-imported-1440.png` | `3cb40794bb8f291a03950f3f43a21761807958ae4aaf22068ced847c011ec3bc` |
| S11 | 高コントラスト表示（正本の `data-contrast="high"` のトークン） | 1440×900 | `S11-high-contrast-1440.png` | `b5140931bdb0b0ea098d870baf1749d22dc5df73b3ad60fadd5bb06d998d9028` |

S11 の撮影で、目次の現在地と選択中のタブの文字が高コントラストの塗り（ink）と同じ色になる不具合を見つけ、`28c7191` で直した（文字に役割トークン `--ui-ph-text-on` を使う）。同じ不具合を検出する e2e（描画後の全文字のコントラスト、通常・高コントラストの両方）を足し、直す前のスタイルで失敗し、直した後で合格することを確かめた。

## M4 GUI の機械検査

| 検査 | コマンド | 結果 |
| --- | --- | --- |
| 単体（トークン・色の直値・形・コントラスト・request.json・検査結果・コマンド例） | `npm run test:unit --workspace gui` | 27 / 27 合格 |
| e2e（GU-02 全項目、request.json の往復、検査結果、サブパス、390px、キーボード、`prefers-reduced-motion`、描画後のコントラスト、GUI と Node の ZIP のバイト一致） | `npm run test:e2e --workspace gui` | 37 / 37 合格 |

GU-02 の項目と e2e のテスト名の対応は `docs/work/M4/REPORT.md` にある。
