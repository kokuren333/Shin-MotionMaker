# M2aR 交差レビュー — host（パス検査・run・排他の安全）

- 作業 ID: `M2aR`。レビュー担当は実装者（Codex）とは別製品・別コンテキストの Opus。コードは変更していない。
- 対象: ブランチ `m2a-host` の `git diff main...m2a-host`（`686d78e`・`c7da8bb`・`21787f8`）。REQUIREMENTS §3.1・§4・§5・§6.3 JT-12・§9.2 TS-07・§14、CONTRACT M0b、`docs/work/M2a/REPORT.md` と照合した。
- 環境: Windows 11、Node v24.15.0。Linux では実行していない。

## 結論

**条件付き承認（必須修正あり）**

層の分け方、操作定義表、argv のひな形、シェルを介さない起動、`wx` による排他、事前検査で失敗したとき run を作らないこと（R-3）、report の鮮度確認、助言と合否の分離は、契約どおりに実装されている。テストも実際の経路を通している。ただし、次の2点は MCP の安全境界と利用者のプロセスに実害が出るため、受け入れの前に直す必要がある。

1. 絶対パスの添付が allow-dir の確認より先にファイルシステムへ渡る。UNC を指定すると SMB 接続が起こり、拒否も `E_PATH_DENIED` ではなく `E_INTERNAL` で返る（M-1）。
2. PID の再利用を考えていない。`run_cancel`（host 自身の hint がこれを勧める）が無関係なプロセスツリーを強制終了する。逆にジョブが恒久的に `E_BUSY` のまま戻らない場合もある（M-2）。

加えて、M2a の受け入れ条件「TS-07 が ubuntu と windows で合格」の ubuntu 側の証拠がまだ無い（M-3）。

## 実行した確認

| 確認 | 結果 |
| --- | --- |
| `npm test`（作業ツリー、既存の node_modules） | tests 154、pass 145、fail 0、cancelled 0、skipped 0、todo 9。終了0。REPORT の値と一致。実行後の作業ツリーはクリーン |
| `node tools/ci-local.mjs` | 実行していない（REPORT に実装者の実行記録がある） |
| 一時フォルダでの試行 | 作業ツリーの外の `_smm_scratch/m2ar/` に下記の probe を置き、`node --experimental-strip-types <probe> <worktree>/src/host/index.ts` で host を直接呼んだ。probe は repo に入れていない |

## 指摘

### 必須

#### M-1 絶対パスの添付が allow-dir の確認より先に実体解決される（UNC で外部へ接続し、拒否コードも誤る）

- 場所: `src/host/paths.ts:35-46`（`resolveAllowedPath`）。L39 の `physicalPath(target)` が L43〜45 の allowDirs の判定より先に実行される。
- 根拠: MC-02 と CONTRACT §3 は、root の外を `E_PATH_DENIED` で拒否することを求めている。`restrictToRoot: true` で `--allow-dir` を指定していなくても、`request.assets` の絶対パスは `fs.realpath` に渡る。Windows で UNC に対して realpath を実行すると、SMB 接続（NTLM 認証の送信を含む）が起こる。request は MCP クライアント、つまり制作エージェントが組み立てる。Web 調査を許可したジョブでは、取り込んだ外部の文章による誘導の経路にもなる。
- 再現（`probe-unc.mjs`。`restrictToRoot:true`、`allowDirs:[]` で `resolveAllowedPath(ctx, p, "attachment")`）:

  ```
  "C:/Windows/win.ini"            E_PATH_DENIED 20 ms
  "//192.0.2.1/share/x.png"       UNKNOWN 21160 ms   ← TEST-NET への SMB 接続を約21秒待つ
  "\\\\192.0.2.1\\share\\x.png"   UNKNOWN 8 ms
  "//./pipe/nonexistent-smm"      EINVAL 77 ms       ← デバイス名前空間を開こうとする
  ```

  `execute` を通すと、`normalizeError` によって `E_INTERNAL`（details.reason: "UNKNOWN"）になる。
