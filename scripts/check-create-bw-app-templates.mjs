import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createBrightwebClientApp } from "../packages/create-bw-app/src/generator.mjs";
import { SELECTABLE_MODULES } from "../packages/create-bw-app/src/constants.mjs";
import { findTemplateThinnessViolations } from "./template-thinness.mjs";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const templateRoot = path.join(repoRoot, "packages", "create-bw-app", "template");
const previewNodeModules = path.join(repoRoot, "apps", "platform-preview", "node_modules");
const blockedTokenPattern = /\bprimaryHex\b/;

const textFileExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

async function collectFiles(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      return collectFiles(absolutePath);
    }
    return [absolutePath];
  }));
  return files.flat();
}

function isTextTemplate(filePath) {
  return textFileExtensions.has(path.extname(filePath));
}

async function main() {
  const thinnessViolations = await findTemplateThinnessViolations(templateRoot);
  if (thinnessViolations.length > 0) {
    throw new Error(["Found non-thin scaffold routes.", ...thinnessViolations.map((violation) => `- ${violation}`)].join("\n"));
  }

  const staticTemplateMatches = await scanDirectoryForBlockedToken(templateRoot, repoRoot);
  const generatedTemplateMatches = await scanGeneratedAppsForBlockedToken();
  const allMatches = [...staticTemplateMatches, ...generatedTemplateMatches];

  if (allMatches.length > 0) {
    throw new Error([
      "Found blocked token `primaryHex` in scaffold outputs.",
      "Move color/theme ownership to app/globals.css tokens.",
      ...allMatches.map((filePath) => `- ${filePath}`),
    ].join("\n"));
  }

  console.log("Template thinness, color ownership, and generated Platform typecheck passed.");
}

async function scanDirectoryForBlockedToken(rootPath, relativeToPath, labelPrefix = "") {
  const allFiles = await collectFiles(rootPath);
  const matchedFiles = [];

  for (const filePath of allFiles) {
    if (!isTextTemplate(filePath)) continue;
    const fileContents = await fs.readFile(filePath, "utf8");
    if (!blockedTokenPattern.test(fileContents)) continue;
    const relativePath = path.relative(relativeToPath, filePath);
    matchedFiles.push(labelPrefix ? `${labelPrefix}/${relativePath}` : relativePath);
  }

  return matchedFiles;
}

async function scanGeneratedAppsForBlockedToken() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bw-create-bw-app-template-check-"));
  const platformTarget = path.join(tempRoot, "generated-platform");
  const siteTarget = path.join(tempRoot, "generated-site");

  try {
    await createBrightwebClientApp(
      {
        name: "generated-platform",
        template: "platform",
        modules: SELECTABLE_MODULES.map(({ key }) => key).join(","),
        install: false,
        yes: true,
      },
      {
        banner: "Template contract check",
        dependencyMode: "published",
        targetDir: platformTarget,
        workspaceRoot: repoRoot,
      },
    );

    await createBrightwebClientApp(
      {
        name: "generated-site",
        template: "site",
        install: false,
        yes: true,
      },
      {
        banner: "Template contract check",
        dependencyMode: "published",
        targetDir: siteTarget,
      },
    );

    const platformMatches = await scanDirectoryForBlockedToken(platformTarget, platformTarget, "generated-platform");
    const siteMatches = await scanDirectoryForBlockedToken(siteTarget, siteTarget, "generated-site");
    await typecheckGeneratedPlatformFixture(platformTarget);
    return [...platformMatches, ...siteMatches];
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function typecheckGeneratedPlatformFixture(platformTarget) {
  const nextCli = path.join(previewNodeModules, "next", "dist", "bin", "next");
  const tscCli = path.join(previewNodeModules, "typescript", "bin", "tsc");

  try {
    await Promise.all([fs.access(nextCli), fs.access(tscCli)]);
  } catch {
    throw new Error(
      "Generated Platform typecheck requires the workspace install. Run `pnpm install` first.",
    );
  }

  await fs.symlink(
    previewNodeModules,
    path.join(platformTarget, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );

  const startedAt = performance.now();
  await runFixtureCommand("next typegen", [nextCli, "typegen"], platformTarget);
  await runFixtureCommand("tsc --noEmit", [tscCli, "--noEmit"], platformTarget);
  const durationSeconds = (performance.now() - startedAt) / 1_000;
  console.log(
    `Generated all-modules Platform fixture typechecked in ${durationSeconds.toFixed(2)}s (next typegen + tsc --noEmit).`,
  );
}

async function runFixtureCommand(label, cliArgs, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, cliArgs, {
      cwd,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve();
        return;
      }

      reject(new Error([
        `Generated Platform fixture failed \`${label}\` (exit ${exitCode}).`,
        stdout.trim(),
        stderr.trim(),
      ].filter(Boolean).join("\n")));
    });
  });
}

await main();
