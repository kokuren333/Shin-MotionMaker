# M0R — `docs/CONTRACT.md` 初版の交差レビュー

- 作業 ID：M0R（レビュー担当 Opus 5.5。実装者 Codex とは別製品・別コンテキスト）
- 対象：`docs/CONTRACT.md`（コミット 35b3c20 時点）、`docs/work/M0/REPORT.md`、`docs/work/M0/QUESTIONS.md`
- 照合した要件：`docs/REQUIREMENTS.md` 全文（特に §2.4、§3、§4、§5、§6.2、§12）
- 照合した原典（262c798、読み取りのみ。実行・導入なし）：`src/job.ts`、`src/mv-assist.ts`、`src/explainer-assist.ts`、`src/templates.ts`、`src/App.tsx`（該当行のみ）、`tools/generate-job.ts`、`job-template/package.json`、`job-template/runtime/package.json`、`job-template/runtime/scripts/{run,lib,validate,qc,ghost-check,imagegen,aivis,sound-design,caption-capacity}.mjs`、`tests/*.test.ts` の import 文
- 機械照合：CONTRACT §1 の `CharacterForm`・`MotionForm` を原典 `src/job.ts` L8〜74 と diff し、`export` 以外は**完全一致**。

## 結論

**条件付き承認（必須修正あり）**

骨格は要件に沿っている。F5（場面操作の種別が無い）、MC-07（状態全体の合否・スコア・順位が無い）、PH-03（`isError` は `ok:false` と同値で、fail だけでは真にしない）、PH-04（候補を自動で入れない）、PH-06（seed 省略時に毎回乱数）、層の分離（core は純粋でテンプレートは引数、読み込みは host、CLI・MCP は `execute` を共有）はいずれも満たしている。§8 の原典スクリプトの終了コードの記述も、実物（下記）と合っている。

ただし、要件と食い違う箇所が1つ（CL-06 の `result.verdict` の位置）あり、並行する M1・M2a・M2b・M3・M4 が別々に解釈しうる箇所が5つある。いずれも直し方は小さいので、下の M-1〜M-6 を直してから M1 以降へ渡すことを求める。

## 指摘一覧

重大度：**必須**＝要件との矛盾、または並行タスクが食い違う解釈をしうるので、着手前に直す。**推奨**＝直さなければ後の工程で手戻りや事故の原因になる。**参考**＝記録か軽微な点。

### 必須

#### M-1 run 系の結果で `verdict` が `result.result.verdict` に埋もれ、CL-06 の `result.verdict` と食い違う

- 箇所：§5 の結果表「run 系の開始」`{run_id, status, result?:CheckResult}`、`run_get` `{run, stdout_tail, stderr_tail, result?}`
- 根拠：CL-06「ゲートの合否は `result.verdict`（`pass`・`fail`・`not_applicable`）に入れる」、CL-05 の封筒例（`"result": {"verdict": "fail", ...}`、`run` は封筒の最上位）、TS-04-2、TS-05
- 内容：契約どおりに作ると、`qc` の合否は `envelope.result.result.verdict` に入る。要件が名指ししている取り出し位置は `envelope.result.verdict` である。`run_id`・`status` も封筒の `run` と重複している。
- 直し方：run 系の開始操作の `result` を `CheckResult` そのもの（`{verdict?, report, artifacts}`）にし、run の情報は封筒の `run` だけに置く。走行中に返す場合は `result` を `null`（またはフィールドの無い `{}`）にする。`run_get` も `{run, stdout_tail, stderr_tail, verdict?, report?, artifacts?}` のように平らにし、どの操作でも `result.verdict` で合否が読めるように揃える。

#### M-2 パスの基準が決まっていない（共有 run 台帳の `job`、CLI の root、`artifacts`、`--allow-dir` の指し方）

