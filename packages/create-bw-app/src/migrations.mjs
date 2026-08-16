import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
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
    ? await Promise.all((await fs.readdir(migrationsDir)).filter((fileName) => fileName.endsWith(".sql")).sort().map(async (fileName) => ({
      fileName,
      targetPath: path.join(migrationsDir, fileName),
      content: await fs.readFile(path.join(migrationsDir, fileName), "utf8"),
    })))
    : [];
  let sequence = existing.reduce((maximum, entry) => {
    const match = entry.fileName.match(/^(\d+)_/);
    return Math.max(maximum, Number(match?.[1] || 0));
  }, 0);
  const appends = [];
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
      appends.push({
        moduleKey,
        originalFileName: entry.fileName,
        targetFileName,
        targetPath: path.join(migrationsDir, targetFileName),
        content: `-- bw-module: ${moduleKey}@${version} ${entry.fileName}\n${source}`,
      });
    }
    if (migrationsInScope.length > 0) nextCursor[moduleKey] = migrationsInScope.at(-1).fileName;
  }
  return { writes: appends, repairs: [], appends, deferred, nextCursor };
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

function sha256(source) {
  return createHash("sha256").update(source).digest("hex");
}

// Historical generated files are immutable. These hashes are reviewed SQL-equivalent
// renderings shipped by early consumers before canonical provenance was enforced.
const REVIEWED_LEGACY_MIGRATION_HASHES = new Map([
  ["core/20260731120000_core_notifications.sql", new Set(["20fbd2158741871ac6b65c4033db5d7c9e889b03a5876d1f32f2b368b35cf24a"])],
  ["projects/20260731121000_project_notification_audiences.sql", new Set(["1726f2f2403401cda677419e26b49ffa521e49ef0bfa72b56e42428ded7c6312"])],
]);

function compareSemver(left, right) {
  const leftParts = String(left).split(".").map((value) => Number.parseInt(value, 10));
  const rightParts = String(right).split(".").map((value) => Number.parseInt(value, 10));
  if (leftParts.length !== 3 || rightParts.length !== 3 || [...leftParts, ...rightParts].some(Number.isNaN)) return null;
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] < rightParts[index] ? -1 : 1;
  }
  return 0;
}

export async function exactMigrationCompatibilityStatus({ targetDir, moduleKey, cursor, catalogEntry, allowDeferred = false }) {
  const migrations = await getModuleMigrations(moduleKey, catalogEntry);
  if (migrations.length === 0) return { shipsMigrations: false, issues: [], verified: [] };
  const issues = [];
  const latest = migrations.at(-1)?.fileName ?? null;
  let migrationsInScope = [];
  if (!cursor) {
    issues.push("migration cursor is missing");
  } else if (!migrations.some((entry) => entry.fileName === cursor)) {
    issues.push(`cursor ${cursor} does not exist in the shipped migration history`);
  } else {
    migrationsInScope = migrations.filter((entry) => entry.fileName <= cursor);
    if (cursor !== latest && !allowDeferred) {
      issues.push(`cursor ${cursor} is stale; exact package compatibility requires ${latest}`);
    }
  }

  const migrationsDir = await findAppMigrationsDirectory(targetDir);
  const installed = [];
  if (await pathExists(migrationsDir)) {
    for (const fileName of await fs.readdir(migrationsDir)) {
      if (!fileName.endsWith(".sql")) continue;
      installed.push({ fileName, content: await fs.readFile(path.join(migrationsDir, fileName), "utf8") });
    }
  }

  const verified = [];
  const legacyEquivalent = [];
  for (const entry of migrationsInScope) {
    const matches = installed.filter(({ fileName, content }) => {
      const header = content.match(/^\s*--\s*bw-module:\s*([^@\s]+)@([^\s]+)\s+([^\s]+)\s*\n/im);
      return (header?.[1] === moduleKey && header?.[3] === entry.fileName)
        || fileName === entry.fileName
        || fileName.endsWith(`_${moduleKey}__${entry.fileName}`);
    });
    if (matches.length === 0) {
      issues.push(`${entry.fileName}: generated migration file is missing`);
      continue;
    }
    if (matches.length > 1) {
      issues.push(`${entry.fileName}: appears in multiple generated migration files (${matches.map(({ fileName }) => fileName).join(", ")})`);
      continue;
    }
    const [{ fileName, content }] = matches;
    const header = content.match(/^\s*--\s*bw-module:\s*([^@\s]+)@([^\s]+)\s+([^\s]+)\s*\n/im);
    const expectedVersion = catalogEntry?.version;
    if (expectedVersion && header) {
      const comparison = compareSemver(header[2], expectedVersion);
      if (comparison == null || comparison > 0) {
        issues.push(`${fileName}: provenance version ${header[2]} is incompatible with installed ${moduleKey}@${expectedVersion}`);
        continue;
      }
    }
    const source = await fs.readFile(entry.sourcePath, "utf8");
    const generatedSource = header ? content.slice(header[0].length) : content;
    const expectedHash = sha256(source);
    const actualHash = sha256(generatedSource);
    if (actualHash !== expectedHash) {
      if (REVIEWED_LEGACY_MIGRATION_HASHES.get(`${moduleKey}/${entry.fileName}`)?.has(actualHash)) {
        verified.push({ fileName, originalFileName: entry.fileName, sha256: actualHash });
        legacyEquivalent.push({ fileName, originalFileName: entry.fileName, sha256: actualHash, canonicalSha256: expectedHash });
        continue;
      }
      issues.push(`${fileName}: sha256 ${actualHash} does not match ${entry.fileName} sha256 ${expectedHash}`);
      continue;
    }
    verified.push({ fileName, originalFileName: entry.fileName, sha256: expectedHash });
  }

  const deferredEntries = cursor && migrations.some((entry) => entry.fileName === cursor)
    ? migrations.filter((entry) => entry.fileName > cursor)
    : [];

  return {
    shipsMigrations: true,
    latest,
    issues,
    verified,
    legacyEquivalent,
    deferred: deferredEntries.map((entry) => entry.fileName),
    nextDeferredIsDestructive: deferredEntries[0]?.destructive === true,
  };
}
