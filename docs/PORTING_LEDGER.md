# M1 移植台帳

原典は BiimMotion `262c798`。原典の表明を変更した箇所だけを P1〜P4 で記録する。機械可読の全件対応は `tests/fixtures/porting-ledger.json`。許容差分本文は `tests/fixtures/baseline-biimmotion-262c798/allowed-diffs.json`。受け入れ判定は L2 と交差レビューが行う。

## 表明・参照の変更

| 原典の位置 | 移植後 | 種別 |
| --- | --- | --- |
| job.test.ts L19 | import を src/core/index.ts へ | P1 |
| job.test.ts L26 | import を src/core/assist/mv-assist.ts へ | P1 |
| job.test.ts L55 | フォント参照を job-assets/fonts へ | P1 |
| job.test.ts L370 | フォント参照を job-assets/fonts へ | P1 |
| ghost.test.ts L19 | import を src/core/index.ts へ | P1 |
| qc.test.ts L9 | import を src/core/index.ts へ | P1 |
| qc.test.ts L169 | 定義参照を src/core/data/biim-standard.json へ | P1 |
| harness-docs.test.ts L12 | import を src/core/index.ts へ | P1 |
| harness-docs.test.ts L36 | フォント参照を job-assets/fonts へ | P1 |
| explainer.test.ts L19 | import を src/core/assist/explainer-assist.ts へ | P1 |
| explainer.test.ts L24 | import を src/core/index.ts へ | P1 |
| explainer.test.ts L130 | フォント参照を job-assets/fonts へ | P1 |
| explainer.test.ts L173 | schema_version の期待値を 0.5 へ（R2） | P2 |
| explainer.test.ts L209–252 | 履歴ソースの実行を廃止し、baseline.test.ts の MV フォーム照合と golden 2ケースの全本文照合へ置換。schema_version と generator の R2 だけ正規化 | P3 |
| generate-job.test.ts L16–65 | Vite・旧 CLI の起動とフォルダ読取を、引数注入したテンプレート・core の buildJobFiles と ZIP の比較へ。独立した host とブラウザのテンプレート読み込みとの比較は M2a に移送（専用 TODO） | P4 |
| generate-job.test.ts L68–140（モード5件） | パス指定の添付をテスト用 loadAssets で読み、mimeTypeFor による .PDF・.glb・.WAV・.unknown の MIME・サイズ・本文を期待値と照合する。読み込んだ添付を core へ渡し ZIP 往復の各本文・フォントを照合する。独立したテンプレート読み込みとの比較は M2a に移送。cwd・BOM・終了コード・生成先・再実行のユーザー編集保持は9件の TODO の該当5件に移送 | P4 |
| generate-job.test.ts L142–153 | 最小入力・assets 省略・既定値・全本文一致を core で実行。CLI 起動・出力先は M2b へ移送 | P4 |
| generate-job.test.ts L155–186 | 未知キー（ネスト・__proto__含む）・型・既存 validateForm の拒否を構造化エラーで検査。shape エラーは契約のコード・日本語 hint とケースごとの details.pointer 集合を表明し、validateForm エラーは details を原典の正規表現で表明する。壊れた JSON・添付不在・書込前拒否・終了コードは M2b へ移送 | P4 |
| generate-job.test.ts L188–206 | 既存の空ディレクトリ・ファイル・兄弟ファイル保護を M2b TODO へ移送 | P4 |
| generate-job.test.ts L208–218 | Usage・help・引数検査・終了コードを M2b TODO へ移送。契約では入力エラー2となるため実装時に期待値を変更 | P4 |

## ビルド対象

原典の tsconfig は src だけを対象としていた。表明を編集せず実行するため、移植した7ファイルは元と同じく型検査対象から明示除外し、Node の型除去で実行する。core と新規テスト・ヘルパーは strict 型検査の対象。補助ツール make-fixture.ts は import・フォントパスのみ移した。

## 基線の全テスト名との対応（TS-01）

81件すべてを以下に対応づける。CLI 9件中7件の core 部分を実行し、CLI 固有部分9件を M2b へ、独立したテンプレート読み込みとの比較1件を M2a に移送する。2件は全体を移送（既存出力先、usage）。したがって M1 の比較母数は79件（81−全体移送2）。