- 箇所：§1 `RelativePath`（`..` を拒否）、§3 `HostContext.root`・パスの各項目、§5 `Envelope.job`・`GenerateResult.job/archive`、§6 `Run.job`（「job は root 相対」）・`Run.artifacts`、§5 `CheckResult.artifacts`
- 根拠：MC-02、MC-10（CLI が始めた run を MCP から見られる）、CL-05、TS-05（CLI の `result` と MCP の `result` が一致）
- 内容：
  1. `run.json` はジョブの中に永続し、CLI と MCP の両方から読まれる。ところが CLI と MCP では root が違う（CLI は未定義、MCP は `--root`）。「root 相対」の `job` を書き込むと、書いた側の root に依存した値が台帳に残る。
  2. CLI の `HostContext.root` が何か（cwd か）が書かれていない。CLI は `--out` に絶対パスを受け付けるので、出力が cwd の外ならパスに `..` が要る。その場合、`..` を拒否する `RelativePath` 型とぶつかる。
  3. `artifacts` の基準（ジョブ相対か root 相対か）が書かれていない。
  4. MC-02 は `--allow-dir` の場所から添付を読むことを認めているが、契約は「MCP のパス入力は root 相対だけ」としている。allow-dir の中のファイルを、MCP の入力でどう表すか（絶対パスを allow-dir の中に限って許すのか、root からの `../` で表すのか）が書かれていない。安全の境界なので、M2a の `resolveAllowedPath` と M3 のテスト（TS-04-5）が別々に決めてはならない。
  5. CLI で root の制限をかけないことを、`resolveAllowedPath` が何で判断するかが書かれていない（`startedBy` から推測させるのは脆い）。
- 直し方：
  - `run.json` の中のパスは**ジョブ相対**にする（`artifacts` など）。`job` は台帳に書かず、読む側がそれぞれの root に対する相対パスを補って返す。
  - 型を2つに分ける。安全なジョブ内パス `JobPath`（`/` 区切り、`..`・絶対パス禁止）と、入口が返す表示用パス `DisplayPath`（MCP は root 相対で `..` 禁止、CLI は cwd 相対で `/` 区切り、`..` を許す）。CLI の root は `process.cwd()` と明記する。TS-05 は cwd を MCP の root に揃えて比べる、と書く。
  - allow-dir の指し方を1つに決める。案：「MCP の `request.assets` に限り、実体が allow-dir の中にある絶対パスを受け付ける。それ以外の入力は root 相対だけ」。
  - `HostContext` に `restrictToRoot: boolean`（MCP は true、CLI は false）を明示する。

#### M-3 添付の MIME 型の決め方が GUI と CLI で違い、AR-06 のバイト一致が崩れる

- 箇所：§1 `Attachment.type`、§3 `readRequest`、§2 `createProject`
- 根拠：AR-06、GU-03、JT-11。原典 `src/job.ts` L728〜733（`project.json` の `sources[].mime_type` に `assets.sources[i].type` をそのまま書く）、原典 `tools/generate-job.ts` L16〜42・L104（拡張子の表で決める）、原典 `src/App.tsx` L200〜226（ブラウザの `File.type` を使う）
- 内容：同じファイルでも、GUI はブラウザの `File.type`（ブラウザや OS で変わる。拡張子が不明なら空文字。Windows の Chrome では、Excel が入っていると `.csv` が `application/vnd.ms-excel` になる）を使い、CLI は拡張子の表を使う。そのため `project.json` のバイトが一致しない。基線の golden は添付がすべて `.txt`（`mime_type` 7件すべて `text/plain`）なので、JT-11 ではこの差が検出されない。
- 直し方：core に `mimeTypeFor(name)` を1つ置き（原典 `generate-job.ts` の表をそのまま移す）、host と GUI の両方がそれで `Attachment.type` を決めると契約に書く。GUI の出力は原典 GUI と変わるが、原典 CLI と同じ値になる。この変更を許容差分として扱うかどうかを、L2 から（必要なら L1 へ）`QUESTIONS.md` で確認する。あわせて、`.md`・`.csv`・`.pdf` の添付を含む golden ケースを M1 の照合テストに足す。

#### M-4 `generator` の値の出どころと、`project.json` の中でのキーの位置が決まっていない

