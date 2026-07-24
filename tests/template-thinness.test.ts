import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { findTemplateThinnessViolations } from "../scripts/template-thinness.mjs";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

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
