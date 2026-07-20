import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_DEPENDENCY_DEFAULTS, MODULE_STARTER_FILES, PLATFORM_STARTER_FILES, SELECTABLE_MODULES } from "./constants.mjs";

const TEMPLATE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "template");

async function pathExists(targetPath) {
  try { await fs.access(targetPath); return true; } catch { return false; }
}

async function readJsonIfPresent(filePath) {
  if (!(await pathExists(filePath))) return null;
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export const APP_MANIFEST_PATH = path.join(".brightweb", "app-manifest.json");
export const MANAGED_APP_FILES = [
  "next.config.ts",
  "config/modules.ts",
  "config/shell.ts",
  "docs/ai/app-context.json",
];

export const MODULE_PACKAGES = {
  admin: "@brightweblabs/module-admin",
  crm: "@brightweblabs/module-crm",
  orgs: "@brightweblabs/module-orgs",
  projects: "@brightweblabs/module-projects",
};

const FALLBACK_REQUIRES = {
  core: {},
  admin: { core: ">=0.4" },
  orgs: { core: ">=0.4", admin: ">=0.3" },
  crm: { core: ">=0.4", admin: ">=0.3", orgs: ">=0.1" },
  projects: { core: ">=0.4", admin: ">=0.3", orgs: ">=0.1" },
};

export function cleanVersion(version) {
  if (typeof version !== "string") return null;
  const match = version.match(/(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/);
  return match?.[1] || null;
}

function compareVersions(left, right) {
  const a = cleanVersion(left)?.split("-")[0].split(".").map(Number) || [];
  const b = cleanVersion(right)?.split("-")[0].split(".").map(Number) || [];
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
  }
  return 0;
}

export function satisfiesVersion(version, range) {
  const normalized = cleanVersion(version);
  if (!normalized || typeof range !== "string") return false;
  if (range === "*" || range === "workspace:*") return true;
  const expectedMatch = range.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  const expected = expectedMatch ? `${expectedMatch[1]}.${expectedMatch[2] || "0"}.${expectedMatch[3] || "0"}` : null;
  if (!expected) return false;
  if (range.trim().startsWith(">=")) return compareVersions(normalized, expected) >= 0;
  if (range.trim().startsWith("^")) {
    return normalized.split(".")[0] === expected.split(".")[0] && compareVersions(normalized, expected) >= 0;
  }
  if (range.trim().startsWith("~")) {
    const actualParts = normalized.split(".");
    const expectedParts = expected.split(".");
    return actualParts[0] === expectedParts[0] && actualParts[1] === expectedParts[1] && compareVersions(normalized, expected) >= 0;
  }
  return normalized === expected;
}

export async function hashFile(filePath) {
  const content = await fs.readFile(filePath);
  return `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`;
}

export async function readAppManifest(targetDir, { required = true } = {}) {
  const manifestPath = path.join(targetDir, APP_MANIFEST_PATH);
  const manifest = await readJsonIfPresent(manifestPath);
  if (!manifest && required) {
    throw new Error(`No BrightWeb app manifest found at ${APP_MANIFEST_PATH}. Pre-manifest apps must be adopted before using bw.`);
  }
  return manifest;
}

export async function writeAppManifest(targetDir, manifest) {
  const manifestPath = path.join(targetDir, APP_MANIFEST_PATH);
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export function validateAppManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return ["manifest must be an object"];
  if (manifest.contractVersion !== 1) errors.push("contractVersion must equal 1");
  if (!manifest.app || typeof manifest.app.slug !== "string" || !["platform", "site"].includes(manifest.app.template) || typeof manifest.app.scaffoldedWith !== "string") {
    errors.push("app must contain slug, template, and scaffoldedWith");
  }
  for (const key of ["modules", "scaffoldFiles", "migrationCursor"]) {
    if (!manifest[key] || typeof manifest[key] !== "object" || Array.isArray(manifest[key])) errors.push(`${key} must be an object`);
  }
  if (!Array.isArray(manifest.managedFiles) || manifest.managedFiles.some((entry) => typeof entry !== "string")) errors.push("managedFiles must be an array of paths");
  for (const [key, entry] of Object.entries(manifest.modules || {})) {
    if (!entry || !cleanVersion(entry.version) || typeof entry.installedAt !== "string" || typeof entry.exposed !== "boolean") errors.push(`modules.${key} is invalid`);
  }
  for (const [relativePath, entry] of Object.entries(manifest.scaffoldFiles || {})) {
    if (!entry || typeof entry.module !== "string" || !/^sha256:[a-f0-9]{64}$/.test(entry.hash || "") || !["current", "drifted", "missing"].includes(entry.status)) errors.push(`scaffoldFiles.${relativePath} is invalid`);
  }
  if (manifest.lastDoctor != null && (typeof manifest.lastDoctor.at !== "string" || typeof manifest.lastDoctor.ok !== "boolean")) errors.push("lastDoctor is invalid");
  return errors;
}

export function moduleVersion(moduleKey, versionMap = {}) {
  if (moduleKey === "core") return cleanVersion(versionMap["@brightweblabs/core-auth"] || APP_DEPENDENCY_DEFAULTS["@brightweblabs/core-auth"]);
  const packageName = MODULE_PACKAGES[moduleKey];
  return cleanVersion(versionMap[packageName] || APP_DEPENDENCY_DEFAULTS[packageName]);
}

export async function collectScaffoldFiles(targetDir, selectedModules) {
  const files = new Map();
  for (const relativePath of PLATFORM_STARTER_FILES) files.set(relativePath, "platform-base");
  for (const moduleKey of selectedModules) {
    const definition = SELECTABLE_MODULES.find((candidate) => candidate.key === moduleKey);
    if (!definition) continue;
    const root = path.join(TEMPLATE_ROOT, "modules", definition.templateFolder);
    if (!(await pathExists(root))) continue;
    const pending = [root];
    while (pending.length > 0) {
      const current = pending.pop();
      for (const entry of await fs.readdir(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) pending.push(fullPath);
        else files.set(path.relative(root, fullPath), moduleKey);
      }
    }
    for (const relativePath of MODULE_STARTER_FILES[moduleKey] || []) files.set(relativePath, moduleKey);
  }
  const result = {};
  for (const [relativePath, moduleKey] of Array.from(files.entries()).sort()) {
    const targetPath = path.join(targetDir, relativePath);
    if (await pathExists(targetPath)) result[relativePath] = { module: moduleKey, hash: await hashFile(targetPath), status: "current" };
  }
  return result;
}

export async function createInitialAppManifest({ targetDir, slug, template, selectedModules, versionMap, dbInstallPlan, cliVersion }) {
  const now = new Date().toISOString();
  const modules = {};
  if (template === "platform") {
    for (const moduleKey of selectedModules) modules[moduleKey] = { version: moduleVersion(moduleKey, versionMap), installedAt: now, exposed: true };
    if ((selectedModules.includes("crm") || selectedModules.includes("projects")) && !modules.orgs) {
      modules.orgs = { version: moduleVersion("orgs", versionMap), installedAt: now, exposed: true };
    }
  }
  const migrationCursor = {};
  for (const moduleKey of dbInstallPlan?.resolvedOrder || []) {
    const directory = path.join(TEMPLATE_ROOT, "supabase", "modules", moduleKey, "migrations");
    if (!(await pathExists(directory))) continue;
    const migrations = (await fs.readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
    if (migrations.length > 0) migrationCursor[moduleKey] = migrations.at(-1);
  }
  return {
    contractVersion: 1,
    app: { slug, template, scaffoldedWith: `create-bw-app@${cliVersion}` },
    modules,
    scaffoldFiles: template === "platform" ? await collectScaffoldFiles(targetDir, selectedModules) : {},
    managedFiles: template === "platform" ? MANAGED_APP_FILES : ["docs/ai/app-context.json"],
    migrationCursor,
  };
}

export async function findWorkspaceRoot(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    if ((await pathExists(path.join(current, "brightweb-release.json"))) && (await pathExists(path.join(current, "packages")))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export async function loadModuleCatalog({ targetDir, workspaceRoot }) {
  const catalog = { core: { key: "core", requires: {}, version: moduleVersion("core"), packageName: "@brightweblabs/core-auth" } };
  for (const [moduleKey, packageName] of Object.entries(MODULE_PACKAGES)) {
    const folderName = packageName.replace("@brightweblabs/", "");
    const candidates = [
      workspaceRoot && path.join(workspaceRoot, "packages", folderName),
      path.join(targetDir, "node_modules", ...packageName.split("/")),
    ].filter(Boolean);
    let packageRoot = null;
    let moduleManifest = null;
    let packageManifest = null;
    for (const candidate of candidates) {
      moduleManifest = await readJsonIfPresent(path.join(candidate, "brightweb.module.json"));
      packageManifest = await readJsonIfPresent(path.join(candidate, "package.json"));
      if (moduleManifest) { packageRoot = candidate; break; }
    }
    moduleManifest ||= await readJsonIfPresent(path.join(TEMPLATE_ROOT, "module-manifests", moduleKey, "brightweb.module.json"));
    catalog[moduleKey] = {
      key: moduleKey,
      packageName,
      packageRoot,
      manifest: moduleManifest || { key: moduleKey, requires: FALLBACK_REQUIRES[moduleKey], env: [] },
      requires: moduleManifest?.requires || FALLBACK_REQUIRES[moduleKey],
      version: cleanVersion(packageManifest?.version) || moduleVersion(moduleKey),
    };
  }
  return catalog;
}

export function resolveModuleClosure(catalog, requestedKeys) {
  const order = [];
  const visited = new Set(["core", "admin"]);
  const visiting = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    if (!catalog[key]) throw new Error(`Unknown module key: ${key}`);
    if (visiting.has(key)) throw new Error(`Circular module dependency detected at ${key}`);
    visiting.add(key);
    for (const dependency of Object.keys(catalog[key].requires || {})) visit(dependency);
    visiting.delete(key);
    visited.add(key);
    order.push(key);
  }
  for (const key of requestedKeys) {
    if (key === "admin") order.push("admin");
    else visit(key);
  }
  return order;
}

export async function readConfiguredModuleFlags(targetDir) {
  const filePath = path.join(targetDir, "config", "modules.ts");
  if (!(await pathExists(filePath))) return {};
  const content = await fs.readFile(filePath, "utf8");
  const flags = {};
  for (const key of ["core-auth", "orgs", "crm", "projects", "admin"]) {
    const match = content.match(new RegExp(`key:\\s*"${key}"[\\s\\S]*?enabled:\\s*(true|false)`));
    if (match) flags[key === "core-auth" ? "core" : key] = match[1] === "true";
  }
  return flags;
}
