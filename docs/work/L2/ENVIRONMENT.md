<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# ENVIRONMENT — L2 統括の実行環境と縮退の記録

- 開発機：Windows 11、Node 24.15.0、npm 11.12.1、git 2.54、codex-cli 0.160.0、uv、ffmpeg（PATH）。WSL・Docker・gh は無い。
- リモート repo：未作成（Q-01 の既定。オーナー指示待ち）。そのため GitHub Actions は一度も実行していない。CI の代替は `tools/ci-local.mjs`（深さ1の複製で CI と同じコマンド）。
- **縮退 1（OS）**：ubuntu／Node 22 の実行証拠が無い。TS-07・MC-02・CL-11・TS-04 の POSIX 分岐（R-6 linux、P-2 POSIX のテストは理由付き skip）は、リモート作成後の CI で初めて実行される。M2a・M3 は「条件付き合格」とし、M8 の前提条件に積んだ。
- **縮退 2（マージ経路）**：リモートが無いため、各マイルストーンは L2 が受け入れ条件を実測したあと、ローカルで `main` に `--no-ff` マージした。PR の CI を経ていない（CI-05 の前提が成立しない期間）。M8 で main をリモートへ出す経路は G4 P-1 のとおりオーナー判断とする。
- **自己判定の回避**：各マイルストーンの完了は、実装者と別のコンテキスト（危険度の高いものは別製品）のレビューと、L2 の実測（テスト・ci-local・probe の再実行・手動の CLI 実行・画像の目視）で判定した。実装者の自己申告だけで完了にしたものは無い。
- L3 の起動：スケジュールタスク（対話セッション、`schtasks /create /sc once /it` → `/run`）。工学＝Codex 6.1 sol（reasoning effort high）、見た目・文面＝Claude Opus 5.5（effort medium）、交差レビュー＝別製品（Codex 実装→Opus レビュー、Opus 実装→Codex レビュー）または別コンテキスト。
