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

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE_ROOT = path.join(PACKAGE_ROOT, "template");
const TEMPLATE_KEY_SET = new Set(TEMPLATE_OPTIONS.map((templateOption) => templateOption.key));

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

function detectPackageManager(explicitManager) {
  if (explicitManager) return explicitManager;

  const userAgent = process.env.npm_config_user_agent || "";
  if (userAgent.startsWith("pnpm/")) return "pnpm";
  if (userAgent.startsWith("npm/")) return "npm";
  if (userAgent.startsWith("yarn/")) return "yarn";
  if (userAgent.startsWith("bun/")) return "bun";
  return "pnpm";
}

function sortObjectKeys(inputObject) {
  return Object.fromEntries(
    Object.entries(inputObject).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
  );
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfPresent(filePath) {
  if (!(await pathExists(filePath))) {
    return null;
  }

  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function getVersionMap(workspaceRoot) {
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

function createModuleFlags(selectedModules) {
  const selected = new Set(selectedModules);
  return Object.fromEntries(
    SELECTABLE_MODULES.map((moduleDefinition) => [moduleDefinition.key, selected.has(moduleDefinition.key)]),
  );
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

function createEnvFileContent({ slug, brandValues, moduleFlags }) {
  return [
    "NEXT_PUBLIC_APP_URL=http://localhost:3000",
    "NEXT_PUBLIC_SUPABASE_URL=",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=",
    "SUPABASE_SERVICE_ROLE_KEY=",
    "RESEND_API_KEY=",
    "",
    `NEXT_PUBLIC_CLIENT_COMPANY_NAME=${brandValues.companyName}`,
    `NEXT_PUBLIC_CLIENT_PRODUCT_NAME=${brandValues.productName}`,
    `NEXT_PUBLIC_CLIENT_SLUG=${slug}`,
    `NEXT_PUBLIC_CLIENT_TAGLINE=${brandValues.tagline}`,
    `NEXT_PUBLIC_CLIENT_CONTACT_EMAIL=${brandValues.contactEmail}`,
    `NEXT_PUBLIC_CLIENT_SUPPORT_EMAIL=${brandValues.supportEmail}`,
    `NEXT_PUBLIC_CLIENT_PRIMARY_HEX=${brandValues.primaryHex}`,
    "",
    `NEXT_PUBLIC_ENABLE_CRM=${String(moduleFlags.crm)}`,
    `NEXT_PUBLIC_ENABLE_PROJECTS=${String(moduleFlags.projects)}`,
    `NEXT_PUBLIC_ENABLE_ADMIN=${String(moduleFlags.admin)}`,
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
    "# env files (can opt-in for committing if needed)",
    ".env*",
    "!.env.example",
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

function createPlatformReadme({
  slug,
  selectedModules,
  workspaceMode,
  packageManager,
}) {
  const moduleLines = SELECTABLE_MODULES.map((moduleDefinition) => {
    const enabled = selectedModules.includes(moduleDefinition.key);
    return `- ${moduleDefinition.key}: ${enabled ? "enabled" : "disabled"}`;
  });

  const localSteps = workspaceMode
    ? [
        "1. Review `.env.example`, then fill `.env.local` with real service credentials.",
        "2. Run `pnpm install` from the BrightWeb workspace root.",
        `3. Run \`pnpm --filter ${slug} dev\`.`,
      ]
    : [
        "1. Review `.env.example`, then fill `.env.local` with real service credentials.",
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
    "## Starter routes",
    "",
    "- `/`",
    "- `/bootstrap`",
    "- `/preview/app-shell`",
    "- `/playground/auth`",
    ...selectedModules.map((moduleKey) => `- /playground/${moduleKey}`),
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
    "- `/`",
    "",
    "Edit `config/site.ts` to change the site name, copy, and public links.",
    "",
  ].join("\n");
}

function createPackageJson({
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
      "@types/node": versionMap["@types/node"],
      "@types/react": versionMap["@types/react"],
      "@types/react-dom": versionMap["@types/react-dom"],
      typescript: versionMap.typescript,
    }),
  };
}

function createNextConfig({ template, selectedModules }) {
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

function createShellConfig(selectedModules) {
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

async function ensureDirectory(targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
}

async function runInstall(command, cwd) {
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

function renderPlanSummary({ targetDir, dependencyMode, selectedModules, packageManager, workspaceMode, install, template }) {
  const installLocation = workspaceMode ? "workspace root" : "project directory";
  const templateLabel = TEMPLATE_OPTIONS.find((templateOption) => templateOption.key === template)?.label || template;

  return [
    `Template: ${templateLabel}`,
    `Target directory: ${targetDir}`,
    `Dependency mode: ${dependencyMode}`,
    `Selected modules: ${template === "platform" ? (selectedModules.length > 0 ? selectedModules.join(", ") : "none") : "n/a"}`,
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
  answers,
}) {
  const moduleFlags = createModuleFlags(selectedModules);
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
  await fs.writeFile(path.join(targetDir, "config", "shell.ts"), createShellConfig(selectedModules));

  const envFileContent = createEnvFileContent({ slug: answers.slug, brandValues, moduleFlags });

  await fs.writeFile(path.join(targetDir, ".env.example"), envFileContent);
  await fs.writeFile(path.join(targetDir, ".env.local"), envFileContent);
  await fs.writeFile(path.join(targetDir, ".gitignore"), createGitignore());
  await fs.writeFile(
    path.join(targetDir, "README.md"),
    createPlatformReadme({
      slug: answers.slug,
      selectedModules,
      workspaceMode,
      packageManager,
    }),
  );
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
      answers,
    });
  }

  if (install) {
    const installCwd = workspaceMode ? workspaceRoot : targetDir;
    await runInstall(packageManager, installCwd);
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
