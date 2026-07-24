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
    if (cleanSource[index] === ";" && stack.length === 0) {
      boundary = index + 1;
      continue;
    }
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

test("preview TSX keeps raw color recipes in theme-aware CSS", async () => {
  const files = (await sourcesAt(previewSourceRoot)).filter(({ filePath }) => filePath.endsWith(".tsx"));
  assertPatternAbsent(files, /#[0-9a-f]{3,8}\b|rgba?\(|color-mix\(/i, "preview TSX colors must be represented by theme-aware CSS");
});

test("package and preview typography resolves through theme tokens", async () => {
  const files = [
    ...(await sourcesAt(packagesSourceRoot)),
    ...(await sourcesAt(previewSourceRoot)),
  ];
  const cssFiles = files.filter(({ filePath }) => filePath.endsWith(".css"));
  const componentFiles = files.filter(({ filePath }) => /\.(?:ts|tsx)$/.test(filePath));

  assertPatternAbsent(
    cssFiles,
    /font-family\s*:(?!\s*(?:var\(|inherit\b))[^;}\n]+/i,
    "font-family declarations must resolve through a family token",
  );
  assertPatternAbsent(
    cssFiles,
    /(?<!-)(?:font-size|font-weight|line-height|letter-spacing)\s*:\s*(?:-?\d|clamp\()/i,
    "typography declarations must resolve through scale, weight, and rhythm tokens",
  );
  assertPatternAbsent(
    componentFiles,
    /\b(?:text|leading|tracking|font)-\[(?:length:)?[+-]?(?:\d|\.\d)/,
    "arbitrary typography utilities must reference a theme token",
  );
  assertPatternAbsent(
    componentFiles,
    /\bfont(?:Family|Size|Weight)\s*:\s*(?!["'`]var\()[^,}\n]+/,
    "inline font family, size, and weight must reference theme tokens",
  );
});

test("meaningful low-emphasis copy uses the accessible muted foreground token", async () => {
  const relativePaths = [
    "packages/core-auth/src/ui/forgot-password-page.tsx",
    "packages/core-auth/src/ui/invite-page.tsx",
    "packages/core-auth/src/ui/login-page.tsx",
    "packages/core-auth/src/ui/reset-password-page.tsx",
    "packages/module-projects/src/ui/project-links-card.tsx",
    "packages/module-projects/src/ui/project-milestone-task-lists.tsx",
    "packages/ui/src/components/input.tsx",
  ];
  const files = await Promise.all(relativePaths.map(async (relativePath) => ({
    filePath: path.join(repoRoot, relativePath),
    source: await readFile(path.join(repoRoot, relativePath), "utf8"),
  })));
  assert.ok(files.every(({ source }) => source.includes("foreground-muted-accessible")));
  assertPatternAbsent(
    files,
    /text-foreground\/(?:35|40)\b/,
    "meaningful helper copy must not use failing foreground opacity",
  );
  assert.doesNotMatch(files.at(-1)!.source, /placeholder:text-foreground\/30\b/);
});

test("shared buttons transition explicit properties and respect reduced motion", async () => {
  const source = await readFile(path.join(uiSourceRoot, "components/button-variants.ts"), "utf8");
  assert.doesNotMatch(source, /\btransition-all\b/);
  assert.match(source, /transition-\[color,background-color,border-color,box-shadow,transform,filter,text-decoration-color\]/);
  assert.match(source, /motion-reduce:transition-none/);
});

test("segmented controls expose selection, visible focus, and reduced Framer motion", async () => {
  const dashboard = await readFile(path.join(appShellSourceRoot, "dashboard/dashboard-client.tsx"), "utf8");
  const admin = await readFile(path.join(adminUiSourceRoot, "admin-users.tsx"), "utf8");

  for (const source of [dashboard, admin]) {
    assert.match(source, /useReducedMotion\(\)/);
    assert.match(source, /aria-pressed=\{(?:active|isActive)\}/);
    assert.match(source, /focus-visible:ring-2/);
    assert.match(source, /focus-visible:ring-\[color:var\(--ring\)\]/);
    assert.match(source, /whileTap=\{prefersReducedMotion \? undefined : \{ scale: 0\.95 \}\}/);
    assert.match(source, /layoutId=\{prefersReducedMotion \? undefined :/);
  }
});

test("reduced motion is static across theme entrances, sheets, modules, and auth", async () => {
  const base = await readFile(path.join(repoRoot, "packages/theme/src/base.css"), "utf8");
  const surfaces = await readFile(path.join(repoRoot, "packages/theme/src/surfaces.css"), "utf8");
  const sheet = await readFile(path.join(uiSourceRoot, "components/sheet.tsx"), "utf8");
  const adminTokens = await readFile(path.join(repoRoot, "packages/module-admin/tokens.css"), "utf8");
  const projectTokens = await readFile(path.join(repoRoot, "packages/module-projects/tokens.css"), "utf8");
  const authTokens = await readFile(path.join(repoRoot, "packages/core-auth/tokens.css"), "utf8");

  assert.match(base, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0ms !important/);
  assert.match(base, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-iteration-count:\s*1 !important/);
  assert.match(surfaces, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.skeleton-ghost::after\s*\{\s*display:\s*none/);
  assert.doesNotMatch(surfaces, /skeleton-breathe/);
  assert.match(sheet, /motion-reduce:animate-none/);
  assert.match(sheet, /motion-reduce:transform-none/);

  for (const [source, selector] of [
    [adminTokens, String.raw`\.admin-dashboard-reveal`],
    [projectTokens, String.raw`\.dashboard-reveal`],
    [projectTokens, String.raw`\.project-surface-card`],
  ]) {
    assert.match(source, new RegExp(`@media \\(prefers-reduced-motion: reduce\\)[\\s\\S]*${selector}[\\s\\S]*animation:\\s*none[\\s\\S]*opacity:\\s*1[\\s\\S]*transform:\\s*none`));
  }

  assert.match(authTokens, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.auth-spinner\s*\{[\s\S]*animation:\s*none[\s\S]*transform:\s*none/);
  assert.match(authTokens, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.auth-skeleton-line::after\s*\{\s*display:\s*none/);
});

test("app-shell source uses only tokenized color and typography utilities", async () => {
  const files = await sourcesAt(appShellSourceRoot);
  assertPatternAbsent(files, /\bfont-medium\b/, "font-medium is not part of the loaded weight ladder");
  assertPatternAbsent(files, /\b(?:bg|border)-(?:black|white)\//, "black/white alpha utilities lock the shell to a theme");
  assertPatternAbsent(files, /#[0-9a-f]{3,8}\b|rgba?\(|color-mix\(/i, "raw color recipes must be represented by theme tokens");
});

test("scrolling sheet and modal bodies contain overscroll", async () => {
  const appSheet = await readFile(path.join(appShellSourceRoot, "components/app-sheet.tsx"), "utf8");
  const organizationsBrowser = await readFile(path.join(crmUiSourceRoot, "organizations-browser.tsx"), "utf8");
  const timelineBrowser = await readFile(path.join(crmUiSourceRoot, "timeline-browser.tsx"), "utf8");

  assert.match(appSheet, /sheetBodyClassName = "[^"]*overflow-y-auto overscroll-contain/);
  assert.match(organizationsBrowser, /overflow-y-auto overscroll-contain/);
  assert.match(timelineBrowser, /overflow-y-auto overscroll-contain/);
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

test("ui components using client-only APIs declare the use client directive", async () => {
  const files = await sourcesAt(uiSourceRoot);
  const violations = files
    .filter(({ filePath }) => filePath.endsWith(".tsx"))
    .filter(({ source }) => /@radix-ui\/react-slot|createContext|\buse(?:State|Ref|Effect|Context|Reducer|Memo|Callback)\b/.test(source))
    .filter(({ source }) => !/^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(source))
    .map(({ filePath }) => path.relative(repoRoot, filePath));
  assert.deepEqual(violations, [], `Components importing @radix-ui/react-slot or using client-only React APIs must start with "use client" (server-side module eval otherwise throws createContext errors):\n${violations.join("\n")}`);
});

test("package and preview source avoid named max-width utilities that resolve to space tokens", async () => {
  const packageFiles = (await sourcesAt(packagesSourceRoot)).filter(({ filePath }) => /\.(?:ts|tsx)$/.test(filePath));
  const previewFiles = (await sourcesAt(previewSourceRoot)).filter(({ filePath }) => /\.(?:ts|tsx)$/.test(filePath));
  assertPatternAbsent(
    [...packageFiles, ...previewFiles],
    /\bmax-w-(?:xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)\b/,
    "named max-w-* utilities resolve to --space-* tokens (~16px) in this Tailwind v4 setup; use max-w-[Xrem]",
  );
});

test("theme component styles keep color recipes in token definition files", async () => {
  const files = await Promise.all(themeComponentPaths.map(async (filePath) => ({ filePath, source: await readFile(filePath, "utf8") })));
  assertPatternAbsent(files, /#[0-9a-f]{3,8}\b|rgba?\(|color-mix\(/i, "theme component colors must be represented by tokens.css or theme palette overrides");
});

test("package and preview CSS keep cascade-sensitive class recipes in explicit layers", async () => {
  const cssFiles = [
    ...(await sourceFiles(packagesSourceRoot)),
    ...(await sourceFiles(previewSourceRoot)),
  ].filter((filePath) => filePath.endsWith(".css") && !filePath.endsWith(".module.css"));
  const violations = (await Promise.all(cssFiles.map(async (filePath) => {
    const source = await readFile(filePath, "utf8");
    return unlayeredCascadeSensitiveClassRules(source).map(({ line, selector }) => `${path.relative(repoRoot, filePath)}:${line} ${selector}`);
  }))).flat();
  assert.deepEqual(violations, [], `Package and preview class recipes that affect box model, color, or typography must use @layer components (element resets use @layer base):\n${violations.join("\n")}`);
});

test("package CSS layer guard allows tokens and flags unsafe class recipes", () => {
  const violations = unlayeredCascadeSensitiveClassRules(`
    @import "theme.css";
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
  const usedUtilities = new Set(files.flatMap(({ source }) => Array.from(source.matchAll(/(?<!--)\btext-ui-[a-z0-9-]+\b/g), (match) => match[0])));
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
