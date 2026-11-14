# M4 REPORT — GUI（テーマ・原典機能の移植・request.json・検査結果の表示・CLI/MCP 区画）

以下は実装と実行の証拠である。受け入れの判定は L2 と、別途発注される実装者以外のレビューに委ねる。

## 起動時の確認

- 層：L3（見た目・文面の担当）。L4 サブエージェントは使っていない。自己判定になるゲートは設けていない。
- 作業ツリー：`Shin-MotionMaker-wt/m4`、ブランチ `m4-gui`。着手時 HEAD `288b0ab`（M1 マージ後の main。M5 のアイコンを含む）、作業ツリーはクリーン。
- 環境：Windows 11、Node v24.15.0、npm 11.12.1。Chrome と Edge が既にある（インストールはしていない）。
- 読んだもの：REQUIREMENTS §0〜§3、§4.1〜4.3、§7、§8、§9.2、§10〜§12、ルート AGENTS.md、CONTRACT.md 全文、M1・M5 の REPORT、原典 262c798 の `src/App.tsx`・`src/style.css`・`src/main.tsx`・`src/templates.ts`・`index.html`・`docs/DESIGN.md`・UI-11（要件書 L356 付近）・Amendment 01・03・`tools/ui-shots.mjs`（既存の読み取り用スクラッチの複製から読んだ）、CyberSprite の `gui/src/theme/tokens.css` と `gui/scripts/demo-check.mjs`。
- 原典 repo・CyberSprite には書き込んでいない。CyberSprite では `git show 20f787d:…` と `git diff 20f787d a00433c -- gui/src/theme/tokens.css`（差分なし）の読み取りだけを行った。

## 実装したもの

