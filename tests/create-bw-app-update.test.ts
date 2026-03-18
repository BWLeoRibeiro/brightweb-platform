import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runCreateBwAppCli } from "../packages/create-bw-app/src/cli.mjs";
import {
  createBrightwebClientApp,
  createNextConfig,
  createPlatformModulesConfigFile,
} from "../packages/create-bw-app/src/generator.mjs";
import { buildBrightwebAppUpdatePlan, updateBrightwebApp } from "../packages/create-bw-app/src/update.mjs";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

async function makeTempDir(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function scaffoldPlatformApp(options: {
  modules?: string[];
  workspaceRoot?: string;
}) {
  const tempRoot = await makeTempDir("create-bw-app-update-");
  const targetDir = path.join(tempRoot, "app");
  const modules = options.modules ?? [];

  await createBrightwebClientApp(
    {
      name: "sample-platform",
      template: "platform",
      modules: modules.join(","),
      install: false,
      yes: true,
    },
    {
      targetDir,
      dependencyMode: "published",
      workspaceRoot: options.workspaceRoot,
      banner: "test",
    },
  );

  return { tempRoot, targetDir };
}

async function scaffoldSiteApp() {
  const tempRoot = await makeTempDir("create-bw-app-site-");
  const targetDir = path.join(tempRoot, "site");

  await createBrightwebClientApp(
    {
      name: "sample-site",
      template: "site",
      install: false,
      yes: true,
    },
    {
      targetDir,
      dependencyMode: "published",
      banner: "test",
    },
  );

  return { tempRoot, targetDir };
}

async function readJson(filePath: string) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readWorkspacePackageVersion(packageName: string) {
  const folderName = packageName.replace("@brightweblabs/", "");
  const manifest = await readJson(path.join(REPO_ROOT, "packages", folderName, "package.json"));
  return `^${manifest.version}`;
}

async function updateBrightwebDependencyVersion(targetDir: string, packageName: string, version: string) {
  const packageJsonPath = path.join(targetDir, "package.json");
  const manifest = await readJson(packageJsonPath);

  if (manifest.dependencies?.[packageName]) {
    manifest.dependencies[packageName] = version;
  } else if (manifest.devDependencies?.[packageName]) {
    manifest.devDependencies[packageName] = version;
  } else {
    throw new Error(`Package not installed: ${packageName}`);
  }

  await fs.writeFile(packageJsonPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function setAllBrightwebDependenciesToWorkspace(targetDir: string) {
  const packageJsonPath = path.join(targetDir, "package.json");
  const manifest = await readJson(packageJsonPath);

  for (const section of ["dependencies", "devDependencies"] as const) {
    for (const packageName of Object.keys(manifest[section] || {})) {
      if (packageName.startsWith("@brightweblabs/")) {
        manifest[section][packageName] = "workspace:*";
      }
    }
  }

  await fs.writeFile(packageJsonPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

test("detects a published platform app with installed crm module", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["crm"],
    workspaceRoot: REPO_ROOT,
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  const plan = await buildBrightwebAppUpdatePlan(
    { targetDir },
    { workspaceRoot: REPO_ROOT },
  );

  assert.equal(plan.template, "platform");
  assert.equal(plan.dependencyMode, "published");
  assert.deepEqual(plan.installedModules, ["crm"]);
  assert.equal(plan.packageUpdates.length, 0);
});

test("published platform scaffolds pin current brightweb package versions", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["crm", "projects"],
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  const manifest = await readJson(path.join(targetDir, "package.json"));

  for (const packageName of [
    "@brightweblabs/app-shell",
    "@brightweblabs/core-auth",
    "@brightweblabs/infra",
    "@brightweblabs/module-crm",
    "@brightweblabs/module-projects",
    "@brightweblabs/ui",
  ]) {
    assert.equal(
      manifest.dependencies[packageName],
      await readWorkspacePackageVersion(packageName),
      `expected ${packageName} to stay aligned with the current published workspace version`,
    );
  }
});

test("scaffolds platform AI handoff files with platform-specific context", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["crm", "projects"],
    workspaceRoot: REPO_ROOT,
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  const context = await readJson(path.join(targetDir, "docs", "ai", "app-context.json"));
  const examples = await fs.readFile(path.join(targetDir, "docs", "ai", "examples.md"), "utf8");
  const agents = await fs.readFile(path.join(targetDir, "AGENTS.md"), "utf8");

  assert.equal(context.template, "platform");
  assert.deepEqual(context.modules.enabled, ["crm", "projects"]);
  assert.equal(context.paths.componentsRoot, "components");
  assert.deepEqual(context.starterRoutes, [
    "/",
    "/bootstrap",
    "/preview/app-shell",
    "/playground/auth",
    "/playground/crm",
    "/playground/projects",
  ]);
  assert.match(examples, /First local setup/);
  assert.match(agents, /docs\/ai\/app-context\.json/);
});

test("scaffolds platform starter components into a local components folder", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["crm"],
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  const componentsDirEntries = await fs.readdir(path.join(targetDir, "components"));
  const previewPage = await fs.readFile(path.join(targetDir, "app", "preview", "app-shell", "page.tsx"), "utf8");
  const authPage = await fs.readFile(path.join(targetDir, "app", "playground", "auth", "page.tsx"), "utf8");

  assert.deepEqual(
    componentsDirEntries.sort(),
    ["app-shell-preview.tsx", "auth-playground.tsx"],
  );
  assert.match(previewPage, /components\/app-shell-preview/);
  assert.match(authPage, /components\/auth-playground/);
});

test("detects workspace dependency mode from installed brightweb packages", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["crm", "projects"],
    workspaceRoot: REPO_ROOT,
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  await setAllBrightwebDependenciesToWorkspace(targetDir);
  const plan = await buildBrightwebAppUpdatePlan(
    { targetDir },
    { workspaceRoot: REPO_ROOT },
  );

  assert.equal(plan.dependencyMode, "workspace");
  assert.deepEqual(plan.installedModules, ["crm", "projects"]);
  assert.equal(plan.packageUpdates.length, 0);
});

