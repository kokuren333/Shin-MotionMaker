import { isDeepStrictEqual } from "node:util";
import type { JsonObject, JsonValue } from "../core/index.ts";

type Issue = { pointer: string; reason: string };
const escape = (value: string) => value.replaceAll("~", "~0").replaceAll("/", "~1");
// Implements the standard JSON Schema keyword subset used by this package.
export function schemaIssues(schema: JsonObject, value: unknown, registry: Record<string, JsonObject> = {}, pointer = ""): Issue[] {
  const issues: Issue[] = [];
  const fail = (reason: string) => issues.push({ pointer, reason });
  if (typeof schema.$ref === "string") {
    const reference = schema.$ref;
    const [file, fragment] = reference.split("#");
    let target: JsonValue | undefined = registry[file] ?? registry[reference];
    if (target && fragment) for (const key of fragment.replace(/^\//, "").split("/")) target = (target as JsonObject)[key.replaceAll("~1", "/").replaceAll("~0", "~")];
    if (!target || typeof target !== "object" || Array.isArray(target)) throw Error(`Unknown schema reference: ${reference}`);
    return schemaIssues(target, value, registry, pointer);
  }
  for (const keyword of ["oneOf", "anyOf", "allOf"] as const) if (Array.isArray(schema[keyword])) {
    const counts = (schema[keyword] as JsonObject[]).filter((entry) => schemaIssues(entry, value, registry, pointer).length === 0).length;
    if (keyword === "oneOf" ? counts !== 1 : keyword === "anyOf" ? counts === 0 : counts !== schema[keyword].length) fail("スキーマの選択条件を満たしません。");
  }
  if (Object.hasOwn(schema, "const") && !isDeepStrictEqual(schema.const, value)) fail("固定値と異なります。");
  if (Array.isArray(schema.enum) && !schema.enum.some((item) => isDeepStrictEqual(item, value))) fail("許可された値ではありません。");
  const matches = (type: JsonValue) => type === "null" ? value === null : type === "array" ? Array.isArray(value) : type === "object" ? !!value && typeof value === "object" && !Array.isArray(value) : type === "integer" ? Number.isSafeInteger(value) : typeof value === type && (type !== "number" || Number.isFinite(value));
  if (schema.type && !(Array.isArray(schema.type) ? schema.type.some(matches) : matches(schema.type))) { fail("型が不正です。"); return issues; }
  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum || typeof schema.maximum === "number" && value > schema.maximum || typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum) fail("数値が範囲外です。");
  }
  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && [...value].length < schema.minLength || typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(value)) fail("文字列の形式が不正です。");
  }
  if (Array.isArray(value)) {
    if (schema.items && typeof schema.items === "object" && !Array.isArray(schema.items)) value.forEach((entry, index) => issues.push(...schemaIssues(schema.items as JsonObject, entry, registry, `${pointer}/${index}`)));
  } else if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    const properties = schema.properties as Record<string, JsonObject> | undefined;
    for (const key of Array.isArray(schema.required) ? schema.required : []) if (typeof key === "string" && !Object.hasOwn(object, key)) issues.push({ pointer: `${pointer}/${escape(key)}`, reason: "必須項目がありません。" });
    for (const [key, entry] of Object.entries(object)) {
      if (properties && Object.hasOwn(properties, key)) issues.push(...schemaIssues(properties[key], entry, registry, `${pointer}/${escape(key)}`));
      else if (schema.additionalProperties === false) issues.push({ pointer: `${pointer}/${escape(key)}`, reason: "未知のキーです。" });
      else if (schema.additionalProperties && typeof schema.additionalProperties === "object" && !Array.isArray(schema.additionalProperties)) issues.push(...schemaIssues(schema.additionalProperties, entry, registry, `${pointer}/${escape(key)}`));
    }
  }
  return issues;
}
