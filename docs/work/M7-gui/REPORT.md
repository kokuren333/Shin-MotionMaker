# M7-gui REPORT — G4-M1（スクリーンショットの撮り直し）と R-10（読み込みエラーの文面）

以下は実装と実行の証拠である。受け入れの判定は L2 とレビューに委ねる。

## 起動時の確認

- 層：L3（見た目・文面の担当、M4 と同じ役割）。L4 サブエージェントは使っていない。
- 作業ツリー：`Shin-MotionMaker-wt/m7gui`、ブランチ `m7-gui`。着手時 HEAD `14c6f16`、作業ツリーはクリーン。
- 環境：Windows 11、Node v24.15.0。
- 触っていないもの：`src/`（core・host・cli・mcp）、`job-template/`、`docs/CONTRACT.md`、M4 のスクリーンショット（履歴として残した）。

## 実装したもの

| 項目 | 内容 | 主なファイル |
| --- | --- | --- |
| R-10 | request.json の読み込みエラーを、GUI が表示するときに利用者向けに補う `importErrorLines` を足した。core の `validateRequest` の文言と封筒は変えていない | `gui/src/lib/request-io.ts`、`gui/src/App.tsx` |
| R-10 のテスト | 単体1件を追加。e2e の R1 テストに、画面の項目名・書ける値・「入力と添付はそのまま」の確認を足した。期待する値は core の `formChoices` から作る | `gui/tests/request-io.test.ts`、`gui/e2e/run.mjs` |
| G4-M1 | R-10 を反映したコミット `94ed115` で16枚すべてを撮り直し、`VERIFICATION.md` に新しい表（ファイル名・SHA-256・コミット・M4 との比較）を足した。M4 の表は履歴として残した | `docs/work/M7-gui/screenshots/`、`VERIFICATION.md` |

### R-10 の表示（S12 の例）

```
unknown-style.request.json を読み込めませんでした。
入力の構造に誤りがあります。                                  ← core の message（そのまま）
様式モード（/form/styleMode）："unknown" は選べる値ではありません。　request.json に書ける値：biim、anime、motion、mixed
request.json の上の項目を直してから、もう一度読み込んでください。
読み込み前の入力と添付はそのままです。
```

## 決定

1. **core の文言は変えず、GUI 側で補う。** core の message・hint は CLI・MCP と共通で、request.json を手で書く人に向いている。発注書の指示どおり core には触れない。
2. **core の message と pointer は残す。** 3つの入口で同じ誤りが同じ pointer で示されるようにするため。pointer の前に画面の項目名を付け（例：`様式モード（/form/styleMode）`）、利用者が画面のどこに当たるかわかるようにした。対応表に無い pointer（未知のキーなど）は、従来どおり pointer だけを出す。
3. **core の hint は差し替える。** 「details の pointer が指す項目のキー・型・列挙値を修正」は、details という語も含めて GUI の利用者には見えないものを指している。pointer つきの誤りがあるときは「request.json の上の項目を直してから、もう一度読み込んでください。」に替えた。pointer の無い誤り（JSON として読めない場合）は、GUI がもともと出している hint をそのまま使う。
4. **「読み込み前の入力と添付はそのままです。」をすべての読み込みエラーの最後に付ける。** M4R R1 の説明を戻した。JSON として読めない場合にも付けた（実際の挙動と同じで、従来は抜けていた）。
5. **値の決まっている項目には「request.json に書ける値」を出す。** 値の集合は core の `formChoices` から読み、GUI には直書きしない（発注書の指示）。表示するのは request.json に書く識別子（`biim` など）であり、画面の日本語の選択肢名ではない。直す場所が request.json なので、そこに書ける値を出した。既存の列挙キーへの補助であり、新しい選択肢の一覧や自由記述の制限は足していない（§2 の緩さに触れない）。
6. **項目名の対応表は名前だけを持つ**（`screenNames`）。画面のラベルと同じ語にした。「何を説明する動画か」はモードで見出しが変わるので「何を説明する動画か／MVで表現したいこと」とした。
7. **撮り直した画像は `docs/work/M7-gui/screenshots/` に置いた。** M4 の画像を上書きすると、M4 の記録の SHA-256 が確かめられなくなるため。`VERIFICATION.md` では M7-gui の表を現在の基準（CI-08 の公開前後の比較の基準）とし、M4 の表に「履歴」と注記した。
8. 撮影に埋め込むコミットは、GUI のコードを含む最後のコミット `94ed115` にした。その後のコミット（画像と文書）は GUI のビルドに影響しない。

