import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const previewAppRoot = path.join(repoRoot, "apps", "platform-preview", "app");
const templateRoot = path.join(repoRoot, "packages", "create-bw-app", "template");

async function tsxFilesAt(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? tsxFilesAt(entryPath) : [entryPath];
  }));
  return nested.flat().filter((filePath) => filePath.endsWith(".tsx"));
}

function hasUseClientDirective(sourceFile: ts.SourceFile) {
  for (const statement of sourceFile.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) {
      return false;
    }
    if (statement.expression.text === "use client") return true;
  }
  return false;
}

function functionExpressionInProp(
  expression: ts.Expression,
  localInitializers: Map<string, ts.Expression>,
  seenBindings = new Set<string>(),
) {
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) return expression;
  if (ts.isIdentifier(expression)) {
    if (seenBindings.has(expression.text)) return undefined;
    const initializer = localInitializers.get(expression.text);
    if (!initializer) return undefined;
    return functionExpressionInProp(
      initializer,
      localInitializers,
      new Set([...seenBindings, expression.text]),
    );
  }
  if (!ts.isObjectLiteralExpression(expression)) return undefined;

  let match: ts.ArrowFunction | ts.FunctionExpression | undefined;
  function visit(node: ts.Node) {
    if (match) return;
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      match = node;
      return;
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(expression, visit);
  return match;
}

test("server components do not pass function expressions through JSX props", async () => {
  const templateAppFiles = (await tsxFilesAt(templateRoot)).filter((filePath) => (
    path.relative(templateRoot, filePath).split(path.sep).includes("app")
  ));
  const files = [...await tsxFilesAt(previewAppRoot), ...templateAppFiles];
  const violations: string[] = [];

  for (const filePath of files) {
    const source = await readFile(filePath, "utf8");
    const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    if (hasUseClientDirective(sourceFile)) continue;
    const localInitializers = new Map<string, ts.Expression>();
    function collectInitializers(node: ts.Node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        localInitializers.set(node.name.text, node.initializer);
      }
      ts.forEachChild(node, collectInitializers);
    }
    collectInitializers(sourceFile);

    function visit(node: ts.Node) {
      if (ts.isJsxAttribute(node) && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        const match = functionExpressionInProp(node.initializer.expression, localInitializers);
        if (match) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(match.getStart(sourceFile));
          const element = node.parent.parent;
          const component = (ts.isJsxOpeningElement(element) || ts.isJsxSelfClosingElement(element))
            ? element.tagName.getText(sourceFile)
            : "unknown";
          violations.push(
            `${path.relative(repoRoot, filePath)}:${line + 1}:${character + 1} <${component}> ${node.name.getText(sourceFile)}`,
          );
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }

  assert.deepEqual(
    violations,
    [],
    `Server Components must pass serializable JSX props; function expressions found:\n${violations.join("\n")}`,
  );
});