- 直し方:
  1. `restrictToRoot` で絶対パスの添付を受けたら、ファイルシステムに触れる前に文字列として検査する。`path.resolve` で正規化したパスが、どれかの allowDir（同じく正規化したもの。win32 は大文字小文字を区別しない）の配下であることを確かめる。
  2. `\\?\`・`\\.\`・UNC（`//`・`\\` で始まるもの）は、その形の allowDir が明示されていない限り拒否する。
  3. 文字列検査を通った後にだけ realpath で実体を検査する。安全検査の途中で出たファイルシステムのエラーは、`E_PATH_DENIED` に正規化する（ENOENT だけは「添付が無い」として扱ってよい）。
  4. テスト: UNC とデバイスパスが、`allowDirs:[]` の場合も、無関係な allowDir を指定した場合も、すぐに `E_PATH_DENIED` になること。

#### M-2 PID の再利用で無関係なプロセスツリーを強制終了する。または run が恒久的に止まる

- 場所: `src/host/locks.ts:9-13`（`processExists`）、`src/host/worker.ts:13-29`（`stopProcessTree`）、`src/host/runs.ts:142-148`（`lost` の取り消し）、`src/host/runs.ts:149-153`、`src/host/locks.ts:70`（`run_cancel` を勧める hint）、`src/host/runs.ts:25`（`lost` の導出）。
- 根拠: 生存確認も停止も、PID の数値だけを見ている。Windows は PID をすぐに再利用する。再起動の後や長い run の後には、記録した `pid`・`script_pid` が別のプロセスのものになっていることが普通に起こる。MC-14 は「プロセスツリーごと止める」ことを求めているが、止めるべきでないプロセスを `/T /F` で止めるのは実害である。CONTRACT §6 の「生存確認が権限不足なら不在と断定しない」は保守的に倒す規定であって、別のプロセスを殺してよいという意味ではない。
- 再現1（`probe-pid.mjs`）: `status:"running"`、`pid` は存在しない番号、`script_pid` は無関係の `node -e setInterval`、heartbeat は古い、という run.json と write.lock を置いた。

  ```
  next write op: {"code":"E_BUSY","message":"実行中または起動直後の run が残っています。","hint":"run の状態を確認し、必要なら run_cancel で停止してください。", ...}
  victim alive before cancel: true
  cancel: true lost
  victim alive after cancel: false      ← 無関係のプロセスが taskkill /T /F で止まる
  ```

- 再現2（`probe-pid2.mjs`）: `pid` に無関係の生きているプロセスを入れ、heartbeat は2週間前にした。

  ```
  next write op: E_BUSY「別の書き込み操作が実行中です。」
  cancel: false  {"code":"E_INTERNAL","message":"取り消しの完了を確認できませんでした。", ...}
  status after cancel: running  lock file still present: true
  ```

  heartbeat がどれだけ古くても `lost` にならず、`run_cancel` でも回収できない。ジョブは、利用者が `.smm/write.lock` を手で消すまで書き込めない。hint にもその方法が書かれていない。
- 直し方:
  1. pid ごとにプロセスの同一性を記録する。記録するのは起動時刻、または worker なら argv に run ID を含むこと、script ならスクリプトのパス。生存判定と停止の前に照合する。Windows は `Win32_Process` の `CreationDate`・`CommandLine` を配列引数の PowerShell か WMI で取る方法がある。または worker が Job Object を持ち、そのハンドル経由で止める方法もある。Linux は `/proc/<pid>/stat` の starttime と `/proc/<pid>/cmdline` を使える。
  2. 同一性が一致しなければ「不在」として扱う。heartbeat が十分古く、記録したプロセスと同一でなければ `lost` にする。
  3. 同一性を確認できない pid には、`taskkill`・`kill(-pid)` を送らない。
  4. TS-07 に「PID が別プロセスに再利用された」場合のテストを足す。上の2つの probe をそのままテストにできる。

#### M-3 TS-07・MC-02・CL-11 の ubuntu の証拠が無い（受け入れ条件）

- REQUIREMENTS §11.2 の M2a の受け入れ条件は「TS-07 が ubuntu と windows で合格」である。REPORT の残課題にあるとおり、POSIX の処理（`process.kill(-pid)`、`detached` のプロセスグループ、symlink）は一度も実行されていない。コードの修正ではないが、PR CI の ubuntu（Node 24・22）で host のテストが通った証拠を揃えてから受け入れること。下の R-6 も ubuntu で確かめること。

### 推奨

#### R-1 ハードリンクは realpath を通り抜け、`report_get` が root の外の内容を返す

