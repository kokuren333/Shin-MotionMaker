<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# レビュー発注書 G4 — 統合レビュー（M7 の関門）

- 作業 ID：`G4`
- 担当：Opus 5.5 高（これまでの実装・レビューとは別コンテキスト）。**コードと文書を直さない。** 指摘を書くだけ。必要なら L4 サブエージェントで観点を分担してよい（結論はあなたが書く）。
- 作業場所：統合後の `main`（`<repo>`）。書き込んでよいのは `docs/work/M7/G4_REVIEW.md` だけ（コミット `G4: integration review`）。
- 入力：`docs/REQUIREMENTS.md`（**全文**）、`docs/WORKFLOW.md` の G4 の定義、`AGENTS.md`、`docs/CONTRACT.md`、`docs/CLI.md`、`docs/MCP.md`、`docs/DESIGN.md`、`README.md`、`VERIFICATION.md`、`docs/PORTING_LEDGER.md`、`docs/work/M*/REPORT.md`・`REVIEW.md`、リポジトリ全体。原典（読み取り専用）`<原典>`（`262c798`）。

## 観点

1. **要件の網羅**：REQUIREMENTS の MUST をすべて表にし、それぞれの実装箇所と証拠（テスト名、VERIFICATION の記録）を対応づける。証拠の無い MUST、SHOULD を見送った理由の記録の有無。
2. **思想（§2、交渉不可）**：制作ハーネスの緩さが保たれているか。主観的な質の合否化、表現手法の禁止・固定、創造に関わる入力のカタログ化、場面・演出を操作する命令体系（DSL・Op）が、コア・CLI・MCP・GUI・文書のどこにも入っていないか。助言が合否・終了コード・`isError`・GUI の不合格の見た目に化けていないか。候補が「たたき台」として扱われ、自動で入力に入らないか。seed が固定されていないか。
3. **MV 非退行（§6.3）**：job-template の差分が R1〜R5 だけか、基線照合テストが強いか、MV の生成物がバイト一致するか。
4. **CI と公開の準備（§8）**：git 履歴を読むテストが無いか（CI-01）、`fetch-depth` を変えていないか（CI-02）、ci.yml・pages.yml・runtime-smoke.yml が CI-03・CI-06・CI-10 を満たす形か、`tools/verify-pages.mjs` が CI-07 の内容を確かめるか。
5. **統合の証拠（M7）**：Tier C を CLI と MCP の両方から通した記録、JT-12、3入口の一致、ci-local の結果を、記録とテストの実物で確かめる。必要なら一部を再実行してよい（`npm ci`・`npm test`・`node tools/ci-local.mjs`・`npm run build` 後の CLI。実レンダーは時間がかかるので記録の検証を主にし、再実行するなら1経路だけ）。
6. **文書（§10）**：README・AGENTS・CLI.md・MCP.md の記述が実装と一致するか。コマンド例が実行記録と一致するか（DC-03）。NOTICE（DC-04）。追跡ファイルにローカルの絶対パス・メールアドレス・認証情報が無いか。
7. **未解決の残課題**：各マイルストーンの持ち越し（ubuntu／Node 22 の実行、L1 への質問）が正しく記録され、M8 の前提条件として整理されているか。

## 出力

`docs/work/M7/G4_REVIEW.md`：結論（`合格`／`条件付き合格（必須修正あり）`／`不合格`）、MUST 対応表、指摘（`必須`／`推奨`／`参考`、根拠となる要件 ID、ファイルと行、直し方）、M8 に進む前の条件の一覧。最終メッセージにも結論と必須指摘を書く。
