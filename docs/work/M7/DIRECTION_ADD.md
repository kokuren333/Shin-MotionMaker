<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# 追補発注書 M7-add — M6 の持ち越しと main の取り込み

- 作業 ID：`M7`（追補）
- 担当：L3 Codex 6.1 sol 高（M7 の担当）
- 作業ツリー：`<作業ツリー>\m7`（ブランチ `m7-integration`）
- 前提：M7 本体の発注（`_handoff/M7/DIRECTION.md`）は完了済み、または完了させてからこの追補に入る。`docs/work/M7/REPORT.md` を読んで、自分の M7 の作業状態を確かめる。

## 1. main の取り込み

`main`（`7741d95`）に M6（文書の推敲、`job-template/README.md` の R3 推敲と `TEMPLATE_VERSION` 0.5.2・目録ハッシュの更新）がマージされた。`git merge main` で取り込み、衝突を解消する。M6 が編集した文書（`README.md`・`AGENTS.md`・`docs/CLI.md`・`docs/MCP.md`・`docs/DESIGN.md`・`docs/WORKFLOW.md`・`job-template/README.md`）は M6 側を正とする。Tier C・JT-12 の記録に template_version が出る場合は、取り込み後の値で整合させる（実レンダーのやり直しは不要。記録にコミットと版を明記すればよい）。

## 2. M6 の持ち越し（工学）

1. `tools/verify-cli.mjs` が `mcp serve` の旧終了コード（3）を期待して落ちる。現在の挙動（M3-fix で結線済み）に合わせて直し、最後まで通ることを確かめる。
2. DC-05（SHOULD）：依存全体（ルートと gui、実行時と開発時）のライセンスを一覧にして許容リスト（MIT／BSD／Apache-2.0／ISC など。GPL 系は不可。jszip は MIT を選択）と照合するスクリプト（例 `tools/check-licenses.mjs`）を置き、`ci.yml` で実行する。既存の `tools/audit-mcp-licenses.mjs` と統合してよい。
3. TS-06：`job-template/AGENTS.md` の「このファイルを編集する人・エージェントへ」の段落（原典 L333）の存在を明示的に表明するテストを足す。
4. `tests/helpers/host.ts` の偽ジョブの `template_version` を `version.ts` の定数から取る。

## 3. 文書の追随（M7 の DOCS_FOLLOWUP）

`docs/work/M7/DOCS_FOLLOWUP.md` に書いた文書の変更は、M6 が完了したので**この追補で M7 が反映してよい**（`docs/CLI.md`・`docs/MCP.md`・`README.md` の該当箇所だけ。文面は既存の調子に合わせ、意味を正確に。コマンド例は実行して `docs/work/M7/` に記録）。

## 受け入れ条件

- `npm test`、GUI のテスト・e2e、`node tools/ci-local.mjs`、`node tools/verify-cli.mjs`、ライセンス確認スクリプトが合格。
- REPORT に「M7-add」節。コミット先頭 `M7:`。作業ツリーをクリーンに。
