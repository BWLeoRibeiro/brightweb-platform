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
const marketingUiSourceRoot = path.join(repoRoot, "packages", "module-marketing", "src", "ui");
const marketingCssPath = path.join(repoRoot, "packages", "module-marketing", "marketing.css");
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

test("default and brand buttons share the flat Projects action contract", async () => {
  const source = await readFile(path.join(uiSourceRoot, "components/button-variants.ts"), "utf8");
  const defaultVariant = source.match(/default:\s*\n?\s*"([^"]+)"/)?.[1];
  const brandVariant = source.match(/brand:\s*\n?\s*"([^"]+)"/)?.[1];

  assert.ok(defaultVariant);
  assert.ok(brandVariant);
  for (const variant of [defaultVariant, brandVariant]) {
    assert.match(variant, /border-transparent/);
    assert.match(variant, /bg-\[color:var\(--surface-button-brand\)\]/);
    assert.doesNotMatch(variant, /shadow/);
  }
  assert.match(defaultVariant, /text-\[color:var\(--foreground-button-brand\)\]/);
  assert.match(brandVariant, /!text-\[color:var\(--foreground-button-brand\)\]/);
});

test("standard package toolbar actions use the shared Button primitive", async () => {
  const relativePaths = [
    "packages/app-shell/src/components/app-header.tsx",
    "packages/module-admin/src/ui/toolbar-controls.tsx",
    "packages/module-crm/src/ui/toolbar-controls.tsx",
    "packages/module-marketing/src/ui/toolbar-controls.tsx",
    "packages/module-projects/src/ui/toolbar-controls.tsx",
  ];
  const files = await Promise.all(relativePaths.map(async (relativePath) => ({
    relativePath,
    source: await readFile(path.join(repoRoot, relativePath), "utf8"),
  })));

  for (const { relativePath, source } of files) {
    assert.match(source, /<Button\b/, `${relativePath} must use the shared Button primitive`);
    assert.doesNotMatch(
      source,
      /<button\b[^>]*className=[^>]*(?:bg-\[color:var\(--accent\)\]|font-extrabold)/,
      `${relativePath} must not recreate standard toolbar action styling on a native button`,
    );
  }
});

