# M3R 交差レビュー — MCP（安全検査）

- 作業 ID: `M3R`。レビュー担当は実装者（Codex）とは別製品・別コンテキストの Opus。コードは変更していない。書き込んだのはこのファイルだけである。
- 対象: ブランチ `m3-mcp` の `git diff main...m3-mcp`（`809cab5`・`149257e`・`408f68e`・`1c095a2`）。REQUIREMENTS §2.4・§5・§9.2 TS-04〜TS-06・§9.3・§11.2、CONTRACT M0b、`docs/MCP.md`、`docs/work/M3/REPORT.md`、`docs/work/M2a/REVIEW.md` と照合した。
- 環境: Windows 11、Node v24.15.0。Linux と Node 22 では実行していない。

## 結論

**条件付き承認（必須修正あり）**

MCP の層は薄く、正しく作られている。ツールの登録は操作定義表から行い、入力検査・パス・排他・待機は host に任せている。公開の制御、パスの境界、標準出力の純度、封筒と `isError` の対応、思想の表明は、SDK のクライアントから攻撃的な入力を試しても破れなかった（下の「観点ごとの確認結果」）。M2aR の M-1（UNC の添付で SMB 接続が先に起きる）が、M3 の経路で再発していないことも確かめた。M2aR の M-2（PID の再利用）は、M3 では試していない。

受け入れの前に、次の2点を片付ける必要がある。

1. 2.5 MiB 程度を超える PNG を `report_get` で読むと、SDK の既定設定のクライアントは接続ごと切れる。テストは受信上限を 40 MiB に広げているため、この失敗を検出できない（M-1）。契約で決まっている形が原因なので、L2 の裁定が要る。
2. M3 の受け入れ条件「TS-04（Tier A と Tier B）・TS-05」の証拠が揃っていない。CI に Tier B のジョブが無い。ubuntu と Node 22 での実行も無い。TS-05 の CLI 側の比較も済んでいない（M-2）。

## 実行した確認

| 確認 | 結果 |
| --- | --- |
| `node --experimental-strip-types --test tests/mcp.test.ts tests/mcp-setup.test.ts tests/mcp-docs.test.ts` | tests 16、pass 16、fail 0、skipped 0。終了0。ディレクトリ symlink は EPERM の診断を出し、junction だけを実測した（REPORT と同じ） |
| `npm test`（作業ツリー、既存の node_modules） | tests 193、pass 182、fail 0、cancelled 0、skipped 2、todo 9。終了0（duration_ms 約 202,700）。REPORT の値と一致。実行後の作業ツリーはクリーン |
| `node tools/ci-local.mjs`・Tier B（`tools/smoke-mcp.ts`） | 実行していない。REPORT に実装者の実行記録がある |
| 作業ツリー外での試行 | 作業ツリーの外の `_smm_scratch/m3r/` に probe を置いた。どれも作業ツリーの `node_modules` にある SDK 1.32.2 の `Client` と `StdioClientTransport`、または生の stdio を使い、`src/mcp/main.ts` を別プロセスで起動する。probe は repo に入れていない |

試行に使った probe:

- `probe-mcp.mjs`: 公開の制御、各パス引数、allow-dir、エンジン URL、エラーの details に root や利用者名が漏れないか。
- `probe-raw.mjs`: 生の JSON-RPC。不正な行、未知のメソッド、params の型の誤り、`__proto__`、10万段の入れ子、60件の同時要求。
- `probe-big.mjs`: 受信上限を超える1行。
- `probe-3.mjs`: 実ジョブへの深い patch、大きな PNG を既定のクライアントで読む場合、npm が失敗したときのログ末尾。

## 指摘

### 必須

#### M-1 大きな PNG を `report_get` で読むと、既定設定の SDK クライアントの接続が切れる

