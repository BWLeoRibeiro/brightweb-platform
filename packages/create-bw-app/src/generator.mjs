import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { stdout as output } from "node:process";
import { checkbox, confirm, input as promptInput, select } from "@inquirer/prompts";
import {
  APP_DEPENDENCY_DEFAULTS,
  APP_DEV_DEPENDENCY_DEFAULTS,
  CLI_DISPLAY_NAME,
  CORE_PACKAGES,
  DEFAULTS,
  SELECTABLE_MODULES,
  SITE_DEPENDENCY_DEFAULTS,
  SITE_DEV_DEPENDENCY_DEFAULTS,
  TEMPLATE_OPTIONS,
} from "./constants.mjs";

export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const TEMPLATE_ROOT = path.join(PACKAGE_ROOT, "template");
const TEMPLATE_SUPABASE_ROOT = path.join(TEMPLATE_ROOT, "supabase");
const TEMPLATE_KEY_SET = new Set(TEMPLATE_OPTIONS.map((templateOption) => templateOption.key));
const DEFAULT_DB_MODULE_REGISTRY = {
  modules: {
    core: { label: "Core", dependsOn: [] },
    admin: { label: "Admin", dependsOn: ["core"] },
    crm: { label: "CRM", dependsOn: ["core", "admin"] },
    projects: { label: "Projects", dependsOn: ["core", "admin", "crm"] },
  },
};

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function titleizeSlug(value) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseModulesInput(rawValue) {
  const normalized = rawValue.trim().toLowerCase();
  if (!normalized || normalized === "all") {
    return SELECTABLE_MODULES.map((moduleDefinition) => moduleDefinition.key);
  }

  if (normalized === "none") {
    return [];
  }

  const keys = normalized
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const knownKeys = new Set(SELECTABLE_MODULES.map((moduleDefinition) => moduleDefinition.key));
  const invalidKeys = keys.filter((key) => !knownKeys.has(key));
  if (invalidKeys.length > 0) {
    throw new Error(`Unknown module key(s): ${invalidKeys.join(", ")}`);
  }

  return Array.from(new Set(keys));
}

function parseTemplateInput(rawValue) {
  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "web") return "site";
  if (TEMPLATE_KEY_SET.has(normalized)) return normalized;
  throw new Error(`Unknown template: ${rawValue}`);
}

export function detectPackageManager(explicitManager) {
  if (explicitManager) return explicitManager;

  const userAgent = process.env.npm_config_user_agent || "";
  if (userAgent.startsWith("pnpm/")) return "pnpm";
  if (userAgent.startsWith("npm/")) return "npm";
  if (userAgent.startsWith("yarn/")) return "yarn";
  if (userAgent.startsWith("bun/")) return "bun";
  return "pnpm";
}

export function sortObjectKeys(inputObject) {
  return Object.fromEntries(
    Object.entries(inputObject).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
  );
}

