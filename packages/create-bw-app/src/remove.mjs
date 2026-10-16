import { findSurvivingPackageImports } from "./removal-dependents.mjs";
import { assertMutationTargets } from "./mutation-paths.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { stdout as output } from "node:process";
import {
  MODULE_PACKAGES,
  findWorkspaceRoot,
  hashFile,
  loadModuleCatalog,
  readAppManifest,
  writeAppManifest,
} from "./app-manifest.mjs";
import {
  createDbInstallPlan,
  createManagedPlatformFiles,
  getDbModuleRegistry,
  pathExists,
  readJsonIfPresent,
} from "./generator.mjs";
import { assertNoUntrackedScaffoldWrites, preserveScaffoldDecisions, scaffoldDrift } from "./scaffold.mjs";
import { resolveSafeRelativePath } from "./safe-path.mjs";

const HELP = `Usage: bw remove <moduleKey> [options]\n\nOptions:\n  --target-dir <path>       App directory (defaults to cwd)\n  --workspace-root <path>   BrightWeb workspace root\n  --dry-run                 Print the removal plan without writing\n  --yes                     Apply the removal plan\n  --help                    Show this help`;

function databaseNotice(moduleKey, ownedObjects) {
  const names = ownedObjects.length > 0 ? ownedObjects.join(", ") : "none declared";
  return [
    `-- Database objects owned by ${moduleKey}: ${names}`,
    "-- No database objects or migration files were changed.",
    "-- Dropping owned objects is a deliberate manual data-removal act.",
    "-- Applied migrations remain in app history under the append-only migration principle.",
  ];
}

