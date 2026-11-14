# M8 公開 — 実行報告

- 担当：Opus 5.5（high）。オーナーの M8 実行発注（2026-11-14）による。Codex は使っていない（Codex 停止方針）。
- 判定：公開の完了は CI-08 の4条件で判定し、証拠は [VERIFICATION.md の M8 節](../../../VERIFICATION.md#m8-公開) にまとめた。この報告は経過と原因の記録である。

## オーナーの決定

| # | 決定 | 実施 |
| --- | --- | --- |
| Q-01 | repo `kokuren333/Shin-MotionMaker` を public で作る | 作成した |
| 経路 | (a) remote main を初期コミットで作り、履歴を別ブランチの PR で入れ、PR の CI 成功後にマージする | ルートコミット `e53dd3a` で main を作り、PR #1 で取り込んだ |
| メール | push 前に全コミットの author・committer を noreply に書き換える（「履歴を書き換えない」原則の例外） | 113 コミット・13 ref を書き換えた。対応表は [COMMIT_MAP.md](COMMIT_MAP.md) |
| Q-02 | npm には公開しない | 公開していない |

## CI で見つかった不具合と修正

M0〜M7 はリモートが無く、ubuntu と GitHub の Windows runner で一度も実行していなかった（ENVIRONMENT の縮退1）。PR #1 の最初の CI で、次の不具合が出た。いずれも原因を実測してから直した。

| 現象（どこで） | 原因 | 修正 | 種別 |
| --- | --- | --- | --- |
| run の状態読み取りが「読取対象の実体が一致しない」で失敗（ubuntu：M-2・TS-07・R-5 など、毎回違うテスト） | host の記録（`run.json` など）は rename で原子的に置き換える。POSIX では読み手が rename 直前の古い inode を開き、`openVerified` の dev/ino の照合が食い違う | `openVerified` は元のまま厳格にし（R-2 は置換の検出を要求する）、実体の食い違いに内部の印を付ける。`readJobBytes` だけが印のある失敗を最大5回、最初から検証し直す | 製品 |
| ghost の結果読み取りが「今回の完了記録が一致しない」（ubuntu：host-results） | テストが `started_at` と同じミリ秒に report を書いていた。Linux のファイル時刻は Date より粗い時計なので、report が `started_at` より前に見える | テストの `started_at` を1秒前にした。製品の規則（CONTRACT：report は `started_at` 以降のものだけ採用、M2a P-9）は変えていない | テスト |
| MCP 経由の run が10秒で「同一性を確認できません」（windows：TS-04・TS-05・MC-04・MC-05・MC-13 など） | MCP SDK は stdio サーバーへ限られた環境変数しか渡さない。runner ではその環境で PowerShell のコマンドレット（`Get-CimInstance`）がモジュール探索に約22秒かかり、10秒の上限を超えた（診断ブランチで実測。全環境変数なら約0.3秒） | コマンドレットを使わず .NET を直接呼ぶ（`[Diagnostics.Process]::GetProcessById(pid).StartTime`、読めないときは `[wmisearcher]` の Win32_Process）。値はマイクロ秒に切り捨て、従来の CIM の値と同じ形にした。手元の全プロセス走査で、前者 199/199・後者 362/362 が従来値と一致 | 製品 |
| 取り消し・異常終了の停止確認が失敗（ubuntu：R-5、TS-07 cancel） | SIGKILL の直後に子孫の生存を確かめていた。SIGKILL は非同期に届く | 子孫が消えるまで最大5秒待ってから判定する（親の確認と同じ方式） | 製品 |
| CL-11 の前提が成り立たない（ubuntu） | Linux の `/tmp` は短く、8段の入れ子では 260 文字に届かない | 12段にした（表明は「260 文字超」のまま） | テスト |
| P-2 POSIX のファイルが見つからない（ubuntu） | core の `safeName` は `?` を `-` に置き換える。テストが `source?.txt` を期待していた | `source-.txt` を期待する。ブラウザの ZIP との全バイト比較はそのまま | テスト |
| MC-02 win32 の大小文字の比較が失敗（windows） | runner の TEMP は 8.3 形式の短いパスで、片側だけ realpath していた | 両側を realpath して比べる | テスト |
| e2e GU-16 の smooth スクロールの表明が失敗（windows） | runner の OS はアニメーションが無効で、Chrome が `prefers-reduced-motion: reduce` を返す | e2e のページで reduce でないときも `no-preference` を明示して模擬する | テスト |

- 交差レビュー：修正一式を別コンテキストの Opus がレビューした（approve with notes）。「mtime に 50ms の猶予を足すのは CONTRACT と M2a P-9 に反する」との指摘で、猶予を撤回し、テスト側の修正に替えた。「識別値の互換の証拠が薄い」との指摘で、全プロセス走査の照合を足した（上の表）。
- 未解決の参考指摘：`readJobBytes` の再試行が持続する食い違いを拒否することを直接確かめるテストが無い。

## Tier C

公開コミット `9d3314e` で、Windows 実機の Tier C を CLI と MCP の両方から取り直した。結果は VERIFICATION を参照。

GitHub の Runtime smoke ワークフロー（windows runner）は、生成ジョブの `run.mjs` の `--hardware-acceleration if-possible` によって Remotion が `h264_nvenc` を選び、GPU が無いので失敗した。原典由来で、`job-template/` は R1〜R5 以外を変えられないため、M8 では直さず残課題とした（L1 の判断が要る）。CI-10 により Pages の公開とは独立している。

## Pages

Pages を「GitHub Actions」配信で有効化し、main `9d3314e` に手動でデプロイした。3ジョブの成功、手元からの `verify-pages` の合格、公開前の基準（M7-gui S1）と同じバイトのスクリーンショットを確かめた。この PR で `pages.yml` に main への push の契機を足す（CI-06 の「M8 で加える」）。

## 変更したファイル

- 製品：`src/host/paths.ts`、`src/host/processes.ts`、`src/host/worker.ts`
- テスト：`tests/host-extra.test.ts`、`tests/host-files.test.ts`、`tests/host-fix.test.ts`、`tests/host-results.test.ts`、`gui/e2e/browser.mjs`
- 公開：`.github/workflows/pages.yml`（push の契機）、`README.md`（公開済みの表記と URL）
- 記録：`VERIFICATION.md`、`docs/work/M8/`
