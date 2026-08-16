import { execFile as execFileCallback } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);
const defaultRepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function parseChangesetPackages(source) {
  const frontmatter = source.match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/)?.[1] ?? "";
  return new Set(Array.from(
    frontmatter.matchAll(/^\s*["']?([^"':\n]+)["']?\s*:\s*(?:patch|minor|major)\s*$/gm),
    (match) => match[1].trim(),
  ));
}

export async function loadPublishablePackages(repoRoot) {
  const packagesRoot = path.join(repoRoot, "packages");
  const entries = await fs.readdir(packagesRoot, { withFileTypes: true });
  const packages = new Map();
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(packagesRoot, entry.name, "package.json");
    try {
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
      if (manifest.private !== true && typeof manifest.name === "string") {
        packages.set(`packages/${entry.name}/`, manifest.name);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return packages;
}

export function changedPublishablePackages(changedFiles, publishablePackages) {
  const changed = new Set();
  for (const file of changedFiles) {
    for (const [prefix, packageName] of publishablePackages) {
      if (file.startsWith(prefix)) changed.add(packageName);
    }
  }
  return changed;
}

export async function declaredChangesetPackages(repoRoot, changedFiles) {
  const changesetFiles = changedFiles.filter(
    (fileName) => fileName.startsWith(".changeset/") && fileName.endsWith(".md") && fileName !== ".changeset/README.md",
  );
  const packages = new Set();
  for (const fileName of changesetFiles) {
    const source = await fs.readFile(path.join(repoRoot, fileName), "utf8");
    for (const packageName of parseChangesetPackages(source)) packages.add(packageName);
  }
  return packages;
}

async function gitChangedFiles(repoRoot, baseRef) {
  const candidates = [`origin/${baseRef}`, baseRef].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await execFile("git", ["rev-parse", "--verify", candidate], { cwd: repoRoot });
      const { stdout } = await execFile(
        "git",
        ["diff", "--name-only", "--diff-filter=ACDMRTUXB", `${candidate}...HEAD`],
        { cwd: repoRoot },
      );
      return stdout.split("\n").map((value) => value.trim()).filter(Boolean);
    } catch {
      // Try the next base-ref form.
    }
  }
  throw new Error(`Could not resolve base ref ${JSON.stringify(baseRef)}.`);
}

export async function checkPackageChangesets({ repoRoot = defaultRepoRoot, baseRef = "main", changedFiles } = {}) {
  const files = changedFiles ?? await gitChangedFiles(repoRoot, baseRef);
  const publishablePackages = await loadPublishablePackages(repoRoot);
  const changedPackages = changedPublishablePackages(files, publishablePackages);
  const declaredPackages = await declaredChangesetPackages(repoRoot, files);
  const missing = Array.from(changedPackages).filter((packageName) => !declaredPackages.has(packageName)).sort();
  return {
    ok: missing.length === 0,
    changedPackages: Array.from(changedPackages).sort(),
    declaredPackages: Array.from(declaredPackages).sort(),
    missing,
  };
}

async function main() {
  const baseIndex = process.argv.indexOf("--base");
  const baseRef = baseIndex >= 0 ? process.argv[baseIndex + 1] : process.env.GITHUB_BASE_REF || "main";
  if (!baseRef) throw new Error("--base requires a branch or ref.");
  const result = await checkPackageChangesets({ baseRef });
  if (!result.ok) {
    console.error("Changed publishable packages without a matching changeset:");
    for (const packageName of result.missing) console.error(`- ${packageName}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    result.changedPackages.length === 0
      ? "No publishable package changes detected."
      : `Changesets cover all ${result.changedPackages.length} changed publishable packages: ${result.changedPackages.join(", ")}.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
