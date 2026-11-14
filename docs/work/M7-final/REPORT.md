# REPORT — M7-final

## 起動時チェック

- L3 工学担当。Codex 6.1 sol / high（発注指定）。モデル切替・下請け利用なし。縮退レベル1（L4 を利用せず順に処理）、自己判定となるゲートなし。受け入れ・G4 の判定は L2 に委ねる。
- ブランチ `m7-final`、開始 HEAD `f6b4153`、作業ツリーはクリーン。指定作業ツリーだけで作業する。
- Windows、Node v24.15.0、npm 11.12.1。コマンド実行・対話が可能。npm ci のネットワーク利用と既存 Chrome のヘッドレス e2e を実動確認した。
- REQUIREMENTS の指定節、ルート AGENTS、CONTRACT、WORKFLOW、M7-fix の質問・報告、M7-gui の報告、G4_REVIEW R-2 と会話内の発注書を確認。M7-final/DIRECTION.md は未配置のため、会話内発注を正として実施する。

## 実装したもの

| ファイル | 変更 |
| --- | --- |
| `gui/tests/request-io.test.ts` | R1 の複数エラー一覧から非 duo の2人目配置の期待を外す。同じテストで duo の拒否と solo（明示・省略）の受理・値の保持を表明。R-10 の文面テストの拒否フィクスチャにも duo を明示 |
| `gui/e2e/run.mjs` | R1 の配置拒否例を duo にする。既存の画面・入力・添付・エラーの項目名と候補値・コンソールの表明を維持。同じテストの後半で solo の2人目配置が不正な値でも読み込め、書き出しに値が残り、エラーが無く画面が残ることを確認 |
| `docs/work/M7-fix/QUESTIONS.md` | M7-fix-Q1 の回答欄と決定日に、会話内の L2 回答を記入。M7-fix 時点の未回答・失敗記録は履歴として保持 |
| `VERIFICATION.md` | M7-gui と M7-fix の既存記録を保持し、最新の統合検証と最終コードコミットを追記 |
| `docs/work/M7-final/` | 本報告と実行の要約・差分の証拠 |

テストの変更は `4cafdbe79cd2232361c8891f1485066d02d5b6ca`（`M7-final: align GUI import fixtures with active character checks`）に保存した。以後は回答・証拠・報告だけを別の文書コミットに保存する。

## 受け入れ条件と実行証拠

以下は L3 の観測結果であり、受け入れ判定は L2 に委ねる。実行日時は UTC、2026-11-14。[verification.json](evidence/verification.json) に時刻・件数・終了値・生ログのハッシュを保存した。

| 受け入れ条件 | コマンド・観測結果 | 状態 |
| --- | --- | --- |
| duo 拒否・solo 受理の整合 | `npm run test:unit --workspace gui` は34件 / pass33 / fail0 / skip1、終了0。R1 のテスト内で duo のエラー pointer、solo 明示・省略時の受理と値の保持を表明。R-10 も成功 | 実行済み |
| R1 の画面・入力・添付の保持 | 下記 ci-local 内の「GU-04 不正な列挙値…（M4R R1）」が成功（1193ms）。duo の拒否で既存状態・ラベル・書ける値・保持の説明を確認し、solo のインポート後も画面・値が保持されエラーなし | 実行済み |
| L2 回答の記入 | M7-fix/QUESTIONS.md の回答欄・決定日を記入 | 記録済み |
| npm ci → ci-local | 指定作業ツリーの `npm ci` が終了0（131追加・133監査）。続いて `node tools/ci-local.mjs` は最終コード HEAD `4cafdbe` の深さ1複製で13:08:37.020Z〜13:13:12.945Z、275.924秒、終了0 | コマンド終了0 |
| 本体・GUI・e2e・ライセンス・ビルド | 同じ ci-local で本体219件 / pass217 / fail0 / skip2（163753.8572ms）、GUI 単体34件 / pass33 / fail0 / skip1（980.3202ms）、e2e42/42。ライセンス180項目 / 導入済130 / verified:true。本体と GUI の型検査・ビルド完了 | コマンド終了0 |
| build → verify-cli | 指定作業ツリーの `npm run build` は13:08:57.162Z〜13:09:03.915Z、終了0。その後の `node tools/verify-cli.mjs` は13:09:04.095Z〜13:10:39.214Z、終了0。54記録を既定の追跡外 `.agent-work/cli-verification.json` に出力。既存の追跡証拠を上書きしない | コマンド終了0 |
| VERIFICATION の整合・最終記録 | 下記の既存記録・ハッシュ照合、M7-final 節への最終コード SHA・ci-local 結果・差分の追記 | 記録済み |
| Tier C 実測との実行経路の比較 | 下記 `git diff --stat` と実行コード範囲の `git diff --exit-code`（出力なし・終了0） | 確認済み |

