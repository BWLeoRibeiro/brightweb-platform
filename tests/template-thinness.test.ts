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

test("preview and platform scaffold load the MQ Mulish weight ladder", async () => {
  for (const appRoot of [
    path.join(REPO_ROOT, "apps", "platform-preview", "app"),
    path.join(REPO_ROOT, "packages", "create-bw-app", "template", "base", "app"),
  ]) {
    const fonts = await readFile(path.join(appRoot, "fonts.ts"), "utf8");
    const layout = await readFile(path.join(appRoot, "layout.tsx"), "utf8");
    assert.match(fonts, /import \{ Mulish \} from "next\/font\/google"/);
    assert.match(fonts, /weight: \["400", "600", "700", "800", "900"\]/);
    assert.match(fonts, /variable: "--font-mulish"/);
    assert.match(layout, /className=\{`\$\{mulish\.className\} \$\{mulish\.variable\}`\}/);
    assert.match(layout, /\["--font-body" as string\]: "var\(--font-mulish\)"/);
  }
});
