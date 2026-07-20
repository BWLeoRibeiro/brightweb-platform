import fs from "node:fs/promises";
import path from "node:path";

import { APP_DEPENDENCY_DEFAULTS } from "../packages/create-bw-app/src/constants.mjs";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const compatibilityPath = path.join(repoRoot, "brightweb-release.json");
const packagesDir = path.join(repoRoot, "packages");

async function main() {
  const errors = [];
  const compatibilitySet = await readJson(compatibilityPath, "compatibility set", errors);
  if (!compatibilitySet) return report(errors);

  if (compatibilitySet.contractVersion !== 1) errors.push("Compatibility set contractVersion must equal 1.");
  if (!compatibilitySet.packages || typeof compatibilitySet.packages !== "object" || Array.isArray(compatibilitySet.packages)) {
    errors.push("Compatibility set packages must be an object.");
    return report(errors);
  }

  const workspacePackages = await loadWorkspacePackages(errors);
  for (const [name, version] of workspacePackages) {
    if (!Object.hasOwn(compatibilitySet.packages, name)) {
      errors.push(`Compatibility set is missing workspace package "${name}" at version ${version}.`);
    } else if (compatibilitySet.packages[name] !== version) {
      errors.push(`Compatibility set version for "${name}" is ${JSON.stringify(compatibilitySet.packages[name])}; expected exact workspace version "${version}".`);
    }
  }

  for (const [name, version] of Object.entries(compatibilitySet.packages)) {
    if (!workspacePackages.has(name)) errors.push(`Compatibility set contains unknown workspace package "${name}" at version ${JSON.stringify(version)}.`);
  }

  for (const [name, range] of Object.entries(APP_DEPENDENCY_DEFAULTS)) {
    if (!name.startsWith("@brightweblabs/")) continue;
    const expectedVersion = compatibilitySet.packages[name];
    if (typeof expectedVersion !== "string") {
      errors.push(`APP_DEPENDENCY_DEFAULTS references "${name}", which is absent from the compatibility set.`);
      continue;
    }
    if (typeof range !== "string" || !/^\^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(range)) {
      errors.push(`APP_DEPENDENCY_DEFAULTS[${JSON.stringify(name)}] must be a caret range; received ${JSON.stringify(range)}.`);
      continue;
    }
    if (range.slice(1) !== expectedVersion) {
      errors.push(`APP_DEPENDENCY_DEFAULTS[${JSON.stringify(name)}] has base version "${range.slice(1)}"; expected compatibility-set version "${expectedVersion}".`);
    }
  }

  report(errors, `Validated ${workspacePackages.size} compatibility-set package versions and ${Object.keys(APP_DEPENDENCY_DEFAULTS).filter((name) => name.startsWith("@brightweblabs/")).length} app dependency defaults.`);
}

async function loadWorkspacePackages(errors) {
  const packages = new Map();
  const dirents = await fs.readdir(packagesDir, { withFileTypes: true });
  for (const dirent of dirents.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const packageJsonPath = path.join(packagesDir, dirent.name, "package.json");
    let packageJson;
    try {
      packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
    } catch {
      continue;
    }
    if (packageJson.name === "create-bw-app" || packageJson.name?.startsWith("@brightweblabs/")) {
      if (typeof packageJson.version !== "string") errors.push(`${packageJson.name} package.json is missing a string version.`);
      else packages.set(packageJson.name, packageJson.version);
    }
  }
  return packages;
}

async function readJson(filePath, label, errors) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    errors.push(`Unable to read ${label} at "${path.relative(repoRoot, filePath)}": ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

function report(errors, successMessage) {
  if (errors.length > 0) {
    console.error(`Compatibility-set validation failed with ${errors.length} error${errors.length === 1 ? "" : "s"}:`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(successMessage);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
