# M5 REPORT — アイコン（再利用と固有アイコンの制作）

- 実働: L3 Claude Opus 5.5（effort 中）。L4 は使っていない。
- 作業ツリー: `Shin-MotionMaker-wt/m5`、ブランチ `m5-icons`（`35b3c20` から）。push していない。
- 道具: CyberSprite 0.1.0（`cybersprite --version`）、コミット `a00433c`。CyberSprite の既存 `.venv` を `uv run --project <CyberSprite> --no-sync` で使った。Python 3.12.10、Node は repo の既定。
- 本報告は見た目を自己採点しない（CyberSprite `AGENTS.md` §6.3）。見た目の判定は別コンテキストのレビュー待ちで、`pending`。

## 1. 実装したもの

| ファイル | 内容 |
| --- | --- |
| `assets/ui/icons/<13点>.csprite/project.json`（再利用） | CyberSprite `a00433c` の git blob を `git show` でそのまま書き出した。原典の要件10点（`info`・`validate-ok`・`warning`・`error`・`folder`・`sources`・`add`・`remove`・`settings`・`agent`）に、GUI で使う予定の3点を足した：`eye`（ゴースト検査の静止画・プレビューの表示）、`link`（GU-06 の文書へのリンク）、`human`（オーナーだけが出せる免除の明示、GU-05） |
| `assets/ui/icons/ui-icons.gpl` | CyberSprite のパレットを無加工で写した |
| `assets/ui/icons/<13点>.csprite/project.json`（固有） | `app`・`mode-mv`・`mode-explainer`・`style-biim`・`style-anime`・`style-motion`・`style-mixed`・`gate`・`advisory`・`ghost-check`・`job-zip`・`cli`・`mcp`。CLI の `new` → `set_palette`（名前付け）→ `draw_rows` 1 トランザクションで描いた |
| `assets/ui/icons/tools/icon_grids.py` | 固有アイコンの設計データ（データのみ）。16×16・許可文字・行列 0/15 の空きを表明する |
| `assets/ui/icons/tools/build_icons.py` | `draw`・`validate`・`export`・`render` の各段。CyberSprite の CLI だけを呼ぶ。CyberSprite の場所は `--cybersprite` か `CYBERSPRITE_DIR` で渡す（追跡ファイルに絶対パスを書かない） |
| `assets/ui/icons/tools/contact_sheet.py` | 書き出した PNG を並べるだけのレビュー用シート（描画しない） |
| `gui/public/icons/<26点>.png`、`gui/public/favicon.png` | `export image --compression stored` で書き出し。favicon は `app` の ×2（32×32） |
| `gui/public/icons/manifest.json` | GU-12 の由来記録（下の §3） |
| `tests/icons.test.ts`、`tests/fixtures/cybersprite-icons-a00433c.json` | TS-09 |
| `assets/ui/icons/README.md` | パレット、約束の継承、作り直し方 |
| `NOTICE` | アイコンの節だけを記入。テーマトークンの行は M4 用に残した |
| `.gitignore` | `.cybersprite/`（CLI の履歴。ローカルの絶対パスを含む）を除外。CyberSprite と同じ扱い |
| `docs/work/M5/contact-sheet-*.png` | レビュー用シート（§4） |

## 2. 受け入れ条件ごとの状態と証拠

| 条件 | 状態 | 証拠 |
| --- | --- | --- |
| `npm test` 合格、`tests/icons.test.ts` を含む（TS-09） | 実行済み・合格 | `npm test` → `tests 9 / pass 9 / fail 0`（icons の4件を含む）。`npm run build`（`tsc --noEmit`）エラーなし |
| 全 `.csprite` が `validate` に合格 | 実行済み | §2.1 |
| コンタクトシートと別コンテキストのレビュー | シートを作成。レビューは L2 の別発注待ち | `docs/work/M5/contact-sheet-x1.png`・`contact-sheet-x4.png`・`contact-sheet-status-x4.png` |
| `NOTICE` と `manifest.json` に由来 | 記入済み | `NOTICE` のアイコンの節、`gui/public/icons/manifest.json` |
| CyberSprite の作業ツリーが無変更 | 確認済み | 作業前と作業後の `git -C <CyberSprite> status --short` はどちらも出力なし（0 行）。HEAD は `a00433c` のまま |

