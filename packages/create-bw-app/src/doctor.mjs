import fs from "node:fs/promises";
import path from "node:path";
import { stdout as output } from "node:process";
import { APP_DEPENDENCY_DEFAULTS, BRIGHTWEB_PACKAGE_NAMES } from "./constants.mjs";
import { cursorMigrationStatus, exactMigrationCompatibilityStatus } from "./migrations.mjs";
import { findWorkspaceRoot, loadModuleCatalog, MODULE_PACKAGES, readAppManifest, readConfiguredModuleFlags, satisfiesVersion, validateAppManifest, writeAppManifest } from "./app-manifest.mjs";
import { loadAppEnvironment, readFirstEnvironmentValue } from "./env.mjs";
import { pathExists, readJsonIfPresent } from "./generator.mjs";
import { nearestVercelRegion, normalizeSupabaseRegion } from "./regions.mjs";
import { scaffoldDrift } from "./scaffold.mjs";

const HELP = `Usage: bw doctor [options]\n\nOptions:\n  --target-dir <path>       App directory (defaults to cwd)\n  --workspace-root <path>   BrightWeb workspace root\n  --deployment-url <url>    Deployed app URL (defaults to PUBLIC_APP_URL/NEXT_PUBLIC_APP_URL)\n  --supabase-region <id>    Current Supabase project region override\n  --strict                  Treat warnings as failures\n  --report                  Stamp lastDoctor in the app manifest\n  --help                    Show this help`;
const RUNTIME_PACKAGE_NAMES = ["react", "react-dom", "next"];
const LOCAL_DEPENDENCY_PREFIXES = ["file:", "link:", "workspace:", "patch:"];

async function findUp(startDir, fileName) {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, fileName);
    if (await pathExists(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function exactVersionFromDefault(packageName) {
  const requested = APP_DEPENDENCY_DEFAULTS[packageName];
  return typeof requested === "string" ? requested.match(/^(?:\^|~)?(.+)$/)?.[1] ?? null : null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function lockfileIntegrityForPackage(lockfile, packageName, version) {
  const keyPattern = new RegExp(`^  ['\"]?${escapeRegExp(`${packageName}@${version}`)}['\"]?:$`);
  const lines = lockfile.split("\n");
  const start = lines.findIndex((line) => keyPattern.test(line));
  if (start < 0) return null;
  const block = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^  \S/.test(lines[index])) break;
    block.push(lines[index]);
  }
  return block.join("\n").match(/^    resolution:\s*\{[^}\n]*integrity:\s*([^,}\s]+)[^}\n]*\}/m)?.[1] ?? null;
}

