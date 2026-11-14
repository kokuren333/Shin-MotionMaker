import ts from "typescript";

// Inspect literal first arguments regardless of the wrapper's function name.
export function gitLaunches(source: string): string[] {
  const file = ts.createSourceFile("source.ts", source, ts.ScriptTarget.Latest, true);
  const matches: string[] = [];
  const executable = "g" + "it";
  const command = new RegExp(`^(?:[^\\r\\n]*[/\\\\])?${executable}(?:\\.exe)?(?:$|\\s)`);
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const first = node.arguments[0];
      if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) && command.test(first.text))
        matches.push(node.getText(file));
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return matches;
}