export async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonIfPresent(filePath) {
  if (!(await pathExists(filePath))) {
    return null;
  }

  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function getDbModuleRegistry(workspaceRoot) {
  const candidatePaths = [];

  if (workspaceRoot) {
    candidatePaths.push(path.join(workspaceRoot, "supabase", "module-registry.json"));
  }

  candidatePaths.push(path.join(TEMPLATE_SUPABASE_ROOT, "module-registry.json"));

  for (const registryPath of candidatePaths) {
    const registry = await readJsonIfPresent(registryPath);
    if (registry) {
      return registry;
    }
  }

  return DEFAULT_DB_MODULE_REGISTRY;
}

function resolveModuleOrder(registry, enabledModules) {
  const resolved = [];
  const visited = new Set();
  const visiting = new Set();

  function visit(moduleKey) {
    if (visited.has(moduleKey)) return;
    if (visiting.has(moduleKey)) {
      throw new Error(`Circular module dependency detected at "${moduleKey}".`);
    }

    const moduleConfig = registry.modules?.[moduleKey];
    if (!moduleConfig) {
      throw new Error(`Unknown database module "${moduleKey}".`);
    }

    visiting.add(moduleKey);
    for (const dependency of moduleConfig.dependsOn || []) {
      visit(dependency);
    }
    visiting.delete(moduleKey);
    visited.add(moduleKey);
    resolved.push(moduleKey);
  }

  for (const moduleKey of enabledModules) {
    visit(moduleKey);
  }

  return resolved;
}

function getSelectedModuleLabels(selectedModules) {
  return selectedModules.map((moduleKey) => {
    return getModuleLabel(moduleKey);
  });
}

function getModuleLabel(moduleKey) {
  const moduleDefinition = SELECTABLE_MODULES.find((candidate) => candidate.key === moduleKey);
  if (moduleDefinition) {
    return moduleDefinition.label;
  }

  if (moduleKey === "core") {
    return "Core";
  }

  return titleizeSlug(moduleKey);
}

export function createDbInstallPlan({ selectedModules, workspaceMode, registry }) {
  void workspaceMode;
  const activeRegistry = registry?.modules ? registry : DEFAULT_DB_MODULE_REGISTRY;
  const requestedModules = Array.from(new Set(["core", ...selectedModules]));
  if (!requestedModules.includes("admin")) {
    requestedModules.push("admin");
  }

  const resolvedOrder = resolveModuleOrder(activeRegistry, requestedModules);
  const notes = [];

  if (!selectedModules.includes("admin") && resolvedOrder.includes("admin")) {
    notes.push("Platform always resolves to the Core + Admin database baseline; selecting Admin only controls whether the Admin starter UI and package wiring are scaffolded.");
  }

  for (const moduleKey of resolvedOrder) {
    if (moduleKey === "core" || selectedModules.includes(moduleKey) || moduleKey === "admin") {
      continue;
    }

    const dependents = resolvedOrder.filter((candidateKey) => {
      const dependencyList = activeRegistry.modules?.[candidateKey]?.dependsOn || [];
      return dependencyList.includes(moduleKey);
    });

    if (dependents.length === 0) continue;

    const dependentLabels = dependents
      .map((candidateKey) => activeRegistry.modules?.[candidateKey]?.label || getModuleLabel(candidateKey))
      .join(", ");
    const moduleLabel = activeRegistry.modules?.[moduleKey]?.label || getModuleLabel(moduleKey);
    notes.push(`${moduleLabel} is included because ${dependentLabels} depends on it.`);
  }

  return {
    selectedLabels: getSelectedModuleLabels(selectedModules),
    resolvedOrder,
    notes,
  };
}

export async function getVersionMap(workspaceRoot) {
  const versionMap = {
    ...APP_DEPENDENCY_DEFAULTS,
    ...APP_DEV_DEPENDENCY_DEFAULTS,
    ...SITE_DEPENDENCY_DEFAULTS,
    ...SITE_DEV_DEPENDENCY_DEFAULTS,
  };

  if (!workspaceRoot) {
    return versionMap;
  }

  const previewManifestPath = path.join(workspaceRoot, "apps", "platform-preview", "package.json");
  const previewManifest = await readJsonIfPresent(previewManifestPath);
  if (previewManifest) {
    Object.assign(versionMap, previewManifest.dependencies || {}, previewManifest.devDependencies || {});
  }

  for (const packageName of [
    "@brightweblabs/app-shell",
    "@brightweblabs/core-auth",
    "@brightweblabs/infra",
    "@brightweblabs/module-admin",
    "@brightweblabs/module-crm",
    "@brightweblabs/module-projects",
    "@brightweblabs/ui",
  ]) {
    const folderName = packageName.replace("@brightweblabs/", "");
    const packageManifestPath = path.join(workspaceRoot, "packages", folderName, "package.json");
    const packageManifest = await readJsonIfPresent(packageManifestPath);
    if (packageManifest?.version) {
      versionMap[packageName] = `^${packageManifest.version}`;
    }
  }

  return versionMap;
}

function createDerivedBrandValues(slug) {
  const projectName = titleizeSlug(slug);

  return {
    companyName: projectName,
    productName: `${projectName} ${DEFAULTS.productNameSuffix}`,
    tagline: DEFAULTS.tagline,
    contactEmail: DEFAULTS.contactEmail,
    supportEmail: DEFAULTS.supportEmail,
    primaryHex: DEFAULTS.primaryHex,
  };
}

function createPlatformBrandConfigFile({ slug, brandValues }) {
  return [
    "export type StarterBrandConfig = {",
    "  companyName: string;",
    "  productName: string;",
    "  slug: string;",
    "  tagline: string;",
    "  contactEmail: string;",
    "  supportEmail: string;",
    "  primaryHex: string;",
    "};",
    "",
    "export const starterBrandConfig: StarterBrandConfig = {",
    `  companyName: ${JSON.stringify(brandValues.companyName)},`,
    `  productName: ${JSON.stringify(brandValues.productName)},`,
    `  slug: ${JSON.stringify(slug)},`,
    `  tagline: ${JSON.stringify(brandValues.tagline)},`,
    `  contactEmail: ${JSON.stringify(brandValues.contactEmail)},`,
    `  supportEmail: ${JSON.stringify(brandValues.supportEmail)},`,
    `  primaryHex: ${JSON.stringify(brandValues.primaryHex)},`,
    "};",
    "",
  ].join("\n");
}

export function createPlatformModulesConfigFile(selectedModules) {
  const selected = new Set(selectedModules);

  return [
    'export type StarterModuleKey = "core-auth" | "crm" | "projects" | "admin";',
    "",
    "export type StarterModuleConfig = {",
    "  key: StarterModuleKey;",
    "  label: string;",
    "  description: string;",
    "  enabled: boolean;",
    "  packageName: string;",
    "  playgroundHref?: string;",
    '  placement: "core" | "primary" | "admin";',
    "};",
    "",
    "export const starterModuleConfig: StarterModuleConfig[] = [",
    "  {",
    '    key: "core-auth",',
    '    label: "Core Auth",',
    '    description: "Login, reset-password, callback URLs, and shared auth validation utilities.",',
    "    enabled: true,",
    '    packageName: "@brightweblabs/core-auth",',
    '    playgroundHref: "/playground/auth",',
    '    placement: "core",',
    "  },",
    "  {",
    '    key: "crm",',
    '    label: "CRM",',
    '    description: "Contacts and CRM server/data layer, with marketing-adjacent operational data stored in Supabase.",',
    `    enabled: ${String(selected.has("crm"))},`,
    '    packageName: "@brightweblabs/module-crm",',
    '    playgroundHref: "/playground/crm",',
    '    placement: "primary",',
    "  },",
    "  {",
    '    key: "projects",',
    '    label: "Projects",',
    '    description: "Project portfolio, detail routes, and work-management server logic.",',
    `    enabled: ${String(selected.has("projects"))},`,
    '    packageName: "@brightweblabs/module-projects",',
    '    playgroundHref: "/playground/projects",',
    '    placement: "primary",',
    "  },",
    "  {",
    '    key: "admin",',
    '    label: "Admin",',
    '    description: "User role governance, admin tools, and access-control surfaces.",',
    `    enabled: ${String(selected.has("admin"))},`,
    '    packageName: "@brightweblabs/module-admin",',
    '    playgroundHref: "/playground/admin",',
    '    placement: "admin",',
    "  },",
    "];",
    "",
    "export function getEnabledStarterModules() {",
    "  return starterModuleConfig.filter((moduleConfig) => moduleConfig.enabled);",
    "}",
    "",
  ].join("\n");
}

function createEnvFileContent() {
  return [
    "NEXT_PUBLIC_APP_URL=http://localhost:3000",
    "NEXT_PUBLIC_SUPABASE_URL=",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=",
    "SUPABASE_SECRET_DEFAULT_KEY=",
    "RESEND_API_KEY=",
    "RESEND_FROM_TRANSACTIONAL=",
    "RESEND_FROM_MARKETING=",
    "CONTACT_TO_EMAIL=",
    "RESEND_WEBHOOK_SECRET=",
    "MARKETING_WORKER_SECRET=",
    "MARKETING_TEST_EMAIL=",
    "",
  ].join("\n");
}

function createGitignore() {
  return [
    "# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.",
    "",
    "# dependencies",
    "/node_modules",
    "/.pnp",
    ".pnp.*",
    ".yarn/*",
    "!.yarn/patches",
    "!.yarn/plugins",
    "!.yarn/releases",
    "!.yarn/versions",
    "",
    "# testing",
    "/coverage",
    "",
    "# next.js",
    "/.next/",
    "/out/",
    "",
    "# production",
    "/build",
    "",
    "# misc",
    ".DS_Store",
    "*.pem",
    "",
    "# debug",
    "npm-debug.log*",
    "yarn-debug.log*",
    "yarn-error.log*",
    ".pnpm-debug.log*",
    "",
    "# env files",
    ".env*",
    "",
    "# vercel",
    ".vercel",
    "",
    "# typescript",
    "*.tsbuildinfo",
    "next-env.d.ts",
    "",
  ].join("\n");
}

function getPlatformStarterRoutes(selectedModules) {
  return [
    "/",
    "/bootstrap",
    "/preview/app-shell",
    "/playground/auth",
    ...selectedModules.map((moduleKey) => `/playground/${moduleKey}`),
  ];
}

function getSiteStarterRoutes() {
  return ["/"];
}

function createPlatformReadme({
  slug,
  selectedModules,
  workspaceMode,
  packageManager,
  dbInstallPlan,
}) {
  const moduleLines = SELECTABLE_MODULES.map((moduleDefinition) => {
    const enabled = selectedModules.includes(moduleDefinition.key);
    return `- ${moduleDefinition.key}: ${enabled ? "enabled" : "disabled"}`;
  });
  const resolvedDbStackLines = dbInstallPlan.resolvedOrder.map((moduleKey) => `- ${getModuleLabel(moduleKey)}`);
  const dependencyNotes = dbInstallPlan.notes.map((note) => `- ${note}`);

  const localSteps = workspaceMode
    ? [
        "1. Review `.env.local` and fill in real service credentials.",
        "2. Run `pnpm install` from the BrightWeb workspace root.",
        `3. Run \`pnpm --filter ${slug} dev\`.`,
      ]
    : [
        "1. Review `.env.local` and fill in real service credentials.",
        `2. Run \`${packageManager} install\`.`,
        `3. Run \`${packageManager} dev\`.`,
      ];

  return [
    `# ${titleizeSlug(slug)}`,
    "",
    `Project scaffolded with ${CLI_DISPLAY_NAME}.`,
    "",
    "## Local setup",
    "",
    ...localSteps,
    "",
    "## Enabled modules",
    "",
    ...moduleLines,
    "",
    "## Resolved database stack",
    "",
    ...resolvedDbStackLines,
    "",
    ...(workspaceMode
      ? []
      : [
          "Bundled Supabase SQL migrations live under `supabase/modules/<module>/migrations`.",
          "",
        ]),
    ...(dependencyNotes.length > 0
      ? [
          "## Dependency notes",
          "",
          ...dependencyNotes,
          "",
        ]
      : []),
    "## Starter routes",
    "",
    ...getPlatformStarterRoutes(selectedModules).map((route) => `- \`${route}\``),
    "",
    "## AI handoff",
    "",
    "- `AGENTS.md`",
    "- `docs/ai/README.md`",
    "- `docs/ai/examples.md`",
    "- `docs/ai/app-context.json`",
    "",
  ].join("\n");
}

function createSiteReadme({ slug, workspaceMode, packageManager }) {
  const localSteps = workspaceMode
    ? [
        "1. Run `pnpm install` from the BrightWeb workspace root.",
        `2. Run \`pnpm --filter ${slug} dev\`.`,
      ]
    : [
        `1. Run \`${packageManager} install\`.`,
        `2. Run \`${packageManager} dev\`.`,
      ];

  return [
    `# ${titleizeSlug(slug)}`,
    "",
    `Site scaffolded with ${CLI_DISPLAY_NAME}.`,
    "",
    "## Stack",
    "",
    "- Next.js App Router",
    "- Tailwind CSS v4",
    "- Local shadcn-style component primitives",
    "",
    "## Local setup",
    "",
    ...localSteps,
    "",
    "## Starter surfaces",
    "",
    ...getSiteStarterRoutes().map((route) => `- \`${route}\``),
    "",
    "Edit `config/site.ts` to change the site name, copy, and public links.",
    "",
    "## AI handoff",
    "",
    "- `AGENTS.md`",
    "- `docs/ai/README.md`",
    "- `docs/ai/examples.md`",
    "- `docs/ai/app-context.json`",
    "",
  ].join("\n");
}

export function createAppContextFile({
  slug,
  template,
  selectedModules = [],
  dbInstallPlan = { resolvedOrder: [] },
}) {
  if (template === "site") {
    return `${JSON.stringify(
      {
        schemaVersion: 1,
        template: "site",
        app: {
          slug,
          name: titleizeSlug(slug),
        },
        docs: {
          agentGuide: "AGENTS.md",
          routingGuide: "docs/ai/README.md",
          setupGuide: "README.md",
          examples: "docs/ai/examples.md",
        },
        paths: {
          readFirst: [
            "AGENTS.md",
            "docs/ai/README.md",
            "README.md",
            "config/site.ts",
            "app/page.tsx",
            "app/globals.css",
          ],
          appRoutesRoot: "app",
          configRoot: "config",
          componentsRoot: "components",
          uiComponentsRoot: "components/ui",
          libRoot: "lib",
        },
        starterRoutes: getSiteStarterRoutes(),
        ownership: {
          appOwned: [
            "app/**",
            "components/**",
            "config/**",
            "docs/ai/**",
            "lib/**",
            "public/**",
            "AGENTS.md",
            "README.md",
          ],
          packageOwned: [],
        },
        agentRules: {
          editConfigBeforeCopyTweaks: true,
          keepUiPrimitiveChangesLocal: true,
          treatStarterHomeAsAppOwned: true,
        },
      },
      null,
      2,
    )}\n`;
  }

  return `${JSON.stringify(
    {
      schemaVersion: 1,
      template: "platform",
      app: {
        slug,
        name: titleizeSlug(slug),
      },
      modules: {
        enabled: selectedModules,
        resolvedDatabaseStack: dbInstallPlan.resolvedOrder,
      },
      docs: {
        agentGuide: "AGENTS.md",
        routingGuide: "docs/ai/README.md",
        setupGuide: "README.md",
        examples: "docs/ai/examples.md",
      },
      paths: {
        readFirst: [
          "AGENTS.md",
          "docs/ai/README.md",
          "README.md",
          "config/brand.ts",
          "config/modules.ts",
          "config/client.ts",
          "config/bootstrap.ts",
          "config/shell.ts",
          ".env.local",
        ],
        appRoutesRoot: "app",
        componentsRoot: "components",
        configRoot: "config",
        brandAssetsRoot: "public/brand",
      },
      starterRoutes: getPlatformStarterRoutes(selectedModules),
      ownership: {
        appOwned: [
          "app/**",
          "components/**",
          "config/**",
          "docs/ai/**",
          "public/brand/**",
          "AGENTS.md",
          "README.md",
        ],
        packageOwned: [
          ...CORE_PACKAGES,
          ...SELECTABLE_MODULES
            .filter((moduleDefinition) => selectedModules.includes(moduleDefinition.key))
            .map((moduleDefinition) => moduleDefinition.packageName),
        ],
      },
      agentRules: {
        checkModulesBeforeEditing: true,
        preferAppLevelCompositionOverPackageForks: true,
        treatStarterRoutesAsRemovable: true,
      },
    },
    null,
    2,
  )}\n`;
}

export function createPackageJson({
  slug,
  dependencyMode,
  selectedModules,
  versionMap,
  template,
}) {
  if (template === "site") {
    return {
      name: slug,
      private: true,
      version: "0.0.0",
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "tsc --noEmit",
      },
      dependencies: sortObjectKeys({
        "class-variance-authority": versionMap["class-variance-authority"],
        "clsx": versionMap.clsx,
        "lucide-react": versionMap["lucide-react"],
        "next": versionMap.next,
        "react": versionMap.react,
        "react-dom": versionMap["react-dom"],
        "tailwind-merge": versionMap["tailwind-merge"],
      }),
      devDependencies: sortObjectKeys({
        "@tailwindcss/postcss": versionMap["@tailwindcss/postcss"],
        "@types/node": versionMap["@types/node"],
        "@types/react": versionMap["@types/react"],
        "@types/react-dom": versionMap["@types/react-dom"],
        "tailwindcss": versionMap.tailwindcss,
        "typescript": versionMap.typescript,
      }),
    };
  }

  const internalDependencyVersion = (packageName) =>
    dependencyMode === "workspace" ? "workspace:*" : versionMap[packageName];

  const dependencies = {
    "@brightweblabs/app-shell": internalDependencyVersion("@brightweblabs/app-shell"),
    "@brightweblabs/core-auth": internalDependencyVersion("@brightweblabs/core-auth"),
    "@brightweblabs/infra": internalDependencyVersion("@brightweblabs/infra"),
    "@brightweblabs/ui": internalDependencyVersion("@brightweblabs/ui"),
    "lucide-react": versionMap["lucide-react"],
    "next": versionMap.next,
    "react": versionMap.react,
    "react-dom": versionMap["react-dom"],
  };

  for (const moduleDefinition of SELECTABLE_MODULES) {
    if (selectedModules.includes(moduleDefinition.key)) {
      dependencies[moduleDefinition.packageName] = internalDependencyVersion(moduleDefinition.packageName);
    }
  }

  return {
    name: slug,
    private: true,
    version: "0.0.0",
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "tsc --noEmit",
    },
    dependencies: sortObjectKeys(dependencies),
    devDependencies: sortObjectKeys({
      "@tailwindcss/postcss": versionMap["@tailwindcss/postcss"],
      "@types/node": versionMap["@types/node"],
      "@types/react": versionMap["@types/react"],
      "@types/react-dom": versionMap["@types/react-dom"],
      tailwindcss: versionMap.tailwindcss,
      typescript: versionMap.typescript,
    }),
  };
}