| 項目 | 内容 | 主なファイル |
| --- | --- | --- |
| 1 `gui/` ワークスペース | React 19.2.4・react-dom 19.2.4・jszip 3.10.1（原典と同じ版）。開発依存は vite 7.3.8・@types/react 19.2.14・@types/react-dom 19.2.3 だけ。e2e は依存を足さず、Node 組み込みの WebSocket で既存の Chrome / Edge を CDP で操作する（原典 `tools/ui-shots.mjs` の方式）。バックエンド・外部 CDN・入力の永続化なし | `gui/package.json`、`gui/vite.config.mjs`、`gui/tsconfig.json` |
| 2 テーマ | CyberSprite `20f787d` の `tokens.css` を1バイトも変えずに第1部として埋め込み、通常・高コントラストの両ブロックを持つ。第2部は Biim 枠の出力仕様の4色だけ（`biim-standard.json` と `createProject` の値とテストで照合）。`style.css` に色の直値は無い | `gui/src/theme/tokens.css`、`gui/src/style.css`、`tests/fixtures/cybersprite-tokens-20f787d.css` |
| 3 原典機能の移植 | 原典 `App.tsx` を部品に分けて移植。生成・検査・候補・統計・project はすべて `src/core` を呼び、ロジックを再実装しない。添付の MIME は `mimeTypeFor`（`File.type` は使わない）。テンプレートは Vite の glob＋core の `includeTemplatePath`、フォントは Vite が出力した資産を SHA-256 で確かめて読む | `gui/src/App.tsx`、`gui/src/templates.ts`、`gui/src/components/*` |
| 4 request.json | 書き出し（`<タイトル>.request.json`、`{form, assets}`、添付はファイル名だけ）と読み込み（BOM 可、core `validateRequest` の shape、エラーは pointer つきで字幕帯に表示、添付は選び直しを案内）。ZIP 生成前の検査も `validateRequest` の complete を通す | `gui/src/lib/request-io.ts`、`AgentEntrances.tsx`、`App.tsx` |
| 5 検査結果の表示 | validate・qc-pre・qc-post・ghost-check・ghost-check-preview の JSON、run.json、静止画 PNG を、選択またはドロップで読む。ゲートと助言を別の区画に分け、助言は中立の様式だけで出す。`review_mode: self` と免除を明示 | `gui/src/lib/inspection.ts`、`InspectionViewer.tsx` |
| 6 CLI・MCP の区画 | 現在のタイトルから決まる request.json 名での `smm generate <file> --out jobs`（`--zip` の説明つき）、クライアントに依らない stdio の登録例、README・docs/CLI.md・docs/MCP.md へのリンク、コピー | `gui/src/lib/commands.ts`、`AgentEntrances.tsx` |
| 7 たたき台 | 「たたき台 A〜C」と表示、既定で何も選ばない、「この案を追記」したときだけデザイン方向性に入る、「別の組み合わせ」は毎回 `crypto.getRandomValues` の新しい seed。様式モードは同じ大きさの4枚のラジオカード | `App.tsx` |
| 8 アイコン | M5 の26点を文字ラベルと並べて使う（`DESIGN.md` §2.1 の表）。字幕帯（Biim 枠の黒地）のアイコンは明るいチップに載せる。アイコンの変更・追加なし。NOTICE のテーマトークンの行を記入 | `PixelIcon.tsx`、`NOTICE` |
| 9 表示名と版 | `Shin-MotionMaker`、「制作エージェント」。`version.json`（`version`・`template_version`・`commit`・`built_at`）をサイトのルートに書き、情報ダイアログに同じ値を出す。commit は `--commit`・`SMM_COMMIT`・`GITHUB_SHA` の順で受け、どれも無いときだけビルドスクリプトが `git rev-parse HEAD` を使う | `gui/scripts/build.mjs`、`gui/scripts/site.mjs`、`InfoDialog.tsx` |
| 10 Pages 用ビルド | `base: "./"` で全資産を相対参照。e2e が `/Shin-MotionMaker/` の下だけで配信して確かめる | `gui/vite.config.mjs`、`gui/e2e/browser.mjs` |
| 11 アクセシビリティ | コントラストをトークンから機械検査（両テーマ）し、さらに e2e で描画後の全文字の色と実際の背景色を両テーマで検査。キーボード到達とフォーカス輪郭、390px、1440×900、`prefers-reduced-motion`、高コントラスト表示の切り替え | `gui/tests/contrast.test.ts`、`gui/e2e/run.mjs` |
| 12 DESIGN.md | 原典 DESIGN.md を出発点に、差分（表示名、追加の区画、アイコン、助言の見せ方、高コントラスト）を記述 | `docs/DESIGN.md` |
| 13 スクリーンショット | 13枚を `docs/work/M4/screenshots/` に置き、`VERIFICATION.md` に記録 | `gui/e2e/shots.mjs` |

## GU-02 の対応表（項目 → e2e のテスト名）

テストはすべて `gui/e2e/run.mjs` にあり、名前の先頭で検索できる。

