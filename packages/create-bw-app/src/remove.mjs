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
  createAppContextFile,
  createDbInstallPlan,
  createNextConfig,
  createPlatformGlobalsCss,
  createPlatformModulesConfigFile,
  createShellConfig,
  getDbModuleRegistry,
  pathExists,
  readJsonIfPresent,
} from "./generator.mjs";

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
  const targetDir = path.resolve(runtimeOptions.targetDir || argvOptions.targetDir || process.cwd());
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
  const managedWrites = {
    "next.config.ts": createNextConfig({ template: "platform", selectedModules: remainingModules }),
    "app/globals.css": await createPlatformGlobalsCss(remainingModules),
    "config/modules.ts": createPlatformModulesConfigFile(remainingModules),
    "config/shell.ts": createShellConfig(remainingModules),
    "docs/ai/app-context.json": createAppContextFile({ slug: appManifest.app.slug, template: "platform", selectedModules: remainingModules.filter((key) => key !== "orgs"), dbInstallPlan }),
  };

  const cleanFiles = [];
  const driftedFiles = [];
  for (const [relativePath, record] of Object.entries(appManifest.scaffoldFiles || {})) {
    if (record.module !== moduleKey) continue;
    const filePath = path.join(targetDir, relativePath);
    if (!(await pathExists(filePath))) continue;
    if ((record.intent || "managed") === "managed" && await hashFile(filePath) === record.hash) cleanFiles.push(relativePath);
    else driftedFiles.push(relativePath);
  }
  const notice = databaseNotice(moduleKey, catalog[moduleKey]?.manifest?.database?.ownedObjects || []);
  const apply = argvOptions.yes === true && argvOptions.dryRun !== true;
  output.write(`bw remove ${moduleKey}${apply ? "" : " (plan only; pass --yes to apply)"}\n`);
  output.write(`Dependency to remove: ${packageName}\n`);
  output.write(`Clean scaffold files to remove: ${cleanFiles.join(", ") || "none"}\n`);
  output.write(`Drifted scaffold files left in place: ${driftedFiles.join(", ") || "none"}\n`);
  for (const relativePath of driftedFiles) output.write(`WARN ${relativePath} is drifted and will be left in place.\n`);
  for (const line of notice) output.write(`${line}\n`);
  if (!apply) return { dryRun: true, moduleKey, cleanFiles, driftedFiles, notice };

  await fs.writeFile(packagePath, `${JSON.stringify(nextPackageJson, null, 2)}\n`, "utf8");
  for (const relativePath of cleanFiles) await fs.rm(path.join(targetDir, relativePath));
  for (const [relativePath, content] of Object.entries(managedWrites)) {
    const targetPath = path.join(targetDir, relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content, "utf8");
  }
  delete appManifest.modules[moduleKey];
  for (const [relativePath, record] of Object.entries(appManifest.scaffoldFiles || {})) if (record.module === moduleKey) delete appManifest.scaffoldFiles[relativePath];
  await writeAppManifest(targetDir, appManifest);
  output.write(`Removed ${moduleKey} package wiring and ${cleanFiles.length} clean scaffold file${cleanFiles.length === 1 ? "" : "s"}. Install dependencies next.\n`);
  return { dryRun: false, moduleKey, cleanFiles, driftedFiles, notice };
}

export { HELP as REMOVE_HELP };
