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
| AR-06・GU-03 ブラウザの ZIP と core＋Node のファイルシステム読みのバイト一致（M4-fix で記述を訂正。実 CLI・MCP との比較ではない） | 実行して合格（証拠の範囲はブラウザ対ファイルシステム読み＋core の2ケース。host・CLI・MCP は起動していない。3入口の最終の同一性は M7 の統合で L2 が確かめる） | 上の ZIP 生成2件。GUI が書き出した request.json を Node 側で `validateRequest` → `tests/helpers/templates.ts` の `loadAssets`・`loadTemplates`（ファイルシステム読み）→ `buildJobFiles` に通し、ブラウザでダウンロードした ZIP を展開して、パスの集合と各ファイルのバイトを全件比較。添付は .md・.csv・.pdf・.png・.glb×2・BGM（解説）と .txt・完成音源（MV） |
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

契約（CONTRACT・操作定義表・封筒スキーマ）と要件を変える必要は生じなかった。M4-fix で core に関わる質問を1件 `QUESTIONS.md` に書いた（下の M4-fix 節）。L2 に確認してほしい点を次に挙げる（作業は止めていない）。

1. GU-06 のコマンド例は REQUIREMENTS §4.1 と CONTRACT §3（`out` は出力先の親ディレクトリ）に合わせて `smm generate <file>.request.json --out jobs` とした。M2b の実装と食い違えば L2 の調整に従う。
2. M1 の REPORT が M2a に移送した「独立したホスト・ブラウザのテンプレート比較」のうち、ブラウザ側（Vite の glob とファイルシステム読みの差）は M4 の e2e（AR-06 の2件）で実測した。M2a の host 側の比較とは別物として扱ってよいか。

## M4-fix（レビュー M4R の反映）

入力：`docs/work/M4/REVIEW.md`（Codex、`494769a` 対象）と L2 の裁定。指摘ごとの対応とテスト名を示す。e2e はすべて `gui/e2e/run.mjs`、単体は `gui/tests/`。

