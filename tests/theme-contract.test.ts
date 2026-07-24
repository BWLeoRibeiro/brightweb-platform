import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const themeRoot = path.join(repoRoot, "packages", "theme");
const sourceRoot = path.join(themeRoot, "src");

async function read(relativePath: string) {
  return fs.readFile(path.join(themeRoot, relativePath), "utf8");
}

function stripComments(css: string) {
  return css.replaceAll(/\/\*[\s\S]*?\*\//g, "").trim();
}

function customProperties(css: string) {
  return new Set(Array.from(css.matchAll(/(--[a-z0-9-]+)\s*:/g), (match) => match[1]));
}

function scopedCustomProperties(css: string, selector: string) {
  const start = css.indexOf(selector);
  assert.notEqual(start, -1, `expected ${selector} scope`);
  const bodyStart = css.indexOf("{", start) + 1;
  const bodyEnd = css.indexOf("}", bodyStart);
  return new Map(Array.from(css.slice(bodyStart, bodyEnd).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g), ([, property, value]) => [property, value.trim()]));
}

function resolveHex(properties: Map<string, string>, property: string): string {
  const seen = new Set<string>();
  let value = properties.get(property);
  while (value?.startsWith("var(")) {
    const reference = value.match(/^var\((--[a-z0-9-]+)\)$/)?.[1];
    assert.ok(reference && !seen.has(reference), `expected resolvable ${property}`);
    seen.add(reference);
    value = properties.get(reference);
  }
  assert.match(value ?? "", /^#[0-9a-f]{6}$/i, `expected ${property} to resolve to a hex color`);
  return value!;
}

function rgb(hex: string) {
  return Array.from(hex.slice(1).matchAll(/../g), ([pair]) => Number.parseInt(pair, 16));
}

function composite(foreground: string, background: string, opacity: number) {
  const foregroundRgb = rgb(foreground);
  const backgroundRgb = rgb(background);
  return `#${foregroundRgb.map((channel, index) => Math.round(channel * opacity + backgroundRgb[index]! * (1 - opacity)).toString(16).padStart(2, "0")).join("")}`;
}

function relativeLuminance(hex: string) {
  const [red, green, blue] = rgb(hex).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

const tokenizedVisualContract = [
  "--text-ui-chip", "--text-ui-action", "--text-ui-shell-title", "--text-ui-report-title",
  "--text-ui-report-title-lg", "--text-ui-calendar", "--text-ui-report-metric",
  "--radius-swatch", "--radius-pill", "--radius-scrollbar", "--surface-overlay", "--surface-overlay-strong", "--surface-tooltip", "--surface-badge-tint",
  "--surface-button-soft", "--surface-button-soft-hover", "--border-button-soft-hover",
  "--surface-button-brand", "--foreground-accent-link",
  "--surface-selection", "--border-selection", "--surface-pagination-active", "--border-pagination-active",
  "--surface-danger-subtle", "--surface-account-team", "--surface-account-client", "--surface-account",
  "--surface-account-hover", "--account-presence", "--account-presence-size", "--row-hover-sweep",
  "--surface-status-success", "--surface-status-warning", "--surface-status-danger", "--scrollbar-thumb",
  "--scrollbar-thumb-hover", "--toast-success-bg", "--toast-success-border", "--toast-warning-bg",
  "--toast-warning-text", "--toast-warning-border", "--toast-error-bg", "--toast-error-border",
  "--toast-info-bg", "--toast-info-text", "--toast-info-border", "--shadow-accent-control",
  "--shadow-toolbar-control", "--shadow-toolbar-popover", "--shadow-tooltip", "--shadow-dialog",
  "--shadow-phone-dropdown", "--report-hero-glow", "--report-hero-rule", "--shell-frame-offset",
  "--shell-sidebar-width", "--shell-sidebar-collapsed-width", "--shell-sidebar-toggle-offset",
  "--shell-sidebar-toggle-size", "--shell-sidebar-toggle-inset", "--shell-brand-height",
  "--shell-nav-item-height", "--shell-nav-item-collapsed-size", "--shell-nav-icon-well-size", "--shell-nav-icon-radius",
  "--shell-nav-icon-size", "--shell-nav-divider-width", "--shell-nav-child-height",
  "--shell-nav-child-enter-offset", "--shell-nav-active-indicator-inset",
  "--shell-nav-active-indicator-collapsed-inset", "--shell-nav-active-indicator-width",
  "--shell-nav-active-indicator-offset",
  "--shell-nav-context-dot-size", "--shell-nav-context-dot-offset", "--shell-nav-context-dot-border",
  "--shell-header-divider-height", "--shell-account-gap", "--shell-account-padding-y",
  "--shell-surface-border", "--shell-surface-hover", "--shell-surface-active", "--shell-hairline",
  "--shell-icon-bg", "--shell-group-open", "--shell-shadow", "--shell-background",
  "--shell-sidebar-background", "--shell-control-muted", "--shell-nav-foreground",
  "--shell-nav-active-border", "--shell-nav-active-icon-bg", "--shell-nav-active-icon-fg",
  "--shell-nav-context-icon-bg", "--shell-nav-context-icon-fg", "--shell-nav-child-fg",
  "--shell-nav-child-icon-fg", "--shell-nav-child-active-bg", "--shell-nav-child-active-border",
  "--shell-navbar-fg", "--shell-navbar-muted", "--shell-navbar-hairline", "--toolbar-popover-width",
  "--toolbar-chip-height", "--toolbar-search-min-width", "--toolbar-icon-size", "--radius-toolbar-popover",
  "--crm-sidebar-gap", "--crm-report-copy-max-width", "--crm-report-metric-min-width",
  "--timeline-list-inset", "--timeline-line-offset", "--timeline-marker-offset", "--table-header-height",
  "--table-cell-padding-x", "--table-cell-padding-y", "--crm-table-viewport-offset",
  "--crm-table-min-height", "--crm-table-empty-min-height", "--report-stat-min-width", "--dialog-width",
  "--sheet-width", "--crm-sheet-width", "--menu-min-width", "--chart-tooltip-min-width",
  "--skeleton-line-height", "--skeleton-line-height-lg", "--skeleton-line-height-compact",
  "--skeleton-line-height-xs", "--section-icon-size", "--surface-enter-offset", "--space-eyebrow-y",
  "--scrollbar-size", "--tint-soft-border", "--tint-soft-bg", "--tint-soft-hover", "--tint-hero-border",
  "--tint-hero-bg", "--tint-hero-fg", "--tint-hero-hover",
] as const;

test("theme CSS keeps hex literals in palette files", async () => {
  const files = (await fs.readdir(sourceRoot)).filter((file) => file.endsWith(".css") && file !== "tokens.css");
  for (const file of files) {
    const css = await fs.readFile(path.join(sourceRoot, file), "utf8");
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i, `${file} must derive colors from tokens`);
  }
});

test("typography utilities do not poison consumer color utilities", async () => {
  const typography = await read("src/typography.css");
  const textUiUtilities = Array.from(typography.matchAll(/@utility\s+(text-ui-[a-z0-9-]+)\s*\{([^{}]*)\}/g));
  assert.ok(textUiUtilities.length > 0, "expected text-ui utilities in typography.css");
  for (const [, utility, body] of textUiUtilities) {
    assert.doesNotMatch(body, /(?:^|[;\s])color\s*:/, `${utility} must not set color`);
  }

  const aliases = await read("themes/mq-aliases.css");
  const paragraphBlock = aliases.match(/\.paragraph-large,\s*\.paragraph-small,\s*\.paragraph-mini\s*\{([^{}]*)\}/);
  assert.ok(paragraphBlock, "expected shared paragraph aliases");
  assert.doesNotMatch(paragraphBlock[1], /(?:^|[;\s])color\s*:/, "paragraph aliases must inherit color like MQ's originals");

  const mqParityColors = new Map([
    ["portal-micro", ["var(--muted-foreground)", 718]],
    ["portal-label", ["var(--muted-foreground)", 663]],
    ["portal-meta", ["var(--muted-foreground)", 711]],
    ["portal-body", ["var(--foreground)", 705]],
    ["portal-card-title", ["var(--foreground)", 654]],
    ["portal-subhead", ["var(--foreground)", 646]],
    ["portal-panel-title", ["var(--foreground)", 636]],
    ["portal-heading", ["var(--foreground)", 626]],
    ["portal-title-sm", ["var(--foreground)", 617]],
    ["portal-title", ["var(--foreground)", 606]],
    ["portal-metric", ["var(--foreground)", 673]],
    ["portal-metric-xl", ["var(--foreground)", 697]],
    ["portal-metric-display", ["var(--foreground)", 685]],
  ] as const);
  const portalUtilities = new Map(Array.from(aliases.matchAll(/@utility\s+(portal-[a-z0-9-]+)\s*\{([^{}]*)\}/g), ([, utility, body]) => [utility, body]));
  for (const [utility, [color, sourceLine]] of mqParityColors) {
    const body = portalUtilities.get(utility);
    assert.ok(body, `expected ${utility} in MQ aliases`);
    assert.match(body, new RegExp(`MQ parity: apps/portal/app/globals\\.css:${sourceLine}\\.`));
    assert.match(body, new RegExp(`color:\\s*${color.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*;`));
  }
});

test("the base reset contains one complete base layer and no outside rules", async () => {
  const css = stripComments(await read("src/base.css"));
  assert.match(css, /^@layer\s+base\s*\{/);
  assert.match(css, /button,\s*\n\s*input\s*\{\s*font:\s*inherit;/);

  const openingBrace = css.indexOf("{");
  let depth = 0;
  let closingBrace = -1;
  for (let index = openingBrace; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") depth -= 1;
    if (depth === 0) {
      closingBrace = index;
      break;
    }
  }
  assert.equal(closingBrace, css.length - 1, "all reset rules must be inside @layer base");
});

test("every Tailwind color mapping references a defined token", async () => {
  const tokens = customProperties(await read("src/tokens.css"));
  const theme = await read("src/theme.css");
  const mappings = Array.from(theme.matchAll(/--color-[a-z0-9-]+\s*:\s*var\((--[a-z0-9-]+)\)/g));
  assert.ok(mappings.length > 0, "expected color mappings in theme.css");
  for (const [, token] of mappings) {
    assert.ok(tokens.has(token), `${token} is referenced by theme.css but absent from tokens.css`);
  }
});

test("accessible muted foreground meets WCAG AA in default and MQ light/dark themes", async () => {
  for (const file of ["src/tokens.css", "themes/mq.css"]) {
    const css = await read(file);
    const root = scopedCustomProperties(css, ":root");
    const darkOverrides = scopedCustomProperties(css, ":root.dark");
    for (const [mode, overrides] of [["light", new Map<string, string>()], ["dark", darkOverrides]] as const) {
      const properties = new Map([...root, ...overrides]);
      const foreground = resolveHex(properties, "--foreground-muted-accessible");
      const card = resolveHex(properties, "--card");
      const inputSurface = composite(resolveHex(properties, "--foreground"), card, 0.05);
      assert.ok(contrastRatio(foreground, card) >= 4.5, `${file} ${mode} muted text must meet 4.5:1 on cards`);
      assert.ok(contrastRatio(foreground, inputSurface) >= 4.5, `${file} ${mode} placeholders must meet 4.5:1 on input surfaces`);
    }
  }
});

test("project risk and health aliases match MQ in light and dark themes", async () => {
  const tokens = await read("src/tokens.css");
  const sharedAliases = new Map([
    ["--project-risk-overdue-soft", "--semantic-danger-soft"],
    ["--project-health-on-track", "--project-state-active-strong"],
    ["--project-health-at-risk", "--project-risk-at-risk"],
    ["--project-health-at-risk-strong", "--project-risk-at-risk-strong"],
    ["--project-health-off-track", "--project-risk-overdue"],
    ["--project-health-progress", "--project-state-active"],
    ["--project-health-off-track-soft", "--project-risk-overdue-soft"],
  ]);
  for (const [alias, source] of sharedAliases) {
    const declaration = new RegExp(`${alias}:\\s*var\\(${source}\\);`, "g");
    assert.equal(Array.from(tokens.matchAll(declaration)).length, 2, `${alias} must have exact light and dark MQ aliases`);
  }
  assert.equal(Array.from(tokens.matchAll(/--project-health-off-track-strong:\s*var\(--project-risk-overdue-strong\);/g)).length, 1);
  assert.equal(Array.from(tokens.matchAll(/--project-health-off-track-strong:\s*var\(--project-risk-overdue\);/g)).length, 1);
});

test("tokenized package visuals have defaults and live consumers", async () => {
  const tokensCss = await read("src/tokens.css");
  const defaults = customProperties(tokensCss.slice(0, tokensCss.indexOf("/* Dark mode")));
  const packageRoots = ["app-shell", "module-crm", "theme", "ui"];
  const packageSources = (await Promise.all(packageRoots.map(async (packageName) => {
    const root = path.join(repoRoot, "packages", packageName, "src");
    const files: string[] = [];
    async function visit(directory: string) {
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) await visit(entryPath);
        else if (/\.(?:css|ts|tsx)$/.test(entry.name) && entry.name !== "tokens.css") files.push(await fs.readFile(entryPath, "utf8"));
      }
    }
    await visit(root);
    return files.join("\n");
  }))).join("\n");

  for (const token of tokenizedVisualContract) {
    assert.ok(defaults.has(token), `${token} must have a neutral default in tokens.css`);
    assert.ok(packageSources.includes(`var(${token})`), `${token} must have a package consumer`);
  }
});

test("the MQ theme contains only scoped custom-property overrides", async () => {
  const css = stripComments(await read("themes/mq.css"));
  const allowedSelectors = new Set([
    ":root",
    ':root.dark,\n:root[data-theme="dark"],\n.theme-dark',
    ':root.light,\n:root[data-theme="light"],\n.theme-light',
  ]);
  const blocks = Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g));
  assert.equal(blocks.length, 3, "MQ compatibility CSS must contain only root/light/dark scopes");
  for (const [, rawSelector, body] of blocks) {
    const selector = rawSelector.trim();
    assert.ok(allowedSelectors.has(selector), `unexpected MQ theme selector: ${selector}`);
    const declarations = body.split(";").map((entry) => entry.trim()).filter(Boolean);
    for (const declaration of declarations) {
      assert.match(declaration, /^--[a-z0-9-]+\s*:/, `${selector} may only set custom properties`);
    }
  }
});

test("module token files only alias semantic theme tokens", async () => {
  const packageEntries = await fs.readdir(path.join(repoRoot, "packages"), { withFileTypes: true });
  for (const entry of packageEntries.filter((candidate) => candidate.isDirectory() && candidate.name.startsWith("module-"))) {
    const packageRoot = path.join(repoRoot, "packages", entry.name);
    const manifestPath = path.join(packageRoot, "brightweb.module.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as { tokens?: string };
    if (!manifest.tokens) continue;
    const css = stripComments(await fs.readFile(path.join(packageRoot, manifest.tokens), "utf8"));
    const declarations = Array.from(css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g));
    assert.ok(declarations.length > 0, `${entry.name} token file must declare custom properties`);
    for (const [, token, value] of declarations) {
      assert.match(value.trim(), /^var\(--semantic-[a-z0-9-]+\)$/, `${entry.name} ${token} must alias one --semantic-* token`);
    }
  }
});
