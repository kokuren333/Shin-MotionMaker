# M6 command-log — 文書中のコマンド例の実行記録

- 実行環境：Windows 11、Node v24.15.0、npm 11.12.1、2026-11-14
- 実行場所：作業ツリー `m6-docs` のルート（以下「repo のルート」）。生成先・入力は追跡しない `.agent-work/` に置いた
- 封筒の要約は、標準出力を JSON として parse して取り出した（`exit` は終了コード）。全例で標準出力は JSON 1個（1行）だった
- リモート・npm レジストリへの公開を伴うコマンドは実行していない（`git clone` の URL は公開前なので README に載せていない）

## 1. README.md

### 導入

| コマンド | 結果 |
| --- | --- |
| `npm ci` | 成功（終了0）。監査の通知だけ |
| `npm run build` | 成功（`tsc --noEmit && tsc -p tsconfig.build.json`） |
| `npm link` | 成功（`added 1 package`）。グローバル環境を変えないよう、環境変数 `npm_config_prefix` を `.agent-work/npm-prefix` に向けて実行した。`smm`・`shin-motionmaker` の `.cmd`・`.ps1`・sh の shim ができた |

### CLI の使い方（リンクした `smm` で実行）

入力は `.agent-work/readme-ex/request.json`：`{"form":{"title":"虹の仕組み","description":"虹ができる理由","audience":"中学生","voiceEngine":"none","generateAudio":false}}`。作業フォルダは `.agent-work/readme-ex/`。

| コマンド | exit | 封筒の要点 |
| --- | --- | --- |
| `smm version` | 0 | ok:true、`{version:"0.1.0", commit:null, template_version}`（M6 のテンプレート更新前は 0.5.1、更新後の再実行で 0.5.2） |
| `smm doctor` | 0 | ok:true、checks：node・npm・ffmpeg・browser・disk |
| `smm candidates --mode mv` | 0 | ok:true、message「方向性のたたき台であり固定の正解ではない。入力へは自動で適用しません。」 |
| `smm generate request.json --out jobs` | 0 | ok:true、job `jobs/虹の仕組み` |
| `smm status "jobs/虹の仕組み"` | 0 | ok:true、result に job・deps・records・scenes・outputs・checks・runs・hints |
| `smm qc "jobs/虹の仕組み" --stage pre` | 1 | ok:true、verdict:fail（生成直後で制作記録が無い）。標準エラーに `QC pre: fail — reports/qc-pre.json` |
| `smm schema request` | 0 | ok:true、result に name・schema |
| `smm status "jobs/虹の仕組み" --human` | 0 | 標準出力が `status: 実行結果を取得しました` から始まる人向けの要約 |
| `smm.cmd version`（PowerShell から） | 0 | 上と同じ封筒 |
| `shin-motionmaker candidates --mode mv --seed 7 --count 1 --human` | 0 | 人向けの要約。seed 7 |

テンプレート更新後に `node dist/cli/main.js generate .agent-work/readme-ex/request.json --out .agent-work/readme-ex/jobs2` を再実行し、`project.json` の generator が `template_version: "0.5.2"`、ジョブの `README.md` の末尾が新しい「CLI・MCP から使う」節であることを確かめた。

### GUI

| コマンド | 結果 |
| --- | --- |
| `npm run dev --workspace gui` | Vite が `http://127.0.0.1:5173/` で起動。取得して HTTP 200、`<title>Shin-MotionMaker</title>`。確認後にプロセスを停止した |
| `npm run build --workspace gui` | 成功（`✓ built`）。`gui/dist/` に index.html・assets・icons・favicon.png・version.json（`version 0.1.0`、`template_version 0.5.1`。テンプレート更新前の実行） |

### MCP の登録例

README の JSON は `docs/mcp-client.example.json` と同じ `command`・`args`。`node --experimental-strip-types --test tests/mcp-docs.test.ts` が、このファイルの設定で SDK クライアントから起動し、ツール一覧（`job_generate` が非公開であること）と `direction_candidates` の呼び出しを確かめる：pass 1 / fail 0。

### 開発する人へ

| コマンド | 結果 |
| --- | --- |
| `npm test` | 4コミットを作る前の作業ツリー（全変更を含む）で実行。tests 209、pass 207、fail 0、skipped 2（`R-6 linux cancellation…` と `P-2 POSIX generated filenames…`。どちらも ubuntu CI 専用の理由付き skip）。所要 7分20秒 |
| `node tools/ci-local.mjs` | §6 を参照 |

## 2. docs/CLI.md「実行済みの例」

入力は `.agent-work/cli-evidence/request.json`（BOM 付き UTF-8、CLI.md に記載の内容）。テンプレート更新前のビルドで実行した。