export function createNextConfig({ template, selectedModules }) {
  if (template === "site") {
    return [
      'import type { NextConfig } from "next";',
      "",
      "const nextConfig: NextConfig = {};",
      "",
      "export default nextConfig;",
      "",
    ].join("\n");
  }

  const transpilePackages = [...CORE_PACKAGES];

  for (const moduleDefinition of SELECTABLE_MODULES) {
    if (selectedModules.includes(moduleDefinition.key)) {
      transpilePackages.push(moduleDefinition.packageName);
    }
  }

  return [
    'import type { NextConfig } from "next";',
    "",
    "const nextConfig: NextConfig = {",
    "  transpilePackages: [",
    ...transpilePackages.map((packageName) => `    "${packageName}",`),
    "  ],",
    "};",
    "",
    "export default nextConfig;",
    "",
  ].join("\n");
}

export function createShellConfig(selectedModules) {
  const importLines = [];
  const registrationLines = [];

  if (selectedModules.includes("admin")) {
    importLines.push('import { adminModuleRegistration } from "@brightweblabs/module-admin/registration";');
    registrationLines.push('  if (enabled.has("admin")) registrations.push(adminModuleRegistration);');
  }

  if (selectedModules.includes("crm")) {
    importLines.push('import { crmModuleRegistration } from "@brightweblabs/module-crm/registration";');
    registrationLines.push('  if (enabled.has("crm")) registrations.push(crmModuleRegistration);');
  }

  if (selectedModules.includes("projects")) {
    importLines.push('import { projectsModuleRegistration } from "@brightweblabs/module-projects/registration";');
    registrationLines.push('  if (enabled.has("projects")) registrations.push(projectsModuleRegistration);');
  }

  return [
    'import { LayoutDashboard, Wrench } from "lucide-react";',
    "import {",
    "  buildClientAppShellRegistration,",
    "  resolveClientAppShellConfig,",
    "  type ClientAppShellRegistration,",
    "  type ShellContextualAction,",
    "  type ShellModuleRegistration,",
    '} from "@brightweblabs/app-shell";',
    ...importLines,
    'import { starterBrandConfig } from "./brand";',
    'import { getEnabledStarterModules } from "./modules";',
    "",
    "const dashboardModuleRegistration: ShellModuleRegistration<ShellContextualAction> = {",
    '  key: "dashboard",',
    '  placement: "primary",',
    '  navItems: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],',
    '  toolbarRoutes: [{ surface: "dashboard", match: { exact: ["/dashboard"] } }],',
    "};",
    "",
    "function getStarterModuleRegistrations() {",
    '  const enabled = new Set(getEnabledStarterModules().map((moduleConfig) => moduleConfig.key));',
    "  const registrations: ShellModuleRegistration<ShellContextualAction>[] = [dashboardModuleRegistration];",
    "",
    ...registrationLines,
    "",
    "  return registrations;",
    "}",
    "",
    "export function getStarterShellConfig() {",
    "  const enabledModules = getEnabledStarterModules();",
    "  const shellRegistration: ClientAppShellRegistration<ShellContextualAction> = {",
    "    brand: {",
    '      href: "/",',
    '      ariaLabel: `${starterBrandConfig.companyName} public site`,',
    "      alt: starterBrandConfig.companyName,",
    "      collapsedLogo: {",
    '        src: "/brand/logo-mark.svg",',
    "        width: 48,",
    "        height: 48,",
    "      },",
    "      lightLogo: {",
    '        src: "/brand/logo-light.svg",',
    "        width: 176,",
    "        height: 44,",
    "      },",
    "      darkLogo: {",
    '        src: "/brand/logo-dark.svg",',
    "        width: 176,",
    "        height: 44,",
    "      },",
    "    },",
    "    toolsSection: {",
    '      key: "tools",',
    '      label: "Ferramentas",',
    "      icon: Wrench,",
    '      collapsedHref: enabledModules.find((moduleConfig) => moduleConfig.playgroundHref)?.playgroundHref || "/",',
    "    },",
    "    modules: getStarterModuleRegistrations(),",
    "  };",
    "",
    "  const builtRegistration = buildClientAppShellRegistration(shellRegistration);",
    "  const shellPreview = resolveClientAppShellConfig(builtRegistration.shellConfig, {",
    "    isAdmin: true,",
    "    isStaff: true,",
    "  });",
    "",
    "  return {",
    "    enabledModules,",
    "    shellConfig: builtRegistration.shellConfig,",
    "    shellPreview,",
    "    toolbarRoutes: builtRegistration.toolbarRoutes,",
    "  };",
    "}",
    "",
  ].join("\n");
}

