# M2a REPORT — host・run・操作定義表・スキーマ

実装と実行証拠の報告である。受け入れ判定とパス・run の安全性の交差レビューは L2 に委ねる。

## 起動時チェック

- L3 工学担当。発注は Codex 6.1 sol / high。モデル切替・サブエージェント利用なし、縮退レベル1相当。自己判定になるゲートなし。
- 指定ブランチ `m2a-host`、着手時コミット `288b0ab6de585f0c291fd7fa228f47df054a56ac`、着手時の作業ツリーはクリーン。
- Windows、Node v24.15.0、npm 11.12.1。コマンド・対話・ネットワーク利用可。Linux 環境なし。
- REQUIREMENTS の必須指定節と発注が指定する節、ルート AGENTS、CONTRACT M0b 全文、WORKFLOW、M1 の台帳・core・移送 TODO を確認した。発注の DIRECTION は会話中のものを使用した。
- 原典・CyberSprite への書込・依存導入・実行、push・公開は行っていない。

## 実装したもの

- `src/host/io.ts`・`paths.ts`: 独立したテンプレート再帰読込、dot entries / node_modules 除外、同梱フォントの SHA-256、BOM 付き request、添付解決、WAV ヘッダ / ffmpeg による尺補完、全パス検査後の排他的なフォルダ / ZIP 書出し。
- `run-options.ts`・`worker.ts`・`runs.ts`・`locks.ts`・`run-result.ts`: 操作表の argv だけの直接起動、worker 所有のログ・台帳、heartbeat、待機、取消・上限時間・lost、ジョブ排他、鮮度と終了コードの照合、原典0.4の完了 stdout による結果復元。終了コードの分類は host に集約した。
- `project.ts`・`report.ts`・`status.ts`・`tools.ts`: JSON Pointer / Merge Patch と実バイト SHA-256、限定した記録と PNG の取得、毎回ファイルからの状態導出、QC stale、MV QC 対象外、doctor、npm JavaScript entry の解決。
- `operations.ts`・`types.ts`・`input-schemas.ts`・`output-schemas.ts`: 契約の23操作、日本語説明、ハンドラー、読取 / 書込 / run、公開フラグ、既定 wait、上限、CLI 専用理由を持つ共通操作表。公開入口は `src/host/index.ts`。
- `schemas/` に M2a 所有の19スキーマ。`tools/write-schemas.ts` で明示的に再生成する。外側の操作入力は閉じ、request は core の defaults と検査関数を共有する。任意の patch・既存の場面本文を新しい検査ゲートにはしていない。
- `tests/host-*.test.ts`、`tests/fixtures/host/`、`tests/helpers/host.ts` を追加。M1 のテンプレート読込 TODO を実行テストに変更し、機械可読台帳と `docs/PORTING_LEDGER.md` を更新した。
- `tools/smoke-host.ts`: 偽スクリプト以外に、実際に生成したジョブの QC・sound・voice・imagegen dry-run を動かす開発用確認。

## 受け入れ条件ごとの証拠

