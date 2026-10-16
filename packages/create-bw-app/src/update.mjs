import { assertMutationTargets } from "./mutation-paths.mjs";
import { MANAGED_PLATFORM_FILES, MANAGED_SITE_FILES, MODULE_SELECTED_FILES, isAppOwnedSeed } from "./file-policy.mjs";
import fs from "node:fs/promises";
import semver from "semver";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { load as loadYaml } from "js-yaml";
import path from "node:path";
import { stdout as output } from "node:process";
import {
  BRIGHTWEB_PACKAGE_NAMES,
  CLI_DISPLAY_NAME,
  MODULE_STARTER_FILES,
  ORGS_PACKAGE_NAME,
  PLATFORM_STARTER_FILES,
  SELECTABLE_MODULES,
} from "./constants.mjs";
import {
  TEMPLATE_ROOT,
  createAppContextFile,
  createDbInstallPlan,
  createManagedPlatformFiles,
  createPackageJson,
  detectPackageManager,
  getDbModuleRegistry,
  getVersionMap,
  pathExists,
  readJsonIfPresent,
  runInstall,
} from "./generator.mjs";
import { assertNoUntrackedScaffoldWrites, scaffoldDrift } from "./scaffold.mjs";
import { hashFile, writeAppManifest, readAppManifest } from "./app-manifest.mjs";

const MODULE_SELECTED_PLATFORM_FILES = new Set(MODULE_SELECTED_FILES);

const REFRESHABLE_PLATFORM_STARTER_FILES = new Set([
  path.join("app", "api", "notifications", "route.ts"),
]);

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

