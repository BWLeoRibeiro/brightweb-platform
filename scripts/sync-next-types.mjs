import fs from "node:fs/promises";
import path from "node:path";

const appArg = process.argv[2];

if (!appArg) {
  console.error("Usage: node scripts/sync-next-types.mjs <app-dir>");
  process.exit(1);
}

const appDir = path.resolve(process.cwd(), appArg);
const nextDir = path.join(appDir, ".next");
const sourceDir = path.join(nextDir, "dev", "types");
const targetDir = path.join(nextDir, "types");
const sourceRoutesPath = path.join(sourceDir, "routes.d.ts");
const targetRoutesPath = path.join(targetDir, "routes.d.ts");

try {
  await fs.access(sourceRoutesPath);
} catch {
  console.error(`Next route types not found: ${sourceRoutesPath}`);
  process.exit(1);
}

await fs.rm(targetDir, { recursive: true, force: true });
await fs.mkdir(targetDir, { recursive: true });
await fs.copyFile(sourceRoutesPath, targetRoutesPath);
