<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# 発注書 M6 — 文書（README、AGENTS.md の完成、ジョブ README の追記の推敲、CLI/MCP/DESIGN 文書の文面）

- 作業 ID：`M6`
- 担当：L3 Opus 5.5 中（文面の判断）
- 作業ツリー：`<作業ツリー>\m6`（ブランチ `m6-docs`、M2b・M3・M4 マージ後の `main` から分岐。L2 が作成済み）
- 入力：`docs/REQUIREMENTS.md` §10（DC-01〜DC-05）、§2.3、§6.2（R1・R3）、§7.2 の GU-13、§8、§9.2 TS-06、§11.2 の M6 行。既存の `AGENTS.md`・`README.md`（あれば）・`docs/WORKFLOW.md`・`docs/CLI.md`・`docs/MCP.md`・`docs/DESIGN.md`・`docs/CONTRACT.md`・`NOTICE`・`job-template/README.md`（R3 の節）。

## やること

1. **`README.md`**（DC-03）：人向けの使い方。GUI（Pages の URL は M8 まで未公開と書く）、CLI（導入：clone → `npm ci` → `npm run build` → `npm link` または `node dist/cli/main.js`。npm レジストリには未公開）、MCP の登録例、必要な環境（Node 22 以上、ジョブのレンダーに必要なもの）。開発中である旨。Remotion の利用条件の注意（DC-04）。表示名 `Shin-MotionMaker`、「制作エージェント」（GU-13）。
2. **ルート `AGENTS.md` の完成**（DC-01）：要件の項目（開発ハーネスと制作ハーネスの区別、絶対規則、§2.3 の宣言文＝**文言を変えない**、§8 の公開規則、正本の一覧）を、読みやすく整える。宣言文のテスト（agents-declaration）が通ること。
3. **ジョブ `README.md` の「CLI・MCP から使う」節（R3）の推敲**：追加部分の文面だけを整える。ジョブ単体では `npm run` が正であることを書く。**R3 の追加部分以外を変えない**。変えたら `tests/fixtures/baseline-biimmotion-262c798/allowed-diffs.json` の R3 の追加文と、`src/core/data/version.ts` の `TEMPLATE_MANIFEST_SHA256`（と必要なら `TEMPLATE_VERSION`）の更新が要る。これらは機械的な更新なので、`docs/work/M6/REPORT.md` に手順を書いて自分で行い、`npm test` で照合が通ることを確かめる。
4. **`docs/CLI.md`・`docs/MCP.md`・`docs/DESIGN.md`・`docs/WORKFLOW.md` の文面の推敲**：意味（コマンド、引数、終了コード、エラーコード、安全の記述）を変えない。**文書中のコマンド例は、実際に実行して確かめたものだけ**（DC-03）。新しい例を足すなら実行して、出力の要点を `docs/work/M6/command-log.md` に残す。既存の例も全部実行し直して記録する（ビルドしてから `node dist/cli/main.js ...`。リモートや npm への公開を伴うものは実行しない）。
5. **DC-05（SHOULD）**：依存のライセンス一覧を確認するスクリプト（例 `tools/check-licenses.mjs`）があれば文書に載せる。無ければ REPORT に「未実施」と書く（工学タスクなので作らなくてよい）。
6. **TS-06**：ルート `AGENTS.md` の宣言文、`job-template/AGENTS.md` の保護文と「編集する人・エージェントへ」の段落、`direction_candidates` の説明文と結果の「たたき台」、seed 省略時の非固定 ——これらの表明がテストに揃っているかを確かめ、足りなければ REPORT に書く（テストの追加が必要なら L2 が工学タスクとして発注する）。

## 規則

- 文書にローカルの絶対パス・メールアドレスを書かない。
- `job-template/AGENTS.md` は変えない（JT-03）。
- 主観的な質の合否化・表現手法の固定を文書で勧めない（§2）。

## 受け入れ条件（L2 が実測する）

- [ ] `npm test` 合格（TS-06・基線照合を含む）。`node tools/ci-local.mjs` 合格。
- [ ] `docs/work/M6/command-log.md` に、文書中の全コマンド例の実行記録がある。L2 が抜き取りで再実行する。
- [ ] 追跡ファイルにローカル絶対パスが無い。