test("detects a site app as a no-op update target", async (t) => {
  const { tempRoot, targetDir } = await scaffoldSiteApp();
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  const plan = await buildBrightwebAppUpdatePlan({ targetDir }, {});

  assert.equal(plan.template, "site");
  assert.equal(plan.packageUpdates.length, 0);
  assert.equal(plan.fileWrites.length, 0);
});

test("scaffolds site AI handoff files with site-specific context", async (t) => {
  const { tempRoot, targetDir } = await scaffoldSiteApp();
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  const context = await readJson(path.join(targetDir, "docs", "ai", "app-context.json"));
  const examples = await fs.readFile(path.join(targetDir, "docs", "ai", "examples.md"), "utf8");
  const agents = await fs.readFile(path.join(targetDir, "AGENTS.md"), "utf8");

  assert.equal(context.template, "site");
  assert.equal(context.modules, undefined);
  assert.deepEqual(context.starterRoutes, ["/"]);
  assert.equal(context.paths.uiComponentsRoot, "components/ui");
  assert.match(examples, /Change site identity/);
  assert.match(agents, /config\/site\.ts/);
});

test("reports mismatch between installed modules and config/modules.ts", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["crm"],
    workspaceRoot: REPO_ROOT,
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  await fs.writeFile(
    path.join(targetDir, "config", "modules.ts"),
    createPlatformModulesConfigFile(["projects"]),
    "utf8",
  );

  const plan = await buildBrightwebAppUpdatePlan(
    { targetDir },
    { workspaceRoot: REPO_ROOT },
  );

  assert.deepEqual(plan.modulesConfigMismatch?.installedModules, ["crm"]);
  assert.deepEqual(plan.modulesConfigMismatch?.configuredModules, ["projects"]);
});

test("detects package-only changes", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["crm"],
    workspaceRoot: REPO_ROOT,
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  await updateBrightwebDependencyVersion(targetDir, "@brightweblabs/core-auth", "^0.0.1");
  const plan = await buildBrightwebAppUpdatePlan(
    { targetDir },
    { workspaceRoot: REPO_ROOT },
  );

  assert.deepEqual(
    plan.packageUpdates.map((entry) => entry.packageName),
    ["@brightweblabs/core-auth"],
  );
  assert.deepEqual(plan.configFilesToWrite, ["package.json"]);
});

