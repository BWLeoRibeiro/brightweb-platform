import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const registryPath = path.join(rootDir, "supabase", "module-registry.json");

function timestamp() {
  const now = new Date();
  const parts = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0"),
  ];
  return parts.join("");
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
  const target = process.argv[2];
  const name = process.argv[3];

  if (!target || !name) {
    console.error("Usage: node scripts/new-migration.mjs <module|client:slug> <migration-name>");
    process.exit(1);
  }

  const fileName = `${timestamp()}_${slugify(name)}.sql`;
  const registry = readJson(registryPath);

  let baseDir;
  if (target.startsWith("client:")) {
    const clientSlug = target.slice("client:".length);
    baseDir = path.join(rootDir, "supabase", "clients", clientSlug, "migrations");
  } else {
    const moduleConfig = registry.modules[target];
    if (!moduleConfig) {
      console.error(`Unknown module "${target}".`);
      process.exit(1);
    }
    baseDir = path.join(rootDir, moduleConfig.path);
  }

  ensureDir(baseDir);
  const outputPath = path.join(baseDir, fileName);

  if (fs.existsSync(outputPath)) {
    console.error(`Migration already exists: ${outputPath}`);
    process.exit(1);
  }

  const header = `-- ${name}\n-- target: ${target}\n-- created_at: ${new Date().toISOString()}\n\n`;
  fs.writeFileSync(outputPath, header, "utf8");
  console.log(outputPath);
}

main();
