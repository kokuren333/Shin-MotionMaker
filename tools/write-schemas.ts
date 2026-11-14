import fs from "node:fs/promises";
import { schemas } from "../src/host/output-schemas.ts";

const directory = new URL("../schemas/", import.meta.url);
await fs.mkdir(directory, { recursive: true });
for (const [name, schema] of Object.entries(schemas)) {
  await fs.writeFile(new URL(`${name}.schema.json`, directory), JSON.stringify(schema, null, 2) + "\n");
}
console.log(`${Object.keys(schemas).length} 件のスキーマを書き出しました。契約変更の承認は別途必要です。`);
