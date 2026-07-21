import fs from "node:fs/promises";
import path from "node:path";

export async function loadWorkspacePackages(repoRoot, errors = []) {
  const packages = new Map();
  const packagesDir = path.join(repoRoot, "packages");
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

  return new Map([...packages].sort(([left], [right]) => left.localeCompare(right)));
}

export function parseRepoRoot(argv, defaultRoot) {
  const index = argv.indexOf("--repo-root");
  if (index === -1) return defaultRoot;
  if (!argv[index + 1]) throw new Error("--repo-root requires a path.");
  return path.resolve(argv[index + 1]);
}