| コマンド | exit | 封筒の要点 |
| --- | --- | --- |
| `node dist/cli/main.js version` | 0 | ok:true、result に version・commit・template_version |
| `node dist/cli/main.js schema request` | 0 | ok:true |
| `node dist/cli/main.js candidates --mode explanation --seed 42 --count 3` | 0 | ok:true、result に message・seed・notes・candidates・axes・formatted |
| `node dist/cli/main.js generate .agent-work/cli-evidence/request.json --out .agent-work/cli-evidence/jobs` | 0 | ok:true |
| `node dist/cli/main.js generate .agent-work/cli-evidence/request.json --out .agent-work/cli-evidence/archives --zip` | 0 | ok:true。`archives/CLI & 全角 空白-motion-job.zip` ができた |
| `node dist/cli/main.js qc ".agent-work/cli-evidence/jobs/CLI & 全角 空白" --stage pre` | 1 | ok:true、verdict:fail、advisories 2、run completed / exit_code 1 |

追加で確かめたもの（文書の記述の裏付け）：

| コマンド | exit | 封筒の要点 |
| --- | --- | --- |
| `node dist/cli/main.js doctor` | 0 | ok:true |
| `node dist/cli/main.js status ".agent-work/cli-evidence/jobs/CLI & 全角 空白"` | 0 | ok:true |
| `node dist/cli/main.js candidates --mode mv` | 0 | ok:true |
| `node dist/cli/main.js validate ".agent-work/cli-evidence/jobs/CLI & 全角 空白"` | 3 | ok:false、E_DEPS_MISSING（依存未導入。run を作らない） |

`tools/verify-cli.mjs`（M2b の再現スクリプト）は、`mcp serve` を終了コード3（M3 前の E_DISABLED）で期待する行で失敗した（実際は0）。M3 で `mcp serve` が接続されたことへの未追随で、上の6例はこのスクリプトより前に実行されるものを含め、すべて個別に直接実行した。スクリプトは `docs/work/M2b/CLI-EXAMPLES.json` を書く前に止まったので、追跡ファイルは変わっていない。修正は工学タスク（REPORT の残課題）。

## 3. docs/CLI.md・docs/MCP.md の MCP 起動

| コマンド | exit | 出力 |
| --- | --- | --- |
| `node dist/cli/main.js mcp serve` | 2 | 標準エラーに `{"code":"E_USAGE","message":"必要な引数がありません。","hint":"--root を指定してください。"}` |
| `node dist/cli/main.js mcp serve --root ./no-such-dir` | 2 | 標準エラーに `{"code":"E_PATH_DENIED","message":"root のフォルダを確認できません。","hint":"--root に存在するディレクトリを指定してください。"}` |
| 登録例 `{"command":"node","args":["dist/cli/main.js","mcp","serve","--root",".","--read-only"]}` | — | `tests/mcp-docs.test.ts` が SDK クライアントで起動・一覧・呼び出し：pass 1 |

## 4. docs/MCP.md「実行した検証」

| コマンド | 結果 |
| --- | --- |
| `node --experimental-strip-types --test tests/mcp.test.ts tests/mcp-fix.test.ts tests/mcp-setup.test.ts` | tests 22、pass 22、fail 0、所要 1分4秒 |
| `node --experimental-strip-types --test tests/mcp-docs.test.ts` | pass 1、fail 0 |
| `node --experimental-strip-types tools/smoke-mcp.ts` | `{"tier":"B","generated_files":68,"setup":"completed","setup_exit_code":0,"validate":"completed","verdict":"pass","validate_exit_code":0,"deps_installed":true,"protocol_errors":0}` |
| `node tools/audit-mcp-licenses.mjs` | `{"packages":95,"licenses":{"MIT":85,"BSD-3-Clause":2,"ISC":7,"BSD-2-Clause":1},"verified":true}` |

## 5. そのほかの文書

- `docs/DESIGN.md` §7 の `npm test --workspace gui` は、`node tools/ci-local.mjs` の中で実行される（§6）。
- `docs/WORKFLOW.md` の `git diff <BASE>...HEAD`・`git diff --check <BASE>...HEAD`・`git revert -m 1 <マージコミット>` はレビュー・緊急時の手順を示す書式で、値が決まっていないので実行していない（M6 で追加・変更したコマンドではない）。
- ジョブの `README.md`（R3 の節）にはコマンド例を置いていない。

## 6. node tools/ci-local.mjs

コミット `39fde49`（文書・R3・版の更新の4コミットを含む HEAD）を対象に実行した。終了0、所要11分29秒。

| 段 | 結果 |
| --- | --- |
| 深さ1の複製 | 成功 |
| `npm ci` | 成功 |
| `npm run build` | 成功 |
| `npm test` | tests 209、pass 207、fail 0（skip 2 は ubuntu 専用の理由付き） |
| `npm test --workspaces --if-present`（GUI の単体テストと e2e） | tests 33、pass 33、fail 0 |
| `npm run build --workspaces --if-present`（GUI のビルド） | 成功 |
