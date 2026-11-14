# M2b REPORT — CLI

実装と実行証拠の報告である。受け入れの判定は L2 に委ねる。

## 起動時チェック

- L3 工学担当。発注は Codex 6.1 sol / high。モデル切替・サブエージェント利用なし。縮退レベル1相当、自己判定になるゲートなし。
- 指定作業ツリー、ブランチ m2b-cli、着手時クリーン。Windows / Node v24.15.0。コマンド・対話・ネットワーク利用可、Linux 環境なし。
- REQUIREMENTS の必須節と発注指定節、AGENTS、CONTRACT、WORKFLOW、M0-Q3、M2a REPORT、PORTING_LEDGER を確認した。DIRECTION は会話中の発注を使用した。
- 最初の build / npm test は依存未導入で失敗。既存 lock の npm ci は追加17 packages / audit 0 vulnerabilities、終了0。以後の基線実行は177件 / pass 166 / fail 0 / skip 2 / TODO 9、終了0。
- 原典の generate-job.test.ts は読取だけを行い、原典・CyberSprite での実行・書込はない。push・公開・グローバル導入は行っていない。

## 実装したもの

- src/cli/commands.ts: node:util の parseArgs、操作定義表からの全コマンド・alias 登録、スキーマからのオプション型・kebab-case 変換、位置引数とファイル入力の受渡し。
- src/cli/index.ts / main.ts: 共通 execute の呼出、JSON 封筒1個、human 要約、PNG base64、エラー終了コード。run は wait_ms:0 で開始し readRunLog のバイト offset で差分を stderr へ流し、run_get を繰返す。detach と runs wait / get / logs / list / cancel を実装した。
- tsconfig.build.json / package.json: tsc のビルド済み JS を dist/ に出力し、bin の shin-motionmaker / smm が dist/cli/main.js を指す。npm test は前処理で build を行い、クリーンな状態でもビルド済み入口のテストを実行できる。
- schemas/version.schema.json: M2b 所有の smm.version/1 を追加。host の既存出力スキーマ一覧に1項目を登録し schema コマンドから取得可能にした。既存スキーマ・操作表・CONTRACT は変更していない。
- tests/generate-job.test.ts: 移送9件を完成。tests/fixtures/porting-ledger.json / docs/PORTING_LEDGER.md / 台帳検査は81件すべて active、TODO 0を表明する。
- tests/cli.test.ts / cli-script-exits.test.ts / helpers/cli.ts: TS-02・TS-03・CLI 側 TS-05、実スクリプトの終了値、UTF-8 ログ、npm workspace の回帰検証。
- docs/CLI.md、tools/verify-cli.mjs、tools/test-cli-tier-b.mjs: 正確さを優先した構文・封筒・対応表と、コマンド例・実スクリプト・Tier B の再現手順。

## 受け入れ条件ごとの証拠

| 条件 | 状態・コマンド・出力 |
| --- | --- |
| npm test / TS-02 | 全体実行は185件 / pass 183 / fail 0 / cancelled 0 / skip 2 / TODO 0、終了0。JSON 1個・封筒スキーマ・終了0〜4・助言だけの0・BOM・記号のあるパス・detach / wait を含む |
| TS-03 | request-schema.snapshot.json と request スキーマ全体を比較。方向性・指示・理解ゴール等の自由記述の型を明示的に文字列と表明 |
| TS-05 CLI 側 | 共通 operations の全 cli 名・alias をそのまま登録。候補の同一入力の result を execute と照合。公式 MCP 往復は M3 が担当 |
| AR-06 / P4 | biim / anime / motion / mixed / MV の5モード。CLI フォルダ・CLI ZIP・GUI と同じ generateJob の ZIP の全パス・本文・フォントを比較。最小入力・既定値、原典の全拒否ケース、既存の空フォルダ / ファイル / 兄弟 / 編集保持を検証 |
| TS-01 | 基線81件に対する移送先をすべて実行テストへ対応。機械可読台帳の未移送・TODO は0件 |
| CLI 文書例 | node tools/verify-cli.mjs は終了0。[CLI-EXAMPLES.json](CLI-EXAMPLES.json) に54件のコマンド・直接スクリプト実測を保存。標準出力は毎回 JSON.parse と1行検査を実行 |
| ビルド済み JS | npm run build は終了0。node dist/cli/main.js version / generate / qc 等を上記54件で実行。型除去フラグ・グローバル導入なし |
| Tier B | npm run test:tier-b は終了0。[TIER-B.json](TIER-B.json) に11件。実依存 setup、validate の pass / fail、原典0.4の report なし pass / fail、実 ffmpeg の ghost 走査を確認 |
| ci-local | コミット後の深さ1複製で実行し、結果を追記する |

## 終了コードの実測