| 条件 | 実行証拠・状態 |
| --- | --- |
| Windows の npm test / TS-07 | `npm test`: tests 154、pass 145、fail 0、cancelled 0、skipped 0、todo 9。TODO は既存の M2b 担当9件だけ。host の追加31件と移送したテンプレート読込は実行済み |
| TS-07 の状態 | 完了・ゲート不合格・異常終了・QC 終了と report の矛盾・取消・時間切れ・lost・E_BUSY を検証。取消と時間切れでは子孫 PID の消滅と次の排他取得を確認。別プロセスのクライアント終了後の継続、5秒 heartbeat、50秒以内の wait、UTF-8 バイト offset も確認 |
| CL-11 / MC-02 | Windows の `&`・全角・空白・260文字超の cwd で実行。`..`、ドライブ、UNC、区切り、大文字小文字、末尾ドット・空白、ADS、予約名、未作成の親、junction、allow-dir の添付限定を検証。ジョブ内 reports / .smm の外向きリンクも拒否 |
| symlink の代替 | この PC ではディレクトリ symlink が EPERM。テストは理由を診断出力し、Windows junction で同じ境界外拒否を実測した。テスト全体の skip は0 |
| AR-06 | `tests/host-files.test.ts` の7ケース（minimal、MV 横・縦、anime、motion、mixed、複数添付）で、独立読込したブラウザ ZIP・host フォルダ・host ZIP の全パスと本文が一致。尺は request の明示値を使用 |
| AR-03 / MV 非退行 | npm test の AR-03 2件、JT-11 golden 11ケース、制作ハーネス・フォント・原典表明の照合を実行。core / job-template / 同梱フォント / CONTRACT / REQUIREMENTS に変更なし。テストの git 起動禁止検査も実行 |
| 鮮度・JT-12 | 古い validate.json と末尾未到達のスクリプトを組み合わせ、過去の pass を採用せず failed / E_INTERNAL になる。schema_version 0.4・generator なし・validate.json なしで status と validate の pass / fail / 異常を検証 |
| CL-07 / PH-03 | 実ジョブの QC fail は ok:true / exit 1。MV QC・voice none・音響無効は対象外 / 0。Codex 不在の imagegen は助言 / 0、strict だけ fail / 1。音響 plan の入力不正は E_INPUT_INVALID / 2。ghost 件数は verdict を作らない |
| スキーマ | 操作入力の未知キー拒否、出力の成功 / 失敗封筒、永続 RunRecord と表示 Run、結果・状態・検査 JSON を検証。欠落した hint、誤った状態・結果型を拒否する負例も実行。19ファイルと実装定義の一致を検査 |
| build | `npm run build`: 終了0 |
| 深さ1の複製 | `node tools/ci-local.mjs`: 実装コミット 686d78e の深さ1複製で終了0。npm ci、build、npm test（154 / pass 145 / fail 0 / todo 9）、workspace の test / build を完了。GUI は現時点で専用 scripts なしのため if-present で実行対象なし |
| 交差レビュー | L2 / Opus によるパス・run の交差レビューは未実施。実装者から受け入れ判定は出していない |

## 実動確認の出力

`node --experimental-strip-types tools/smoke-host.ts` は終了0。生成された68ファイルを持つジョブの実スクリプトを実行し、次を取得した。

```json
{"generated_files":68,"qc":"fail","qc_exit_code":1,"sound":"not_applicable","voice":"not_applicable","style_mode":"anime","imagegen":"completed","validate":"E_DEPS_MISSING","schema_errors":0}
```

`node --experimental-strip-types --test tests/host-extra.test.ts tests/host-run.test.ts tests/host-results.test.ts` は22件成功、失敗0。AR-06 等を含む残る9件は npm test で実行した。最終の尺補完 hint と dry-run のパス拒否は `node --experimental-strip-types --test --test-name-pattern 'CL-01|host generation' tests/host-files.test.ts` でも2件成功を確認した。

## 決定

