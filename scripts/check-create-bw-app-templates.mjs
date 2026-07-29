import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { builtinModules } from "node:module";
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

const ignoredDirectoryNames = new Set(["node_modules", ".next", ".git"]);

async function collectFiles(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirectoryNames.has(entry.name)) return [];
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

  console.log("Template thinness, color ownership, dependency declarations, and generated fixture typechecks passed.");
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
    await Promise.all([
      checkFixtureDependencyDeclarations(platformTarget, "generated-platform"),
      checkFixtureDependencyDeclarations(siteTarget, "generated-site"),
    ]);
    await Promise.all([
      typecheckGeneratedFixture(platformTarget, "generated-platform"),
      typecheckGeneratedFixture(siteTarget, "generated-site"),
    ]);
    return [...platformMatches, ...siteMatches];
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

const dependencyCheckExtensions = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

const importSpecifierPatterns = [
  // Static imports: import defaultExport, { named } from "x"; import type { T } from "x";
  /\bimport\s+[^"'()]*?from\s*["']([^"']+)["']/g,
  // Re-exports: export { x } from "x"; export * from "x"; export type { T } from "x";
  /\bexport\s+[^"'()]*?from\s*["']([^"']+)["']/g,
  // Side-effect imports: import "x";
  /\bimport\s*["']([^"']+)["']/g,
  // Dynamic imports: import("x")
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  // CommonJS: require("x")
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
];

const nodeBuiltinModules = new Set(builtinModules);

function importSpecifierToPackageName(specifier) {
  // Relative, absolute, and tsconfig alias (@/*) paths are not package imports.
  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("@/")) return null;
  if (specifier.startsWith("node:")) return null;
  const segments = specifier.split("/");
  if (specifier.startsWith("@")) {
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : null;
  }
  return segments[0];
}

async function checkFixtureDependencyDeclarations(fixtureTarget, fixtureLabel) {
  const packageManifest = JSON.parse(await fs.readFile(path.join(fixtureTarget, "package.json"), "utf8"));
  const declaredPackages = new Set([
    ...Object.keys(packageManifest.dependencies ?? {}),
    ...Object.keys(packageManifest.devDependencies ?? {}),
    ...Object.keys(packageManifest.peerDependencies ?? {}),
  ]);

  for (const requiredPackage of ["react", "react-dom", "next"]) {
    if (!declaredPackages.has(requiredPackage)) {
      throw new Error(`${fixtureLabel}/package.json is missing the required \`${requiredPackage}\` dependency.`);
    }
  }

  const undeclaredImports = new Map();
  const sourceFiles = (await collectFiles(fixtureTarget)).filter((filePath) =>
    dependencyCheckExtensions.has(path.extname(filePath)),
  );

  for (const filePath of sourceFiles) {
    const fileContents = await fs.readFile(filePath, "utf8");
    for (const pattern of importSpecifierPatterns) {
      for (const match of fileContents.matchAll(pattern)) {
        const packageName = importSpecifierToPackageName(match[1]);
        if (!packageName) continue;
        if (nodeBuiltinModules.has(packageName)) continue;
        if (declaredPackages.has(packageName)) continue;
        if (!undeclaredImports.has(packageName)) {
          undeclaredImports.set(packageName, new Set());
        }
        undeclaredImports.get(packageName).add(path.relative(fixtureTarget, filePath));
      }
    }
  }

  if (undeclaredImports.size > 0) {
    throw new Error([
      `Generated ${fixtureLabel} fixture imports packages that are not declared in its package.json:`,
      ...[...undeclaredImports.entries()].sort(([a], [b]) => a.localeCompare(b)).map(
        ([packageName, importingFiles]) => `- ${packageName} (imported by ${[...importingFiles].sort().join(", ")})`,
      ),
    ].join("\n"));
  }
}

async function typecheckGeneratedFixture(fixtureTarget, fixtureLabel) {
  const nextCli = path.join(previewNodeModules, "next", "dist", "bin", "next");
  const tscCli = path.join(previewNodeModules, "typescript", "bin", "tsc");

  try {
    await Promise.all([fs.access(nextCli), fs.access(tscCli)]);
  } catch {
    throw new Error(
      "Generated fixture typecheck requires the workspace install. Run `pnpm install` first.",
    );
  }

  await fs.symlink(
    previewNodeModules,
    path.join(fixtureTarget, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );

  const startedAt = performance.now();
  await runFixtureCommand(`${fixtureLabel}: next typegen`, [nextCli, "typegen"], fixtureTarget);
  await runFixtureCommand(`${fixtureLabel}: tsc --noEmit`, [tscCli, "--noEmit"], fixtureTarget);
  const durationSeconds = (performance.now() - startedAt) / 1_000;
  console.log(
    `Generated ${fixtureLabel} fixture typechecked in ${durationSeconds.toFixed(2)}s (next typegen + tsc --noEmit).`,
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
        `Generated fixture failed \`${label}\` (exit ${exitCode}).`,
        stdout.trim(),
        stderr.trim(),
      ].filter(Boolean).join("\n")));
    });
  });
}

await main();