- 箇所：§1 `Project`（R2）、§2 `createProject(form, assets)`
- 根拠：R2、AR-06、JT-11、GU-14
- 内容：`createProject` の引数は原典のままだが、`generator.version`・`template_version` を純粋な core がどこから得るかが書かれていない。GUI のビルドと CLI で値が違えば、AR-06 のバイト一致が崩れる。`template_version` が何を表すか（semver か、テンプレート目録のハッシュか）も書かれていない。`JSON.stringify` はキーの順序をそのまま出すので、`generator` をどこに挿入するかでもバイトが変わる。
- 直し方：
  - `src/core/data/version.ts`（またはビルドで生成する JSON）を唯一の出どころとし、core がそれを import すると決める。GUI の `version.json`（GU-14）も同じ値を使う。
  - `template_version` の定義を決める。案：job-template の目録の SHA-256 の先頭12桁、またはパッケージ版と同じ値。
  - キーの位置を固定する。案：`schema_version` の直後。`allowed-diffs.json` の R2 にも位置を書き、JT-11 は `version` の値を正規化して照合すると書く。

#### M-5 `reports/validate.json`（R4）の形が決まっていない

- 箇所：§9 `smm.validate/1`（名前と「検査名・状態・メッセージ・助言」だけ）、§2 `parseInspectionReport`、§8 validate の行
- 根拠：R4、CL-12、GU-05、JT-12、PH-03
- 内容：R4 のパッチは M1 が job-template に入れる。その出力を M2a（`CheckResult`・`job_status`）と M4（GUI の検査結果表示）が並行して読む。形が決まっていないと3者が食い違う。
- 直し方：契約に形を書く。案：`{"kind": "smm-validate", "schema_version": "1", "final": bool, "double_render": bool, "verdict": "pass"|"fail", "checks": [{"name": str, "status": "ok"|"error", "message": str}], "advisories": [{"id": str, "source": "validate", "message": str}]}`。`verdict` は `errors.length` だけから決め、SKIP 行・GHOST 行は `advisories` にだけ入れて `verdict` に影響させない（原典 `validate.mjs` L24〜39・L293〜300 の構造と同じ）。日時のように毎回変わる値は入れない。標準出力と終了コードは変えない（R4）。

#### M-6 `runs wait` の終了コードと、CLI の前面待ちとの関係が曖昧

- 箇所：§4 末尾の項目（「runs wait は同じ操作を50秒以下ずつ繰り返し」）、§5 末尾の段落（「CLI の前面待ちは終端 run.exit_code」「単なる runs get/list は取得成功なら0」）
- 根拠：CL-07、CL-10、TS-02（`--detach` と `runs wait` を検査する）
- 内容：`runs wait` が「前面待ち」にあたるのか「単なる取得」にあたるのかを読み分けられない。`smm render --detach` → `smm runs wait` の組み合わせで、run が失敗しても0で終わるのかどうかが実装者によって変わる。
- 直し方：「`runs wait` は終端まで待ち、終端の `run.exit_code` をプロセスの終了コードにする（前面待ちと同じ）。`runs get`・`runs list`・`runs logs` は取得に成功すれば0」と明記する。`--detach` で開始に成功した場合は0であることも書く。

### 推奨

#### R-1 CL-10 の「子プロセスの出力を標準エラーへ流す」を、`log_tail` のポーリングでは満たしにくい

- 箇所：§4 の項目「run 系は --detach がなければ共通 run_get を繰り返して完了まで待つ」、§5 `run_get`
- 根拠：CL-10、CL-04
- 直し方：host に、ログの差分を読む関数（例：`readRunLog(job, runId, stream, offset) → {text, next_offset}`）を置くか、`run_get` に `log_offset` を足す。行数で切った末尾をポーリングすると、間隔のあいだに N 行を超えて出力されたぶんが抜けたり、同じ行が重複したりする。MCP には必須でないので、CLI の内部用として表の外に置いてもよい。

#### R-2 検査結果のファイルが今回の run で書かれたことを確かめない

- 箇所：§8 の各行（「report 付き0/1は completed、verdictをそのまま使う」「R4 report があればそれを読む」）
- 根拠：CL-06、PH-02、§2.1「未確認のままの納品」
- 内容：スクリプトが report を書く前に落ちると、前回の `reports/qc-pre.json` が残ったままになる。それを今回の結果として読むと、古い `pass` を返してしまう。
- 直し方：report を採用するのは、更新時刻が run の `started_at` 以降のときだけにする。QC は終了コード（0＝pass、1＝fail）と report の `verdict` を突き合わせ、食い違えば `E_INTERNAL` とする。ghost-check の json も同じ扱いにする。

