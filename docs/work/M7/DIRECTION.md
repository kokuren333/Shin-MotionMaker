<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# 発注書 M7 — 統合と実機検証（Tier C、JT-12、3入口の一致、ci-local）

- 作業 ID：`M7`
- 担当：L3 Codex 6.1 sol 高（統合の工学部分と実機検証）
- 作業ツリー：`<作業ツリー>\m7`（ブランチ `m7-integration`、main `f40fb77` から分岐。L2 が作成済み）
- 入力：`docs/REQUIREMENTS.md` §3.1（AR-06）、§6.3（JT-12）、§9.3（Tier A〜C）、§8.2（CI-04、CI-10）、§11.2 の M7 行。`docs/CONTRACT.md`、`docs/CLI.md`、`docs/MCP.md`、`docs/work/M*/REPORT.md`（各マイルストーンの残課題）、`VERIFICATION.md`。原典の動作確認用構成：原典 `tools/prepare-runtime-smoke.mjs`（このリポジトリに移植済みなら `tools/` のもの）。

## 1. やること

1. **3入口の一致（AR-06、TS-05 の完成）**：同じ request（解説・添付ありと MV の少なくとも2件）から、GUI 経路（core の ZIP。M4 の e2e の方式でブラウザ実行したものが望ましい）・CLI `generate`（フォルダと `--zip`）・MCP `job_generate`（`dir` と `zip`）の出力が、パスとバイトで一致することをテストに固定する。CLI の封筒の `result` と MCP の `structuredContent.result` の一致（cwd を MCP の root に揃える）を、操作定義表の同期・読取の操作について表明する。
2. **Tier B**：生成 → `setup` → `validate` を CLI と MCP の両方で通すスクリプト（例 `npm run test:tier-b`）を整え、この PC で実行して記録する。
3. **Tier C（実レンダー、Windows 実機）**：原典 `tools/prepare-runtime-smoke.mjs` の構成の動作確認用ジョブで、`sound` → `validate` → `render --target preview` → `render --target still` → `ghost-check --target preview` → `render --target final` → `ghost-check` を、**CLI と MCP（run のポーリング：`wait_ms` 付きの `run_get`）の両方から**通す。オーケストレーターのスクリプト（例 `tools/runtime-smoke.mjs`）を置き、`runtime-smoke.yml`（`workflow_dispatch` と main、Pages と切り離す。CI-10）から呼べる形にする。ジョブのパスには `&`・全角・空白を含めた場所も1回使う。実行時間、各 run の ID・状態・終了コード・成果物を記録する。
4. **JT-12（原典生成ジョブの互換）**：原典 `262c798` が生成したジョブ（`schema_version` 0.4、`generator` なし。M0 のスクラッチの原典複製の `tools/generate-job.ts` で生成してよい。原典の作業ツリーでは実行しない）を、新しい CLI で `status`・`validate`・`qc`・`ghost-check`・`render` に掛け、結果を記録する。`reports/validate.json` が無い場合に終了コードと標準出力から結果が組み立てられることを確かめる。
5. **ci-local**：最終の統合コミットで `node tools/ci-local.mjs` を通す（GUI の e2e を含む）。
6. **`tools/verify-pages.mjs`**（CI-07）：M8 で使う公開後確認スクリプトを用意し、ローカルの Pages 用ビルド（サブパス配信）に対して実行して合格させる（`--expect-commit`、title、`version.json`、JS/CSS の 200、ヘッドレスブラウザで見出しと ZIP ボタン、コンソールエラーなし、再試行）。`pages.yml` から呼ぶ形にする（実行は M8）。
7. **`VERIFICATION.md`**：上の 2〜6 の記録（コマンド、日時、コミット、結果の要点、成果物のパスとハッシュ）を追記する。

## 2. 規則

- 既存のテストの表明を弱めない。統合で見つけた不具合を直すときは、どのマイルストーンの成果に関わるかを REPORT に書く。契約に関わる変更は QUESTIONS.md（止まる）。
- `job-template/` を変えない。
- テストで `git` を起動しない（ci-local・verify-pages は開発ツールなので可）。
- 実レンダーは時間とディスクを使う。終わったら一時ジョブの `node_modules` と出力の大きなファイルを消す（記録に要るハッシュを取ってから）。

## 3. 受け入れ条件（L2 が実測し、G4 統合レビューへ）

- [ ] 全テスト合格（`npm test`、GUI のテスト・e2e）。
- [ ] Tier C を Windows 実機で CLI と MCP の両方から通した記録（`VERIFICATION.md`）。
- [ ] JT-12 の互換確認の記録。
- [ ] `node tools/ci-local.mjs` 合格。
- [ ] `tools/verify-pages.mjs` がローカル配信に合格。
- [ ] G4 統合レビュー（L2 が別途発注）で必須指摘なし。

## 4. 報告

`docs/work/M7/REPORT.md`。各マイルストーンの残課題のうち M7 で解消したもの・残ったもの、ubuntu で未確認の項目の一覧。

## 追加（L2 裁定：M4 QUESTIONS Q1）

8. **列挙値の集合の公開と shape での検査**（契約の変更。L2 承認済み）：`src/core` から既存の列挙項目（F4 の `tempo`・`energy`・`motionAmount`・`biimUsage`・`characterUsage`・`evidencePolicy`・`styleMode` と、`videoMode` など原典 `validateForm` が列挙で検査している項目）の集合を定数 `formChoices` として公開する。`validateForm` はこの定数を使うように書き換えるが、**エラー文言と種別は変えない**（JT-11 の文言集合の照合が通ること）。`validateRequest` の `shape` 段で、列挙項目の値が集合の外なら `E_INPUT_INVALID`（`details` に `{pointer, reason}`）とする（未知キーの拒否と同じ扱い。F2 の「構造の検査」に当たる）。**新しい列挙項目を足さない**（F4）。GUI の `gui/src/lib/request-io.ts` の `choiceIssues` を、この shape の結果に置き換える（e2e R1 のテストが引き続き通ること）。CLI・MCP の読み込みにも同じ効果が及ぶことをテストする。`docs/CONTRACT.md` に改訂履歴の行を足す（「M7：formChoices と shape の列挙検査（M4-Q1、L2 承認）」）。TS-03 のスナップショットを更新し、創造に関わる項目が文字列のままであることは変えない。

## 並行作業との分担（L2）

- M6（文書の推敲、Opus、ブランチ `m6-docs`）が並行して進む。**M7 は `README.md`・`AGENTS.md`・`docs/CLI.md`・`docs/MCP.md`・`docs/DESIGN.md`・`docs/WORKFLOW.md`・`job-template/README.md` を編集しない。** M7 の成果で文書の変更が要る箇所（例：`formChoices` による CLI/MCP のエラー例、Tier C・verify-pages の使い方）は `docs/work/M7/DOCS_FOLLOWUP.md` に書く（L2 が M6 の仕上げで反映させる）。`docs/CONTRACT.md` の改訂履歴の追記と `VERIFICATION.md` は M7 が編集してよい。
- 作業ツリーは main `f40fb77`（M0〜M5 すべてマージ済み）から分岐する。
