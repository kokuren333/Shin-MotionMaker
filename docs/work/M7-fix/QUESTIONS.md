# QUESTIONS — M7-fix

| ID | 宛先 | 質問 | 回答が無い間の扱い | 回答 | 決定日 |
| --- | --- | --- | --- | --- | --- |
| M7-fix-Q1 | L2 | R-2 の原典互換修正後、GUI の `parseRequestText rejects unknown values of fixed-choice keys with pointers, but keeps unfinished input importable (M4R R1)` が、characterMode:trio でも2人目の配置エラーを期待するため失敗する。原典は duo のときだけ2人目を見る。変更禁止の gui/tests/request-io.test.ts の期待値を m7-gui 担当が修正するか、M7-fix にその1件だけ許可するか。 | gui/ は変更せず、非依存の検証を継続。原典と R-2 の条件を維持する。 | 確認中 | — |

追補：`npm run test:e2e --workspace gui` は41/42。`gui/e2e/run.mjs` の「GU-04 不正な列挙値の request.json は入力エラーとして表示し、画面と既存の入力・添付を残す（M4R R1）」も、`{secondCharacter:{position:"middle"}}` を人数省略（solo）のまま渡し、拒否を期待するため失敗する。拒否の試験には `characterMode:"duo"` を明示する必要がある。単体と合わせてこの2箇所の整合を L2 に依頼する。