test("detects config-only changes", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["crm"],
    workspaceRoot: REPO_ROOT,
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  await fs.writeFile(
    path.join(targetDir, "next.config.ts"),
    createNextConfig({ template: "platform", selectedModules: [] }),
    "utf8",
  );

  const plan = await buildBrightwebAppUpdatePlan(
    { targetDir },
    { workspaceRoot: REPO_ROOT },
  );

  assert.equal(plan.packageUpdates.length, 0);
  assert.deepEqual(plan.configFilesToWrite, ["next.config.ts"]);
});

test("reports missing and drifted starter files and only refreshes them with the flag", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["crm"],
    workspaceRoot: REPO_ROOT,
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  await fs.rm(path.join(targetDir, "app", "playground", "crm", "page.tsx"));
  await fs.writeFile(path.join(targetDir, "app", "api", "crm", "stats", "route.ts"), "export {};\n", "utf8");

  const dryPlan = await buildBrightwebAppUpdatePlan(
    { targetDir },
    { workspaceRoot: REPO_ROOT },
  );
  const refreshPlan = await buildBrightwebAppUpdatePlan(
    { targetDir, refreshStarters: true },
    { workspaceRoot: REPO_ROOT },
  );

  assert.deepEqual(dryPlan.starterFilesMissing, ["app/playground/crm/page.tsx"]);
  assert.deepEqual(dryPlan.starterFilesDrifted, ["app/api/crm/stats/route.ts"]);
  assert.deepEqual(refreshPlan.starterFilesToRefresh.sort(), [
    "app/api/crm/stats/route.ts",
    "app/playground/crm/page.tsx",
  ]);
});

test("cli dry-run does not write files", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["crm"],
    workspaceRoot: REPO_ROOT,
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  await updateBrightwebDependencyVersion(targetDir, "@brightweblabs/core-auth", "^0.0.1");
  const before = await fs.readFile(path.join(targetDir, "package.json"), "utf8");

  await runCreateBwAppCli(
    ["update", "--target-dir", targetDir, "--dry-run"],
    { workspaceRoot: REPO_ROOT },
  );

  const after = await fs.readFile(path.join(targetDir, "package.json"), "utf8");
  assert.equal(after, before);
});

test("apply rewrites only managed files and leaves app-owned pages alone", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["crm"],
    workspaceRoot: REPO_ROOT,
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  await updateBrightwebDependencyVersion(targetDir, "@brightweblabs/module-crm", "^0.0.1");
  await fs.writeFile(
    path.join(targetDir, "next.config.ts"),
    createNextConfig({ template: "platform", selectedModules: [] }),
    "utf8",
  );
  await fs.writeFile(path.join(targetDir, "app", "page.tsx"), "export default function Page() { return null; }\n", "utf8");

  await updateBrightwebApp(
    { targetDir },
    { workspaceRoot: REPO_ROOT },
  );

  const manifest = await readJson(path.join(targetDir, "package.json"));
  assert.equal(manifest.dependencies["@brightweblabs/module-crm"], "^0.3.0");
  assert.equal(
    await fs.readFile(path.join(targetDir, "next.config.ts"), "utf8"),
    createNextConfig({ template: "platform", selectedModules: ["crm"] }),
  );
  assert.equal(
    await fs.readFile(path.join(targetDir, "app", "page.tsx"), "utf8"),
    "export default function Page() { return null; }\n",
  );
});

test("install runner is called only when requested and package.json changed", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["crm"],
    workspaceRoot: REPO_ROOT,
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  await updateBrightwebDependencyVersion(targetDir, "@brightweblabs/core-auth", "^0.0.1");
  const calls: Array<{ packageManager: string; cwd: string }> = [];

  await updateBrightwebApp(
    { targetDir, install: true },
    {
      workspaceRoot: REPO_ROOT,
      installRunner: async (packageManager: string, cwd: string) => {
        calls.push({ packageManager, cwd });
      },
    },
  );

  assert.deepEqual(calls, [{ packageManager: "pnpm", cwd: targetDir }]);
});
