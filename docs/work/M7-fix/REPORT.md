# REPORT — M7-fix

## 起動時チェックと範囲

- 層は L3 工学担当。Codex、発注指定モデル 6.1 sol / high。モデル切替・下請け利用なし。縮退レベル1（L4 を利用しない設定）、自己判定となるゲートなし。受け入れ・交差レビューは L2 に残す。
- 開始 HEAD は `14c6f16ae063917319dfdedc0e754261625f37cc`、ブランチ `m7-fix`、作業ツリーはクリーン。指定作業ツリーのみを編集。Node v24.15.0 / Windows。
- REQUIREMENTS、ルート AGENTS、WORKFLOW、CONTRACT、CLI、MCP、M7/G4_REVIEW 全文と会話内発注を確認。開始時は M7-fix/DIRECTION.md が未配置だったため会話内の発注書に従い、後で main に配置された同文の発注書も読んだ。
- コマンド実行・対話・npm のネットワーク利用が可能。原典は `git clone --no-hardlinks` で専用スクラッチへ複製した `262c79876a9c4635377114902d58ce783e7578b1` だけで依存を導入し、原典作業ツリーと CyberSprite は変更しない。外部ツール導入・push・公開なし。

## 指摘 → 対応 → テスト・証拠

| 指摘 | 対応（ファイル・モジュール） | テスト名・実動証拠 |
| --- | --- | --- |
| R-1 | host/runs の起動失敗に details.reason:worker_start_failed を記録。CLI はその失敗を detach の成功に変換しない | `M7-fix detach preserves worker launch failure as ok false and exit four`。source/built 両入口で worker spawn を ENOENT にし、ok:false・E_INTERNAL・終了4。既存 `TS-02 detach survives the CLI and wait uses terminal exit while get logs list and cancel return retrieval success` はスクリプト起動後の crash で開始0・wait4 |
| R-2 | core/request の shape と host/input-schemas を原典のモード・人数条件へ統一。request/operation-inputs スキーマと request/MCP スナップショットを更新 | `M7-fix shape checks existing choices only when validateForm checks them`、`M7-fix inactive choices survive complete validation and CLI MCP schemas`。MV の不使用様式・配置、solo の2人目配置を complete・CLI/MCP generate・stats で受理。既存の active な列挙不正の事前拒否も維持 |
| R-3 | 許容差分表の SHA-256、R1 の9対、逆変換時の各出現回数を固定。表そのものは変更なし | `baseline metadata is complete and inventory counts match its named tests`、`JT-11 template and font bytes reverse only the enumerated R1 R3 R4 differences` と11 golden ケース |
| R-4 | 全 run と validate final の既定値表明。全入力スキーマに wait_ms.default、validate の final 分岐の注釈を追加 | `M7-fix all run wait defaults match the contract and advertised schema`。setup/validate/qc/ghost_check/render/voice/sound/imagegen を表で網羅。MCP tools/list の既存 snapshot テスト |
| R-5 | generate と実ジョブ QC のパス、Tier B/C のジョブ名に ASCII の &・空白と `＆`・`（）`・全角空白・`・` を同時に含める | `M7-fix generate and run support fullwidth punctuation and spaces`、最終 Tier B/C の evidence.job・run.job |
| R-6・R-9・S-10 | CONTRACT の版・改訂履歴・shape・qc/imagegen と PNG のコードを修正。CLI の根拠に M7 cli-add を追加。VERIFICATION の既存 legacy 全行に「CLI（原典 0.4 ジョブ）」を明記 | 文書差分、既存 cli-script-exits / MCP スキーマ比較、`node tools/verify-cli.mjs` の54実測記録 |
| R-7 | engines を >=22.12.0 にし、lockfile ルートの宣言と README の必要環境1行を同期 | `npm run build`、最終 ci-local の npm ci。依存版の変更なし |
| R-8 | 開発専用 verification-state を Tier B/C で共用。HEAD と任意の指定コミットの一致・未追跡を含むクリーン状態を検査後、dist を再ビルド。実 HEAD・clean・テンプレート版・検査時刻・ビルドコマンドを記録 | dirty な状態で `node tools/tier-b.mjs --commit HEAD` が実行前に拒否。最終 Tier B/C の revision 記録。git を使うこの開発モジュールをテストから呼ばない |
| S-7 | CLI 8 MiB 超も E_INPUT_INVALID に統一。MCP 6 MiB 上限は維持 | `MC-09 report whitelist text limit UTF-8 boundary and PNG size limit`、`TS-04 default SDK buffer receives a 6 MiB PNG once and survives an oversized rejection; CLI keeps 8 MiB` |
| L2 所見 | verify-cli の既定出力を .agent-work/cli-verification.json に変更。既存 --output 引数は維持 | `node tools/verify-cli.mjs` が54記録を既定の追跡外へ出力。M2b/CLI-EXAMPLES.json の差分なし |
| S-1 | git-detector を TypeScript AST で走査し、関数名に依らず第1引数が git の呼出を検出。tests/gui/tools 全体を走査。開発専用4ファイルは名前と理由を明記して除外 | `test code and helpers never launch the version-control executable`、`the process-launch guard detects positive fixture strings without executing them`。wrapper/member/optional call の陽性とコメント・文字列の陰性を追加 |

