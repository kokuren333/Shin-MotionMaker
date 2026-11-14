<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# 発注書 M2a — host（テンプレート読み込み・書き出し・パス検査・run・状態・操作定義表）

- 作業 ID：`M2a`
- 担当：L3 Codex 6.1 sol 高
- 作業ツリー：`<作業ツリー>\m2a`（ブランチ `m2a-host`、M1 マージ後の `main` から分岐。L2 が作成済み）
- 入力：`docs/REQUIREMENTS.md` §3.1（AR-01〜06）、§4（CL-01〜12。CLI 本体は M2b だが host が支える）、§5（MC-02・MC-03・MC-05・MC-08〜14、§5.4）、§6.3 の JT-12、§9.2 の TS-07、§14 のリスク。`docs/CONTRACT.md`（**契約に従う。変える必要があれば QUESTIONS.md に書いて止まり、依存しない範囲を進める**）。M1 の成果（`src/core`、`job-template/`）。

**M1 からの申し送り**：(1) M1 で `test.todo` にした「独立したテンプレート読み込み（Vite と同じ除外規則）との比較」は M2a に移送されている（`docs/PORTING_LEDGER.md` 参照）。host のテンプレート読み込みで埋め、台帳を更新する。(2) M1R I-1：`validate.mjs` が末尾に届く前に終わると古い `reports/validate.json` が残る。CONTRACT の鮮度確認（report は run の `started_at` 以降のものだけ採用、終了コードとの突き合わせ）を必ず実装する。(3) CONTRACT（M0b 改訂版）の M-1・M-2・R-1〜R-4・R-6・R-10〜R-14 は host の責務が多い。全部読む。

## 1. やること（`src/host`）

1. **テンプレートの読み込み**：`job-template/` と `job-assets/fonts/` をファイルシステムから読み、core の除外規則を通して core の `buildJobFiles` に渡す。フォントの SHA-256 検査（原典 `tools/generate-job.ts` L131〜135）。
2. **ジョブの書き出し**：書き出し前の全パス検査と排他的な書き出し（原典 L162〜175）。出力先に同名があれば上書きしない（`E_OUTPUT_EXISTS`）。`--zip` 相当で GUI と同じ ZIP。AR-06：同じ request から、ZIP の中身と書き出したフォルダの中身がパスとバイトで一致することをテストする。
3. **添付ファイルの解決**：`request.json` のあるフォルダからの相対（CL-01）。BOM 付き UTF-8。CL-03（SHOULD）：MV で `musicDurationSec` が `null` のとき WAV はヘッダから測る（ffmpeg があれば他形式も）。
4. **パスの安全検査**（MC-02）：`--root` からの相対で受け取り相対で返す（区切り `/`）。シンボリックリンクとジャンクションの実体を解決して root の外を拒否（`E_PATH_DENIED`）。`--allow-dir`。Windows のジャンクション、`..`、ドライブレター、UNC、大文字小文字、末尾のドット・空白などの逃げ道をテストする。
5. **ジョブ内スクリプトの実行**（AR-02、CL-11、MC-03）：操作定義表に列挙したスクリプトとオプションだけ。シェルを介さず、`<ジョブ>/runtime` を作業フォルダにして `node <script> ...args` を配列で起動。パスに `&`・全角記号・空白を含むジョブで動くことをテスト。
6. **run 台帳**（MC-10〜14、D-08）：`.smm/runs/<run_id>/`（`run.json`・`stdout.log`・`stderr.log`）。切り離した子プロセス（サーバー・CLI が終わっても続く）。状態 `running`・`completed`・`failed`・`cancelled`・`timed_out`・`lost`。`heartbeat_at` の更新と `lost` の判定。`run_cancel` はプロセスツリーごと止める（Windows を含む：`taskkill /T /F` 相当を配列引数で）。種別ごとの上限時間。`wait`（`wait_ms` 0〜50,000）。CLI が始めた run を別プロセスから見られる。
7. **排他**（MC-05）：1ジョブで書き込み系の run は1つ。衝突は実行中の run ID 付きで `E_BUSY`。ロックは原子的に（`fs.open(..., 'wx')` 等）取り、古いロック（プロセスが無い）の回収規則を決める。
8. **結果の読み取り**：`reports/validate.json`（R4）、`reports/qc-<stage>.json`、`reports/ghost-check(-preview).json` を読み、封筒の `result`・`advisories` へ。**助言は `ok`・`verdict`・終了コードを変えない**（PH-03）。JT-12：原典生成のジョブ（`schema_version` 0.4、`generator` なし、`reports/validate.json` なし）では終了コードと標準出力から結果を組み立てる。ジョブ内スクリプトの終了コード→CL-07 の対応は CONTRACT の表に従い、host の1か所に置く。
9. **`project.json` の読み書き**（MC-08）：`get`（JSON Pointer）と `patch`（JSON Merge Patch、`expect_sha256`、`schema_version`・`mode`・`generator` の不変、一時ファイル＋rename）。場面の内容は検査しない（F5）。
10. **ジョブ状態の導出**（§5.4、PH-05、MC-07、F6）：毎回ファイルから。`hints` は助言。合否・スコア・順位の項目を置かない。QC の `stale` 判定。MV の QC は `not_applicable`。
11. **`doctor`**（CL-09）：確認だけ。何もインストールしない。
12. **`setup`**：ジョブのルートで `npm install`（`package-lock.json` があれば `npm ci`）を run として。Windows では `npm` が `.cmd` なので、シェルを介さずに起動する方法（`process.execPath` と npm の `npm-cli.js` を解決する等）を取る。
13. **操作定義表**（AR-05）：CONTRACT の表をコード化（操作 ID、入力スキーマ、処理関数、読み取り／書き込み、run か、`--read-only`・`--enable-generation` の扱い、既定 `wait_ms`、上限時間、CLI だけの操作と理由）。M2b（CLI）と M3（MCP）はこの表から自動的に作る。
14. **JSON Schema**：`schemas/` に封筒・run・ジョブ状態・request・project・各検査結果のスキーマ（CONTRACT のスキーマ名）。host の出力がスキーマに合うことをテストする（スキーマ検査器を依存に足すなら、ライセンスを確認して記録。足さずに済むなら足さない）。