#### R-3 エラーコードの使い分けに穴がある

- 箇所：§5 `ErrorCode`、§8
- 根拠：CL-08、§2.4 F3、観点4
- 内容と直し方：使い分けの表を1つ足す。最低限、次を決める。
  - `E_JOB_NOT_FOUND`（パスが無い）と `E_NOT_A_JOB`（`project.json` が無い）の分け方。`project.json` が JSON として壊れている場合（原典 `qc.mjs` では catch に入り終了コード2になる）にどれを返すか。
  - ghost-check・still で、対象の動画（`output/final.mp4` など）が無い場合のコード。§8 は「E_TOOL_MISSING/3 等」としているが、ツールの不足ではない。案：`E_INPUT_INVALID`（2）にして、`hint` で先に render するよう促す。
  - 事前検査で失敗したとき（依存の不足、`E_BUSY`、`E_DISABLED`）は run を作らず、台帳に何も残さないこと。
  - `buildJobFiles` が投げるもの（原典は `Error(messages.join("\n"))`）を `SmmError`（`E_FORM_INVALID`、テンプレートの不足は `E_INTERNAL`）に揃えること。
  - `E_INPUT_INVALID` の `details` の形。原典 `generate-job.ts` の文言は英語（`Unknown key: form.x`）である。GUI（GU-04）は `request.json` を読み込んだときのエラーを人に見せるので、`details` を `{pointer, reason}` の配列にし、日本語の `message` と組み合わせることを推奨する。

#### R-4 依存を要求する操作と、依存の有無の判定方法を明記する

- 箇所：§3「未導入依存は実行前に E_DEPS_MISSING（QC など不要な操作は依存を要求しない）」、§7 `deps.installed`、§8 run.mjs の行
- 根拠：TS-04-4、CL-09、§4.5（ジョブ単体の `npm run` と同じ範囲で動くこと）
- 内容：原典のスクリプトで、依存（`node_modules`）を import・resolve するのは `validate.mjs`（`typescript/bin/tsc`、L175）、`run.mjs`（`@remotion/cli`、L56）、`ghost-check.mjs`（compositor の探索 L77、2回目のレンダー L148）だけである。`qc`・`voice`・`sound`・`imagegen` は Node の組み込みだけで動く。ghost-check は PATH に ffmpeg があれば依存なしで走る（L336）。
- 直し方：
  - 依存を要求する操作を表で列挙する：validate、render、`double_render` 付きの ghost-check。
  - 判定は host の関数1つに集める。ジョブのルートは workspaces なので巻き上げられる。そのため `<job>/runtime` から `@remotion/cli/package.json` と `typescript/bin/tsc` を resolve できるかで判定する。`status`・事前検査・`doctor` がこの関数を共有する。
  - render の事前検査で「ブラウザが無い」を理由に拒否しない。Remotion はヘッドレスのブラウザを自分で取得する。CLI・MCP が拒否すると、`npm run preview` なら通る場面を狭めることになる。ブラウザの有無は `doctor` の報告に留め、失敗は実行後に分類する。

#### R-5 スクリプトごとの argv の書式を表に固定する

- 箇所：§4 の操作表と「スクリプト対応」
- 根拠：MC-03、CL-11
- 内容：原典では argv の書式がスクリプトごとに違う。`ghost-check.mjs` は `--key=value` を `split("=")` で分ける（L478〜484。値に `=` を含むと切れる）。`imagegen.mjs` は `--name <値>` のように別の要素で受ける（L36〜55）。`qc.mjs` は `--stage=pre`。
- 直し方：操作ごとに argv のひな形を契約に書く（例：qc `["scripts/qc.mjs", "--stage=<stage>"]`、ghost-check `["--video=<path>", ...]`、imagegen `["--name", <name>, "--prompt", <text>, ...]`）。ghost-check の `video` は `=` を含む値を拒否する。

#### R-6 imagegen の run の上限と、Windows での内側のシェル（M0-Q1）

