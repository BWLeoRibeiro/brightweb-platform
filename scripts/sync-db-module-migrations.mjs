import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

async function migrationFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries.filter((entry) => {
    if (!entry.name.endsWith(".sql")) return false;
    if (!entry.isFile()) throw new Error(`Migration must be a regular file: ${path.join(directory, entry.name)}`);
    return true;
  }).map((entry) => entry.name).sort();
}

// Source SQL is authoritative. A shipped filename is immutable: corrections
// must be a forward migration, never a rewrite or removal of packaged history.
export async function syncModuleMigrations(root = repoRoot, { write = false } = {}) {
  const template = path.join(root, "packages/create-bw-app/template");
  const registryPath = "supabase/module-registry.json";
  const sourceRegistry = await fs.readFile(path.join(root, registryPath), "utf8");
  const packagedRegistry = await fs.readFile(path.join(template, registryPath), "utf8");
  const { modules } = JSON.parse(sourceRegistry);
  const packagedModules = JSON.parse(packagedRegistry).modules;
  const errors = [];
  const additions = [];
  let checked = 0;

  for (const key of Object.keys(packagedModules)) {
    if (!modules[key]) errors.push(`Shipped module has no canonical source: ${key}`);
  }
  for (const [key, module] of Object.entries(modules)) {
    const relative = `supabase/modules/${key}/migrations`;
    if (!/^[a-z][a-z0-9-]*$/.test(key) || module.path !== relative ||
        (packagedModules[key] && packagedModules[key].path !== relative)) {
      errors.push(`Unexpected migration path for module ${key}`);
      continue;
    }
    const sourceDirectory = path.join(root, relative);
    const packagedDirectory = path.join(template, relative);
    const sourceFiles = await migrationFiles(sourceDirectory);
    const packagedFiles = await migrationFiles(packagedDirectory).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    for (const filename of packagedFiles) {
      if (!sourceFiles.includes(filename)) errors.push(`Shipped migration missing from canonical source: ${key}/${filename}`);
    }
    for (const filename of sourceFiles) {
      const contents = await fs.readFile(path.join(sourceDirectory, filename));
      if (!packagedFiles.includes(filename)) {
        additions.push({ filename: `${key}/${filename}`, target: path.join(packagedDirectory, filename), contents });
      } else if (!contents.equals(await fs.readFile(path.join(packagedDirectory, filename)))) {
        errors.push(`Shipped migration differs; add a forward migration: ${key}/${filename}`);
      }
      checked += 1;
    }
  }

  if (errors.length) throw new Error(errors.join("\n"));
  const registryChanged = sourceRegistry !== packagedRegistry;
  if (!write && (additions.length || registryChanged)) {
    throw new Error([
      "Database module bundle is out of sync. Run pnpm db:sync after authoring canonical sources.",
      ...additions.map(({ filename }) => `Missing packaged migration: ${filename}`),
      ...(registryChanged ? ["Module registry differs from canonical source."] : []),
    ].join("\n"));
  }
  // Validate every module before copying any file; never partially sync a
  // known-invalid history. Exclusive creation also prevents overwriting SQL.
  if (write) {
    for (const addition of additions) {
      await fs.mkdir(path.dirname(addition.target), { recursive: true });
      await fs.writeFile(addition.target, addition.contents, { flag: "wx" });
    }
    if (registryChanged) await fs.writeFile(path.join(template, registryPath), sourceRegistry);
  }
  return { checked, added: additions.map(({ filename }) => filename), registryChanged };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && !["--check", "--write"].includes(args[0]))) {
    console.error("Usage: node scripts/sync-db-module-migrations.mjs [--check|--write]");
    process.exitCode = 1;
  } else {
    try {
      const result = await syncModuleMigrations(repoRoot, { write: args[0] === "--write" });
      console.log(`Database module parity: ${result.checked} migrations checked, ${result.added.length} copied.`);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
