# 基線の採取記録

- 採取元: BiimMotion（BiimMakerWebUI）、コミット `262c79876a9c4635377114902d58ce783e7578b1`。
- 採取日: 2026-11-14（Asia/Tokyo）。Node v24.15.0、npm 11.12.1。
- 原典の作業ツリーは読み取り専用。複製で依存導入・テスト・生成を実行した。

## 採取コマンド

```text
git clone --no-hardlinks <原典> <原典の複製>
git -C <原典の複製> checkout --detach 262c798
npm ci（作業フォルダ: <原典の複製>）
node tools/capture-baseline.mjs --source <原典の複製>
```

- 原典ソースは変更せず、src/job.tsを直接importしgenerateJob・agentPromptFor・validateFormを呼んだ。テンプレート読み込みは原典tools/generate-job.tsの除外・UTF-8復号・フォント検査を再現した。
- 原典npm testをカスタムNodeレポーターで実行。81件、全件pass。原典テストはトップレベルtestのみでsuiteは空配列。
- 原典tests/explainer.test.ts L210付近はgit show 955fa5c:src/<file>で過去ソースを読み、MVフォーム・依頼文・brief・project・歌詞の一致を表明していた。浅いcheckoutで失敗する§8.1の原因である。今回だけ採取用複製の完全履歴で実行した。新repoのテストはgitを起動しない。
- MV2ケースは原典L225付近のform・settingsをswitchVideoModeに渡す順序まで再現。元テストの3バイト疑似WAVは有効な30秒無音WAVへ置換したため音源サイズ・内容のハッシュのみ異なる。設定・歌詞は同じ。
- 最小入力はformのtitle・description・audienceだけ。解説7ケースは同じ基礎フォームへ様式・人数・向き等を適用した。
- 時刻は生成中だけDateを2026-11-14T00:00:00.000Zに固定（ZIPエントリーの時刻）。コアソースは変更していない。乱数は生成関数の経路にない。ZIP本体・圧縮バイトは保存せず、全パス（ディレクトリ含む）と展開本文SHA-256を保存。
- 原典生成物のCRLFを含む歌詞・構成メモはバイトのまま保存。新規開発ファイルはLF。テンプレートとの差分がある本文はgolden内にすべて保存した。
- validateFormのURLエラーは行番号が任意なので文言集合は無限。全分岐の具体例とパラメーター付き文言を保存した。
- 採取できなかった出力・固定できなかった生成内容: なし。実レンダー・音声合成・画像生成はM0の対象外。
