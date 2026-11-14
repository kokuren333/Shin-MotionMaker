<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# 差し戻し発注書 M4-fix — レビュー M4R の反映

- 作業 ID：`M4`（修正）
- 担当：L3 Opus 5.5 中（M4 の実装担当）
- 作業ツリー：`<作業ツリー>\m4`（ブランチ `m4-gui`）
- 入力：`docs/work/M4/REVIEW.md`（Codex による独立レビュー。**全文を読む**。各指摘に再現手順がある）、`docs/work/M4/REPORT.md`

## L2 の裁定（直すもの）

1. **必須 R1**：不正な列挙値（例 `styleMode: "unknown"`）を含む request の読み込みで画面が消える。core の `validateRequest` を通したうえで、表示前に列挙値を検査して入力エラーとして表示し、操作を継続できるようにする。**読み込みに失敗したら既存の入力・添付を消さない**（読み込みは成功したときだけ反映）。GUI 独自のスキーマを作らない：列挙値の集合は core の定義（`explainerStyles` 等）から取る。もし core の検査（shape/complete）に列挙値の検査を足すべきだと判断したら、変えずに `docs/work/M4/QUESTIONS.md` に書く（core は契約の範囲で L2 が調整する）。e2e を追加。
2. **必須 R2**：run.json 経由でも QC の免除・`review_mode` を表示する（直接 QC を開いた場合と同じ部品を使う）。単体と e2e を追加。
3. **必須 R3**：CLI コマンド例のクォート。対象シェルを明示して、PowerShell 用（単一引用符、内部の `'` は `''`）と POSIX シェル用（単一引用符、内部の `'` は `'\''`）の例を分けて出す。タイトルの自由記述を狭めない（ファイル名の安全化は既存の規則のまま）。`$()`、バッククォート、`'`、`"`、`&`、空白、全角が1引数として届くことをテストする（PowerShell は実際に `powershell.exe -NoProfile -Command` へ配列引数で渡して確かめてよい。POSIX 側は文字列の規則の単体テストで足りる）。
4. **必須 R4**：`prefers-reduced-motion: reduce` のとき `scrollIntoView` に smooth を渡さない。生成エラーと読み込みエラーの経路を含む e2e。
5. **推奨 T1**：全入力欄テストに `fullScreen` の切り替え・4様式の反映・編集した MV デザインの往復を加える。キーボード到達を、主要な動的状態（MV、duo、検査結果表示、ダイアログ）ごとに確かめる。進捗（生成中の disabled と終端）を確かめる。
6. **参考 I1**：REPORT の「CLI 経路のバイト一致」の記述を、実際の証拠の範囲（ブラウザ対ファイルシステム読み＋core）に正す。実 CLI・MCP との比較は M7 の統合で行う（L2 が持つ）。
7. スクリーンショットに影響する変更をしたら撮り直し、`VERIFICATION.md` を更新する。

## 受け入れ条件

- ルート `npm test`、`npm test --workspaces --if-present`、`npm run build --workspaces --if-present`、`node tools/ci-local.mjs` が合格。
- REPORT に「M4-fix」節（指摘 → 対応 → テスト名）。
- コミット先頭 `M4:`。作業ツリーをクリーンに。
