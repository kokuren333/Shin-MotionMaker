<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# 発注書 M2b — CLI（操作定義表からのコマンド、封筒、終了コード、docs/CLI.md）

- 作業 ID：`M2b`
- 担当：L3 Codex 6.1 sol 高
- 作業ツリー：`<作業ツリー>\m2b`（ブランチ `m2b-cli`、M2a マージ後の `main` から分岐。L2 が作成済み）
- 並行：M3（MCP、ブランチ `m3-mcp`）が同じ `main` から並行して進む。**`src/host` と操作定義表・スキーマ・CONTRACT は M2a で確定済みの共有物。変更が必要なら QUESTIONS.md に書いて止め、L2 が調整する**（M3 との衝突を避けるため、host の変更は最小限のバグ修正に限り、REPORT に列挙する）。
- 入力：`docs/REQUIREMENTS.md` §4（全体、CL-01〜CL-12）、§3.1（AR-01・AR-05・AR-06）、§9.1 の P4（`generate-job.test.ts` の移送分）、§9.2 の TS-02・TS-03・TS-05（CLI 側）、§11.2 の M2b 行。`docs/CONTRACT.md`、`docs/work/M0/QUESTIONS.md`（M0-Q3：終了コード対応の実測による確定）、`docs/work/M2a/REPORT.md`、`docs/PORTING_LEDGER.md`。

## 1. やること

1. **`src/cli`**：`node:util` の `parseArgs` で引数を解釈し、host の操作定義表からサブコマンドを作る（AR-05）。ロジックを持たない（AR-01）。`node:fs`・`node:child_process`・`job-template` を直接 import しない（AR-03）。コマンド一覧は §4.1 のとおり（`studio`・`mcp serve`・`version` は CLI だけ。`mcp serve` は M3 のサーバーを起動する入口だけを用意し、M3 の成果に依存する部分は M3 マージ後に L2 が結線する。M2b では `E_DISABLED` 等で明示的に未接続を返してよい）。
2. **bin**：`shin-motionmaker` と `smm`。配布物はビルド済み JavaScript（§3.4。`--experimental-strip-types` は開発・テストのみ）。`npm run build` で `dist/` を作り、`package.json` の `bin` がそれを指す。`npm link` 相当で手元から実行できることを確かめる（グローバル導入はしない。`node dist/cli/main.js` で代替してよい）。
3. **封筒と出力**（CL-04〜CL-06、CL-12）：標準出力は JSON 封筒1個だけ。進捗・子プロセスの出力は標準エラー。`--human` で人向け要約。`ok` と `verdict` を分ける。
4. **終了コード**（CL-07、M0-Q3）：ジョブ内スクリプトの終了コード→CL-07 の対応を**実測で確定**し（各スクリプトを実際の入力で走らせ、どの経路でどのコードになるかを確かめる）、`docs/CLI.md` の表とテストで固定する。助言だけの実行は0。
5. **run 系**（CL-10）：既定は前面で待ち、子プロセスの出力を差分で標準エラーへ流す（`readRunLog`）。`--detach` で run ID を返して即終了。`runs list|get|wait|logs|cancel`。`runs wait` の終了コードは CONTRACT（M-6）どおり。
6. **`generate`**（CL-01〜CL-03、P4）：原典 `generate-job.test.ts` の性質を CLI のテストとして完成させる（GUI と同じバイト、最小入力と既定値、未知キー・型の誤り・検査エラーを書き出し前に拒否して終了コード2、既存の出力先を変えない）。M1 で `todo` にした移送分をここで埋め、`docs/PORTING_LEDGER.md` を更新する（種別 P4）。
7. **`docs/CLI.md`**：コマンド、封筒、終了コード、エラーコード、ジョブ内スクリプトの終了コードの対応表。**文書中のコマンド例は実際に実行して確かめたものだけ**（DC-03）。実行記録を `docs/work/M2b/` に残す。文面の推敲は M6（Opus）が行うので、正確さを優先する。

## 2. テスト

- **TS-02**：標準出力が JSON 1個だけ／封筒がスキーマに合う／終了コード 0〜4 のそれぞれ／助言だけの実行が0／BOM 付き入力／`&`・全角記号・空白を含むパス／`--detach` と `runs wait`。
- **TS-03**：`request` のスキーマのスナップショット。創造に関わる項目が文字列型のまま（F1・F4）。
- **CLI と GUI 経路のバイト一致**：同じ request から、CLI の `generate --zip` の ZIP の中身と、core（GUI と同じ関数）の ZIP の中身が一致。CLI の `generate`（フォルダ）とも一致（AR-06）。
- テストで `git` を起動しない。偽のジョブスクリプトで済むものは Remotion を使わない（Tier A）。Tier B（依存を導入した生成ジョブで `validate`）は、時間がかかるなら別スクリプト（例 `npm run test:tier-b`）にして手順を REPORT に書き、この PC で一度実行して結果を記録する。

## 3. 受け入れ条件（L2 が実測する）

- [ ] `npm test` 合格（TS-02・TS-03・CLI/GUI 経路のバイト一致を含む）。
- [ ] `docs/PORTING_LEDGER.md` の M2b 移送分がすべて埋まり、TS-01（基線 81 件の対応）が完全。
- [ ] `docs/CLI.md` のコマンド例の実行記録がある。
- [ ] `npm run build` 後に `node dist/cli/main.js generate ...` 等が動く（L2 が試す）。
- [ ] `node tools/ci-local.mjs` 合格。

## 4. 報告

`docs/work/M2b/REPORT.md`。終了コード対応の実測結果、host に入れたバグ修正（あれば）、M3 との結線で L2 がやること。
