# M7-detector 実装報告

## 起動時チェック

- 担当：L3 Codex 6.1 sol、reasoning effort high。L2 は別セッションで判定する。モデルの切り替え・下請けの使用・自己合格の宣言はしていない。
- 環境：Windows、Node v24.15.0、npm 11.12.1。コマンド実行・対話・ネットワーク利用可。サブエージェントを使わず L3 が順次処理するレベル1相当の運用。自己判定になるゲートはなし。
- ブランチ `m7-detector`、基準コミット `7d92314`、開始時の作業ツリーはクリーン。指定作業ツリー内だけで変更した。
- REQUIREMENTS §0〜§4・§6・§8.2・§9・§12、AGENTS、CONTRACT、WORKFLOW、M7/G4_REVIEW の再確認（G4R2）を読んだ。作業固有の DIRECTION.md は未配置のため、会話内の L2 発注「M7-detector — git 検出器の退行の修正（G4R2-R1）」を正として実施した。
- 初回の個別テストは TypeScript が未導入で起動失敗。既存 lockfile に従い `npm ci` を実行して解消（131 packages、終了0）。本タスクで外部ツールは導入していない。

## 実装したもの

- `tests/helpers/git-detector.ts`：テンプレートリテラルの head と文字列連結の静的な先頭を AST から抽出する。括弧を取り除き、完全に静的な連結はまとめ、未知の式に達したらその先を読まない。既存の実行ファイル名・パス・空白境界の正規表現をそのまま使う。
- `tests/fixtures/git-detector-samples.json`：既存の陽性15件・陰性8件をすべて保持。テンプレート・連結・括弧の陽性15件と、似た名前・コメント・未知の先頭などの陰性20件を追加（計30件・28件）。
- `tests/no-git.test.ts`：旧サンプルと回帰サンプルをすべて検出することをテスト名で明示し、各陽性の検出数を1件と表明する。陰性は引き続き0件を表明する。
- 実装コミット：`41ee245`（`M7-detector: detect static command prefixes in templates and concatenations`）。

## 受け入れ条件ごとの証拠

| 条件 | 実行結果・証拠 |
| --- | --- |
| テンプレート・連結の検出 | 修正前に `node --experimental-strip-types --test tests/no-git.test.ts` を実行。走査テスト1件成功、回帰テスト1件失敗。最初の追加例 ``execSync(`git show ${ref}`)`` は実測0件（期待1件）だった。修正後の同コマンドは2件成功・失敗0件・skip 0件。 |
| 旧陽性の維持・陰性の非検出 | 旧15件を削除せず、新規を含む陽性30件で各1件の検出、陰性28件で0件を表明。`digit`・`.gitkeep`・`gitignore`・行コメント・ブロックコメント・文字列内の擬似呼び出しを含む。 |
| テスト自身が git を起動しない | サンプルは JSON から読み、TypeScript AST として解析するだけで、eval・Function・子プロセス呼び出しは追加していない。既存の走査範囲・開発専用の除外は変更せず、検出器自身を含む走査テストが成功。ci-local はテストの外から実行した。 |
| `npm test` | 終了0。pretest の TypeScript 型検査・ビルドも成功。tests 219 / pass 217 / fail 0 / skipped 2、376948.9121 ms。 |
| `node tools/ci-local.mjs` | 終了0。`41ee24582f0b330783ed5b0a6d8d400e90ab469d` を深さ1で複製し、npm ci → ライセンス照合 → build → npm test → GUI 単体・e2e → GUI build を完了。全体 tests 219 / pass 217 / fail 0 / skipped 2、GUI 単体 tests 34 / pass 33 / fail 0 / skipped 1、e2e 42/42。 |
| 報告・コミット・クリーンな作業ツリー | 実装・テストと本報告を別コミットに記録。終了時の `git status --short` は出力なし。受け入れ判定は L2 に委ねる。 |

## 実動確認とテスト

- テストランナーの外でも、PowerShell の単一引用符 here-string から `node --experimental-strip-types --input-type=module` にスクリプトを渡し、検出器を直接 import して呼び出した。サンプルの実行はしていない。
- 直接実行の結果：``execSync(`git show ${ref}`)``、``spawn(`git`, ['status'])``、`execSync('git ' + ref)` は各1件。`readFile('gitignore')` と ``readFile('git' + `ignore${suffix}`)`` は0件。
- 全フィクスチャの直接集計出力：`{"positive":30,"detected":30,"negative":28,"falsePositives":0}`。
- `npm test` の skip 2件は既存の OS 専用ケース（R-6 linux cancellation、P-2 POSIX generated filenames）。Windows 版の孫プロセス停止テストは成功している。
- ci-local 内の `npm test` は480213.0813 ms。GUI 単体は3185.9295 msで、skip 1件は PATH に sh がないための既存 POSIX 実行ケース。文字列のクォート規則自体の検査は成功。Ubuntu・Node 22 はこの Windows セッションでは実行していない。
- ci-local の最後の出力：`CI と同じコマンドが完了しました: 41ee24582f0b330783ed5b0a6d8d400e90ab469d`。GUI の version.json にも同じコミットが入っている。
- `git diff --check 7d92314...HEAD` は終了0。ci-local 後の変更は本報告だけで、実装・テストに追加変更はない。
- ローカルの生ログは追跡しない `.agent-work/M7-detector/` に保存する。

## 決定

- テンプレートは最初の置換より前だけを見る。識別子の値や置換式を評価・追跡しないため、先頭が未知の `${tool}` の例は対象外とする。
- `git` または `git.exe` の直後に未知の置換・連結が来る場合は、発注どおり検出する。
- 連結の右側も静的なら結合してから境界を調べ、`'git' + 'ignore'` を誤検出しない。
- 陽性の期待値は「1件以上」から「ちょうど1件」に強め、既存サンプルを含む各呼び出しの検出を確認する。
- ci-local が現在のコミットを複製するため、実装・回帰テストを先にコミットし、検証結果を別の文書コミットに記録する。

## 契約・要件への質問

- なし。QUESTIONS.md は作成していない。契約・要件・操作定義表・スキーマは変更していない。

## 依存とライセンス

- 追加・更新した依存はなし。既存の固定済み TypeScript を使い、package.json・lockfile・NOTICE は変更していない。
- `npm ci` の audit は既存の low 1件を表示した。依存更新は本発注の範囲外。

## 残った課題・TODO・逸脱

- L2 による受け入れ判定と、会話内発注の DIRECTION.md への配置は未実施。
- GUI・アイコン・README の見た目や文面の判断を要する変更はなし。
- 原典・CyberSprite・job-template・基線には書き込まず、push・公開・リモート作成は行っていない。
- 発注範囲からの実装上の逸脱、下請けに出した作業はなし。
