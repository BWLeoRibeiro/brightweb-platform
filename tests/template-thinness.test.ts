import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { findTemplateThinnessViolations } from "../scripts/template-thinness.mjs";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const TEMPLATE_SHELL_LAYOUT = path.join(
  REPO_ROOT,
  "packages",
  "create-bw-app",
  "template",
  "base",
  "app",
  "(shell)",
  "shell-layout-client.tsx",
);
const PREVIEW_SHELL_LAYOUT = path.join(
  REPO_ROOT,
  "apps",
  "platform-preview",
  "app",
  "(shell)",
  "shell-layout-client.tsx",
);

function hasMeaningfulJsxChildren(element: ts.JsxElement) {
  return element.children.some((child) => {
    if (ts.isJsxText(child)) return child.text.trim().length > 0;
    if (ts.isJsxExpression(child)) {
      return child.expression !== undefined && child.expression.kind !== ts.SyntaxKind.NullKeyword;
    }
    return true;
  });
}

function collectJsxProps(source: string, filePath: string, componentName: string) {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches: Set<string>[] = [];

  function visit(node: ts.Node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && node.tagName.getText(sourceFile) === componentName
    ) {
      const props = new Set<string>();
      for (const attribute of node.attributes.properties) {
        assert.ok(
          ts.isJsxAttribute(attribute),
          `${componentName} in ${filePath} must use named props so shell parity can be checked.`,
        );
        props.add(attribute.name.getText(sourceFile));
      }
      if (
        ts.isJsxOpeningElement(node)
        && ts.isJsxElement(node.parent)
        && hasMeaningfulJsxChildren(node.parent)
      ) {
        props.add("children");
      }
      matches.push(props);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  assert.equal(matches.length, 1, `Expected exactly one ${componentName} in ${filePath}.`);
  return matches[0]!;
}

test("scaffold routes are direct package mounts with no app-owned logic", async () => {
  const violations = await findTemplateThinnessViolations(
    path.join(REPO_ROOT, "packages", "create-bw-app", "template"),
  );

  assert.deepEqual(violations, []);
});

test("preview and platform scaffold load self-hosted Geist family tokens", async () => {
  for (const appRoot of [
    path.join(REPO_ROOT, "apps", "platform-preview", "app"),
    path.join(REPO_ROOT, "packages", "create-bw-app", "template", "base", "app"),
  ]) {
    const fonts = await readFile(path.join(appRoot, "fonts.ts"), "utf8");
    const layout = await readFile(path.join(appRoot, "layout.tsx"), "utf8");
    assert.match(fonts, /GeistSans as geistSans.*"geist\/font\/sans"/);
    assert.match(fonts, /GeistMono as geistMono.*"geist\/font\/mono"/);
    assert.match(layout, /className=\{`\$\{geistSans\.variable\} \$\{geistMono\.variable\}`\}/);
    assert.doesNotMatch(layout, /\bstyle=/);
  }
});

test("site scaffold uses Geist as its tokenized default", async () => {
  const appRoot = path.join(REPO_ROOT, "packages", "create-bw-app", "template", "site", "base", "app");
  assert.match(await readFile(path.join(appRoot, "fonts.ts"), "utf8"), /GeistSans as geistSans.*"geist\/font\/sans"/);
  assert.match(await readFile(path.join(appRoot, "layout.tsx"), "utf8"), /className=\{geistSans\.variable\}/);
  const globals = await readFile(path.join(appRoot, "globals.css"), "utf8");
  assert.match(globals, /--font-body:\s*var\(--font-geist-sans\)/);
  assert.match(globals, /font-family:\s*var\(--font-sans\)/);
});

test("template and preview shell components pass the same prop sets", async () => {
  const [templateSource, previewSource] = await Promise.all([
    readFile(TEMPLATE_SHELL_LAYOUT, "utf8"),
    readFile(PREVIEW_SHELL_LAYOUT, "utf8"),
  ]);
  const mismatches: string[] = [];

  for (const componentName of ["DesktopSidebar", "MobileNav", "AppHeader"]) {
    const templateProps = collectJsxProps(templateSource, TEMPLATE_SHELL_LAYOUT, componentName);
    const previewProps = collectJsxProps(previewSource, PREVIEW_SHELL_LAYOUT, componentName);
    const propNames = new Set([...templateProps, ...previewProps]);

    for (const propName of propNames) {
      if (templateProps.has(propName) === previewProps.has(propName)) continue;
      const presentFile = templateProps.has(propName) ? TEMPLATE_SHELL_LAYOUT : PREVIEW_SHELL_LAYOUT;
      const missingFile = templateProps.has(propName) ? PREVIEW_SHELL_LAYOUT : TEMPLATE_SHELL_LAYOUT;
      mismatches.push(
        `${componentName} prop "${propName}" is present in ${presentFile} but missing from ${missingFile}.`,
      );
    }
  }

  assert.deepEqual(
    mismatches,
    [],
    `Shell component prop parity failed:\n${mismatches.join("\n")}`,
  );
});

test("collectJsxProps counts children only when a non-trivial JSX child exists", () => {
  assert.equal(
    collectJsxProps("const a = <X>{null}</X>;", "inline.tsx", "X").has("children"),
    false,
    "A lone {null} expression child must not count as a children prop.",
  );
  assert.equal(
    collectJsxProps("declare const y: string; const a = <X>{y}</X>;", "inline.tsx", "X").has("children"),
    true,
    "A real expression child must count as a children prop.",
  );
});

const APP_HEADER_SOURCE = path.join(REPO_ROOT, "packages", "app-shell", "src", "components", "app-header.tsx");

// Declared AppHeaderProps members that neither shell surface passes today, on
// purpose. The invariant: every prop declared on AppHeaderProps is either
// passed by BOTH the template and the preview AppHeader usages, or listed here.
const INTENTIONALLY_UNUSED_APP_HEADER_PROPS = new Set([
  "className", // Surfaces rely on AppHeader's own layout classes.
  "kicker", // No shell surface renders an eyebrow label above the title.
  "count", // Record counts are owned by module pages, not the shell chrome.
  "trailing", // No shell-level trailing slot content is wired yet.
  "utility", // Utility area currently holds only the notifications menu.
  "breadcrumbs", // Breadcrumbs are derived from toolbar back actions instead.
]);

test("every declared AppHeader prop is passed by both shells or explicitly allowlisted", async () => {
  const appHeaderSource = await readFile(APP_HEADER_SOURCE, "utf8");
  const sourceFile = ts.createSourceFile(
    APP_HEADER_SOURCE,
    appHeaderSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const declaredProps: string[] = [];

  function visit(node: ts.Node) {
    if (
      ts.isTypeAliasDeclaration(node)
      && node.name.text === "AppHeaderProps"
      && ts.isTypeLiteralNode(node.type)
    ) {
      for (const member of node.type.members) {
        assert.ok(
          ts.isPropertySignature(member) && member.name,
          `AppHeaderProps in ${APP_HEADER_SOURCE} must only contain named property signatures.`,
        );
        declaredProps.push(member.name.getText(sourceFile));
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  // Fail closed: if the type moves or is renamed, this guard must break loudly
  // rather than silently checking nothing.
  assert.ok(
    declaredProps.length > 0,
    `Could not locate the AppHeaderProps type literal in ${APP_HEADER_SOURCE}. Update this test to point at its new home.`,
  );

  const [templateSource, previewSource] = await Promise.all([
    readFile(TEMPLATE_SHELL_LAYOUT, "utf8"),
    readFile(PREVIEW_SHELL_LAYOUT, "utf8"),
  ]);
  const templateProps = collectJsxProps(templateSource, TEMPLATE_SHELL_LAYOUT, "AppHeader");
  const previewProps = collectJsxProps(previewSource, PREVIEW_SHELL_LAYOUT, "AppHeader");
  const problems: string[] = [];

  for (const propName of declaredProps) {
    const passedByBoth = templateProps.has(propName) && previewProps.has(propName);
    const allowlisted = INTENTIONALLY_UNUSED_APP_HEADER_PROPS.has(propName);
    if (passedByBoth && allowlisted) {
      problems.push(
        `AppHeader prop "${propName}" is passed by both surfaces; remove it from INTENTIONALLY_UNUSED_APP_HEADER_PROPS.`,
      );
    }
    if (!passedByBoth && !allowlisted) {
      problems.push(
        `AppHeader prop "${propName}" is declared but not passed by both surfaces. Wire it in both shell-layout-client.tsx files or add it to INTENTIONALLY_UNUSED_APP_HEADER_PROPS with a comment.`,
      );
    }
  }

  for (const propName of INTENTIONALLY_UNUSED_APP_HEADER_PROPS) {
    if (!declaredProps.includes(propName)) {
      problems.push(
        `INTENTIONALLY_UNUSED_APP_HEADER_PROPS lists "${propName}", which AppHeaderProps no longer declares; remove the stale entry.`,
      );
    }
  }

  assert.deepEqual(problems, [], `AppHeader prop coverage failed:\n${problems.join("\n")}`);
});