### 2.1 validate の記録

コマンド（repo のルートで実行）:

```
python assets/ui/icons/tools/build_icons.py --cybersprite <CyberSprite> draw validate
```

内部では各プロジェクトに `cybersprite --quiet -p assets/ui/icons/<名前>.csprite validate` を実行している。最終の実行結果:

- 終了コード 0。26 件すべて `validate_ok: true`。全件 `error: 0`・`warning: 0`。
- `draw` の段は 13 件すべて `drawn: false`（設計データと画素が一致し、描き直しは不要）。
- info だけが出た：全件に `Q-PAL-02`（未使用のパレット番号。全アイコンが共通の 11 色パレットを持つための意図どおりの状態で、CyberSprite 側も同じ）。`eye`（再利用）にだけ `Q-PIX-02`（min_cluster 未満の塊。瞳のハイライト 1px で、原本のまま。直さない）。
- 警告はゼロ件なので、CyberSprite §6.3-2 の「警告ごとの処置」に該当するものは無い。
- 描画時の検証デルタは、固有の 13 件すべて `ok: true, errors: 0, warnings: 0`。

書き出し（`export`）は 27 ファイル（26 アイコン + favicon）すべてが `validation_ok: true`・`verified: true`、寸法は 16×16（favicon は 32×32）。もう一度 `export` を流しても、全 PNG と manifest がバイト一致した（stored 圧縮による決定論の確認）。

L2 の抜き取り再実行の例:

```
uv run --project <CyberSprite> --no-sync cybersprite -p assets/ui/icons/advisory.csprite validate
```

### 2.2 再利用が無加工であることの照合

- コピー直後に、13 件の `project.json` と `ui-icons.gpl` を CyberSprite の作業ツリーの同じファイルと `cmp` で比べ、すべて一致した。
- `tests/fixtures/cybersprite-icons-a00433c.json` に、`a00433c` の blob の SHA-256 を記録した。`tests/icons.test.ts` は、原本のハッシュがこの値と manifest の値の両方に一致することを表明する（テストは git を起動しない）。
- 再利用の 13 件には、`validate`・`export` のあとも `.cybersprite/` が作られていない（原本に書き込みが無い）。

### 2.3 テストが落ちることの確認（手で行い、元に戻した）

- `info.png` の末尾に 1 バイト足す → `fail 1`（SHA-256 の不一致）。
- manifest に無い `stray.png` を置く → `fail 1`（`PNG not in manifest: gui/public/icons/stray.png`）。
- 戻した後 → `fail 0`。

## 3. manifest.json の形

各アイコンの項目: `name`、`origin`（`cybersprite-reuse` / `shin-motionmaker-original`）、`source`（`.csprite` のパス）、`source_sha256`（`project.json` の SHA-256）、`author`、`cybersprite`（`version: 0.1.0`、`commit: a00433c`）、`png`、`sha256`、`files[]`（`path`・`scale`・`width`・`height`・`sha256`）。再利用の項目には `source_repo`、`source_commit: a00433c`、`source_last_changed_commit`（`a00433c` の時点でそのアイコンを最後に変えたコミット。`settings` は `93a433f`、他は `77c0bd1`）、`modified: false` も付けた。

寸法の除外規則は `size_policy` に書いた：`gui/public/icons/` の直下は全部 16×16。それ以外の寸法は icons/ の外にだけ置き、`exceptions` に載せる（今は `gui/public/favicon.png`、`app` の ×2 だけ）。

## 4. コンタクトシート

