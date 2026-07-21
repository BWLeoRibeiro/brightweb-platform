import fs from "node:fs/promises";
import path from "node:path";
import { stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import {
  APP_MANIFEST_PATH,
  MANAGED_APP_FILES,
  MODULE_PACKAGES,
  cleanVersion,
  findWorkspaceRoot,
  loadModuleCatalog,
  readConfiguredModuleFlags,
  writeAppManifest,
} from "./app-manifest.mjs";
import { pathExists, readJsonIfPresent } from "./generator.mjs";
import { findAppMigrationsDirectory, getModuleMigrations } from "./migrations.mjs";
import { inventoryScaffoldFiles, resolveTemplateRoot } from "./scaffold.mjs";
import { detectDependencyMode, detectTemplate } from "./update.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HELP = `Usage: bw adopt [options]\n\nOptions:\n  --target-dir <path>                 App directory (defaults to cwd)\n  --workspace-root <path>             BrightWeb workspace root\n  --cursor <key>=<migrationFilename>  Override a migration cursor (repeatable)\n  --owned-surface <name>              Record an app-owned surface (repeatable)\n  --own <path>                        Mark an existing scaffold file app-owned (repeatable)\n  --skip <path>                       Mark a missing scaffold file intentionally absent (repeatable)\n  --allow-uncursored                   Allow doctor to warn instead of fail on null cursors\n  --force                              Replace an existing app manifest\n  --dry-run                            Print the manifest and warnings without writing\n  --help                               Show this help`;

function asList(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function parseCursorOverrides(values) {
  const overrides = {};
  for (const value of asList(values)) {
    const separator = String(value).indexOf("=");
    if (separator < 1 || separator === String(value).length - 1) throw new Error(`Invalid --cursor value: ${value}. Expected <key>=<migrationFilename>.`);
    overrides[String(value).slice(0, separator)] = String(value).slice(separator + 1);
  }
  return overrides;
}

async function migrationFiles(targetDir) {
  const directory = await findAppMigrationsDirectory(targetDir);
  if (!(await pathExists(directory))) return [];
  const files = [];
  for (const fileName of (await fs.readdir(directory)).filter((entry) => entry.endsWith(".sql")).sort()) {
    files.push({ fileName, content: await fs.readFile(path.join(directory, fileName), "utf8") });
  }
  return files;
}

function latestShippedMatch(shipped, predicate) {
  return shipped.filter((entry) => predicate(entry.fileName)).at(-1)?.fileName || null;
}

function leadingBaselineDomain(content) {
  const line = content.split(/\r?\n/).find((entry) => entry.trim().length > 0);
  return line?.match(/^\s*--\s*Brightweb\s+(.+?)\s+v1\s+baseline\.?\s*$/i)?.[1]?.trim().toLowerCase() || null;
}

async function bootstrapCursor({ moduleKey, catalogEntry, appMigrations, override, warnings }) {
  const shipped = await getModuleMigrations(moduleKey, catalogEntry);
  if (shipped.length === 0) return { shipsMigrations: false, cursor: undefined, strategy: "none" };
  if (override) {
    if (!shipped.some((entry) => entry.fileName === override)) throw new Error(`Cursor override for ${moduleKey} does not name a shipped migration: ${override}`);
    return { shipsMigrations: true, cursor: override, strategy: "override" };
  }

  const escapedKey = moduleKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const provenance = latestShippedMatch(shipped, (shippedName) => appMigrations.some(({ content }) => {
    const match = content.match(new RegExp(`^\\s*--\\s*bw-module:\\s*${escapedKey}@[^\\s]+\\s+([^\\s]+)`, "im"));
    return match?.[1] === shippedName;
  }));
  if (provenance) return { shipsMigrations: true, cursor: provenance, strategy: "provenance" };

  const filename = latestShippedMatch(shipped, (shippedName) => appMigrations.some(({ fileName }) =>
    fileName.endsWith(`_${moduleKey}__${shippedName}`)));
  if (filename) return { shipsMigrations: true, cursor: filename, strategy: "filename" };

  const domains = new Set([moduleKey.toLowerCase(), catalogEntry?.manifest?.title?.toLowerCase()].filter(Boolean));
  const baselineFound = appMigrations.some(({ content }) => domains.has(leadingBaselineDomain(content)));
  if (baselineFound) {
    const v1 = shipped.filter((entry) => /(?:^|_)v1(?:_|\.sql$)/i.test(entry.fileName));
    const cursor = (v1.length > 0 ? v1 : shipped.slice(0, 1)).at(-1).fileName;
    const later = shipped.filter((entry) => entry.fileName > cursor).map((entry) => entry.fileName);
    warnings.push(`WARN ${moduleKey}: baseline header matched; cursor set to ${cursor}.${later.length ? ` Later package migrations are UNAPPLIED and the next bw upgrade will plan: ${later.join(", ")}.` : ""}`);
    return { shipsMigrations: true, cursor, strategy: "baseline-header" };
  }

  warnings.push(`WARN BLOCKED ${moduleKey}: no migration provenance, filename, or baseline-header match. Cursor is null; module migration upgrades are blocked until a cursor is set.`);
  return { shipsMigrations: true, cursor: null, strategy: "uncursored" };
}

export async function adoptBrightwebApp(argvOptions = {}, runtimeOptions = {}) {
  if (argvOptions.help) { output.write(`${HELP}\n`); return { help: true }; }
  const targetDir = path.resolve(runtimeOptions.targetDir || argvOptions.targetDir || process.cwd());
  const existingManifestPath = path.join(targetDir, APP_MANIFEST_PATH);
  if (await pathExists(existingManifestPath) && !argvOptions.force) throw new Error(`Refusing to overwrite existing ${APP_MANIFEST_PATH}; pass --force to replace it.`);
  const packageJson = await readJsonIfPresent(path.join(targetDir, "package.json"));
  if (!packageJson) throw new Error(`Target directory does not contain package.json: ${targetDir}`);

  const dependencies = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
  const installedBrightwebPackages = new Map(Object.entries(dependencies)
    .filter(([name]) => name.startsWith("@brightweblabs/"))
    .map(([name, version]) => [name, { version }]));
  const template = await detectTemplate(targetDir, installedBrightwebPackages);
  const dependencyMode = detectDependencyMode(installedBrightwebPackages);
  const workspaceRootCandidate = runtimeOptions.workspaceRoot || argvOptions.workspaceRoot || await findWorkspaceRoot(targetDir);
  const workspaceRoot = workspaceRootCandidate ? path.resolve(workspaceRootCandidate) : null;
  const catalog = await loadModuleCatalog({ targetDir, workspaceRoot });
  const warnings = [];
  const now = (runtimeOptions.now ? new Date(runtimeOptions.now) : new Date()).toISOString();
  const flags = await readConfiguredModuleFlags(targetDir);
  const modules = {};
  for (const [moduleKey, packageName] of Object.entries(MODULE_PACKAGES)) {
    if (!dependencies[packageName]) continue;
    const exposed = typeof flags[moduleKey] === "boolean" ? flags[moduleKey] : true;
    if (typeof flags[moduleKey] !== "boolean") warnings.push(`WARN ${moduleKey}: config/modules.ts exposure was not parseable; defaulting exposed=true.`);
    modules[moduleKey] = {
      version: cleanVersion(dependencies[packageName]) || catalog[moduleKey]?.version,
      installedAt: now,
      exposed,
    };
  }

  const templateRoot = await resolveTemplateRoot({ targetDir, workspaceRoot });
  const scaffold = template === "platform"
    ? await inventoryScaffoldFiles({ targetDir, moduleKeys: Object.keys(modules), templateRoot })
    : { records: {}, unsupported: [] };
  const ownedPaths = new Set(asList(argvOptions.own).map(String));
  const skippedPaths = new Set(asList(argvOptions.skip).map(String));
  for (const relativePath of [...ownedPaths, ...skippedPaths]) {
    if (!scaffold.records[relativePath]) throw new Error(`${relativePath} is not a tracked scaffold file.`);
  }
  for (const relativePath of ownedPaths) {
    if (skippedPaths.has(relativePath)) throw new Error(`${relativePath} cannot be both --own and --skip.`);
    if (scaffold.records[relativePath].status === "missing") throw new Error(`Cannot own missing scaffold file: ${relativePath}`);
    scaffold.records[relativePath].intent = "owned";
  }
  for (const relativePath of skippedPaths) {
    if (scaffold.records[relativePath].status !== "missing") throw new Error(`Cannot skip existing scaffold file: ${relativePath}`);
    scaffold.records[relativePath].intent = "skipped";
  }
  for (const relativePath of scaffold.unsupported) warnings.push(`WARN ${relativePath}: installed-version template is unavailable; scaffold comparison is unsupported.`);
  for (const [relativePath, record] of Object.entries(scaffold.records)) {
    if (record.status === "drifted" && record.intent !== "owned") warnings.push(`WARN drifted scaffold file: ${relativePath}`);
    if (record.status === "missing" && record.intent !== "skipped") warnings.push(`WARN missing scaffold file: ${relativePath} (not created; use bw diff and the current template as guidance).`);
  }

  const overrides = parseCursorOverrides(argvOptions.cursor);
  const unknownOverride = Object.keys(overrides).find((key) => !catalog[key]);
  if (unknownOverride) throw new Error(`Unknown module key in --cursor: ${unknownOverride}`);
  const appMigrations = template === "platform" ? await migrationFiles(targetDir) : [];
  const migrationCursor = {};
  const cursorStrategies = {};
  const migrationKeys = template === "platform" ? Array.from(new Set(["core", "admin", ...Object.keys(modules)])) : [];
  for (const moduleKey of migrationKeys) {
    const result = await bootstrapCursor({ moduleKey, catalogEntry: catalog[moduleKey], appMigrations, override: overrides[moduleKey], warnings });
    if (result.shipsMigrations) {
      migrationCursor[moduleKey] = result.cursor;
      cursorStrategies[moduleKey] = result.strategy;
    }
  }

  const cliPackage = await readJsonIfPresent(path.join(PACKAGE_ROOT, "package.json"));
  const manifest = {
    contractVersion: 1,
    app: {
      slug: packageJson.name || path.basename(targetDir),
      template,
      scaffoldedWith: `create-bw-app@${cliPackage?.version || "unknown"}`,
      dependencyMode,
      adoptedAt: now,
    },
    modules,
    scaffoldFiles: scaffold.records,
    managedFiles: template === "platform" ? MANAGED_APP_FILES : ["docs/ai/app-context.json"],
    migrationCursor,
    ownedSurfaces: Array.from(new Set(asList(argvOptions.ownedSurface).map(String))),
    adoptionNotes: {
      allowUncursored: argvOptions.allowUncursored === true,
      cursorStrategies,
    },
  };

  output.write(`bw adopt${argvOptions.dryRun ? " --dry-run" : ""}\n${JSON.stringify(manifest, null, 2)}\n`);
  for (const warning of warnings) output.write(`${warning}\n`);
  if (argvOptions.dryRun) return { dryRun: true, manifest, warnings };
  await writeAppManifest(targetDir, manifest);
  output.write(`Adopted ${manifest.app.slug}; wrote ${APP_MANIFEST_PATH}. No migration files or database objects were changed.\n`);
  return { dryRun: false, manifest, warnings };
}

export { HELP as ADOPT_HELP };
