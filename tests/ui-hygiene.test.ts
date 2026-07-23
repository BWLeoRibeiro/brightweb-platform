import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const packagesSourceRoot = path.join(repoRoot, "packages");
const previewSourceRoot = path.join(repoRoot, "apps", "platform-preview", "app");
const uiSourceRoot = path.join(repoRoot, "packages", "ui", "src");
const appShellSourceRoot = path.join(repoRoot, "packages", "app-shell", "src");
const crmUiSourceRoot = path.join(repoRoot, "packages", "module-crm", "src", "ui");
const adminUiSourceRoot = path.join(repoRoot, "packages", "module-admin", "src", "ui");
const projectsUiSourceRoot = path.join(repoRoot, "packages", "module-projects", "src", "ui");
const typographyPath = path.join(repoRoot, "packages", "theme", "src", "typography.css");
const tokensPath = path.join(repoRoot, "packages", "theme", "src", "tokens.css");
const mqAliasesPath = path.join(repoRoot, "packages", "theme", "themes", "mq-aliases.css");
const themeComponentPaths = [
  path.join(repoRoot, "packages", "theme", "src", "base.css"),
  path.join(repoRoot, "packages", "theme", "src", "surfaces.css"),
  path.join(repoRoot, "packages", "theme", "src", "theme.css"),
  path.join(repoRoot, "packages", "theme", "src", "typography.css"),
  mqAliasesPath,
];
const cascadeSensitiveProperties = /^(?:align-|background(?:-|$)|border(?:-|$)|box-|color$|column-gap$|display$|flex(?:-|$)|font(?:-|$)|gap$|grid(?:-|$)|height$|inset(?:-|$)|justify-|left$|letter-spacing$|line-height$|margin(?:-|$)|max-|min-|opacity$|overflow(?:-|$)|padding(?:-|$)|position$|right$|row-gap$|text-|top$|transform$|vertical-align$|white-space$|width$)/;

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(entryPath) : [entryPath];
  }));
  return nested.flat().filter((filePath) => /\.(?:css|ts|tsx)$/.test(filePath));
}

async function sourcesAt(sourceRoot: string) {
  const files = await sourceFiles(sourceRoot);
  return Promise.all(files.map(async (filePath) => ({
    filePath,
    source: await readFile(filePath, "utf8"),
  })));
}

