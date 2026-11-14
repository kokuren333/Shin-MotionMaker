import path from "node:path";
import ts from "typescript";

/** Include static imports/exports, dynamic imports and CommonJS calls. */
export function architectureViolations(filename: string, source: string): string[] {
  const file = filename.replaceAll("\\", "/");
  const layer = file.startsWith("src/core/") ? "core" : file.startsWith("src/cli/") ? "cli" :
    file.startsWith("src/mcp/") ? "mcp" : file.startsWith("gui/") ? "gui" : null;
  if (!layer) return [];
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const imports: string[] = [];
  function visit(node: ts.Node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
      imports.push(node.moduleSpecifier.text);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) imports.push(node.moduleReference.expression.text);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(ast) === "require") &&
        node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) imports.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return imports.filter((specifier) => {
    const target = specifier.startsWith(".") ? path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)) : specifier.replace(/^@\//, "");
    const inLayer = (name: string) => target === `src/${name}` || target.startsWith(`src/${name}/`);
    const template = target === "job-template" || target.startsWith("job-template/");
    if (layer === "core") return /^(?:node:|fs(?:\/|$)|child_process(?:\/|$)|path(?:\/|$)|os(?:\/|$)|http(?:\/|$)|https(?:\/|$)|stream(?:\/|$)|module(?:\/|$))/.test(target) ||
      ["host", "cli", "mcp"].some(inLayer) || target === "gui" || target.startsWith("gui/") ||
      (template && !["job-template/runtime/scripts/caption-capacity.mjs", "job-template/runtime/scripts/caption-capacity.d.mts"].includes(target));
    if (layer === "cli" || layer === "mcp") return inLayer(layer === "cli" ? "mcp" : "cli") ||
      /^(?:node:)?(?:fs|child_process)(?:\/|$)/.test(target) || template;
    return ["host", "cli", "mcp"].some(inLayer);
  });
}
