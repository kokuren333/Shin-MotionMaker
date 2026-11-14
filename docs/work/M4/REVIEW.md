# M4R REVIEW — GUI の独立レビュー

- 結論：**差し戻し**。必須修正は R1〜R4 の4件。既存テストの成功だけでは、これらの不具合を検出できない。
- レビュー者：Codex（L3 工学担当、high、モデル切替なし）。`review_mode: independent`。GUI 実装者とは別製品。見た目の好み・文面の推敲は判断していない。
- 対象：`m4-gui` の `494769abb4d194a41b77b27cc22facc151a8a8b5`。比較基準 main は `288b0ab6de585f0c291fd7fa228f47df054a56ac`。`git diff main...m4-gui` と関連する既存 core・テストを確認した。
- 読んだもの：REQUIREMENTS の指定節、AGENTS、CONTRACT、DESIGN、M4 REPORT、WORKFLOW、原典 `262c798` の `src/App.tsx` と要件書 UI-11。原典 HEAD が `262c798` であることも読み取りで確認した。
- 環境：Windows、Node v24.15.0、既存 Chrome のヘッドレス実行。サブエージェント・モデル変更・外部ツールの導入なし。原典・CyberSprite への書き込みなし。
- このレビューで編集するのは本ファイルだけ。コード、REPORT、スクリーンショット、契約は変更していない。最終の受け入れ判定は L2 に委ねる。

## 必須指摘

### R1 — 不正な様式を含む request の読み込みで画面全体が消える

- 区分：**必須**（高）。根拠：GU-04、AR-04、TS-08。
- 箇所：`gui/src/App.tsx:277`（読み込み値の適用）、同 `:77`（依頼文生成）、同 `:1019`（様式ラベル参照）。関連：`gui/src/lib/request-io.ts:70`、`src/core/prompt.ts:7`。
- 再現：次の request を画面上部から読み込む。

```json
{"form":{"title":"test","description":"test","audience":"test","styleMode":"unknown"}}
```

- 実測：`form.studio` が消え、コンソールに `TypeError: Cannot read properties of undefined (reading 'label')`。通常の入力エラー表示へ戻れず、再読み込みが必要になる。読み込み処理は既存の添付も先に消している。
- 原因：core の `shape` は型までを検査し、この文字列は通る。GUI はその値を直ちに state へ入れ、有限の様式だけを想定する `agentPromptFor` 等を呼んでいる。`validateRequest` を呼んでいる事実だけでは、描画の安全性を担保できていない。
- 直し方：core の検査と安全な表示処理を組み合わせ、不正な列挙値でも入力エラーを表示して操作を継続できるようにする。未知の様式で依頼文・プレビューを生成しない。未完成の入力を読み込めること、shape/complete の責務、共通検査の利用を維持し、GUI に独自スキーマを作らない。e2e `gui/e2e/run.mjs:389` に、型は文字列だが値が不正なケースと、読み込み後も画面が残ることを追加する。

### R2 — run.json では免除があるのに「免除：なし」と表示する

- 区分：**必須**。根拠：GU-05（run.json の表示、self と免除の明示）、TS-08。
- 箇所：`gui/src/lib/inspection.ts:134`、`gui/src/components/InspectionViewer.tsx:121`。
- 再現：既存の `gui/e2e/fixtures.mjs` の `runRecord` を run.json として開く。この fixture の `result.report.waivers` には PRE-3 の免除が1件ある。
- 実測：モデルの `gate.waivers` は `[]`。ブラウザでも **「免除：なし」** と表示された。同じ QC レポートを直接開く経路では免除が表示される。
- 原因：run の表示だけが `waivers: []` を固定している。既存の単体テストは run の `reviewMode` を確認するが免除を確認せず、e2e の免除表明も直接の QC カードだけを見ている。
- 直し方：内包レポートの QC 表示を共通化し、記録された免除 ID・理由を run 経由でも表示する。run の状態とゲートの判定は引き続き分離する。同じ fixture を直接表示した場合と run 経由で表示した場合の免除を、単体・e2e で確認する。

### R3 — CLI コマンド例のクォートが PowerShell の展開を防がない

