<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# 発注書 M5 — アイコン（再利用と固有アイコンの制作）

- 作業 ID：`M5`
- 担当：L3 Opus 5.5 中（見た目の判断を含む）
- 作業ツリー：`<作業ツリー>\m5`（ブランチ `m5-icons`、`main` の M0 完了時点から分岐。L2 が作成済み）
- 入力：`docs/REQUIREMENTS.md` §7.2 の GU-10・GU-11・GU-12、§9.2 の TS-09、§10 の DC-04（NOTICE のアイコン部分）、§11.2 の M5 行
- 参照（読み取り専用）：CyberSprite `<CyberSprite>`（コミット `a00433c`）。`AGENTS.md` §4（クリーンルーム）・§6（絵を作るとき）、`assets/ui/icons/README.md`（パレットと描き方の約束）、`assets/ui/icons/tools/`、`skills/README.md`・`skills/workflows/direct.md`、`docs/CLI.md`

## 1. やること

### 1.1 再利用アイコン（GU-10）

原典 BiimMotion が使っていた10点（`info`・`validate-ok`・`warning`・`error`・`folder`・`sources`・`add`・`remove`・`settings`・`agent`）を、CyberSprite から**無加工で**写す。

- 原本：CyberSprite `assets/ui/icons/<名前>.csprite/` を、この repo の `assets/ui/icons/<名前>.csprite/` へ丸ごとコピー。
- PNG：CyberSprite の CLI の `export image` で `gui/public/icons/<名前>.png` に書き出す（CyberSprite 側の `gui/public/icons/` は git 管理外のビルド出力なので、自分で書き出す）。
- ほかにも、Shin-MotionMaker の GUI で意味が合う CyberSprite アイコン（例：`eye`、`link`、`play` など）があれば、同じ方法で再利用してよい。使う予定があるものに限る。

### 1.2 固有アイコンの制作（GU-11）

**CyberSprite を使って描く**（CLI。CyberSprite `AGENTS.md` §6 の基本ループと、`assets/ui/icons/README.md` の約束：16×16、1 フレーム、レイヤー `icon`、透明背景、パレット `ui-icons.gpl` と同じ番号・同じ色、輪郭は ink 1px、内容は 14×14、アンチエイリアスなし、意味は形で伝える）。

最低限の対象（13点）。名前は英小文字ケバブケース：

| 名前（案） | 意味 |
| --- | --- |
| `app` | アプリの印（favicon を兼ねる。`gui/public/favicon.png` などにも書き出す。16×16 のほか、必要なら 32×32 を整数倍で） |
| `mode-mv` | MV モード |
| `mode-explainer` | 解説モード |
| `style-biim`・`style-anime`・`style-motion`・`style-mixed` | 様式4種（4つは同格に見えること。優劣を感じさせない） |
| `gate` | ゲート（合否） |
| `advisory` | 助言（**不合格・エラーに見えないこと**。`warning`・`error` の色や形と混同しない。PH-03） |
| `ghost-check` | ゴースト検査 |
| `job-zip` | ジョブ（ZIP） |
| `cli` | CLI |
| `mcp` | MCP |

- CyberSprite の環境は既存のもの（`<CyberSprite>/.venv`）を使う。例：`uv run --project "<CyberSprite>" --no-sync cybersprite -p "<この作業ツリー>/assets/ui/icons/<名前>.csprite" ...`。**CyberSprite の追跡ファイルを変更しない**（`git -C <CyberSprite> status --short` が作業前後で同じであることを報告に書く）。プロジェクトの作成・描画・検証・書き出しはすべてこの repo の中で行う。
- 描画は Op（`draw_rows` など）で行う。設計データを持つなら `assets/ui/icons/tools/`（この repo 側）に置いてよい。
- クリーンルーム：他製品のアイコンを見て写さない。参照画像を repo に入れない。
- 各アイコンについて、CyberSprite の `validate` が `ok: true`、書き出し結果の `validation_ok`・`verified` が true であること。
- 確認用の一覧（コンタクトシート：×1 と ×4、明るい下地と暗い下地。トークンの `--cs-*` の下地色で）を `docs/work/M5/` に PNG で置く。これはレビュー用の証拠で、別コンテキストの Opus が見た目を確認する。

### 1.3 由来の記録（GU-12）

- `gui/public/icons/manifest.json`：各アイコンの `name`、`origin`（`cybersprite-reuse` または `shin-motionmaker-original`）、再利用なら採取元コミット（`a00433c`）、制作に使った CyberSprite の版（`cybersprite --version` とコミット）、制作者（モデル名。固有アイコンは「Claude Opus 5.5」）、PNG の SHA-256、原本 `.csprite` のパス。
- `assets/ui/icons/README.md`：パレット、描き方の約束（CyberSprite の約束を継承した旨）、作り直し方。
- `NOTICE`：アイコンの由来の要約（CyberSprite 由来の再利用と採取元コミット、固有アイコンは CyberSprite で制作したこと）。NOTICE の他の節は触らない。

### 1.4 テスト（TS-09）

`tests/icons.test.ts`：`gui/public/icons/` の全 PNG が 16×16（favicon の大きい版は除外規則を manifest に書く）、manifest の SHA-256 と一致、manifest の由来の項目が全部埋まっている、manifest に載っていない PNG・PNG が無い manifest 項目が無い。PNG の寸法は IHDR を自分で読む（依存を足さない）。テストで `git` を起動しない。

## 2. 受け入れ条件（L2 が実測する）

- [ ] `npm test` が合格し、`tests/icons.test.ts` が含まれる（TS-09）。
- [ ] 全 `.csprite`（再利用・固有とも）が CyberSprite の `validate` に合格した記録（コマンドと出力の要点）が REPORT にある。L2 が抜き取りで再実行する。
- [ ] コンタクトシートがあり、別コンテキストの Opus による見た目の確認（L2 が別途発注）が済む。
- [ ] `NOTICE` と `manifest.json` に由来がある。
- [ ] CyberSprite の作業ツリーが無変更。

## 3. 報告

`docs/work/M5/REPORT.md`。CyberSprite `AGENTS.md` §6.3 の報告の規則に従い、見た目を自己採点しない。各アイコンについて「何を形で表したか」と「自分で疑っている箇所」（全体で少なくとも3つ）を書く。