- worker と script は別 PID を保存し、起動元が worker の所有権を確認してから run を返す。保存用台帳に job の絶対パスを入れず、表示する側が job を補う。
- heartbeat は5秒。15秒以上古く、worker の不在を確認できたときだけ lost を導出する。read-only の取得では書き戻さない。生きている PID や権限不足を不在扱いしない。
- 排他は `wx` で予約し、所有トークンと PID を保持する。所有権移管と古い予約の回収をガードで直列化する。run の予約は heartbeat の起動猶予と worker / script の不在も確認して回収する。孤立した script が生存していれば E_BUSY とし run_cancel を案内する。
- 所有者不明の破損予約、または回収ガード自体が異常終了で残った場合は推測で消さず E_BUSY に止める。通常の古い write.lock は不在確認後に回収する。これは二重実行を避けるための保守的な扱いである。
- 取消・時間切れは Windows では System32 の taskkill.exe を `/PID`・`/T`・`/F` の配列で起動し、終了を確認する。POSIX は独立した script のプロセスグループへ SIGKILL を送る。script 停止と排他解放の後に終端状態を公開する。
- Windows の長い cwd は `path.toNamespacedPath` で渡す。文字列連結による shell command や `.cmd` 起動は使わない。setup は npm-cli.js を node で起動し、lock があれば ci、なければ install。
- Windows の台帳読取と rename の競合で EPERM を再現した。対象を unlink せず、EPERM / EACCES / EBUSY だけ最大約5秒再試行する。project の置換も同じ処理を使う。連続読取中の40回置換をテストした。
- 調査中に6ジョブ並列・計60回の起動で6回の失敗を再現し、上記修正後は同じ60回すべて成功した。再現用スクリプトは `.agent-work/` のローカル調査物で、製品・テスト件数には含めない。
- すべての run で同じ結果収集・終了コード分類を使う。検査を host で再実装せず、fresh report / 完了 stdout と終了コードを照合する。既存の音声・音響スクリプトが出す明示的な入力エラーは、そのメッセージの証拠から分類する。
- 外側の request 検査は常に core の validateRequest を通す。MV の自動尺補完に失敗した場合も原典のエラー文言を保ち、hint で musicDurationSec の明示を案内する。
- スキーマ検査の追加依存を避けるため、採用した標準キーワード部分集合の検証器を host 内で実装した。スキーマ定義と生成済み JSON はテストで固定する。新しい検査ゲートは追加していない。

## 契約・要件への質問

[QUESTIONS.md](QUESTIONS.md) に記録したとおり、契約変更の提案・未回答質問はない。契約本文は変更していない。

## 依存・ライセンス

依存の追加・更新なし。既存 lock に対する `npm ci` は成功（17 packages、audit 0 vulnerabilities）。標準 Node API と既存 jszip だけを使用し、NOTICE の変更はない。setup のテストは依存なしの専用パッケージを使い、npm の audit / fund / update-notifier をその fixture の設定で無効にする。外部ツールを自動導入していない。

## 残った課題・受け渡し

- L2 による受け入れと、Opus のパス・run 安全性の交差レビューが必要。
- POSIX の process group 停止、Linux の symlink とパスの実測は未実施。分岐は実装済みだが、ubuntu CI の実行証拠では代用していない。
- この PC でのファイル symlink 実測は権限不足。junction の代替実測を記録した。
- Remotion の実レンダー、Aivis 実接続、実費の画像生成、依存を含む実ジョブ setup は本作業では実行していない。M3 / M7 の Tier B / C で確認する。M2a では偽スクリプト、生成ジョブの依存不要スクリプト、依存なし npm パッケージで経路を動かした。
- M2b は readRequest の request ファイル親を context.requestDirectory として維持して共通 generate を呼ぶ。CLI は execute、前面待ちは getRun / readRunLog、終了コードは errorExitCode と終端 run.exit_code を使える。stats の任意ファイル読取には host の readTextInput を使える。BOM 読取の追補後も CL-01 の1件と build は終了0。
- M3 は operations / exposedOperations を登録の正本にし、schemaRegistry の参照も解決して outputSchema を提示する。PNG の Uint8Array は入口で base64 / image ブロックに変換する。CLI 専用の mcp serve の起動処理と version スキーマの所有は M2b / M3 に残る。
- GUI・アイコン・README の見た目や文面は変更していない。見た目判断の TODO はない。

## M2a-fix

### 起動と対象

- L3 工学、モデル切替・サブエージェント利用なし。指定の `m2a-host`、基準 `e32b689b1d3b5ee664a72cd56aa0a452317d8e7c`、着手時クリーン。Windows / Node v24.15.0。受け入れの判定は L2 に委ねる。
- REQUIREMENTS の指定節、AGENTS、CONTRACT M0b、WORKFLOW、M2a REVIEW・既存 REPORT を確認した。修正発注は会話中の M2a-fix を正本とした。
- 変更範囲は `src/host/`、host のテスト・fixture、本 REPORT。core・job-template・フォント・要件・契約・操作表の定義・公開スキーマは変更していない。

### 指摘への対応と証拠の対応表

テスト名は `tests/host-fix.test.ts`。別ファイルの場合だけファイル名を添えた。

