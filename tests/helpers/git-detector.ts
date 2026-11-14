import ts from "typescript";

type StaticPrefix = { text: string; complete: boolean };

function staticPrefix(expression: ts.Expression): StaticPrefix | undefined {
  if (ts.isParenthesizedExpression(expression)) return staticPrefix(expression.expression);
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))
    return { text: expression.text, complete: true };
  if (ts.isTemplateExpression(expression)) return { text: expression.head.text, complete: false };
  if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticPrefix(expression.left);
    if (!left || !left.complete) return left;
    const right = staticPrefix(expression.right);
    return { text: left.text + (right?.text ?? ""), complete: right?.complete ?? false };
  }
  return undefined;
}

// Inspect static first-argument prefixes regardless of the wrapper's function name.
export function gitLaunches(source: string): string[] {
  const file = ts.createSourceFile("source.ts", source, ts.ScriptTarget.Latest, true);
  const matches: string[] = [];
  const executable = "g" + "it";
  const command = new RegExp(`^(?:[^\\r\\n]*[/\\\\])?${executable}(?:\\.exe)?(?:$|\\s)`);
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const first = node.arguments[0];
      const prefix = first && staticPrefix(first);
      if (prefix && command.test(prefix.text))
        matches.push(node.getText(file));
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return matches;
}