| GU-02 の項目 | テスト名 |
| --- | --- |
| 制作モードの切り替えとモード別の指示・デザイン文の保持 | `GU-02 制作モードの切り替えとモード別の指示・デザイン文の保持` |
| 様式モードの選択 | `GU-02 様式モードの選択（4様式を同格のラジオで並べ、縦向きでは混在を選べない）` |
| 全入力欄 | `GU-02 全入力欄（解説モードの全キーを画面から入力し request.json と一致する）`、`GU-02 全入力欄（MV の追加キー：曲の雰囲気・歌詞・差別化メモ・音源尺）` |
| MV での非表示項目 | `GU-02 MV での非表示項目（04・05・詳細を出さず目次は01〜03）` |
| 参考資料のドラッグ＆ドロップ・選択・削除 | `GU-02 参考資料のドラッグ＆ドロップ・選択・削除（件数と容量の表示）` |
| 完成音源・BGM・GLB の添付と音源尺の確認 | `GU-02 完成音源・BGM・GLB の添付と音源尺の確認` |
| 方向性のたたき台と差別化メモ（両モード） | `GU-02 方向性のたたき台と差別化メモ（両モード、既定で選択せず追記したときだけ入る）` |
| 歌詞統計・台本統計 | `GU-02 歌詞統計・台本統計` |
| 準備度一覧（両モード） | `GU-02 準備度一覧（両モード）` |
| 素材生成の設定 | `GU-02 素材生成の設定` |
| キャラクター設定と字幕色 | `GU-02 キャラクター設定と字幕色（1人・2人、配置、HEX、字幕帯への即時反映）` |
| Aivis 設定 | `GU-02 Aivis 設定（URL・Style ID とプリセット名・話速、音声なしで非表示）` |
| 解像度・向き・fps | `GU-02 解像度・向き・fps` |
| レイアウト図・同梱ファイル・JSON の表示 | `GU-02 レイアウト図・同梱ファイル・JSON の表示` |
| 必須項目のエラー表示とフォーカス移動 | `GU-02 必須項目のエラー表示とフォーカス移動` |
| ZIP 生成と進捗 | `GU-02 ZIP 生成と進捗（AR-06：GUI の ZIP と core＋Node 読みのジョブが同じバイト、解説・添付あり）`、`GU-02 ZIP 生成と進捗（AR-06：MV・完成音源あり）` |
| 指示のコピー | `GU-02 指示のコピー` |
| 失敗パターン一覧（両モード） | `GU-02 失敗パターン一覧（両モード）` |
| ゴースト検査結果の読み込みと静止画表示 | `GU-02 ゴースト検査結果の読み込みと静止画表示` |
| サンプル入力 | `GU-02 サンプル入力` |
| 情報ダイアログ | `GU-02 情報ダイアログ（同梱物・データの扱い・制作環境・参考元、Escape で閉じる）` |

進捗の表示（ボタンの「ZIPを生成中… n%」と `<progress>`）は ZIP 生成の2件で通過するが、生成が速いため途中の値は表明していない（原典と同じ `zipJobFiles` の進捗コールバックをそのまま使う）。

## 受け入れ条件ごとの状態と証拠

| 条件 | 状態 | 証拠 |
| --- | --- | --- |
| TS-08 単体テスト | 実行して合格 | `npm run test:unit --workspace gui`：tests 27 / pass 27 / fail 0 |
| TS-08 トークンの写しが正本と一致 | 実行して合格 | `gui/tests/theme.test.ts` の3件。フィクスチャ `tests/fixtures/cybersprite-tokens-20f787d.css`（SHA-256 `d52b8cd592ae88b681567834c8833ce35caa6fc49047dd54a7bffe54f73af1f3`）は `git show 20f787d:gui/src/theme/tokens.css` の出力で、`a00433c` の同ファイルとバイト一致 |
| TS-08 色の直値が tokens.css の外に無い | 実行して合格 | `theme.test.ts` の「no colour literal outside tokens.css」と、検出器自体の陽性テスト。例外は `index.html` の theme-color（= `--cs-board`）だけ |
| TS-08 コントラスト | 実行して合格 | `gui/tests/contrast.test.ts`：通常・高コントラストの各13組と Biim 枠3組が 4.5:1 以上。e2e `GU-16 描画後の文字のコントラスト 4.5:1 以上（normal／high、…）`：入力済み・検査結果ありの画面で、表示中の全文字（Biim 枠のプレビューと利用者の字幕色を除く）が 4.5:1 以上 |
| TS-08 e2e（GU-02 全項目、request.json の往復、検査結果、サブパス、390px） | 実行して合格 | `npm run test:e2e --workspace gui`：37 件合格 / 37 件 |
| AR-06・GU-03 GUI の ZIP と CLI 経路のバイト一致 | 実行して合格 | 上の ZIP 生成2件。GUI が書き出した request.json を Node 側で `validateRequest` → `tests/helpers/templates.ts` の `loadAssets`・`loadTemplates`（ファイルシステム読み）→ `buildJobFiles` に通し、ブラウザでダウンロードした ZIP を展開して、パスの集合と各ファイルのバイトを全件比較。添付は .md・.csv・.pdf・.png・.glb×2・BGM（解説）と .txt・完成音源（MV） |
| テストで git を起動しない | 実行して合格 | ルートの `tests/no-git.test.ts`（`gui/` 全体を走査）。e2e はビルドに固定の commit を渡す。例外に足したのは開発用の `gui/scripts/build.mjs` だけ |
| ルート `npm test` | 実行して合格 | tests 123 / pass 113 / fail 0 / todo 10（todo は M1 からの既存分） |
| `npm test --workspaces --if-present`・`npm run build --workspaces --if-present` | 実行して合格 | 下の ci-local の記録 |
| `node tools/ci-local.mjs` | 実行して合格 | 下の記録 |
| スクリーンショットの記録 | 済み | `VERIFICATION.md` の M4 節、`docs/work/M4/screenshots/` の13枚 |
| 実装者以外のレビュー | 未実施 | L2 が別途発注する |