export async function removeBrightwebModule(moduleKey, argvOptions = {}, runtimeOptions = {}) {
  if (!moduleKey || argvOptions.help) { output.write(`${HELP}\n`); return { help: true }; }
  const targetDir = await fs.realpath(path.resolve(runtimeOptions.targetDir || argvOptions.targetDir || process.cwd()));
  const appManifest = await readAppManifest(targetDir);
  if (!appManifest.modules[moduleKey]) throw new Error(`Module ${moduleKey} is not installed according to .brightweb/app-manifest.json.`);
  const workspaceRoot = runtimeOptions.workspaceRoot || argvOptions.workspaceRoot || await findWorkspaceRoot(targetDir);
  const catalog = await loadModuleCatalog({ targetDir, workspaceRoot });
  const dependents = Object.keys(appManifest.modules)
    .filter((key) => key !== moduleKey && catalog[key]?.requires?.[moduleKey]);
  if (dependents.length > 0) throw new Error(`Cannot remove ${moduleKey}; installed module${dependents.length === 1 ? "" : "s"} ${dependents.join(", ")} require${dependents.length === 1 ? "s" : ""} it.`);

  const packagePath = path.join(targetDir, "package.json");
  const packageJson = await readJsonIfPresent(packagePath);
  if (!packageJson) throw new Error(`Target directory does not contain package.json: ${targetDir}`);
  const nextPackageJson = structuredClone(packageJson);
  const packageName = MODULE_PACKAGES[moduleKey];
  for (const section of ["dependencies", "devDependencies"]) if (nextPackageJson[section]) delete nextPackageJson[section][packageName];

  const remainingModules = Object.keys(appManifest.modules).filter((key) => key !== moduleKey);
  const dbRegistry = await getDbModuleRegistry(workspaceRoot);
  const dbInstallPlan = createDbInstallPlan({
    selectedModules: remainingModules.filter((key) => key !== "orgs"),
    workspaceMode: Object.values(nextPackageJson.dependencies || {}).some((value) => String(value).startsWith("workspace:")),
    registry: dbRegistry,
  });
  const managedWrites = await createManagedPlatformFiles({ slug: appManifest.app.slug, selectedModules: remainingModules, dbInstallPlan });

  const live = await scaffoldDrift(targetDir, appManifest.scaffoldFiles);
  const { protectedPaths } = live;
  for (const relativePath of protectedPaths) delete managedWrites[relativePath];
  await assertNoUntrackedScaffoldWrites({
    targetDir,
    scaffoldFiles: appManifest.scaffoldFiles,
    moduleKeys: remainingModules,
    relativePaths: Object.keys(managedWrites),
  });
  const retainedFiles = live.entries.filter((entry) => entry.module === moduleKey && protectedPaths.has(entry.relativePath)).map((entry) => entry.relativePath);
  const moduleFiles = live.entries.filter((entry) => entry.module === moduleKey && entry.status !== "missing");
  const cleanFiles = moduleFiles.filter((entry) => !protectedPaths.has(entry.relativePath)).map((entry) => entry.relativePath);
  const driftedFiles = moduleFiles.filter((entry) => protectedPaths.has(entry.relativePath)).map((entry) => entry.relativePath);
  await assertMutationTargets(targetDir, ["package.json", ".brightweb/app-manifest.json", ...cleanFiles, ...Object.keys(managedWrites)]);
  const dependentsOnDisk = await findSurvivingPackageImports(targetDir, packageName, new Set([...cleanFiles, ...Object.keys(managedWrites)]));
  if (dependentsOnDisk.length) throw new Error(`Cannot remove ${moduleKey}: surviving app files depend on ${packageName}: ${dependentsOnDisk.join(", ")}. Reconcile those imports before removal; app-owned content was not changed.`);
  const notice = databaseNotice(moduleKey, catalog[moduleKey]?.manifest?.database?.ownedObjects || []);
  const apply = argvOptions.yes === true && argvOptions.dryRun !== true;
  output.write(`bw remove ${moduleKey}${apply ? "" : " (plan only; pass --yes to apply)"}\n`);
  output.write(`Dependency to remove: ${packageName}\n`);
  output.write(`Clean scaffold files to remove: ${cleanFiles.join(", ") || "none"}\n`);
  output.write(`Scaffold decisions retained for re-add: ${retainedFiles.join(", ") || "none"}\n`);
  output.write(`Drifted scaffold files left in place: ${driftedFiles.join(", ") || "none"}\n`);
  for (const relativePath of driftedFiles) output.write(`WARN ${relativePath} is drifted and will be left in place.\n`);
  for (const line of notice) output.write(`${line}\n`);
  if (!apply) return { dryRun: true, moduleKey, cleanFiles, driftedFiles, retainedFiles, notice };

  await fs.writeFile(packagePath, `${JSON.stringify(nextPackageJson, null, 2)}\n`, "utf8");
  for (const relativePath of cleanFiles) await fs.rm(resolveSafeRelativePath(targetDir, relativePath, "Manifest scaffold file path"));
  for (const [relativePath, content] of Object.entries(managedWrites)) {
    const targetPath = path.join(targetDir, relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content, "utf8");
  }
  delete appManifest.modules[moduleKey];
  if (appManifest.modules.orgs) {
    appManifest.modules.orgs.exposed = remainingModules.some((key) => ["crm", "marketing", "projects"].includes(key));
  }
  appManifest.scaffoldFiles = preserveScaffoldDecisions(
    Object.fromEntries(Object.entries(appManifest.scaffoldFiles).filter(([, record]) => record.module !== moduleKey)),
    appManifest.scaffoldFiles,
    protectedPaths,
  );
  for (const relativePath of Object.keys(managedWrites)) {
    const record = appManifest.scaffoldFiles[relativePath];
    if (!record) continue;
    const targetPath = resolveSafeRelativePath(targetDir, relativePath, "Manifest scaffold file path");
    if (!(await pathExists(targetPath))) continue;
    record.hash = await hashFile(targetPath);
    record.status = "current";
  }
  await writeAppManifest(targetDir, appManifest);
  output.write(`Removed ${moduleKey} package wiring and ${cleanFiles.length} clean scaffold file${cleanFiles.length === 1 ? "" : "s"}. Install dependencies next.\n`);
  return { dryRun: false, moduleKey, cleanFiles, driftedFiles, retainedFiles, notice };
}

export { HELP as REMOVE_HELP };
