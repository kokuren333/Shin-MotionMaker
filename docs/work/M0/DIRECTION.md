<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# 発注書 M0 — 立ち上げと基線採取

- 作業 ID：`M0`
- 担当：L3 Codex 6.1 sol 高
- 作業場所：プロジェクトルート `<repo>`（ここで `git init`。ブランチは `main`）
- 入力：`docs/REQUIREMENTS.md` の §2.3、§3（特に §3.1〜§3.4）、§4〜§5（CONTRACT の材料）、§6（特に §6.3 JT-10）、§8.2（CI-01〜CI-04）、§9.1、§10（DC-01・DC-02・DC-04）、§11.2 の M0 行

## 1. repo の初期化

1. プロジェクトルートで `git init -b main`。`.gitignore` に少なくとも `/_handoff/`、`node_modules/`、`dist/`、`*.log`、`.smm/` を入れる。`_handoff/` を絶対にコミットしない。
2. 既にある `docs/REQUIREMENTS.md` をそのままコミットする（内容を変えない）。
3. git の作者設定はこの repo ローカルで `user.name "kokuren333"`、`user.email` は原典 repo の直近コミットの作者メールと同じもの（`git -C <原典> log -1 --format=%ae` で取得）を使う。

## 2. 骨格（§3.2 の構成に沿う）

- `LICENSE`：Apache-2.0 全文（原典の `LICENSE` と同じ文面でよい）。
- `NOTICE`：DC-04 の項目の初版（BiimMotion `262c798` 由来、CyberSprite 由来は「M4・M5 で記入」と書いておいてよい、同梱フォント、Remotion の注意）。
- `AGENTS.md`：DC-01 の初版。**§2.3 の宣言文を文言を変えずに入れる**（見出しの番号だけ調整可）。絶対規則、開発ハーネスと制作ハーネスの区別、§8 の公開規則の要点、正本の一覧。完成版は M6 で文面を整えるので、ここでは要件の項目が全部入っていればよい。
- `CLAUDE.md`：`@AGENTS.md` の1行。
- `docs/WORKFLOW.md`：原典 `docs/WORKFLOW.md` から、層（L1〜L4）、ゲート（G1〜G4）、受け渡しファイル（`docs/work/<作業ID>/` の PLAN・DIRECTION・REPORT・REVIEW・QUESTIONS・ENVIRONMENT・RETRO）を移し、名称を Shin-MotionMaker に改める（DC-02）。
- `package.json`：名前 `shin-motionmaker`、`"type": "module"`、`"engines": {"node": ">=22"}`、`bin`（`shin-motionmaker` と `smm`。実体は M2b で作るので、存在しないファイルを指してよいが `npm ci` が壊れないこと）、`workspaces: ["gui"]`、`scripts.test`（`node --experimental-strip-types --test "tests/**/*.test.ts"` 相当。Windows と Linux の両方で動くグロブにする。原典は `tests/*.test.ts`）、`scripts.build`（M0 では型検査だけでよい）。`package-lock.json` をコミットする。
- `gui/package.json`：M4 で本体を作る。M0 では `npm ci` と `npm test --workspaces --if-present` が通る最小の placeholder。
- `tsconfig.json`：原典の設定を参考に。
- 空でよいディレクトリ（`src/core/` `src/host/` `src/cli/` `src/mcp/` `schemas/` `job-assets/fonts/` `assets/ui/icons/` `tools/` `docs/work/`）は、必要なら `.gitkeep` で置く。`job-template/` と `src/core` の中身は **M1 で移植する**ので M0 では作らない。

## 3. M0 のテスト

- `tests/no-git.test.ts`（CI-01）：`tests/` と `gui/`（`node_modules` を除く）のテストコード・テスト用ヘルパーを走査し、`git` を起動するコード（`child_process` 経由の `git`、`execa('git'`、`spawn("git"` など）を検出したら失敗する。このテスト自身は `git` を起動しない。検出の正規表現が自分自身の文字列で誤検出しないように作る。陽性のサンプル（フィクスチャ内の文字列）で検出が働くことも表明する。
- `tests/agents-declaration.test.ts`（TS-06 の一部）：ルート `AGENTS.md` に §2.3 の宣言文（見出しの番号を除いて本文が一字一句）があることを表明する。期待値は `docs/REQUIREMENTS.md` の §2.3 のコードブロックから読む（ハードコードとの二重持ちを避ける）。
- `tests/fixtures-baseline.test.ts`：基線フィクスチャの形が揃っていること（各ファイルの存在、JSON がパースできる、`test-inventory.json` の件数と名前の数が一致、golden の各ケースに request.json と出力がある）。照合そのもの（JT-11）は M1。