### ci-local

| 複製したコミット | 結果 |
| --- | --- |
| `49f5b94827f768e74274896246fba02cddca665c`（GUI の実装とテスト） | exit 0。深さ1の複製で `npm ci`（監査は esbuild の low 1件）→ `npm run build` → `npm test`（tests 123 / pass 113 / fail 0 / todo 10）→ `npm test --workspaces --if-present`（単体 27/27、e2e 35/35）→ `npm run build --workspaces --if-present`。「CI と同じコマンドが完了しました」 |
| `6471c8cf3428d28b31c1c139669af603772e1c6e`（文書を含む最終の内容。この行を足したコミットは REPORT だけを変える） | exit 0。同じ手順で `npm test`（tests 123 / pass 113 / fail 0 / todo 10）、単体 27/27、e2e 37/37、ワークスペースのビルド成功。「CI と同じコマンドが完了しました: 6471c8c…」 |

## テストのコマンドと結果

| コマンド | 結果 |
| --- | --- |
| `npm run build`（ルート、`tsc --noEmit`） | exit 0 |
| `npm test`（ルート） | exit 0。tests 123 / pass 113 / fail 0 / todo 10 |
| `npm run build --workspace gui`（`tsc -p gui` → `scripts/build.mjs`） | exit 0。`gui/dist/` に index.html・assets（JS 697 KB、CSS 30 KB、フォント2点）・icons・favicon.png・version.json |
| `npm test --workspace gui`（単体 → e2e） | exit 0。単体 27/27、e2e 37/37 |
| `npm run shots --workspace gui -- --commit=28c71915807917421038b976e86c3f3df15fbcb2` | 13枚、すべて横あふれ 0・コンソールエラー 0 |

e2e の実行時間は手元で約 30 秒（ビルド込み）。

## 原典から変えた見た目と理由

