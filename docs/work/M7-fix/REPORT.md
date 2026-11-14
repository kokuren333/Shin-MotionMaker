# REPORT — M7-fix

指定された修正と実機検証は下記のとおり実施した。**受け入れ条件は未達**：R-2 と整合しない GUI 単体・e2e の既存フィクスチャが各1件残り、ci-local は GUI 単体で終了1。発注の gui/ 変更禁止を守り、M7-fix-Q1 の回答待ちとしている。L2 による受け入れ判定・交差レビューは行っていない。

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
| `npm run test:e2e --workspace gui` | 41/42、失敗1。solo の2人目の配置を拒否すると期待する既存フィクスチャ。M7-fix-Q1 へ追補 |
| `npm run build --workspaces --if-present` | 終了0、GUI の型検査と Vite ビルド完了 |
| `npm test`（最初の一式） | 終了0、219件 / pass217 / fail0 / skip2、366551.9502ms |
| `node tools/ci-local.mjs`（`8d2369b`、最初の再実行） | 本体219件 / pass216 / fail1 / skip2、329975.7458ms。MC-05/MC-15 の既存テストが10秒の偽処理に10秒の待機枠を与え、まだ running の応答に verdict:pass を期待した。GUI 段へ進む前に停止 |
| `node --experimental-strip-types --test --test-name-pattern 'MC-05 and MC-15' tests/mcp.test.ts` | 待機枠を契約内の50秒へ変更後、1件 / pass1 / fail0、46815.8929ms。完了・verdict・進捗通知と排他の表明は維持 |

`git merge main` で main `0df32f3` を `c9fb606` に取り込み、衝突なし。G4-M2 の追跡済み発注・判定記録を採用した。`node tools/tier-b.mjs --commit HEAD~1` と runtime-smoke の同指定、および未追跡の一時プローブがある状態で両ツールの `--commit HEAD` を開発用スクリプトから実行した。4件すべて開始前に終了1で拒否し、プローブは finally で削除、作業ツリーはクリーンへ戻った。

最終の実装・テスト変更をコミット後、main を再確認した（Already up to date）。検証対象は `c0d10ca798b2689a50e91f3556dc73c09cfa3391`。以後のコミットは証拠・文書だけで、製品コード・テスト・テンプレートを変更しない。

## 最終の受け入れ条件ごとの観測結果

| 条件 | 実行結果・証拠 | 状態 |
| --- | --- | --- |
| npm test | c0d10ca の深さ1複製で219件 / pass217 / fail0 / skip2、426689.1241ms。MC-05/MC-15 も成功（31480.4686ms） | コマンド終了0 |
| GUI 単体 | 同じ深さ1複製で33件 / pass31 / fail1 / skip1、2550.7888ms。trio の2人目配置まで拒否する古い期待値 | 未達、Q1 |
| GUI e2e | 独立実行で41/42。solo の2人目配置を拒否すると期待する古いフィクスチャ | 未達、Q1 |
| node tools/ci-local.mjs | c0d10ca、2026-11-14T12:41:57.074Z〜12:49:48.814Z、471739ms。npm ci・ライセンス・ビルド・本体テスト完了後、GUI 単体で停止。既存 low1 の audit 表示あり、自動修正なし | 終了1、Q1 |
| GUI build | 型検査・Vite ビルド終了0。GUI の本文は変更なし | コマンド終了0 |
| check-licenses | 180項目、導入済130、非対応 optional50、許容集合外なし | コマンド終了0 |
| verify-cli | 54記録を既定の追跡外へ出力。M2b の既存実測ファイルの差分なし | コマンド終了0 |
| Tier B（CLI・MCP） | c0d10ca / template0.5.2、各68ファイルを生成。setup と validate の4 run が completed・元終了0・正規化終了0、validate は両方 pass。505834ms | コマンド終了0 |
| Tier C（CLI・MCP・原典0.4） | 同じ c0d10ca、全26 run completed。24件が元・正規化とも0、原典0.4の validate fail / QC fail の2件だけ期待どおり1。全ツールの revision.head / clean:true を記録 | 各コマンド終了0 |
| コミット・作業ツリー | 実装とテストは論理単位で M7-fix: の件名で保存。証拠・最終報告も別コミットに保存し、終了時 git status --short を確認 | L2 へ引渡し |

本体の skip2 は Linux 専用の子孫停止と POSIX ファイル名、GUI の skip1 は sh 不在のシェル引数検査。Windows の junction 検査は実行し、ディレクトリ symlink は権限不足の診断を保持した。Windows・Node v24.15.0 での実測であり、ubuntu や hosted runner の成功は主張しない。

## Tier B/C の再実行

```powershell
node tools/ci-local.mjs
node tools/tier-b.mjs --commit c0d10ca798b2689a50e91f3556dc73c09cfa3391 --evidence .agent-work/m7fix-evidence/tier-b.json
node tools/runtime-smoke.mjs --entry cli --commit c0d10ca798b2689a50e91f3556dc73c09cfa3391 --evidence .agent-work/m7fix-evidence/tier-c-cli.json
node tools/runtime-smoke.mjs --entry mcp --commit c0d10ca798b2689a50e91f3556dc73c09cfa3391 --evidence .agent-work/m7fix-evidence/tier-c-mcp.json
node tools/runtime-smoke.mjs --entry cli --legacy-job ".agent-work/m7-legacy-source/jobs/Legacy source" --commit c0d10ca798b2689a50e91f3556dc73c09cfa3391 --evidence .agent-work/m7fix-evidence/tier-c-legacy.json
```