- 場所: `src/host/paths.ts:50-55`（`jobFile`）、`src/host/report.ts:18-38`。
- 再現（`probe-link.mjs`）: root の外に置いた `outside/secret.txt` へのハードリンクを、`job/reports/leak.txt` として作った（NTFS は管理者権限なしで作れる）。`report_get` は `ok:true`、`text:"OUTSIDE-SECRET"` を返した。
- 評価: 作るには root 内への書き込み権限が要る。ジョブ内スクリプトの実行はもともと `npm run` と同じ信頼の範囲（MC-03）なので、昇格の幅は小さい。ただし発注の観点に挙がっており、MCP の道具だけを持つクライアントの境界を守る意味はある。
- 直し方: MCP（`restrictToRoot`）で読む通常ファイルについて、`fstat` の `nlink > 1` を拒否する。対象は `report_get` と、root 内の相対パスで指定した添付。拒否しない場合は、残るリスクとして `docs/MCP.md` に書く。

#### R-2 検査と使用の間の差し替え（TOCTOU）

- 場所: `resolveAllowedPath` と `jobFile` は、実体を検査した後に論理パスを返す（`paths.ts:48`・`:54`）。呼び出し側はそのパスで開き直す（`report.ts:27`、`io.ts:69`・`:117-119`、`project.ts:47`）。`resolveJob` で決めたジョブのパスも、それ以降は root と照合し直さない。`jobFile` はジョブの実体と比べるだけである。
- 評価: 突くには、root 内への書き込みと時間を合わせた差し替えが要る。CONTRACT §3 は「読取・書込直前にも実体を確認する」と求めている。直前の確認はしているが、確認と open の間はまだ残る。
- 直し方（読み取り）: 開いた後に `handle.stat()` の `dev`/`ino` と、`fs.realpath` した先の `stat` が一致することを確かめる。書き込み: 確認済みの親ディレクトリの直下に作り、作った後に親の実体をもう一度照合する。残るリスクを `docs/MCP.md` に書く。

#### R-3 終端状態の逆戻りと、ロックの早すぎる解放の競合

- 場所: `src/host/runs.ts:149-153`、`src/host/worker.ts:42`・`:52-60`、`src/host/locks.ts:89-95`。
- 筋道: worker が最初の `save()` を終えるまで、run.json の `pid` は起動元（CLI や MCP サーバー）の pid のままである。その間に起動元が終わると（CLI の Ctrl-C など）、次のことが順に起こりうる。
  1. `cancelRun` は `!processExists(run.pid)` を真と判断し、`cancelled` を書く。
  2. 続けて `releaseOwnedLock` が、owner だけを見てロックを消す。この時点で worker はロックを移し終えている。
  3. その後に worker の `save()` が `running` を上書きする。これは終端状態からの逆戻りである。
  4. script がまだ動いているのにロックが無いので、2本目の書き込みの run が始められる。

  worker は保存の前に run.json を読み直さないので、外から書かれた終端状態（`cancelled`、ロック回収時の `lost`）を上書きしうる。`acquireJobLock` 側には heartbeat が15秒より新しいときの猶予があるが、`cancelRun` には無い。
- 直し方:
  1. `cancelRun` の「worker が不在」の分岐にも、ロック回収と同じ heartbeat の猶予を入れる（15秒未満なら cancel ファイルを置いて待つ）。
  2. worker は保存の前に run.json を読み、終端状態なら上書きしない。または compare-and-swap の印（revision）を持たせる。
  3. `releaseOwnedLock` は owner に加えて token も照合する。

#### R-4 MCP の `run_get` のログ末尾に絶対パスが残る

- 場所: `src/host/runs.ts:129-133`（`displayLog`）、`src/host/worker.ts:77`（host のスタックトレースを stderr.log へ書く）。
- 再現（`probe-log.mjs`）: スクリプトが例外で終わると、`stderr_tail` に `file:///<利用者のフォルダ>/…/root-log%20%E7%A9%BA%E7%99%BD/job%20%E5%85%A8%E8%A7%92/runtime/scripts/qc.mjs:1` が出た。host のスタック `file:///<host の導入先>/src/host/errors.ts:4:24` も出た。置換はパーセント符号化した file URL を扱わず、host の導入先パスも対象にしていない。
- 根拠: CONTRACT §3「Context の絶対パスを MCP 出力へ流さない」。利用者名がそのまま出る。
- 直し方: 置換の対象に `pathToFileURL(job/root).href` と、その realpath の形を加える。worker が stderr.log に書くのは `code`・`message`・`reason` だけにし、スタックは CLI のときだけ書くなど条件を付ける。

