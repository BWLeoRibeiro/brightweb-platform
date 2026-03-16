import fs from "node:fs/promises";
import path from "node:path";
import { stdout as output } from "node:process";
import {
  BRIGHTWEB_PACKAGE_NAMES,
  CLI_DISPLAY_NAME,
  MODULE_STARTER_FILES,
  SELECTABLE_MODULES,
} from "./constants.mjs";
import {
  TEMPLATE_ROOT,
  createDbInstallPlan,
  createNextConfig,
  createPackageJson,
  createPlatformModulesConfigFile,
  createShellConfig,
  detectPackageManager,
  getDbModuleRegistry,
  getVersionMap,
  pathExists,
  readJsonIfPresent,
  runInstall,
} from "./generator.mjs";

const MANAGED_PLATFORM_FILES = [
  "next.config.ts",
  path.join("config", "modules.ts"),
  path.join("config", "shell.ts"),
];

function resolveUpdateTargetDirectory(runtimeOptions, argvOptions) {
  if (runtimeOptions.targetDir || argvOptions.targetDir) {
    return path.resolve(runtimeOptions.targetDir || argvOptions.targetDir);
  }

  return process.cwd();
}

async function findWorkspaceRoot(startDir) {
  let currentDir = path.resolve(startDir);

  while (true) {
    const registryPath = path.join(currentDir, "supabase", "module-registry.json");
    const cliPackagePath = path.join(currentDir, "packages", "create-bw-app", "package.json");

    if ((await pathExists(registryPath)) && (await pathExists(cliPackagePath))) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

function collectInstalledBrightwebPackages(manifest) {
  const installed = new Map();

  for (const section of ["dependencies", "devDependencies"]) {
    const sectionManifest = manifest[section] || {};
    for (const [packageName, version] of Object.entries(sectionManifest)) {
      if (!packageName.startsWith("@brightweblabs/")) continue;
      installed.set(packageName, { section, version });
    }
  }

  return installed;
}

function parseConfiguredModules(content) {
  const enabledModules = [];

  for (const moduleDefinition of SELECTABLE_MODULES) {
    const matcher = new RegExp(`key:\\s*"${moduleDefinition.key}"[\\s\\S]*?enabled:\\s*(true|false)`);
    const match = content.match(matcher);
    if (match?.[1] === "true") {
      enabledModules.push(moduleDefinition.key);
    }
  }

  return enabledModules;
}

async function detectTemplate(targetDir, installedBrightwebPackages) {
  if (await pathExists(path.join(targetDir, "config", "modules.ts"))) {
    return "platform";
  }

  return installedBrightwebPackages.size > 0 ? "platform" : "site";
}

function detectDependencyMode(installedBrightwebPackages) {
  for (const { version } of installedBrightwebPackages.values()) {
    if (typeof version === "string" && version.startsWith("workspace:")) {
      return "workspace";
    }
  }

  return "published";
}

function detectInstalledModules(installedBrightwebPackages) {
  return SELECTABLE_MODULES
    .filter((moduleDefinition) => installedBrightwebPackages.has(moduleDefinition.packageName))
    .map((moduleDefinition) => moduleDefinition.key);
}

function getCanonicalBrightwebVersions({ manifest, template, dependencyMode, installedModules, versionMap }) {
  const canonicalManifest = createPackageJson({
    slug: manifest.name || path.basename(process.cwd()),
    dependencyMode,
    selectedModules: installedModules,
    versionMap,
    template,
  });

  const versions = {};

  for (const section of ["dependencies", "devDependencies"]) {
    for (const [packageName, version] of Object.entries(canonicalManifest[section] || {})) {
      if (BRIGHTWEB_PACKAGE_NAMES.includes(packageName)) {
        versions[packageName] = version;
      }
    }
  }

  return versions;
}

function mergeManagedPackageUpdates({ manifest, targetVersions, installedBrightwebPackages }) {
  let changed = false;
  const nextManifest = {
    ...manifest,
    dependencies: manifest.dependencies ? { ...manifest.dependencies } : undefined,
    devDependencies: manifest.devDependencies ? { ...manifest.devDependencies } : undefined,
  };
  const packageUpdates = [];

  for (const [packageName, details] of installedBrightwebPackages.entries()) {
    if (!BRIGHTWEB_PACKAGE_NAMES.includes(packageName)) continue;
    const targetVersion = targetVersions[packageName];
    if (!targetVersion) continue;

    const currentSection = nextManifest[details.section] || {};
    if (currentSection[packageName] === targetVersion) continue;

    currentSection[packageName] = targetVersion;
    nextManifest[details.section] = currentSection;
    packageUpdates.push({
      packageName,
      from: details.version,
      to: targetVersion,
      section: details.section,
    });
    changed = true;
  }

  return {
    changed,
    packageUpdates,
    content: `${JSON.stringify(nextManifest, null, 2)}\n`,
  };
}

async function getStarterFileStatus(targetDir, installedModules) {
  const starterFiles = [];

  for (const moduleKey of installedModules) {
    const templateFolder = SELECTABLE_MODULES.find((moduleDefinition) => moduleDefinition.key === moduleKey)?.templateFolder;
    if (!templateFolder) continue;

    for (const relativePath of MODULE_STARTER_FILES[moduleKey] || []) {
      const sourcePath = path.join(TEMPLATE_ROOT, "modules", templateFolder, relativePath);
      const targetPath = path.join(targetDir, relativePath);
      const exists = await pathExists(targetPath);

      if (!exists) {
        starterFiles.push({
          moduleKey,
          relativePath,
          sourcePath,
          targetPath,
          status: "missing",
        });
        continue;
      }

      const [sourceContent, targetContent] = await Promise.all([
        fs.readFile(sourcePath, "utf8"),
        fs.readFile(targetPath, "utf8"),
      ]);

      starterFiles.push({
        moduleKey,
        relativePath,
        sourcePath,
        targetPath,
        status: sourceContent === targetContent ? "current" : "drifted",
      });
    }
  }

  return starterFiles;
}

async function detectModulesConfigMismatch(targetDir, installedModules) {
  const modulesConfigPath = path.join(targetDir, "config", "modules.ts");
  if (!(await pathExists(modulesConfigPath))) {
    return null;
  }

  const content = await fs.readFile(modulesConfigPath, "utf8");
  const configuredModules = parseConfiguredModules(content);
  const installed = new Set(installedModules);
  const configured = new Set(configuredModules);

  const mismatch = installedModules.length !== configuredModules.length
    || installedModules.some((moduleKey) => !configured.has(moduleKey))
    || configuredModules.some((moduleKey) => !installed.has(moduleKey));

  if (!mismatch) {
    return null;
  }

  return {
    installedModules,
    configuredModules,
  };
}

function renderInstallCommand({ packageManager, dependencyMode, targetDir, workspaceRoot }) {
  if (dependencyMode === "workspace" && workspaceRoot) {
    return `cd ${workspaceRoot} && ${packageManager} install`;
  }

  return `cd ${targetDir} && ${packageManager} install`;
}

function renderPlanSummary(plan, options = {}) {
  const lines = [
    `${CLI_DISPLAY_NAME} update`,
    "",
    `Detected app type: ${plan.template}`,
    `Dependency mode: ${plan.dependencyMode}`,
    `Installed BrightWeb packages: ${plan.installedBrightwebPackages.length > 0 ? plan.installedBrightwebPackages.join(", ") : "none"}`,
    `Installed modules: ${plan.installedModules.length > 0 ? plan.installedModules.join(", ") : "none"}`,
  ];

  if (plan.modulesConfigMismatch) {
    lines.push(
      `Config mismatch: installed modules (${plan.modulesConfigMismatch.installedModules.join(", ") || "none"}) differ from config/modules.ts (${plan.modulesConfigMismatch.configuredModules.join(", ") || "none"}). Using installed packages as source of truth.`,
    );
  }

  lines.push("");

  if (plan.packageUpdates.length > 0) {
    lines.push("Packages to update:");
    for (const update of plan.packageUpdates) {
      lines.push(`- ${update.packageName}: ${update.from} -> ${update.to}`);
    }
  } else {
    lines.push("Packages to update: none");
  }

  lines.push("");

  if (plan.configFilesToWrite.length > 0) {
    lines.push("Config files to rewrite:");
    for (const relativePath of plan.configFilesToWrite) {
      lines.push(`- ${relativePath}`);
    }
  } else {
    lines.push("Config files to rewrite: none");
  }

  lines.push("");

  if (plan.starterFilesMissing.length > 0 || plan.starterFilesDrifted.length > 0) {
    lines.push("Starter file status:");
    for (const relativePath of plan.starterFilesMissing) {
      lines.push(`- missing: ${relativePath}`);
    }
    for (const relativePath of plan.starterFilesDrifted) {
      lines.push(`- drifted: ${relativePath}`);
    }
  } else {
    lines.push("Starter file status: all current");
  }

  lines.push("");

  if (plan.dbInstallPlan.resolvedOrder.length > 0) {
    lines.push(`Resolved database stack: ${plan.dbInstallPlan.resolvedOrder.join(" -> ")}`);
  }

  if (plan.dbInstallPlan.notes.length > 0) {
    lines.push("Database notes:");
    for (const note of plan.dbInstallPlan.notes) {
      lines.push(`- ${note}`);
    }
  }

  if (options.installCommand) {
    lines.push("", `Next install command: ${options.installCommand}`);
  }

  return `${lines.join("\n")}\n`;
}

export async function buildBrightwebAppUpdatePlan(argvOptions = {}, runtimeOptions = {}) {
  const targetDir = resolveUpdateTargetDirectory(runtimeOptions, argvOptions);
  const packageJsonPath = path.join(targetDir, "package.json");
  const manifest = await readJsonIfPresent(packageJsonPath);

  if (!manifest) {
    throw new Error(`Target directory does not contain package.json: ${targetDir}`);
  }

  const installedBrightwebPackagesMap = collectInstalledBrightwebPackages(manifest);
  const template = await detectTemplate(targetDir, installedBrightwebPackagesMap);
  const dependencyMode = detectDependencyMode(installedBrightwebPackagesMap);
  const workspaceRoot = runtimeOptions.workspaceRoot
    ? path.resolve(runtimeOptions.workspaceRoot)
    : argvOptions.workspaceRoot
      ? path.resolve(argvOptions.workspaceRoot)
      : dependencyMode === "workspace"
        ? await findWorkspaceRoot(targetDir)
        : null;
  const packageManager = detectPackageManager(argvOptions.packageManager || runtimeOptions.packageManager);
  const installedModules = detectInstalledModules(installedBrightwebPackagesMap);
  const versionMap = await getVersionMap(workspaceRoot);
  const dbRegistry = await getDbModuleRegistry(workspaceRoot);
  const dbInstallPlan = template === "platform"
    ? createDbInstallPlan({
      selectedModules: installedModules,
      workspaceMode: true,
      registry: dbRegistry,
    })
    : {
      selectedLabels: [],
      resolvedOrder: [],
      notes: [],
    };
  const canonicalVersions = getCanonicalBrightwebVersions({
    manifest,
    template,
    dependencyMode,
    installedModules,
    versionMap,
  });
  const packageJsonUpdate = mergeManagedPackageUpdates({
    manifest,
    targetVersions: canonicalVersions,
    installedBrightwebPackages: installedBrightwebPackagesMap,
  });

  const fileWrites = [];
  if (packageJsonUpdate.changed) {
    fileWrites.push({
      relativePath: "package.json",
      targetPath: packageJsonPath,
      content: packageJsonUpdate.content,
      type: "config",
    });
  }

  if (template === "platform") {
    const canonicalConfigFiles = {
      "next.config.ts": createNextConfig({ template: "platform", selectedModules: installedModules }),
      [path.join("config", "modules.ts")]: createPlatformModulesConfigFile(installedModules),
      [path.join("config", "shell.ts")]: createShellConfig(installedModules),
    };

    for (const relativePath of MANAGED_PLATFORM_FILES) {
      const targetPath = path.join(targetDir, relativePath);
      const currentContent = (await pathExists(targetPath)) ? await fs.readFile(targetPath, "utf8") : null;
      const nextContent = canonicalConfigFiles[relativePath];

      if (currentContent !== nextContent) {
        fileWrites.push({
          relativePath,
          targetPath,
          content: nextContent,
          type: "config",
        });
      }
    }
  }

  const starterFiles = template === "platform"
    ? await getStarterFileStatus(targetDir, installedModules)
    : [];
  const starterFilesMissing = starterFiles.filter((entry) => entry.status === "missing");
  const starterFilesDrifted = starterFiles.filter((entry) => entry.status === "drifted");

  if (argvOptions.refreshStarters) {
    for (const entry of starterFiles.filter((candidate) => candidate.status !== "current")) {
      fileWrites.push({
        relativePath: entry.relativePath,
        targetPath: entry.targetPath,
        content: await fs.readFile(entry.sourcePath, "utf8"),
        type: "starter",
      });
    }
  }

  const modulesConfigMismatch = template === "platform"
    ? await detectModulesConfigMismatch(targetDir, installedModules)
    : null;

  return {
    targetDir,
    workspaceRoot,
    template,
    dependencyMode,
    packageManager,
    manifest,
    installedModules,
    installedBrightwebPackages: Array.from(installedBrightwebPackagesMap.keys()).sort(),
    packageUpdates: packageJsonUpdate.packageUpdates,
    configFilesToWrite: fileWrites.filter((entry) => entry.type === "config").map((entry) => entry.relativePath),
    starterFilesMissing: starterFilesMissing.map((entry) => entry.relativePath),
    starterFilesDrifted: starterFilesDrifted.map((entry) => entry.relativePath),
    starterFilesToRefresh: fileWrites.filter((entry) => entry.type === "starter").map((entry) => entry.relativePath),
    dbInstallPlan,
    modulesConfigMismatch,
    fileWrites,
  };
}

export async function updateBrightwebApp(argvOptions = {}, runtimeOptions = {}) {
  const plan = await buildBrightwebAppUpdatePlan(argvOptions, runtimeOptions);
  const installCommand = renderInstallCommand({
    packageManager: plan.packageManager,
    dependencyMode: plan.dependencyMode,
    targetDir: plan.targetDir,
    workspaceRoot: plan.workspaceRoot,
  });

  output.write(renderPlanSummary(plan, { installCommand }));

  if (argvOptions.dryRun) {
    return {
      dryRun: true,
      plan,
      installCommand,
    };
  }

  for (const fileWrite of plan.fileWrites) {
    await fs.mkdir(path.dirname(fileWrite.targetPath), { recursive: true });
    await fs.writeFile(fileWrite.targetPath, fileWrite.content, "utf8");
  }

  const packageJsonChanged = plan.fileWrites.some((entry) => entry.relativePath === "package.json");
  if (argvOptions.install && packageJsonChanged) {
    const installRunner = runtimeOptions.installRunner || runInstall;
    const installCwd = plan.dependencyMode === "workspace" && plan.workspaceRoot ? plan.workspaceRoot : plan.targetDir;
    await installRunner(plan.packageManager, installCwd);
  }

  if (!argvOptions.install && packageJsonChanged) {
    output.write(`Run \`${installCommand}\` to install updated package versions.\n`);
  }

  if (plan.fileWrites.length === 0) {
    output.write("No managed changes were required.\n");
  } else {
    output.write(`Applied ${plan.fileWrites.length} managed change${plan.fileWrites.length === 1 ? "" : "s"}.\n`);
  }

  return {
    dryRun: false,
    plan,
    installCommand,
  };
}
