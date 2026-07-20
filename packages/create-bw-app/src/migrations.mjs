import fs from "node:fs/promises";
import path from "node:path";
import { TEMPLATE_ROOT, pathExists } from "./generator.mjs";

export async function getModuleMigrations(moduleKey, catalogEntry = {}) {
  const candidates = [];
  const configuredPath = catalogEntry.manifest?.database?.migrations;
  if (catalogEntry.packageRoot && configuredPath) candidates.push(path.resolve(catalogEntry.packageRoot, configuredPath));
  if (catalogEntry.packageRoot) candidates.push(path.join(catalogEntry.packageRoot, "migrations"));
  candidates.push(path.join(TEMPLATE_ROOT, "supabase", "modules", moduleKey, "migrations"));
  for (const directory of candidates) {
    if (!(await pathExists(directory))) continue;
    const fileNames = (await fs.readdir(directory)).filter((fileName) => fileName.endsWith(".sql")).sort();
    if (fileNames.length > 0) return fileNames.map((fileName) => ({ fileName, sourcePath: path.join(directory, fileName) }));
  }
  return [];
}

export async function planMigrationAppends({ targetDir, moduleKeys, catalog, migrationCursor = {} }) {
  const migrationsDir = path.join(targetDir, "supabase", "migrations");
  const existing = (await pathExists(migrationsDir))
    ? (await fs.readdir(migrationsDir)).filter((fileName) => fileName.endsWith(".sql")).sort()
    : [];
  let sequence = existing.reduce((maximum, fileName) => {
    const match = fileName.match(/^(\d+)_/);
    return Math.max(maximum, Number(match?.[1] || 0));
  }, 0);
  const writes = [];
  const nextCursor = { ...migrationCursor };
  for (const moduleKey of moduleKeys) {
    const migrations = await getModuleMigrations(moduleKey, catalog[moduleKey]);
    const cursor = migrationCursor[moduleKey];
    const pending = cursor ? migrations.filter((entry) => entry.fileName > cursor) : migrations;
    for (const entry of pending) {
      sequence += 1;
      const targetFileName = `${String(sequence).padStart(4, "0")}_${moduleKey}__${entry.fileName}`;
      const source = await fs.readFile(entry.sourcePath, "utf8");
      const version = catalog[moduleKey]?.version || "unknown";
      writes.push({
        moduleKey,
        originalFileName: entry.fileName,
        targetFileName,
        targetPath: path.join(migrationsDir, targetFileName),
        content: `-- bw-module: ${moduleKey}@${version} ${entry.fileName}\n${source}`,
      });
    }
    if (migrations.length > 0) nextCursor[moduleKey] = migrations.at(-1).fileName;
  }
  return { writes, nextCursor };
}

export async function applyMigrationWrites(writes) {
  for (const write of writes) {
    await fs.mkdir(path.dirname(write.targetPath), { recursive: true });
    await fs.writeFile(write.targetPath, write.content, "utf8");
  }
}

export async function cursorMigrationStatus({ targetDir, moduleKey, cursor, catalogEntry }) {
  const migrations = await getModuleMigrations(moduleKey, catalogEntry);
  if (migrations.length === 0) return { shipsMigrations: false, missing: [] };
  if (!cursor) return { shipsMigrations: true, missing: ["migration cursor"] };
  const expected = migrations.filter((entry) => entry.fileName <= cursor);
  const migrationsDir = path.join(targetDir, "supabase", "migrations");
  const installed = (await pathExists(migrationsDir)) ? await fs.readdir(migrationsDir) : [];
  return {
    shipsMigrations: true,
    missing: expected.filter((entry) => !installed.some((fileName) => fileName.includes(`_${moduleKey}__${entry.fileName}`))).map((entry) => entry.fileName),
  };
}
