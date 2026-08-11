import fs from "node:fs/promises";
import path from "node:path";
import { resolveSafeRelativePath } from "./safe-path.mjs";
import { TEMPLATE_ROOT, pathExists } from "./generator.mjs";

export async function findAppMigrationsDirectory(targetDir) {
  let current = path.resolve(targetDir);
  while (true) {
    const candidate = path.join(current, "supabase", "migrations");
    if (await pathExists(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return path.join(path.resolve(targetDir), "supabase", "migrations");
    current = parent;
  }
}

export async function getModuleMigrations(moduleKey, catalogEntry = {}) {
  const candidates = [];
  const configuredPath = catalogEntry.manifest?.database?.migrations;
  if (catalogEntry.packageRoot && configuredPath) {
    candidates.push(resolveSafeRelativePath(catalogEntry.packageRoot, configuredPath, `${catalogEntry.key || "Module"} migration manifest path`));
  }
  if (catalogEntry.packageRoot) candidates.push(path.join(catalogEntry.packageRoot, "migrations"));
  candidates.push(path.join(TEMPLATE_ROOT, "supabase", "modules", moduleKey, "migrations"));
  for (const directory of candidates) {
    if (!(await pathExists(directory))) continue;
    const fileNames = (await fs.readdir(directory)).filter((fileName) => fileName.endsWith(".sql")).sort();
    if (fileNames.length > 0) {
      return Promise.all(fileNames.map(async (fileName) => {
        const sourcePath = path.join(directory, fileName);
        const source = await fs.readFile(sourcePath, "utf8");
        return {
          fileName,
          sourcePath,
          destructive: /^\s*--\s*bw-migration-safety:\s*destructive\s*$/im.test(source),
        };
      }));
    }
  }
  return [];
}

export async function planMigrationAppends({
  targetDir,
  moduleKeys,
  catalog,
  migrationCursor = {},
  migrationUpperBounds = {},
}) {
  const migrationsDir = await findAppMigrationsDirectory(targetDir);
  const existing = (await pathExists(migrationsDir))
    ? (await fs.readdir(migrationsDir)).filter((fileName) => fileName.endsWith(".sql")).sort()
    : [];
  let sequence = existing.reduce((maximum, fileName) => {
    const match = fileName.match(/^(\d+)_/);
    return Math.max(maximum, Number(match?.[1] || 0));
  }, 0);
  const writes = [];
  const deferred = [];
  const nextCursor = { ...migrationCursor };
  for (const moduleKey of moduleKeys) {
    const migrations = await getModuleMigrations(moduleKey, catalog[moduleKey]);
    const cursor = migrationCursor[moduleKey];
    const upperBound = migrationUpperBounds[moduleKey];
    let migrationsInScope = migrations;
    if (upperBound) {
      const upperBoundIndex = migrations.findIndex((entry) => entry.fileName === upperBound);
      if (upperBoundIndex === -1) {
        throw new Error(`Migration cutoff ${upperBound} does not exist for module ${moduleKey}.`);
      }
      if (cursor) {
        const cursorIndex = migrations.findIndex((entry) => entry.fileName === cursor);
        if (cursorIndex === -1) {
          throw new Error(`Migration cutoff blocked: current cursor ${cursor} does not exist in the shipped ${moduleKey} migration history.`);
        }
        if (upperBoundIndex < cursorIndex) {
          throw new Error(`Migration cutoff ${upperBound} is before the current ${moduleKey} cursor ${cursor}.`);
        }
      }
      migrationsInScope = migrations.slice(0, upperBoundIndex + 1);
      deferred.push(...migrations.slice(upperBoundIndex + 1).map((entry) => ({ moduleKey, ...entry })));
    }
    const pending = cursor
      ? migrationsInScope.filter((entry) => entry.fileName > cursor)
      : migrationsInScope;
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
    if (migrationsInScope.length > 0) nextCursor[moduleKey] = migrationsInScope.at(-1).fileName;
  }
  return { writes, deferred, nextCursor };
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
  const migrationsDir = await findAppMigrationsDirectory(targetDir);
  const installed = [];
  if (await pathExists(migrationsDir)) {
    for (const fileName of await fs.readdir(migrationsDir)) {
      if (!fileName.endsWith(".sql")) continue;
      const content = await fs.readFile(path.join(migrationsDir, fileName), "utf8");
      installed.push({ fileName, content });
    }
  }
  return {
    shipsMigrations: true,
    missing: expected.filter((entry) => !installed.some(({ fileName, content }) => {
      if (fileName === entry.fileName || fileName.endsWith(`_${moduleKey}__${entry.fileName}`)) return true;
      const header = content.match(/^\s*--\s*bw-module:\s*([^@\s]+)@[^\s]+\s+([^\s]+)/im);
      return header?.[1] === moduleKey && header?.[2] === entry.fileName;
    })).map((entry) => entry.fileName),
  };
}