#### R-5 `lost` と時間切れのテストが本物の経路を一部飛ばしている

- `tests/host-run.test.ts:81-102` の `lost` は、作った run.json を読んで導出を確かめているだけである。worker を実際に止めて、heartbeat が途絶えてから15秒後に `lost` になること、`run_cancel` でロックが解放されること、次の run を始められることは確かめていない。
- 時間切れ（`:50-66`）は `runWorker` を試験用の `limit` で直接起動しており、`startRun` と `runTimeout` の経路を通らない。
- 直し方: E2E を1件足す。worker の PID に `taskkill /F`（POSIX は `kill -9`）を送り、script も止まっている場合といない場合の両方で `lost` → 回収 → 新しい run までを確かめる。M-2 のテストと合わせてよい。

#### R-6 POSIX の停止が、独自のプロセスグループを作った子孫を取りこぼす（未実測）

- 場所: `src/host/worker.ts:23-26`。script のプロセスグループに SIGKILL を1回送るだけである。
- 懸念: Linux の Puppeteer など、子孫が `detached`（setsid）で起動したものは別のグループになって残る。SIGKILL では、それらの終了処理も走らない。Windows の `taskkill /T` は親子関係をたどるので、この問題は起きない。
- 直し方: SIGTERM を送り、猶予を置いてから SIGKILL を送る。ubuntu CI に「孫が `detached: true` で起動する」フィクスチャを足し、取り消しの後に孫が残らないことを確かめる（M-3 と合わせる）。

#### R-7 setup の npm 本体の解決が環境に引きずられる

- 場所: `src/host/tools.ts:20-32`（`npmEntry`）。
- 懸念:
  1. `npm_execpath` を名前で確かめていない。yarn などから起動すると `yarn.js ci` になり、契約の「npm の JavaScript entry」と違うものを起動する。
  2. PATH の空要素や相対要素に `path.join` すると、`node_modules/npm/bin/npm-cli.js` が作業フォルダからの相対パスになり、意図しないファイルを起動しうる。
- 直し方: 候補のファイル名が `npm-cli.js` であることを要求する。PATH の要素は絶対パスのものだけを使う。

### 参考

- **P-1** `--allow-dir` に無いフォルダを指定すると、root 内の存在する添付についても「添付ファイルが見つかりません」（`E_INPUT_INVALID`）になる（`probe-link.mjs` の3件目）。`paths.ts:44` の `fs.realpath(directory)` の ENOENT が、`io.ts:72` で添付が無いことと取り違えられている。M3 の起動時に allow-dir を検査するか、別のコードにする。
- **P-2** `assertRelative` の Windows 固有の禁止（`?`・`<>`・末尾の空白やドット・予約名）が、すべての OS と `jobFile` に掛かっている。ubuntu では `sources/a?.png` などの添付を持つ生成が `E_PATH_DENIED` になり、GUI の ZIP と食い違う（AR-06）。QC の `inputs` にそのようなキーがあると、`job_status` 全体が失敗する（`status.ts:41-43`）。stale の判定では、検査できないキーを例外にせず `stale:true` とするのが安全である。
- **P-3** heartbeat の保存に失敗すると `cancelled` として終わる（`worker.ts:61`）。停止そのものに失敗すると、`timed_out` ではなく `failed` になる（`worker.ts:65`・`:76`）。利用者の取り消しと区別できるよう、`failed` に `details.reason` を付けるとよい。
- **P-4** `dispatch` の run 開始で、`startRun` の後の `getRun` が例外になると（`operations.ts:85-87`）、run を付けない `ok:false` が返る。その間も run はロックを持ったまま動き続ける。エラーに `run` を付けて返すとよい。
- **P-5** `voice` は `engine_url` の許可を、ロックを取る前の事前検査でだけ確かめる（`run-options.ts:68-72`）。スクリプトは後で project.json を読み直す。影響は小さいが、許可の判定をロックを取った後に置くと隙間が縮む。
- **P-6** doctor で URL が不正なとき、メッセージが「未許可の接続先のため未確認です。」になる（`tools.ts:117-119`）。
- **P-7** `status.runs` は全件を返す（§5.4 は「実行中と直近」）。台帳が増えると応答が大きくなる。
- **P-8** 破損した `write.lock`・残った `reclaim.lock` を自動で消さないのは妥当な保守的判断である。ただし hint に、消してよい条件と対象（`.smm/write.lock` などのジョブ相対パス）を書くと、利用者が回復できる。
- **P-9** 鮮度の判定は mtime と `started_at` の比較である。mtime の粒度が粗いファイルシステム（FAT 系・一部のネットワークドライブ）では、新しい report が古いと判定されうる。