## 4. 基線フィクスチャの採取（JT-10。最重要）

`tests/fixtures/baseline-biimmotion-262c798/` に置く。採取スクリプトは `tools/capture-baseline.mjs`（または `.ts`）に置き、CI では実行しない（テストからも呼ばない）。

1. 原典を `<スクラッチ>\biim-262c798` に `git clone --no-hardlinks` し、`262c798` を checkout、そこで `npm ci`。**原典の作業ツリーでは何も実行しない。**
2. `template-manifest.json`：原典 `job-template/` の全ファイルと同梱フォント（`public/job-assets/fonts/`）の、相対パス・SHA-256・バイト数。原典の Vite glob とジョブ生成の除外規則（`tools/generate-job.ts` L122〜124）で除外されるものは区別して記録する（除外対象か否かのフラグ）。
3. `golden/<ケース>/`：各ケースについて `request.json`（CL-01 の `{form, assets}` 形）と、原典のコアが出力した `project.json`・`brief.md`・依頼文（`agentPromptFor` 等、原典で依頼文を作る関数の出力。ファイル名は `agent-prompt.txt`）・`plan/lyrics.txt`（MV）・ZIP の目録（`zip-manifest.json`：ZIP 内の全パスと SHA-256、ZIP 名とルートフォルダ名）。必要なら完全な ZIP 自体は置かず目録だけにする（サイズを抑える。ただし生成された非テンプレートのファイルは本文も置く）。
   - ケース（§6.3 JT-10）：`mv-landscape`、`mv-portrait-options`（原典 `tests/explainer.test.ts` L225 付近の2設定を再現）、`explainer-biim-solo`、`explainer-biim-duo`、`explainer-anime`、`explainer-motion`、`explainer-mixed`、`explainer-fullscreen`、`explainer-portrait`、`minimal`。
   - 原典の生成は、原典の `tools/generate-job.ts` を使うか、原典の `src/job.ts` を import する採取スクリプトで行う。どちらの場合も、原典のコードを一切改変しない。時刻・乱数など非決定の要素があれば、それを固定する方法と、固定できなかったものを PROVENANCE に書く。
   - 添付ファイル（音源・GLB など）が要るケースは、小さな合成ファイル（例：無音の短い WAV）をフィクスチャに置いて使う。
4. `validateForm` のエラー文言の集合（JT-11 の3）：原典の `validateForm` を、エラーを全部引き出す入力群に掛けて、返る文言の集合を `validate-form-messages.json` に保存する。どの入力で出したかも記録する。
5. `test-inventory.json`：原典で `npm test` を実行し、実行されたテスト名の全件（ファイル名、スイート、テスト名）と件数、合否を記録する。TAP か JSON 系のレポーターで機械的に取る。発注書の値は「81」だが、実数を記録する。
6. `allowed-diffs.json`：§6.2 の R1〜R5 を機械可読にした初版。R1 の置換の対は、この時点で分かっているものを列挙し、M1 で確定する旨を書く（M1 が増補する）。
7. `PROVENANCE.md`：採取元のコミット、採取コマンド（ローカルの絶対パスを書かない。`<原典の複製>` のように書く）、採取日、Node と npm の版、原典の基線テストが `955fa5c` との一致を表明していたこと（`tests/explainer.test.ts` L210 付近、`git show` による。§8.1 の事故の原因）。

## 5. ci-local（CI-04）と CI の骨格

