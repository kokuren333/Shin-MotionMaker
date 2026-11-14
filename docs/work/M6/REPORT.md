# REPORT — M6 文書

- 実働：L3（Claude Code、Opus 5.5、effort 中）。サブエージェントは使っていない（縮退レベル1相当の運用。L2 の別コンテキストのレビューは維持）
- 作業ツリー：`m6-docs`（基準 `f40fb77`、M2b・M3・M4 マージ後の main）
- 起動時チェック：`node -v` v24.15.0、`npm -v` 11.12.1、コマンド実行可、ネットワーク可（`npm ci`・Tier B の依存導入が成功）、非対話。自己判定になるゲートは無い（判定は L2）

## 実装したもの

| 発注項目 | 変更 | コミット |
| --- | --- | --- |
| 1. README.md（DC-03） | 新設。入口3つの役割、考え方（たたき台・床と天井・ゲートと助言・`project.json` 正本）、必要な環境、GUI（Pages は未公開・手元起動）、CLI（`npm ci` → `npm run build` → `npm link` または `node dist/cli/main.js`、npm 未公開）、MCP の登録例と安全の注意、ジョブ単体での制作、ライセンスと Remotion の利用条件（DC-04）、開発者向けの入口 | `02a101e` |
| 2. ルート AGENTS.md の完成（DC-01） | §1 開発ハーネスと制作ハーネスの区別＋正本の一覧、§2 層と役割、§3 絶対規則（番号を維持）、§4 公開と検証（§8 の教訓を冒頭に一文）、§5 宣言文（見出し番号だけ付けた。本文は不変） | `7cb015a` |
| 3. ジョブ README の R3 節 | 追加部分だけを推敲。CLI・MCP の役割、判定の実装がジョブ内の1つであること、**ジョブ単体では `npm run` の手順が正**、`project.json` が正本、`.smm/runs/` は実行の記録で設定ではないこと。R3 以外のバイトは不変 | `39fde49` |
| 3'. 機械的な更新 | `allowed-diffs.json` の R3 追加文、`TEMPLATE_VERSION` 0.5.1→0.5.2、`TEMPLATE_MANIFEST_SHA256`、`tests/fixtures/template-manifest-0.5.2.json`（新設）、`tests/fixtures/template-versions.json` に 0.5.2 を追加（0.5.0・0.5.1 は保持） | `39fde49` |
| 4. CLI.md・MCP.md・DESIGN.md・WORKFLOW.md | 下の「文面の変更」 | `89f17df` |
| 記録 | `docs/work/M6/command-log.md`、この REPORT | 最終コミット |

### 文面の変更（意味は変えていない）

- **CLI.md**：冒頭に CLI と MCP が同じ操作定義表から作られることを明記。長い段落を「共通のオプション」「imagegen の制限」「入力と出力先」「封筒」「終了コード」「エラーコード」「ジョブ内スクリプトの終了コードとの対応」の節と箇条に分けた。構文表・エラーコード表・スクリプト対応表の行は変えていない。「実行済みの例」に入力の `request.json` の内容を載せ、各例の期待結果（最初の5つは exit 0、qc は ok:true・verdict:fail・exit 1）を書いた。
- **MCP.md**：起動オプションを表にし、登録例・封筒と isError・PNG の上限・run の待ち方・進捗の通知を節と箇条に分けた。ツール表と「安全の境界」は原文のまま。末尾の「文面の推敲は M6 担当へ渡す。」を削除。
- **DESIGN.md**：状態行に「M6 で文面を確認した」を追記しただけ。M4 で実装に合わせて書かれており、推敲の必要を認めなかった。
- **WORKFLOW.md**：L1 の成果物を、原典の `docs/requirements/<日付>-<名前>.md` から「要件定義書（本 repo では `docs/REQUIREMENTS.md`）」に改めた。コミット件名の規則に「先頭に作業 ID」（ルート AGENTS.md 絶対規則7）を足した。どちらも既存の規約との食い違いの解消。

### R3 更新の手順（再現用）

1. `job-template/README.md` の末尾が `allowed-diffs.json` の R3 `appends[README.md].text` で終わることを確かめ、その部分だけを新しい文に置き換える。
2. 同じ新しい文を JSON 文字列として `allowed-diffs.json` の R3 の `text` に置き換える（ほかの行は変えない）。
3. `tests/baseline.test.ts` の「template version identifies…」と同じ方法で目録を作る：`job-template/` の全ファイルの `/` 区切り相対パスをコード単位順に並べた `{path, sha256}[]` を `JSON.stringify` し、末尾に LF。これを `tests/fixtures/template-manifest-<新版>.json` に書き、その SHA-256 を `template-versions.json` に足す。
4. `src/core/data/version.ts` の `TEMPLATE_VERSION` を新版、`TEMPLATE_MANIFEST_SHA256` を手順3の値にする。
5. `npm test` で JT-11（逆置換が原典のハッシュと一致）と目録の照合が通ることを確かめる。

新しい目録で変わったのは `README.md` の1件だけだった（0.5.1 と 0.5.2 の目録の差分で確認）。新しい目録の SHA-256 は `9e01031edccf35664747a3c38528381b3a52469f74c64ed3164b00de4e30d70a`。

## 受け入れ条件ごとの状態と証拠

