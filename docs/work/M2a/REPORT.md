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
