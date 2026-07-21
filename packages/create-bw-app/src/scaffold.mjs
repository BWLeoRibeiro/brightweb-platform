import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MODULE_STARTER_FILES, PLATFORM_STARTER_FILES, SELECTABLE_MODULES } from "./constants.mjs";
import { hashFile } from "./app-manifest.mjs";
import { pathExists } from "./generator.mjs";

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

export async function inventoryScaffoldFiles({ targetDir, moduleKeys, templateRoot }) {
  const records = {};
  const unsupported = [];
  for (const definition of trackedScaffoldDefinitions(moduleKeys)) {
    const templatePath = templateRoot && path.join(templateRoot, definition.templateRelativePath);
    if (!templatePath || !(await pathExists(templatePath))) {
      unsupported.push(definition.relativePath);
      continue;
    }
    const appPath = path.join(targetDir, definition.relativePath);
    const templateHash = await hashFile(templatePath);
    const exists = await pathExists(appPath);
    records[definition.relativePath] = {
      module: definition.moduleKey,
      hash: templateHash,
      status: !exists ? "missing" : await hashFile(appPath) === templateHash ? "current" : "drifted",
    };
  }
  return { records, unsupported };
}

export async function scaffoldDrift(targetDir, scaffoldFiles = {}) {
  const current = [];
  const drifted = [];
  const missing = [];
  const entries = [];
  for (const [relativePath, record] of Object.entries(scaffoldFiles)) {
    const appPath = path.join(targetDir, relativePath);
    const intent = record.intent || "managed";
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
  return { current, drifted, missing, entries };
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