実行時の --commit は HEAD を指定し、ツールが上記の完全 SHA に解決・照合した。各ツールは開始時にクリーン状態を検査し、同じ HEAD から配布 JS を再ビルドした。ビルドとジョブ起動を順に終えてから、独立したジョブの依存導入・レンダーを並行実行した。

| 経路 | 実行日時（UTC） | 所要時間 | 結果・証拠 |
| --- | --- | --- | --- |
| Tier B（CLI・MCP） | 12:43:26.016〜12:51:51.850 | 505.834秒 | [tier-b.json](evidence/tier-b.json)、6操作（生成2・run4）、すべて終了0 |
| Tier C CLI | 12:44:22.567〜12:52:40.926 | 498.343秒 | [tier-c-cli.json](evidence/tier-c-cli.json)、8 run / 終了0 |
| Tier C MCP | 12:45:40.703〜12:52:46.347 | 425.614秒 | [tier-c-mcp.json](evidence/tier-c-mcp.json)、8 run / 終了0、各 run_get は50秒、1〜4回、protocol_errors:0 |
| Tier C CLI（原典 0.4 ジョブ） | 12:47:00.175〜12:53:27.881 | 387.691秒 | [tier-c-legacy.json](evidence/tier-c-legacy.json)、10 run、終了0が8件・期待する終了1が2件 |

日付はすべて2026-11-14。生成ジョブ名は `Tier B & ＆（全角）　・ 空白`、`Runtime & ＆（全角）　・ 空白`、`Legacy & ＆（全角）　・ 空白`。実レンダーは既存の640×360・6秒・180フレームの構成で、setup → sound → validate → preview → still(frame30) → ghost preview → final → ghost final を実行した。原典0.4は追加で validate fail と QC fail を観測し、R4 report が無いこと・status.generator:null も確認した。実 Aivis・有償画像生成・外部ブラウザの導入は行っていない。

CLI/MCP の出力5ファイルのハッシュは一致。全3経路の静止画 SHA-256 は `3d737258719e5b789ca6abd0275ebd0fca89307135746e2a88420527a58fae04`。動画と依存はハッシュ採取後に削除し、PNG と ghost JSON を evidence の経路別 artifacts に残した。検出件数は助言のままで、合否判定に使っていない。

証拠は [manifest.json](evidence/manifest.json) の21ファイル・336917 bytes（目録自身を除く）。[commands.json](evidence/commands.json) に単独検査の件数・終了値・生ログのハッシュ、[ci-local-final.json](evidence/ci-local-final.json) に最終の深さ1実行、[revision-rejections.json](evidence/revision-rejections.json) に4件の開始前拒否、[legacy-origin.json](evidence/legacy-origin.json) に原典生成の根拠を保存した。[ci-local.json](evidence/ci-local.json) と [tier-b-initial.json](evidence/tier-b-initial.json) は待機テスト修正前の記録として区別する。ローカルの絶対パスを含む生ログは追跡しない。

## 決定

- worker の起動確認前の失敗は error.details.reason で識別し、封筒・run の型と既存 status は変えない。原因 details があれば cause に保持する。
- 原典が無視する列挙値でも型・未知キーは検査する。JSON Schema は型を保ち、既存 enum を条件分岐に置く。モード・人数省略時は既定値を用いる。
- wait_ms の default は JSON Schema の注釈として出し、実際の既定値を適用する処理は共通 defaultWait に残す。validate は final 省略時45,000、true なら0を分岐に記す。
- R1 の出現数は表の順に `[2,1,1,1,1,1,1,1,1]`。R3 の追記を除去した後、各逆置換の直前に照合する。
- Tier B/C の --commit 省略時も実 HEAD を採取する。指定時は Git が解決したコミットと照合し、証拠には常に完全な実 HEAD を記録する。
- GUI に影響する core 変更は R-2 の入力検査条件だけ。見た目・hint の文面は変更しない。
- ci-local で再現した MC-05/MC-15 の待機境界を修正した。偽スクリプトは10秒のまま、完了を期待する呼出の待機だけを50秒へ広げる。製品・ゲート条件を変更せず、最終の全体検証を再実行する。

## 質問・依存・残件

- 契約変更は発注書で明示された R-2/R-4/R-6/S-7 の範囲。追加の要件変更なし。GUI の既存テストへの対応は [QUESTIONS.md](QUESTIONS.md) の M7-fix-Q1。
- 依存追加・版更新なし。NOTICE の追記対象なし。既存 TypeScript を静的検出にも使用。原典スクラッチの npm ci は既存の low1/high1 を報告したが、原典依存は変更していない。
- 最終受け入れ・交差レビューは L2。GUI の見た目と文面・スクリーンショットは m7-gui 担当範囲。Windows 以外の実行・リモート CI・公開確認は本タスクで主張しない。
- 未解決は Q1 の GUI 単体・e2e の各1箇所。単体は非 duo のエラー一覧から2人目配置の期待を外し、e2e の拒否試験は characterMode:duo を明示すれば、原典の条件と試験意図が一致する。gui/ の変更許可または m7-gui 側の反映が無いまま、この2箇所は変更していない。回答が届いた後の GUI・ci-local の成功証拠と L2 の判定が必要である。