function createSiteConfigFile(slug) {
  const siteName = titleizeSlug(slug);

  return [
    "export const siteConfig = {",
    `  name: "${siteName}",`,
    '  description: "A refined BrightWeb site starter built with Next.js and Tailwind CSS.",',
    '  eyebrow: "BrightWeb Site Starter",',
    '  primaryCta: { label: "Start a project", href: "mailto:hello@example.com" },',
    '  secondaryCta: { label: "See the build notes", href: "#process" },',
    "};",
    "",
  ].join("\n");
}

async function copyDirectory(sourceDir, targetDir) {
  await fs.cp(sourceDir, targetDir, { recursive: true });
}

async function copyFileIfPresent(sourcePath, targetPath) {
  if (!(await pathExists(sourcePath))) {
    return;
  }

  await ensureDirectory(path.dirname(targetPath));
  await fs.copyFile(sourcePath, targetPath);
}

export async function ensureDirectory(targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
}

function createGeneratedSupabaseConfig(projectId) {
  return [
    `project_id = "${projectId}"`,
    "",
    "[db]",
    "major_version = 17",
    "",
    "[db.migrations]",
    "enabled = true",
    'schema_paths = []',
    "",
    "[db.seed]",
    "enabled = false",
    'sql_paths = []',
    "",
  ].join("\n");
}