- 場所: `src/mcp/server.ts:32-42`（`toolResult`）、`src/host/report.ts:32`（PNG の上限 8 MiB）、`tests/helpers/mcp.ts:15`（`maxBufferSize: 40 * 1024 * 1024`）、`docs/MCP.md:55`。
- 根拠: 1つの PNG が、1つの JSON-RPC 行の中に base64 で3回入る。`structuredContent.result.data`、先頭の text ブロックの中の JSON、image ブロックの3箇所である。base64 は元の 4/3 倍なので、1行の大きさはおよそ PNG の4倍になる。SDK 1.32.2 の `StdioClientTransport` は、既定の受信上限が 10 MiB である（`shared/stdio.js` の `STDIO_DEFAULT_MAX_BUFFER_SIZE`）。上限を超えると、クライアントのトランスポートは閉じる。そのため、PNG が約 2.5 MiB を超えた時点で、契約上の上限である 8 MiB よりずっと手前でセッションが失われる。1920×1080 の静止画（`render --target still`）は、絵柄によってはこの大きさを超える。テストは受信上限を 40 MiB に広げているので、既定のクライアントで起きるこの失敗を検出できない。
- 再現（`probe-3.mjs`。作業ツリーの SDK の既定設定のクライアントで、`report_get` で `output/sN.png` を読む）:

  ```
  PNG 2.0MiB default-client true ms 926
  PNG 3.0MiB default-client FAILED McpError: MCP error -32000: Connection closed
    errors ["Error: ReadBuffer exceeded maximum size of 10485760 bytes", "SyntaxError: Unexpected token 'y', \"yKKMdlA6E/\"... is not valid JSON"]
  PNG 6.0MiB default-client FAILED McpError: MCP error -32000: Connection closed
  ```

  run は切り離して動いているので失われない。ただし、制作エージェントは MCP サーバーとのセッションを失う。進行中の要求もすべて失敗する。
- 直し方: 実装は CONTRACT §5（同じ封筒を `structuredContent` と先頭の text に入れ、binary は base64 にする）と §3（PNG は 8 MiB まで）に従っている。したがって、選択肢はどれも L2 の契約裁定を要する。
  1. MCP では、`structuredContent` と text の `result.data` を省く（または null にする）。画像の本体は image ブロックの1回だけにする。封筒スキーマには MCP 用の形を足す。1行はおよそ 4/3 倍に収まる。
  2. MCP の PNG の上限を、符号化した後の大きさで決める（例: PNG 2 MiB）。超えたら `E_PATH_DENIED` と hint（CLI の `report` を使う、画像を縮小する）を返す。
  3. 現状を既知の制約として受け入れる。その場合は、`docs/MCP.md` に「既定の SDK クライアントでは約 2.5 MiB が上限で、超えると接続が切れる」と具体的な値で書く。

  どれを選んでも、受信上限を既定のままにした接続で「上限付近の PNG が読める」「上限を超える PNG は接続を切らずに封筒で拒否される」ことを確かめるテストを、TS-04 に足す。テストの helper が上限を広げるのは、その必要を明記した試験だけに限る。

#### M-2 受け入れ条件の証拠が足りない（TS-04 の Tier B と ubuntu、TS-05 の CLI 側）

- REQUIREMENTS §11.2 の M3 の受け入れ条件は「TS-04（Tier A と Tier B）・TS-05／ツールのスナップショット／交差レビュー」である。§9.3 は、Tier B を「PR と push のたび。ubuntu。依存はキャッシュする」と定めている。
  1. **Tier B が CI に無い。** `.github/workflows/ci.yml` が実行するのは、`npm ci`・`build`・`npm test` と workspace の test・build だけである。`tools/smoke-mcp.ts` を実行するジョブが無い。実装者が Windows の手元で1回実行した記録（REPORT）はあるが、§9.3 の条件は満たしていない。ubuntu に Tier B のジョブを足す（依存のキャッシュ付き）。M7 へ送る場合は、L2 がその旨を裁定して記録する。
  2. **ubuntu と Node 22 での実行が無い。** ubuntu では、MC-02 の `dir` symlink の分岐が初めて実行される。Node 22 系には、版によって型除去の ExperimentalWarning を標準エラーに出すものがある。出た場合、`MC-01 invalid startup…`（`JSON.parse(output.stderr)`）と `DC-03 …`（`assert.equal(stderr, "")`）は失敗する。この点は手元で確かめていない。CI の Node 22 の結果で確かめ、失敗すれば、警告の行を除いてから比較する（または、ビルド済みの JS で起動する）。
  3. **TS-05 の「CLI と MCP の一致」は半分だけである。** 今あるのは MCP と `host.execute` の比較で、CLI の封筒の `result` との比較は M2b のマージ待ちである（REPORT の残課題）。L2 の統合で実行して記録する。
