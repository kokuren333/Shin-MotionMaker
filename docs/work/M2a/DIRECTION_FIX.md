<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# 差し戻し発注書 M2a-fix — 交差レビュー M2aR の反映

- 作業 ID：`M2a`（修正）
- 担当：L3 Codex 6.1 sol 高（M2a の実装担当）
- 作業ツリー：`<作業ツリー>\m2a`（ブランチ `m2a-host`）
- 入力：`docs/work/M2a/REVIEW.md`（Opus による交差レビュー。**全文を読む**。再現手順の probe は `<スクラッチ>\m2ar\` にある）、`docs/work/M2a/REPORT.md`、`docs/CONTRACT.md`

## L2 の裁定（直すもの）

1. **必須 M-1**：絶対パスの添付は、ファイルシステムに触れる前に文字列として allow-dir 配下か検査する。UNC・`\?\`・`\.\` は、その形の allow-dir が明示されていない限り即拒否。安全検査中のファイルシステムのエラーは `E_PATH_DENIED` に正規化（ENOENT は「添付が無い」）。テスト追加（レビューの 4.）。
2. **必須 M-2**：PID の同一性を記録・照合する（worker と script の両方。起動時刻やコマンドラインなど。Windows は配列引数で PowerShell/CIM を呼ぶか Job Object、Linux は `/proc/<pid>/stat` の starttime）。同一でなければ不在扱い、同一性を確認できない pid には停止シグナル・`taskkill` を送らない。heartbeat が十分古く同一でなければ `lost`。PID 再利用のテスト（レビューの probe 2件をテスト化）。
3. **M-3（ubuntu の証拠）**：リモートが無いので L2 が残課題として持ち越す（CI 作成後に確認）。あなたは POSIX の経路のテストが ubuntu で意味を持つように書かれていることを確かめ、win32 専用・POSIX 専用のテストに `skip` 理由を明記する（黙ってスキップしない）。
4. **R-1**：`restrictToRoot` のとき、root 内の相対パスで読む通常ファイル（`report_get`、添付）で `nlink > 1` を拒否（`E_PATH_DENIED`）。
5. **R-2**：読み取りは open 後に `handle.stat()` の dev/ino と realpath 先の stat を照合。書き込みは確認済みの親の直下に作り、作成後に親の実体を再照合。残るリスクを REPORT に書く（`docs/MCP.md` は M3 が書くので、M3 への申し送りとして REPORT に）。
6. **R-3**：`cancelRun` の worker 不在分岐に heartbeat の猶予、worker は保存前に run.json を読み終端なら上書きしない（または revision の CAS）、`releaseOwnedLock` は token も照合。
7. **R-4**：ログ末尾の絶対パス置換に file URL（パーセント符号化）・realpath の形・host の導入先を含める。worker が stderr.log に書くのは `code`・`message`・`reason` だけ（スタックは書かない）。
8. **R-5**：`lost` と時間切れの E2E を本物の経路（`startRun`・worker を強制終了 → heartbeat 途絶 → `lost` → 回収 → 次の run）で1件ずつ。
9. **R-6**：POSIX の停止を SIGTERM → 猶予 → SIGKILL に。孫が `detached` で起動するフィクスチャのテスト（ubuntu 用。Windows では `taskkill /T` の同等テスト）。
10. **R-7**：npm の entry は `npm-cli.js` という名前を要求し、PATH の要素は絶対パスのみ使う。
11. 参考：P-1（存在しない allow-dir を起動時に検査し、添付の不在と区別）、P-2（**生成時のパス検査は原典 `tools/generate-job.ts` と同じ規則にして GUI と食い違わないようにする。Windows 固有の禁止は win32 のときだけ。`status` の stale 判定で検査できないキーは例外にせず `stale: true`**）、P-3（`failed` に `details.reason`）、P-4（エラーに `run` を付ける）、P-5（engine_url の許可判定をロック取得後にも）、P-6（文言修正）、P-7（`status.runs` は実行中＋直近20件）、P-8（hint に回復手順をジョブ相対パスで）、P-9（mtime 粒度の注意を REPORT に）を反映。

## 受け入れ条件

- `npm test` 合格（Windows）、`node tools/ci-local.mjs` 合格。
- REPORT に「M2a-fix」節（指摘 → 対応 → テスト名の表）。CONTRACT を変える必要が出たら QUESTIONS.md（変えずに止まる）。
- コミット先頭 `M2a:`。作業ツリーをクリーンに。