- 区分：**必須**。根拠：GU-06（現在の入力に対する実行可能なコマンド例）、DC-03。Windows を前提とする開発規約にも関係する。
- 箇所：`gui/src/lib/commands.ts:14`、`gui/src/components/AgentEntrances.tsx:61`。関連テスト：`gui/tests/commands.test.ts:12`。
- 再現：タイトルを `$(1+1)` にする。保存名は `$(1+1).request.json` だが、表示例は `smm generate "$(1+1).request.json" --out jobs` になる。
- 実測：PowerShell の引数を受け取る無害な `smm` 関数で実行したところ、受け取った名前は **`2.request.json`**。本来のファイルを指さない。算術式だけで検証し、実 CLI や任意の外部コマンドは起動していない。
- 原因：二重引用符は PowerShell の `$()`・変数展開を抑止しない。`\"` による引用符の処理も、コメントが主張する bash・PowerShell・cmd 共通のクォートにはならない。既存テストは引用符で囲まれた文字列かどうかだけを検査する。
- 直し方：対象シェルを明示して、そのシェルで正しく引数を保持する例を生成する。Windows の例なら PowerShell の単一引用符と引用符内のエスケープ等を使い、必要なら他シェルの例を分ける。タイトルの自由記述を禁止文字の追加で狭めない。空白・`&` に加えて `$()`、バッククォート、単一引用符等が元の1引数として届くことをテストする。

### R4 — reduced-motion が有効でもエラー時に smooth を明示する

- 区分：**必須**。根拠：GU-16、TS-08。
- 箇所：`gui/src/App.tsx:175`。関連：`gui/src/style.css:1401`、`gui/e2e/run.mjs:519`。
- 再現：`prefers-reduced-motion: reduce` を CDP で有効にし、未入力のまま ZIP 生成を押す。`scrollIntoView` の実呼び出しをブラウザ内で記録した。
- 実測：`reduce: true`、CSS の `scrollBehavior: "auto"` に対して、呼び出し引数は **`{behavior:"smooth",block:"center"}`**。明示的な JS の smooth 指定は CSS の auto 設定では取り消せない。
- 原典から残った処理だが、GU-16 は新 GUI の要件であり、この経路も対応が必要。現在の e2e は初期画面の CSS と animation/transition の有無だけを見て、エラー時の操作を実行していない。
- 直し方：reduce 時は `auto` を使うか、明示的な smooth をやめる。生成エラーと request 読み込みエラーの操作を含めた e2e で、smooth が指定されないことを確認する。

## GU-02 と原典 UI-11 の突き合わせ

原典の静的なフォーム要素も TypeScript AST で照合した。value または checked を持つ直接の input/select/textarea は両方43個、`select(...)` の呼び出しは両方8個。直接要素の置き換えは制作モードと様式モードの select → radio で、残りの対応要素に欠落はなかった。これは動作テストの代用にはしていない。

表の e2e 行はすべて `gui/e2e/run.mjs`。REPORT の21項目に対応するテスト名は実在する。ただし「全入力欄」「進捗」等の表明範囲には下記の限界がある。