- コードの欠陥ではない。それでも受け入れの条件なので、M2aR M-3 と同じ扱いにする。

### 推奨

#### R-1 `run_get` のログ末尾に、利用者名を含む root の外の絶対パスが出る

- 場所: `src/host/runs.ts:138-149`（`displayLog`）。
- 根拠: 置き換えるのは、ジョブ・root・host の導入先の3種類だけである。npm・Remotion・Node は、利用者のホームの下のパスを当たり前に出力する。発注の観点2は「root の外の絶対パス・利用者名が漏れないか」である。CONTRACT §3 の文言（Context の絶対パス）の外側ではあるが、実害は同じである。MCP クライアントの会話記録には、利用者名がそのまま残る。
- 再現（`probe-3.mjs`）: 生成したジョブの `package.json` を壊し、`job_setup` を実行した。その後の `run_get` の `stderr_tail` は次のとおり（利用者名は伏せた）。

  ```
  "npm error A complete log of this run can be found in: C:\\Users\\<USER>\\AppData\\Local\\npm-cache\\_logs\\2026-11-14T10_14_41_496Z-debug-0.log"
  username leaked in run_get: true   root leaked: false
  ```

- 直し方: 置き換えの対象に `os.homedir()` を加え、その realpath・`/` 区切り・file URL の形もすべて `~` にする。win32 では大文字小文字を区別せずに置き換える（npm などはドライブ文字や `Users` の大文字小文字を変えて出力することがある）。テストは、偽のスクリプトが `os.homedir()` を stderr に出し、`run_get` に出ないことを確かめる。

#### R-2 存在しない `--root` が `E_INTERNAL`（終了4）になる。ファイルを `--root` にしても起動する

- 場所: `src/mcp/server.ts:16-24`（`mcpContext`）、`src/mcp/main.ts`。
- 再現:

  ```
  --root ./does-not-exist  → {"code":"E_INTERNAL",...,"details":{"reason":"ENOENT"}}  exit=4
  --root <既存のファイル>    → 起動して stdin の EOF まで待ち、exit=0
  ```

- 根拠: 起動の誤りは、CL-07 の「使い方・入力の誤り」（2）である。ファイルを root にして起動すると、その後のすべての呼び出しが失敗する。
- 直し方: `mcpContext` で、`fs.stat(root).isDirectory()` を確かめる。満たさなければ、`E_PATH_DENIED`（または `E_USAGE`）と hint を返し、終了2で終える。MC-01 の試験に「root が無い」「root がファイル」の2件を足す。

#### R-3 安全の試験が、境界の一部を MCP 経由で確かめていない

この3点は、いずれも probe で実際に拒否されることを確かめた。ただし、テストが無いので、退行しても検出できない。

1. `MC-04 read-only…` は、非公開のツールを `{}` だけで呼んでいる。`E_DISABLED` が入力検査より前に返ることは確かめているが、正しい入力で呼んだときに副作用が無いことは見ていない。probe で正しい request の `job_generate`（dry_run あり・なし）・`project_patch`・`run_cancel`・`job_imagegen` を read-only で呼び、すべて `E_DISABLED` で、root に何も作られないことを確かめた。この形を試験にする。
2. ジョブの内側に置いたリンクを、MCP 経由で試していない。probe では次の3つがすべて `E_PATH_DENIED` になった。
   - ジョブ内の `reports/leak` を外への junction にして、`report_get` で `reports/leak/secret.txt` を読む。
   - ジョブ内の `reports/hard.txt` を外のファイルへのハードリンクにして、`report_get` で読む。
   - root 内の相対パスの添付を外へのハードリンクにして、`job_generate` に渡す。
   TS-04-5 の「ジャンクションとシンボリックリンクを含む」を、ジョブ・root の入口だけでなく、ジョブ内のファイルにも広げる。
