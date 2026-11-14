# M0 REPORT — 立ち上げと基線採取

- 実働: L3 Codex 6.1 sol / reasoning effort high。モデル切替・下請け利用なし。
- 作業日: 2026-11-14。Windows / PowerShell、Node v24.15.0、npm 11.12.1、Git 2.54.0.windows.1。
- 起動時: repo は未初期化、ルート AGENTS.md・CONTRACT.md は未存在。要件定義書と指定節を読み、初期化後に本報告まで作成した。
- コマンド実行・ネットワーク利用可。L4 は使用せず小作業を順に処理（縮退レベル1相当）。自己判定となるゲートはない。受け入れ・交差レビューは L2 の別発注であり、本報告は判定を行わない。
- 原典・CyberSprite に書き込んでいない。依存導入・原典テスト・生成は指定スクラッチの複製だけで実施した。

## 1. 実装したもの

| ファイル・範囲 | 内容 |
| --- | --- |
| Git / .gitignore / .gitattributes | main で初期化。作者は指定名と原典直近作者のメールを repo ローカル設定に使用。要件定義書を無変更で初回コミット。handoff・依存・ビルド・ログ・run 等を除外。新規開発ファイルは LF、基線本文は改行変換を無効化 |
| LICENSE / NOTICE | Apache-2.0 全文を原典から複写。継承元・フォント・開発依存・MCP採用版・Remotion注意を記録 |
| AGENTS.md / CLAUDE.md | 開発規約、制作規約との区別、絶対規則、正本一覧、公開規則、§2.3の宣言文。CLAUDE.mdは指定の1行 |
| docs/WORKFLOW.md | 原典の層・ゲート・受け渡し様式・縮退規則を移植。名称・パス・G4コマンド・Windowsの実行方針を本repoに対応 |
| package.json / package-lock.json / tsconfig.json / gui/package.json | Node>=22、ESM、GUI workspace、2つのbin予約、再帰テストglob、型検査。GUIはscriptsなしのplaceholder |
| tools/capture-baseline.mjs / baseline-reporter.mjs | 手動採取用。原典複製を検証し、未変更の生成関数をimport。ZIP本文・目録・全テスト名・エラー文言を機械採取。CI・テストからは呼ばない |
| tests/fixtures/baseline-biimmotion-262c798/ | 151ファイル。テンプレート・フォント60件の目録、golden10ケース、合成添付、38種のエラー文言と入力、81テストの一覧、R1〜R5初版、PROVENANCE |
| tests/no-git.test.ts / helpers/git-detector.ts / git-detector-samples.json | tests・guiのコードとヘルパーを走査。プロセス起動、別名import等を検出。陽性11・陰性4の文字列を実行せず表明 |
| tests/agents-declaration.test.ts | 期待値を要件§2.3コードブロックから読み、見出し番号以外を逐語確認 |
| tests/fixtures-baseline.test.ts | JSON・件数・名前・10ケース・全追加／上書き本文の存在と保存ハッシュを確認。M1の移植物との照合は未実装 |
| tools/ci-local.mjs / npm-command.mjs | HEADをfile transportで深さ1に複製しCIと同じ5コマンドを実行。npmのJS entryをnodeからshell:falseで起動。最後に検証した一時フォルダを削除。失敗時保持オプションあり |
| .github/workflows/ | PR/pushのCI（ubuntu/24・windows/24・ubuntu/22）、手動Pagesの3ジョブ、独立した手動runtime-smokeの骨格 |
| docs/CONTRACT.md / docs/work/M0/QUESTIONS.md | core/hostの型付きAPI、原典対応、操作定義表、封筒・run・状態・終了コード・スキーマ所有、SDK版、レビュー論点 |

job-template と core 本文は M1、CLI bin 実体は M2b、GUI 本体は M4 の担当として作っていない。

## 2. 受け入れ条件ごとの状態と証拠

