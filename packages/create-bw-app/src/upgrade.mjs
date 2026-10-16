import { assertMutationTargets } from "./mutation-paths.mjs";
import fs from "node:fs/promises";
import { load as loadYaml } from "js-yaml";
import path from "node:path";
import { stdout as output } from "node:process";
import { hashFile, findWorkspaceRoot, loadModuleCatalog, readAppManifest, writeAppManifest, cleanVersion, moduleVersion } from "./app-manifest.mjs";
import { pathExists } from "./generator.mjs";
import { assertMigrationMutationTargets, applyMigrationWrites, findAppMigrationsDirectory, getModuleMigrations, planMigrationAppends, exactMigrationCompatibilityStatus } from "./migrations.mjs";
import { buildBrightwebAppUpdatePlan, reconcileDependencyInstallation } from "./update.mjs";
import { resolveSafeRelativePath } from "./safe-path.mjs";
import { scaffoldDrift } from "./scaffold.mjs";
import { RETIRED_MODULE_STARTER_FILES } from "./constants.mjs";

const IDENTITY_CORE_MIGRATION = "20261014183138_protect_profile_identity.sql";
const IDENTITY_DEPENDENT_MIGRATIONS = {
  admin: "20261014183138_auth_verified_admin_acceptance.sql",
  orgs: "20261014183138_auth_verified_organization_membership.sql",
};

function orderSelectedModules(catalog, selected) {
  const order = [], visited = new Set(), visiting = new Set();
  const keys = new Set(selected);
  function visit(key) {
    if (visited.has(key)) return;
    if (visiting.has(key)) throw new Error(`Circular migration dependency: ${key}`);
    visiting.add(key);
    for (const dependency of Object.keys(catalog[key]?.requires ?? {})) {
      if (keys.has(dependency)) visit(dependency);
    }
    visiting.delete(key);
    visited.add(key);
    order.push(key);
  }
  for (const key of selected) visit(key);
  return order;
}

async function assertIdentityMigrationPrerequisites({ targetDir, catalog, migrationPlan }) {
  const dependent = [...migrationPlan.appends, ...migrationPlan.recovered]
    .filter(entry => IDENTITY_DEPENDENT_MIGRATIONS[entry.moduleKey] === entry.originalFileName);
  if (!dependent.length) return;
  const instruction = `Identity migration prerequisite missing or invalid. Run bw upgrade core, apply ${IDENTITY_CORE_MIGRATION} successfully to the database, then retry the Admin/Orgs upgrade. Explicit cutoffs are preserved; generated files and cursors do not prove database application.`;
  const coreIndex = migrationPlan.appends.findIndex(entry => entry.moduleKey === "core" && entry.originalFileName === IDENTITY_CORE_MIGRATION);
  if (coreIndex >= 0) {
    if (dependent.some(entry => migrationPlan.appends.indexOf(entry) <= coreIndex)) throw new Error(instruction);
    return;
  }
  const status = await exactMigrationCompatibilityStatus({ targetDir, moduleKey: "core", cursor: IDENTITY_CORE_MIGRATION, catalogEntry: catalog.core, allowDeferred: true });
  if (status.issues.length) throw new Error(`${instruction} Core SQL verification: ${status.issues.join("; ")}`);
  const coreFile = status.verified.find(entry => entry.originalFileName === IDENTITY_CORE_MIGRATION)?.fileName;
  if (!coreFile || dependent.some(entry => path.basename(entry.targetPath) <= coreFile)) throw new Error(instruction);
}