3. M-1 の既定の受信上限の試験。

### 参考

- **P-1** 受信上限（SDK の既定 10 MiB）を超える1行を受け取ると、SDK の `StdioServerTransport` は閉じる。サーバーはそのまま終了コード0で終わる（`probe-big.mjs`。9,000,000 バイトは処理できた。11,534,336 バイトで終了した）。切り離された run は続く。悪意のある第三者ではなくクライアント自身の入力で起きることなので、`docs/MCP.md` に1行書けば足りる。
- **P-2** 未知のツール名には、`isError:true` と `E_USAGE` の封筒を返している（`src/mcp/server.ts:84-85`）。MCP の仕様の例では、未知のツールは JSON-RPC のエラー（-32602）である。どちらでもクライアントは失敗と分かるので、変える必要は無い。決定として REPORT に書いておくとよい。
- **P-3** 深い入れ子の patch（5,000段以上）は、`E_INTERNAL`（details.reason: RangeError）になる。15万行以上の歌詞を渡した `text_stats` も同じである。サーバーは落ちず、`project.json` も変わらない。入力の構造の問題なので、`E_INPUT_INVALID` に分類できればなおよい。歌詞の件は core の原典由来の挙動であり、M3 で直すものではない。
- **P-4** `docs/MCP.md:73` の「URL のリダイレクト先へ許可を引き継がない」が当てはまるのは、host の疎通確認（`redirect: "error"`）だけである。ジョブの `aivis.mjs` は fetch の既定に従ってリダイレクトを追う（D-10 で本文は変えない）。許可した接続先が別の場所へリダイレクトすれば、スクリプトはそれに従う。文書の主語を「host の疎通確認は」に限定する。
- **P-5** `initialize` の前の `tools/list` にも応答する。params の型の誤りは -32603 になり、zod の詳細がそのまま返る。どちらも SDK の挙動で、実害は無い。
- **P-6** SDK の推移依存には、使わない HTTP 系（express・hono・cors など）が含まれ、本体の dependencies として導入される。ライセンスはすべて MIT・ISC・BSD で、NOTICE と `dependency-licenses.json` に記録がある。影響は導入物の大きさだけである。
- **P-7** run を開始する操作の進捗通知は、毎秒 `run_list` を実行して台帳を全件読む（`src/mcp/server.ts:46-73`）。M2aR P-7（`run_list` が全件を返す）と合わせると、台帳が増えるほど負荷が上がる。今の規模では問題にならない。

## 観点ごとの確認結果（問題なしと判断したもの）