ci-local は「CI と同じコマンドが完了しました: 4cafdbe79cd2232361c8891f1485066d02d5b6ca」で終了した。生ログは追跡外 `.agent-work/m7final-ci.log`、SHA-256 `67401bd69ac03a5a99d0ba1a73394519350c5f3e23629293ecd06e14b1f64cb9`。

本体の skip2 は Linux 専用の子孫停止と POSIX ファイル名、GUI の skip1 は sh 不在。Windows の junction 検査は実行し、ディレクトリ symlink の EPERM は診断に残った。Windows 以外の成功は主張しない。

## 記録の整合・実行経路の同一性

- マージ済み `VERIFICATION.md` の M7-gui 節は `e10f571` と、M7-fix 節は `f6b4153` と本文一致。重複・記録内容の食い違いは無く、既存節の削除・書換えは不要と判断した。現在の結果を末尾へ追加し、過去の失敗をその時点の記録として区別する。
- M7-gui の16画像の SHA-256 を表の値と照合し、16件一致。M7-fix の manifest に載る21ファイル・336917 bytes をサイズ・SHA-256 と照合し、全件一致した。ローカルの開発用確認スクリプト（`.agent-work/m7final-audit.mjs`）を使用し、テストから git を起動しない。
- `git diff --stat c0d10ca798b2689a50e91f3556dc73c09cfa3391 4cafdbe79cd2232361c8891f1485066d02d5b6ca` は46ファイル・9120追加・15削除。変更は `gui/`、`docs/` とルートの証拠文書 `VERIFICATION.md` のみ。GUI の4ファイルは App・request-io の R-10 と単体・e2e。
- `git diff --exit-code c0d10ca798b2689a50e91f3556dc73c09cfa3391 4cafdbe79cd2232361c8891f1485066d02d5b6ca -- src tools schemas job-template job-assets package.json package-lock.json` は出力なし・終了0。Tier C 実測から core・host・CLI・MCP・テンプレート・実行ツール・依存の実行経路に差分が無い。今回の発注はこの比較による最終確認であり、Tier C は再実行していない。

## 決定

- 不正な characterMode 自体の拒否は既存の trio の例で維持し、2人目配置の拒否だけを別の duo の例で確かめる。複数エラー一覧の検査範囲を保つ。
- solo を明示した入力と人数省略（既定 solo）の両方を単体で確認し、単に受理するだけでなく未使用の値を保持することも表明する。
- マージで加わった R-10 の単体フィクスチャも同じ原典互換条件に従うため duo を明示する。文面の期待値自体は変えない。
- e2e の最後の正常な読み込みを、solo かつ2人目の位置が middle の入力にする。先行する拒否試験後も画面が操作できることと、solo の原典互換の受理を同時に確かめる。
- 最終コードコミットと、その結果を保存する文書コミットを分ける。ci-local が複製する HEAD を固定し、文書コミットとの差分も記録する。

## 契約・要件への質問

- 新規の質問・契約変更は無し。M7-fix-Q1 は発注書の L2 回答を記録して対応した。

## 依存とライセンス

- 依存追加・版更新なし。NOTICE の変更なし。ci-local のライセンス照合は180項目・導入済130・verified:true。npm ci の既存 low1 は自動修正していない。

## 残課題・TODO・逸脱

- 本タスクの受け入れ・G4 の最終判定は L2。Windows 以外の実行・リモート CI・公開の確認は本タスクの実績に含めない。
- M7-final の未解決の実装・検証項目は無し。M7-fix-Q1 への対応と指定コマンドの実行証拠を提出する。
- GUI の見た目・アイコン・README の文面の判断は行っていない。M7-gui REPORT の S12 の見出しに関する別件は、その記録を維持する。
- 発注からの範囲拡大なし。原典・CyberSprite・`_handoff/` への書込、外部ツール導入、push・公開は行っていない。
