import fs from "node:fs/promises";
import path from "node:path";
import { stdout as output } from "node:process";
import { cursorMigrationStatus } from "./migrations.mjs";
import { findWorkspaceRoot, loadModuleCatalog, MODULE_PACKAGES, readAppManifest, readConfiguredModuleFlags, satisfiesVersion, validateAppManifest, writeAppManifest } from "./app-manifest.mjs";
import { pathExists, readJsonIfPresent } from "./generator.mjs";
import { scaffoldDrift } from "./scaffold.mjs";

const HELP = `Usage: bw doctor [options]\n\nOptions:\n  --target-dir <path>       App directory (defaults to cwd)\n  --workspace-root <path>   BrightWeb workspace root\n  --strict                  Treat warnings as failures\n  --report                  Stamp lastDoctor in the app manifest\n  --help                    Show this help`;

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

  const envNames = new Set(Object.keys(process.env));
  const envPath = path.join(targetDir, ".env.local");
  if (await pathExists(envPath)) {
    for (const line of (await fs.readFile(envPath, "utf8")).split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      if (match) envNames.add(match[1]);
    }
  }
  const missingEnv = [];
  for (const key of Object.keys(appManifest.modules || {})) for (const entry of catalog[key]?.manifest?.env || []) if (entry.required && !envNames.has(entry.name)) missingEnv.push(`${key}:${entry.name}`);
  add(missingEnv.length ? "FAIL" : "PASS", "env", missingEnv.length ? `Missing required names: ${missingEnv.join(", ")}` : "Required environment variable names are present.");

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