function createScopedDbModuleRegistry(registry, moduleKeys) {
  return {
    modules: Object.fromEntries(
      moduleKeys
        .map((moduleKey) => [moduleKey, registry.modules?.[moduleKey]])
        .filter(([, moduleConfig]) => Boolean(moduleConfig)),
    ),
  };
}

async function writeClientStack(baseRoot, slug, dbInstallPlan, options = {}) {
  const generatedInWorkspaceMode = options.workspaceMode === true;
  const clientDir = path.join(baseRoot, "supabase", "clients", slug);
  const stackPath = path.join(clientDir, "stack.json");
  const migrationsDir = path.join(clientDir, "migrations");
  const enabledModules = dbInstallPlan.resolvedOrder;

  if (await pathExists(stackPath)) {
    throw new Error(`Client stack already exists: ${stackPath}`);
  }

  await ensureDirectory(migrationsDir);
  await fs.writeFile(path.join(migrationsDir, ".gitkeep"), "", "utf8");
  await fs.writeFile(
    stackPath,
    `${JSON.stringify(
      {
        client: {
          slug,
          label: titleizeSlug(slug),
        },
        historyMode: "greenfield-modular",
        futureMode: "forward-only-modular",
        enabledModules,
        clientMigrationPath: `supabase/clients/${slug}/migrations`,
        notes: [
          generatedInWorkspaceMode
            ? "Generated by create-bw-app in workspace mode."
            : "Generated by create-bw-app in published mode.",
          `Selected app modules: ${dbInstallPlan.selectedLabels.length > 0 ? dbInstallPlan.selectedLabels.join(", ") : "none"}.`,
          `Resolved database stack: ${enabledModules.map((moduleKey) => getModuleLabel(moduleKey)).join(" -> ")}.`,
          "Platform always resolves to the Core + Admin database baseline; selecting Admin only controls whether the Admin starter UI and package wiring are scaffolded.",
          "The database install order is resolved from supabase/module-registry.json.",
        ],
      },
      null,
      2,
    )}\n`,
  );
}

