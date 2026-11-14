<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# 発注書 M0b — CONTRACT.md の改訂（交差レビュー M0R の反映）と基線ケースの追加

- 作業 ID：`M0b`
- 担当：L3 Codex 6.1 sol 高（M0 と同じ担当）
- 作業場所：プロジェクトルート `<repo>`（ブランチ `main`）
- 入力：`docs/work/M0/REVIEW.md`（Opus による交差レビュー。**全文を読む**）、`docs/CONTRACT.md`、`docs/work/M0/QUESTIONS.md`、`docs/REQUIREMENTS.md`

## L2 の裁定（この通りに CONTRACT を改める）

### 必須（M-1〜M-6）はすべてレビューの「直し方」を採用する。細部の裁定：

- **M-1**：run 系の操作の `result` は `CheckResult` そのもの（`{verdict?, report, artifacts, ...}`）。run の情報は封筒の `run` にだけ置く。走行中は `result: null`。`run_get` の `result` も平らにして、どの操作でも合否は `envelope.result.verdict`。
- **M-2**：`JobPath`（ジョブ相対、`/` 区切り、`..`・絶対パス禁止）と `DisplayPath`（MCP は root 相対で `..` 禁止、CLI は `process.cwd()` 相対で `/` 区切り・`..` 可）に分ける。`run.json` 内のパスはジョブ相対で、`job` は書かない（読む側が補う）。`HostContext.restrictToRoot`（MCP は true、CLI は false）を明示。`--allow-dir`：**MCP の `request.assets` に限り、実体（realpath）が allow-dir の中にある絶対パスを受け付ける。それ以外の入力は root 相対だけ。** TS-05 は cwd を MCP の root に揃えて比べる。
- **M-3**：core に `mimeTypeFor(name)` を1つ置く（原典 `tools/generate-job.ts` の拡張子表をそのまま移す）。host も GUI もそれで `Attachment.type` を決める。これは AR-06（要件）を満たすための契約上の決定で、要件の改訂ではない（job-template と基線の生成物は原典 CLI と同じ値になる）。基線に添付の拡張子が多様なケースを1つ足す（下記）。
- **M-4**：`src/core/data/version.ts` を唯一の出どころとする（`PACKAGE_VERSION`・`TEMPLATE_VERSION`）。`PACKAGE_VERSION` は `package.json` の `version` と一致することをテストで表明する。`template_version` は job-template の semver 文字列（初版 `"0.5.0"`）とし、`version.ts` に job-template 目録のハッシュ（`TEMPLATE_MANIFEST_SHA256`）も持たせ、実際の job-template と食い違えばテストが落ちる（＝テンプレートを変えたら版とハッシュの更新を強制する）。`generator` のキー位置は `schema_version` の直後、内部の順序は `name`・`version`・`template_version`。`name` は `"shin-motionmaker"`。`allowed-diffs.json` の R2 に位置を書き、JT-11 は `generator.version`・`generator.template_version` の値を正規化して照合する。GUI の `version.json`（GU-14）も同じ値を使う（`commit`・`built_at` はビルド時）。
- **M-5**：`reports/validate.json` の形を契約に書く：`{"schema": "smm.validate/1", "final": bool, "double_render": bool, "verdict": "pass"|"fail", "checks": [{"name", "status": "ok"|"error"|"skip", "message"}], "advisories": [{"id", "source": "validate", "message"}]}`。`verdict` は errors の有無だけから決め、SKIP・GHOST 行は `advisories` にだけ入れる。日時など毎回変わる値は入れない。標準出力と終了コードは変えない。
- **M-6**：`runs wait` は前面待ちと同じ（終端の `run.exit_code` を写した CL-07 のコードで終わる）。`runs get/list/logs` は取得成功で0。`--detach` で開始に成功したら0。

### 推奨（R-1〜R-14）もすべて採用する。細部の裁定：

