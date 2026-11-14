<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# 発注書 M3 — MCP（stdio サーバー、ツール、安全、docs/MCP.md）

- 作業 ID：`M3`
- 担当：L3 Codex 6.1 sol 高
- 作業ツリー：`<作業ツリー>\m3`（ブランチ `m3-mcp`、M2a マージ後の `main` から分岐。L2 が作成済み）
- 並行：M2b（CLI、ブランチ `m2b-cli`）が同じ `main` から並行して進む。**`src/host`・操作定義表・スキーマ・CONTRACT は M2a で確定済みの共有物。変更が必要なら QUESTIONS.md に書いて止め、L2 が調整する**（host の変更は最小限のバグ修正に限り、REPORT に列挙する）。
- 入力：`docs/REQUIREMENTS.md` §5（全体、MC-01〜MC-15）、§3.1（AR-01・AR-05）、§2.4（F5・F6）、§9.2 の TS-04・TS-05・TS-06（候補の部分）、§11.2 の M3 行。`docs/CONTRACT.md`（MCP SDK の採用版、`outputSchema`、`exposedInReadOnly`、`restrictToRoot`、`--allow-dir` の扱い）、`docs/work/M2a/REPORT.md`。

**この作業は安全検査を含む危険度の高いタスクで、完了後に別製品（Claude Opus）による交差レビューが入る。**

## 1. やること

1. **依存**：`@modelcontextprotocol/sdk` を CONTRACT の採用版で固定して追加（LICENSE を読んで確認、NOTICE に記録）。推移依存のライセンスも一覧にする。
2. **`src/mcp`**：stdio サーバー。host の操作定義表からツールを作る（AR-05）。ロジックを持たない（AR-01）。`node:fs`・`node:child_process`・`job-template` を直接 import しない（AR-03）。起動は `shin-motionmaker mcp serve --root <dir> [--read-only] [--enable-generation] [--allow-dir <dir>]... [--allow-engine-host <host>]...`（CLI 側の入口は M2b が作る。M3 では `src/mcp` のエントリ関数と、テスト用に直接起動できる `node` エントリを用意する。結線は L2 がマージ時に行う）。
3. **プロトコル**（MC-01）：標準出力はプロトコルのメッセージだけ。ログは標準エラー。
4. **ツール**（§5.2、MC-06）：入力スキーマは `additionalProperties: false`。出力は共通の封筒で、`structuredContent` と先頭のテキストブロックに同じ JSON、静止画は後続の画像ブロック。`outputSchema` に封筒スキーマを宣言（CONTRACT I-7）。説明文は日本語。`direction_candidates` の説明文と結果に「たたき台であり固定の正解ではない」（PH-04、TS-06）。`job_status` と `direction_candidates` に合否・スコア・順位を置かない（MC-07）。`isError` は `ok:false` のときだけ真（ゲートの fail では偽、PH-03）。
5. **安全**（MC-02〜MC-05）：パスは `--root` 相対、実体を解決して外を拒否（`E_PATH_DENIED`、ジャンクション・シンボリックリンク含む）。`--allow-dir` は CONTRACT どおり（`request.assets` に限り allow-dir 内の絶対パス）。任意コマンド実行のツールなし。`--read-only` では読み取りのツールだけ公開。`job_imagegen` は `--enable-generation` のときだけ公開。`job_voice` は非ループバックの `engine_url` を `--allow-engine-host` が無ければ `E_DISABLED`。`doctor` の Aivis 疎通も同じ許可に従う（CONTRACT R-12）。排他は host（`E_BUSY`）。
6. **run の待ち方**（MC-12〜MC-15）：`wait_ms`（0〜50,000）と既定値。`run_get` の `wait_ms`・`log_tail`（・`log_offset`）。MC-15（SHOULD）：進捗トークンがあれば待っている間に進捗通知。
7. **スナップショット**（MC-06、TS-05）：ツール名・入力スキーマ・説明文・`outputSchema` を `tests/fixtures/` 等にスナップショットとして置く。
8. **`docs/MCP.md`**：起動、ツール、run の待ち方、安全（MC-03 の「ジョブ内スクリプトの実行は `npm run` と同じ信頼の範囲」を明記）、クライアントへの登録例。**文書中の例は実際に確かめたものだけ**（DC-03）。文面の推敲は M6 で Opus が行う。

## 2. テスト

- **TS-04**（公式 SDK のクライアントから stdio でサーバーを起動）：1. `tools/list` がスナップショットと一致／2. `job_generate` → `job_status` → `project_get` → `job_qc`（`stage: pre`）。解説は `verdict: fail` で `isError` 偽、MV は `not_applicable`／3. **Tier B：`job_generate` → `job_setup` → `job_validate` が合格**（依存の導入に時間がかかるので別スクリプトでもよいが、この PC で一度実行して記録する）／4. 依存未導入で `job_validate` が `E_DEPS_MISSING`／5. `--root` の外が `E_PATH_DENIED`（ジャンクションとシンボリックリンク）、`--read-only` で書き込みのツールが公開されない／6. 標準出力にプロトコル以外が混ざらない。
- **TS-05**：操作定義表の各操作が MCP にある（CLI だけの操作は表の理由と一致）。同じ入力に対して、host の `execute` の結果と MCP の `structuredContent.result` が一致（CLI 側との突き合わせは M2b マージ後に L2 が統合テストを追加させる）。
- **TS-06（候補）**：`direction_candidates` の説明文と結果に「たたき台」。seed を省いた呼び出しが固定の結果を返さない。
- テストで `git` を起動しない。

## 3. 受け入れ条件（L2 が実測する）

- [ ] `npm test` 合格（TS-04 の Tier A 部分、TS-05、TS-06 の候補、スナップショット）。
- [ ] TS-04-3（Tier B）をこの PC で実行した記録。
- [ ] `node tools/ci-local.mjs` 合格。
- [ ] 交差レビュー（Opus、安全検査）で必須指摘なし。

## 4. 報告

`docs/work/M3/REPORT.md`。SDK の版とプロトコルの版、推移依存のライセンス一覧、安全の境界ごとのテスト名、host に入れたバグ修正（あれば）。

## M2a からの申し送り

- `docs/work/M2a/REPORT.md` の「残るプロセスの競合リスク」と R-2（TOCTOU）の残るリスクを `docs/MCP.md` の安全の節に書く（ジョブ内スクリプトは `npm run` と同じ信頼範囲であって sandbox ではないこと）。
- 存在しない `--allow-dir` は起動時に `E_PATH_DENIED`（host が検査済み）。サーバー起動時の扱いを決めて記録する。