async function writeSupabaseCliMigrations({ targetDir, dbInstallPlan }) {
  const targetSupabaseDir = path.join(targetDir, "supabase");
  const targetMigrationsDir = path.join(targetSupabaseDir, "migrations");

  await ensureDirectory(targetMigrationsDir);
  await fs.writeFile(path.join(targetSupabaseDir, "config.toml"), createGeneratedSupabaseConfig(path.basename(targetDir)), "utf8");

  let sequence = 1;
  for (const moduleKey of dbInstallPlan.resolvedOrder) {
    const sourceModuleDir = path.join(TEMPLATE_SUPABASE_ROOT, "modules", moduleKey, "migrations");
    if (!(await pathExists(sourceModuleDir))) {
      continue;
    }

    const fileNames = (await fs.readdir(sourceModuleDir))
      .filter((fileName) => fileName.endsWith(".sql"))
      .sort();

    for (const fileName of fileNames) {
      const targetFileName = `${String(sequence).padStart(4, "0")}_${moduleKey}__${fileName}`;
      await fs.copyFile(
        path.join(sourceModuleDir, fileName),
        path.join(targetMigrationsDir, targetFileName),
      );
      sequence += 1;
    }
  }
}

async function writeBundledSupabaseBaseline({ targetDir, slug, dbInstallPlan, registry }) {
  const shippedModuleKeys = dbInstallPlan.resolvedOrder;
  if (shippedModuleKeys.length === 0) {
    return;
  }

  const targetSupabaseDir = path.join(targetDir, "supabase");
  const targetModulesDir = path.join(targetSupabaseDir, "modules");
  const scopedRegistry = createScopedDbModuleRegistry(registry, shippedModuleKeys);

  await ensureDirectory(targetModulesDir);
  await copyFileIfPresent(path.join(TEMPLATE_SUPABASE_ROOT, "README.md"), path.join(targetSupabaseDir, "README.md"));
  await copyFileIfPresent(
    path.join(TEMPLATE_SUPABASE_ROOT, "clients", "README.md"),
    path.join(targetSupabaseDir, "clients", "README.md"),
  );
  await fs.writeFile(
    path.join(targetSupabaseDir, "module-registry.json"),
    `${JSON.stringify(scopedRegistry, null, 2)}\n`,
    "utf8",
  );

  for (const moduleKey of shippedModuleKeys) {
    await copyDirectory(
      path.join(TEMPLATE_SUPABASE_ROOT, "modules", moduleKey),
      path.join(targetModulesDir, moduleKey),
    );
  }

  await writeClientStack(targetDir, slug, dbInstallPlan);
  await writeSupabaseCliMigrations({ targetDir, dbInstallPlan });
}