| 原典 UI-11 の機能 | 新 GUI の所在・移植結果 | e2e の実際の確認と限界 |
| --- | --- | --- |
| 制作モード切替・モード別の指示とデザイン保持 | `App.tsx:144`、`:387`。core の modeSettingsFor/switchVideoMode を使用。select を radio に変更 | L68。両モードの指示、解説のデザインの復元、MV 初期デザインを確認。編集した MV デザインの復元自体は表明しない |
| 様式モード選択 | `App.tsx:577`。core の4様式・switchStyleMode。select を同じ扱いの4カードへ変更 | L82。4値の順序・アイコン・同幅、anime の反映、縦向きで mixed が disabled を確認。全入力欄テストでは mixed を選ぶ |
| 01〜05 と詳細の全入力欄 | `App.tsx:379` 以降。旧入力の対応あり。自由記述を保持 | L94、L158。多数の入力を変更して request.form 全体と比較。ただし fullScreen は変更せず既定値の一致だけ。推奨 T1 |
| MV の04・05・詳細の非表示 | `App.tsx:744`、`:960`。原典と同じ isMV 分岐 | L170。対象区画・様式選択の不在と目次3件を確認 |
| 参考資料の D&D・選択・削除・件数/容量 | `App.tsx:530`、`PixelIcon.tsx:31` | L178。選択2件→ドロップ3件→削除2件と件数/容量表示を確認 |
| 完成音源・BGM・GLB・音源尺 | `App.tsx:180`、`:495`、`:818`、`:883`。音源のブラウザ計測を維持 | L195、L158、ZIP の2件。30秒の WAV、BGM・モデル、MV の尺表示と export を確認 |
| 方向性のたたき台・差別化メモ（両方） | `App.tsx:623`、`:673`。core の候補と整形を使用。再抽選を新しい乱数 seed に変更 | L206、L94、L158。未追記→再抽選でもデザイン不変→操作時だけ追記。両方の差別化メモを export と比較 |
| 歌詞・台本統計 | `App.tsx:443`、`:477`。core lyricStats/scriptStats | L231。見出し数、歌詞行数・長い行・見出しを確認。警告色から中立の強調に変更 |
| 準備度（両方） | `App.tsx:91`、`:99`、`:1042` | L241。解説10件・サンプルで3件増加、MV 6件と完成音源の項目を確認 |
| 素材生成の2設定 | `App.tsx:722` | L252。JSON の画像生成と動画生成の値の変化を確認 |
| キャラ1人/2人・配置・字幕色/HEX | `App.tsx:749` 以降 | L94、L264、ZIP の解説ケース。2人分の値、配置、HEX、字幕見本と帯への色反映、2モデルの梱包を確認 |
| Aivis 設定 | `App.tsx:833`、`:851` | L94、L277。URL・2人のID/話速/指示を export と比較、既知IDの表示、none 時の非表示を確認 |
| 解像度・向き・fps | `App.tsx:911` | L94、L285。縦向きの選択肢、24/60fps、解像度の export を確認。MV で05が隠れる挙動は原典と同じ |
| レイアウト図・同梱ファイル・JSON | `App.tsx:1056` | L293。図の存在、ファイル表示、JSON と選択タブを確認。650px以下で3表示を隠すのは原典からの保持 |
| 必須エラーとフォーカス | `App.tsx:230`、`:1158` | L303。3つの必須文言と errors へのフォーカスを確認。読み込みエラーの別経路には R1、reduce には R4 |
| ZIP 生成・進捗 | `App.tsx:230`、`:1173` | L312、L323、L570。実ブラウザの ZIP ダウンロード、全パスと本文バイトを比較。途中の progress 値は未表明（REPORT も明記）。実 CLI 比較とは異なる。I1 |
| 指示コピー | `App.tsx:252` | L329。成功文言を確認。clipboard.readText が読めた場合に本文も比較 |
| 失敗パターン（両方） | `App.tsx:1138`。core の一覧を使用 | L337。両モードの件数と core の件数が一致 |
| ゴースト JSON・静止画 | `InspectionViewer.tsx:16`、`:147`。複数レポートとドロップに拡張。件数を中立の助言へ変更 | L343。preview の画像要素4個と件数、ゲート区画がないことを確認。画像の decode/naturalWidth は表明しない |
| サンプル | `App.tsx:283` | L351。タイトルと生成可能状態。原典と同じ30秒の解説サンプル |
| 情報ダイアログ | `InfoDialog.tsx:14`。版・文書・高コントラストを追加 | L357、L53。4区画の文言、Escape、版とコミットを確認 |

機能群そのものの削除は見つからなかった。原典からの挙動変更は、上表の radio 化、候補 seed、助言の様式、検査ビューア拡張、および request/CLI/MCP/版/高コントラストの追加。R1〜R3 は追加経路の不具合、R4 は原典から残った要件未対応である。

## 推奨・参考

### T1 — 全入力欄・キーボード・進捗のテスト対象を広げる

- 区分：**推奨**。根拠：GU-02、GU-16、TS-08。
- 箇所：`gui/e2e/run.mjs:94`、`:312`、`:482`。
- 全入力欄テストは `fullScreen` を操作していない。キーボードテストは解説サンプル＋詳細を開いた時点の、現在 DOM にある操作が対象で、MV、duo の追加欄、添付削除、読み込み通知、検査結果、ダイアログ等の状態ごとには列挙しない。到達後の実行もすべてをキーボードで試すわけではない。
- 直し方：全画面切替・4様式の反映、編集した MV デザインの往復を加える。動的状態ごとのキーボード対象とフォーカスを確認する。進捗は生成中の disabled、progress の存在と終端を確認するとよい。既存の「全操作」の成功を全状態の証拠に拡張解釈しない。

### I1 — ZIP 比較は実ブラウザ対 core/Node。実 CLI・MCP との同一性は未確認

