import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const packagesRoot = path.join(repoRoot, "packages");
const sourceExtensions = new Set([".css", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const tokenDefinitionFiles = new Set([
  path.join(packagesRoot, "theme", "src", "theme.css"),
  path.join(packagesRoot, "theme", "src", "tokens.css"),
]);

function isEmailTemplate(file: string): boolean {
  return file.includes(`${path.sep}email${path.sep}`);
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sourceFiles(entryPath);
    return sourceExtensions.has(path.extname(entry.name)) ? [entryPath] : [];
  }));
  return nested.flat();
}

test("package components do not force uppercase or expanded tracking", async () => {
  const violations: string[] = [];
  const bannedPresentation = [
    /text-transform\s*:\s*uppercase\b/i,
    /textTransform\s*:\s*["']uppercase\b/i,
    /["'`][^"'`\n]*\buppercase\b[^"'`\n]*["'`]/,
    /tracking-(?:wide|wider|widest)\b/,
    /tracking-\[\s*(?:0?\.\d+|[1-9]\d*(?:\.\d+)?)em\s*\]/,
    /type-tracking-(?:0[6-9]0|1\d0|180)\b/,
    /letter-spacing\s*:\s*(?:0?\.\d+|[1-9]\d*(?:\.\d+)?)em\b/i,
    /letterSpacing\s*:\s*["'](?:0?\.\d+|[1-9]\d*(?:\.\d+)?)em\b/i,
  ];

  for (const file of await sourceFiles(packagesRoot)) {
    // Email presentation must be inlined because many inboxes cannot load the
    // application typography system or preserve class-based styling.
    if (tokenDefinitionFiles.has(file) || isEmailTemplate(file)) continue;
    const source = await fs.readFile(file, "utf8");
    if (bannedPresentation.some((pattern) => pattern.test(source))) {
      violations.push(path.relative(repoRoot, file));
    }
  }

  assert.deepEqual(violations, [], `remove forced uppercase/wide tracking from:\n${violations.join("\n")}`);
});