test("segmented controls expose selection, visible focus, and reduced Framer motion", async () => {
  const pillTabs = await readFile(path.join(appShellSourceRoot, "components/pill-tabs.tsx"), "utf8");
  const admin = await readFile(path.join(adminUiSourceRoot, "admin-users.tsx"), "utf8");

  for (const source of [pillTabs, admin]) {
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

test("module Marketing UI and stylesheet follow the BrightWeb typography and color hygiene rules", async () => {
  const files = [
    ...await sourcesAt(marketingUiSourceRoot),
    { filePath: marketingCssPath, source: await readFile(marketingCssPath, "utf8") },
  ];
  assertPatternAbsent(files, /\bfont-medium\b/, "font-medium is not part of the loaded weight ladder");
  assertPatternAbsent(files, /#[0-9a-f]{3,8}\b|rgba?\(|color-mix\(/i, "raw color recipes must be represented by theme or marketing tokens");
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

test("every canonical typography utility used by package UI exists in theme typography", async () => {
  const files = [...await sourcesAt(uiSourceRoot), ...await sourcesAt(appShellSourceRoot), ...await sourcesAt(adminUiSourceRoot), ...await sourcesAt(crmUiSourceRoot), ...await sourcesAt(projectsUiSourceRoot), ...await sourcesAt(marketingUiSourceRoot)];
  const typography = await readFile(typographyPath, "utf8");
  const canonicalRole = /(?<![-\w])text-(?:heading-[1-4]|title|body-lg|body|meta|label|micro|kpi(?:-lg)?|data(?:-sm)?|metric(?:-display|-lg)?)(?![-\w])/g;
  const providedUtilities = new Set(Array.from(typography.matchAll(/@utility\s+(text-(?!ui-)[a-z0-9-]+)/g), (match) => match[1]));
  const usedUtilities = new Set(files.flatMap(({ source }) => Array.from(source.matchAll(canonicalRole), (match) => match[0])));
  const missing = Array.from(usedUtilities).filter((utility) => !providedUtilities.has(utility)).sort();
  assert.deepEqual(missing, [], `Missing @utility definitions: ${missing.join(", ")}`);
});

test("package UI does not add new legacy or raw named typography classes", async () => {
  const coreAuthSourceRoot = path.join(repoRoot, "packages", "core-auth", "src");
  const files = [...await sourcesAt(coreAuthSourceRoot), ...await sourcesAt(uiSourceRoot), ...await sourcesAt(appShellSourceRoot), ...await sourcesAt(adminUiSourceRoot), ...await sourcesAt(crmUiSourceRoot), ...await sourcesAt(projectsUiSourceRoot), ...await sourcesAt(marketingUiSourceRoot), ...await sourcesAt(previewSourceRoot)];
  const violations = files.flatMap(({ filePath, source }) => {
    const patterns = [
      /(?<!--)\btext-ui-[a-z0-9-]+\b/g,
      /(?<!--)\bportal-(?:title(?:-sm)?|heading|panel-title|subhead|card-title|body|meta|label|micro|metric(?:-display|-xl)?)\b/g,
      /(?<![-\w])(?:heading-2|paragraph-(?:large|small|mini))(?![-\w])/g,
      /(?<![-\w])text-(?:xs|sm|base|lg|xl|[2-9]xl)(?![-\w])/g,
      /(?<![-\w])text-metric(?:-display|-lg)?(?![-\w])/g,
    ];
    return patterns.flatMap((pattern) => Array.from(source.matchAll(pattern), (match) => `${path.relative(repoRoot, filePath)}:${source.slice(0, match.index).split("\n").length} ${match[0]}`));
  });
  assert.deepEqual(violations, [], `Legacy/raw typography must migrate to canonical roles:\n${violations.join("\n")}`);
});

test("every core-auth component using auth-* classes reaches tokens.css through its imports", async () => {
  // Regression guard. tokens.css defines every .auth-* rule, but was imported
  // only by account-page.tsx — so the auth screens shipped unstyled unless a
  // session happened to load /account first. A class is useless if the
  // stylesheet defining it never enters the importing module's graph.
  const coreAuthRoot = path.join(repoRoot, "packages", "core-auth", "src");
  const coreAuthTokens = path.join(repoRoot, "packages", "core-auth", "tokens.css");
  const authClasses = new Set(
    Array.from((await readFile(coreAuthTokens, "utf8")).matchAll(/^\.(auth-[a-z0-9_-]+)/gm), (match) => match[1]),
  );

  const resolveLocalImport = async (fromFile: string, specifier: string) => {
    const base = path.resolve(path.dirname(fromFile), specifier);
    for (const candidate of [base, `${base}.tsx`, `${base}.ts`, path.join(base, "index.ts")]) {
      try {
        if ((await readFile(candidate, "utf8")) !== undefined) return candidate;
      } catch {
        // keep trying the remaining candidate extensions
      }
    }
    return null;
  };

  const importsTokens = async (filePath: string, seen = new Set<string>()): Promise<boolean> => {
    if (seen.has(filePath)) return false;
    seen.add(filePath);
    const source = await readFile(filePath, "utf8");
    if (/import\s+"[^"]*tokens\.css"/.test(source)) return true;
    const specifiers = Array.from(source.matchAll(/from\s+"(\.[^"]+)"/g), (match) => match[1]);
    for (const specifier of specifiers) {
      const resolved = await resolveLocalImport(filePath, specifier);
      if (resolved && !resolved.endsWith(".css") && await importsTokens(resolved, seen)) return true;
    }
    return false;
  };

  const files = await sourcesAt(coreAuthRoot);
  const offenders: string[] = [];
  for (const { filePath, source } of files) {
    if (!filePath.endsWith(".tsx")) continue;
    const used = Array.from(source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g))
      .flatMap((match) => (match[1] ?? match[2] ?? "").split(/\s+/))
      .filter((token) => authClasses.has(token));
    if (used.length === 0) continue;
    if (!(await importsTokens(filePath))) {
      offenders.push(`${path.relative(repoRoot, filePath)} uses ${[...new Set(used)].slice(0, 3).join(", ")}`);
    }
  }
  assert.deepEqual(offenders, [], `core-auth components must import tokens.css (directly or transitively):\n${offenders.join("\n")}`);
});

test("no module registration advertises a route owned by another module", async () => {
  // module-crm used to put an "Email Marketing" item at /admin/marketing in its
  // own nav. marketing depends on crm, never the reverse, so that inverted the
  // dependency and 404'd twice over: duplicated and wrong when marketing was
  // enabled, and pointing at an absent module when it was not.
  const owners: Record<string, RegExp> = {
    "module-crm": /^\/crm(\/|$)/,
    "module-marketing": /^\/marketing(\/|$)/,
    "module-admin": /^\/admin(\/|$)/,
    "module-projects": /^\/(projects|projetos|account)(\/|$)/,
    "module-orgs": /^\/(organizations|organizacoes)(\/|$)/,
  };
  const violations: string[] = [];
  for (const [pkg, ownPattern] of Object.entries(owners)) {
    const registrationPath = path.join(repoRoot, "packages", pkg, "src", "registration.ts");
    let source: string;
    try {
      source = await readFile(registrationPath, "utf8");
    } catch {
      continue;
    }
    // Only nav-bearing hrefs matter; toolbarRoutes match paths they do not link to.
    const navHrefs = Array.from(source.matchAll(/href:\s*"(\/[^"]*)"/g), (match) => match[1]);
    for (const href of navHrefs) {
      const ownedByAnother = Object.entries(owners).some(
        ([otherPkg, pattern]) => otherPkg !== pkg && pattern.test(href),
      );
      if (ownedByAnother && !ownPattern.test(href)) {
        violations.push(`${pkg} links ${href}, owned by another module`);
      }
    }
  }
  assert.deepEqual(violations, [], `Modules must only link their own routes:\n${violations.join("\n")}`);
});
