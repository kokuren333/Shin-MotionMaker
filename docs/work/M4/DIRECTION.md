<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# 発注書 M4 — GUI（テーマ・原典機能の移植・request.json・検査結果の表示・CLI/MCP 区画）

- 作業 ID：`M4`
- 担当：L3 Opus 5.5 中（見た目と文面の判断を含む）。工学的な配線（core の呼び出し、e2e の枠組み）も含めて担当する。必要なら L4 サブエージェントを使ってよい。
- 作業ツリー：`<作業ツリー>\m4`（ブランチ `m4-gui`、M1 マージ後の `main` から分岐。M5 のアイコンがマージ済みならそれも含む。L2 が作成済み）
- 入力：`docs/REQUIREMENTS.md` §7（全体、GU-01〜GU-17）、§3.1（AR-01・AR-04・AR-06）、§2.2 の PH-03・PH-04、§9.2 の TS-08、§11.2 の M4 行。`docs/CONTRACT.md`（core の API、`request.json` の形、封筒・run・検査結果のスキーマ。**契約に従う**）。M1 の `src/core`。
- 原典（読み取り専用）：`<原典>` の `src/App.tsx`（約10万バイト）・`src/style.css`・`src/main.tsx`・`src/templates.ts`・`index.html`・`public/icons/`・`docs/DESIGN.md`・`docs/requirements/2026-11-13-explainer-ui-harness.md`（UI-11 の機能一覧 L356 付近、Amendment 01・03）・`tools/ui-shots.mjs`
- テーマ正本（読み取り専用）：CyberSprite `<CyberSprite>\gui\src\theme\tokens.css`（`20f787d` 時点の値。現在の HEAD `a00433c` で同じ値であることを確かめる）

## 1. やること

1. **`gui/` ワークスペース**：React／TypeScript／Vite。実行時依存は原典と同じ3つ（`jszip`・`react`・`react-dom`、原典と同じ版）。開発依存は必要最小限（e2e 用にヘッドレスブラウザを使うなら、原典 `tools/ui-shots.mjs` の「依存なし・CDP 直接」方式か、`@playwright/test` を固定版で。どちらにしてもライセンスを確認して記録）。Pages 用の静的ビルド。GU-01：バックエンド・外部 CDN・入力の永続化なし。
2. **テーマ**（GU-08）：`gui/src/theme/tokens.css` に正本の `--cs-*` 15トークン（通常と高コントラスト）を値を変えずに写し、採取元のコミットを記す。色の直値はこのファイルにだけ（例外：利用者のデータ＝字幕色など、出力映像を写すプレビュー＝Biim 枠の色は `biim-standard.json` の値）。独自のパレットを定義しない。
3. **原典機能の移植**（GU-02）：UI-11 の機能一覧の**全項目**。部品への分割は自由。生成は `src/core` を使い、ロジックを再実装しない（AR-01・GU-03）。テンプレートの読み込みはブラウザ用（`gui/src/templates.ts`、Vite の glob。除外規則は core の定義を使う）。
4. **`request.json` の書き出しと読み込み**（GU-04）：CLI・MCP の `generate` と同じ形。読み込みの検査は core の `validateRequest`（AR-04）。添付ファイルはファイル名だけを書き出し、読み込み後に人が選び直す。
5. **検査結果の表示**（GU-05）：`reports/` の JSON（`ghost-check`・`ghost-check-preview`・`qc-pre`・`qc-post`・`validate`）と `run.json` を、ファイル選択またはドロップで読んで表示する。**ゲートと助言を別の区画に分け、助言を不合格の色や記号で表示しない**（PH-03）。`review_mode: self` と免除を明示する。
6. **CLI・MCP の区画**（GU-06）：現在の入力に対する `generate` のコマンド例、MCP の登録例、文書へのリンク。コマンドの形は CONTRACT と REQUIREMENTS §4.1 に従う（CLI 本体は M2b で並行して作られる。食い違いが出たら L2 が調整する）。
7. **たたき台の表示**（GU-07）：「たたき台」と表示、「別の組み合わせ」で引き直し、既定で選択しない、追記の操作をしたときだけデザイン方向性に入る、4つの様式モードを同格に並べる。seed は固定しない（PH-06）。
8. **アイコン**（GU-10）：`gui/public/icons/` のアイコン（M5 の成果、main にマージ済み。26点＋favicon、`manifest.json`）を、文字ラベルと並べて使う。アイコンだけの操作を作らない。M5 からの申し送り：アイコンを ink の面（`--cs-ink` 等の暗い面）に置かない。置くなら明るい面のチップに載せる（`docs/DESIGN.md` に書く）。アイコンを変更・追加しない（必要なら REPORT に書けば L2 が M5 として発注する）。`NOTICE` のテーマトークンの行を埋める。
   - 並行して M2a（host）が `main` から分岐した別ブランチで進む。M4 は `src/host` に触れない。`src/core` の変更が必要になったら QUESTIONS.md に書く（契約に関わるため L2 が調整する）。