| 観点 | 確認したこと |
| --- | --- |
| 1 公開面の制御（MC-03・MC-04） | ツールは、操作定義表の `mcp` 名だけから登録している（`exposedOperations`）。任意のコマンド・argv・環境変数・作業フォルダを入れる口は無い。argv は host の `runCommand` が、列挙したキーからだけ組み立てる。imagegen の値は、配列の1要素として渡る。read-only の `tools/list` は読み取りの9ツールだけである。非公開のツールを直接呼んでも、`execute` の先頭の判定で `E_DISABLED` になり、副作用は無かった（probe で確かめた）。`studio`・`mcp_serve`・`version`・`__proto__`・`constructor`・`toString` は `E_USAGE` だった。`job_imagegen` は `--enable-generation` が無ければ非公開で、直接呼ぶと `E_DISABLED`。voice のエンジンは loopback か明示した host だけで、次をすべて `E_DISABLED` にした: `localhost.attacker.example`、`127.0.0.1@evil.example`、`[::ffff:127.0.0.1]`、`169.254.169.254`。`0x7f000001` は URL の正規化で 127.0.0.1 になるので loopback として扱われる（正しい）。`file:` は `E_INPUT_INVALID`。doctor は、未許可の host に接続しない（MC-04 のテストで HTTP 0回） |
| 2 パス（MC-02・CONTRACT §3） | パス引数を持つ全ツール（job・out・request.assets・report の path・ghost の video・run_id）で、次を拒否した: `..`、絶対パス、`C:out`、`/Windows`、UNC、`\\?\`、`\\.\pipe`、NUL、予約名、`\` 区切り、ADS、大文字小文字を変えた `REPORTS/`、ジョブ内の junction、ハードリンク。UNC・デバイスパスの添付は 4〜41 ms で拒否し、SMB 接続を待たなかった（M2aR M-1 は解消済み）。`--allow-dir` は `request.assets` の絶対パスにだけ効く。`..` で外へ出るもの、兄弟の接頭辞（`allowed2`）、out・job への流用は拒否した。出力（structuredContent・text・エラーの details）に root の絶対パスや利用者名が入った例は、上の R-1 のログ末尾以外に無かった |
| 3 プロトコル（MC-01・TS-04-6） | `src/` に `console.log` と `process.stdout` は無い。worker と script は stdio をログファイルへ渡し、切り離して起動する。生の stdio で次を送った: 不正な JSON、JSON-RPC でない JSON、配列、未知のメソッド、arguments が配列や文字列のもの、name が無いもの、name が数値のもの、10万段の入れ子、60件の同時要求。いずれでもサーバーは応答を続け、標準出力の JSON-RPC でない行は0だった。通信エラーは、固定の文言で標準エラーへ出る。起動の誤りは標準エラーへ JSON で出て、標準出力は空（例外は R-2） |
| 4 入力スキーマ（§5.2・MC-06・F1・F5） | 全ツールの外側の入力が `additionalProperties:false`。form の創造に関わる項目はすべて `type: string` で、列挙に絞っていない。列挙値は原典の候補の軸・stage・target・kind だけである。場面・演出を操作するツールは無い。`project_patch` は契約どおりの汎用 Merge Patch である。`tools/list` は、スナップショット（outputSchema を含む）とも、`toolDefinitions` とも一致する（テストで確認） |
| 5 結果（PH-03・MC-07・CL-06・M-1） | `isError` は `!envelope.ok` だけから決まる。QC の fail は `ok:true`・`isError:false`。MV は `not_applicable`。advisories は封筒の外の判定に関わらない。`job_status`・`direction_candidates` の最上位に、合否・スコア・順位は無い。候補の説明文・結果の message・サーバーの instructions に「たたき台であり固定の正解ではない」がある。seed を省くと毎回変わる（TS-06）。既定のクライアントは、エラーを含む全応答の structuredContent を outputSchema で検査するが、probe で検査の失敗は0件だった |
| 6 run の待ち方（MC-12〜MC-15） | `wait_ms` は整数0〜50,000。既定は validate（final なし）・qc・sound が 45,000、それ以外が0、run_get が0。`log_tail` は0〜2,000（既定100）で、`log_offset` は受け付けない。サーバーを再起動しても、別の接続から run を参照できる（MC-13）。進捗は観測だけで、結果・排他を変えない。クライアントの要求キャンセルを run_cancel の代わりにしない |
| 7 テスト | 新しい試験は、公式 SDK のクライアントから別プロセスの stdio サーバーを起動している。各呼び出しで、text と structuredContent が一致すること、`isError` と `ok` が対応することを確かめている。新しい試験・helper・tools は git を起動しない（`git` の検索で該当なし）。Tier B の記録は REPORT にある（CI 化は M-2） |
| 8 依存 | `@modelcontextprotocol/sdk` は `1.32.2` に完全に固定し、推移依存は lock の integrity で固定している。SDK の閉包は95配置で、MIT 85・ISC 7・BSD-3-Clause 2・BSD-2-Clause 1。GPL 系の追加は無い（lock の本番依存の `license` を調べ、標準外は M1 からある jszip・pako だけ）。NOTICE と `dependency-licenses.json` に記録があり、`tools/audit-mcp-licenses.mjs` で照合できる |