| 指摘 | 対応 | テスト名・証拠 |
| --- | --- | --- |
| M-1 | 絶対パス添付を allow-dir の文字列上の範囲・名前空間と照合してから FS に渡す。UNC・device・extended の暗黙許可なし。安全確認の FS エラーは E_PATH_DENIED、対象の ENOENT は添付不在として分類 | `M-1 denies absolute UNC device and outside attachments before filesystem access` は realpath / stat / lstat の呼出0件を表明。allow-dir なし・無関係な allow-dir の両方 |
| M-2 | worker / script に PID と起動時刻を記録。Windows は配列引数の PowerShell / CIM CreationDate ticks、Linux は /proc/stat starttime。既知の不一致は不在、照合不能は停止せず保留。ロックにも所有プロセスの同一性を保存 | `M-2 PID reuse script never kills unrelated process or blocks recovery`、`M-2 PID reuse worker never kills unrelated process or blocks recovery`、`M-2 unknown process identity never receives a stop signal`。無関係な実プロセスを生かしたまま lost・ロック回収・取消・次の run を確認 |
| M-3 | Windows と Linux の固有テストを分け、skip に対象 OS と理由を明記。POSIX のファイル名・symlink・別セッションの子孫停止は ubuntu で実行される構成 | `MC-02 win32 rejects reserved names ADS and trailing dots and folds case`（host-files）、`R-6 linux cancellation stops a detached grandchild`、`P-2 POSIX generated filenames preserve browser bytes`。ubuntu の実行証拠は L2 持越し |
| R-1 | restrictToRoot の report と相対指定添付で open 後の nlink > 1 を拒否 | `R-1 rejects hardlinked reports and relative root attachments`。NTFS の実ハードリンクで E_PATH_DENIED |
| R-2 | open 後の handle.stat と再検査済み realpath の stat の dev/ino を照合。root の実体も固定して再照合。生成・project・台帳・ログ・予約の作成は確認済みの親の直下で行い、作成後に親の実体を再照合 | `R-2 detects a read replacement after open and a parent replacement after creation`。通常の生成・project patch・run・排他の既存テストでも共通経路を通す |
| R-3 | cancel の worker 不在にも15秒の猶予。worker は保存前に台帳を読み、終端なら上書きしない。予約の移管・解放は owner と token を照合 | `R-3 releaseOwnedLock requires the matching token even for the same owner`、`R-3 worker save preserves an externally written terminal record`、`R-5 real worker death retains startup grace and recovers a surviving script` |
| R-4 | MCP のログ末尾は job / root / host 導入先と実体パス、file URL、区切り・JSON escape の形を置換。worker のエラー出力は code / message / reason だけ | `R-4 MCP log tails redact file URLs realpaths and host installation paths`。空白・日本語をパーセント符号化した file URL を含めて確認 |
| R-5 | startRun から本物の worker を起動して強制終了し、実時間で heartbeat の15秒失効、lost、回収、次の run まで確認。時間切れも startRun → runTimeout → worker → 停止 → 次の run | `R-5 real worker death recovers after the script stops`、`R-5 real worker death retains startup grace and recovers a surviving script`、`R-5 startRun timeout uses runTimeout worker stop and next-run recovery` |
| R-6 | Linux は /proc で別セッションを含む子孫を採取し、同一性を照合して SIGTERM、750ms 後に SIGKILL。Windows は同一性確認後の taskkill /T /F | `R-6 linux cancellation stops a detached grandchild`、`R-6 win32 cancellation stops a detached grandchild`。子は detached: true、SIGTERM を無視する fixture |
| R-7 | npm_execpath は絶対パスの npm-cli.js だけ。PATH の空・相対要素を候補にしない | `R-7 npm entry ignores yarn and relative PATH entries`。yarn.js を無視し、相対候補を FS へ渡さないことも確認 |
| P-1 | allow-dir の存在・ディレクトリ・実体を検査し、設定不正と添付不在を区別する検査関数を提供 | `P-1 invalid allow-dir differs from an absent attachment and safety errors are denied` |
| P-2 | 生成時のパス境界は原典 generate-job.ts の書出先配下検査を維持し、Windows 固有の禁止・大小文字衝突だけ win32 に限定。QC の入力キーを検査できなければ stale: true | `P-2 POSIX generated filenames preserve browser bytes` は GUI 相当 ZIP とファイル全件のバイトを比較。`P-2 invalid QC input keys are stale and P-7 status keeps twenty recent runs` |
| P-3 | heartbeat 保存失敗、停止失敗、実行失敗に details.reason を付け、取消と区別。停止失敗を終了待ちと競合させ、script が終了しない場合も失敗経路へ進む | TS-07 異常終了・取消・時間切れの実経路と R-4 の worker エラー記録を確認。heartbeat の永続化障害自体の注入テストは未追加 |
| P-4 | run 起動後の状態取得失敗は、開始した run をエラー封筒に残す | `P-4 a post-start observation failure keeps the active run in the error`。取得時の EACCES を注入し run を使って取消 |
| P-5 | voice の engine 許可を予約取得後にも再検査 | `P-5 voice authorization is rechecked after lock acquisition without creating a run`。取得中の project 変更を注入し、E_DISABLED・台帳なし |
| P-6 | doctor は未許可 URL と構文不正 URL の理由を分けて返す | `P-6 doctor reports an invalid engine URL accurately`、既存 engine authorization（host-extra） |
| P-7 | status.runs は実行中全件＋直近終端20件 | `P-2 invalid QC input keys are stale and P-7 status keeps twenty recent runs` |
| P-8 | 破損 write.lock / 残存 reclaim.lock の hint に、全 run と所有プロセスの停止確認という条件とジョブ相対の削除対象を明記 | `P-8 damaged reservation hints name job-relative recovery files` |
| P-9 | mtime の精度による鮮度判定の限界を以下に記録 | 既存 `stale validate report is never adopted after early script termination`（host-run）。比較の許容幅を広げて過去結果を採用する変更はしていない |