## 実行済みの検査

| コマンド | 結果 |
| --- | --- |
| `npm run build` | 終了0（TypeScript 検査と配布 JS） |
| `node --experimental-strip-types --test tests/integration.test.ts tests/cli.test.ts tests/host-run.test.ts tests/host-files.test.ts tests/no-git.test.ts tests/fixtures-baseline.test.ts tests/baseline.test.ts` | 57件 / pass57 / fail0 / skip0、142889.7965ms |
| `node --experimental-strip-types --test tests/mcp-fix.test.ts` | 7件 / pass7 / fail0 / skip0、89866.6705ms |
| `node tools/verify-cli.mjs` | 終了0、54記録。既定出力は追跡外、既存証拠の上書きなし |
| `node tools/check-licenses.mjs --output .agent-work/m7fix-licenses.json` | 終了0、180項目、導入済130、許容集合外なし、verified:true |
| `npm test --workspaces --if-present`（main 取込前） | GUI 単体33件 / pass31 / fail1 / skip1。R-2 と異なる2人目配置の期待値で失敗。M7-fix-Q1 に記録し、gui/ を変更せず対応を確認 |

最終コミットでの npm test・GUI・ci-local・Tier B/C は後続の証拠節へ記録する。

## 決定

- worker の起動確認前の失敗は error.details.reason で識別し、封筒・run の型と既存 status は変えない。原因 details があれば cause に保持する。
- 原典が無視する列挙値でも型・未知キーは検査する。JSON Schema は型を保ち、既存 enum を条件分岐に置く。モード・人数省略時は既定値を用いる。
- wait_ms の default は JSON Schema の注釈として出し、実際の既定値を適用する処理は共通 defaultWait に残す。validate は final 省略時45,000、true なら0を分岐に記す。
- R1 の出現数は表の順に `[2,1,1,1,1,1,1,1,1]`。R3 の追記を除去した後、各逆置換の直前に照合する。
- Tier B/C の --commit 省略時も実 HEAD を採取する。指定時は Git が解決したコミットと照合し、証拠には常に完全な実 HEAD を記録する。
- GUI に影響する core 変更は R-2 の入力検査条件だけ。見た目・hint の文面は変更しない。

## 質問・依存・残件

- 契約変更は発注書で明示された R-2/R-4/R-6/S-7 の範囲。追加の要件変更なし。GUI の既存テストへの対応は [QUESTIONS.md](QUESTIONS.md) の M7-fix-Q1。
- 依存追加・版更新なし。NOTICE の追記対象なし。既存 TypeScript を静的検出にも使用。原典スクラッチの npm ci は既存の low1/high1 を報告したが、原典依存は変更していない。
- 最終受け入れ・交差レビューは L2。GUI の見た目と文面・スクリーンショットは m7-gui 担当範囲。Windows 以外の実行・リモート CI・公開確認は本タスクで主張しない。