| 条件 | 状態 | 証拠 |
| --- | --- | --- |
| `npm test` 合格（TS-06・基線照合を含む） | 合格（実装者の実測。判定は L2） | 全変更を含む作業ツリーで tests 209 / pass 207 / fail 0 / skipped 2（ubuntu 専用の理由付き skip 2件）。`agents-declaration`・`JT-11 template and font bytes…`・`template version identifies…`・golden 全件が pass |
| `node tools/ci-local.mjs` 合格 | 合格（実装者の実測。判定は L2） | HEAD `39fde49` で終了0（11分29秒）。複製内の `npm test` 209件中 pass 207 / fail 0、GUI のテスト 33 / 33、GUI のビルド成功。command-log §6 |
| 文書中の全コマンド例の実行記録 | 記録あり | `docs/work/M6/command-log.md`（README・CLI.md・MCP.md の全例。WORKFLOW の git の書式は値が未定のため未実行と明記） |
| 追跡ファイルにローカル絶対パスが無い | 該当なし | `git grep -nIE "[A-Za-z]:[\\/](Users|home)|/Users/[a-z]|/home/[a-z]|<ユーザー名>|@gmail" -- . ':!package-lock.json'` のヒットは M5 REVIEW 内の検査パターンの引用1件だけ |
| 宣言文のテスト（agents-declaration） | 合格 | `node --experimental-strip-types --test tests/agents-declaration.test.ts`：pass 1 |

## DC-05（SHOULD）

**未実施（部分的にあり）。** 依存全体のライセンスを一覧にして確かめるスクリプトは無い。`tools/audit-mcp-licenses.mjs` は MCP SDK の依存閉包（95配置）だけを対象に、LICENSE 本文と `docs/work/M3/dependency-licenses.json` を照合するもので、CI でも実行していない。MCP.md の「実行した検証」に、範囲を明記して載せた。jszip 系・GUI の依存（React・Vite）を含む一覧と CI での実行は、工学タスクとして L2 の判断に委ねる。

## TS-06 の確認

| 表明 | テスト | 状態 |
| --- | --- | --- |
| ルート AGENTS.md に §2.3 の宣言文 | `tests/agents-declaration.test.ts`（要件から本文を抜き出し、見出し番号以外の一致を表明） | 揃っている |
| `job-template/AGENTS.md` の保護文（L3） | `tests/harness-docs.test.ts`「job AGENTS.md opens with the HN-14 guard…」 | 揃っている |
| 「このファイルを編集する人・エージェントへ」の段落 | `tests/harness-docs.test.ts` が「ゲートと助言の線引き」節に `締め付けをしない` があることを表明。段落全体のバイトは JT-11 の基線照合が守る | 揃っている。ただし段落の見出し語「このファイルを編集する人・エージェントへ」そのものを照合する表明は無い。基線照合で実質は担保されるが、明示の表明を足すかは L2 の判断 |
| `direction_candidates` の説明文と結果の「たたき台」 | `tests/mcp.test.ts`「TS-06 candidate description and results say draft…」、`tests/core.test.ts` | 揃っている |
| seed 省略時に固定の結果を返さない | `tests/core.test.ts`「candidate seeds reproduce both modes, vary when omitted…」、`tests/mcp.test.ts`（seed の集合が2種以上） | 揃っている |

## 決定

- **AGENTS.md の節番号**：`docs/WORKFLOW.md` が「ルート AGENTS.md §1」（制作ハーネスとの区別）・「§2」（層）・「絶対規則1・3・4・8・9」を参照しているので、それに合う番号にした。絶対規則の番号と内容は変えていない。
- **README の clone URL**：リモート repo が未作成（Q-01）で実行して確かめられないため、URL 付きの `git clone` を載せず「repo を clone したら」と書いた。公開時（M8）に URL を足す。
- **README の MCP 登録**：検証した `node dist/cli/main.js` の形だけを載せた。Windows では `.cmd` の shim をシェル無しで起動できないので、`"command": "smm"` の形は載せない。
- **`npm link` の検証**：オーナーのグローバル環境を変えないよう、`npm_config_prefix` を追跡しないスクラッチに向けて実行した。
- **CLI.md の再現手順**：従来は `tools/verify-cli.mjs` を再現手順として挙げていたが、現状は途中で失敗するため、代わりに入力の内容を本文に載せ、結果の参照先を M6 の command-log にした。M2b の記録へのリンクは残した。
- **ジョブ README の文体**：周囲の README 本文に合わせて「です・ます」とし、コマンド名とパスは README の既存の書き方（全角文字との間に空白を入れないバッククォート）に合わせた。
- **特定のモデル名**：ルート README には書いていない（GU-13）。ジョブ README の冒頭にある「Opus 5.5等」は R3 の外（基線のまま、R1 で置換対象外）なので触れていない。

## 質問

なし（契約の変更は不要だった）。

## 残課題（L2 へ）

1. `tools/verify-cli.mjs` が M3 後の `mcp serve`（期待値 exit 3 → 実際 0）に追随していない。工学タスクで直すか、記録用として廃止するかの判断が要る。
2. DC-05：依存全体のライセンス一覧スクリプトと CI での実行（上記）。
3. TS-06：「このファイルを編集する人・エージェントへ」の見出し語の明示の表明（任意。上記）。
4. `tests/helpers/host.ts` の偽ジョブの generator は `template_version: "0.5.1"` のまま。偽のジョブの値で、テストの結果には影響しない（`npm test` 合格）。気になるなら工学タスクで揃える。
5. README の GitHub の URL と Pages の URL は M8 で追記する。
