# Shin-MotionMaker

Shin-MotionMaker は、モーショングラフィックス動画（MV・解説動画）の**制作ジョブ**を作る道具です。入力フォームの内容から、制作エージェントがそのまま開いて制作に入れるジョブフォルダ（または ZIP）を生成します。動画そのものは、生成したジョブの中で制作エージェントが作ります。

- **バージョン**: v0.1.0（公開済み）
- **リポジトリ**: https://github.com/kokuren333/Shin-MotionMaker （public）
- **GUI（GitHub Pages）**: https://kokuren333.github.io/Shin-MotionMaker/
- **ライセンス**: [Apache License 2.0](LICENSE)

入口は3つあり、どれも同じコアを通るので、同じ入力からは同じジョブができます。

| 入口 | 向いている使い方 |
| --- | --- |
| GUI | 人がブラウザでフォームを埋めて ZIP を作る |
| CLI（`shin-motionmaker`、短縮名 `smm`） | `request.json` からジョブを作る。ジョブ内の検査・レンダーを起動し、結果を JSON で受け取る |
| MCP（stdio） | 制作エージェントが、生成・状態の確認・ジョブ内スクリプトの起動をツールとして呼ぶ |

> CLI・MCP は npm レジストリには公開していません。repo を手元に置いてビルドします（導入は [CLI](#cli)）。

## 考え方

- 創造に関わる入力（デザイン方向性、動画全体への指示、差別化メモ、理解ゴールなど）は自由記述です。GUI・CLI・MCP が出す方向性の候補は**たたき台**であり、選ばなくても生成できます。
- 入口が決定論で担うのは、生成・検証・安全だけです。場面や演出は、制作エージェントがジョブのファイルを直接編集して作ります。
- 合否を決めるのは、客観的に判定できて、外すと視聴者に実害が出る検査だけです。主観的な質（面白さ、演出の巧拙、テンポなど）は助言として返し、合否に入れません。MV には QC 規則がありません。
- 生成後の設定の正本は、ジョブの `project.json` だけです。

## 必要な環境

| 用途 | 必要なもの |
| --- | --- |
| GUI・CLI・MCP（ジョブの生成） | Node.js 22.12.0 以上、npm |
| ジョブの制作（レンダー・検査） | ジョブの依存（ジョブのルートで `npm install`。Remotion など。初回はネットワーク接続が必要で、容量も大きい）、ffmpeg、Remotion のレンダー用ブラウザ |
| 音声合成（使う場合） | AivisSpeech などの Aivis エンジン（別途起動） |
| 画像生成（使う場合） | Codex CLI |

どれも自動ではインストールしません。手元の状態は `doctor` で確かめられます（[CLI](#cli)）。

## GUI

ブラウザの中だけで動く静的サイトです。入力はどこにも送信・保存しません。フォームを埋めて「ジョブのZIPを生成」を押すと、ZIP がダウンロードされます。フォームの内容は `request.json` として書き出せ、CLI・MCP の `generate` にそのまま渡せます。

制作モードは MV と解説の2つで、解説では様式モード（biim／anime／motion／mixed）を同格に選べます。見た目は CyberSprite と共通のファミリーテーマ「Circuit White / Solder Mask」です。

公開 URL は https://kokuren333.github.io/Shin-MotionMaker/ です。手元で起動するときは次を実行します（repo の取得と `npm ci` は [CLI](#cli) の導入と同じ）。

```sh
npm run dev --workspace gui
```

表示された `http://127.0.0.1:5173/` をブラウザで開きます。静的ファイル一式は `npm run build --workspace gui` で `gui/dist/` に書き出されます。

## CLI

### 導入

repo（https://github.com/kokuren333/Shin-MotionMaker ）を clone したら、そのルートで次を実行します。

```sh
npm ci
npm run build
npm link
```

`npm link` を使わない場合は、repo のルートで `node dist/cli/main.js` を `smm` の代わりに使います。

### 使い方

```sh
smm version
smm doctor
smm candidates --mode mv
smm generate request.json --out jobs
smm status "jobs/<タイトル>"
smm qc "jobs/<タイトル>" --stage pre
smm validate "jobs/<タイトル>"
smm render "jobs/<タイトル>" --target preview
smm runs list "jobs/<タイトル>"
```

- 標準出力は JSON の封筒1個です。`ok` は「コマンドが実行でき、結果を得た」こと、`result.verdict` はゲートの合否（`pass`・`fail`・`not_applicable`）です。ゲートが不合格でも `ok` は `true` です。
- `--human` を付けると、標準出力を人向けの要約に切り替えます。
- 終了コードは 0（成功・対象外・助言だけ）、1（検査の不合格。imagegen の strict 未生成を含む）、2（使い方・入力の誤り）、3（環境・前提の不足）、4（内部エラー・異常終了）です。
- 生成直後の解説ジョブで `qc --stage pre` を実行すると、制作記録がまだ無いので `verdict: fail`・終了コード1になります。これは正常な結果です。
- `request.json` の形は `{"form": {...}, "assets": {...}}` です。GUI の「request.json を書き出す」で作るか、`smm schema request` でスキーマを確かめて書きます。

コマンド・封筒・終了コード・エラーコードの全体は [docs/CLI.md](docs/CLI.md) にあります。

## MCP

CLI の `mcp serve` が stdio の MCP サーバーを起動します。公開するツールは20個で、ジョブの生成から検査・レンダー・run の管理までを扱います。`--root` で指定したフォルダの中だけを読み書きします。クライアントへの登録例（読み取り専用）は次のとおりで、作業ディレクトリを repo のルートにして起動します。

```json
{
  "mcpServers": {
    "shin-motionmaker": {
      "command": "node",
      "args": ["dist/cli/main.js", "mcp", "serve", "--root", ".", "--read-only"]
    }
  }
}
```

- ジョブの生成・検査・レンダーなどの書き込みを許すには `--read-only` を外します。画像生成のツールは `--enable-generation` を付けたときだけ公開されます（費用が発生する場合があります）。
- 作業ディレクトリを指定できないクライアントでは、`args` の `dist/cli/main.js` と `--root` の値を、手元の実際のパスに置き換えます。
- クライアント側の設定ファイルの場所や登録画面は、各クライアントの説明に従ってください。
- **ジョブ内スクリプトの実行は `npm run` と同じ信頼の範囲で、sandbox ではありません。** 信頼できるジョブだけを扱ってください。

ツールの一覧、長い処理（run）の待ち方、安全の境界は [docs/MCP.md](docs/MCP.md) にあります。

## 生成したジョブで制作する

ジョブは単体で完結しています。CLI・MCP を入れなくても、ジョブの `README.md` にある `npm install` と `npm run` の手順で制作できます。制作エージェントには、ジョブのフォルダを開いて `AGENTS.md` を読ませ、制作を依頼します。CLI・MCP は同じジョブ内スクリプトを起動する別の入口で、判定の実装はジョブ側の1つだけです。

## ライセンスと利用条件

- 本体は [Apache License 2.0](LICENSE) です。由来と第三者のライセンスは [NOTICE](NOTICE) にあります。
- 設計とコードは BiimMotion（同一オーナー、Apache-2.0）のコミット `262c798` を継承しています。テーマトークンとアイコンは CyberSprite（同一オーナー、Apache-2.0）に由来します。
- 同梱フォント（Noto Sans JP、M PLUS Rounded 1c）は SIL Open Font License 1.1 です。
- **Remotion は本体に同梱しません。** 生成したジョブが別途導入するもので、利用は Remotion の公式の利用条件（https://www.remotion.dev/license ）に従います。企業などでの利用には別の条件があります。Aivis エンジンと音声モデル、添付する素材も、それぞれの利用条件を確認してください。

## 開発する人へ

開発の規約はルートの [AGENTS.md](AGENTS.md)、要件の正本は [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)、層とゲートは [docs/WORKFLOW.md](docs/WORKFLOW.md)、API と操作の契約は [docs/CONTRACT.md](docs/CONTRACT.md)、GUI のデザインは [docs/DESIGN.md](docs/DESIGN.md) にあります。

```sh
npm test
node tools/ci-local.mjs
```

`npm test` はビルドしてから全テストを実行します。`tools/ci-local.mjs` は現在のコミットを深さ1で一時フォルダへ複製し、`npm ci` から CI と同じコマンドを実行します。

統合検証では、CLI と MCP の生成→依存導入→構造検査を同じ Tier B の入口から確認します。Windows の実レンダー（Tier C）と原典0.4ジョブの互換確認も実行し、[VERIFICATION.md](VERIFICATION.md) にコミット・出力・画像を記録しています。コマンドの構文と証拠の保存先は [CLI の統合検証](docs/CLI.md#統合検証のコマンド) にあります。

Pages のローカル確認には `npm run verify:pages:local -- --commit <SHA>`（構文）を使います。サブパス配信で正常経路・8種類の不一致・古いコミットからの再試行を確認します。公開後の構文は `node tools/verify-pages.mjs <末尾が / のURL> --expect-commit <SHA>` です。既存の Chrome/Edge が必要で、HTTP・title・コミット・JS/CSS・主要な表示・コンソールを確認し、既定12回・5秒間隔で再試行します。`--attempts`・`--retry-ms`・`--screenshot`・`--output` も指定できます。

Pages の workflow は main への push と手動で動き、ビルド・デプロイ・公開後確認の3ジョブがすべて成功したときだけ公開できたとみなします。実レンダーは独立した workflow で、手動と main push から動きます。M8 の実公開 URL の確認と公開前後のスクリーンショット比較は [VERIFICATION.md](VERIFICATION.md#m8-公開) にあります。