- 区分：**参考（統合時に必要）**。根拠：AR-06、GU-03。
- 箇所：`gui/e2e/run.mjs:570`、`docs/work/M4/REPORT.md:70`、`tests/generate-job.test.ts` の M2a/M2b TODO。
- 実際にダウンロードした ZIP を展開し、パス集合と各ファイルの全バイトを比較している点は確認できた。Node 側は `tests/helpers/templates.ts` のファイル読み取り → `validateRequest` → `buildJobFiles` であり、host/CLI/MCP は起動しない。このブランチにはそれらの実装もない。
- REPORT の「CLI 経路のバイト一致：実行して合格」は証拠の範囲より広い。M4 の証拠は「ブラウザ対ファイルシステム読み＋core の2ケース」と記録し、M2a/M2b/M3 の取り込み後に実入口との比較を行うこと。M4 に CLI の実装を追加する指摘ではない。このレビューでは AR-06 の3入口の最終同一性を承認していない。

## その他の観点の確認結果

| 観点 | 確認した事実・判定の範囲 |
| --- | --- |
| AR-01・GU-03 | GUI の project・briefを含むZIP・依頼文・候補・統計は core を呼ぶ。生成ロジックの GUI 内再実装は見つからなかった。実 CLI との比較の限界は I1 |
| AR-04・GU-04 | 読み込みは core validateRequest の shape、ZIP 前は complete。書き出しは requestFor/requestText による直列化で、そのボタン自体は validateRequest を呼ばない。未完成フォームも保存できる。書き出した形を単体/e2eで core に渡して確認している。読み込み安全性は R1 |
| CONTRACT M-3 | assetsFor は mimeTypeFor を使い File.type に依存しない。添付ありの解説・MVの2ケースを全バイト比較している |
| CONTRACT M-4・GU-14 | generator は core の createProject、版は core/data/version.ts。site.mjs はその定数を読み、commit/built_at だけをビルド引数から作る。情報ダイアログも同じ定数とビルド情報を使う。version.json の version/template_version/commit と表示のテストあり |
| PH-03・GU-05 | 直接の validate/QC/ghost では、ゲートと助言を兄弟の別 section にしている。ghost 件数にゲートなし。e2e は中立色・advisory アイコンを確認。直接QCの self/免除は明示されるが、run の免除は R2 |
| PH-04・PH-06・GU-07 | 自由記述を残し、候補は明示操作でだけ追記。seed は crypto.getRandomValues、引き直し時も新規生成。4様式は同じ列挙と部品で表示され、初期 biim は原典の既定値。特定様式だけの追加の強調は見つからなかった |
| GU-01 | 実行時の取得は同梱フォント。参考URLを取得するコード、外部CDN、バックエンド送信、localStorage/sessionStorage/IndexedDB は見つからなかった。外部リンクは利用者が開く文書・参考元 |
| GU-08・TS-08 | トークンの写しと fixture のテストあり。CyberSprite の指定ファイルを読み取りで照合した SHA-256 も `d52b8cd592ae88b681567834c8833ce35caa6fc49047dd54a7bffe54f73af1f3` で fixture と同じ。両テーマの値を保持。色リテラルの走査と陽性テストあり。例外の字幕データ・Biimプレビューに加え、index.html の theme-color は正本 board と同値であることをテストしている |
| GU-15 | base は相対。サーバーは /Shin-MotionMaker/ 以下だけを配信し、e2e が資産の404・外へのパス・コンソールを確認する |
| GU-16 | 両テーマのトークン対と、入力済み/結果表示の描画後の文字を検査。ただし利用者の字幕色・Biim図・非表示ダイアログ等は描画後検査から除外する。390pxの両モードと入力済み/結果あり、1440×900の最初の入力欄を実際に測定。キーボード範囲は T1、reduce の欠陥は R4 |
| GU-17 | VERIFICATION に13枚の記録。既存PNGの寸法（1440×900 / 390×844）と全13件のSHA-256が記録と一致。書込制限に従い既存画像を上書きしていない。見た目の好みの判定なし |
| CI-01 | e2e は固定 commit で site.mjs を呼び、git を起動しない。git 呼出がある build.mjs はテストから呼ばれない開発用入口。no-git 検査の除外はこの入口に限定されている。ルート検査・陽性 fixture の両方が成功 |
| ブラウザ不在 | browser.mjs:46 の探索が見つからなければ throw、run.mjs:625 で失敗、:634 で非0。skip へ切り替える分岐なし。実ブラウザありの37件を再実行した。実機のブラウザを削除しての確認はしていない |
| AR-03 | GUI 実行コードから host/cli/mcp の import はない。architecture の実走査と陽性検出テストも成功。GUI用Nodeビルド/e2eのI/Oを、製品のブラウザ実行コードと混同していない |

