import type { JsonObject, JsonValue } from "../core/index.ts";
import { schemas, schemaRegistry } from "../host/index.ts";

// Bundle host references locally so clients never need filesystem or network access.
export function envelopeSchema(): JsonObject {
  const references: JsonObject = {};
  function visit(value: JsonValue): JsonValue {
    if (Array.isArray(value)) return value.map(visit);
    if (value === null || typeof value !== "object") return value;
    const result: JsonObject = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === "$schema" || key === "$id") continue;
      if (key === "$ref" && typeof item === "string") {
        const [file, fragment] = item.split("#");
        const source = schemaRegistry[file];
        if (!source) throw Error("Unknown host schema reference");
        const name = file.replace(/\.schema\.json$/, "");
        if (!Object.hasOwn(references, name)) {
          references[name] = {};
          references[name] = visit(source);
        }
        result[key] = `#/$defs/references/${name}${fragment ?? ""}`;
      } else result[key] = visit(item);
    }
    return result;
  }
  const bundled = visit(schemas.envelope) as JsonObject;
  bundled.$id = schemas.envelope.$id;
  bundled.$defs = { ...bundled.$defs as JsonObject, references };
  return bundled;
}
