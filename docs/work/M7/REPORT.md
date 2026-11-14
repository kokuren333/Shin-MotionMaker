# M7 REPORT — 統合と Windows 実機検証

本報告は実装と実行証拠の提出である。受け入れ条件と G4 の判定は L2・別コンテキストのレビューに委ねる。

## 起動時確認

- 指定作業ツリーの `m7-integration`、基準 `f40fb77` から作業。開始時の追跡変更なし。モデル切替・サブエージェント利用なし。
- Windows / Node v24.15.0。REQUIREMENTS の必須節と M7 指定節、AGENTS、CONTRACT、CLI、MCP、WORKFLOW、既存 REPORT の残課題、VERIFICATION を確認した。DIRECTION は会話内の発注を正本として使用した。
- 原典と CyberSprite に書き込んでいない。原典の実行は既存の M0 スクラッチ複製（262c798）の generate-job だけで行い、生成先は検証用ディレクトリにした。push・repo 作成・公開なし。
- `job-template/`・同梱フォント・M6 担当文書に差分なし。見た目・アイコン・README の推敲判断なし。

## 実装

| ファイル・範囲 | 内容 |
| --- | --- |
| `src/core/form.ts`・`request.ts` | `formChoices` を公開。既存の列挙集合を shape と validateForm で共有。fps と1・2人目の配置も対象。既存の文言・エラー種別・validateForm のモード分岐を維持 |
| `src/host/input-schemas.ts`・`schemas/`・snapshot | defaults と formChoices から request schema を生成。既存の自由記述は string のまま。TS-03 と MCP tools snapshot を更新 |
| `gui/src/lib/request-io.ts` | `choiceIssues`・probe による GUI 独自検査を削除し、core の shape 結果をそのまま使用 |
| `tests/integration.test.ts`・`tests/helpers/entrances.ts`・`gui/e2e/run.mjs` | 全共有同期読取9種類の CLI/MCP result 一致。ブラウザ生成の解説・添付あり／MV を、CLI dir/zip・MCP dir/zip とパス・全本文バイトで比較。生成結果全体も同じ出力パスで一致 |
| `tests/mcp.test.ts` | 再起動試験の固定6秒待ちを release ファイルで同期し、置換サーバーが running を取得してから完了させる。既存の完了・verdict・台帳の表明に生存の表明を追加 |
| `tools/tier-b.mjs` | CLI・MCP の生成→setup→validate。MCP は wait_ms 付き run_get。実行記録・ハッシュを保存し一時ジョブを削除 |
| `tools/prepare-runtime-smoke.mjs`・`runtime-smoke.mjs`・`verification-lib.mjs` | 原典の6秒・字幕／note・アニメーション GLB・4音響 cue の構成を移植し、両入口で Tier C を実行。run・ログ・成果物のハッシュ、時刻、終了値を記録 |
| `tools/prepare-legacy-smoke.mjs` | 原典複製の generate-job で0.4ジョブを実生成し、原典 validate の基線ハッシュと一致することを確認。互換検証用の起源証拠を保存 |
| `tools/verify-pages.mjs`・`verify-pages-local.mjs` | HTTP・title・commit・JS/CSS・ヘッドレスブラウザの見出し／ZIP ボタン／コンソールを検査。再試行・待機上限・スクリーンショット保存。ローカルで8不一致の拒否と古い commit からの再試行を実行 |
| workflow・package scripts | Tier B は CLI/MCP 共通入口。runtime-smoke は Windows、手動と main push、Pages と独立。Pages は引き続き手動のみで3ジョブ、既存の verify 呼出先を実装 |
| `docs/CONTRACT.md`・`QUESTIONS.md`・`DOCS_FOLLOWUP.md`・`VERIFICATION.md` | 承認済み改訂履歴と、M6 への技術的申し送り、実測記録 |

## 受け入れ条件と実行証拠

| 条件 | 状態と証拠 |
| --- | --- |
| 全テスト・GUI | 初回全体は212件 / pass209 / fail1 / skip2。再起動試験を同期化した後の単独1件と、追加統合3件は成功。最終の全体結果は ci-local の確定記録に記す |
| AR-06・TS-05 | 解説・添付あり／MV の実ブラウザ2件で4つの生成経路と全パス・本文バイト一致。共有読取9種類で CLI/MCP result 完全一致 |
| Tier B | CLI/MCP とも68ファイル生成、setup completed / 0、validate completed / pass / 0。556.119秒。詳細は evidence/tier-b.json |
| Tier C | コード `506a5a893cbb4da0aabfbfa82ecc1d75f6c00d3f`。CLI 8 run / 672.551秒、MCP 8 run / 597.521秒、すべて completed・元/正規化終了0。MCP は各 run を wait_ms:50000 の run_get で取得 |
| JT-12 | 原典262c798の実生成0.4ジョブ、generatorなし。status と validate / qc / ghost / render を実行。10 run / 647.180秒。validate report 不在で pass/0・fail/1 を構成。QC fail/1 も ok:true / completed |
| ci-local | 証拠を含む統合コミットでこの後実行する。結果は文書だけの追記で確定する |
| Pages 検査 | 最終コードのサブパス配信で verify-pages CLI 終了0。正常経路、8不一致の拒否、再試行2回目成功。スクリーンショットと出力を保存 |
| G4 | L2 別発注のため未実施。実装者は判定しない |