| 原典ファイル | 原典テスト名 | 移植先ファイル・テスト名 | 種別 |
| --- | --- | --- | --- |
| tests/explainer.test.ts | explainer directions have six varied axes and deterministic candidates differing on every active axis | tests/explainer.test.ts: explainer directions have six varied axes and deterministic candidates differing on every active axis | P1 |
| tests/explainer.test.ts | character roles switch with solo, duo and no-character contexts; portrait excludes biim and mixed | tests/explainer.test.ts: character roles switch with solo, duo and no-character contexts; portrait excludes biim and mixed | P1 |
| tests/explainer.test.ts | 400 seeds give each style mode at least 15 percent of all candidates | tests/explainer.test.ts: 400 seeds give each style mode at least 15 percent of all candidates | P1 |
| tests/explainer.test.ts | script stats count characters, speech estimate, headings, blocks, sentences and evidence hints | tests/explainer.test.ts: script stats count characters, speech estimate, headings, blocks, sentences and evidence hints | P1 |
| tests/explainer.test.ts | script stats share caption geometry, halfwidth handling and explicit line fit with the runtime | tests/explainer.test.ts: script stats share caption geometry, halfwidth handling and explicit line fit with the runtime | P1 |
| tests/explainer.test.ts | all 23 shared failure descriptions also exist in the imported T3 agent harness | tests/explainer.test.ts: all 23 shared failure descriptions also exist in the imported T3 agent harness | P1 |
| tests/explainer.test.ts | explainer style switches change only unedited defaults and preserve mode-specific inputs | tests/explainer.test.ts: explainer style switches change only unedited defaults and preserve mode-specific inputs | P1 |
| tests/explainer.test.ts | style validation keeps optional fields optional and rejects incompatible mixed settings | tests/explainer.test.ts: style validation keeps optional fields optional and rejects incompatible mixed settings | P1 |
| tests/explainer.test.ts | explainer ZIPs carry goals, exact outline, independent differentiation, style and full production guidance | tests/explainer.test.ts: explainer ZIPs carry goals, exact outline, independent differentiation, style and full production guidance | P1・P2 |
| tests/explainer.test.ts | MV form settings, prompt, brief, project and lyrics remain byte-identical to 955fa5c except schema version | tests/baseline.test.ts: MV form settings, prompt, brief, project and lyrics match the captured baseline without history / tests/baseline.test.ts: JT-11 golden paths and bytes: mv-landscape / tests/baseline.test.ts: JT-11 golden paths and bytes: mv-portrait-options | P1・P2・P3 |
| tests/generate-job.test.ts | generate-job CLI matches the WebUI ZIP file paths and bytes for biim | tests/generate-job.test.ts: generate-job core matches ZIP file paths and bytes for biim / tests/generate-job.test.ts: M2b: generate-job CLI matches the WebUI ZIP file paths and bytes for biim; BOM, cwd, exclusive rerun / tests/generate-job.test.ts: M2a: generate-job compares independent host template loading with the browser template paths and bytes | P1・P4 |
| tests/generate-job.test.ts | generate-job CLI matches the WebUI ZIP file paths and bytes for anime | tests/generate-job.test.ts: generate-job core matches ZIP file paths and bytes for anime / tests/generate-job.test.ts: M2b: generate-job CLI matches the WebUI ZIP file paths and bytes for anime; cwd, exclusive rerun / tests/generate-job.test.ts: M2a: generate-job compares independent host template loading with the browser template paths and bytes | P1・P4 |
| tests/generate-job.test.ts | generate-job CLI matches the WebUI ZIP file paths and bytes for motion | tests/generate-job.test.ts: generate-job core matches ZIP file paths and bytes for motion / tests/generate-job.test.ts: M2b: generate-job CLI matches the WebUI ZIP file paths and bytes for motion; cwd, exclusive rerun / tests/generate-job.test.ts: M2a: generate-job compares independent host template loading with the browser template paths and bytes | P1・P4 |
| tests/generate-job.test.ts | generate-job CLI matches the WebUI ZIP file paths and bytes for mixed | tests/generate-job.test.ts: generate-job core matches ZIP file paths and bytes for mixed / tests/generate-job.test.ts: M2b: generate-job CLI matches the WebUI ZIP file paths and bytes for mixed; cwd, exclusive rerun / tests/generate-job.test.ts: M2a: generate-job compares independent host template loading with the browser template paths and bytes | P1・P4 |
| tests/generate-job.test.ts | generate-job CLI matches the WebUI ZIP file paths and bytes for mv | tests/generate-job.test.ts: generate-job core matches ZIP file paths and bytes for mv / tests/generate-job.test.ts: M2b: generate-job CLI matches the WebUI ZIP file paths and bytes for mv; cwd, exclusive rerun / tests/generate-job.test.ts: M2a: generate-job compares independent host template loading with the browser template paths and bytes | P1・P4 |
| tests/generate-job.test.ts | generate-job accepts a minimal form and omitted assets using defaults | tests/generate-job.test.ts: generate-job core accepts a minimal form and omitted assets using defaults / tests/generate-job.test.ts: M2b: generate-job accepts a minimal form and omitted assets using defaults; CLI launch and output | P1・P4 |
| tests/generate-job.test.ts | generate-job rejects invalid JSON, unknown keys, invalid types and validation errors before writing | tests/generate-job.test.ts: generate-job core rejects unknown keys, invalid types and validation errors / tests/generate-job.test.ts: M2b: generate-job rejects invalid JSON, unknown keys, invalid types and validation errors before writing; missing attachment, exit code and no output | P1・P4 |
| tests/generate-job.test.ts | generate-job rejects existing empty directories and files without changing siblings | tests/generate-job.test.ts: M2b: generate-job rejects existing empty directories and files without changing siblings | P1・P4 |
| tests/generate-job.test.ts | generate-job reports usage and exits 1 for missing, duplicate or unsupported arguments | tests/generate-job.test.ts: M2b: generate-job reports usage and exits 1 for missing, duplicate or unsupported arguments; use contract exit codes | P1・P4 |
| tests/ghost.test.ts | tile signatures average each tile region | tests/ghost.test.ts: tile signatures average each tile region | P1 |
| tests/ghost.test.ts | double-render comparison flags only the frames that differ | tests/ghost.test.ts: double-render comparison flags only the frames that differ | P1 |
| tests/ghost.test.ts | single-frame detection catches a one-frame appearance | tests/ghost.test.ts: single-frame detection catches a one-frame appearance | P1 |
| tests/ghost.test.ts | single-frame detection ignores cuts, sustained and held content | tests/ghost.test.ts: single-frame detection ignores cuts, sustained and held content | P1 |
| tests/ghost.test.ts | templates keep text layers on their own compositing layer by default | tests/ghost.test.ts: templates keep text layers on their own compositing layer by default | P1 |
| tests/ghost.test.ts | validate wires the ghost scan as an advisory, not a failure | tests/ghost.test.ts: validate wires the ghost scan as an advisory, not a failure | P1 |
| tests/ghost.test.ts | flash classification separates isolated ghosts from clustered runs | tests/ghost.test.ts: flash classification separates isolated ghosts from clustered runs | P1 |
| tests/ghost.test.ts | ghost report stems keep the historic final name and suffix others | tests/ghost.test.ts: ghost report stems keep the historic final name and suffix others | P1 |
| tests/ghost.test.ts | machine summary and still selection prioritise isolated flashes | tests/ghost.test.ts: machine summary and still selection prioritise isolated flashes | P1 |
| tests/ghost.test.ts | WebUI parses ghost-check JSON and rejects other files | tests/ghost.test.ts: WebUI parses ghost-check JSON and rejects other files | P1 |
| tests/harness-docs.test.ts | job AGENTS.md opens with the HN-14 guard and the per-mode reading guide | tests/harness-docs.test.ts: job AGENTS.md opens with the HN-14 guard and the per-mode reading guide | P1 |
| tests/harness-docs.test.ts | explainer chapter mirrors the MV chapter: principles, translation, directions, style, steps, QC, checklist | tests/harness-docs.test.ts: explainer chapter mirrors the MV chapter: principles, translation, directions, style, steps, QC, checklist | P1 |
| tests/harness-docs.test.ts | style-mode section covers the four modes, Biim as optional default, mixed segments and non-Biim parts | tests/harness-docs.test.ts: style-mode section covers the four modes, Biim as optional default, mixed segments and non-Biim parts | P1 |
| tests/harness-docs.test.ts | render-ghost chapter is shared by both modes and also covers explainer captions | tests/harness-docs.test.ts: render-ghost chapter is shared by both modes and also covers explainer captions | P1 |
| tests/harness-docs.test.ts | record templates live only under plan/templates and are usable examples | tests/harness-docs.test.ts: record templates live only under plan/templates and are usable examples | P1 |
| tests/harness-docs.test.ts | generated ZIPs (MV and explainer) carry no files at validate/qc-checked paths outside plan/templates | tests/harness-docs.test.ts: generated ZIPs (MV and explainer) carry no files at validate/qc-checked paths outside plan/templates | P1 |
| tests/harness-docs.test.ts | job README documents explainer production symmetric to MV: records, QC commands, gate meaning | tests/harness-docs.test.ts: job README documents explainer production symmetric to MV: records, QC commands, gate meaning | P1 |
| tests/imagegen.test.ts | imagegen parses options and builds a style-aware prompt without lyrics in images | tests/imagegen.test.ts: imagegen parses options and builds a style-aware prompt without lyrics in images | 変更なし |
| tests/imagegen.test.ts | imagegen saves a PNG through Codex, versions names and records the manifest | tests/imagegen.test.ts: imagegen saves a PNG through Codex, versions names and records the manifest | 変更なし |
| tests/imagegen.test.ts | imagegen continues without an asset when Codex is missing or fails | tests/imagegen.test.ts: imagegen continues without an asset when Codex is missing or fails | 変更なし |
| tests/job.test.ts | project is a creative brief with empty scenes and audio creation policy | tests/job.test.ts: project is a creative brief with empty scenes and audio creation policy | P1 |
| tests/job.test.ts | MV mode preserves shared inputs and restores each mode's design and instructions | tests/job.test.ts: MV mode preserves shared inputs and restores each mode's design and instructions | P1 |
| tests/job.test.ts | MV ZIP includes the exact completed audio and enforces full-screen, no synthesis, no extra audio | tests/job.test.ts: MV ZIP includes the exact completed audio and enforces full-screen, no synthesis, no extra audio | P1 |
| tests/job.test.ts | required values, unsafe URLs, invalid numeric values and asset limits are rejected | tests/job.test.ts: required values, unsafe URLs, invalid numeric values and asset limits are rejected | P1 |
| tests/job.test.ts | filenames remain portable, traversal-free and unique even with normalized names | tests/job.test.ts: filenames remain portable, traversal-free and unique even with normalized names | P1 |
| tests/job.test.ts | ZIP includes the runtime, exact attachment bytes, Japanese brief, and audio instructions | tests/job.test.ts: ZIP includes the runtime, exact attachment bytes, Japanese brief, and audio instructions | P1 |
| tests/job.test.ts | generation enforces validation and rejects unsafe template paths | tests/job.test.ts: generation enforces validation and rejects unsafe template paths | P1 |
| tests/job.test.ts | procedural BGM and SE are deterministic, finite WAVs with bounded peaks | tests/job.test.ts: procedural BGM and SE are deterministic, finite WAVs with bounded peaks | P1 |
| tests/job.test.ts | solo and duo profiles preserve names, roles, custom colors and independent voices | tests/job.test.ts: solo and duo profiles preserve names, roles, custom colors and independent voices | P1 |
| tests/job.test.ts | fullscreen and portrait enforce no Biim frame and keep both characters outside captions | tests/job.test.ts: fullscreen and portrait enforce no Biim frame and keep both characters outside captions | P1 |
| tests/job.test.ts | Biim subtitles and their SVG border move with character positions | tests/job.test.ts: Biim subtitles and their SVG border move with character positions | P1 |
| tests/job.test.ts | duo ZIP packages two separate GLBs; solo omits the inactive second model and its limits | tests/job.test.ts: duo ZIP packages two separate GLBs; solo omits the inactive second model and its limits | P1 |
| tests/job.test.ts | MV direction candidates differ on every axis and change with the seed | tests/job.test.ts: MV direction candidates differ on every axis and change with the seed | P1 |
| tests/job.test.ts | lyric stats count lines, section tags, blocks and long lines | tests/job.test.ts: lyric stats count lines, section tags, blocks and long lines | P1 |
| tests/job.test.ts | MV brief and AGENTS carry design-first principles, diversity steps and asset policy | tests/job.test.ts: MV brief and AGENTS carry design-first principles, diversity steps and asset policy | P1 |
| tests/job.test.ts | non-Biim parts retain fullscreen captions, actor freedom and clear diagram space | tests/job.test.ts: non-Biim parts retain fullscreen captions, actor freedom and clear diagram space | P1 |
| tests/qc.test.ts | caption rule uses provisional geometry for solo, duo, fullscreen and portrait | tests/qc.test.ts: caption rule uses provisional geometry for solo, duo, fullscreen and portrait | P1 |
| tests/qc.test.ts | QC pre writes the contract, hashes inspected inputs and never rewrites reviews | tests/qc.test.ts: QC pre writes the contract, hashes inspected inputs and never rewrites reviews | P1 |
| tests/qc.test.ts | QC evidence rejects unresolved claims, common numeric claims even hedged, and forbidden web sources | tests/qc.test.ts: QC evidence rejects unresolved claims, common numeric claims even hedged, and forbidden web sources | P1 |
| tests/qc.test.ts | QC requires checked review lines and accepts waiver lines only in the owner's section | tests/qc.test.ts: QC requires checked review lines and accepts waiver lines only in the owner's section | P1 |
| tests/qc.test.ts | QC biim scopes Biim checks and enforces caption capacity | tests/qc.test.ts: QC biim scopes Biim checks and enforces caption capacity | P1 |
| tests/qc.test.ts | QC anime scopes Biim checks and enforces caption capacity | tests/qc.test.ts: QC anime scopes Biim checks and enforces caption capacity | P1 |
| tests/qc.test.ts | QC motion scopes Biim checks and enforces caption capacity | tests/qc.test.ts: QC motion scopes Biim checks and enforces caption capacity | P1 |
| tests/qc.test.ts | QC mixed scopes Biim checks and enforces caption capacity | tests/qc.test.ts: QC mixed scopes Biim checks and enforces caption capacity | P1 |
| tests/qc.test.ts | QC uses narration overrides, ignores comment-only headings and rejects inconsistent storyboard styles | tests/qc.test.ts: QC uses narration overrides, ignores comment-only headings and rejects inconsistent storyboard styles | P1 |
| tests/qc.test.ts | QC accepts contract heading annotations with spaces and rejects empty review text | tests/qc.test.ts: QC accepts contract heading annotations with spaces and rejects empty review text | P1 |
| tests/qc.test.ts | QC Biim standard constants match the repository standard | tests/qc.test.ts: QC Biim standard constants match the repository standard | P1 |
| tests/qc.test.ts | QC post rechecks preflight, validates narration, still reviews, ghost reconciliation and delivery | tests/qc.test.ts: QC post rechecks preflight, validates narration, still reviews, ghost reconciliation and delivery | P1 |
| tests/qc.test.ts | QC post rejects missing scene speech, overlapping/cut speech and oversized rendered captions | tests/qc.test.ts: QC post rejects missing scene speech, overlapping/cut speech and oversized rendered captions | P1 |
| tests/qc.test.ts | QC no-voice jobs mark automatic caption/sync gates inapplicable | tests/qc.test.ts: QC no-voice jobs mark automatic caption/sync gates inapplicable | P1 |
| tests/qc.test.ts | QC post requires a current final scan, all review rows and delivery headings | tests/qc.test.ts: QC post requires a current final scan, all review rows and delivery headings | P1 |
| tests/qc.test.ts | QC post enforces scene tolerance and total duration independently of overlap | tests/qc.test.ts: QC post enforces scene tolerance and total duration independently of overlap | P1 |
| tests/qc.test.ts | QC CLI exits 1 on a failed gate, 2 on usage errors, and MV exits 0 without reports | tests/qc.test.ts: QC CLI exits 1 on a failed gate, 2 on usage errors, and MV exits 0 without reports | P1 |
| tests/qc.test.ts | validate final biim requires explainer design records and scopes note fields | tests/qc.test.ts: validate final biim requires explainer design records and scopes note fields | P1 |
| tests/qc.test.ts | validate final anime requires explainer design records and scopes note fields | tests/qc.test.ts: validate final anime requires explainer design records and scopes note fields | P1 |
| tests/qc.test.ts | validate final motion requires explainer design records and scopes note fields | tests/qc.test.ts: validate final motion requires explainer design records and scopes note fields | P1 |
| tests/qc.test.ts | validate final mixed requires explainer design records and scopes note fields | tests/qc.test.ts: validate final mixed requires explainer design records and scopes note fields | P1 |
| tests/qc.test.ts | validate final MV retains its original records and does not require explainer records | tests/qc.test.ts: validate final MV retains its original records and does not require explainer records | P1 |
| tests/qc.test.ts | fixture CLI generates all styles, isolated failure modes and unchanged MV behavior under --out | tests/qc.test.ts: fixture CLI generates all styles, isolated failure modes and unchanged MV behavior under --out | P1 |
| tests/qc.test.ts | caption fit counts halfwidth, explicit lines and speech units | tests/qc.test.ts: caption fit counts halfwidth, explicit lines and speech units | P1 |
| tests/qc.test.ts | style helpers preserve old jobs and require explicit mixed scene assignments | tests/qc.test.ts: style helpers preserve old jobs and require explicit mixed scene assignments | P1 |
| tests/voice.test.ts | Aivis pipeline reads scene scripts, splits captions, measures WAVs and rejects overlaps without replacing the previous manifest | tests/voice.test.ts: Aivis pipeline reads scene scripts, splits captions, measures WAVs and rejects overlaps without replacing the previous manifest | 変更なし |
