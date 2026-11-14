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