| ファイル | 内容 |
| --- | --- |
| `contact-sheet-x1.png` | 26 点の ×1。左半分は明るい下地 `--cs-board #EEF6F8`、右半分は暗い下地 `--cs-ink #0B2A3A`。上の行が固有、下の行が再利用 |
| `contact-sheet-x4.png` | 同じ並びの ×4（最近傍の拡大）とラベル |
| `contact-sheet-status-x4.png` | PH-03 の確認用：`advisory` を `info`・`validate-ok`・`gate`・`warning`・`error` と並べた |

シートは、コミットした PNG そのもの（manifest の `png`）から作った。CyberSprite の `render`（×1・×4）も全件で実行し、git 管理外の `.agent-work/renders` で見た。直す前の版は残していない（下の §5 の決定 D7）。

CyberSprite §6.3-6 の関門について：`direct` の手順に従い、(2) ブロッキングと (3) 仕上げ前を 1 回にまとめた。自律タスクなので、関門 (1) 設計は設計データ（`icon_grids.py` のコメント）と本報告の §5 で代え、シートを書き出して進めた。判定は `pending`。

## 5. 各アイコン：何を形で表したか

| 名前 | 形 | 色 |
| --- | --- | --- |
| `app` | 水色のタイルの上を白い球が動き、左に速度の線、下に進む軌道の線。「動くもの」を作る道具 | trace の面、白、trace-deep の軌道 |
| `mode-mv` | 連桁でつないだ 2 つの八分音符（音楽が先） | 符頭と連桁の中は trace |
| `mode-explainer` | イーゼルに載った板と、右上がりの棒グラフ（理解が先） | 白い板、trace-deep の棒 |
| `style-biim` | 共通の枠の中に、上下の字幕帯と中央の画面 | trace-deep の帯、trace の画面 |
| `style-anime` | 共通の枠の中に、4 方向に尖った輝き | trace-deep |
| `style-motion` | 共通の枠の中に、2 つのキーフレーム（菱形）とそれをつなぐ曲線 | trace-deep、ink の線 |
| `style-mixed` | 共通の枠の中に、四角と円が重なっている | trace-deep の四角、trace の円 |
| `gate` | 遮断機：支柱と縞の腕（通るか止まるか） | trace-deep と白の縞。赤は使わない |
| `advisory` | 3 点の入った吹き出し（「こう考えてはどうか」という声） | trace-soft の面、trace-deep の点。金・赤・三角・八角形を使わない |
| `ghost-check` | 幽霊の上に虫眼鏡（残像を探す） | 白の幽霊、trace-soft のレンズ |
| `job-zip` | ファスナーと引き手の付いた紙（ジョブを 1 つにまとめた ZIP） | 白の紙、trace-deep の引き手 |
| `cli` | 端末の窓。タイトル帯、プロンプト `>` とカーソル `_` | trace-deep の帯、白の画面 |
| `mcp` | 2 本の差し込み口と線の付いたプラグ（エージェントがつなぐ口） | trace の本体、trace-soft の差し込み口 |

様式4種は、同じ枠・同じ白い面・同じ 10×10 の図形領域・同じ 2 色（trace-deep と trace、motion だけ ink の線）で描き、図形だけを変えた（GU-07）。

### 自分で疑っている箇所（見た目の判定材料として）

1. **暗い下地で ink の部分が消える。** `mode-mv` の符幹、`style-motion` の曲線、`mcp` の線は ink だけで描いたので、`--cs-ink` の下地ではほとんど見えない（×4 のシートの右半分）。`mode-mv` と `mcp` は一度直した（下の決定 D7）が、符幹は残っている。再利用の `link`・`settings` も同じ性質なので、ファミリーの性質だとも言える。ただし GUI が暗い面にアイコンを置くなら問題になる。
2. **`gate` は ×1 だと旗に見えるおそれがある。** 支柱と腕の比で遮断機と読めるかは疑わしい（status シートの ×1 相当）。「合否」の意味は、文字のラベルに頼る部分が大きい。
3. **`style-anime` の輝きは「アニメ」に特有の形ではない。** 魔法・AI・新着のようにも読める。`style-mixed` の「重なった図形」も、レイヤーや図形ツールに見えるおそれがある。様式の4つが同格に見えるか（`style-biim` だけが帯の分だけ面積が大きく、重く見えないか）も、レビューで見てほしい。
4. **`app` は ×1 で窓やモニターに見えるおそれがある。** 球を 7×7 の円に直した（D7）が、16px のタイルの中では小さい。favicon の ×2 を、タブの大きさで確かめていない。
5. **`mcp` のプラグは「プラグイン」とも読める。** MCP に特有の形は無いので、ラベルとの組み合わせが前提になる。
6. **`advisory` と `info` の色の系統が近い**（どちらも水色系）。形（吹き出しと円）は違うが、助言を情報と区別したいかどうかは GUI 側の判断になる。

