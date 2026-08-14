import fs from "node:fs/promises";
import path from "node:path";
import { stdout as output } from "node:process";
import { hashFile, findWorkspaceRoot, loadModuleCatalog, readAppManifest, writeAppManifest, cleanVersion } from "./app-manifest.mjs";
import { pathExists, runInstall } from "./generator.mjs";
import { applyMigrationWrites, getModuleMigrations, planMigrationAppends } from "./migrations.mjs";
import { buildBrightwebAppUpdatePlan } from "./update.mjs";
import { resolveSafeRelativePath } from "./safe-path.mjs";

const HELP = `Usage: bw upgrade [moduleKey] [options]\n\nOptions:\n  --target-dir <path>                 App directory (defaults to cwd)\n  --workspace-root <path>             BrightWeb workspace root\n  --through-migration <file>          Advance the named module only through this migration\n  --include-destructive-migrations    Explicitly include held destructive migrations\n  --allow-stale-fallback              Use baked-in versions if npm lookup fails\n  --install                           Install changed dependencies\n  --refresh-starters                  Refresh unchanged starter files\n  --dry-run                           Print the upgrade plan without writing\n  --help                              Show this help`;

export async function upgradeBrightwebApp(moduleKey, argvOptions = {}, runtimeOptions = {}) {
  if (argvOptions.help) { output.write(`${HELP}\n`); return { help: true }; }
  const throughMigration = typeof argvOptions.throughMigration === "string"
    ? argvOptions.throughMigration.trim()
    : "";
  if (argvOptions.throughMigration != null && !throughMigration) {
    throw new Error("--through-migration requires a migration filename.");
  }
  if (throughMigration && !moduleKey) {
    throw new Error("--through-migration requires an explicit module key, for example: bw upgrade projects --through-migration <filename>.");
  }
  const includeDestructiveMigrations = argvOptions.includeDestructiveMigrations === true;
  if (includeDestructiveMigrations && !moduleKey) {
    throw new Error("--include-destructive-migrations requires an explicit module key so destructive scope cannot expand implicitly.");
  }
  const targetDir = path.resolve(runtimeOptions.targetDir || argvOptions.targetDir || process.cwd());
  const appManifest = await readAppManifest(targetDir);
  if (moduleKey && !appManifest.modules[moduleKey]) throw new Error(`Module ${moduleKey} is not installed according to ${path.join(".brightweb", "app-manifest.json")}.`);
  const workspaceRoot = runtimeOptions.workspaceRoot || argvOptions.workspaceRoot || await findWorkspaceRoot(targetDir);
  const updateOptions = { ...argvOptions, targetDir, ...(workspaceRoot ? { workspaceRoot } : {}) };
  const plan = await buildBrightwebAppUpdatePlan(updateOptions, runtimeOptions);
  const drifted = [];
  const missing = [];
  const intentional = [];
  for (const [relativePath, record] of Object.entries(appManifest.scaffoldFiles)) {
    if (["owned", "skipped"].includes(record.intent)) intentional.push(relativePath);
    const filePath = resolveSafeRelativePath(targetDir, relativePath, "Manifest scaffold file path");
    if (!(await pathExists(filePath))) { missing.push(relativePath); continue; }
    if (await hashFile(filePath) !== record.hash) drifted.push(relativePath);
  }
  const protectedPaths = new Set([...drifted, ...intentional]);
  plan.fileWrites = plan.fileWrites.filter((entry) => entry.type !== "starter" || !protectedPaths.has(entry.relativePath));
  plan.starterFilesToRefresh = plan.fileWrites.filter((entry) => entry.type === "starter").map((entry) => entry.relativePath);
  plan.starterFilesDrifted = Array.from(new Set([...plan.starterFilesDrifted, ...drifted]));
  plan.starterFilesMissing = Array.from(new Set([...plan.starterFilesMissing, ...missing]));

  const catalog = await loadModuleCatalog({ targetDir, workspaceRoot });
  for (const entry of Object.values(catalog)) {
    const targetVersion = plan.targetVersions?.[entry.packageName];
    if (targetVersion) entry.version = cleanVersion(targetVersion) || entry.version;
  }
  for (const update of plan.packageUpdates) {
    const key = Object.keys(catalog).find((candidate) => catalog[candidate].packageName === update.packageName);
    if (key) catalog[key].version = cleanVersion(update.to) || catalog[key].version;
  }
  const installedMigrationKeys = Object.keys(appManifest.migrationCursor ?? {}).filter((key) => catalog[key]);
  const moduleKeys = moduleKey
    ? [moduleKey]
    : Array.from(new Set([...installedMigrationKeys, ...Object.keys(appManifest.modules)]));
  const uncursored = [];
  for (const key of moduleKeys) {
    if (appManifest.migrationCursor?.[key] == null && (await getModuleMigrations(key, catalog[key])).length > 0) uncursored.push(key);
  }
  if (uncursored.length > 0) throw new Error(`Migration upgrade blocked: ${uncursored.join(", ")} ${uncursored.length === 1 ? "has" : "have"} a null migration cursor. Set an explicit cursor with bw adopt --force --cursor before upgrading.`);
  const migrationUpperBounds = {};
  const safetyBoundaries = [];
  for (const key of moduleKeys) {
    const migrations = await getModuleMigrations(key, catalog[key]);
    const destructiveIndex = migrations.findIndex((entry) => entry.destructive);
    if (throughMigration && key === moduleKey) {
      const cutoffIndex = migrations.findIndex((entry) => entry.fileName === throughMigration);
      if (cutoffIndex >= destructiveIndex && destructiveIndex >= 0 && !includeDestructiveMigrations) {
        throw new Error(`Migration cutoff ${throughMigration} includes destructive migration ${migrations[destructiveIndex].fileName}. Re-run with --include-destructive-migrations after reviewing and backing up affected data.`);
      }
      migrationUpperBounds[key] = throughMigration;
      continue;
    }
    if (includeDestructiveMigrations || destructiveIndex < 0) continue;
    const cursorIndex = migrations.findIndex((entry) => entry.fileName === appManifest.migrationCursor?.[key]);
    if (cursorIndex >= destructiveIndex) continue;
    if (destructiveIndex === 0) {
      throw new Error(`Migration upgrade blocked: ${key} begins with destructive migration ${migrations[0].fileName}; use --include-destructive-migrations after review.`);
    }
    const boundary = migrations[destructiveIndex - 1].fileName;
    migrationUpperBounds[key] = boundary;
    safetyBoundaries.push({ moduleKey: key, boundary, destructiveMigration: migrations[destructiveIndex].fileName });
  }
  const migrationPlan = await planMigrationAppends({
    targetDir,
    moduleKeys,
    catalog,
    migrationCursor: appManifest.migrationCursor,
    migrationUpperBounds,
  });
  output.write(`bw upgrade\nPackages to update: ${plan.packageUpdates.length}\nManaged files to write: ${plan.fileWrites.length}\nMigrations to append: ${migrationPlan.writes.length}\n`);
  if (throughMigration) output.write(`Migration cutoff: ${moduleKey} through ${throughMigration}\n`);
  for (const boundary of safetyBoundaries) {
    output.write(`Migration safety boundary: ${boundary.moduleKey} through ${boundary.boundary}; held ${boundary.destructiveMigration}\n`);
  }
  if (migrationPlan.deferred.length > 0) {
    output.write(`Migrations deferred: ${migrationPlan.deferred.length}\n`);
    for (const entry of migrationPlan.deferred) {
      output.write(`- deferred migration: ${entry.moduleKey}/${entry.fileName}\n`);
    }
  }
  for (const relativePath of missing) output.write(`- missing: ${relativePath}\n`);
  for (const relativePath of drifted) output.write(`- drifted: ${relativePath}\n`);
  for (const relativePath of intentional) output.write(`- intent-protected: ${relativePath}\n`);
  if (argvOptions.dryRun) return { dryRun: true, plan, migrationPlan, drifted, missing };

  for (const write of plan.fileWrites) {
    await fs.mkdir(path.dirname(write.targetPath), { recursive: true });
    await fs.writeFile(write.targetPath, write.content, "utf8");
  }
  await applyMigrationWrites(migrationPlan.writes);
  appManifest.migrationCursor = migrationPlan.nextCursor;
  for (const [key, entry] of Object.entries(appManifest.modules)) {
    const packageName = catalog[key]?.packageName;
    if (catalog[key]?.packageRoot || plan.targetVersions?.[packageName]) entry.version = catalog[key].version;
  }
  for (const write of plan.fileWrites) {
    const relativePath = write.relativePath;
    const existingRecord = appManifest.scaffoldFiles[relativePath];
    if (!existingRecord && write.type !== "starter") continue;
    const targetPath = resolveSafeRelativePath(targetDir, relativePath, "Manifest scaffold file path");
    if (write.type === "starter" && protectedPaths.has(relativePath)) continue;
    if (!(await pathExists(targetPath))) continue;
    const hash = await hashFile(targetPath);
    if (existingRecord) {
      existingRecord.hash = hash;
      existingRecord.status = "current";
    } else {
      appManifest.scaffoldFiles[relativePath] = {
        module: write.moduleKey || "platform-base",
        hash,
        status: "current",
      };
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
