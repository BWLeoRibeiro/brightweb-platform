import { isAppOwnedSeed } from "./file-policy.mjs";
import { assertMutationTargets } from "./mutation-paths.mjs";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MODULE_STARTER_FILES, PLATFORM_STARTER_FILES, SELECTABLE_MODULES } from "./constants.mjs";
import { hashFile } from "./app-manifest.mjs";
import { pathExists } from "./generator.mjs";
import { resolveSafeRelativePath } from "./safe-path.mjs";

const BUNDLED_TEMPLATE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "template");

export async function resolveTemplateRoot({ targetDir, workspaceRoot } = {}) {
  const candidates = [
    workspaceRoot && path.join(path.resolve(workspaceRoot), "packages", "create-bw-app", "template"),
    targetDir && path.join(path.resolve(targetDir), "node_modules", "create-bw-app", "template"),
    BUNDLED_TEMPLATE_ROOT,
  ].filter(Boolean);
  for (const candidate of candidates) if (await pathExists(candidate)) return candidate;
  return null;
}

export function trackedScaffoldDefinitions(moduleKeys = []) {
  const definitions = PLATFORM_STARTER_FILES.map((relativePath) => ({
    moduleKey: "platform-base",
    relativePath,
    templateRelativePath: path.join("base", relativePath),
  }));
  for (const moduleKey of moduleKeys) {
    const folder = SELECTABLE_MODULES.find((entry) => entry.key === moduleKey)?.templateFolder;
    if (!folder) continue;
    for (const relativePath of MODULE_STARTER_FILES[moduleKey] || []) {
      definitions.push({ moduleKey, relativePath, templateRelativePath: path.join("modules", folder, relativePath) });
    }
  }
  return definitions.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

/** Missing ownership history is not permission to replace an existing scaffold. */
export async function assertNoUntrackedScaffoldWrites({ targetDir, scaffoldFiles, moduleKeys, relativePaths }) {
  const tracked = new Set(trackedScaffoldDefinitions(moduleKeys).map((entry) => entry.relativePath));
  for (const relativePath of relativePaths) {
    if (!tracked.has(relativePath) || scaffoldFiles[relativePath]) continue;
    const targetPath = resolveSafeRelativePath(targetDir, relativePath, "Scaffold output path");
    const exists = await fs.lstat(targetPath).then(() => true, (error) => {
      if (error.code === "ENOENT") return false;
      throw error;
    });
    if (exists) throw new Error(`Untracked app file conflicts with scaffold output: ${relativePath}. Move or reconcile it explicitly before continuing.`);
  }
}

export async function inventoryScaffoldFiles({ targetDir, moduleKeys, templateRoot }) {
  await assertMutationTargets(targetDir, trackedScaffoldDefinitions(moduleKeys).map((entry) => entry.relativePath));
  const records = {};
  const unsupported = [];
  for (const definition of trackedScaffoldDefinitions(moduleKeys)) {
    const templatePath = templateRoot && path.join(templateRoot, definition.templateRelativePath);
    if (!templatePath || !(await pathExists(templatePath))) {
      unsupported.push(definition.relativePath);
      continue;
    }
    const appPath = resolveSafeRelativePath(targetDir, definition.relativePath, "Scaffold file path");
    const templateHash = await hashFile(templatePath);
    const exists = await pathExists(appPath);
    records[definition.relativePath] = {
      ...(isAppOwnedSeed(definition.relativePath) ? { intent: "owned" } : {}),
      module: definition.moduleKey,
      hash: templateHash,
      status: !exists ? "missing" : await hashFile(appPath) === templateHash ? "current" : "drifted",
    };
  }
  return { records, unsupported };
}

/** Ownership belongs to an exact app path, independently of installed modules. */
export function preserveScaffoldDecisions(records, previousRecords = {}, protectedPaths = new Set()) {
  const reconciled = { ...records };
  for (const [relativePath, record] of Object.entries(previousRecords)) {
    if (["owned", "skipped"].includes(record.intent) || protectedPaths.has(relativePath)) {
      reconciled[relativePath] = { ...record };
    }
  }
  return reconciled;
}

export async function scaffoldDrift(targetDir, scaffoldFiles = {}) {
  await assertMutationTargets(targetDir, Object.keys(scaffoldFiles));
  const current = [];
  const drifted = [];
  const missing = [];
  const entries = [];
  for (const [relativePath, record] of Object.entries(scaffoldFiles)) {
    const appPath = resolveSafeRelativePath(targetDir, relativePath, "Manifest scaffold file path");
    const intent = record.intent === "skipped" ? "skipped" : isAppOwnedSeed(relativePath) ? "owned" : record.intent || "managed";
    let status = "missing";
    if (await pathExists(appPath)) {
      const matchesRecordedHash = await hashFile(appPath) === record.hash;
      status = matchesRecordedHash && record.status !== "drifted" ? "current" : "drifted";
    }
    entries.push({ relativePath, module: record.module, status, intent });
    if (status === "missing") missing.push(relativePath);
    else if (status === "current") current.push(relativePath);
    else drifted.push(relativePath);
  }
  const intentional = entries.filter((entry) => entry.intent !== "managed").map((entry) => entry.relativePath);
  const protectedPaths = new Set([...drifted, ...intentional]);
  return { current, drifted, missing, entries, intentional, protectedPaths };
}

export async function findTrackedTemplate({ relativePath, manifest, targetDir, workspaceRoot }) {
  const record = manifest.scaffoldFiles?.[relativePath];
  if (!record) return { record: null, templatePath: null, templateRoot: null };
  const definition = trackedScaffoldDefinitions(Object.keys(manifest.modules || {}))
    .find((entry) => entry.relativePath === relativePath && entry.moduleKey === record.module);
  const templateRoot = await resolveTemplateRoot({ targetDir, workspaceRoot });
  const templatePath = definition && templateRoot ? path.join(templateRoot, definition.templateRelativePath) : null;
  return { record, templatePath: templatePath && await pathExists(templatePath) ? templatePath : null, templateRoot };
}

export async function readTextFile(filePath) {
  return fs.readFile(filePath, "utf8");
}

export async function canonicalScaffoldHash({ relativePath, manifest, targetDir, workspaceRoot }) {
  const { createOptionalModuleRouteFiles } = await import("./generator.mjs");
  const generated = createOptionalModuleRouteFiles(Object.keys(manifest.modules || {}))[relativePath];
  if (generated != null) return `sha256:${createHash("sha256").update(generated).digest("hex")}`;
  const located = await findTrackedTemplate({ relativePath, manifest, targetDir, workspaceRoot });
  return located.templatePath ? hashFile(located.templatePath) : null;
}