- `tools/ci-local.mjs`：現在の HEAD を深さ1で一時フォルダへ `git clone --depth 1 file://...` し、そこで CI と同じコマンド（`npm ci` → `npm run build` → `npm test` → GUI のテストとビルド（`--workspaces --if-present`））を実行する。結果を標準出力に要約し、失敗なら非0で終わる。一時フォルダは最後に消す（失敗時は残すオプションがあってよい）。これは開発ツールなので `git` を使ってよい（テストではない）。
- `.github/workflows/ci.yml`：CI-03 の骨格（PR と push、ubuntu と windows、Node 24、ubuntu は 22 も、`actions/checkout` は深さを指定しない）。リモートはまだ無いので実行はされない。
- `.github/workflows/pages.yml`：CI-06 の3ジョブの骨格（`workflow_dispatch` のみ）。`tools/verify-pages.mjs` は M8 前に作るので、ここでは呼び出しの形だけでよい。
- `.github/workflows/runtime-smoke.yml`：CI-10 の骨格（`workflow_dispatch` のみでよい）。

## 6. `docs/CONTRACT.md` 初版（交差レビュー対象）

REQUIREMENTS §3〜§5 から、後続の全員が依存する契約を書き起こす。ここは後続の M1〜M4 が並行で依存するので、曖昧さを残さない。

1. core の公開 API（モジュール構成：フォーム型と既定値、`validateRequest`（AR-04 の1関数）、`validateForm`、`createProject`、`briefFor`、依頼文、`buildJobFiles`（テンプレートの読み込み結果を引数に取る純粋関数）、ZIP 化、たたき台（seed の扱い PH-06）、統計、失敗チェックリスト、検査結果 JSON の読み取り）。関数のシグネチャ（TypeScript の型）を書く。原典の関数名と対応表を付ける。
2. host の公開 API（テンプレート読み込み、書き出し、パス検査、スクリプト実行、run 台帳、排他、doctor、project の読み書き、状態の導出）。
3. **操作定義表**（AR-05）：操作 ID、CLI のサブコマンド、MCP のツール名、種別（同期・読取／同期・書込／run）、入力の要旨、`--read-only` で公開するか、`--enable-generation` の要否、run の既定 `wait_ms`、上限時間。CLI だけの操作（`studio`・`mcp serve`・`version`）は理由付き。
4. 封筒 `smm.envelope/1`、run `smm.run/1`、ジョブ状態、エラーコード（CL-08）、終了コード（CL-07）。ジョブ内スクリプトの終了コードからの対応は、原典の `job-template/runtime/scripts/*.mjs` を読んで初版を書く（M2b で確定）。
5. スキーマ名の一覧（`smm.<名前>/<版>`）と `schemas/` のファイル名。JSON Schema 本体は M2a 以降でよいが、名前と所有するマイルストーンを書く。
6. 変更手続き：この文書の変更は L2 の承認を要する旨。

## 7. MCP SDK の版（§3.4）

`npm view @modelcontextprotocol/sdk` で最新版とライセンスを確かめ、使う版を決めて `docs/CONTRACT.md` と `docs/work/M0/REPORT.md` に記録する。依存の追加自体は M3 で行う（M0 では入れなくてよい）。LICENSE の種類を必ず確認する。

## 8. 受け入れ条件（L2 が実測する）

- [ ] `tests/fixtures/baseline-biimmotion-262c798/` と `PROVENANCE.md` がコミットされている（template-manifest、golden 10ケース、validate-form-messages、test-inventory、allowed-diffs）。
- [ ] 原典のテスト件数と名前が `test-inventory.json` に記録されている。
- [ ] `node tools/ci-local.mjs` が合格する（git 検出テスト・宣言文テスト・フィクスチャ形テストを含む）。
- [ ] `docs/CONTRACT.md` 初版がある（交差レビューは L2 が別に発注する）。
- [ ] ルート `AGENTS.md` に §2.3 の宣言文がある。
- [ ] `_handoff/` が追跡されていない。追跡ファイルにローカルの絶対パス・メールアドレスが無い（`git grep -n "C:\\\\Users"` 等で確かめた結果を REPORT に）。※ git の author 情報は除く。
- [ ] 原典 repo の作業ツリーが無変更（`git -C <原典> status --short` が空、HEAD が `262c798`）。

## 9. 報告

`docs/work/M0/REPORT.md` をコミット（共通部の形式）。原典のテスト件数、採取できなかったもの・固定できなかった非決定要素、CONTRACT で決めきれなかった点を必ず書く。
