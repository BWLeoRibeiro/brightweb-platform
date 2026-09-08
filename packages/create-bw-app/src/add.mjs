import { assertMutationTargets } from "./mutation-paths.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { stdout as output } from "node:process";
import { SELECTABLE_MODULES } from "./constants.mjs";
import { TEMPLATE_ROOT, createDbInstallPlan, createManagedPlatformFiles, getDbModuleRegistry, getVersionMap, pathExists, readJsonIfPresent } from "./generator.mjs";
import { collectScaffoldFiles, findWorkspaceRoot, loadModuleCatalog, MODULE_PACKAGES, readAppManifest, resolveModuleClosure, satisfiesVersion, writeAppManifest } from "./app-manifest.mjs";
import { assertNoUntrackedScaffoldWrites, scaffoldDrift } from "./scaffold.mjs";
import { assertMigrationMutationTargets, applyMigrationWrites, planMigrationAppends } from "./migrations.mjs";

const HELP = `Usage: bw add <moduleKey> [options]\n\nOptions:\n  --target-dir <path>       App directory (defaults to cwd)\n  --workspace-root <path>   BrightWeb workspace root\n  --dry-run                 Print the install plan without writing\n  --help                    Show this help`;

export async function addBrightwebModule(moduleKey, argvOptions = {}, runtimeOptions = {}) {
  if (!moduleKey || argvOptions.help) {
    output.write(`${HELP}\n`);
    return { help: true };
  }
  const targetDir = await fs.realpath(path.resolve(runtimeOptions.targetDir || argvOptions.targetDir || process.cwd()));
  const appManifest = await readAppManifest(targetDir);
  if (appManifest.app.template !== "platform") throw new Error("bw add is only available for platform apps.");
  const packageJsonPath = path.join(targetDir, "package.json");
  const packageJson = await readJsonIfPresent(packageJsonPath);
  if (!packageJson) throw new Error(`Target directory does not contain package.json: ${targetDir}`);
  const workspaceRootCandidate = runtimeOptions.workspaceRoot || argvOptions.workspaceRoot || await findWorkspaceRoot(targetDir);
  const workspaceRoot = workspaceRootCandidate ? path.resolve(workspaceRootCandidate) : null;
  const catalog = await loadModuleCatalog({ targetDir, workspaceRoot });
  if (!catalog[moduleKey] || moduleKey === "core") throw new Error(`Unknown installable module key: ${moduleKey}`);

  const resolved = resolveModuleClosure(catalog, [moduleKey]);
  const installedVersions = { core: catalog.core.version, admin: catalog.admin.version };
  for (const [key, entry] of Object.entries(appManifest.modules)) installedVersions[key] = entry.version;
  const conflicts = [];
  for (const key of resolved) {
    for (const [requiredKey, range] of Object.entries(catalog[key].requires || {})) {
      if (installedVersions[requiredKey] && !satisfiesVersion(installedVersions[requiredKey], range)) conflicts.push(`${key} requires ${requiredKey}@${range}, but ${requiredKey}@${installedVersions[requiredKey]} is installed`);
    }
  }
  if (conflicts.length > 0) {
    let compatibility = "Compatibility-set check skipped (published mode).";
    if (workspaceRoot) {
      const release = await readJsonIfPresent(path.join(workspaceRoot, "brightweb-release.json"));
      compatibility = `Compatibility set: ${JSON.stringify(release?.packages || {})}`;
    }
    throw new Error(`Module version conflict:\n- ${conflicts.join("\n- ")}\n${compatibility}`);
  }

  const newModules = resolved.filter((key) => !appManifest.modules[key]);
  const versionMap = await getVersionMap(workspaceRoot);
  const dependencyMode = Object.values(packageJson.dependencies || {}).some((value) => String(value).startsWith("workspace:")) ? "workspace" : "published";
  const nextPackageJson = structuredClone(packageJson);
  nextPackageJson.dependencies ||= {};
  for (const key of newModules) {
    const packageName = MODULE_PACKAGES[key];
    if (!packageName) continue;
    nextPackageJson.dependencies[packageName] = dependencyMode === "workspace" ? "workspace:*" : versionMap[packageName];
  }
  nextPackageJson.dependencies = Object.fromEntries(Object.entries(nextPackageJson.dependencies).sort(([a], [b]) => a.localeCompare(b)));

  const installedModuleKeys = Array.from(new Set([...Object.keys(appManifest.modules), ...newModules]));
  const dbRegistry = await getDbModuleRegistry(workspaceRoot);
  const dbInstallPlan = createDbInstallPlan({ selectedModules: installedModuleKeys.filter((key) => key !== "orgs"), workspaceMode: dependencyMode === "workspace", registry: dbRegistry });
  const migrationPlan = await planMigrationAppends({ targetDir, moduleKeys: newModules, catalog, migrationCursor: appManifest.migrationCursor });
  const overlays = [];
  for (const key of newModules) {
    const definition = SELECTABLE_MODULES.find((entry) => entry.key === key);
    if (definition && await pathExists(path.join(TEMPLATE_ROOT, "modules", definition.templateFolder))) overlays.push({ key, source: path.join(TEMPLATE_ROOT, "modules", definition.templateFolder) });
  }
  const managedWrites = await createManagedPlatformFiles({ slug: appManifest.app.slug, selectedModules: installedModuleKeys, dbInstallPlan });

  const live = await scaffoldDrift(targetDir, appManifest.scaffoldFiles);
  const { protectedPaths } = live;
  for (const relativePath of protectedPaths) delete managedWrites[relativePath];

  if (newModules.length === 0) for (const relativePath of Object.keys(managedWrites)) delete managedWrites[relativePath];

  await assertNoUntrackedScaffoldWrites({
    targetDir,
    scaffoldFiles: appManifest.scaffoldFiles,
    moduleKeys: installedModuleKeys,
    relativePaths: Object.keys(managedWrites),
  });

  const overlayFiles = [];
  // Refuse unknown overlay collisions before package, configuration or migration writes.
  for (const overlay of overlays) {
    const pending = [overlay.source];
    while (pending.length) {
      const directory = pending.pop();
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const source = path.join(directory, entry.name);
        const relativePath = path.relative(overlay.source, source);
        const destination = path.join(targetDir, relativePath);
        const existing = await fs.lstat(destination).catch((error) => {
          if (error.code === "ENOENT") return null;
          throw error;
        });
        if (entry.isDirectory()) {
          if (existing && !existing.isDirectory()) {
            throw new Error(`Cannot add ${moduleKey}: module scaffold requires a directory at ${relativePath}, but an app file or link exists. Reconcile it explicitly before adding the module.`);
          }
          pending.push(source);
          continue;
        }
        overlayFiles.push(relativePath);
        if (!appManifest.scaffoldFiles[relativePath] && existing) {
          throw new Error(`Cannot add ${moduleKey}: untracked app file conflicts with module scaffold: ${relativePath}. Move or reconcile it explicitly before adding the module.`);
        }
      }
    }
  }

  await assertMutationTargets(targetDir, ["package.json", ".brightweb/app-manifest.json", ...Object.keys(managedWrites), ...overlayFiles]);
  await assertMigrationMutationTargets(targetDir, migrationPlan.writes);

  const summary = [
    "bw add",
    `Modules to install: ${newModules.join(" -> ") || "none"}`,
    `Migrations to append: ${migrationPlan.writes.map((entry) => entry.targetFileName).join(", ") || "none"}`,
    `Files to write: ${[...(newModules.length ? ["package.json"] : []), ...Object.keys(managedWrites), ...overlays.map((entry) => `template/modules/${entry.key}`)].join(", ") || "none"}`,
  ];
  if (!workspaceRoot) summary.push("WARN Compatibility-set check skipped in published mode.");
  output.write(`${summary.join("\n")}\n`);
  if (argvOptions.dryRun) return { dryRun: true, newModules, migrationPlan };

  if (newModules.length === 0) return { dryRun: false, newModules, migrationPlan };

  if (newModules.length > 0) await fs.writeFile(packageJsonPath, `${JSON.stringify(nextPackageJson, null, 2)}\n`, "utf8");
  const copiedPaths = new Set();
  for (const overlay of overlays) await fs.cp(overlay.source, targetDir, {
    recursive: true,
    filter: async (source, destination) => {
      const relativePath = path.relative(targetDir, destination);
      if (protectedPaths.has(relativePath)) return false;
      if ((await fs.stat(source)).isFile()) copiedPaths.add(relativePath);
      return true;
    },
  });
  for (const [relativePath, content] of Object.entries(managedWrites)) {
    const targetPath = path.join(targetDir, relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content, "utf8");
  }
  await applyMigrationWrites(migrationPlan.writes);
  const now = new Date().toISOString();
  for (const key of newModules) appManifest.modules[key] = { version: catalog[key].version, installedAt: now, exposed: true };
  appManifest.migrationCursor = migrationPlan.nextCursor;
  const collectedScaffoldFiles = await collectScaffoldFiles(targetDir, installedModuleKeys);
  for (const [relativePath, record] of Object.entries(collectedScaffoldFiles)) {
    // Existing baselines describe generated bytes, never arbitrary app edits.
    // Refresh only tracked outputs actually rendered by this command.
    if (Object.hasOwn(managedWrites, relativePath) || copiedPaths.has(relativePath)) {
      appManifest.scaffoldFiles[relativePath] = { ...appManifest.scaffoldFiles[relativePath], ...record };
    }
  }
  await writeAppManifest(targetDir, appManifest);
  output.write(`Installed ${newModules.length} module${newModules.length === 1 ? "" : "s"}. ${migrationPlan.writes.length > 0 ? "Run your Supabase migration apply command. " : ""}Run your package manager install command next.\n`);
  return { dryRun: false, newModules, migrationPlan };
}

export { HELP as ADD_HELP };