| 変えたところ | 原典 | Shin-MotionMaker | 理由 |
| --- | --- | --- | --- |
| 表示名・版 | `BiimMotion`、`BiimMotion · v0.1` | `Shin-MotionMaker`、`v0.1.0`（core の版） | GU-13・GU-14 |
| favicon | SVG のデータ URI（直値4色） | M5 の `app` アイコンの PNG | GU-11。`index.html` の色の直値が theme-color だけになる |
| 制作モード | 選択欄 | アイコンつきの2つのラジオ | GU-10 のモードアイコンを文字と並べるため。挙動は同じ |
| 様式モード | 選択欄＋説明一覧（Biim に「既定」の札） | 同じ大きさの4枚のラジオカード、注記で「既定であって必須ではない」 | GU-07（同格に並べる） |
| たたき台の札 | 案 A〜C | たたき台 A〜C、「どれも選ばれていません」 | GU-07・PH-04 |
| ゴースト検査の要約・解説入力の注意・統計の強調 | `--ui-warn-bg`＋`--cs-warn` | 中立の助言の様式（`--cs-pad`＋`--ui-on-line`＋`advisory`） | PH-03（下の節） |
| ゴースト検査の区画 | 「レンダーゴースト検査の結果」 | 「検査結果を見る」（validate・QC・run も） | GU-05 |
| 右下ノート | 3タブ、指示、失敗パターン、ゴースト | 3タブ、指示、**CLI・MCP から生成する**、失敗パターン、検査結果 | GU-04・GU-06 |
| アプリバー | 表示名、作業名、データの一言、について、版 | 表示名の前に `app`、**request.json を読み込む** を追加 | GU-04。目次の行を原典と同じ1行に保つため、読み込みをアプリバーに置いた |
| 字幕帯のアイコン | Biim 枠の黒地に直接 | 明るいチップに載せる | M5 の申し送り（暗い面で ink が消える） |
| 情報ダイアログ | 同梱物・データ・環境・参考元 | 上に加えて版・テンプレート版・コミット・ビルド日時、文書リンク、高コントラスト表示 | GU-14・GU-06・GU-16 |
| 高コントラスト | 取り込まない | 正本の `data-contrast="high"` を取り込み、OS 設定と情報ダイアログで切り替え | GU-16 の補強。正本の値をそのまま使う |
| 文言 | 「このWebUIは…」 | 「この画面は…」、「検査も行いません」を追記 | 表示名の統一と §7.1（GUI は検査を実行しない） |

## PH-03 の扱い（助言の見せ方）

- 検査結果のカードは「ゲート（合否）」と「助言（合否・終了コードに影響しません）」の2区画に分け、助言の区画をゲートの区画の中に置かない。
- 不合格の色（`--ui-error-bg`・`--cs-error`）と `error` アイコンはゲートの不合格と run の異常終了だけに使う。警告の色（`--ui-warn-bg`・`--cs-warn`）と `warning` アイコンは、字幕帯の「必須項目または設定に不足があります」（構造の検査。生成を止める客観的な条件）だけに使う。
- 助言は `--cs-pad` の地・`--ui-on-line` の左線・`advisory` アイコンだけで出す。e2e が、助言の区画の背景・左線・文字の計算後の色が4つの不合格・警告の色のどれとも一致しないこと、助言の区画のアイコンが `advisory.png` だけであることを表明する。
- ゴースト検査の件数と原典 `ghostCheckVerdict` の文言（「要注意：…」）は助言の区画に出し、ゴースト検査のカードにはゲートの区画を置かない（e2e と単体テストで表明）。
- `review_mode: self` は「自己レビュー。制作したエージェント自身が確認した記録で、独立したレビューではありません」と明示する。免除は「オーナーだけが出せる」と書いて列挙し、無ければ「免除：なし」と書く。
- run.json は実行の状態（completed・failed など）とゲートの判定（`result.verdict`）を別の行に出す。completed でも判定が不合格になりうることを e2e で確かめた。
- 判定はし直さない。読み取りは core の `parseInspectionReport`・`parseGhostCheckReport` だけ。

## 決定