9. **表示名と版**（GU-13・GU-14）：`Shin-MotionMaker`。「制作エージェント」。ビルドに版とコミットを埋め込む（サイトのルートの `version.json`：`version`・`commit`・`built_at`、情報ダイアログに表示）。**ビルドスクリプトが `git` を使って commit を得るのはよいが、テストからは `git` を起動しない**（commit は環境変数や引数でも渡せるようにする）。
10. **Pages 用ビルド**（GU-15）：資産の参照は相対パス。サブパス `/Shin-MotionMaker/` の下で動くことを e2e で確かめる。
11. **アクセシビリティと画面幅**（GU-16）：本文コントラスト 4.5:1 以上（トークンから機械検査）、キーボードで全操作、フォーカスが見える、幅 390px で横スクロールなし、1440×900 で最初の入力欄がスクロールなしで見える、`prefers-reduced-motion`。
12. **`docs/DESIGN.md`**（GU-09）：原典 `docs/DESIGN.md` を出発点に、Shin-MotionMaker 固有の差分（表示名、追加の区画、追加のアイコン）を書く。
13. **スクリーンショット**（GU-17）：Pages 用ビルドをローカルで配信し、主要な状態（両モードの初期表示、入力済み、エラー、検査結果の表示、情報ダイアログ、幅 390px）を撮り、`docs/work/M4/screenshots/` に置いて `VERIFICATION.md` に記録する。

## 2. テスト（TS-08）

- 単体テスト。
- トークンの写しが正本の値と一致（値は repo 内のフィクスチャ `tests/fixtures/` 等に置いた正本の写しと比べる。テストから CyberSprite のパスを読まない）。
- 色の直値が `tokens.css` の外に無い（例外の規則を明示）。
- コントラスト検査。
- e2e：GU-02 の機能一覧の各項目、`request.json` の往復、検査結果の表示（ゲートと助言の区画分け）、サブパス配信、幅 390px。
- **GUI 経路の ZIP が CLI 経路と同じバイト**（AR-06・GU-03）：同じ request から GUI の生成関数が作る ZIP の中身が、core＋Node でテンプレートを読んだ結果と一致することを、ブラウザ用テンプレート読み込みの結果と比べて確かめる（Vite の glob とファイルシステム読みの差をここで捕まえる）。
- テストで `git` を起動しない。
- ルートの `npm test` と、`npm test --workspaces --if-present`・`npm run build --workspaces --if-present`（ci-local が実行するもの）が合格すること。e2e がブラウザを要する場合、ブラウザが無い環境での扱い（スキップではなく明示的な失敗か、別スクリプトか）を決めて記録する。

## 3. 受け入れ条件（L2 が実測する）

- [ ] TS-08 の各項目が合格（L2 が実行する）。
- [ ] GU-02 の全項目を e2e で確認した一覧（項目 → テスト名）が REPORT にある。
- [ ] スクリーンショットが `VERIFICATION.md` に記録されている。
- [ ] `node tools/ci-local.mjs` が合格。
- [ ] 実装者以外のレビュー（L2 が別途発注）で必須指摘なし。

## 4. 報告

`docs/work/M4/REPORT.md`。原典から変えた見た目と理由、GU-02 の対応表、PH-03 の扱い（助言の見せ方）を書く。