async function resolvePublishedBrightwebVersions(installedBrightwebPackages, options = {}) {
  const packageNames = Array.from(installedBrightwebPackages.keys()).sort();

  if (packageNames.length === 0) {
    return {};
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Published updates require fetch support to resolve BrightWeb package versions from npm.");
  }

  const registryUrl = (process.env.npm_config_registry || "https://registry.npmjs.org").replace(/\/$/, "");
  const fallbackVersionMap = options.fallbackVersionMap || {};
  const allowStaleFallback = options.allowStaleFallback === true;
  const resolvedVersions = {};
  const failures = [];

  await Promise.all(
    packageNames.map(async (packageName) => {
      try {
        const response = await fetchImpl(`${registryUrl}/${encodeURIComponent(packageName)}/latest`);
        if (!response?.ok) {
          throw new Error(`npm registry responded with ${response?.status ?? "an unknown error"}`);
        }

        const payload = await response.json();
        if (!payload?.version || typeof payload.version !== "string") {
          throw new Error("npm registry response did not include a version");
        }

        resolvedVersions[packageName] = `^${payload.version}`;
      } catch (error) {
        const fallbackVersion = fallbackVersionMap[packageName];
        if (allowStaleFallback && fallbackVersion) {
          resolvedVersions[packageName] = fallbackVersion;
          return;
        }

        const message = error instanceof Error ? error.message : "Unknown error";
        failures.push(`${packageName}: ${message}`);
      }
    }),
  );

  if (failures.length > 0) {
    const fallbackHint = allowStaleFallback
      ? "No baked-in fallback version was available for at least one package."
      : "Re-run with --allow-stale-fallback to use the CLI's baked-in BrightWeb package versions instead.";
    throw new Error(
      `Failed to resolve published BrightWeb package versions from npm.\n${failures.join("\n")}\n${fallbackHint}`,
    );
  }

  return resolvedVersions;
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

export async function detectTemplate(targetDir, installedBrightwebPackages) {
  if (await pathExists(path.join(targetDir, "config", "modules.ts"))) {
    return "platform";
  }

  return installedBrightwebPackages.size > 0 ? "platform" : "site";
}

export function detectDependencyMode(installedBrightwebPackages) {
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

  const requiredOrgsVersion = targetVersions[ORGS_PACKAGE_NAME];
  if (requiredOrgsVersion && !installedBrightwebPackages.has(ORGS_PACKAGE_NAME)) {
    nextManifest.dependencies = nextManifest.dependencies || {};
    nextManifest.dependencies[ORGS_PACKAGE_NAME] = requiredOrgsVersion;
    packageUpdates.push({
      packageName: ORGS_PACKAGE_NAME,
      from: null,
      to: requiredOrgsVersion,
      section: "dependencies",
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

  for (const relativePath of PLATFORM_STARTER_FILES) {
    const sourcePath = path.join(TEMPLATE_ROOT, "base", relativePath);
    const targetPath = path.join(targetDir, relativePath);
    const exists = await pathExists(targetPath);

    if (!exists) {
      starterFiles.push({
        moduleKey: "platform-base",
        relativePath,
        sourcePath,
        targetPath,
        status: "missing",
        refreshable: REFRESHABLE_PLATFORM_STARTER_FILES.has(relativePath),
      });
      continue;
    }

    // These base files are generated from the installed module set and are
    // validated/repaired through MANAGED_PLATFORM_FILES, not raw template
    // byte parity.
    if (MODULE_SELECTED_PLATFORM_FILES.has(relativePath)) {
      starterFiles.push({
        moduleKey: "platform-base",
        relativePath,
        sourcePath,
        targetPath,
        status: "current",
        refreshable: false,
      });
      continue;
    }

    const [sourceContent, targetContent] = await Promise.all([
      fs.readFile(sourcePath, "utf8"),
      fs.readFile(targetPath, "utf8"),
    ]);

    starterFiles.push({
      moduleKey: "platform-base",
      relativePath,
      sourcePath,
      targetPath,
      status: sourceContent === targetContent ? "current" : "drifted",
      refreshable: REFRESHABLE_PLATFORM_STARTER_FILES.has(relativePath),
    });
  }

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

// A version-pinned app patch is part of the app's customization contract.
// Check target versions even when an earlier failed upgrade already wrote them.
async function assertTargetPatchCompatibility(targetDir, targetVersions) {
  let directory = targetDir;
  let lockOwner = null;
  while (!(await pathExists(path.join(directory, "pnpm-workspace.yaml")))) {
    if (!lockOwner && await pathExists(path.join(directory, "pnpm-lock.yaml"))) lockOwner = directory;
    const parent = path.dirname(directory);
    if (parent === directory) { directory = lockOwner ?? targetDir; break; }
    directory = parent;
  }
  // pnpm selects the nearest settings file even without a packages list. A
  // child lockfile does not hide an enclosing pnpm workspace's configuration.
  const manifest = await readJsonIfPresent(path.join(directory, "package.json"));
  const workspacePath = path.join(directory, "pnpm-workspace.yaml");
  const workspace = await pathExists(workspacePath)
    ? loadYaml(await fs.readFile(workspacePath, "utf8")) : null;
  const source = workspace && Object.hasOwn(workspace, "patchedDependencies") ? "pnpm-workspace.yaml" : "package.json";
  const patches = source === "pnpm-workspace.yaml" ? workspace.patchedDependencies : manifest?.pnpm?.patchedDependencies;
  if (patches == null) return;
  if (typeof patches !== "object" || Array.isArray(patches)) {
    throw new Error(`Upgrade blocked: invalid patchedDependencies in ${path.join(directory, source)}. Review the app's patch configuration before retrying.`);
  }
  for (const selector of Object.keys(patches)) {
    const separator = selector.indexOf("@", 1);
    const packageName = separator < 0 ? selector : selector.slice(0, separator);
    if (!Object.hasOwn(targetVersions, packageName)) continue;
    const target = targetVersions[packageName];
    const range = separator < 0 ? "*" : selector.slice(separator + 1);
    const version = semver.validRange(target) && semver.minVersion(target)?.version;
    if (version && semver.validRange(range) && semver.satisfies(version, range)) {
      // Keep the resolver inside the patch's declared support. Exact/finite
      // selectors must not drift to another release allowed by a caret.
      if (!semver.subset(target, range)) targetVersions[packageName] = version;
      continue;
    }
    throw new Error(
      `Upgrade blocked before writes: app-owned patch ${selector} in ${path.join(directory, source)} does not cover target ${packageName}@${target}.\n`
      + "Keep the patch and customization intact. Review/recreate it against the target package with pnpm patch and pnpm patch-commit, then verify the customized behavior before retrying.\n"
      + "If a previous attempt already wrote package or SQL files, this refusal preserves that state. After a reviewed compatible patch is ready, rerun the same command with --install; existing migration files/cursors are verified rather than appended twice.",
    );
  }
}

export async function buildBrightwebAppUpdatePlan(argvOptions = {}, runtimeOptions = {}) {
  const targetDir = await fs.realpath(resolveUpdateTargetDirectory(runtimeOptions, argvOptions));
  const appManifest = await readAppManifest(targetDir, { required: false });
  await assertMutationTargets(targetDir, ["package.json", ...Object.keys(appManifest?.scaffoldFiles || {})]);
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
  const brightwebVersionOverrides = dependencyMode === "published"
    ? await resolvePublishedBrightwebVersions(installedBrightwebPackagesMap, {
      fetchImpl: runtimeOptions.fetchImpl,
      fallbackVersionMap: versionMap,
      allowStaleFallback: argvOptions.allowStaleFallback || runtimeOptions.allowStaleFallback,
    })
    : {};
  const dbRegistry = await getDbModuleRegistry(workspaceRoot);
  const dbInstallPlan = template === "platform"
    ? createDbInstallPlan({
      selectedModules: installedModules,
      workspaceMode: dependencyMode === "workspace",
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
    versionMap: {
      ...versionMap,
      ...brightwebVersionOverrides,
    },
  });
  if (dependencyMode === "published") await assertTargetPatchCompatibility(targetDir, canonicalVersions);
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
    const canonicalConfigFiles = await createManagedPlatformFiles({ slug: manifest.name || path.basename(targetDir), selectedModules: installedModules, dbInstallPlan });

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
  } else {
    const canonicalConfigFiles = {
      [path.join("docs", "ai", "app-context.json")]: createAppContextFile({
        slug: manifest.name || path.basename(targetDir),
        template: "site",
      }),
    };

    for (const relativePath of MANAGED_SITE_FILES) {
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
    for (const entry of starterFiles.filter((candidate) =>
      !MANAGED_PLATFORM_FILES.includes(candidate.relativePath)
      && candidate.status !== "current" && (candidate.status === "missing" || candidate.refreshable !== false))) {
      fileWrites.push({
        moduleKey: entry.moduleKey,
        relativePath: entry.relativePath,
        targetPath: entry.targetPath,
        content: await fs.readFile(entry.sourcePath, "utf8"),
        type: "starter",
      });
    }
  }

  // Legacy update may explicitly refresh drift, but never overrides ownership intent.
  const liveScaffold = await scaffoldDrift(targetDir, appManifest?.scaffoldFiles);
  const intentionalPaths = new Set(liveScaffold.intentional);
  for (let index = fileWrites.length - 1; index >= 0; index -= 1) {
    if (intentionalPaths.has(fileWrites[index].relativePath) || isAppOwnedSeed(fileWrites[index].relativePath)) fileWrites.splice(index, 1);
  }

  if (appManifest) await assertNoUntrackedScaffoldWrites({
    targetDir,
    scaffoldFiles: appManifest.scaffoldFiles,
    moduleKeys: installedModules,
    relativePaths: fileWrites.map((entry) => entry.relativePath),
  });

  await assertMutationTargets(targetDir, [".brightweb/app-manifest.json", ...fileWrites.map((write) => write.relativePath)]);

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
    targetVersions: canonicalVersions,
    appManifest,
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

// A successful install is reusable only while its inputs and installed shared
// package versions still match. Failed/incomplete installs never create proof.
export async function reconcileDependencyInstallation(plan, runtimeOptions = {}, appManifest = plan.appManifest) {
  const installCwd = plan.dependencyMode === "workspace" && plan.workspaceRoot ? plan.workspaceRoot : plan.targetDir;
  async function configurationHash(owner) {
    const directories = new Set([installCwd, owner]);
    const relativeTarget = path.relative(owner, plan.targetDir);
    if (relativeTarget !== ".." && !relativeTarget.startsWith(`..${path.sep}`) && !path.isAbsolute(relativeTarget)) {
      for (let directory = plan.targetDir; ; directory = path.dirname(directory)) {
        directories.add(directory);
        if (directory === owner) break;
      }
    } else directories.add(plan.targetDir);
    const hashes = [];
    for (const directory of directories) {
      const patches = {};
      for (const name of ["package.json", "pnpm-workspace.yaml", ".npmrc"]) {
        const file = path.join(directory, name);
        hashes.push(await pathExists(file) ? await hashFile(file) : null);
        if (name === ".npmrc" || !(await pathExists(file))) continue;
        const source = await fs.readFile(file, "utf8");
        const config = name === "package.json" ? JSON.parse(source).pnpm : loadYaml(source);
        Object.assign(patches, config?.patchedDependencies ?? {});
      }
      for (const patch of Object.values(patches)) {
        const relativePath = typeof patch === "string" ? patch : patch?.path;
        if (typeof relativePath !== "string") return null;
        const file = path.resolve(directory, relativePath);
        hashes.push(await pathExists(file) ? await hashFile(file) : null);
      }
    }
    const environment = Object.entries(process.env)
      .filter(([name]) => /^(npm_config_|pnpm_|NODE_ENV$|CI$)/i.test(name)).sort(([a], [b]) => a.localeCompare(b));
    const userConfigs = new Set([path.join(homedir(), ".npmrc")]);
    for (const [name, value] of environment) {
      if (/(?:userconfig|globalconfig)$/i.test(name) && value) userConfigs.add(path.resolve(installCwd, value));
    }
    for (const file of userConfigs) hashes.push(await pathExists(file) ? await hashFile(file) : null);
    // Configuration can contain credentials; retain only this aggregate digest.
    return createHash("sha256").update(JSON.stringify({ hashes, environment })).digest("hex");
  }
  async function inputs() {
    let directory = installCwd;
    while (true) {
      for (const name of ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lock", "bun.lockb"]) {
        const lock = path.join(directory, name);
        if (await pathExists(lock)) return {
          packageManager: plan.packageManager,
          appPackageHash: await hashFile(path.join(plan.targetDir, "package.json")),
          installPackageHash: await pathExists(path.join(directory, "package.json")) ? await hashFile(path.join(directory, "package.json")) : null,
          lockFile: name, lockHash: await hashFile(lock), configurationHash: await configurationHash(directory),
        };
      }
      const parent = path.dirname(directory);
      if (parent === directory) return { packageManager: plan.packageManager, appPackageHash: await hashFile(path.join(plan.targetDir, "package.json")), installPackageHash: null, lockFile: null, lockHash: null };
      directory = parent;
    }
  }
  async function installedPackagesMatch() {
    const pkg = JSON.parse(await fs.readFile(path.join(plan.targetDir, "package.json"), "utf8"));
    const requirements = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })
      .filter(([name]) => BRIGHTWEB_PACKAGE_NAMES.includes(name));
    if (!requirements.length) return false;
    for (const [name, range] of requirements) {
      let directory = plan.targetDir, installed = null;
      while (true) {
        const candidate = path.join(directory, "node_modules", ...name.split("/"), "package.json");
        if (await pathExists(candidate)) {
          try { installed = JSON.parse(await fs.readFile(candidate, "utf8")); }
          catch (error) { if (error instanceof SyntaxError || error.code === "ENOENT") return false; throw error; }
          break;
        }
        const parent = path.dirname(directory);
        if (parent === directory) break;
        directory = parent;
      }
      if (!installed || !semver.valid(installed.version) || (!String(range).startsWith("workspace:") && !semver.satisfies(installed.version, String(range)))) return false;
    }
    return true;
  }
  const before = await inputs();
  if (before.lockHash && before.configurationHash && appManifest?.lastSuccessfulInstall
    && JSON.stringify(appManifest.lastSuccessfulInstall) === JSON.stringify(before)
    && await installedPackagesMatch()) {
    output.write("Installed dependencies already match the verified installation; no installation required.\n");
    return { installed: false };
  }
  if (appManifest?.lastSuccessfulInstall) {
    delete appManifest.lastSuccessfulInstall;
    await writeAppManifest(plan.targetDir, appManifest);
  }
  await (runtimeOptions.installRunner || runInstall)(plan.packageManager, installCwd, { updateLockfile: true });
  if (appManifest) {
    appManifest.lastSuccessfulInstall = await inputs();
    await writeAppManifest(plan.targetDir, appManifest);
  }
  return { installed: true };
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

  if (plan.appManifest) {
    let scaffoldChanged = false;
    for (const write of plan.fileWrites) {
      const record = plan.appManifest.scaffoldFiles[write.relativePath];
      if (!record) continue;
      record.hash = await hashFile(write.targetPath);
      record.status = "current";
      scaffoldChanged = true;
    }
    if (scaffoldChanged) await writeAppManifest(plan.targetDir, plan.appManifest);
  }

  const packageJsonChanged = plan.fileWrites.some((entry) => entry.relativePath === "package.json");
  if (argvOptions.install) {
    await reconcileDependencyInstallation(plan, runtimeOptions);
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