| 発注の条件 | 状態と実測証拠（判定はL2） |
| --- | --- |
| 基線一式とPROVENANCEのコミット | 実装・保存済み。60 manifest項目（テンプレート58＋フォント2、除外該当0）、golden10ケース、ZIP内ファイル計703件のパス・SHA-256・サイズ。追加／変更された本文も保存。完全ZIPは保存せず |
| 原典テスト件数と全名称 | 原典の複製で `npm --node-options=--test-reporter=<採取レポーターURL> test` を実行。81件、成功81・失敗0、8ファイル。test-inventory.jsonにファイル・suite（原典は全件トップレベルなので空）・名称・結果を保存 |
| ci-localが動く | `node tools/ci-local.mjs` をコミット済みHEADで実行。深さ1のcloneからnpm ci・型検査・5テスト・GUI任意スクリプトの順に終了コード0。clone先のHEADも元HEADと照合。GUIはplaceholderなので任意スクリプトは対象なしで0 |
| CONTRACT初版 | API・全23操作（CLI専用3を含む）・安全フラグ・wait・時間上限・封筒・run・状態・エラー17種・終了コード・スキーマ20種・SDK採用版を記載。交差レビューはL2待ち |
| §2.3宣言文 | 要件コードブロックを機械抽出してルートAGENTSへ複写。agents-declaration.test.ts成功 |
| handoff非追跡・ローカル情報なし | `git ls-files -- _handoff/` は0件。`git grep -n -I -F <ローカル絶対パス接頭辞> HEAD` をバックスラッシュ・スラッシュ・JSON escapeの3形で実行し各0件（非一致の終了1）。メール正規表現の `git grep -n -I -E <メール形式> HEAD` も0件。作者情報は追跡外のrepoローカル設定だけ |
| 原典無変更 | `git -C <原典> status --short` は出力なし。`git -C <原典> rev-parse HEAD` は262c79876a9c4635377114902d58ce783e7578b1。採取複製もtracked差分なし |

追加確認: 同じ採取コマンドを別のスクラッチ出力先でも実行し、相対パスごとのSHA-256を比較。151ファイルすべて一致、差分0。原典テストも再度81/81成功。`git diff 2e2d3c4 -- docs/REQUIREMENTS.md` は差分なし。`git remote` は0件。

## 3. 実行コマンドと結果

コマンドのローカル絶対パスはプレースホルダーで示す。テスト中にgitを呼ぶ新コードはない。原典の履歴参照テストを含むnpm testだけは、発注JT-10の採取のため完全履歴の複製で実行した。

| コマンド | 結果 |
| --- | --- |
| `git clone --no-hardlinks <原典> <原典の複製>` → `git -C <原典の複製> checkout --detach 262c798` | 指定コミットの複製を作成 |
| `npm ci`（原典の複製） | 成功。原典lockの34 packages。npm audit表示はlow 1・high 1。原典・依存版を変更せず、原典のライブラリを本体依存に追加していない |
| `node tools/capture-baseline.mjs --source <原典の複製>` | 10ケースの実生成、全成果物を保存。npmレポーターで原典81成功・0失敗を記録 |
| 同上 `--out <別の採取先>`、全151ファイルのSHA-256比較 | 再採取の差分0。固定不能な生成内容なし |
| `npm ci`（本repo） | 成功。4 packages追加、auditの指摘0。bin未実装でも導入成功 |
| `npm run build` | TypeScriptの型検査成功、終了0 |
| `npm test` | 最終5件、成功5・失敗0・skip0。宣言1、git検出2、基線形2 |
| `npm test --workspaces --if-present` | 終了0。GUI placeholderのため対象scriptなし |
| `npm run build --workspaces --if-present` | 終了0。GUI placeholderのため対象scriptなし |
| `node tools/ci-local.mjs` | コミット済みHEADの深さ1複製で同じ5コマンドが全て終了0。一時フォルダ削除完了 |
| `git diff --check 2e2d3c4` | 最終出力なし。基線のCRLFは属性cr-at-eolで原文のまま扱う |
| `npm view @modelcontextprotocol/sdk version license dist.tarball --json` | version 1.32.2、license MIT |
| `npm pack @modelcontextprotocol/sdk@1.32.2`、`tar -xOf <SDKのtarball> package/LICENSE` | 配布物のMIT本文を確認。M0依存への追加なし |

作業中に基線形テストのパス境界が末尾区切りを二重に扱って1件失敗したため、基準パスをpath.resolveで正規化して修正した。採取の初回はNodeの後置レポーター指定が採用されず機械出力が取れなかったため、npmのnode-options指定へ修正して再実行した。最終のテスト・採取結果には失敗なし。GitのCRLF警告を消す目的で原文を変更せず、基線限定の属性で対応した。

最終点検で、PowerShellのネイティブパイプが日本語置換文字列をASCIIへ変換したWORKFLOWの一部と、同じ原因で適用されなかった契約型の追記を検出した。直接UTF-8のpatchで修正し、文書の連続した疑問符・置換文字がないことと、フォーム型が原典と一致することを確認した。