## 観点ごとの確認結果（問題なしと判断したもの）

| 観点 | 確認したこと |
| --- | --- |
| 1 パス | 相対パスの `..`・ドライブ・`:`（ADS）・UNC・バックスラッシュ・末尾のドットや空白・予約名を `assertRelative` が拒否する。junction は realpath で解決し、外を拒否する（テストあり）。win32 の `path.relative` は大文字小文字を区別しない。8.3 の短縮名は realpath が長い名前に直す。リンク切れの junction は lstat で拒否する。allowDirs は添付の読み取りだけに効き、`out`・`job`・report には効かない。`report_get` の許可リストは MC-09・CONTRACT と一致し、256 KiB の切り詰めは文字の境界で行い、PNG は 8 MiB まで |
| 2 子プロセス | host の起動はすべて `shell:false` で、配列引数で渡す。worker・script・taskkill（System32 の絶対パス）・npm（`npm-cli.js` を node から）・probe が該当する。argv は CONTRACT §4 のひな形どおりで、任意の引数を足す口が無い。入力スキーマは `additionalProperties:false`。ghost の `=` を拒否する。imagegen の値は `parseArgs` が次の要素として受け取るので、オプション注入は起きない。プロンプトは stdin で渡す。win32 では `%`・`"`・CR/LF の事前拒否をジョブの実パスと refs に掛ける（imagegen.mjs のシェル引数に入るのはこの2つだけ） |
| 3 run の生存期間 | worker を切り離して起動し、起動元は ack を確かめる。heartbeat は5秒。`lost` は15秒以上古く、かつ worker が不在のとき。read-only では書き戻さない。Windows の取り消しで子孫が消え、その後にロックを取れる（テスト）。run.json は一時ファイルと rename で書き、Windows の EPERM は再試行する。終端状態への遷移は worker が script を止めてロックを解放した後（R-3 の窓を除く） |
| 4 排他 | `wx` で原子的に予約する。回収はガードで直列化し、token を照合する。所有者を確かめられないロックは消さない。事前検査は予約の前にあり、`E_BUSY`・`E_DISABLED`・`E_DEPS_MISSING` では台帳を作らない（テスト）。6本を並列に起動すると1本だけ始まる（テスト） |
| 5 結果の組み立て | 助言は `resultAdvisories` だけから作り、`ok`・`verdict`・`exit_code` に関わらない。QC の fail は `ok:true` で1。MV の QC は `not_applicable` で0。ghost は verdict を作らず、終了コードと skipped が食い違えば `E_INTERNAL`。report は `started_at` 以降の mtime のものだけ採用する。0.4 の validate は完了文と終了コードから組み立て、例外のスタックを含むものは `E_INTERNAL` |
| 6 project の書き込み | `expect_sha256` は実バイトと照合する。`schema_version`・`mode`・`generator` が変わらないこと、結果がオブジェクトであることだけを見る。`.smm/` の一時ファイルから rename し、ジョブの排他を取る。場面の内容は検査しない（F5）。Merge Patch は null プロトタイプで組むので、`__proto__` による汚染が無い |
| 7 状態の導出 | 毎回ファイルから導出し、写しや DB を持たない。状態全体の合否・スコア・順位の項目が無い。ghost の項目に verdict を置かない。`hints` は project_get の助言1件で、工程を強制しない |
| 8 テスト | TS-07 の完了・不合格・異常終了・QC の矛盾・取り消し・`E_BUSY` は、偽のスクリプトを本物の `startRun`→worker→`collectRunResult` に通している（`lost`・時間切れの不足は R-5）。host のテストと fixture は git を起動しない（`git-detector` の検査は npm test で合格） |