- 箇所：§4 imagegen の行（`timeout` は0超〜1,800秒、run の上限は 1,800,000 ms）
- 根拠：MC-14、MC-03、CL-11、D-10
- 内容：
  1. `timeout` を最大の1,800秒にすると、スクリプトが自分の時間切れを処理して `skipped` を記録する（原典 `imagegen.mjs` L145〜150）前に、run の上限で殺されてしまう。
  2. 原典 `imagegen.mjs` は Windows で Codex を `shell: true` で起動し、`quote()`（L110）は `%` を扱わない。ジョブのルート（`-C root`）や `refs` のパスに `%...%` があると、cmd.exe で展開される。
- 直し方：
  1. imagegen の run の上限を `timeout × 1000 + 余裕（例：300,000 ms）` から求めるか、`timeout` の上限を run の上限より小さくする。
  2. M0-Q1 の解釈（下記）を採ったうえで、host 側で win32 のときに限り、`refs` とジョブのルートの実パスに `%`・`"`・改行が含まれる場合は imagegen を拒否する（`E_INPUT_INVALID`／`E_PATH_DENIED`、`hint` 付き）。原典の本文は変えない。

#### R-7 core の公開面が、原典の export を網羅していない

- 箇所：§2 のモジュール表と API 一覧
- 根拠：JT-13、TS-01、§9.1（変えてよいのは P1〜P4 だけ）、AR-01（GUI は core を使う）
- 内容：
  - 原典のテストは、契約の一覧に無い `directionAxes`（`job.test.ts`）と、`explainerAxes`・`explainerAxesForContext`・`explainerStyles`（`explainer.test.ts`）を import している。GUI も、これらと `assetBrief`・`mvDesign`・`mvInstructions`・`GhostCheck*` の型を使う。
  - 原典の `StyleMode` は `job-template/runtime/scripts/caption-capacity.mjs` から再 export されている（`job.ts` L5〜6）。§3.1 の図も core → `caption-capacity.mjs` の参照を示している。ところが契約は `types.ts` で `StyleMode` を別に定義していて、二重定義になる。
- 直し方：
  - 「原典 `job.ts`・`mv-assist.ts`・`explainer-assist.ts` の export はすべて core の `index.ts` から同じ名前で export する」と書く。
  - `createBrief` は改名せず主名のまま残す。`briefFor` という別名は混乱のもとになる。ZIP 用の追記は内部の関数に留める。
  - core が import してよい job-template のファイル（`caption-capacity.mjs`、`.d.mts`）を明記し、AR-03 のテストがこの1ファイルだけを許すこと、配布物（`files`）に含めることを書く。

#### R-8 候補の文脈の写し方と、使った seed を返すこと

- 箇所：§2 の候補の段落、§4 candidates の行、§5 `CandidatesResult`
- 根拠：PH-04、PH-06、TS-06、TS-05、原典 `explainer-assist.ts` L46〜56（`ExplainerContext` は `characterMode`・`characterUsage`・`width`・`height`）
- 直し方：
  - 写し方を固定する：`characters: none` → `characterUsage: "none"`、`solo`/`duo` → `characterMode`。`orientation: portrait` → `{width: 1080, height: 1920}`、`landscape` → `{1920, 1080}`。
  - MV ではこの2項目を無視する（または `E_INPUT_INVALID` で拒否する）のか決める。
  - `axes` は、解説では `explainerAxesForContext(context)`、MV では `directionAxes` を返す。
  - 結果に実際に使った `seed` を入れる。seed を省いた呼び出しでも結果を再現でき、TS-06 の検査もしやすくなる。

#### R-9 `stats --kind script` で `request` から統計の前提を導く規則

- 箇所：§4 stats の行（「request?:Request（scriptのproject設定）」）
- 根拠：TS-05、GU-03、原典 `App.tsx` L229〜237（`createProject(form, assets)`、`speed` は `voiceSpeed` が有限かつ正ならその値、そうでなければ1）
- 直し方：`request` があれば `validateRequest` の shape を通し、添付は読まずに `createProject(form, {sources: []})` を使うのか、添付の有無を反映するのかを決める（字幕枠はキャラクターの有無で変わりうる）。`request` が無ければ `defaults` を使う。`speed` の規則は GUI と同じにする。

#### R-10 `job_status` の細部