Linuxは手元に無く、リモートも未作成なのでubuntuのCIは未実行。Windows/Node24の実行証拠を提出し、Node22とubuntuの実測は今後のCIに残す。Pages・runtime-smokeは骨格のみで起動していない。

## 4. 決定

- M0はmainで初期化し、要件保存・骨格・基線・契約／報告を論理単位のコミットとした。
- 空のsrc/coreは作業フォルダにだけ用意し、core本文とjob-templateはM1へ残した。
- GUI placeholderはscriptsなしとし、--if-presentで導入・CIを通す。binはdist/cli/main.jsを予約する。
- 型検査はtestsとhelpersを対象に含め、TypeScript 5.9.3とNode型24.10.1を固定した。
- ZIPは展開本文の全パス・SHA-256・サイズ・ディレクトリ項目を保存し、圧縮ZIP自体を保存しない。
- 生成時のDateだけ2026-11-14T00:00:00.000Zへ固定し、原典コードを変更しない。
- MV入力は原典テストのフォーム合成順序をそのまま再現し、3バイト疑似音源を有効な30秒無音WAVに替えた。添付メタデータ・ハッシュの違いはPROVENANCEに記録した。
- 合成のGLB・参考textを解説ケースで使い、すべて相対パスでrequestから参照する。
- 基線の歌詞・outline・brief内のCRLFを保存するため、golden配下だけ-textとcr-at-eolを指定した。
- validateFormは全分岐を5入力で引き出し、38種の代表文言とURL行番号のパラメーター付き文言を保存した。
- coreのvalidateRequestをshape／completeの同じ関数2段階とし、I/Oの前後で入力検査を共有する初版契約とした。
- coreは生成ファイルマップの構築とZIP化を分け、原典名の互換exportを残す初版契約とした。
- runのheartbeatは5秒、lost判断は15秒経過かつプロセス不在、時間上限は操作別5分〜2時間とする初版契約とした。
- outはジョブ名を足す親ディレクトリ、read-onlyでは全runとgenerateのdry-runも非公開とする初版契約とした。
- MCP SDKは確認した最新1.32.2/MITを採用予定版とし、導入はM3とした。

## 5. 契約・要件への質問

[QUESTIONS.md](QUESTIONS.md) に3件を記録した。依存しないM0作業は実施済み。

1. 原典imagegen内のWindows shell使用と、D-10の本文維持・CL-11のshell禁止の境界。
2. URL行番号を含むvalidateForm文言集合のパラメーター正規化の扱い。
3. 原典スクリプトの同じexit 1に含まれる不合格と例外の分類を、M2bで実測固定する手続き。

## 6. 追加依存とライセンス

| 依存 | 版 | 用途 | 実際に読んだ本文 |
| --- | --- | --- | --- |
| typescript | 5.9.3 | M0の型検査、devDependency | node_modules/typescript/LICENSE.txt、Apache-2.0 |
| @types/node | 24.10.1 | テスト・Node API型検査、devDependency | node_modules/@types/node/LICENSE、MIT |
| undici-types | 7.16.0 | Node型の推移依存、lockで固定 | node_modules/undici-types/LICENSE、MIT |

上記はNOTICEにも記録。GPL系の追加なし。SDK 1.32.2のMIT本文も配布物から確認したが未導入。原典のjszip等は採取複製だけで使用した。

## 7. 残った課題・TODO

- L2による本M0の受け入れとCONTRACT初版の交差レビュー。本報告では自分の成果の合否を判定していない。
- M1でR1置換対・R4逆変換パッチを確定し、JT-11・原典テスト移植台帳を実装する。
- M2a以降でSchema本体、操作定義表実装、host、CLI、MCPを作る。M0は契約だけ。
- M4でGUI build出力・version.json、M7でruntime-smoke orchestrator、M8前にverify-pagesとブラウザ環境を整備する。骨格の参照先はそれまでは未存在。
- M4・M5でCyberSprite由来、M1でフォント本体・OFLをNOTICEに確定する。
- 見た目の判断は行っていない。README・AGENTS・WORKFLOW等の文面仕上げはM6へ残した。GUI・アイコンは未作成。
- 採取不能の指定成果物、固定不能の生成内容はない。実レンダー・外部音声／画像生成はM0範囲外。
- リモートrepo作成・push・npm公開は行っていない。_handoffは編集していない。