export function lockfileImporterResolution(lockfile, importerKey, packageName) {
  const lines = lockfile.split("\n");
  const importersIndex = lines.findIndex((line) => /^importers:\s*$/.test(line));
  if (importersIndex < 0) return null;
  const normalizedKey = importerKey || ".";
  const importerPattern = new RegExp(`^  ['\"]?${escapeRegExp(normalizedKey)}['\"]?:\\s*$`);
  const importerStart = lines.findIndex((line, index) => index > importersIndex && importerPattern.test(line));
  if (importerStart < 0) return null;
  let importerEnd = lines.length;
  for (let index = importerStart + 1; index < lines.length; index += 1) {
    if (/^  \S/.test(lines[index])) { importerEnd = index; break; }
  }
  const dependencyPattern = new RegExp(`^      ['\"]?${escapeRegExp(packageName)}['\"]?:\\s*$`);
  const dependencyStart = lines.findIndex(
    (line, index) => index > importerStart && index < importerEnd && dependencyPattern.test(line),
  );
  if (dependencyStart < 0) return null;
  const block = [];
  for (let index = dependencyStart + 1; index < importerEnd; index += 1) {
    if (/^      \S/.test(lines[index]) || /^    \S/.test(lines[index])) break;
    block.push(lines[index]);
  }
  return {
    specifier: block.join("\n").match(/^        specifier:\s*['\"]?([^'\"\s]+)['\"]?\s*$/m)?.[1] ?? null,
    version: block.join("\n").match(/^        version:\s*['\"]?([^'\"\s]+)['\"]?\s*$/m)?.[1] ?? null,
  };
}

async function inspectPackageProvenance(targetDir, dependencyMap) {
  const issues = [];
  const verified = [];
  const lockPath = await findUp(targetDir, "pnpm-lock.yaml");
  const installRoot = path.join(targetDir, "node_modules");
  if (!lockPath || !(await pathExists(installRoot))) {
    return { issues, verified, lockPath, available: false };
  }
  const lockfile = lockPath ? await fs.readFile(lockPath, "utf8") : null;
  const importerKey = lockPath
    ? path.relative(path.dirname(lockPath), targetDir).split(path.sep).join("/") || "."
    : ".";
  const workspaceManifest = lockPath ? await readJsonIfPresent(path.join(path.dirname(lockPath), "package.json")) : null;
  const overrideMaps = [
    workspaceManifest?.pnpm?.overrides,
    workspaceManifest?.pnpm?.patchedDependencies,
    workspaceManifest?.overrides,
    workspaceManifest?.resolutions,
  ].filter((value) => value && typeof value === "object");
  for (const packageName of BRIGHTWEB_PACKAGE_NAMES) {
    const requested = dependencyMap[packageName];
    if (!requested) continue;
    if (LOCAL_DEPENDENCY_PREFIXES.some((prefix) => String(requested).startsWith(prefix))) {
      issues.push(`${packageName}: local override ${JSON.stringify(requested)} is forbidden`);
      continue;
    }
    const overrideKey = overrideMaps.flatMap((overrides) => Object.keys(overrides)).find(
      (key) => key === packageName || key.startsWith(`${packageName}@`),
    );
    if (overrideKey) {
      issues.push(`${packageName}: workspace override or patch ${JSON.stringify(overrideKey)} is forbidden`);
      continue;
    }
    const expectedVersion = exactVersionFromDefault(packageName);
    if (!expectedVersion) {
      issues.push(`${packageName}: create-bw-app has no exact compatibility version`);
      continue;
    }
    const manifest = await readJsonIfPresent(path.join(targetDir, "node_modules", packageName, "package.json"));
    if (!manifest) {
      issues.push(`${packageName}: installed package manifest is missing`);
      continue;
    }
    if (manifest.version !== expectedVersion) {
      issues.push(`${packageName}: installed ${manifest.version ?? "unknown"}, expected exact ${expectedVersion}`);
      continue;
    }
    if (!lockfile) {
      issues.push(`${packageName}: pnpm-lock.yaml was not found`);
      continue;
    }
    const importerResolution = lockfileImporterResolution(lockfile, importerKey, packageName);
    if (!importerResolution) {
      issues.push(`${packageName}: target importer ${importerKey} has no lockfile resolution`);
      continue;
    }
    if (LOCAL_DEPENDENCY_PREFIXES.some((prefix) => String(importerResolution.version).startsWith(prefix))) {
      issues.push(`${packageName}: target importer resolves through forbidden ${JSON.stringify(importerResolution.version)}`);
      continue;
    }
    const resolvedVersion = importerResolution.version?.split("(")[0] ?? null;
    if (resolvedVersion !== expectedVersion) {
      issues.push(`${packageName}: target importer resolves ${resolvedVersion ?? "unknown"}, expected exact ${expectedVersion}`);
      continue;
    }
    const integrity = lockfileIntegrityForPackage(lockfile, packageName, expectedVersion);
    if (!integrity?.startsWith("sha512-")) {
      issues.push(`${packageName}@${expectedVersion}: registry integrity is missing from pnpm-lock.yaml`);
      continue;
    }
    verified.push(`${packageName}@${expectedVersion}`);
  }
  return { issues, verified, lockPath, available: true };
}

function isLocalDeploymentUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  } catch {
    return false;
  }
}

export function parseVercelFunctionRegion(vercelId) {
  if (typeof vercelId !== "string") return null;
  const regions = vercelId
    .split("::")
    .map((segment) => segment.match(/^([a-z]{3}\d)/)?.[1] ?? null)
    .filter(Boolean);
  return regions[1] || null;
}

async function inspectFunctionRegion({
  targetDir,
  options,
  runtimeOptions,
  appManifest,
  environment,
  add,
}) {
  if (appManifest.app.template !== "platform") return;

  const supabaseRegion = normalizeSupabaseRegion(
    options.supabaseRegion
      || environment.SUPABASE_PROJECT_REGION
      || appManifest.infrastructure?.supabaseRegion,
  );
  const expectedVercelRegion = nearestVercelRegion(supabaseRegion);
  const vercelConfig = await readJsonIfPresent(path.join(targetDir, "vercel.json"));
  const configuredVercelRegions = Array.isArray(vercelConfig?.regions)
    ? vercelConfig.regions.filter((entry) => typeof entry === "string")
    : [];

  if (!supabaseRegion) {
    add(
      "WARN",
      "function-region",
      "Supabase region is unknown; set SUPABASE_PROJECT_REGION or pass --supabase-region before pinning Vercel Functions.",
    );
    return;
  }
  if (!expectedVercelRegion) {
    add(
      "WARN",
      "function-region",
      `Supabase region ${supabaseRegion} has no verified Vercel mapping; vercel.json was left unpinned.`,
    );
    return;
  }
  if (!configuredVercelRegions.includes(expectedVercelRegion)) {
    add(
      "WARN",
      "function-region-config",
      `Supabase ${supabaseRegion} maps to ${expectedVercelRegion}, but vercel.json has ${configuredVercelRegions.join(", ") || "no regions"}.`,
    );
  } else {
    add(
      "PASS",
      "function-region-config",
      `Supabase ${supabaseRegion} maps to configured Vercel region ${expectedVercelRegion}.`,
    );
  }

  const deploymentUrl = readFirstEnvironmentValue(
    {
      ...environment,
      ...(options.deploymentUrl ? { BW_DOCTOR_DEPLOYMENT_URL: options.deploymentUrl } : {}),
    },
    ["BW_DOCTOR_DEPLOYMENT_URL", "PUBLIC_APP_URL", "NEXT_PUBLIC_APP_URL"],
  );
  if (!deploymentUrl || isLocalDeploymentUrl(deploymentUrl)) {
    add(
      "INFO",
      "function-region-deployed",
      "SKIP deployed region check; pass --deployment-url with a non-local app URL.",
    );
    return;
  }

  let endpoint;
  try {
    endpoint = new URL("/api/cron/keepalive", deploymentUrl).toString();
  } catch {
    add("WARN", "function-region-deployed", `Invalid deployment URL: ${deploymentUrl}.`);
    return;
  }

  const fetchImpl = runtimeOptions.fetchImpl || globalThis.fetch;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    runtimeOptions.regionCheckTimeoutMs || 5_000,
  );
  try {
    const response = await fetchImpl(endpoint, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });
    const vercelId = response.headers.get("x-vercel-id");
    const deployedRegion = parseVercelFunctionRegion(vercelId);
    if (!deployedRegion) {
      add(
        "WARN",
        "function-region-deployed",
        `No Vercel Function region was present in x-vercel-id from ${endpoint}.`,
      );
    } else if (deployedRegion !== expectedVercelRegion) {
      add(
        "WARN",
        "function-region-deployed",
        `Deployed function region ${deployedRegion} does not match ${expectedVercelRegion} for Supabase ${supabaseRegion}.`,
      );
    } else {
      add(
        "PASS",
        "function-region-deployed",
        `Deployed function region ${deployedRegion} matches Supabase ${supabaseRegion}.`,
      );
    }
  } catch (error) {
    add(
      "WARN",
      "function-region-deployed",
      `Could not inspect ${endpoint}: ${error instanceof Error ? error.message : String(error)}.`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function findInstalledRuntimeVersions(targetDir) {
  const storeDir = path.join(targetDir, "node_modules", ".pnpm");
  if (!(await pathExists(storeDir))) {
    return Object.fromEntries(RUNTIME_PACKAGE_NAMES.map((packageName) => [packageName, []]));
  }

  const entries = await fs.readdir(storeDir, { withFileTypes: true });
  const resolved = {};
  for (const packageName of RUNTIME_PACKAGE_NAMES) {
    const versions = new Set();
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith(`${packageName}@`)) continue;
      const manifest = await readJsonIfPresent(
        path.join(storeDir, entry.name, "node_modules", packageName, "package.json"),
      );
      const fallbackVersion = entry.name
        .slice(packageName.length + 1)
        .split("_", 1)[0]
        .split("(", 1)[0];
      const version = manifest?.version || fallbackVersion;
      if (version) versions.add(version);
    }
    resolved[packageName] = Array.from(versions).sort();
  }
  return resolved;
}

export async function doctorBrightwebApp(argvOptions = {}, runtimeOptions = {}) {
  if (argvOptions.help) { output.write(`${HELP}\n`); return { help: true, ok: true }; }
  const targetDir = path.resolve(runtimeOptions.targetDir || argvOptions.targetDir || process.cwd());
  const checks = [];
  const add = (status, id, message) => checks.push({ status, id, message });
  let appManifest;
  try { appManifest = await readAppManifest(targetDir); } catch (error) {
    add("FAIL", "manifest", error instanceof Error ? error.message : String(error));
    return finish(checks, argvOptions, null, targetDir);
  }
  const validationErrors = validateAppManifest(appManifest);
  if (validationErrors.length > 0) add("FAIL", "manifest", validationErrors.join("; "));
  else add("PASS", "manifest", "App manifest is valid.");

  const packageJson = await readJsonIfPresent(path.join(targetDir, "package.json"));
  const dependencyMap = { ...(packageJson?.dependencies || {}), ...(packageJson?.devDependencies || {}) };
  const packageProblems = [];
  for (const [key, entry] of Object.entries(appManifest.modules || {})) {
    const packageName = MODULE_PACKAGES[key];
    if (!packageName || !dependencyMap[packageName]) packageProblems.push(`${key}: ${packageName || "unknown package"} is missing`);
    else if (!satisfiesVersion(entry.version, dependencyMap[packageName])) packageProblems.push(`${key}@${entry.version} does not satisfy package.json ${dependencyMap[packageName]}`);
  }
  for (const [key, packageName] of Object.entries(MODULE_PACKAGES)) {
    if (dependencyMap[packageName] && !appManifest.modules[key]) packageProblems.push(`${packageName} is installed but absent from manifest.modules`);
  }
  add(packageProblems.length ? "FAIL" : "PASS", "packages", packageProblems.join("; ") || "Installed module packages agree with the manifest.");

  const provenance = await inspectPackageProvenance(targetDir, dependencyMap);
  if (!provenance.available) {
    add("INFO", "package-provenance", "SKIP exact registry provenance check; install dependencies with a pnpm lockfile first.");
  } else {
    add(
      provenance.issues.length ? "FAIL" : "PASS",
      "package-provenance",
      provenance.issues.join("; ") || `${provenance.verified.length} BrightWeb packages match the exact compatibility set and pnpm registry integrity records.`,
    );
  }

  const runtimeVersions = await findInstalledRuntimeVersions(targetDir);
  const duplicateRuntimes = Object.entries(runtimeVersions)
    .filter(([, versions]) => versions.length > 1)
    .map(([packageName, versions]) => `${packageName}: ${versions.join(", ")}`);
  add(
    duplicateRuntimes.length ? "FAIL" : "PASS",
    "runtime-singletons",
    duplicateRuntimes.join("; ") || "React, React DOM, and Next resolve to at most one version each.",
  );

  const flags = await readConfiguredModuleFlags(targetDir);
  const exposureProblems = Object.entries(appManifest.modules || {}).filter(([key, entry]) => typeof flags[key] === "boolean" && flags[key] !== entry.exposed).map(([key, entry]) => `${key}: manifest exposed=${entry.exposed}, config enabled=${String(flags[key])}`);
  add(exposureProblems.length ? "FAIL" : "PASS", "exposure", exposureProblems.join("; ") || "Module exposure flags agree.");

  const workspaceRoot = runtimeOptions.workspaceRoot || argvOptions.workspaceRoot || await findWorkspaceRoot(targetDir);
  const catalog = await loadModuleCatalog({ targetDir, workspaceRoot });
  const available = { core: catalog.core.version, admin: catalog.admin.version, ...Object.fromEntries(Object.entries(appManifest.modules || {}).map(([key, entry]) => [key, entry.version])) };
  const topologyProblems = [];
  for (const key of Object.keys(appManifest.modules || {})) {
    for (const [requiredKey, range] of Object.entries(catalog[key]?.requires || {})) {
      if (!available[requiredKey]) topologyProblems.push(`${key} requires missing ${requiredKey}@${range}`);
      else if (!satisfiesVersion(available[requiredKey], range)) topologyProblems.push(`${key} requires ${requiredKey}@${range}, found ${available[requiredKey]}`);
    }
  }
  add(topologyProblems.length ? "FAIL" : "PASS", "topology", topologyProblems.join("; ") || "Module requirements are satisfied.");

  const scaffold = await scaffoldDrift(targetDir, appManifest.scaffoldFiles);
  const scaffoldGroups = {
    current: scaffold.entries.filter((entry) => entry.status === "current" && entry.intent !== "skipped"),
    owned: scaffold.entries.filter((entry) => entry.intent === "owned" && entry.status === "drifted"),
    skipped: scaffold.entries.filter((entry) => entry.intent === "skipped" && entry.status === "missing"),
    undecidedDrift: scaffold.entries.filter((entry) => entry.intent === "managed" && entry.status === "drifted"),
    undecidedMissing: scaffold.entries.filter((entry) => entry.intent === "managed" && entry.status === "missing"),
    mismatched: scaffold.entries.filter((entry) => (entry.intent === "owned" && entry.status === "missing") || (entry.intent === "skipped" && entry.status !== "missing")),
  };
  if (scaffoldGroups.owned.length) add("INFO", "scaffold-owned", `App-owned scaffold files: ${scaffoldGroups.owned.map((entry) => entry.relativePath).join(", ")}.`);
  if (scaffoldGroups.skipped.length) add("INFO", "scaffold-skipped", `Intentionally skipped scaffold files: ${scaffoldGroups.skipped.map((entry) => entry.relativePath).join(", ")}.`);
  if (scaffoldGroups.undecidedDrift.length) add("WARN", "scaffold-undecided-drift", `Unacknowledged drift: ${scaffoldGroups.undecidedDrift.map((entry) => entry.relativePath).join(", ")} (use bw scaffold own or bw diff).`);
  if (scaffoldGroups.undecidedMissing.length) add("WARN", "scaffold-undecided-missing", `Unacknowledged missing files: ${scaffoldGroups.undecidedMissing.map((entry) => entry.relativePath).join(", ")} (use bw scaffold skip after review).`);
  if (scaffoldGroups.mismatched.length) add("FAIL", "scaffold-intent-mismatch", `Recorded scaffold intent no longer matches reality: ${scaffoldGroups.mismatched.map((entry) => `${entry.relativePath} (${entry.intent}, ${entry.status})`).join(", ")}.`);
  const scaffoldStatus = scaffoldGroups.mismatched.length ? "FAIL" : scaffoldGroups.undecidedDrift.length || scaffoldGroups.undecidedMissing.length ? "WARN" : "PASS";
  add(scaffoldStatus, "scaffold", `${scaffoldGroups.current.length} current, ${scaffoldGroups.owned.length} owned, ${scaffoldGroups.skipped.length} skipped, ${scaffoldGroups.undecidedDrift.length} undecided-drift, ${scaffoldGroups.undecidedMissing.length} undecided-missing, ${scaffoldGroups.mismatched.length} intent-mismatch.`);
  add("INFO", "owned-surfaces", `Owned surfaces: ${(appManifest.ownedSurfaces || []).join(", ") || "none"}.`);

  const environment = await loadAppEnvironment(targetDir, runtimeOptions.env || process.env);
  const envNames = new Set(Object.keys(environment));
  const missingEnv = [];
  for (const key of Object.keys(appManifest.modules || {})) for (const entry of catalog[key]?.manifest?.env || []) if (entry.required && !envNames.has(entry.name)) missingEnv.push(`${key}:${entry.name}`);
  add(missingEnv.length ? "FAIL" : "PASS", "env", missingEnv.length ? `Missing required names: ${missingEnv.join(", ")}` : "Required environment variable names are present.");

  await inspectFunctionRegion({
    targetDir,
    options: argvOptions,
    runtimeOptions,
    appManifest,
    environment,
    add,
  });

  const migrationProblems = [];
  const migrationKeys = appManifest.app.template === "platform"
    ? Array.from(new Set(["core", "admin", ...Object.keys(appManifest.modules || {})]))
    : [];
  for (const key of migrationKeys) {
    const cursor = appManifest.migrationCursor?.[key];
    const status = await cursorMigrationStatus({ targetDir, moduleKey: key, cursor, catalogEntry: catalog[key] });
    if (status.shipsMigrations && cursor == null) {
      if (appManifest.adoptionNotes?.allowUncursored) add("WARN", `migration-cursor-${key}`, `${key}: migration cursor is null; adoption explicitly allowed uncursored operation.`);
      else migrationProblems.push(`${key}: migration cursor is null (run bw adopt --force --cursor ${key}=<migrationFilename>, or explicitly adopt with --allow-uncursored)`);
      continue;
    }
    if (status.shipsMigrations && status.missing.length > 0) migrationProblems.push(`${key}: ${status.missing.join(", ")}`);
  }
  add(migrationProblems.length ? "FAIL" : "PASS", "migrations", migrationProblems.join("; ") || "Migration cursors and flattened files agree.");
  for (const key of migrationKeys) {
    const cursor = appManifest.migrationCursor?.[key];
    if (cursor == null && appManifest.adoptionNotes?.allowUncursored) {
      add("WARN", `migration-provenance-${key}`, `${key}: exact migration provenance is unavailable because uncursored adoption is enabled.`);
      continue;
    }
    const status = await exactMigrationCompatibilityStatus({
      targetDir,
      moduleKey: key,
      cursor,
      catalogEntry: catalog[key],
      allowDeferred: appManifest.migrationDeferrals?.[key]?.reason === "destructive"
        && appManifest.migrationDeferrals[key].cursor === cursor,
    });
    if (!status.shipsMigrations) continue;
    const deferral = appManifest.migrationDeferrals?.[key];
    if (deferral && (!status.deferred?.length || deferral.nextMigration !== status.deferred[0] || !status.nextDeferredIsDestructive)) {
      status.issues.push(`recorded destructive deferral ${deferral.nextMigration} does not match the next destructive package migration`);
    }
    add(
      status.issues.length ? "FAIL" : "PASS",
      `migration-provenance-${key}`,
      status.issues.join("; ") || `${status.verified.length} ${key} migration files match compatible package provenance, source filename, current cursor, and sha256 content.`,
    );
    if (status.deferred?.length && status.issues.length === 0) {
      add("INFO", `migration-deferred-${key}`, `${key}: ${status.deferred.length} later package migration${status.deferred.length === 1 ? " is" : "s are"} intentionally outside cursor ${cursor}: ${status.deferred.join(", ")}.`);
    }
    if (status.legacyEquivalent?.length) {
      add("INFO", `migration-legacy-equivalent-${key}`, `${key}: ${status.legacyEquivalent.length} immutable historical migration file${status.legacyEquivalent.length === 1 ? " matches" : "s match"} a reviewed SQL-equivalent legacy hash.`);
    }
  }
  add("WARN", "db-objects", "SKIP live database checks are not available yet.");
  return finish(checks, argvOptions, appManifest, targetDir);
}

async function finish(checks, options, appManifest, targetDir) {
  for (const check of checks) output.write(`${check.status} ${check.id}: ${check.message}\n`);
  const hasFailure = checks.some((check) => check.status === "FAIL") || (options.strict && checks.some((check) => check.status === "WARN"));
  if (options.report && appManifest) {
    appManifest.lastDoctor = { at: new Date().toISOString(), ok: !hasFailure };
    await writeAppManifest(targetDir, appManifest);
  }
  return { ok: !hasFailure, checks };
}

export { HELP as DOCTOR_HELP };
