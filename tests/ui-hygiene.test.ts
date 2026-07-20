import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const uiSourceRoot = path.join(repoRoot, "packages", "ui", "src");
const typographyPath = path.join(repoRoot, "packages", "theme", "src", "typography.css");

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(entryPath) : [entryPath];
  }));
  return nested.flat().filter((filePath) => /\.(?:ts|tsx)$/.test(filePath));
}

async function uiSources() {
  const files = await sourceFiles(uiSourceRoot);
  return Promise.all(files.map(async (filePath) => ({
    filePath,
    source: await readFile(filePath, "utf8"),
  })));
}

function assertPatternAbsent(files: Awaited<ReturnType<typeof uiSources>>, pattern: RegExp, label: string) {
  const violations = files.flatMap(({ filePath, source }) => {
    const matches = Array.from(source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`)));
    return matches.map((match) => `${path.relative(repoRoot, filePath)}:${source.slice(0, match.index).split("\n").length} ${match[0]}`);
  });
  assert.deepEqual(violations, [], `${label}:\n${violations.join("\n")}`);
}

test("ui source follows the BrightWeb typography and color hygiene rules", async () => {
  const files = await uiSources();
  assertPatternAbsent(files, /\bfont-medium\b/, "font-medium is not part of the loaded weight ladder");
  assertPatternAbsent(files, /#[0-9a-f]{3,8}\b/i, "raw hex colors must be represented by theme tokens");
  assertPatternAbsent(files, /\b(?:paragraph|portal)-[a-z0-9-]+\b/i, "app-specific typography classes are not available in ui");
});

test("every text-ui utility used by ui exists in theme typography", async () => {
  const files = await uiSources();
  const typography = await readFile(typographyPath, "utf8");
  const providedUtilities = new Set(Array.from(typography.matchAll(/@utility\s+(text-ui-[a-z0-9-]+)/g), (match) => match[1]));
  const usedUtilities = new Set(files.flatMap(({ source }) => Array.from(source.matchAll(/\btext-ui-[a-z0-9-]+\b/g), (match) => match[0])));
  const missing = Array.from(usedUtilities).filter((utility) => !providedUtilities.has(utility)).sort();
  assert.deepEqual(missing, [], `Missing @utility definitions: ${missing.join(", ")}`);
});