export async function runInstall(command, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, ["install"], {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Install command failed with exit code ${code ?? "unknown"}.`));
    });
  });
}

function renderPlanSummary({
  targetDir,
  dependencyMode,
  selectedModules,
  packageManager,
  workspaceMode,
  install,
  template,
  dbInstallPlan,
}) {
  const installLocation = workspaceMode ? "workspace root" : "project directory";
  const templateLabel = TEMPLATE_OPTIONS.find((templateOption) => templateOption.key === template)?.label || template;
  const selectedModuleSummary =
    template === "platform"
      ? dbInstallPlan.selectedLabels.length > 0
        ? dbInstallPlan.selectedLabels.join(", ")
        : "none"
      : "n/a";

  return [
    `Template: ${templateLabel}`,
    `Target directory: ${targetDir}`,
    `Dependency mode: ${dependencyMode}`,
    `Selected modules: ${selectedModuleSummary}`,
    ...(template === "platform" && workspaceMode
      ? [
          `Resolved database stack: ${dbInstallPlan.resolvedOrder.map((moduleKey) => getModuleLabel(moduleKey)).join(" -> ")}`,
          ...dbInstallPlan.notes.map((note) => `- ${note}`),
        ]
      : []),
    `Install dependencies: ${install ? `yes (${packageManager} in ${installLocation})` : "no"}`,
  ].join("\n");
}

async function collectAnswers(argvOptions, runtimeOptions) {
  const slugFromFlag = argvOptions.name || argvOptions.slug;
  const slug = slugify(slugFromFlag || "");

  if (!slug && argvOptions.yes) {
    throw new Error("`--yes` requires `--name` or `--slug`.");
  }

  output.write(`\n${runtimeOptions.banner || "BrightWeb app installer"}\n\n`);

  const templateFromFlag = argvOptions.template ? parseTemplateInput(argvOptions.template) : null;
  const template = templateFromFlag
    || (argvOptions.yes
      ? "platform"
      : await select({
        message: "What kind of app are you creating?",
        default: "platform",
        choices: TEMPLATE_OPTIONS.map((templateOption) => ({
          value: templateOption.key,
          name: templateOption.label,
          description: templateOption.description,
        })),
      }));

  const resolvedSlug = slug || slugify(await promptInput({ message: "What is your project named?" }));
  if (!resolvedSlug) {
    throw new Error("A valid project name is required.");
  }

  let selectedModules = [];

  if (template === "platform") {
    const askedModules = [];
    if (!argvOptions.modules && !argvOptions.yes) {
      const selectedByPrompt = await checkbox({
        message: "Which modules should be installed?",
        choices: SELECTABLE_MODULES.map((moduleDefinition) => ({
          value: moduleDefinition.key,
          name: moduleDefinition.label,
          description: `Install ${moduleDefinition.label} routes, config wiring, and package dependencies.`,
        })),
      });

      askedModules.push(...selectedByPrompt);
    }

    selectedModules = argvOptions.modules
      ? parseModulesInput(argvOptions.modules)
      : argvOptions.yes
        ? []
        : askedModules;
  }

  const install =
    typeof argvOptions.install === "boolean"
      ? argvOptions.install
      : argvOptions.yes
        ? true
        : await confirm({
          message: "Install dependencies now?",
          default: true,
        });

  return {
    slug: resolvedSlug,
    template,
    selectedModules,
    install,
  };
}

function resolveTargetDirectory(runtimeOptions, answers) {
  if (runtimeOptions.targetDir) {
    return path.resolve(runtimeOptions.targetDir);
  }

  const outputRoot = path.resolve(runtimeOptions.outputDir || process.cwd());
  return path.join(outputRoot, answers.slug);
}

async function scaffoldPlatformProject({
  targetDir,
  selectedModules,
  versionMap,
  dependencyMode,
  packageManager,
  workspaceMode,
  workspaceRoot,
  answers,
  dbInstallPlan,
  dbRegistry,
}) {
  const brandValues = createDerivedBrandValues(answers.slug);
  const baseTemplateDir = path.join(TEMPLATE_ROOT, "base");

  await ensureDirectory(path.dirname(targetDir));
  await copyDirectory(baseTemplateDir, targetDir);

  for (const moduleDefinition of SELECTABLE_MODULES) {
    if (!selectedModules.includes(moduleDefinition.key)) continue;
    const moduleTemplateDir = path.join(TEMPLATE_ROOT, "modules", moduleDefinition.templateFolder);
    await copyDirectory(moduleTemplateDir, targetDir);
  }

  await fs.writeFile(
    path.join(targetDir, "package.json"),
    `${JSON.stringify(
      createPackageJson({
        slug: answers.slug,
        dependencyMode,
        selectedModules,
        versionMap,
        template: "platform",
      }),
      null,
      2,
    )}\n`,
  );
  await fs.writeFile(path.join(targetDir, "next.config.ts"), createNextConfig({ template: "platform", selectedModules }));
  await fs.writeFile(
    path.join(targetDir, "config", "brand.ts"),
    createPlatformBrandConfigFile({ slug: answers.slug, brandValues }),
  );
  await fs.writeFile(path.join(targetDir, "config", "modules.ts"), createPlatformModulesConfigFile(selectedModules));
  await fs.writeFile(path.join(targetDir, "config", "shell.ts"), createShellConfig(selectedModules));
  await fs.writeFile(
    path.join(targetDir, "docs", "ai", "app-context.json"),
    createAppContextFile({
      slug: answers.slug,
      template: "platform",
      selectedModules,
      dbInstallPlan,
    }),
  );

  const envFileContent = createEnvFileContent();

  await fs.writeFile(path.join(targetDir, ".env.local"), envFileContent);
  await fs.writeFile(path.join(targetDir, ".gitignore"), createGitignore());
  await fs.writeFile(
    path.join(targetDir, "README.md"),
    createPlatformReadme({
      slug: answers.slug,
      selectedModules,
      workspaceMode,
      packageManager,
      dbInstallPlan,
    }),
  );

  if (workspaceMode) {
    await writeClientStack(workspaceRoot, answers.slug, dbInstallPlan, { workspaceMode: true });
  } else {
    await writeBundledSupabaseBaseline({
      targetDir,
      slug: answers.slug,
      dbInstallPlan,
      registry: dbRegistry,
    });
  }
}

async function scaffoldSiteProject({
  targetDir,
  versionMap,
  dependencyMode,
  packageManager,
  workspaceMode,
  answers,
}) {
  void dependencyMode;

  const baseTemplateDir = path.join(TEMPLATE_ROOT, "site", "base");

  await ensureDirectory(path.dirname(targetDir));
  await copyDirectory(baseTemplateDir, targetDir);
  await ensureDirectory(path.join(targetDir, "config"));
  await ensureDirectory(path.join(targetDir, "docs", "ai"));

  await fs.writeFile(
    path.join(targetDir, "package.json"),
    `${JSON.stringify(
      createPackageJson({
        slug: answers.slug,
        dependencyMode: "published",
        selectedModules: [],
        versionMap,
        template: "site",
      }),
      null,
      2,
    )}\n`,
  );
  await fs.writeFile(path.join(targetDir, "next.config.ts"), createNextConfig({ template: "site", selectedModules: [] }));
  await fs.writeFile(path.join(targetDir, ".gitignore"), createGitignore());
  await fs.writeFile(path.join(targetDir, "config", "site.ts"), createSiteConfigFile(answers.slug));
  await fs.writeFile(
    path.join(targetDir, "docs", "ai", "app-context.json"),
    createAppContextFile({
      slug: answers.slug,
      template: "site",
    }),
  );
  await fs.writeFile(
    path.join(targetDir, "README.md"),
    createSiteReadme({
      slug: answers.slug,
      workspaceMode,
      packageManager,
    }),
  );
}

function printCompletionMessage({ targetDir, workspaceMode, slug, packageManager, install }) {
  const relativeTargetDir = path.relative(process.cwd(), targetDir) || path.basename(targetDir);

  output.write(`\nCreated app at ${relativeTargetDir}\n`);
  if (!install) {
    output.write("Dependencies were not installed.\n");
  }

  if (workspaceMode) {
    output.write(`Next step: pnpm --filter ${slug} dev\n\n`);
    return;
  }

  output.write(`Next step: cd ${targetDir} && ${packageManager} dev\n\n`);
}

export async function createBrightwebClientApp(argvOptions, runtimeOptions = {}) {
  const dependencyMode = runtimeOptions.dependencyMode || argvOptions.dependencyMode || "published";
  const workspaceRoot = runtimeOptions.workspaceRoot
    ? path.resolve(runtimeOptions.workspaceRoot)
    : argvOptions.workspaceRoot
      ? path.resolve(argvOptions.workspaceRoot)
      : null;
  const workspaceMode = dependencyMode === "workspace";
  const packageManager = detectPackageManager(workspaceMode ? "pnpm" : argvOptions.packageManager);

  const answers = await collectAnswers(argvOptions, runtimeOptions);
  const targetDir = resolveTargetDirectory(
    {
      outputDir: runtimeOptions.outputDir || argvOptions.outputDir,
      targetDir: runtimeOptions.targetDir || argvOptions.targetDir,
    },
    answers,
  );

  if (await pathExists(targetDir)) {
    throw new Error(`Target directory already exists: ${targetDir}`);
  }

  const versionMap = await getVersionMap(workspaceRoot);
  const dbModuleRegistry = await getDbModuleRegistry(workspaceRoot);
  const dbInstallPlan = createDbInstallPlan({
    selectedModules: answers.selectedModules,
    workspaceMode,
    registry: dbModuleRegistry,
  });
  const install = answers.install && !argvOptions.dryRun;

  if (argvOptions.dryRun) {
    output.write(`${renderPlanSummary({
      targetDir,
      dependencyMode,
      selectedModules: answers.selectedModules,
      packageManager,
      workspaceMode,
      install: answers.install,
      template: answers.template,
      dbInstallPlan,
    })}\n\n`);
    return {
      answers,
      targetDir,
      dependencyMode,
      workspaceMode,
      packageManager,
      dryRun: true,
    };
  }

  output.write(`${renderPlanSummary({
    targetDir,
    dependencyMode,
    selectedModules: answers.selectedModules,
    packageManager,
    workspaceMode,
    install: answers.install,
    template: answers.template,
    dbInstallPlan,
  })}\n\n`);

  if (answers.template === "site") {
    await scaffoldSiteProject({
      targetDir,
      versionMap,
      dependencyMode,
      packageManager,
      workspaceMode,
      answers,
    });
  } else {
    await scaffoldPlatformProject({
      targetDir,
      selectedModules: answers.selectedModules,
      versionMap,
      dependencyMode,
      packageManager,
      workspaceMode,
      workspaceRoot,
      answers,
      dbInstallPlan,
      dbRegistry: dbModuleRegistry,
    });
  }

  if (install) {
    const installCwd = workspaceMode ? workspaceRoot : targetDir;
    const installRunner = runtimeOptions.installRunner || runInstall;
    await installRunner(packageManager, installCwd);
  }

  printCompletionMessage({
    targetDir,
    workspaceMode,
    slug: answers.slug,
    packageManager,
    install,
  });

  return {
    answers,
    targetDir,
    dependencyMode,
    workspaceMode,
    packageManager,
    dryRun: false,
  };
}
