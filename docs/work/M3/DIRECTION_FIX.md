<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# 差し戻し発注書 M3-fix — 交差レビュー M3R の反映と CLI との結線

- 作業 ID：`M3`（修正）
- 担当：L3 Codex 6.1 sol 高（M3 の実装担当）
- 作業ツリー：`<作業ツリー>\m3`（ブランチ `m3-mcp`）
- 入力：`docs/work/M3/REVIEW.md`（Opus による交差レビュー。**全文を読む**。probe は `<スクラッチ>\m3r\`）、`docs/work/M3/REPORT.md`、`docs/CONTRACT.md`、`docs/CLI.md`、`docs/work/M2b/REPORT.md`

## 0. 最初に main を取り込む

`main` には M2b（CLI）と M4（GUI）がマージ済み（`91c939f`）。作業の最初に `git merge main` で取り込み、衝突を解消する（`src/host/worker.ts` の setup の cwd 修正は M2b と M3 の両方が入れている。意味が同じなら一方に統一）。マージ後に `npm test` と GUI のテストが通ることを確かめてから修正に入る。

## L2 の裁定（直すもの）

1. **必須 M-1（契約の変更。L2 承認済み）**：MCP の結果で PNG の本体を1回だけ送る。`structuredContent` と先頭の text の封筒では、`report_get` の画像の `result.data` を `null` にし、`mime_type`・`bytes`・`sha256`・`delivered_as: "image"` を入れる。画像本体は後続の image ブロックだけ。さらに MCP（`restrictToRoot`）の PNG の上限を **6 MiB**（base64 後に約 8 MiB で、SDK 既定の受信上限 10 MiB に収まる）とし、超えたら接続を切らずに `E_INPUT_INVALID` と hint（「CLI の `smm report` を使う」等）を封筒で返す。CLI の `report`（上限 8 MiB、data に base64）は変えない。封筒スキーマ／`outputSchema`／スナップショット／`docs/CONTRACT.md`（改訂履歴に「M3-fix：MCP の画像は image ブロックだけで送る、MCP の PNG 上限 6 MiB（M3R M-1、L2 承認）」）／`docs/MCP.md` を更新。**受信上限を既定のままにした SDK クライアントで**、上限付近の PNG が読めること・上限超えが封筒で拒否され接続が切れないことを TS-04 に足す。テスト helper の `maxBufferSize` 拡大は、それが必要な試験だけに限定して理由を書く。
2. **必須 M-2**：
   - Tier B を CI に足す：`.github/workflows/ci.yml` に ubuntu の Tier B ジョブ（`tools/smoke-mcp.ts` 等の generate → setup → validate、ジョブ依存の npm キャッシュ付き）。この PC でも同じコマンドを実行して記録。
   - Node 22 の ExperimentalWarning 等で stderr の厳密比較が落ちないよう、警告行を除いて比較する（または `dist/` のビルド済み JS で起動する）。
   - **TS-05 の CLI 側**：M2b の CLI が main にあるので、操作定義表の同期・読取の操作について、同じ入力で CLI の封筒の `result` と MCP の `structuredContent.result` が一致することをテストにする（cwd を MCP の root に揃える）。
   - **CLI との結線**：M2b が仮に置いた `smm mcp serve` を、`src/mcp` のサーバーに結線する（`--root`・`--read-only`・`--enable-generation`・`--allow-dir`・`--allow-engine-host`）。ビルド済みの `node dist/cli/main.js mcp serve --root <dir>` を SDK のクライアントから起動する試験を1件。`docs/MCP.md` と `docs/CLI.md` の登録例をこの形に。
   - ubuntu・Node 22 での実行そのものは L2 が持ち越し（リモート作成後の CI）。
3. **R-1**：`displayLog`（と MCP に返す report の文字列）で、`os.homedir()`（realpath、`/` 区切り、file URL、win32 は大文字小文字を区別しない）を `~` に置き換える。**加えて、MCP に返す `structuredContent` 内のジョブ内スクリプト由来の文字列（例：`qc.mjs` の report の `detail` にある `ENOENT ... open 'C:\Users\...\plan\direction.md'`）に含まれるジョブ・root の絶対パスもジョブ相対・root 相対に置き換える**（host の表示用変換として。ジョブ内のファイル自体は変えない）。テスト追加。
4. **R-2**：`--root` が存在しない・ディレクトリでない場合は、`E_USAGE`（または `E_PATH_DENIED`）と hint を出して終了2。MC-01 の試験に2件。
5. **R-3**：read-only で正しい入力の書き込み系ツールを呼んでも `E_DISABLED` で副作用が無いこと、ジョブ内の junction・ハードリンク・添付のハードリンクが MCP 経由で `E_PATH_DENIED` になることを試験にする。
6. 参考：P-1・P-2 は `docs/MCP.md`／REPORT に記録。P-3 は host で `RangeError`（深すぎる入れ子）を `E_INPUT_INVALID` に分類できるなら分類（core の原典由来の統計は変えない）。P-4 は文書の主語を「host の疎通確認は」に限定。P-7 は現状のまま。

## 受け入れ条件

- `npm test`、GUI のテスト・e2e、`node tools/ci-local.mjs` が合格。Tier B をこの PC で実行した記録。
- REPORT に「M3-fix」節（指摘 → 対応 → テスト名）。
- コミット先頭 `M3:`。作業ツリーをクリーンに。
