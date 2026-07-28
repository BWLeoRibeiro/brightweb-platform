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
      if (ts.isJsxOpeningElement(node)) props.add("children");
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