- 箇所：§7
- 根拠：§5.4、MC-07、F6、PH-03、TS-05
- 直し方：
  - `records` を「等」で終わらせず、モードごとにパスを列挙する（原典 `validate.mjs --final` と `qc.mjs` の preFiles・postFiles が見るファイルから写す。判定は再実装しない）。
  - `checks` に `ghost-check-preview` を足す。
  - ghost-check の項目には `verdict` を置かず、件数は `summary` に入れる。原典 `ghostCheckVerdict` の文言（「要注意」）を `verdict` に写さない、と明記する。
  - `style_mode` は、MV では `null`、0.4 で `style_mode` が無い解説のジョブでは原典 `effectiveStyleMode` と同じく `biim` にする。
  - `hints` は入口に依存しない形にする（例：`{operation: OperationId, input: JsonObject, note: string}`）。CLI のコマンド文字列で書くと、MCP の結果に CLI の書き方が混ざる。

#### R-11 助言への写し方を明記する

- 箇所：§2 `parseInspectionReport`、§5 の封筒の段落
- 根拠：PH-03、CL-05（`advisories[{id, source, message}]`）、GU-05
- 直し方：
  - QC の `advisories[{id, scope, detail, scene_ids}]` は `{id, source: "qc", message: detail, details: {scope, scene_ids}}` に写す。
  - ghost の件数は `{id: "ghost-count", source: "ghost-check"}` にする。
  - imagegen の SKIPPED、validate の SKIP 行・GHOST 行も `advisories` に入れる。
  - 封筒の `advisories` は `Inspection.advisories` と同じものにする。

#### R-12 MC-04 の接続先の許可を、CLI と `doctor` にどう適用するか

- 箇所：§3 doctor の項目（「voice の非 loopback 接続は allowEngineHosts で明示許可された host だけ」）
- 根拠：MC-04、CL-09
- 直し方：MCP では `doctor` の Aivis 疎通確認も `allowEngineHosts` に従い、許可されていないホストには接続せずに「未確認」と報告する。CLI の `voice`・`doctor` は、imagegen と同じく明示の呼び出しを許可とみなすのか、同じ許可を要求するのかを決めて書く。

#### R-13 排他の範囲を列挙する

- 箇所：§3「書込 run は job ごとに1つ」、§6
- 根拠：MC-05、原典 `lib.mjs` L102〜127（`prepare` が `runtime/public/assets` と `runtime/data` を作り直す）
- 直し方：「run の全種別、`project_patch`、CLI の `studio`（`run.mjs studio` も `prepare` を呼ぶ）が同じジョブ排他を取る」と書く。qc は reports を、voice・sound は assets を書くので、「書込 run」だけを列挙しようとすると曖昧になる。

#### R-14 `report_get` で扱える種類と大きさ

- 箇所：§3 report の項目
- 根拠：MC-09
- 直し方：テキストとして返す拡張子（`.md`・`.json`・`.txt`・`.csv`）と、画像として返す拡張子（`.png`。`reports/ghost-stills/` を含む）を列挙する。それ以外（`reports/` の下の音声など）はどのコードで拒否するかを書く。PNG にも上限（例：8 MiB）を設ける。

### 参考

- **I-1** §1 の原典の行番号がずれている。`CharacterForm` は L8〜20、`MotionForm` は L22〜74、`defaults` は L101〜166 である（契約は「L9〜74」「L119〜203」）。
- **I-2** 取り消しを `E_INTERNAL`（`details.reason: "cancelled"`）で表すのは、CL-08 の固定集合の中では妥当である。将来 `E_CANCELLED` を足すなら要件の改訂が要る。`docs/CLI.md`・`docs/MCP.md` に明記するとよい。
- **I-3** `E_RUN_NOT_FOUND` を3にするか2にするかは、どちらでも説明がつく。現状の3で構わない。
- **I-4** `OperationDefinition.readOnly` は `kind === "read"` と重複していて、名前から意味を取り違えやすい。`exposedInReadOnly` に改名するか、`kind` から導くとよい。
- **I-5** run ID の例は、CL-05 では16進4桁、契約では8桁である。契約の8桁で構わない。CLI.md の例を合わせる。
- **I-6** CL-03 で host が測った `musicDurationSec` は、ブラウザの `audio.duration`（原典 `App.tsx` L366〜371）と小数部が違いうる。AR-06 の一致テストは `musicDurationSec` を明示した request で行う、と書くとよい。
- **I-7** MCP の `outputSchema` に封筒のスキーマを宣言するかどうかを決め、MC-06 のスナップショットに含めるとよい。
- **I-8** `Run.pid` が worker の pid なのかスクリプトの pid なのかを書く。ツリーごと止めるには worker の pid があれば足りるが、診断用に両方を記録するとよい。
- **I-9** MC-15（SHOULD）の進捗通知は契約に書かれていない。`Run.progress` から通知に写す方針を M3 に一言書いておくとよい。
- **I-10** `Sha256` は小文字の16進64桁、と型の注記に書く。
- **I-11** seed を core の中で `crypto.getRandomValues` から作ると、core が非決定的になる。純粋性（入出力なし）には反しないので許容できる。入口で作って渡す方式もありうる。現状のままで構わない。

