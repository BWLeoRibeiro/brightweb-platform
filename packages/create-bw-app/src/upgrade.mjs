import fs from "node:fs/promises";
import path from "node:path";
import { stdout as output } from "node:process";
import { hashFile, findWorkspaceRoot, loadModuleCatalog, readAppManifest, writeAppManifest, cleanVersion } from "./app-manifest.mjs";
import { pathExists, runInstall } from "./generator.mjs";
import { applyMigrationWrites, planMigrationAppends } from "./migrations.mjs";
import { buildBrightwebAppUpdatePlan } from "./update.mjs";

const HELP = `Usage: bw upgrade [moduleKey] [options]\n\nOptions:\n  --target-dir <path>          App directory (defaults to cwd)\n  --workspace-root <path>      BrightWeb workspace root\n  --allow-stale-fallback       Use baked-in versions if npm lookup fails\n  --install                    Install changed dependencies\n  --refresh-starters           Refresh unchanged starter files\n  --dry-run                    Print the upgrade plan without writing\n  --help                       Show this help`;

export async function upgradeBrightwebApp(moduleKey, argvOptions = {}, runtimeOptions = {}) {
  if (argvOptions.help) { output.write(`${HELP}\n`); return { help: true }; }
  const targetDir = path.resolve(runtimeOptions.targetDir || argvOptions.targetDir || process.cwd());
  const appManifest = await readAppManifest(targetDir);
  if (moduleKey && !appManifest.modules[moduleKey]) throw new Error(`Module ${moduleKey} is not installed according to ${path.join(".brightweb", "app-manifest.json")}.`);
  const workspaceRoot = runtimeOptions.workspaceRoot || argvOptions.workspaceRoot || await findWorkspaceRoot(targetDir);
  const updateOptions = { ...argvOptions, targetDir, ...(workspaceRoot ? { workspaceRoot } : {}) };
  const plan = await buildBrightwebAppUpdatePlan(updateOptions, runtimeOptions);
  const drifted = [];
  const missing = [];
  for (const [relativePath, record] of Object.entries(appManifest.scaffoldFiles)) {
    const filePath = path.join(targetDir, relativePath);
    if (!(await pathExists(filePath))) { missing.push(relativePath); continue; }
    if (await hashFile(filePath) !== record.hash) drifted.push(relativePath);
  }
  const protectedPaths = new Set(drifted);
  plan.fileWrites = plan.fileWrites.filter((entry) => entry.type !== "starter" || !protectedPaths.has(entry.relativePath));
  plan.starterFilesDrifted = Array.from(new Set([...plan.starterFilesDrifted, ...drifted]));
  plan.starterFilesMissing = Array.from(new Set([...plan.starterFilesMissing, ...missing]));

  const catalog = await loadModuleCatalog({ targetDir, workspaceRoot });
  for (const update of plan.packageUpdates) {
    const key = Object.keys(catalog).find((candidate) => catalog[candidate].packageName === update.packageName);
    if (key) catalog[key].version = cleanVersion(update.to) || catalog[key].version;
  }
  const moduleKeys = moduleKey ? [moduleKey] : Object.keys(appManifest.modules);
  const migrationPlan = await planMigrationAppends({ targetDir, moduleKeys, catalog, migrationCursor: appManifest.migrationCursor });
  output.write(`bw upgrade\nPackages to update: ${plan.packageUpdates.length}\nManaged files to write: ${plan.fileWrites.length}\nMigrations to append: ${migrationPlan.writes.length}\n`);
  for (const relativePath of missing) output.write(`- missing: ${relativePath}\n`);
  for (const relativePath of drifted) output.write(`- drifted: ${relativePath}\n`);
  if (argvOptions.dryRun) return { dryRun: true, plan, migrationPlan, drifted, missing };

  for (const write of plan.fileWrites) {
    await fs.mkdir(path.dirname(write.targetPath), { recursive: true });
    await fs.writeFile(write.targetPath, write.content, "utf8");
  }
  await applyMigrationWrites(migrationPlan.writes);
  appManifest.migrationCursor = migrationPlan.nextCursor;
  for (const update of plan.packageUpdates) {
    const key = Object.keys(catalog).find((candidate) => catalog[candidate].packageName === update.packageName);
    if (key && appManifest.modules[key]) appManifest.modules[key].version = cleanVersion(update.to) || appManifest.modules[key].version;
  }
  for (const relativePath of plan.starterFilesToRefresh || []) {
    if (!protectedPaths.has(relativePath) && appManifest.scaffoldFiles[relativePath] && await pathExists(path.join(targetDir, relativePath))) {
      appManifest.scaffoldFiles[relativePath].hash = await hashFile(path.join(targetDir, relativePath));
    }
  }
  await writeAppManifest(targetDir, appManifest);
  const packageChanged = plan.fileWrites.some((entry) => entry.relativePath === "package.json");
  if (argvOptions.install && packageChanged) {
    const runner = runtimeOptions.installRunner || runInstall;
    await runner(plan.packageManager, plan.dependencyMode === "workspace" && plan.workspaceRoot ? plan.workspaceRoot : targetDir);
  }
  output.write(`Applied ${plan.fileWrites.length} managed change${plan.fileWrites.length === 1 ? "" : "s"} and ${migrationPlan.writes.length} migration${migrationPlan.writes.length === 1 ? "" : "s"}.\n`);
  return { dryRun: false, plan, migrationPlan, drifted, missing };
}

export { HELP as UPGRADE_HELP };
