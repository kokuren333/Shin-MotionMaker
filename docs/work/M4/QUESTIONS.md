# M4 QUESTIONS — L2 への質問（契約・core は変えていない）

## Q1 選べる値の集合を core から公開するか、shape の検査に含めるか（M4R R1 から）

- 背景：`validateRequest` の `phase: "shape"` は型までを検査し、`styleMode: "unknown"` のような列挙の外の文字列を通す。列挙の検査は `validateForm`（`phase: "complete"`）の中にだけあり、集合（`["biim","anime","motion","mixed"]`、`tempo` の3値など）は関数の中の直書きで、公開されていない。
- M4-fix の対応：GUI に集合を書かずに済むよう、`gui/src/lib/request-io.ts` の `choiceIssues` は、core が受け付ける完成済みの入力（`choiceProbe`）の1キーだけを読み込んだ値に差し替えて `validateForm` に通し、増えた誤りを列挙値の誤りとして返す。`styleMode` はさらに core の `explainerStyles` に項目があることを確かめる（画面と `agentPromptFor` がこれを引くため）。未完成の入力（空のタイトル、範囲外の数値、縦向き＋混在など）はこれまでどおり読み込める。
- 質問：
  1. 列挙の集合を core から定数として公開する（例：`formChoices`）ことを、契約の範囲で検討してほしい。GUI の探り方（1キーずつ `validateForm` に通す）は core の集合に追従するが、間接的である。
  2. CLI・MCP にも shape だけで request を読む経路ができるなら、同じ問題（未知の列挙値が後段の `explainerStyles[...]` 参照で落ちる）が起きうる。shape の検査に列挙値を含めるか、shape の後で列挙だけを確かめる段を core に置くかを L2 で判断してほしい。shape に含める場合、GUI の `choiceIssues` はそれに置き換えられる。
- 作業は止めていない。core・契約は変更していない。