function assertPatternAbsent(files: Awaited<ReturnType<typeof sourcesAt>>, pattern: RegExp, label: string) {
  const violations = files.flatMap(({ filePath, source }) => {
    const matches = Array.from(source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`)));
    return matches.map((match) => `${path.relative(repoRoot, filePath)}:${source.slice(0, match.index).split("\n").length} ${match[0]}`);
  });
  assert.deepEqual(violations, [], `${label}:\n${violations.join("\n")}`);
}

function unlayeredCascadeSensitiveClassRules(source: string) {
  const cleanSource = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
  const stack: Array<{ prelude: string; openIndex: number; isLayer: boolean }> = [];
  const violations: Array<{ line: number; selector: string }> = [];
  let boundary = 0;

  for (let index = 0; index < cleanSource.length; index += 1) {
    if (cleanSource[index] === "{") {
      const prelude = cleanSource.slice(boundary, index).trim();
      stack.push({ prelude, openIndex: index, isLayer: /^@layer(?:\s|$)/.test(prelude) });
      boundary = index + 1;
      continue;
    }
    if (cleanSource[index] !== "}") continue;
    const block = stack.pop();
    if (!block) continue;
    const declarations = Array.from(cleanSource.slice(block.openIndex + 1, index).matchAll(/(?:^|[;{])\s*([\w-]+)\s*:/g), (match) => match[1]);
    const isTokenDefinition = declarations.length > 0 && declarations.every((property) => property.startsWith("--") || property === "color-scheme");
    if (!block.prelude.startsWith("@") && /(^|[\s>+~,(])\.[_a-zA-Z][\w-]*/.test(block.prelude) && !stack.some((ancestor) => ancestor.isLayer) && !isTokenDefinition && declarations.some((property) => cascadeSensitiveProperties.test(property))) {
      violations.push({ line: cleanSource.slice(0, Math.max(0, block.openIndex - block.prelude.length)).split("\n").length, selector: block.prelude.replace(/\s+/g, " ") });
    }
    boundary = index + 1;
  }
  return violations;
}

test("ui source follows the BrightWeb typography and color hygiene rules", async () => {
  const files = await sourcesAt(uiSourceRoot);
  assertPatternAbsent(files, /\bfont-medium\b/, "font-medium is not part of the loaded weight ladder");
  assertPatternAbsent(files, /#[0-9a-f]{3,8}\b|rgba?\(|color-mix\(/i, "raw color recipes must be represented by theme tokens");
});

test("app-shell source uses only tokenized color and typography utilities", async () => {
  const files = await sourcesAt(appShellSourceRoot);
  assertPatternAbsent(files, /\bfont-medium\b/, "font-medium is not part of the loaded weight ladder");
  assertPatternAbsent(files, /\b(?:bg|border)-(?:black|white)\//, "black/white alpha utilities lock the shell to a theme");
  assertPatternAbsent(files, /#[0-9a-f]{3,8}\b|rgba?\(|color-mix\(/i, "raw color recipes must be represented by theme tokens");
});

test("module CRM UI follows the BrightWeb typography and color hygiene rules", async () => {
  const files = await sourcesAt(crmUiSourceRoot);
  assertPatternAbsent(files, /\bfont-medium\b/, "font-medium is not part of the loaded weight ladder");
  assertPatternAbsent(files, /#[0-9a-f]{3,8}\b|rgba?\(|color-mix\(/i, "raw color recipes must be represented by theme tokens");
});

test("module Admin UI follows the BrightWeb typography and color hygiene rules", async () => {
  const files = await sourcesAt(adminUiSourceRoot);
  assertPatternAbsent(files, /\bfont-medium\b/, "font-medium is not part of the loaded weight ladder");
  assertPatternAbsent(files, /\b(?:bg|border)-(?:black|white)\//, "black/white alpha utilities lock admin UI to a theme");
  assertPatternAbsent(files, /#[0-9a-f]{3,8}\b|rgba?\(|color-mix\(/i, "raw color recipes must be represented by admin tokens");
});

test("module Admin components keep Portuguese UI copy in the dictionary", async () => {
  const files = (await sourcesAt(adminUiSourceRoot)).filter(({ filePath }) => !filePath.endsWith("dictionary.ts"));
  assertPatternAbsent(
    files,
    /["'`](?:[^"'`\n]*\b(?:utilizador(?:es)?|convite(?:s)?|função|motivo|alterações|filtros|procurar|cancelar)\b)/i,
    "Portuguese admin copy must be supplied by AdminUiDictionary",
  );
});

test("module Projects UI follows the BrightWeb typography and color hygiene rules", async () => {
  const files = await sourcesAt(projectsUiSourceRoot);
  assertPatternAbsent(files, /\bfont-medium\b/, "font-medium is not part of the loaded weight ladder");
  assertPatternAbsent(files, /#[0-9a-f]{3,8}\b|rgba?\(|color-mix\(/i, "raw color recipes must be represented by theme tokens");
});

test("package and preview selection controls use the shared Checkbox primitive", async () => {
  const packageFiles = (await sourcesAt(packagesSourceRoot)).filter(({ filePath }) => !filePath.startsWith(uiSourceRoot));
  const previewFiles = await sourcesAt(previewSourceRoot);
  assertPatternAbsent(
    [...packageFiles, ...previewFiles],
    /<input\b[^>]*\btype\s*=\s*["']checkbox["']/i,
    "raw checkbox inputs must use @brightweblabs/ui Checkbox",
  );
});

test("theme component styles keep color recipes in token definition files", async () => {
  const files = await Promise.all(themeComponentPaths.map(async (filePath) => ({ filePath, source: await readFile(filePath, "utf8") })));
  assertPatternAbsent(files, /#[0-9a-f]{3,8}\b|rgba?\(|color-mix\(/i, "theme component colors must be represented by tokens.css or theme palette overrides");
});

test("package CSS keeps cascade-sensitive class recipes in explicit layers", async () => {
  const cssFiles = (await sourceFiles(packagesSourceRoot)).filter((filePath) => filePath.endsWith(".css") && !filePath.endsWith(".module.css"));
  const violations = (await Promise.all(cssFiles.map(async (filePath) => {
    const source = await readFile(filePath, "utf8");
    return unlayeredCascadeSensitiveClassRules(source).map(({ line, selector }) => `${path.relative(repoRoot, filePath)}:${line} ${selector}`);
  }))).flat();
  assert.deepEqual(violations, [], `Package class recipes that affect box model, color, or typography must use @layer components (element resets use @layer base):\n${violations.join("\n")}`);
});

test("package CSS layer guard allows tokens and flags unsafe class recipes", () => {
  const violations = unlayeredCascadeSensitiveClassRules(`
    :root, .dark { --surface: white; color-scheme: dark; }
    @layer components { .safe { padding: 1rem; } }
    @keyframes enter { to { opacity: 1; } }
    .unsafe { padding: 1rem; }
  `);
  assert.deepEqual(violations.map(({ selector }) => selector), [".unsafe"]);
});

test("every text-ui utility used by ui exists in theme typography", async () => {
  const files = [...await sourcesAt(uiSourceRoot), ...await sourcesAt(adminUiSourceRoot), ...await sourcesAt(crmUiSourceRoot), ...await sourcesAt(projectsUiSourceRoot)];
  const typography = await readFile(typographyPath, "utf8");
  const providedUtilities = new Set(Array.from(typography.matchAll(/@utility\s+(text-ui-[a-z0-9-]+)/g), (match) => match[1]));
  const usedUtilities = new Set(files.flatMap(({ source }) => Array.from(source.matchAll(/\btext-ui-[a-z0-9-]+\b/g), (match) => match[0])));
  const missing = Array.from(usedUtilities).filter((utility) => !providedUtilities.has(utility)).sort();
  assert.deepEqual(missing, [], `Missing @utility definitions: ${missing.join(", ")}`);
});

test("every MQ-compatible typography class used by packages exists in the theme aliases", async () => {
  const files = [...await sourcesAt(uiSourceRoot), ...await sourcesAt(appShellSourceRoot), ...await sourcesAt(adminUiSourceRoot), ...await sourcesAt(crmUiSourceRoot), ...await sourcesAt(projectsUiSourceRoot)];
  const aliases = `${await readFile(mqAliasesPath, "utf8")}\n${await readFile(tokensPath, "utf8")}`;
  const used = new Set(files.flatMap(({ source }) => Array.from(source.matchAll(/\b(?:paragraph|portal)-[a-z0-9-]+\b/g), (match) => match[0])));
  const missing = Array.from(used).filter((utility) => !aliases.includes(utility)).sort();
  assert.deepEqual(missing, [], `Missing MQ-compatible typography definitions: ${missing.join(", ")}`);
});
