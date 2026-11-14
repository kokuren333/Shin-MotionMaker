# M3 REPORT — MCP stdio サーバー

実装と実行証拠の報告であり、受け入れ判定は L2 と別製品 Opus の安全検査・交差レビューへ委ねる。

## 起動時チェック

- L3 工学担当。発注は Codex 6.1 sol / high。モデル切替・サブエージェント利用なし。縮退レベル1相当、自己判定となるゲートなし。
- 指定ブランチ `m3-mcp`、基準コミット `0787aea47a0a6fe1a3d01ca59951bd4451d7a977`、着手時の作業ツリーはクリーン。
- Windows / Node v24.15.0 / npm 11.12.1。コマンド・対話・ネットワーク利用可。Linux の実行環境はない。
- REQUIREMENTS の必須節と M3 指定節、ルート AGENTS、CONTRACT、WORKFLOW、M2a REPORT の修正追補・残存リスクを確認した。DIRECTION は会話内の発注を使用した。
- 原典・CyberSprite・job-template・core・GUI・README・共有操作表・スキーマ・CONTRACT に変更なし。外部ツール導入・push・公開・repo 作成はしていない。

## 実装したもの

- `src/mcp/server.ts` / `index.ts`: `serveMcp(options)`・`createMcpServer(options)`。root の安全検査、allow-dir の起動時検査、操作表の公開条件からの tools/list、host.execute による tools/call、JSON 封筒・PNG、進捗通知。生成・入力検査・ゲート・パス・排他・待機の判定は host / core に置いたままである。
- `src/mcp/main.ts`: 開発用に直接 node から起動するエントリ。node:util の parseArgs、必須 root、read-only / enable-generation / 複数 allow-dir / 複数 allow-engine-host、stderr への起動エラーと終了コード。
- `src/mcp/schema.ts`: host.schemaRegistry を使い、封筒スキーマの外部参照をローカル `$defs` にまとめる。クライアントがスキーマ解決のためにファイルやネットワークへアクセスする必要をなくす。
- `tests/mcp.test.ts`・`mcp-setup.test.ts`・`mcp-docs.test.ts`・`helpers/mcp.ts`: 公式 SDK クライアントから別プロセスの stdio サーバーを起動する試験。tools/list で SDK の出力検査器も登録し、成功時の structuredContent を outputSchema で検査する。各呼出で先頭 text と structuredContent の完全一致、isError と ok の関係も検査する。
- `tests/fixtures/mcp-tools.json` / `tools/write-mcp-snapshot.ts`: 名前・日本語説明・入力・outputSchema のスナップショット。共通の outputSchema は1回保存し、各ツールから参照する。
- `tools/smoke-mcp.ts`: Tier B の生成→実依存導入→構造検査→状態→validate report 取得。50秒ずつ run_get で待ち、最後に終了コードと verdict を照合する。
- `docs/MCP.md`・`docs/mcp-client.example.json`: 起動・登録・ツール・待機・安全境界と残存リスク。登録例は SDK から実行済み。文面の推敲は M6 に委ねる。
- `tools/audit-mcp-licenses.mjs`・`dependency-licenses.json`・NOTICE・package.json / lock: SDK の固定導入とライセンス実物の確認記録。

## host に入れた最小限のバグ修正

`src/host/worker.ts` の cwd を決める箇所だけを変更した。Windows で setup を npm の workspace パッケージに対して実行すると、名前空間接頭辞を付けた cwd が npm の workspace の file URL として解釈できず、`Invalid file: URL, must comply with RFC 8089` で終了1となった。npm ログの npm-package-arg → Arborist.loadWorkspaces のスタックと namespaced cwd を確認した。

setup に限り元の cwd を渡し、他のジョブ内スクリプトは既存の名前空間付き cwd を使う。引数・shell:false・排他・上限・依存・判定は変えない。依存なしの workspace fixture で install→ci の2回を実行する再現テストと、実ジョブ Tier B で確認した。

## 受け入れ条件ごとの証拠

| 条件 | 実行証拠・状態 |
| --- | --- |
| npm test / TS-04 Tier A・TS-05・候補 TS-06・snapshot | `npm test`: tests 193 / pass 182 / fail 0 / cancelled 0 / skip 2 / todo 9、終了0。M3追加16件は全件実行。skip 2とTODO 9は既存の対象OS限定・M2b待ち |
| TS-04-3 Tier B をこの PC で実行 | `node --experimental-strip-types tools/smoke-mcp.ts`: 終了0。68ファイル生成、setup completed / exit 0、validate completed / pass / exit 0、deps_installed:true、protocol_errors:0 |
| ci-local | 実装・文書コミット後に深さ1複製で実行し、コミット・件数・終了コードを追記する |
| Opus の交差レビュー | 未実施。L2 と別製品 Opus による安全検査・受け入れ判定を待つ |