## M0 の質問（QUESTIONS.md）への所見

L2 の判断の材料として書く。回答はしない。

- **M0-Q1（imagegen の内側のシェル）**：解釈に賛成する。CL-11 が縛るのは host が起動する子プロセスであり、`imagegen.mjs` の本文は D-10・PH-01 で原典のバイトを保つ対象である。ただし MCP がこの経路を公開するので、R-6 の2のとおり、host 側で cmd.exe のメタ文字（`%`・`"`・改行）を含むパスを事前に拒否することを条件にするとよい。
- **M0-Q2（validateForm の文言集合）**：賛成する。パラメーターを持つ文言は、URL の行番号（上限なし）と `${i + 1}人目`（1・2の2値）である。後者は具体的な文字列で全件を列挙できるので、正規化するのは URL の行番号だけにするとよい。
- **M0-Q3（exit 1 の分類）**：手続きに賛成する。R-2（report の鮮度と終了コードの突き合わせ）と R-3（事前検査の分類、run を作らない場合）を前提に入れると、M2b の実測が「分類できなかったものは E_INTERNAL」に流れにくくなる。0.4 の validate は、成功の文（`Structural checks passed.`）と、`label: message` 形式の標準エラー行の有無で判別できる（原典 `validate.mjs` L293〜300）。

## 観点ごとの確認結果

| 観点 | 結果 |
| --- | --- |
| 1. 要件との一致 | CL-06 と食い違う（M-1）。AR-06 を崩しうる点が2つある（M-3、M-4）。並行タスクが共有する R4 の形が無い（M-5）。CL-07・CL-10 の解釈が曖昧（M-6、R-1）。ほかの AR-01〜06、CL-01〜12、MC-01〜15、PH-03〜06、F1〜F6 に矛盾は見つからなかった |
| 2. 床と天井 | 合格。操作表に場面・演出の操作は無い（`project_patch` は汎用の Merge Patch で、場面を検査しない。MC-08）。`job_status`・`direction_candidates` に状態全体の合否・スコア・順位は無い。助言は `ok`・`verdict`・終了コード・`isError` を変えない。候補は自動で入らない。seed の扱いも正しい。補強として R-8・R-10・R-11 を勧める |
| 3. 層と依存 | 合格。core は `node:*`・DOM を使わず、テンプレートは引数で受ける。読み込みは host にある。CLI・MCP は `execute` と操作表を共有する。core → `caption-capacity.mjs` の参照を明記すること（R-7）と、`HostContext` の制限フラグ（M-2）を勧める |
| 4. 曖昧さ | パスの基準（M-2）、エラーコードの使い分け（R-3）、`runs wait` の終了コード（M-6）、argv の書式（R-5）、排他の範囲（R-13）、`records` の列挙（R-10）を直す。`wait_ms` の既定値（MC-12 と一致）と run の状態遷移（終端からは戻らない）は明確である |
| 5. 原典との対応 | `MotionForm`・`CharacterForm` は完全一致。関数名の対応はおおむね正しいが、export に漏れがある（R-7）。§8 の終了コードの記述は実物と合っている：validate（`errors` があれば1、L293〜300）、qc（MV は0で report なし、pass＝0、fail＝1、catch＝2、L310〜324）、ghost-check（skipped と catch が1、L506〜508・L531〜534）、imagegen（strict かつ skipped のときだけ1、catch＝1、L251〜260）、aivis・sound-design（catch＝1）、run.mjs（不明な mode・catch＝1、子の終了コードを転送し null は1、L49〜77） |