- **D1 e2e は依存なしの CDP 方式。** `@playwright/test` はブラウザのダウンロードを伴い（外部ツールの自動インストールにあたりうる）、依存も増えるため、原典 `tools/ui-shots.mjs` の方式（既存の Chrome / Edge を DevTools Protocol で直接操作）を `gui/e2e/browser.mjs` に移した。ブラウザは `CHROME_PATH` か既定の場所から探す。
- **D2 ブラウザが無い環境では e2e を失敗にする（スキップしない）。** `npm test --workspace gui` が単体テストのあとに e2e を実行し、ブラウザが見つからなければ理由と `CHROME_PATH` の案内を出して終了コード1で終える。GitHub の ubuntu-latest・windows-latest のランナーには Chrome が入っている。単体だけを回す `test:unit` と e2e だけの `test:e2e` も置いた。
- **D3 ビルドは `scripts/site.mjs`（git に触れない本体）と `scripts/build.mjs`（commit を決める入口）に分けた。** e2e とスクリーンショットは `site.mjs` に固定の commit を渡す。`tests/no-git.test.ts` の除外に `gui/scripts/build.mjs` を足した（開発用の道具であり、テストではない）。
- **D4 ルートの `tsconfig.json` の include から `gui/**/*.ts` を外した。** GUI は Vite の型（`import.meta.glob`）を使うので、`gui/tsconfig.json` で検査する（`npm run build --workspace gui` が `tsc -p` を先に実行する）。AR-03 の import 検査は従来どおり `gui/` を走査する。
- **D5 vite は 7.3.8。** 原典は 7.3.1 だが、7.3.1 には開発サーバーの既知の脆弱性（npm audit で high）があり、開発依存は版の指定が無いので修正版を固定した。実行時依存3つは原典と同じ版。`npm audit` に残るのは esbuild 0.27.7 の開発サーバーの low 1件で、ビルドだけに使い開発サーバー機能（esbuild serve）は使わない。
- **D6 request.json の名前は `<safeName(タイトル)>.request.json`（タイトルが空なら `request.request.json`）。** form は既定値を含む全キーを書き出す（CLI と MCP が受ける形のまま、読み込み後の値が一意に決まる）。同じ名前の添付が複数あるときは区画に注記する。
- **D7 たたき台の引き直しは毎回新しい乱数の seed にした。** 原典は線形合同法で seed を進めていたが、seed を固定しない（PH-06）ことが要件であり、core の `crypto.getRandomValues` の作り方に揃えた。
- **D8 高コントラストのトークンも取り込んだ。** GU-08 の「通常と高コントラスト」を写すことに合わせ、切り替えの手段（OS 設定と情報ダイアログ）を置いた。
- **D9 文書へのリンクは `https://github.com/kokuren333/Shin-MotionMaker/blob/main/` 以下。** repo の公開（M8）と `docs/CLI.md`・`docs/MCP.md`・`README.md` の作成（M2b・M3・M6）までは 404 になる。
- **D10 塗った項目の文字には役割トークン `--ui-ph-text-on` を使う。** 原典は目次の現在地と選択中のタブの文字を `--ui-text` のままにしていた。原典は高コントラストを取り込まなかったので表に出なかったが、高コントラストでは塗り（`--ui-ph-bg-on`）も文字も ink になり読めなくなる。S11 の撮影で見つけて `28c7191` で直し、描画後のコントラストの e2e を足した（直す前のスタイルで失敗することを確かめた）。

## 質問

契約（CONTRACT・操作定義表・封筒スキーマ）と要件を変える必要は生じなかった。`QUESTIONS.md` は作っていない。L2 に確認してほしい点を次に挙げる（作業は止めていない）。

1. GU-06 のコマンド例は REQUIREMENTS §4.1 と CONTRACT §3（`out` は出力先の親ディレクトリ）に合わせて `smm generate <file>.request.json --out jobs` とした。M2b の実装と食い違えば L2 の調整に従う。
2. M1 の REPORT が M2a に移送した「独立したホスト・ブラウザのテンプレート比較」のうち、ブラウザ側（Vite の glob とファイルシステム読みの差）は M4 の e2e（AR-06 の2件）で実測した。M2a の host 側の比較とは別物として扱ってよいか。

## 残課題

- Linux と Node 22 では e2e を手元で実行していない（CI で初めて実行される）。Linux では `--no-sandbox` を付けて起動する。
- 公開 URL での確認（CI-07 の `tools/verify-pages.mjs`）は M8 の範囲。
- 実装者以外のレビューは L2 が発注する。
- アイコンの追加の要望はない（M5 への追加発注なし）。