## 実行証拠

### 既存の検証

`node tools/ci-local.mjs` を対象コミットの深さ1の複製で実行し、**exit 0**。以下は実際に内部で順番に実行されたコマンドと出力である。

| コマンド | 結果 |
| --- | --- |
| `npm ci` | 37パッケージ追加、監査39。既知の low 1件の表示。依存変更なし |
| `npm run build` | TypeScript 検査成功 |
| `npm test` | tests 123、pass 113、fail 0、skip 0、todo 10。TODO は既存の M2a/M2b への移送分 |
| `npm test --workspaces --if-present` | GUI の test スクリプトを実行。単体27/27成功、その後 Pages 用ビルド＋実ブラウザ e2e 37/37成功。fail 0 |
| `npm run build --workspaces --if-present` | GUIの型検査とViteビルド成功。123 modules、version.json は version 0.1.0、template_version 0.5.1、commit は対象コミット |

最終出力：`CI と同じコマンドが完了しました: 494769abb4d194a41b77b27cc22facc151a8a8b5`。

追加の読み取り検証：`git diff --check main...m4-gui` は出力なし、exit 0。フォームの AST 照合は旧/新43要素・8ヘルパー呼出、置き換えは上表の2 select。スクリーンショット照合は `count:13, problems:[]`。

### 既存テストが見逃したケースの実ブラウザ確認

PowerShell の here-string を `node --experimental-strip-types --input-type=module` へ渡す一時スクリプトで実行した。`buildSite` に固定 commit と日時を渡し、OS の一時フォルダにビルド → `serve` でサブパス配信 → `launchBrowser` / `openPage` で実ブラウザを操作した。追加のテストファイルは置いていない。

| 操作・確認式 | 出力の要点 |
| --- | --- |
| `classifyReport("run.json", JSON.stringify(runRecord))` と `.inspection-viewer input[type=file]` から run のみ選択 | 入力の waivers 1件 → 表示モデルは0件 → DOM `.waivers` は `免除：なし` |
| R1 の JSON を一時ファイルにして `.bar-import input[type=file]` から読み込み | `hasForm:false`、TypeError 1件 |
| `openPage(...,{reducedMotion:true})` で `Element.prototype.scrollIntoView` を記録用関数に置き換え、ZIPボタンを押す | `reduce:true, css:"auto", calls:[{behavior:"smooth",block:"center"}]` |

上記の観察用スクリプト自体は exit 0 で終えた。不具合の存在を確認した結果であり、受け入れ成功を意味しない。最初の試行は PowerShell パイプの日本語セレクターの文字化けで中断したため、ASCII の同等セレクターにして再実行し、上記3件を確認した。

R3 は別の標準入力スクリプトで `requestFilename({...defaults,title:'$(1+1)'})` → `generateCommand` を使用し、`spawnSync('powershell.exe', ['-NoProfile','-NonInteractive','-Command', script], {shell:false})` で引数を記録した。実行した script は次の無害なもの。

```powershell
function smm { $args | ConvertTo-Json -Compress }; smm generate "$(1+1).request.json" --out jobs
```

出力：`["generate","2.request.json","--out","jobs"]`、exit 0。期待するファイル名 `$(1+1).request.json` と不一致。

## 決定・質問・依存・残課題

- 決定：レビューのためにコードを直さず、追加ケースは一時ファイルと標準入力スクリプトで確認した。必須指摘は好みではなく、再現した挙動と要件に基づいている。
- 契約・要件への変更質問：なし。書込許可は本ファイルのみなので QUESTIONS/REPORT は作っていない。実 CLI 比較の未確認範囲は I1 に明記した。
- 追加依存：なし。M4 の固定版と NOTICE の追加を確認し、react の LICENSE と Vite の LICENSE.md の MIT 本文を読み取りで確認した。推移依存すべての実物ライセンスの再監査は今回行っていない。
- 残課題：R1〜R4 の修正と回帰確認、T1 の検討、I1 の統合時検証。Linux/Node 22 の実走、公開先の確認は今回の実機証拠に含まない。
- 見た目・文面の好みに関する TODO はなし。L2 は必須修正後のコミットで再確認すること。
