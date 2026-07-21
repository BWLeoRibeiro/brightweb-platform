import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadWorkspacePackages, parseRepoRoot } from "./compatibility-set.mjs";

const defaultRepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = parseRepoRoot(process.argv.slice(2), defaultRepoRoot);

async function main() {
  const errors = [];
  const workspacePackages = await loadWorkspacePackages(repoRoot, errors);
  if (errors.length > 0) throw new Error(errors.join("\n"));

  const compatibilityPath = path.join(repoRoot, "brightweb-release.json");
  const compatibilitySet = JSON.parse(await fs.readFile(compatibilityPath, "utf8"));
  compatibilitySet.contractVersion = 1;
  compatibilitySet.packages = Object.fromEntries(workspacePackages);
  await fs.writeFile(compatibilityPath, `${JSON.stringify(compatibilitySet, null, 2)}\n`);

  const constantsPath = path.join(repoRoot, "packages", "create-bw-app", "src", "constants.mjs");
  const constantsSource = await fs.readFile(constantsPath, "utf8");
  const blockPattern = /(export const APP_DEPENDENCY_DEFAULTS = \{\n)([\s\S]*?)(\n\};)/;
  const blockMatch = constantsSource.match(blockPattern);
  if (!blockMatch) throw new Error("Unable to locate APP_DEPENDENCY_DEFAULTS in packages/create-bw-app/src/constants.mjs.");

  const updatedBody = blockMatch[2].replace(
    /^(\s*)"(@brightweblabs\/[^"]+)":\s*"[^"]+",$/gm,
    (line, indentation, packageName) => {
      const version = workspacePackages.get(packageName);
      if (!version) throw new Error(`APP_DEPENDENCY_DEFAULTS references unknown workspace package "${packageName}".`);
      return `${indentation}${JSON.stringify(packageName)}: ${JSON.stringify(`^${version}`)},`;
    },
  );
  await fs.writeFile(constantsPath, constantsSource.replace(blockPattern, `$1${updatedBody}$3`));

  console.log(`Synced ${workspacePackages.size} compatibility-set packages and app dependency defaults.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
