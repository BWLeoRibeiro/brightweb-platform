import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const workspaceRoot = resolveWorkspaceRoot();
const packageDirectoryByName = {
  "create-bw-app": "packages/create-bw-app",
  "@brightweblabs/app-shell": "packages/app-shell",
  "@brightweblabs/core-auth": "packages/core-auth",
  "@brightweblabs/module-admin": "packages/module-admin",
  "@brightweblabs/module-crm": "packages/module-crm",
  "@brightweblabs/module-projects": "packages/module-projects",
} as const;

const docModulePackages = {
  "/docs/modules/platform-base": [
    { label: "Core Auth", packageName: "@brightweblabs/core-auth" },
    { label: "Admin", packageName: "@brightweblabs/module-admin" },
    { label: "App Shell", packageName: "@brightweblabs/app-shell" },
  ],
  "/docs/modules/crm": [{ label: "CRM", packageName: "@brightweblabs/module-crm" }],
  "/docs/modules/projects": [{ label: "Projects", packageName: "@brightweblabs/module-projects" }],
} as const;

type KnownPackageName = keyof typeof packageDirectoryByName;
type ModuleDocHref = keyof typeof docModulePackages;

export type DocModuleVersion = {
  label: string;
  packageName: KnownPackageName;
  version: string;
};

function resolveWorkspaceRoot() {
  const candidates = [path.resolve(process.cwd(), "../../"), process.cwd()];
  return candidates.find((candidate) => existsSync(path.join(candidate, "package.json"))) ?? candidates[0];
}

function getPackageJsonPath(packageName: KnownPackageName) {
  return path.join(workspaceRoot, packageDirectoryByName[packageName], "package.json");
}

function readLocalPackageVersion(packageName: KnownPackageName) {
  const packageJsonPath = getPackageJsonPath(packageName);

  if (!existsSync(packageJsonPath)) {
    return "0.0.0";
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  return packageJson.version ?? "0.0.0";
}

async function getPublishedPackageVersion(packageName: KnownPackageName) {
  const fallbackVersion = readLocalPackageVersion(packageName);

  try {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`, {
      next: {
        revalidate: 3600,
      },
    });

    if (!response.ok) {
      return fallbackVersion;
    }

    const payload = (await response.json()) as { version?: string };
    return payload.version ?? fallbackVersion;
  } catch {
    return fallbackVersion;
  }
}

export async function getBrightwebVersion() {
  return getPublishedPackageVersion("create-bw-app");
}

export async function getDocModuleVersions(href: string): Promise<DocModuleVersion[]> {
  const packageEntries = docModulePackages[href as ModuleDocHref];

  if (!packageEntries) {
    return [];
  }

  return Promise.all(
    packageEntries.map(async ({ label, packageName }) => ({
      label,
      packageName,
      version: await getPublishedPackageVersion(packageName),
    })),
  );
}