| 指摘 | 対応 | テスト名 |
| --- | --- | --- |
| **R1** 不正な列挙値の request で画面が消える | `parseRequestText` が core `validateRequest`（shape）の後に `choiceIssues` を通す。列挙の集合は GUI に書かない：core が受け付ける完成済みの入力 `choiceProbe` の1キーだけを読み込んだ値に替えて core `validateForm` に通し、増えた誤りを `/form/<key>` の pointer つきで返す。`styleMode` はさらに core `explainerStyles` に項目があることを確かめる。対象は `videoMode`・`styleMode`・`characterMode`・`voiceEngine`・`characterPosition`・`secondCharacter.position`・`tempo`・`energy`・`motionAmount`・`biimUsage`・`characterUsage`・`evidencePolicy`。読み込みに失敗したときは何も反映しない（入力・添付・前回の読み込み通知を残す。以前は失敗時に読み込み通知を消していた）。未完成の入力（空、範囲外の数値、縦向き＋混在、MV で音源なし）はこれまでどおり読み込める。core を変えるべきかは `QUESTIONS.md` Q1 | 単体 `parseRequestText rejects unknown values of fixed-choice keys with pointers, but keeps unfinished input importable (M4R R1)`、`choiceIssues takes the accepted values from core, not from a GUI list`。e2e `GU-04 不正な列挙値の request.json は入力エラーとして表示し、画面と既存の入力・添付を残す（M4R R1）`（styleMode・videoMode・secondCharacter.position の3件で、エラーの pointer、`form.studio` が残ること、コンソールエラー0、添付1件が残ること、書き出した request が読み込み前と同じこと、その後に正しい request を読み込めること） |
| **R2** run.json 経由で「免除：なし」 | `runView` が内包レポートを直接開いた場合と同じ `classifyReport` で読み、そのゲート（行・`review_mode`・免除）と助言を使う。判定は run に記録された `result.verdict` のまま。表示は同じ `ReportCard` 部品。実行の状態とゲートの判定は別の行のまま | 単体 `run.json: run status and gate verdict are separate facts`（免除・行・助言が直接の QC と一致、independent・免除なしの run も確認）。e2e `GU-05 run.json 経由でも QC の免除・review_mode・ゲート行を直接開いた場合と同じ部品で表示する（M4R R2）`（run だけを開いて PRE-3 と理由を表示、その後 QC を開いて `.waivers`・`.review-mode`・`.gate-table`・助言の文字列が run と同じ） |
| **R3** CLI 例のクォート | `shellArgument(value, shell)` と `generateCommand(file, shell)`。PowerShell は単一引用符で、内部の `'` と、PowerShell が引用符として扱う U+2018〜U+201B を二重にする。POSIX シェルは単一引用符で、内部の `'` を `'\''` にする。英数字と `._/-` だけ（先頭が `-` でない）の引数は引用しない。画面にはシェル名を見出しにした2つの例（「PowerShell（Windows）」「bash・zsh などの POSIX シェル（macOS・Linux・WSL）」）とそれぞれのコピーを出す。cmd 用の例は出さない（以前のコメントの「bash・PowerShell・cmd 共通」は誤りだったので削除）。タイトルの自由記述は狭めていない（ファイル名は従来どおり core `safeName` だけ。`"` は `safeName` が `-` にするので、ファイル名に `"` は現れない） | 単体 `generate command: … one example per shell`、`PowerShell quoting: …`、`POSIX quoting: …`（`'\''` の規則と復号の一致を全ケースで）、`titles stay free text: …`、`PowerShell receives each quoted name as one unchanged argument (powershell.exe -NoProfile -Command)`（`spawnSync('powershell.exe', ['-NoProfile','-NonInteractive','-Command', script], {shell:false})` で、引数を JSON にして返す関数 `smm` に24件を渡し、すべて1引数で元の値。Windows 以外では skip）、`a POSIX sh receives each quoted name as one unchanged argument (when sh is on PATH)`（`sh -c` で `printf '%s\0'`。手元では Git for Windows の sh で実行。sh が無ければ skip）。値は `$(1+1)`、`` a`b ``、`it's`、`say "hi"`、`a&b`、空白、全角、`‘曲’と’`、`$env:PATH`、`-dash`、`a;b|c>d`、全角空白と、それぞれの `requestFilename` の結果。e2e `GU-06 CLI・MCP の区画（…）`（2例のシェル名と、`$(1+1) it's` の PowerShell・POSIX の文字列） |
| **R4** reduced-motion でも smooth | エラー要約へのスクロールは `matchMedia("(prefers-reduced-motion: reduce)")` が真なら `behavior: "auto"`、偽なら従来どおり `smooth` | e2e `GU-16 prefers-reduced-motion では生成エラー・読み込みエラーのスクロールに smooth を渡さない（M4R R4）`（`scrollIntoView` を記録用に包み、ZIP 生成の必須エラーと不正な request の読み込みエラーの2経路。reduce では smooth なし、reduce なしでは smooth であることも確かめて記録が働いていることを示す） |
| **T1** テスト対象を広げる | 全入力欄テストに全画面の切り替えを追加。4様式それぞれで request.json の `styleMode` と既定デザインの切り替え（core `switchStyleMode` と一致）、要点の表示、project.json の `direction.style_mode`、全画面スイッチの有効・無効を確認し、全画面のオン・オフの往復も確認。編集した MV デザインが解説モードを経由して戻ること。キーボード到達は判定部分を `assertKeyboardReach` にまとめ、状態ごとに実行。ZIP 生成中のボタン・`<progress>` の状態を MutationObserver で全件記録 | e2e `GU-02 全入力欄（解説モードの全キー…）`（`fullScreen` を変更して比較）、`GU-02 全入力欄（4様式の反映と全画面の切り替えが request.json・project.json・表示に入る）`、`GU-02 制作モードの切り替えとモード別の指示・デザイン文の保持`（MV デザインの往復と書き出し）、`GU-16 キーボードで全操作に届き、フォーカスが見える（解説・サンプル＋詳細）`、`GU-16 キーボード到達（M4R T1：MV と音源・duo と添付の削除・読み込み通知・検査結果・エラー表示・ダイアログ）`（MV＋音源＋添付、duo＋2モデル＋BGM＋読み込み通知＋検査結果4件と読めないファイルのエラー＋必須エラー＋詳細、情報ダイアログの中）、ZIP 生成2件（生成中は毎回 disabled かつ `<progress>` があり文言が「ZIPを生成中… n%」、値は減らない、終了後は enabled・`<progress>` なし・元の文言） |
| **I1** REPORT の記述 | 受け入れ条件の表の AR-06 行を「ブラウザの ZIP と core＋Node のファイルシステム読みのバイト一致」に訂正し、実 CLI・MCP との比較ではないこと、3入口の同一性は M7 の統合で L2 が確かめることを書いた | — |
| スクリーンショット | CLI 区画（R3）と run の表示（R2）が変わったので、全枚数を同じコミット `9f08db5` で撮り直した。S5c（run.json の QC）、S9b（シェル別の2例）、S12（不正な列挙値の読み込みエラー）を足して16枚。`VERIFICATION.md` と `docs/DESIGN.md`（CLI 区画の説明）を更新 | `npm run shots --workspace gui -- --commit=9f08db52726416520362473c5b85cdbe1e1f3a80`：16枚、すべて横あふれ 0・コンソールエラー 0 |

### 修正前のコードで新しいテストが失敗することの確認

`gui/src/App.tsx`・`gui/src/lib/request-io.ts`・`gui/src/lib/inspection.ts` だけを修正前に戻し（差分を一時保存して戻し、確認後に再適用）、`node --experimental-strip-types e2e/run.mjs --only=M4R` を実行した：R1・R2・R4 の3件が FAIL、キーボード（T1）は合格（キーボードの到達は元から満たしていた）。R3 は関数の引数が変わったため同じ方法では戻せないので、修正前の規則で作った文字列 `smm generate "$(1+1) it's.request.json" --out jobs` を同じ方法で powershell.exe に渡し、`["generate","2 it's.request.json","--out","jobs"]`（展開されて別のファイル名）になること、修正後の `smm generate '$(1+1) it''s.request.json' --out jobs` では `["generate","$(1+1) it's.request.json","--out","jobs"]` になることを確かめた。

### M4-fix の決定

- **F1 列挙の集合は core の `validateForm` を通して探る。** GUI に集合を書くと core と二重になり（GUI 独自のスキーマ）、裁定に反する。core の集合は公開されていないため、完成済みの入力の1キーを差し替えて core に判定させる方法を取った。基準の入力が core で誤り0件であることを単体テストで固定している。
- **F2 シェルは PowerShell と POSIX の2つ。** Windows の既定の端末は PowerShell で、macOS・Linux・WSL は POSIX 系。cmd は `%` の展開を引用符で止められず、正しい例を作れないため出さない。
- **F3 PowerShell の例は関数・スクリプト（npm の `.ps1` シム）への引数として1引数になることを確かめた。** PowerShell 5.1 が外部の実行ファイルへ渡す際に `"` を含む引数を崩す既知の挙動があるが、ファイル名には core `safeName` によって `"` が現れないので、この例では起きない。
- **F4 読み込みの失敗で前回の読み込み通知も消さない。** 通知は現在の入力に対応したままなので、失敗時に何も変えない方が「成功したときだけ反映」に沿う。

### M4-fix のテストのコマンドと結果（手元、Windows 11・Node v24.15.0）

| コマンド | 結果 |
| --- | --- |
| `npm run build` | exit 0 |
| `npm test` | tests 123 / pass 113 / fail 0 / todo 10 |
| `npm test --workspaces --if-present` | 単体 33 / 33、e2e 42 / 42 |
| `npm run build --workspaces --if-present` | exit 0（型検査と Vite ビルド） |
| `node tools/ci-local.mjs` | 下の記録 |

## 残課題

- Linux と Node 22 では e2e を手元で実行していない（CI で初めて実行される）。Linux では `--no-sandbox` を付けて起動する。
- 公開 URL での確認（CI-07 の `tools/verify-pages.mjs`）は M8 の範囲。
- 実装者以外のレビューは L2 が発注する。
- アイコンの追加の要望はない（M5 への追加発注なし）。