### 検証結果

| コマンド | 結果 |
| --- | --- |
| 初回 `npm test` | tests 173 / pass 160 / fail 2 / skip 2 / todo 9。動的な追加テスト名を台帳スキャナーが拒否し、並列予約のエラーが E_BUSY 以外になった。修正後に以下を再実行 |
| `node --experimental-strip-types --test tests/host-results.test.ts tests/host-fix.test.ts tests/porting-ledger.test.ts` | tests 27 / pass 25 / fail 0 / skip 2 / todo 0、終了0。台帳検査と並列予約を含む |
| `npm test`（作業ツリー） | tests 177 / pass 166 / fail 0 / cancelled 0 / skip 2 / todo 9、終了0。skip は Linux 子孫停止と POSIX ファイル名、TODO は既存 M2b の9件 |
| `node --experimental-strip-types --test --test-name-pattern 'atomic reservation\|P-5\|P-4\|R-7' tests/host-fix.test.ts tests/host-results.test.ts` | 最後の共通書込ヘルパー追補後、4件成功 / 失敗0、終了0 |
| `node --experimental-strip-types --test --test-name-pattern 'TS-07 completes\|TS-07 unexpected\|R-5 startRun timeout\|atomic reservation' tests/host-run.test.ts tests/host-fix.test.ts tests/host-results.test.ts` | 子の終了後に取得した同一性を破棄する追補後、4件成功 / 失敗0、終了0 |
| `npm run build` | 最終実装で終了0 |
| `node tools/ci-local.mjs`（2792f36） | 深さ1複製、npm ci（追加17、audit 0）、build、npm test（177 / pass 166 / fail 0 / skip 2 / todo 9）、workspace test / build がすべて終了0 |
| `node tools/ci-local.mjs`（1c1eac1） | 最終実装 `1c1eac1e3b5489931dc9e116a427b8726fad4e77` の深さ1複製で終了0。npm ci、build、npm test（177 / pass 166 / fail 0 / cancelled 0 / skip 2 / todo 9）、workspace test / build がすべて終了0。GUI は現時点で専用 scripts がないため if-present の実行対象なし |
| `node --experimental-strip-types tools/smoke-host.ts`（1c1eac1） | 68ファイルを持つ実ジョブを生成・実行、終了0。qc:fail / qc_exit_code:1 / sound:not_applicable / voice:not_applicable / style_mode:anime / imagegen:completed / validate:E_DEPS_MISSING / schema_errors:0 |
| `git diff --check e32b689b1d3b5ee664a72cd56aa0a452317d8e7c...HEAD` | 出力なし、終了0。変更対象コードと REPORT の CRLF は0件 |