## 6. 決定（仕様が黙っていた細部）

- **D1 再利用は追跡ファイルだけを写す。** CyberSprite が git で追跡しているのは `<名前>.csprite/project.json` だけで、`.cybersprite/`（履歴）は git 管理外で、ローカルの絶対パスを含む。「丸ごとコピー」は `a00433c` の追跡内容をそのまま写すことと解し、`git show a00433c:<パス>` でバイトどおりに書き出した。履歴は写していない。この repo でも `.cybersprite/` を `.gitignore` に入れた。
- **D2 追加の再利用は `eye`・`link`・`human` の3点。** 使い道は §1 に書いた。`play` は、GUI がレンダーしない（§7.1）ので入れなかった。
- **D3 PNG は `--compression stored`。** CyberSprite 自身の `build-icons.mjs` は既定の zlib（環境によってバイトが変わる）だが、ここでは PNG をコミットして SHA-256 を manifest とテストで照合するため、決定論の stored にした。画素は同じで、ファイルが少し大きい（1 点あたり約 400〜1200 バイト）。
- **D4 favicon は `gui/public/favicon.png` に ×2（32×32）を 1 つだけ。** 16×16 は `gui/public/icons/app.png` を使える。`index.html` への組み込みは M4 の範囲。
- **D5 再利用の制作者は「Claude Opus 5.5 (CyberSprite M8 / e2e test 02)」。** CyberSprite のコミット `77c0bd1`（e2e test 02、「Opus」）と `93a433f`（M8、Co-Authored-By: Claude Opus 5.5）から取った。
- **D6 manifest に `source_sha256` と、再利用の `source_last_changed_commit` を足した。** 発注書の項目のほかに、無加工の照合と、要件の参照欄にあるアイコン原本の基準 `93a433f` との関係を残すため。
- **D7 一度直した。** 最初のシートで `mode-mv`（ink だけで暗い下地で消えた）、`mcp`（差し込み口が ink だけ）、`app`（球が四角く窓に見えた）を描き直した。前の版の `.csprite` のリビジョンは 1（直した後は 2）で、最初の版の画素は CyberSprite の履歴（git 管理外）にだけある。前後を並べた 1 枚は残していない。CyberSprite §6.3 の「改善のたびに前後の 1 枚」に届いていない点として記録する。
- **D8 道具のスクリプトは Python で `assets/ui/icons/tools/` に置いた。** CyberSprite の約束に合わせた開発用の道具で、テスト・CI・npm からは呼ばない。`build_icons.py` は CyberSprite の版を読むために git を起動するが、テストではない（`tests/no-git.test.ts` の走査対象の外）。`contact_sheet.py` は Pillow を使うので、CyberSprite の環境で動かす。この repo に依存は足していない。

## 7. 質問

なし（`QUESTIONS.md` は作っていない）。

## 8. 残課題

- 見た目の別コンテキストのレビュー（L2 が発注）。指摘が出たら `icon_grids.py` を直して `draw validate export` を流す。
- GUI への組み込み（M4）：`index.html` の favicon、アイコンを文字のラベルと並べる配置（GU-10）、`docs/DESIGN.md` への「追加のアイコン」の記載（GU-09）。
- `NOTICE` のテーマトークンの行は M4 が記入する。