- R-1：host に `readRunLog(job, runId, stream, offset) → {text, next_offset}`。CLI の前面待ちはこれでログを差分で流す。MCP の `run_get` には `log_offset` を任意で足してよい（足すならスナップショットに入る）。
- R-2：report は更新時刻が run の `started_at` 以降のときだけ採用。QC は終了コードと report の `verdict` を突き合わせ、食い違いは `E_INTERNAL`。ghost-check も同様。
- R-3：エラーコードの使い分け表を足す。`project.json` が無い＝`E_NOT_A_JOB`、パスが無い＝`E_JOB_NOT_FOUND`、`project.json` が壊れている＝`E_NOT_A_JOB`（`details.reason: "invalid_json"`）。対象動画が無い ghost-check・still は `E_INPUT_INVALID`（hint で先に render を促す）。事前検査の失敗（依存不足・`E_BUSY`・`E_DISABLED`）では run を作らない。`buildJobFiles` の例外は `SmmError` に揃える。`E_INPUT_INVALID` の `details` は `{pointer, reason}` の配列（日本語の `message` と組み合わせる）。
- R-4：依存を要求する操作は validate・render・`double_render` 付き ghost-check だけ。判定は host の1関数（`<job>/runtime` から `@remotion/cli/package.json` と `typescript/bin/tsc` を resolve できるか）。render の事前検査でブラウザの有無を理由に拒否しない（`doctor` の報告だけ）。
- R-5：操作ごとの argv のひな形を契約に書く。ghost-check の値に `=` を含むものは拒否。
- R-6：imagegen の run の上限は `timeout × 1000 + 300,000 ms`。win32 で `refs` とジョブのルートの実パスに `%`・`"`・改行があれば host が事前に拒否（hint 付き）。原典 `imagegen.mjs` は変えない。
- R-7：原典 `job.ts`・`mv-assist.ts`・`explainer-assist.ts` の export はすべて core の `index.ts` から同じ名前で export。`createBrief` は主名のまま。`StyleMode` は原典どおり `caption-capacity.mjs` から再 export し、core が import してよい job-template のファイルを明記（AR-03 のテストはこれだけを許す。配布物に含める）。
- R-8：候補の文脈の写し方を固定し、結果に実際に使った `seed` を入れる。MV では `characters`・`orientation` を受け付けるが無視し、その旨を結果の `notes` に書く（拒否しない）。
- R-9：`stats --kind script` で `request` があれば shape 検査を通し、添付は読まずに `createProject(form, {sources: []})` 相当で前提を導く（キャラクターの有無は form から）。`speed` は GUI と同じ規則。
- R-10：レビューの直し方どおり（records のパス列挙、`ghost-check-preview`、ghost に `verdict` を置かず `summary`、`style_mode` の規則、`hints` は `{operation, input, note}`）。
- R-11：レビューの直し方どおり。
- R-12：MCP では `doctor` の Aivis 疎通も `allowEngineHosts` に従い、未許可のホストには接続せず「未確認」と報告。CLI の `voice`・`doctor` は明示の呼び出しを許可とみなす（CLI はローカルの人・エージェントが明示的に起動するため）。
- R-13：run の全種別、`project_patch`、CLI の `studio` が同じジョブ排他を取る。
- R-14：レビューの直し方どおり（テキスト `.md`・`.json`・`.txt`・`.csv`、画像 `.png`（`reports/ghost-stills/` を含む）、PNG 上限 8 MiB、その他は `E_PATH_DENIED`）。

### 参考：I-1・I-4（`exposedInReadOnly` に改名）・I-5・I-6・I-7（MCP の `outputSchema` に封筒スキーマを宣言し、スナップショットに含める）・I-8（worker と script の両方の pid）・I-9・I-10 を反映する。I-2・I-3・I-11 は現状のまま。

### M0 の質問への回答（`docs/work/M0/QUESTIONS.md` の「回答」欄に書く）

- M0-Q1：解釈どおり。CL-11 は host が起動する子プロセスを縛る。`imagegen.mjs` の本文は D-10 で原典のまま。条件として R-6 の事前拒否を host に置く。
- M0-Q2：解釈どおり。ただし正規化するのは URL の行番号だけ。`${i + 1}人目` は 1・2 の具体文字列を列挙する。
- M0-Q3：手続きどおり。R-2・R-3 を前提にし、M2b で実測して `docs/CLI.md` の対応表とテストで固定する。分類できない exit 1 だけを `E_INTERNAL`/4 にする。

## 基線ケースの追加（M-3）

`tools/capture-baseline.mjs` で、解説の添付に `.md`・`.csv`・`.pdf`・`.png`（小さな合成ファイル）を含むケース `explainer-attachments` を追加採取する（原典 CLI の拡張子表での `mime_type`）。採取は M0 と同じ手順（スクラッチの複製）。`PROVENANCE.md`・`fixtures-baseline.test.ts` を更新する。既存10ケースの再採取結果が変わらないことを確かめる。

## 受け入れ条件（L2 が確認する）

- [ ] CONTRACT.md が上の裁定をすべて反映している（L2 がレビューの各項目と突き合わせる）。冒頭に改訂履歴（版、日付、M0R の反映）を置く。
- [ ] `docs/work/M0/QUESTIONS.md` に回答が記入されている。
- [ ] 基線 11 ケース、`npm test` と `node tools/ci-local.mjs` が合格。
- [ ] `docs/work/M0/REPORT.md` に「M0b」節を追記（変更点の一覧と、レビュー項目 → CONTRACT の節の対応表）。

コミットメッセージの先頭は `M0b:`。