### 安全の境界とテスト名

| 境界 | 試験名・証拠 |
| --- | --- |
| tools/list・共通定義・outputSchema | `TS-04 tools list matches the complete tool schema snapshot and operation table`。全20操作、CLI専用3操作の理由、閉じた入力、日本語説明、serverInfo、初期化プロトコルを確認 |
| 封筒・ゲートと isError・依存不足 | `TS-04 real explanation and MV jobs preserve QC verdicts without tool errors`。実ジョブの解説 fail / isError:false、MV not_applicable、E_DEPS_MISSING / run なし |
| host と MCP の結果一致 | `TS-05 MCP structured results equal host execute for identical deterministic inputs`。seed付き候補、統計、生成dry-run、schema の結果を完全比較。CLI比較は M2b マージ後の L2 統合で残る |
| 候補の思想 | `TS-06 candidate description and results say draft and omitted seeds vary`。「たたき台であり固定の正解ではない」、seed省略の4回が固定ではないこと、全体合否・スコア・順位なし |
| 読取専用・生成の公開条件・任意コマンドなし | `MC-04 read-only and generation flags filter publication and reject direct hidden calls`。フラグ4通り、非公開ツールを直接呼ぶ E_DISABLED、未定義ツール E_USAGE |
| root・実体・junction・symlink | `MC-02 root-relative and realpath boundaries reject traversal absolute paths and links`。読取と出力の両方で境界外拒否。この PC の dir symlink は EPERM を診断出力し、junction は実行済み |
| allow-dir の添付限定 | `MC-02 allow-dir permits only absolute request attachments and denies escaped realpaths`。許可した絶対添付だけ読める。出力・job の制限は緩めず、allow-dir 内の外向きリンクも拒否 |
| 起動不正・stdout 無混入 | `MC-01 invalid startup fails on stderr with no protocol stdout`。必須root欠落・未知フラグ・不在allow-dirは終了2、stdout空、stderrのJSONコード。通常接続では SDK のプロトコル解析エラー0を終了時に検査 |
| PNG・report の読取範囲 | `MC-06 report PNG uses identical base64 JSON plus a following image block`。JSONと画像バイト一致、設定・runtime・上位への report 読取拒否 |
| 入力の範囲 | `MC-12 wait bounds unknown keys and log_tail bounds use host input validation`。wait_ms と log_tail の上限・下限・整数、未知キー・log_offset の拒否 |
| 排他・待機・進捗 | `MC-05 and MC-15 host exclusion and token progress survive stdio waiting`。E_BUSY、run_get と開始操作のトークン通知、単調な通知連番、完了結果 |
| 未許可エンジン | `MC-04 and R-12 unapproved engine hosts are denied for voice and uncontacted by doctor`。E_DISABLED・doctorの未確認・台帳なし |
| 許可エンジンの接続 | `MC-04 explicit engine host permission reaches only the local fixture engine`。このPCの非ループバックIPv4にfixtureを置き、未許可のvoice/doctorはHTTP 0回、明示許可後はspeakersだけへ接続。環境に非ループバックIPv4がない場合は理由付きskip |
| サーバーとrunの寿命 | `MC-13 detached MCP runs remain queryable after the stdio server restarts`。別接続のread-only run_get/listで同じIDと完了を取得 |
| Windows npm workspace | `M3 setup resolves npm workspace URLs in a Windows path with spaces ampersands and fullwidth characters`。shellなしのsetupでinstall→ci、lock作成、両方終了0 |
| 登録例 | `DC-03 MCP client registration example launches from the repository directory`。文書のJSONをそのままSDKに渡し初期化・一覧・候補取得、stderr空 |

### 実行記録

- `npm install --save-exact @modelcontextprotocol/sdk@1.32.2`: 終了0、added 111 packages / audited 113 packages / vulnerabilities 0。
- `npm run build`: 終了0。
- `npm test`: tests 193 / pass 182 / fail 0 / cancelled 0 / skip 2 / todo 9、終了0、duration_ms 421818.7048。npm の JavaScript entry をNodeから配列引数・shell:falseで起動し、ログFDを直接渡してstatus 0を取得した。
- `node --experimental-strip-types --test tests/mcp.test.ts tests/mcp-setup.test.ts`: 追加試験前の13件、pass 13 / fail 0 / skip 0 / todo 0。全体実行ではさらに許可エンジン・再接続・登録例の3件を含む。
- `node --experimental-strip-types --test tests/mcp-docs.test.ts`: 1件、pass 1 / fail 0、終了0。
- `node --experimental-strip-types tools/smoke-mcp.ts`: 終了0。実行結果は下記。
- `node tools/audit-mcp-licenses.mjs`: 終了0、95配置の本文・SHA-256・許諾節が保存済み一覧と一致。

