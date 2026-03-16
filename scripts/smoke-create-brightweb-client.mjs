import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createBrightwebClientApp } from "../packages/create-bw-app/src/generator.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: "inherit",
      env: {
        ...process.env,
        ...(options.env || {}),
      },
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}.`));
    });
  });
}

async function removeIfPresent(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
}

async function assertExists(targetPath) {
  try {
    await fs.access(targetPath);
  } catch {
    throw new Error(`Expected generated file to exist: ${targetPath}`);
  }
}

async function scaffoldSiteSmoke(siteDir) {
  await createBrightwebClientApp(
    {
      template: "site",
      name: "smoke-site",
      targetDir: siteDir,
      install: false,
      yes: true,
    },
    {
      banner: "BrightWeb site smoke test",
      failurePrefix: "Site smoke scaffold failed",
      dependencyMode: "published",
    },
  );

  await runCommand("pnpm", ["install"], { cwd: siteDir });
  await runCommand("pnpm", ["build"], { cwd: siteDir });
}

async function scaffoldPlatformSmoke(platformDir, platformName) {
  const result = await createBrightwebClientApp(
    {
      template: "platform",
      name: platformName,
      targetDir: platformDir,
      install: false,
      yes: true,
    },
    {
      banner: "BrightWeb platform smoke test",
      failurePrefix: "Platform smoke scaffold failed",
      workspaceRoot: repoRoot,
      outputDir: path.join(repoRoot, "apps"),
      dependencyMode: "workspace",
    },
  );

  await assertExists(path.join(platformDir, "AGENTS.md"));
  await assertExists(path.join(platformDir, "docs", "ai", "README.md"));

  await runCommand("pnpm", ["install"], { cwd: repoRoot });
  await runCommand("pnpm", ["--filter", result.answers.slug, "build"], { cwd: repoRoot });

  return result;
}

async function main() {
  const suffix = `${Date.now()}-${process.pid}`;
  const siteDir = path.join(os.tmpdir(), `bw-site-smoke-${suffix}`);
  const platformName = `__smoke-platform-${suffix}`;
  const platformDir = path.join(repoRoot, "apps", platformName);
  let platformStackDir = null;

  try {
    await removeIfPresent(siteDir);
    await removeIfPresent(platformDir);

    console.log(`\n[smoke] scaffolding site starter in ${siteDir}`);
    await scaffoldSiteSmoke(siteDir);

    console.log(`\n[smoke] scaffolding platform starter in ${platformDir}`);
    const platformResult = await scaffoldPlatformSmoke(platformDir, platformName);
    platformStackDir = path.join(repoRoot, "supabase", "clients", platformResult.answers.slug);

    console.log("\n[smoke] site and platform scaffolds built successfully");
  } finally {
    await removeIfPresent(siteDir);
    await removeIfPresent(platformDir);
    if (platformStackDir) {
      await removeIfPresent(platformStackDir);
    }
    await runCommand("pnpm", ["install"], { cwd: repoRoot });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`\nSmoke test failed: ${message}`);
  process.exitCode = 1;
});
