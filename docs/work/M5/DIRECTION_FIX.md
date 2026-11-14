<!-- L2 の発注・判定記録（_handoff からローカルのパスを除いて転記） -->
# 差し戻し発注書 M5-fix — 様式アイコンの同格化ほか

- 作業 ID：`M5`（修正）
- 担当：L3 Opus 5.5 中（M5 の制作担当。前回と同じ役割）
- 作業ツリー：`<作業ツリー>\m5`（ブランチ `m5-icons`）
- 入力：`docs/work/M5/REVIEW.md`（別コンテキストの Opus による見た目レビュー。**全文を読む**）、`docs/work/M5/REPORT.md`、発注書 `_handoff/M5/DIRECTION.md`（前回分、読み取りのみ）

## L2 の裁定（直すもの）

1. **必須 M-1**：様式4種（`style-biim`・`style-anime`・`style-motion`・`style-mixed`）を同格に見えるようにそろえる（GU-07）。レビューの直し方の提案 1〜3 と参考 S-4（mixed の ink 輪郭）を踏まえる。形の決定はあなたに任せる。画素数は手がかりであって合否のしきい値にしない。
2. **推奨 R-1**：`gate` を ×1 で旗ではなく遮断機（関門）に読める形に。赤は使わない。
3. **推奨 R-2**：`tests/icons.test.ts` で `author` を固定値で照合せず、空でないことを表明する。
4. **推奨 R-3**：直したアイコンについて、前後を並べたシート（×1・×4）と前の版のリビジョン番号を `docs/work/M5/` と REPORT に残す。様式4種は選択欄の順（原典 GUI の順）に並べたシートも作る。
5. 参考 S-1：`docs/work/M5/REPORT.md` に「M4 への申し送り：アイコンを ink の面に置かない。置くなら明るい面のチップに載せる」を書く（DESIGN.md は M4 で作る）。

## 受け入れ条件

- 直したアイコンの CyberSprite `validate` が error 0・warning 0、書き出しの `validation_ok`・`verified` が true（記録を REPORT に）。
- `npm test` 全件合格（manifest の SHA-256 更新済み）。
- CyberSprite の作業ツリー無変更。
- REPORT に「M5-fix」節（変更点、前後シートのパス、疑っている箇所）。見た目を自己採点しない。

コミットメッセージの先頭は `M5:`。終了時に作業ツリーをクリーンに。