const HELP = `Usage: bw upgrade [moduleKey] [options]\n\nOptions:\n  --target-dir <path>                 App directory (defaults to cwd)\n  --workspace-root <path>             BrightWeb workspace root\n  --through-migration <file>          Advance the named module only through this migration\n  --include-destructive-migrations    Explicitly include held destructive migrations\n  --allow-stale-fallback              Use baked-in versions if npm lookup fails\n  --install                           Install dependencies, including retrying a failed install\n  --refresh-starters                  Refresh unchanged starter files\n  --dry-run                           Print the upgrade plan without writing\n  --help                              Show this help`;

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
  const targetDir = await fs.realpath(path.resolve(runtimeOptions.targetDir || argvOptions.targetDir || process.cwd()));
  const appManifest = await readAppManifest(targetDir);
  if (moduleKey && !appManifest.modules[moduleKey] && !(moduleKey === "core" && appManifest.app?.template === "platform")) throw new Error(`Module ${moduleKey} is not installed according to ${path.join(".brightweb", "app-manifest.json")}.`);
  const workspaceRoot = runtimeOptions.workspaceRoot || argvOptions.workspaceRoot || await findWorkspaceRoot(targetDir);
  const updateOptions = { ...argvOptions, targetDir, ...(workspaceRoot ? { workspaceRoot } : {}) };
  const plan = await buildBrightwebAppUpdatePlan(updateOptions, runtimeOptions);
  const live = await scaffoldDrift(targetDir, appManifest.scaffoldFiles);
  const { drifted, missing, intentional, protectedPaths } = live;
  const obsoleteScaffoldFiles = [];
  if (argvOptions.refreshStarters) {
    const currentPaths = new Set(live.current);
    for (const moduleKey of Object.keys(appManifest.modules)) {
      for (const relativePath of RETIRED_MODULE_STARTER_FILES[moduleKey] ?? []) {
        const record = appManifest.scaffoldFiles[relativePath];
        if (!record || protectedPaths.has(relativePath)) continue;
        const targetPath = resolveSafeRelativePath(targetDir, relativePath, "Obsolete scaffold file path");
        if (!currentPaths.has(relativePath)) continue;
        obsoleteScaffoldFiles.push({ relativePath, targetPath });
      }
    }
  }
  plan.fileDeletes = obsoleteScaffoldFiles;
  plan.fileWrites = plan.fileWrites.filter((entry) => !protectedPaths.has(entry.relativePath));
  plan.configFilesToWrite = plan.fileWrites.filter((entry) => entry.type === "config").map((entry) => entry.relativePath);
  plan.starterFilesToRefresh = plan.fileWrites.filter((entry) => entry.type === "starter").map((entry) => entry.relativePath);
  plan.starterFilesDrifted = Array.from(new Set([...plan.starterFilesDrifted, ...drifted]));
  plan.starterFilesMissing = Array.from(new Set([...plan.starterFilesMissing, ...missing]));

  const catalog = await loadModuleCatalog({ targetDir, workspaceRoot });
  for (const entry of Object.values(catalog)) {
    const targetVersion = plan.targetVersions?.[entry.packageName];
    if (!targetVersion) continue;
    const version = cleanVersion(targetVersion) || entry.version;
    if (!workspaceRoot && version !== entry.version) {
      if (version !== moduleVersion(entry.key)) {
        throw new Error(`Migration sources for ${entry.key}@${version} are unavailable. Update create-bw-app to a release with the matching migration bundle before upgrading.`);
      }
      // Installed packages still belong to the previous release until --install
      // runs. The CLI bundle carries the matching target release's SQL.
      entry.packageRoot = null;
    }
    entry.version = version;
  }
  for (const update of plan.packageUpdates) {
    const key = Object.keys(catalog).find((candidate) => catalog[candidate].packageName === update.packageName);
    if (key) catalog[key].version = cleanVersion(update.to) || catalog[key].version;
  }
  const installedMigrationKeys = Object.keys(appManifest.migrationCursor ?? {}).filter((key) => catalog[key]);
  const moduleKeys = orderSelectedModules(catalog, moduleKey
    ? [moduleKey]
    : Array.from(new Set([...installedMigrationKeys, ...Object.keys(appManifest.modules)])));
  const uncursored = [];
  for (const key of moduleKeys) {
    if (appManifest.migrationCursor?.[key] == null && (await getModuleMigrations(key, catalog[key])).length > 0) uncursored.push(key);
  }
  if (uncursored.length > 0) throw new Error(`Migration upgrade blocked: ${uncursored.join(", ")} ${uncursored.length === 1 ? "has" : "have"} a null migration cursor. Set an explicit cursor with bw adopt --force --cursor before upgrading.`);
  const migrationUpperBounds = {};
  const safetyBoundaries = [];
  for (const key of moduleKeys) {
    const migrations = await getModuleMigrations(key, catalog[key]);
    const cursorIndex = migrations.findIndex((entry) => entry.fileName === appManifest.migrationCursor?.[key]);
    const destructiveIndex = migrations.findIndex((entry, index) => index > cursorIndex && entry.destructive);
    if (throughMigration && key === moduleKey) {
      const cutoffIndex = migrations.findIndex((entry) => entry.fileName === throughMigration);
      if (cutoffIndex >= destructiveIndex && destructiveIndex >= 0 && !includeDestructiveMigrations) {
        throw new Error(`Migration cutoff ${throughMigration} includes destructive migration ${migrations[destructiveIndex].fileName}. Re-run with --include-destructive-migrations after reviewing and backing up affected data.`);
      }
      migrationUpperBounds[key] = throughMigration;
      continue;
    }
    if (includeDestructiveMigrations || destructiveIndex < 0) continue;
    if (destructiveIndex === 0) {
      throw new Error(`Migration upgrade blocked: ${key} begins with destructive migration ${migrations[0].fileName}; use --include-destructive-migrations after review.`);
    }
    const boundary = migrations[destructiveIndex - 1].fileName;
    migrationUpperBounds[key] = boundary;
    safetyBoundaries.push({ moduleKey: key, boundary, destructiveMigration: migrations[destructiveIndex].fileName });
  }
  const migrationsDir = await findAppMigrationsDirectory(targetDir);
  const migrationOwner = path.dirname(path.dirname(migrationsDir));
  const migrationPlan = await planMigrationAppends({
    targetDir,
    moduleKeys,
    catalog,
    migrationCursor: appManifest.migrationCursor,
    migrationUpperBounds,
  });
  await assertMigrationMutationTargets(targetDir, migrationPlan.writes);
  if (migrationOwner !== targetDir) {
    let current = targetDir;
    let declaredOwner = null;
    while (current !== path.dirname(current)) {
      const manifestPath = path.join(current, "package.json");
      const workspacePath = path.join(current, "pnpm-workspace.yaml");
      // Generated single apps also carry a pnpm settings file; only a package
      // selection declares a shared workspace ownership boundary.
      const workspaceConfig = await pathExists(workspacePath)
        ? loadYaml(await fs.readFile(workspacePath, "utf8")) : null;
      const workspaceMarker = workspaceConfig != null
        && Object.hasOwn(workspaceConfig, "packages");
      const manifest = await pathExists(manifestPath) ? JSON.parse(await fs.readFile(manifestPath, "utf8")) : null;
      if (workspaceMarker || manifest?.workspaces) { declaredOwner = current; break; }
      current = path.dirname(current);
    }
    if (declaredOwner !== migrationOwner) {
      throw new Error("Migration upgrade blocked: ancestor SQL directory is outside the app's declared workspace. Keep SQL inside the app or declare the owning workspace before upgrading.");
    }
  }
  await assertIdentityMigrationPrerequisites({ targetDir, catalog, migrationPlan });
  await assertMutationTargets(targetDir, [".brightweb/app-manifest.json", ...plan.fileWrites.map((write) => write.relativePath), ...plan.fileDeletes.map((entry) => entry.relativePath)]);
  // Monorepo clients keep SQL beside the app. Validate that owner boundary
  // separately; app-managed paths must still remain inside the app itself.
  await assertMutationTargets(migrationOwner, migrationPlan.writes.map(write => path.relative(migrationOwner, write.targetPath)));
  output.write(`bw upgrade\nPackages to update: ${plan.packageUpdates.length}\nManaged files to write: ${plan.fileWrites.length}\nObsolete managed files to remove: ${plan.fileDeletes.length}\nMigrations to append: ${migrationPlan.appends.length}\n`);
  if (migrationPlan.recovered.length) output.write(`Previously written migrations verified for recovery: ${migrationPlan.recovered.length}\n`);
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
  for (const entry of plan.fileDeletes) output.write(`- obsolete managed file: ${entry.relativePath}\n`);
  if (argvOptions.dryRun) return { dryRun: true, plan, migrationPlan, drifted, missing };

  for (const write of plan.fileWrites) {
    await fs.mkdir(path.dirname(write.targetPath), { recursive: true });
    await fs.writeFile(write.targetPath, write.content, "utf8");
  }
  for (const deletion of plan.fileDeletes) {
    await fs.unlink(deletion.targetPath);
    delete appManifest.scaffoldFiles[deletion.relativePath];
  }
  await applyMigrationWrites(migrationPlan.writes);
  appManifest.migrationCursor = migrationPlan.nextCursor;
  appManifest.migrationDeferrals ??= {};
  for (const key of moduleKeys) {
    const firstDeferred = migrationPlan.deferred.find((entry) => entry.moduleKey === key);
    if (firstDeferred?.destructive) {
      appManifest.migrationDeferrals[key] = {
        reason: "destructive",
        cursor: migrationPlan.nextCursor[key],
        nextMigration: firstDeferred.fileName,
      };
    } else {
      delete appManifest.migrationDeferrals[key];
    }
  }
  if (Object.keys(appManifest.migrationDeferrals).length === 0) delete appManifest.migrationDeferrals;
  for (const [key, entry] of Object.entries(appManifest.modules)) {
    const packageName = catalog[key]?.packageName;
    if (catalog[key]?.packageRoot || plan.targetVersions?.[packageName]) entry.version = catalog[key].version;
  }
  for (const write of plan.fileWrites) {
    const relativePath = write.relativePath;
    const existingRecord = appManifest.scaffoldFiles[relativePath];
    if (!existingRecord && write.type !== "starter") continue;
    const targetPath = resolveSafeRelativePath(targetDir, relativePath, "Manifest scaffold file path");
    if (protectedPaths.has(relativePath)) continue;
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
  // Explicit installation also reconciles a previous failed install after files were updated.
  if (argvOptions.install) {
    await reconcileDependencyInstallation({ ...plan, targetDir }, runtimeOptions, appManifest);
  }
  output.write(`Applied ${plan.fileWrites.length} managed change${plan.fileWrites.length === 1 ? "" : "s"}, removed ${plan.fileDeletes.length} obsolete managed file${plan.fileDeletes.length === 1 ? "" : "s"}, and added ${migrationPlan.appends.length} new migration${migrationPlan.appends.length === 1 ? "" : "s"}.\n`);
  return { dryRun: false, plan, migrationPlan, drifted, missing };
}

export { HELP as UPGRADE_HELP };