## 受け入れ条件ごとの状態と証拠

| 条件 | 状態 | 証拠 |
| --- | --- | --- |
| R-10：core の文言を変えずに GUI で補う | 実装済み | `git diff 14c6f16 -- src` は空。`importErrorLines` を `App.tsx` の読み込み失敗の経路だけで使う |
| R-10：列挙値の集合を GUI に直書きしない | 実装済み | `choicesAt` が core の `formChoices` を読む。e2e の期待値も `formChoices` から作る |
| R-10：e2e の R1 テストを合わせる | 実装済み | 「GU-04 不正な列挙値の request.json は…（M4R R1）」が合格（下の e2e 42/42） |
| G4-M1：全状態の撮り直し（S12 を含む） | 実施 | 16枚、すべて横あふれ 0px・コンソールエラー 0 件（shots.mjs の出力） |
| G4-M1：`VERIFICATION.md` の表の更新 | 実施 | 「M7-gui GUI のスクリーンショット（GU-17、G4-M1）」節 |
| `npm test`・GUI のテスト・e2e・ci-local | 合格 | 下記 |

## テストのコマンドと結果

| コマンド | 結果 |
| --- | --- |
| `npm run typecheck --workspace gui` | 終了0 |
| `npm test`（ルート、pretest で build） | tests 215 / pass 213 / skip 2 / fail 0 |
| `npm test --workspace gui` | 単体 34 / 34、e2e 42 / 42 |
| `npm run shots --workspace gui -- --commit=94ed115ff66bea5f49277e113d68582949aea131 --out=../docs/work/M7-gui/screenshots` | 16枚、overflow=0・errors=0 |
| `node tools/ci-local.mjs`（コミット `f8bf74a22316c4c5bba5ac44652939d571909829`、深さ1の複製） | 終了0。本体 215/pass 213/skip 2/fail 0、GUI 単体 34/34、e2e 42/42、依存ライセンスの照合と両ビルドを含めて「CI と同じコマンドが完了しました」。ログは追跡外（3188行、SHA-256 `b8767865370fcbe0828fccba3e15781078b008b10ff9a58bd12c7b6b5bb0677a`） |

注：作業ツリーで最初に `npm run test:e2e --workspace gui` だけを実行したとき、GU-02 の2件が `MCP error -32000: Connection closed` で失敗した。ルートの `dist/` が未ビルドで MCP サーバーを起動できなかったためで、`npm test`（pretest で build）の後は合格した。ci-local は依存の導入とビルドから行うので、この影響は無い。

## 見た目の差（M4 との比較）

M4（`9f08db5`）の16枚と SHA-256 を比べた。同じバイトは11枚（S1m・S4・S5・S5b・S5c・S7・S8・S9・S9b・S10・S11）。変わった5枚の差の範囲は画素の差分の外接矩形で確かめた。

| # | 差の範囲 | 原因 |
| --- | --- | --- |
| S12 | 字幕帯（y 681〜873） | R-10 の文言。エラーの行が4行から5行になり、字幕帯が1行ぶん高くなった（上の編集領域がそのぶん短く見える）。M4 で出ていた「選べる値の決まっている項目に…」は、core の「入力の構造に誤りがあります。」と GUI の補足に変わった |
| S2 | 方向性のたたき台（x 55〜853、y 233〜452） | たたき台の乱数（M4 と同じ理由） |
| S3 | 方向性のたたき台（x 55〜926、y 232〜454） | 同上 |
| S6 | 情報ダイアログのコミット・ビルド日時（x 539〜813、y 188〜248） | 埋め込んだコミットと日時 |
| S1 | 1画素（1127, 827） | ZIP ボタンの付近。原因は特定していない（M4 の記録でも S1 の差分の原因は未特定） |

レイアウト・色・テーマの変化は無い。

## 質問

なし。

## 残課題

- S12 の字幕帯の見出しは、読み込みエラーの間も「ジョブを書き出せます」のままである（M4 から同じ。見出しは画面の入力の状態を示し、読み込みエラーは入力を変えないため）。誤解を招くと判断するなら、見出しの扱いは別の作業で決めたい。
- M4 の `VERIFICATION.md` の機械検査の表（単体 33/33）は M4 時点の履歴として残した。現在の単体は 34 件。
