# GUI アイコン（原本）

Shin-MotionMaker の GUI のアイコンの原本。1 アイコン = 1 つの CyberSprite プロジェクト（`<名前>.csprite/project.json`、16×16、1 フレーム、レイヤー `icon`、背景は透明）。
書き出した PNG は `gui/public/icons/<名前>.png`、由来の記録は `gui/public/icons/manifest.json`（GU-12）。どちらもコミットするので、CI とビルドに CyberSprite は要らない（GU-11）。

## 2 種類の由来

| 由来（manifest の `origin`） | 対象 | 扱い |
| --- | --- | --- |
| `cybersprite-reuse` | `add`・`agent`・`error`・`eye`・`folder`・`human`・`info`・`link`・`remove`・`settings`・`sources`・`validate-ok`・`warning`（13） | CyberSprite のコミット `a00433c` の `assets/ui/icons/<名前>.csprite/project.json` を**無加工で**写したもの（GU-10）。直さない。描き直しの道具の対象にも入れない。照合値は `tests/fixtures/cybersprite-icons-a00433c.json` |
| `shin-motionmaker-original` | `app`・`mode-mv`・`mode-explainer`・`style-biim`・`style-anime`・`style-motion`・`style-mixed`・`gate`・`advisory`・`ghost-check`・`job-zip`・`cli`・`mcp`（13） | Shin-MotionMaker 固有。CyberSprite の CLI の Op（`draw_rows`）で描いた（GU-11）。設計データは `tools/icon_grids.py` |

## パレット（`ui-icons.gpl`、全アイコン共通）

CyberSprite の `ui-icons.gpl`（`a00433c`）をそのまま写した。番号と色は再利用アイコンと同じで、色を足していない。

| 番号 | 名前 | 色 | 使い方 |
|---|---|---|---|
| 0 | transparent | — | 透明インデックス |
| 1 | ink | `#0B2A3A` | 輪郭線（1px） |
| 2 | trace-deep | `#0A86A8` | 濃い水色。補助の線、面 |
| 3 | trace | `#19C3E6` | 水色。主な面 |
| 4 | trace-soft | `#BFEFF9` | 薄い水色。副の面 |
| 5 | white | `#FFFFFF` | 白い面、記号の抜き |
| 6 | warn | `#E8A317` | 警告。状態アイコンにだけ使う |
| 7 | error | `#E5484D` | エラー。状態アイコンにだけ使う |
| 8 | agent | `#7C5CFF` | エージェントの印 |
| 9 | ink-soft | `#43606E` | 小さな陰 |
| 10 | agent-soft | `#D9D0FF` | エージェントの面 |

色を足す必要が出たら、再利用アイコンを変えられないので、まず要件（GU-10・GU-11）との整合を L2 に確かめる。

## 描き方の約束（CyberSprite `assets/ui/icons/README.md` を継承）

- 16×16、1 フレーム、レイヤー `icon`、透明背景。輪郭は ink の 1px。内容は 14×14（座標 1〜14）に収める（`icon_grids.grid()` が行・列 0 と 15 の空きを表明する）。
- 斜めは 45° か 2:1 の段。アンチエイリアスなし。
- 意味は形で伝える。色だけに頼らない。
- warn（金）と error（赤）は状態アイコンにだけ使う。固有アイコンはどれも使わない。特に `advisory`（助言）は吹き出しの形と薄い水色で描き、`warning`（三角・金）・`error`（八角形・赤）と形も色も分けた（PH-03）。
- 様式4種（`style-*`）は同じ枠・同じ白い面で、中の図形だけが違う。どれかを主に見せない（GU-07）。
- 他製品のアイコンを見て写さない。参照画像を repo に入れない（CyberSprite `AGENTS.md` §4）。
- GUI ではアイコンを文字のラベルと並べて置き、アイコンだけの操作を作らない（GU-10）。

## 作り直す・直す（開発者向け。テストと CI からは呼ばない）

前提：CyberSprite の checkout とその `.venv`（`uv sync` 済み）、`uv`、Python 3.12。CyberSprite の中には何も書かない。コマンドはこの repo のルートで実行する（CyberSprite の CLI は作業ディレクトリの下にだけ書くため）。

```powershell
$env:CYBERSPRITE_DIR = "<CyberSprite の checkout>"
# 固有アイコンを設計データどおりに描く（差のあるものだけ draw_rows 1 トランザクション）→ 全アイコンを validate → PNG と manifest を書き出す
python assets/ui/icons/tools/build_icons.py draw validate export
# 確認用：CyberSprite の render（×1・×4）。出力先は git 管理外にする
python assets/ui/icons/tools/build_icons.py render --renders .agent-work/renders
# 確認用の一覧（×1・×4、明るい下地 --cs-board と暗い下地 --cs-ink）。Pillow を使うので CyberSprite の環境で動かす
uv run --project $env:CYBERSPRITE_DIR --no-sync python assets/ui/icons/tools/contact_sheet.py .agent-work/sheets
```

- 書き出しは `export image --compression stored`。決定論の PNG なので、同じ原本と同じ CyberSprite から同じバイトになる（manifest の SHA-256 が変わらない）。
- 小さな修正はプロジェクトに Op を当ててもよいが、`tools/icon_grids.py` とずれるので、次に `draw` を流す前に設計データへ反映する。
- `.csprite/.cybersprite/`（CLI の履歴。ローカルの絶対パスを含む）は git 管理外。追跡するのは `project.json` だけ。
- 直したら `npm test`（`tests/icons.test.ts`、TS-09）を流す。PNG・manifest・原本のハッシュが一致しないと落ちる。