```json
{"tier":"B","generated_files":68,"setup":"completed","setup_exit_code":0,"validate":"completed","verdict":"pass","validate_exit_code":0,"deps_installed":true,"protocol_errors":0}
```

最初の実行ではSDKクライアントのunion型の型検査エラーと、上記npmのworkspace障害を検出した。排他・通知試験では、3.5秒のfixtureで排他観測がE_INTERNAL、次の実行では通知0件となった。fixtureを10秒にし、Windowsのプロセス照合と後続要求の処理中も走行する時間を確保した。型はSDKのCallToolResultSchemaで確定した。製品のtimeout・判定条件は緩めていない。npm障害だけをhostで修正した。

## 決定

- MCP は公式 SDK の低水準 Server API を使う。共有の JSON Schema と host.execute をそのまま登録し、Zod で入力検査を再実装しないためである。
- 存在しないallow-dirはサーバーのtransport接続前にE_PATH_DENIED・終了2としてstderrへ返す。相対allow-dirも契約どおり拒否する。
- root・requestDirectory・restrictToRoot・startedBy はMCP専用のcontextを組み立てる。外部からCLIの非制限contextを渡すAPIにはしない。
- envelope outputSchema はhostの参照をローカル化し、同じ `$id` を保つ。SDKが共通スキーマを再利用できるようにする。スナップショットは共通本文1つと全ツールの参照で表す。
- JSON の Uint8Array は report の既知のbinary項目だけでbase64に変換する。先頭textとstructuredContentは同じ変換後のオブジェクトを使う。
- MC-15 の通知は観測専用で、待機の実装はhostに任せる。progressには単調な通知連番、messageにはhostの進捗文と比率を写す。失敗・切断・トークンなしで本体の結果を変えない。
- run_get の log_offset は契約で追加禁止なので実装しない。既定値・wait上限・ログ上限はhostに任せる。
- 配布用ビルドとCLI結線を先取りせず、L2には `serveMcp({root, readOnly?, enableGeneration?, allowDirs?, allowEngineHosts?})` を渡す。文書の実行例は開発用node入口をSDKから実測したものだけにする。
- Tier B は通常のnpm testから分離した開発スクリプトに置く。実物の依存導入をこのPCで実行し、不要になった一時ジョブとnode_modulesは検証後に削除する。

## 契約・要件への質問

[QUESTIONS.md](QUESTIONS.md) のとおり、未回答質問・契約変更提案なし。host修正は発注で許可された最小限のバグ修正として列挙した。

## 追加した依存とライセンス

直接依存は `@modelcontextprotocol/sdk` 1.32.2（MIT、Copyright 2024 Anthropic, PBC）だけ。プロトコル実測版は2025-11-25。推移依存はpackage-lock.jsonの版・integrityで固定する。

SDK依存閉包の95配置（名前・版の組は92件）を調べた。MIT 85配置・ISC 7配置・BSD-3-Clause 2配置・BSD-2-Clause 1配置。LICENSE本文の許諾・著作権保持・無保証を読み、許容範囲を確認した。GPL系の追加なし。HTTP関連パッケージもSDKの依存として一覧に含めるが、HTTPのMCP入口は実装していない。

全件の名前・版・ライセンス・実物本文のパス・SHA-256は [dependency-licenses.json](dependency-licenses.json)、名前と版の一覧はルート NOTICE に記録した。`node tools/audit-mcp-licenses.mjs` は導入物の本文を読み直し、許諾節と保存済みハッシュを照合する。

## 残った課題・引き継ぎ

- Opus の安全検査・交差レビューと L2 の受け入れ判定は未実施。
- M2b とマージ後に、CLIの `mcp serve` からserveMcpへの結線、ビルド済みJavaScript、CLIとMCPの同一入力の統合比較をL2が確認する。
- Linux / Node22 の実測と、このPCで権限不足だったsymlinkの確認はCI・統合で残る。junctionの拒否をsymlink実測済みとは扱わない。
- M2a申し送りのパスTOCTOU、プロセス同一性照合とシグナル間の競合、別セッションへ逃げる子孫、Windows Job Object相当の隔離ではないこと、mtime粒度の限界をdocs/MCP.mdへ記載した。ジョブスクリプトはnpm runと同じ信頼範囲でsandboxではない。
- 進捗通知はhostの観測であり、開始要求に対応するrunを一意に通知する専用hookは共有契約にない。同じjob・種別・開始時刻以降のMCP runだけを候補にするが、他プロセスが直後に同種runを開始する場合まで要求IDと厳密に対応する保証はしない。結果と排他には影響しない。
- 実レンダー・実Aivisエンジン・費用の発生する画像生成はM7の範囲。M3の許可エンジン試験はローカルfixtureである。
- 見た目・アイコン・README文面の判断はしていない。docs/MCP.mdの文面の推敲はM6担当へ渡す。
