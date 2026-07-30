import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const appArg = process.argv[2];
if (!appArg) {
  console.error("Usage: node scripts/check-next-types.mjs <app-dir>");
  process.exit(1);
}

const repoRoot = path.resolve(import.meta.dirname, "..");
const appDir = path.resolve(process.cwd(), appArg);
const nextEnvPath = path.join(appDir, "next-env.d.ts");
let originalNextEnv = null;
try {
  originalNextEnv = await fs.readFile(nextEnvPath);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}.`));
    });
  });
}

try {
  await run("pnpm", ["exec", "next", "typegen"], appDir);
  await run(process.execPath, [path.join(repoRoot, "scripts", "sync-next-types.mjs"), appDir], repoRoot);
  await run("pnpm", ["exec", "tsc", "--noEmit"], appDir);
} finally {
  if (originalNextEnv) await fs.writeFile(nextEnvPath, originalNextEnv);
  else await fs.rm(nextEnvPath, { force: true });
}