- 元の1を単独で fail と扱わず、host の fresh report / 完了 stdout / 事前分類を使用する。検査ロジックを CLI に移していない。
- qc: 制作記録なしは元1 → ok:true / fail / 1、検証専用の合成記録では元0 → pass / 0。MV は元0 → not_applicable / 0。stage 不正の元2は起動前に入力2。制作記録がディレクトリの場合の元2は E_INTERNAL / 4。
- imagegen: CODEX_BIN に検証専用の不在パスを渡し、Codex を起動せず SKIPPED の元0 → 助言 / 0、strict の元1 → ok:true / fail / 1を確認。入力欠落の元1は CLI では起動前に2。
- voice: engine none の元0 → 対象外0、未対応 engine の元1 → E_INPUT_INVALID / 2。sound: 無効の元0 → 対象外0、有効 cue の元0 → 成功0、空 cues の元1 → E_INPUT_INVALID / 2。
- ghost: 動画不在の元1 → 起動前 E_INPUT_INVALID / 2。run: 不正 mode・依存未導入 preview は元1、CLI は既知 target だけを渡し依存不足を3に分類。
- validate は実依存で R4 の pass / 0、タイトル欠落による fail / 1。R4 を許容差分の置換対で逆変換した原典0.4でも、report なしで完了 stdout / OK 行と検査エラーから同じ0 / 1となった。
- ghost は実 ffmpeg で生成した30フレームの動画を実走査し、元0 → verdict なし / advisories 1件 / CLI 0。各行の根拠は docs/CLI.md の表と実測 JSON に対応する。
- 偽スクリプトの異常終了も CLI で4を確認。runs wait は台帳取得の ok:true を維持し、元の run の1 / 4で終了する。get / logs / list / cancel は取得成功なら0。

## host の最小修正

- src/host/worker.ts: Windows の setup に通常形式の cwd を渡す。他のジョブ内スクリプトの長いパスには従来の拡張形式を維持。
- 実ジョブの最初の setup は npm の Invalid file: URL, must comply with RFC 8089、元1 → E_INTERNAL / 4で失敗した。npm の workspace file URL が拡張 cwd を解釈できないことを run / npm ログで確認した。
- 依存なしの workspace でも同じ経路を検証する CLI 回帰テストを追加し install / ci がともに0で終了した。操作表・公開 API・契約の定義は変更していない。
- src/host/output-schemas.ts の version 登録は M2b 所有スキーマの追加であり、既存結果の定義変更はない。

## 決定

- 操作名・オプション型は共通表を正本とし、位置引数とファイル入力への変換だけを CLI に持つ。新しい場面操作・創造項目・ゲートは追加しない。
- request は host の readJsonInput で BOM を除去し、requestDirectory をファイル親にして共通 generate に渡す。添付を二重読込しない。
- 前面待ちは100msの間隔で取得し、ログ本文の既読バイト位置を stream ごとに保持する。取得中に異常を返しても開始済み run を封筒に残す。
- version.commit は現段階では null。契約の許容型を使い、CLI の実行時に git は起動しない。
- 旧 CLI の help に相当する入力定義の取得は、契約にある schema operation-inputs と E_USAGE.hint に移す（P4）。専用 help 操作・独自の成功封筒を増やさない。
- コマンド例の採取は .agent-work/ の専用ジョブで行う。verify-cli.mjs は解決済みパスがその専用ディレクトリであることを検査して再作成する。Tier B は導入済みの専用ジョブを再利用できる。
- 最終確認は ci-local の終了値を Node の spawnSync から採取し、PowerShell の NativeCommandError 変換を避ける。
- Tier B の生成は初回 setup 失敗前に実行した。cwd 修正後は同じ生成ジョブで setup から再開し、11件の結果を保存した。生成ジョブ以外の依存・原典には書き込んでいない。

## 追加の確認

- 最終の引数処理・PNG 整形・取得エラー時の run 保持を含む npm run build は終了0。
- node --experimental-strip-types --test --test-name-pattern 'UTF-8 log|reports usage|rejects invalid JSON' tests/cli.test.ts tests/generate-job.test.ts は3件成功 / 失敗0 / skip 0 / TODO 0、終了0。部分文字を含むログの差分転送、原典の全拒否入力、空 out・help 相当の入力定義取得を確認した。

## 契約・要件への質問

[QUESTIONS.md](QUESTIONS.md) のとおり未回答質問・契約変更提案なし。

## 依存とライセンス

製品の依存追加・版更新なし。標準 Node API と既存 TypeScript / jszip を使用し、NOTICE の追記なし。Tier B は原典から維持している生成ジョブの固定依存を setup で導入する。外部ツールの自動導入・有償生成は行っていない。

## 残課題と受け渡し

- L2 が M3 マージ後に mcp serve とサーバーを結線する。M2b の入口は日本語の未接続 message / hint と E_DISABLED / 3を返す。AR-03 の cli / mcp 相互 import 禁止を維持する構成で結線すること。
- TS-05 の公式 MCP 側の result 比較・MCP protocol roundtrip は M3 / 統合時の担当。CLI の全登録集合と共通結果の比較は本作業で用意した。
- Linux / Node 22 はこの PC では未実測。既存の Linux 子孫停止・POSIX ファイル名の2件は理由付き skip。ubuntu CI の確認は L2 持越し。
- Remotion Studio のブラウザ操作・実レンダー・実 Aivis・実費画像生成は M7 の実機検証へ。見た目・アイコン・README 文面は変更せず、文面の推敲は M6へ委ねる。
- host の mtime・パス照合・PID 照合の制約は M2a REPORT を継承する。本作業で隔離の保証を強めていない。
