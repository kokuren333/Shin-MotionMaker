# G4 統合レビュー — M7 の関門

- 対象：統合後の `main` `e5b7c53`（Merge M7）。基線は原典 BiimMotion `262c798`
- レビュー者：Opus 5.5（effort 高）。これまでの実装・レビューとは別のコンテキストで、review_mode は independent
- L4：サブエージェント4本に観点を分けた（PH/AR/CL/MC の対応表、JT/GU/TS/DC の対応表、§2 の思想、文書と実装の照合）。結論はレビュー者が書いた。必須・推奨の指摘は、レビュー者がコードを読み直して確かめた
- このレビューで書き込んだのは本ファイルだけ。コード・文書・証拠は変更していない。原典と CyberSprite は読み取りだけで使った

## 1. 結論

**条件付き合格（必須修正あり）**

- 製品（core・host・CLI・MCP・GUI・job-template）について：
  - §2 の思想に反する点は見つからなかった。
  - MV の非退行は、基線フィクスチャとの照合で担保されている。
  - 要件の MUST に「欠落」は無い。
- 深さ1の複製で `node tools/ci-local.mjs` を再実行し、終了0を確かめた（§3）。
- 必須修正は2件で、どちらも工程記録に関するもの（GUI の証拠記録と、受け渡しファイルの所在）である。どちらも M8 の前に解消する必要がある。
- コードの直しはすべて推奨にとどまる。
- M8 には、別に解決すべき前提条件がある（§6）。特に、main をリモートへ出す経路が CI-05・絶対規則10と衝突する。

## 2. 必須の指摘

### G4-M1　M7 で GUI の表示文言が変わったのに、スクリーンショットを撮り直していない

- 根拠：WORKFLOW §5「どの縮退でも守る最低限の関門」の1、WORKFLOW §2 の G4「UI を変えた PR は、スクリーンショットを取得して `VERIFICATION.md` に記録済み」、GU-17。
- 事実：`c72f3dc`（M7）が `gui/src/lib/request-io.ts` から `choiceIssues` を外し（`git diff --stat 9f08db5 e5b7c53 -- gui/src` で 47 行削除）、読み込みエラーの文言が次のように変わった。
  - 変更前の message：「選べる値の決まっている項目に、使えない値があります。」
  - 変更前の hint：「…画面で選べる値のどれかに直してください。読み込み前の入力と添付はそのままです。」
  - 変更後は core の `validateRequest` の文言になる（`src/core/request.ts:65-67`）：message「入力の構造に誤りがあります。」、hint「details の pointer が指す項目のキー・型・列挙値を修正してください。」
  - reason の補足の行も消えた。
  - その結果、`VERIFICATION.md` の S12（`9f08db5` で撮影）は現在の画面と一致しない。M7 の `pages-local.png` は初期表示だけを撮っており、この状態を写していない。
- 直し方：
  - S12 を含む主要状態を、現在のコミットで `npm run shots --workspace gui` により撮り直し、`VERIFICATION.md` の表を更新する。
  - あわせて、新しい hint が GUI の利用者に向いているかを M4 の担当（見た目・文面）が判断する。「キー・型」は request.json を手で書く人向けの語で、「入力は残っている」旨も消えた。直すかどうかは担当の判断に委ねる（推奨 R-10）。

### G4-M2　WORKFLOW §3 の受け渡しファイルが追跡されていない

- 根拠：
  - WORKFLOW §3：置き場所は `docs/work/<作業ID>/`。PLAN・DIRECTION・ENVIRONMENT・RETRO を含む。
  - WORKFLOW §2 の G4：「`PLAN.md` が定める統合検査」。
  - WORKFLOW §5 の最低限の関門2：縮退と自己判定になったゲートを `ENVIRONMENT.md` に記録する。
  - AGENTS.md の正本の一覧：「作業ごとの発注・証拠・レビュー」の正本は `docs/work/<作業ID>/`。
  - 絶対規則8：自己合格を禁止しており、判定の記録が要る。