## 2. テスト

- **TS-07**：偽のジョブスクリプト（Remotion を使わない小さな `.mjs`。テスト用フィクスチャのジョブに置く）で、完了・不合格・異常終了・取り消し・時間切れ・`lost`・排他（`E_BUSY`）を確かめる。**この PC（Windows）で合格させる**。ubuntu の CI はリモート作成後に回るので、POSIX でも動く書き方（`process.kill(-pid)` 等の分岐）にしておく。
- パスのテスト（CL-11、MC-02）：`&`・全角記号・空白・長いパス・ジャンクション・シンボリックリンク（Windows でシンボリックリンクが作れない権限なら、ジャンクションで代替し、スキップ理由を出力する）。
- AR-06 のバイト一致。
- JT-12：原典の基線（M0 の golden から作ったジョブ、または `schema_version` 0.4 の `project.json` を持つフィクスチャ）で `status` と結果の組み立て。
- テストで `git` を起動しない。

## 3. 受け入れ条件（L2 が実測する）

- [ ] `npm test` が合格（Windows 実機）。TS-07 の全項目を含む。
- [ ] パスのテスト（CL-11、MC-02）が合格。
- [ ] AR-06 が合格。
- [ ] AR-03 が引き続き合格（host だけが `node:fs`・`node:child_process` に触れる）。
- [ ] `node tools/ci-local.mjs` が合格。
- [ ] 交差レビュー（Opus、パス検査と run の安全）で必須指摘なし。

## 4. 報告

`docs/work/M2a/REPORT.md`。Windows 固有の扱い（プロセスツリー、`.cmd`、ジャンクション、長いパス）で決めたこと、POSIX で未確認の箇所を必ず書く。