コマンド・日時・各 run ID・状態・元/正規化終了値・成果物パスと SHA-256 は [VERIFICATION](../../../VERIFICATION.md) と evidence/ の JSON に保存した。保持ファイルの目録は evidence/manifest.json。一時ジョブの依存と動画は採取後に削除済み。

## 統合で扱った既存マイルストーンの残件

| 出所 | M7 の対応 |
| --- | --- |
| M0・M1 の runtime-smoke 移植、M2b・M3 の実レンダー未実測 | 共通オーケストレーターと Windows の CLI/MCP 実レンダーの証拠を追加 |
| M1・M2a・M2b・M3 の AR-06／TS-05 完成 | GUI の実ブラウザ ZIP と4つの CLI/MCP 出力を完全比較。共有読取操作全種類も同じ root/cwd で result を比較 |
| M4 Q1 | L2 承認の formChoices・shape 列挙検査を実装。GUI の独自検査を撤去 |
| M3 の MC-13 試験 | 最初の全体実行で1件失敗。旧 assert に応答詳細がなく原因は確定できなかった。単独再実行は成功。固定時間依存を除去し、再起動後の running 取得を追加した。製品 host の同一性・待機・安全規則は変更していない |
| M2b・M3 の0.4互換 | 従来の逆変換・偽ジョブ試験に加え、原典が実生成した0.4ジョブで確認 |
| M4 の公開後検査 | ローカルのサブパス配信で確認。実公開と公開前後比較は M8 |
| M5 の機械検査と見た目 | 既存のアイコン hash・寸法・由来のテストを維持。見た目の判断は M7 で行わない |
| M6 の文書推敲 | 指定文書を編集せず `DOCS_FOLLOWUP.md` に使い方と変更点を記載 |

## 決定

- `formChoices` は既存の form キーの集合を公開し、2人目の配置は `secondCharacter.position` に置く。創造項目・列挙値を新設しない。validateForm の既存の条件分岐を残す。
- shape は未完成の自由記述や通常の範囲検査を complete へ残し、列挙集合だけは inactive な項目も含めて検査する。不正なオブジェクトには位置の列挙エラーを重ねない。
- TS-05 の doctor 比較では、プロセス間に変化する空き容量の観測だけを試験 preload で固定する。製品値を削除・正規化せず、result 全体を完全一致で比較する。
- 生成比較では1つの出力パスを CLI と MCP で順に使い、出力の間だけ一時ディレクトリを削除する。ZIP の圧縮バイト・日時は比較せず、全展開パスと本文を比較する。
- Tier C は原典構成の640×360・6秒・30fpsを維持し、voice none とジョブ内音響合成を使う。ブラウザは既存実行ファイルを生成ジョブの Remotion config に明示し、自動ダウンロードを避ける。手元・CI とも concurrency 2。
- 検証用ジョブだけに場面・GLB・音響 plan とブラウザ設定を記入する。制作ハーネス・テンプレート本文には変更しない。
- MCP の Tier C は開始 wait_ms:0、完了取得は run_get wait_ms:50000。最低1回の取得を必ず行い、状態・正規化値・元の終了値を記録する。
- 成功した runtime ジョブはログと成果物のハッシュ・小さい静止画／report を採取してから依存と動画を削除する。失敗時は走行中 run を取消し、調査用ジョブを保持する。
- verify-pages は既定12回・5秒間隔。HTTP は15秒、ブラウザの画面取得は30秒、描画待ちは15秒で打ち切る。公開の成功は宣言しない。

## 契約・要件への質問

未回答0件。M4-Q1 は発注内で L2 承認済み。改訂履歴の指定行を追加し、既存 request／操作入力のスキーマと snapshot に反映した。それ以外の操作・封筒・run の契約変更なし。

## 依存とライセンス

依存追加・版更新なし。既存の Node API、jszip、MCP SDK、Vite、原典の生成ジョブ依存を使用した。追加 LICENSE 確認対象・NOTICE 変更なし。`npm ci` は既存の low 1件を報告した。自動の audit fix は行っていない。外部ツール導入、実 Aivis、有償画像生成は実行していない。

## 残課題・未確認

- G4 統合レビューと L2 の受け入れ判定。自己判定は行っていない。
- ubuntu Node 22/24 の全テスト・Tier B・GUI e2e・Pages 検査、Windows hosted runner の runtime-smoke は未実行。リモート CI の結果は主張しない。
- Windows で権限がないディレクトリ symlink と、Linux 専用子孫停止・POSIX ファイル名・POSIX shell 引数の試験は既存の理由付き skip を維持。junction は実行対象のまま。
- 実公開 URL の L2 手元検査・3ジョブ成功・公開前後画像比較・実行 URL 記録は M8。手元 Pages のスクリーンショットは比較用証拠であり、見た目の判定ではない。
- M2a/M3 が記録したパス照合とプロセス照合の競合、粗い mtime、進捗トークン対応の限界は継続。M7 で安全境界を変更していない。
- 見た目・文面の判断事項は既存 M4/M5/M6 の担当へ残す。追加の主観的ゲート・表現制限は設けていない。