- 事実：
  - 追跡されているファイル（`git ls-files`）に、`PLAN.md`・`DIRECTION.md`・`ENVIRONMENT.md`・`RETRO.md` は1件も無い。
  - `REVIEW.md` が無い作業：M0b、M2b、M6、M7（M7 は本 G4 で埋まる）。
  - L2 の受け入れ判定（`ACCEPTANCE.md`）、計画（`PLAN_ORCH.md`）、発注書、L1 への質問（`QUESTIONS_FOR_L1.md`）は、すべて追跡外の `_handoff/` にだけある。
  - そのため repo だけを見ると、M3 は「M3R への対応後の L2 判定・必要な再レビューは未実施」（`docs/work/M3/REPORT.md:156`）のままマージされたように読める。実際には `_handoff/M3/ACCEPTANCE.md` に L2 の条件付き合格が記録されている。M1・M2a・M4 の REVIEW も、差し戻しで終わったまま追跡されている。
  - M9 の Fable レビューと、公開後に repo を読む第三者は、これらの判定を確かめられない。
  - `_handoff/` の受け入れ記録と計画にローカルの絶対パスが無いことは確かめた（`C:\`・ユーザー名とも0件）。
- 直し方（L2 の判断。どちらか一方）：
  - (a) 各作業の DIRECTION・ACCEPTANCE（L2 判定）・PLAN・ENVIRONMENT を、ローカル情報を除いて `docs/work/<作業ID>/` へ写す。L1 への質問（L2-Q1・L2-Q2）も追跡ファイルに移す。
  - (b) WORKFLOW §3 と AGENTS.md の正本の一覧を、実際の運用に合わせて改める。この場合、`_handoff/` が追跡外であることと、判定記録をどこで公開するかを明記する。
  - どちらの場合も、各作業の最終判定（合格・条件付き合格と、その日時・コミット）を追跡ファイルから辿れるようにする。

## 3. 再実行した検査

| 検査 | コマンド | 結果 |
| --- | --- | --- |
| CI と同じ一式（深さ1の複製） | `node tools/ci-local.mjs`（2026-11-14、Windows 11、Node v24.15.0） | 終了0。「CI と同じコマンドが完了しました: e5b7c53819b3c600404a449ebb9e24bcdbf67d38」。npm ci → `check-licenses` → build → `npm test`（tests 215 / pass 213 / fail 0 / skipped 2、244746ms）→ GUI テスト（33 / pass 33 / fail 0 / skipped 0）→ e2e 42/42 → GUI build |
| skip の内訳 | 同じログ | 本体の2件は `R-6 linux cancellation…`（linux 専用）と `P-2 POSIX generated filenames…`（POSIX 専用）。どちらも理由の注記がある。GUI は、この環境に Git Bash の `sh` があるため skip 0。M7 REPORT の skip 1 は sh が無い環境の値で、矛盾しない |
| npm audit | 同じログ | 既存の low 1件（M7 REPORT と同じ） |
| 証拠と実物の照合 | `docs/work/M7/evidence/tier-c-{cli,mcp,legacy}.json`、`tier-b.json` を読み、記録の中身を確かめた | Tier C は CLI 8 run、MCP 8 run（各 run は `wait_ms:0` で開始し、`run_get wait_ms:50000` で1〜5回取得）、legacy 10 run。すべて `status: completed`。終了値は VERIFICATION の表と一致する（legacy の validate fail と qc fail は 1/1、`ok:true`）。ジョブ名は `Runtime & 全角 空白`。protocol_errors は 0 |
| 証拠のコミットと現在の差 | `git diff --stat 506a5a8 e5b7c53 -- src job-template tools/…` | Tier C の実測コミットの後に変わったのは `job-template/README.md`（R3 の推敲）と `src/core/data/version.ts` だけ。実行経路のコードは変わっていない |

実レンダーは再実行していない（発注どおり、記録の検証を主にした）。

## 4. MUST・SHOULD 対応表

状態：OK＝実装と証拠がある／部分＝実装はあるが証拠か細部に不足がある（§5 の推奨を参照）。

### 4.1 思想（§2）

| ID | 状態 | 実装 | 証拠 |
| --- | --- | --- | --- |
| PH-01 | OK | `job-template/`（差分は R1〜R5 だけ） | `baseline.test.ts`「JT-11 template and font bytes reverse only the enumerated R1 R3 R4 differences」 |
| PH-02 | OK | host は report と終了コードを読むだけ（`src/host/run-result.ts:46-117`） | `ghost.test.ts`「validate wires the ghost scan as an advisory, not a failure」。JT-11 |
| PH-03 | OK | `src/mcp/server.ts:45`（`isError = !ok`）、`run-result.ts:34-40`、GUI の `InspectionViewer.tsx:101-147`（ゲートと助言を別区画にし、助言は中立色。`warning` アイコンは使わない） | `cli.test.ts`「TS-02 advisory-only execution exits zero…」、`host-run.test.ts`「TS-07 completes with advisory without changing verdict」、`gui/tests/inspection.test.ts` |
| PH-04 | OK | `src/core/candidates.ts:34`、`src/host/operations.ts:24`、`gui/src/App.tsx:628-701`（既定は未選択、「この案を追記」したときだけ入る、「別の組み合わせ」で引き直せる） | `mcp.test.ts`「TS-06 candidate description and results say draft…」、e2e「GU-02 方向性のたたき台…」「GU-07 …」 |
| PH-05 | OK | `.smm/` には runs・ロックだけを置く。状態は毎回導出する（`src/host/status.ts:14-58`） | `host-files.test.ts`「JT-12 status reads legacy project…」 |
| PH-06 | OK | `candidates.ts:11,32`、GUI の `freshSeed` | `core.test.ts`「candidate seeds reproduce both modes, vary when omitted…」、`mcp.test.ts` TS-06 |
| PH-07 | OK | `AGENTS.md` §5、`job-template/AGENTS.md:333` | `agents-declaration.test.ts` の2件（宣言文の完全一致、保護文と段落の全文） |
| PH-08／F1 | OK | `src/host/input-schemas.ts:9-20`。創造に関わる項目はすべて string | `cli.test.ts`「TS-03 request schema snapshot keeps free text…」 |
| F2 | 部分 | `validateForm` の文言・種別は原典どおり。ただし M7 の shape 段の列挙検査がモードを見ない（推奨 R-2） | `baseline.test.ts`「JT-11 validateForm preserves the complete baseline message set…」、`integration.test.ts`「M7 shape accepts exactly the existing choices…」 |
| F3 | OK | `src/host/output-schemas.ts:13`（`error.hint` は必須） | `host-extra.test.ts`「schema checker rejects missing hints…」 |
| F4 | OK | `src/core/form.ts:6-20`。列挙は原典が制限していた13項目・同じ値で、新しい列挙は無い | TS-03 スナップショット |
| F5 | OK | 操作定義表（`operations.ts:22-46`）に場面を操作する種別が無い。`project_patch` は汎用の Merge Patch | `host-files.test.ts`「operation table covers contract names…」 |
| F6 | OK | `status.ts:57`（hints は助言で、「工程の順序を強制するものではありません」と書いてある） | JT-12 の status テスト（`verdict` が無いことを表明） |

### 4.2 アーキテクチャ（§3）

| ID | 状態 | 実装 | 証拠 |
| --- | --- | --- | --- |
| AR-01 | OK | CLI と MCP は host の `execute` だけを呼ぶ | `integration.test.ts`「TS-05 every shared synchronous read operation returns equal CLI and MCP results」 |
| AR-02 | OK | 判定はジョブ内の `*.mjs` だけにある | `cli-script-exits.test.ts`「M0-Q3 real scripts pin raw exits…」 |
| AR-03 | OK | `tests/helpers/architecture.ts:22-31`。要件の制約はすべて表明されている | `architecture.test.ts` の2件 |
| AR-04 | OK | `src/core/request.ts` の `validateRequest`。CLI・MCP・GUI がこれを共有する | `gui/tests/request-io.test.ts`、`generate-job.test.ts` |
| AR-05 | OK | `operations.ts:22-56`。CLI だけに置く3操作の理由は `:43-45` と CONTRACT に書いてある | `cli.test.ts`「TS-05 CLI registers every operation…」 |
| AR-06 | OK | `src/host/io.ts` の `writeJob` | e2e「GU-02 ZIP 生成と進捗（AR-06…）」×2（ブラウザの ZIP と、CLI のフォルダ・ZIP、MCP の dir・zip を全パス・本文バイトで比較）、`generate-job.test.ts` の M2b 5件 |

### 4.3 CLI（§4）

| ID | 状態 | 実装 | 証拠 |
| --- | --- | --- | --- |
| CL-01 | OK | `io.ts:60-90` | `host-files.test.ts`「CL-01 BOM request attachments resolve…」 |
| CL-02 | OK | `io.ts:97-142` | `generate-job.test.ts`「…before writing…」「…rejects existing empty directories and files…」 |
| CL-03（SHOULD） | 実装済み | `io.ts:84-89`、`tools.ts:54-73` | WAV の測定と、測れないときの `E_FORM_INVALID` をテストしている。ffmpeg 経路のテストは無い（参考） |
| CL-04 | OK | `cli/index.ts:90-91` | `cli.test.ts`「TS-02 foreground streams child output only to stderr…」 |
| CL-05 | OK | `output-schemas.ts:72-76` | TS-07 群で封筒のスキーマを検査している |
| CL-06 | OK | `operations.ts:95`、`run-result.ts:71` | `cli.test.ts`「…preserves ok versus verdict for exits zero through four」 |
| CL-07 | 部分 | 対応表は `docs/CLI.md:76-121`、実装は `run-result.ts`・`host/errors.ts:15-19` | `cli-script-exits.test.ts`（qc 0/1/2、aivis、sound、ghost、run、imagegen strict）。`--detach` で起動に失敗したときに0になる（推奨 R-1）。validate.mjs の実スクリプトの終了値は Tier B/C の記録だけで確かめている（参考） |
| CL-08 | OK | `core/types.ts:28-31`。src と schemas に出るコードはちょうど17種 | MCP スナップショット、スキーマの一致テスト |
| CL-09 | OK | `tools.ts:102-128` | `host-files.test.ts`（doctor の前後でファイルが変わらない） |
| CL-10 | OK | `cli/index.ts:71-84` | `cli.test.ts`「TS-02 detach survives the CLI and wait uses terminal exit…」 |
| CL-11 | 部分 | src の spawn は6箇所すべて `shell:false` で配列引数 | `&`・空白・漢字のパスはテストされている。全角記号は未テスト（推奨 R-5） |
| CL-12 | OK | `output-schemas.ts:34-78`（`smm.<name>/1`）、`schemas/` の20ファイル | `host-files.test.ts`「operation table…」 |

### 4.4 MCP（§5）

| ID | 状態 | 実装 | 証拠 |
| --- | --- | --- | --- |
| MC-01 | OK | `src/mcp/main.ts`、`server.ts:101-105` | `mcp-fix.test.ts`「MC-01 built CLI mcp serve forwards every server flag…」、`mcp.test.ts`「MC-01 invalid startup…」 |
| MC-02 | OK | `src/host/paths.ts` | `mcp.test.ts`・`host-files.test.ts`・`mcp-fix.test.ts` の MC-02 群（junction を含む。Windows の symlink は権限不足の診断を残している） |
| MC-03 | OK | `run-options.ts:21-50`、`docs/MCP.md:114` | `host-extra.test.ts`「run argv only admits declared options…」 |
| MC-04 | OK | `operations.ts:47-58`、`tools.ts:81-90` | `mcp.test.ts`「MC-04 read-only and generation flags…」「MC-04 and R-12…」ほか |
| MC-05 | OK | `locks.ts`、`runs.ts:36`（排他は契約どおり全 run 種別にかかる） | `host-results.test.ts`「atomic reservation permits only one concurrent run…」 |
| MC-06 | OK | `server.ts:28-32`、`tests/fixtures/mcp-tools.json` | `mcp.test.ts`「TS-04 tools list matches the complete tool schema snapshot…」 |
| MC-07 | OK | `status.ts:51-58`、`candidates.ts:34-48` | `mcp.test.ts` TS-06（verdict・score・rank が無い） |
| MC-08 | OK | `project.ts:33-50`（検査は :40-43 だけ。一時ファイルから rename） | `host-files.test.ts`「MC-08 JSON Pointer merge patch optimistic concurrency…」 |
| MC-09 | OK | `report.ts:18-37` | `host-files.test.ts`「MC-09 report whitelist text limit UTF-8 boundary…」 |
| MC-10 | OK | `runs.ts:49-56` | `mcp.test.ts`「MC-13 …after the stdio server restarts」、`mcp-fix.test.ts`（CLI と MCP の run_list の比較） |
| MC-11 | OK | `output-schemas.ts:19` | TS-07 群 |
| MC-12 | 部分 | `input-schemas.ts:22`（0〜50,000）、`run-options.ts:15-17` | `mcp.test.ts`「MC-12 wait bounds…」。既定値は validate しか表明していない（推奨 R-4） |
| MC-13 | OK | `worker.ts:97`、`runs.ts:27` | `host-run.test.ts`「TS-07 detached run survives client exit…」「TS-07 lost derivation…」 |
| MC-14 | OK | `run-options.ts:8-14`、`worker.ts:14-41`（Windows は `taskkill /T /F`） | `host-run.test.ts`「TS-07 cancels the process tree…」「TS-07 times out…」 |
| MC-15（SHOULD） | 実装済み | `server.ts:49-76,93-96` | `mcp.test.ts`「MC-05 and MC-15 host exclusion and token progress…」 |

### 4.5 生成ジョブ（§6）

| ID | 状態 | 実装 | 証拠 |
| --- | --- | --- | --- |
| JT-01 | 部分 | `tests/fixtures/baseline-biimmotion-262c798/allowed-diffs.json`（R1〜R5） | `baseline.test.ts:15-28,64-71`（逆に置換して基線のハッシュと照合）。表の中身が固定されていない（推奨 R-3） |
| JT-02 | OK | `job-template/` の追跡59ファイル | JT-11(1) のファイル集合の完全一致（基線＋NOTICE）で、余計なファイルを置けない |
| JT-03 | OK | `job-template/AGENTS.md` に repo へのリンクも URL も無い | R1 を逆変換すると基線のハッシュと一致する |
| JT-04 | OK | `job-template/plan/templates/` | `harness-docs.test.ts`「record templates live only under plan/templates…」ほか |
| JT-10 | OK | 基線フォルダ（manifest、11 golden、inventory 81件、allowed-diffs、PROVENANCE に 955fa5c の記述あり） | `fixtures-baseline.test.ts` の2件 |
| JT-11 | OK | `tests/baseline.test.ts` | (1) テンプレート・フォント、(2)「JT-11 golden paths and bytes: <case>」×11（MV の brief.md・lyrics・依頼文はバイト一致）、(3) 文言集合。R4 を MV でも逆変換している点は L2-Q2 で L1 へ送ってある |
| JT-12（SHOULD） | OK | host の旧版対応 | `host-files.test.ts`・`host-run.test.ts` の JT-12。実機の記録は `tier-c-legacy.json`（原典 262c798 が実生成した 0.4 ジョブ、10 run） |
| JT-13 | OK | 移植したテスト | `porting-ledger.test.ts`。原典との差分は P1・P2・P3 だけ（L4 が原典のスクラッチ複製と diff を取って確かめた） |
| MV 非退行（§6.3） | OK | 上記 | JT-11 の MV 2ケース（`mv-landscape`、`mv-portrait-options`）のバイト一致、`qc.test.ts`・`ghost.test.ts`・`imagegen.test.ts`・`harness-docs.test.ts` の移植。job-template の差分は AGENTS.md（R1 を4か所）、README（R1・R3）、validate.mjs（R4）、NOTICE（R3）だけ |

### 4.6 GUI（§7）

| ID | 状態 | 実装 | 証拠 |
| --- | --- | --- | --- |
| GU-01 | OK | `gui/vite.config.mjs:11`（`base:"./"`）。永続化は無い | e2e「GU-15 sub-path…」 |
| GU-02 | OK | `gui/src/App.tsx` ほか | `gui/e2e/run.mjs` の「GU-02 …」全項目。e2e 42/42 を再実行で確かめた |
| GU-03 | OK | `App.tsx:245`（core の `generateJob`） | AR-06 の e2e |
| GU-04 | OK | `gui/src/lib/request-io.ts` | `request-io.test.ts`、e2e「GU-04 …」×3 |
| GU-05 | OK | `InspectionViewer.tsx`、`lib/inspection.ts` | `inspection.test.ts`、e2e「GU-05 …」×2 |
| GU-06 | OK | `AgentEntrances.tsx`、`lib/commands.ts` | `commands.test.ts`、e2e「GU-06 …」 |
| GU-07 | OK | `App.tsx:573-589,628-701` | e2e「GU-07 たたき台：seed を固定しない…」 |
| GU-08 | OK | `gui/src/theme/tokens.css`（20f787d）。直値の例外は `index.html:7` の theme-color（= `--cs-board`。テストで表明している） | `gui/tests/theme.test.ts` |
| GU-09 | OK | `docs/DESIGN.md` §4 | 文書を確認した |
| GU-10 | OK | `PixelIcon.tsx`。原典の10点を再利用している | `tests/icons.test.ts` |
| GU-11 | OK | 固有13点（`.csprite` と PNG） | `icons.test.ts` の REQUIRED_ORIGINAL |
| GU-12 | OK | `gui/public/icons/manifest.json`、`NOTICE:16-23` | `icons.test.ts` の4件 |
| GU-13 | OK | `<title>Shin-MotionMaker</title>`。gui/src と README に制作者としてのモデル名は無い | 文書とソースを確認した。ジョブ README に残るモデル名は L2-Q1 で L1 へ送ってある |
| GU-14 | OK | `gui/scripts/site.mjs:29-36`、`InfoDialog.tsx`。CI では `GITHUB_SHA` を使う（`build.mjs:20`） | e2e「GU-14 …」 |
| GU-15 | OK | `vite.config.mjs:11` | e2e「GU-15 sub-path…」 |
| GU-16 | OK | `style.css` | `contrast.test.ts`、e2e「GU-16 …」 |
| GU-17 | 部分 | `gui/e2e/shots.mjs` | `VERIFICATION.md` に16枚。M7 の後の S12 が古い（必須 G4-M1） |

### 4.7 CI と公開（§8）

| ID | 状態 | 実装 | 証拠 |
| --- | --- | --- | --- |
| CI-01 | OK | `tests/no-git.test.ts`、`tests/helpers/git-detector.ts` | 同テストと、陽性・陰性のフィクスチャ。検出は静的で直接呼び出しだけに限られる（参考 S-1） |
| CI-02 | OK | 3つのワークフローとも `fetch-depth` を指定していない | `.github/workflows/*.yml` |
| CI-03 | OK（実行は未実施） | `ci.yml`：push と PR、ubuntu/Node 24、windows/Node 24、ubuntu/Node 22 で同じ6ステップ（ライセンス照合を含む）。Tier B は ubuntu | ワークフローの形だけ。リモートが無いため hosted runner での実行は未実施（§6） |
| CI-04 | OK | `tools/ci-local.mjs` | 再実行して終了0（§3） |
| CI-05 | 未到来 | — | main への直接 push は無い（リモートが無い）。M8 の経路に課題がある（§6 の P-1） |
| CI-06 | OK | `pages.yml`：`workflow_dispatch` だけで、build → deploy → verify の3ジョブ。verify は `tools/verify-pages.mjs` を実行して不一致なら失敗 | ワークフローの形 |
| CI-07 | OK | `tools/verify-pages.mjs:19-67`：キャッシュ回避、HTTP 200、title、`version.json` の commit、JS/CSS、ヘッドレスブラウザで見出し・ZIP ボタン・コンソール・失敗リクエスト、再試行 | `pages-local.json`、`pages-add.json`（8種類の不一致を拒否し、古いコミットからの再試行は2回目で成功）。実公開 URL では未実行 |
| CI-08／CI-09 | 未到来 | — | M8 |
| CI-10（SHOULD） | OK | `runtime-smoke.yml`（windows、手動と main への push、Pages と独立、CLI と MCP の両経路） | ワークフローの形 |

### 4.8 テスト（§9）

| ID | 状態 | 証拠 |
| --- | --- | --- |
| TS-01 | OK | 215件で基線の81件以上。`porting-ledger.test.ts`「TS-01 ledger covers every baseline test once…」（P1〜P4 だけ） |
| TS-02 | 部分 | `cli.test.ts` の TS-02 群、BOM、`&`・漢字・空白を含むパス、`--detach` と `runs wait`。全角記号は未テスト（推奨 R-5） |
| TS-03 | OK | `cli.test.ts`「TS-03 …」と `tests/fixtures/request-schema.snapshot.json` |
| TS-04 | OK | `mcp.test.ts`：(1)、(2)、(4)、(5)、(6)。(3) の Tier B は `tools/tier-b.mjs`（ci.yml の tier-b ジョブ）で、手元の記録は `tier-b.json` |
| TS-05 | OK | `cli.test.ts`、`mcp.test.ts`、`mcp-fix.test.ts`、`integration.test.ts` の TS-05 |
| TS-06 | OK | `agents-declaration.test.ts` の2件、`mcp.test.ts` の TS-06 |
| TS-07 | OK（ubuntu は未実施） | `host-run.test.ts` の TS-07 群。OS による skip は無い。Windows では再実行で合格。ubuntu は CI で実行する（§6） |
| TS-08 | OK | `theme.test.ts`（`tests/fixtures/cybersprite-tokens-20f787d.css` と比較）、contrast、e2e |
| TS-09 | OK | `icons.test.ts`。`favicon.png`（32×32）は manifest の `size_policy.exceptions` で例外として扱っている（参考） |
| Tier C | OK | CLI と MCP の両経路を Windows 実機で実行した記録（`tier-c-cli.json`・`tier-c-mcp.json`）。実測時のテンプレートは 0.5.1、現在は 0.5.2（README の推敲だけ） |

### 4.9 文書（§10）

| ID | 状態 | 証拠 |
| --- | --- | --- |
| DC-01 | OK | `AGENTS.md`：§1、絶対規則15項、§4、§5（REQUIREMENTS §2.3 と1行ずつ一致し、違うのは見出し番号だけ）、正本の一覧。`CLAUDE.md` は `@AGENTS.md` |
| DC-02 | OK（運用と不一致） | `docs/WORKFLOW.md` §1〜§3 の内容はそろっている。ただし運用が §3 に従っていない（必須 G4-M2） |
| DC-03 | 部分 | CLI のコマンドと MCP の20ツール・フラグ・終了コード・エラーコードは実装と一致する（L4 がビルド済みの CLI と SDK クライアントで抜き取り検査した）。具体的なコマンド例は M6 の `command-log.md` と M7 の `COMMANDS_ADD.md` に実行記録がある。CONTRACT に古い記述がある（推奨 R-6）。実行記録の無い例が少しある（参考 S-6） |
| DC-04 | OK | `NOTICE` に必要な項目がすべてある（著作権、262c798、CyberSprite の 20f787d と a00433c、固有アイコン、フォントと OFL、第三者ソフトウェア、Remotion） |
| DC-05（SHOULD） | OK | `tools/check-licenses.mjs` を ci.yml の3環境と ci-local で実行している。`licenses.test.ts` |
| 追跡ファイルの衛生（絶対規則6） | OK | L4 が `git ls-files` の全ファイルを検索し、ローカルの絶対パス・メールアドレス・認証情報は0件（偽陽性は確認済み）。`_handoff/` と `.agent-work/` は ignore されている |

## 5. 推奨と参考の指摘

### 推奨

| # | 要件 | 場所 | 内容 | 直し方 |
| --- | --- | --- | --- | --- |
| R-1 | CL-07、CL-06 | `src/cli/index.ts:76-80`、`src/host/runs.ts:73-83` | `--detach` のとき、`ok:false` で run が付いた封筒を一律に `ok:true` に変えている。worker の起動に失敗した場合（run は `status: failed`、`exit_code: 4`、`E_INTERNAL`）も変換の対象になり、終了コードは0になる。`run.error` があるので warnings も空になる。`docs/CLI.md:88`「`--detach` は開始に成功すれば0」に反する。既存テスト（`cli.test.ts:66-67`）が確かめているのは、起動後にスクリプトが落ちる場合だけ | worker の起動自体の失敗（`startRun` の catch から来る run）は、`ok:false` と終了4のまま返す。スクリプトがすぐに終わっただけの場合と区別し、テストを足す |
| R-2 | F2、AR-04、M7 の決定 | `src/core/request.ts:41-48` | shape 段の列挙検査がモードと人数を見ない。原典の `validateForm` が受け付けていた入力（MV での `styleMode:"bogus"` や `characterPosition:"center"`、solo での `secondCharacter.position:"center"`）を、`E_INPUT_INVALID` で拒否する。創造に関わる項目ではないので §2 違反ではない。ただし M7 QUESTIONS の「モード依存の分岐は維持する」とずれており、`docs/CONTRACT.md:212` の shape の説明も古い | `validateForm` と同じ条件（MV なら `styleMode` と位置を見ない、duo のときだけ2人目を見る）に揃える。揃えない場合は、shape が意図的に厳しいことを CONTRACT の本文に書いて L2 が承認する |
| R-3 | JT-01、JT-11 | `tests/fixtures-baseline.test.ts:39`、`tests/baseline.test.ts:21-25` | 許容差分表は規則 ID の並びしか固定していない。置換の対の件数、内容、表のハッシュは表明していないので、`allowed-diffs.json` を書き換えれば許す差分を黙って広げられる。逆変換は `replaceAll` を使い、出現回数を照合しない | 表の SHA-256、または R1 の対の件数と各対の出現回数をテストで固定する |
| R-4 | MC-12 | `tests/host-run.test.ts:138`、`src/host/run-options.ts:15-17`、`input-schemas.ts:22` | 既定値の表明は validate の 45000 と 0 だけ。qc・sound の 45000 と、その他の 0 は固定されていない。`wait_ms` の `default` も tools/list に出ない | 全種別の既定値を表で表明する。可能なら入力スキーマに `default` を載せる（MC-06 のスナップショットの更新を伴う） |
| R-5 | CL-11、TS-02 | `tests/generate-job.test.ts:144`、`cli-script-exits.test.ts:13`、`host-extra.test.ts:32`、Tier C | 試験に使うパスは `& 全角 空白` で、半角空白・ASCII の `&`・漢字しか含まない（バイト列で確かめた）。要件の「全角記号」（`＆`・`（）`・全角空白・`・` など）を含むパスは、テストにも実機記録にも無い | テストの少なくとも1経路（generate と run）のパス名に全角記号を加える |
| R-6 | DC-03 | `docs/CONTRACT.md:488,490,212,1` | qc の入力ミスと imagegen の入力不正を `E_USAGE` としているが、実装は `E_INPUT_INVALID`（imagegen はパスなら `E_PATH_DENIED`）。終了コード2は同じ。shape の説明は M7 の列挙検査を反映していない。表題が「（M0b）」のまま | L2 の承認のもとで本文を実装に合わせる |
| R-7 | §3.4、README | `README.md:26`、`package.json` の engines | 「Node.js 22 以上」とあるが、vite 7.3.8 は `>=22.12.0` を要求し、テストの `--experimental-strip-types` は Node 22.6 以上が要る。CI は最新の 22.x を使うので検出できない | 下限を 22.12 にする。要件の「Node 22 以上」との関係は L1 に知らせる |
| R-8 | 証拠の信頼性 | `tools/runtime-smoke.mjs:10`、`tools/tier-b.mjs:6` | 証拠の `commit` は引数で渡したラベルで、作業ツリーとビルドがそのコミットであることを確かめていない。今回は commit の時刻と実行開始の順序、および `git diff` で整合を確かめた（§3） | 開発用ツールでは、実行時に HEAD と作業ツリーがクリーンであることを確かめて記録する（テストではないので CI-01 の対象外） |
| R-9 | DC-03 | `docs/CLI.md:105,142` | 終了コードの実測根拠として `docs/work/M2b/CLI-EXAMPLES.json` だけを挙げている。そこには M3 より前の `mcp serve` が終了3になった記録が含まれ、現在の挙動（`cli-add.json` では終了0）と違う | `docs/work/M7/evidence/cli-add.json` を根拠に加える |
| R-10 | GU-04、文面 | `gui/src/lib/request-io.ts`（M7 の後） | G4-M1 の文言の変化により、GUI の利用者向けの hint が「キー・型・列挙値を修正」になり、「入力と添付はそのまま」の説明が消えた | M4 の担当が文面を判断する（core の文言を変えるか、GUI が表示するときに補うか） |

### 参考

- S-1（CI-01）：`git-detector.ts` は child_process の直接呼び出しだけを検出する。`run("git", …)` のようなラッパー（例：`tools/capture-baseline.mjs:21`）は検出できない。走査からは `gui/scripts/build.mjs` を除外しているが、ここは `--commit`・`GITHUB_SHA` が無いときに HEAD を読む。現状ではテストからの呼び出しは無い。
- S-2（CI-07）：`verify-pages` の再試行は既定で12回×5秒（約1分）。クエリでキャッシュを避けているが、Pages の反映が遅れたときに足りるかは、M8 の実測で確かめる。verify ジョブはスクリーンショットと出力を artifact として残さない（CI-08 の記録は L2 が手元で行う前提）。
- S-3：ワークフローの action は `@v4` などのメジャータグで指定していて、SHA では固定していない。
- S-4（JT-03・GU 文言）：`job-template/AGENTS.md:343` が「Shin-MotionMaker（GUI）の「レンダーゴースト検査の結果」」と書いているが、GUI のこの区画の名前は「検査結果を見る」になっている（`InspectionViewer.tsx:47`）。直すには R1 の対の改訂が要るので L1 の判断になる。
- S-5（L1 への質問）：L2-Q1（ジョブ README のモデル名）と L2-Q2（JT-11(2) の文言と R4）は妥当な持ち越し。ただし記録が追跡外にしか無い（G4-M2 で扱う）。
- S-6（DC-03）：`README.md:124` の `--retry-ms`、`docs/CLI.md:32` の `studio` は実行記録が無い（後者は CLI.md:143 で明示されている）。`verify-pages.mjs` は実公開 URL ではまだ実行していない。
- S-7：MC-09 の reports・plan は拡張子 .md・.json・.txt・.csv・.png に限られ、要件より狭い。PNG のサイズ超過は、CLI では `E_PATH_DENIED`（8 MiB）、MCP では `E_INPUT_INVALID`（6 MiB）で、コードの意味が揃っていない。
- S-8：macOS ではプロセスツリーの停止が何もしない（`processes.ts:57-58,73`）。CI の対象外で、要件が求めるのは Windows を含めることだけ。
- S-9：CLI の封筒の details に、ローカルの絶対パス（ENOENT の文言）が出ることがある。MCP は伏せている。今の追跡証拠は問題ないが、CLI の出力を証拠として保存するときは注意が要る。
- S-10：`VERIFICATION.md` の Tier C の表の3行目と legacy の各行は、経路名が「CLI」だけで legacy と書いていない。JSON を見れば分かるが、表だけでは区別しにくい。
- S-11：CL-03 の ffmpeg 経路と、CL-08 の全コードの終了コード対応は、テストで網羅していない。
- S-12：npm audit の low 1件が続いている（自動の fix はしていない。M7 REPORT の記録どおり）。

## 6. M8 に進む前の条件

### 必須（M8 の着手前に満たす）

1. **G4-M1 と G4-M2 を解消する。** スクリーンショットを撮り直して `VERIFICATION.md` を更新する。受け渡しファイルを追跡するか、WORKFLOW・AGENTS を改める。
2. **P-1　main をリモートへ出す経路を決める（L2・オーナー）。**
   - M0〜M7 は、リモートが無い状態（Q-01 の既定）で main へローカルにマージしてきた（`git log --merges`）。
   - この main をそのまま push すると、絶対規則10・CI-05 が禁じる「ローカルでマージして push」「同じコミットで PR の CI が成功していないものを main に入れる」にあたる。
   - 例えば次の方法がある：リモートの main を初期コミット（またはそれに相当するもの）で作る → 現在の履歴を別ブランチとして push する → PR の CI（3環境と Tier B）が成功してからマージする。あるいは、オーナーが一度だけ例外を承認して `VERIFICATION.md` に記録する。
   - どの方法を取るかを M8 の発注書に書く。
3. **Q-01（repo の作成と公開状態）にオーナーが回答する。** Q-02（npm への公開）は既定どおり「公開しない」で進めてよい。オーナーの質問 Q-01〜Q-07 の回答状況を、追跡ファイルに一覧として記録する。
4. **リモート CI の実行証拠を取る。** ubuntu/Node 24、windows/Node 24、ubuntu/Node 22 の `ci.yml`（TS-07 の ubuntu 実行、R-6 linux と P-2 POSIX の skip 解除を含む）と、Tier B が、同じコミットで成功すること。M2a・M3・M4・M7 から持ち越している。
5. **公開するコミットで Tier C を Windows 実機で再実行する。** 要件 §9.3 と AGENTS §4 は「M7 と公開の前に」CLI・MCP の両方から実行することを求めている。M7 の実測はテンプレート 0.5.1 なので、公開するコミット（0.5.2 以降）で、手元か `runtime-smoke.yml` で取り直す。
6. **CI-08 の4条件。** 3ジョブの成功（`gh run watch --exit-status`）、手元からの `verify-pages`、公開前後のスクリーンショットの比較（比較の基準は G4-M1 で撮り直したもの）、`VERIFICATION.md` への記録。

### 推奨（M8 の前に済ませたい）

- R-1〜R-10 への対応、または見送りの理由の記録。特に R-1（`--detach` の起動失敗が0になる）、R-2（shape の列挙検査）、R-5（全角記号のパス）、R-6（CONTRACT の古い記述）。
- コミットの author・committer に個人のメールアドレスが入っている（全コミット）。push すると公開されるので、公開前に noreply アドレスへ切り替えるかどうかをオーナーが判断する。履歴を書き換えるかどうかは絶対規則（履歴を書き換えない）との兼ね合いがあるので、公開前に決める。
- L1 への質問 L2-Q1・L2-Q2、参考 S-4 を M9 の確認事項としてまとめる。