### 決定

- 公開 RunRecord / Run の形を変えず、内部ファイル `.smm/runs/<id>/processes.json` に worker・script の PID / birth と予約 token を保存する。絶対パス・コマンドライン・秘密を保存しない。公開スキーマの変更は不要と判断した。
- 所有者を照合できない PID は停止しない。不在または既知の不一致と、権限不足・CIM 障害・識別情報不足を区別し、後者が生存中なら排他を保持する。
- 同じ host プロセスの同一性取得は Promise を共有する。並列予約時の CIM 多重起動を避け、他プロセスは都度照合する。
- ChildProcess が取得中に終了した場合は識別情報を採用しない。終了後にその PID が再利用されていても、別プロセスの同一性を所有情報として保存しない。
- 時間切れ E2E は製品の入力・timeout 値を変更しない。worker 専用の試験 preload で5分の QC タイマーだけ1秒に短縮する。startRun・runTimeout・worker・停止・回収は製品の経路を通す。lost の15秒は実時間で待つ。
- read-only の lost 導出は保存しない。書込側の回収・取消時だけ永続化・予約解放を行う。
- 最初の全体テストで、追加テストの動的タイトルが既存台帳スキャナーに未対応であること、並列予約時の同一性取得の多重実行を検出した。既存の基線・台帳の表明は弱めず、テスト名を既存形式に合わせ、自己 PID の取得を共有した。

### 契約・依存・残課題と M3 への申し送り

- QUESTIONS の新規質問・契約変更・要件変更・依存追加・ライセンス追加はない。NOTICE の変更なし。外部ツールの導入、原典への書込、push・公開は行っていない。
- M3 はサーバー起動時に `validateAllowDirectories(context)` を呼び、不在の allow-dir を起動時にも検出すること。host 操作時も同じ検査を行う。
- **残るパスの競合リスク**: Node のパスベース API による照合であり、OS のディレクトリハンドル相対 open / rename を使う隔離ではない。同じ権限で親を差し替え、確認後に元へ戻す攻撃や、照合直後のリンク・本文の変更は完全には排除できない。書込後の検出は、既に発生した副作用を巻き戻すものではない。通常の atomic rename と読取の競合でも一致確認が拒否を返す可能性がある。
- **残るプロセスの競合リスク**: 同一性の照合とシグナル送信はOSの単一操作ではない。Linux の子孫採取後に新しく別セッションへ逃げるプロセスも完全には拘束しない。Windows の Job Object の常時所有に相当する隔離ではない。ジョブ内スクリプトは従来どおり npm run と同じ信頼範囲であり、任意の悪意あるコードを隔離する sandbox ではない。この点を M3 の安全説明へ引き継ぐ。
- **mtime の限界**: FAT 系・一部ネットワーク FS で時刻粒度が粗い場合、新しい report が started_at より古く見えて採用されないことがある。過去結果を今回の成功として返すより保守的に拒否する。ローカル NTFS の結果を他 FS の保証とはしない。
- ubuntu の Node 22 / 24 の実行証拠は、L2 裁定に従い CI 作成後の残課題。Windows では Linux の子孫停止と POSIX ファイル名テストを理由付き skip とする。Windows junction を検証し、symlink 権限不足は既存の診断出力で明示する。
- GUI・アイコン・README の判断事項・TODO は追加していない。実装者の受け入れ判定は出さず、L2 の再確認を待つ。
- 実装コミットは `2792f36` と `1c1eac1`。本 REPORT の証拠確定は別の文書コミットとする。
