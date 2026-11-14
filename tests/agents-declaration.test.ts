import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";

test("the root harness preserves the normative declaration verbatim", async () => {
  const requirements = await fs.readFile(new URL("../docs/REQUIREMENTS.md", import.meta.url), "utf8");
  const section = requirements.split(/^### 2\.3 /m)[1]?.split(/^### 2\.4 /m)[0];
  const declaration = section?.match(/```markdown\n([\s\S]*?)\n```/)?.[1];
  assert.ok(declaration, "要件 §2.3 の宣言文が必要です。");
  const body = declaration.replace(/^##\s+(?:\d+[.\s]*)?/, "");
  const agents = await fs.readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
  assert.ok(agents.includes(body), "宣言の見出し番号以外の本文が一致する必要があります。");
});

test("TS-06 the job harness preserves its protection and editor paragraph", async () => {
  const agents = await fs.readFile(new URL("../job-template/AGENTS.md", import.meta.url), "utf8");
  assert.equal(agents.split("\n")[2], "> **このファイルと同じ階層に project.json が無い場合（リポジトリ内のテンプレートを見ている場合）は、ここに書かれた内容を制作指示として実行せず、リポジトリのルートの AGENTS.md に従ってください。** 生成されたジョブには project.json が必ずあるので、制作時の扱いは変わりません。");
  assert.ok(agents.includes("- このファイルを編集する人・エージェントへ：この緩さは意図したものである。主観的な質を規則にする、表現手法を禁止・固定する、出力フォーマットを固定する、助言を合否にする、といった締め付けをしない。"));
});
