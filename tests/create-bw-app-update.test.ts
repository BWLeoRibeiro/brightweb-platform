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
const BRIGHTWEB_PACKAGES = [
  "@brightweblabs/app-shell",
  "@brightweblabs/core-auth",
  "@brightweblabs/infra",
  "@brightweblabs/module-admin",
  "@brightweblabs/module-crm",
  "@brightweblabs/module-orgs",
  "@brightweblabs/module-projects",
  "@brightweblabs/theme",
  "@brightweblabs/ui",
];

async function releaseVersion(packageName: string) {
  const release = JSON.parse(await fs.readFile(path.join(REPO_ROOT, "brightweb-release.json"), "utf8"));
  return release.packages[packageName];
}

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

async function createMockNpmFetch(options: {
  versions?: Record<string, string>;
  failingPackages?: string[];
} = {}) {
  const versionMap: Record<string, string> = {};

  for (const packageName of BRIGHTWEB_PACKAGES) {
    versionMap[packageName] = (await readWorkspacePackageVersion(packageName)).slice(1);
  }

  Object.assign(versionMap, options.versions || {});
  const failingPackages = new Set(options.failingPackages || []);

  return async (url: string) => {
    const packageName = decodeURIComponent(url.split("/").slice(-2, -1)[0] || "");
    if (failingPackages.has(packageName)) {
      return {
        ok: false,
        status: 503,
        async json() {
          return {};
        },
      };
    }

    const version = versionMap[packageName];
    if (!version) {
      return {
        ok: false,
        status: 404,
        async json() {
          return {};
        },
      };
    }

    return {
      ok: true,
      status: 200,
      async json() {
        return { version };
      },
    };
  };
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
    {
      workspaceRoot: REPO_ROOT,
      fetchImpl: await createMockNpmFetch(),
    },
  );

  assert.equal(plan.template, "platform");
  assert.equal(plan.dependencyMode, "published");
  assert.deepEqual(plan.installedModules, ["crm"]);
  assert.equal(plan.packageUpdates.length, 0);
});

test("updates legacy CRM apps with the required organizations package", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["crm"],
    workspaceRoot: REPO_ROOT,
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  const packageJsonPath = path.join(targetDir, "package.json");
  const manifest = await readJson(packageJsonPath);
  delete manifest.dependencies["@brightweblabs/module-orgs"];
  await fs.writeFile(packageJsonPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const plan = await buildBrightwebAppUpdatePlan(
    { targetDir },
    {
      workspaceRoot: REPO_ROOT,
      fetchImpl: await createMockNpmFetch(),
    },
  );

  const orgsUpdate = plan.packageUpdates.find((entry) => entry.packageName === "@brightweblabs/module-orgs");
  const orgsVersion = await releaseVersion("@brightweblabs/module-orgs");
  assert.equal(orgsUpdate?.from, null);
  assert.equal(orgsUpdate?.to, `^${orgsVersion}`);
  assert.match(plan.fileWrites.find((entry) => entry.relativePath === "package.json")?.content ?? "", new RegExp(`"@brightweblabs/module-orgs": "\\^${orgsVersion.replaceAll(".", "\\.")}"`));
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
    "@brightweblabs/module-orgs",
    "@brightweblabs/module-projects",
    "@brightweblabs/theme",
    "@brightweblabs/ui",
  ]) {
    assert.equal(
      manifest.dependencies[packageName],
      await readWorkspacePackageVersion(packageName),
      `expected ${packageName} to stay aligned with the current published workspace version`,
    );
  }

  assert.equal(manifest.dependencies.react, "19.2.4");
  assert.equal(manifest.dependencies["react-dom"], "19.2.4");
});

test("CRM scaffolds expose package-owned contact write handlers", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({ modules: ["crm"] });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  const route = await fs.readFile(
    path.join(targetDir, "app", "api", "crm", "contacts", "route.ts"),
    "utf8",
  );

  assert.match(route, /export \{ handleCrmContactsPostRequest as POST \} from "@brightweblabs\/module-crm"/);
  assert.match(route, /export \{ handleCrmContactsPatchRequest as PATCH \} from "@brightweblabs\/module-crm"/);
});

test("published platform scaffolds resolved supabase migrations for the selected modules", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["crm"],
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  const registry = await readJson(path.join(targetDir, "supabase", "module-registry.json"));
  const stack = await readJson(path.join(targetDir, "supabase", "clients", "sample-platform", "stack.json"));

  assert.deepEqual(Object.keys(registry.modules), ["core", "admin", "orgs", "crm"]);
  assert.deepEqual(stack.enabledModules, ["core", "admin", "orgs", "crm"]);

  assert.match(await fs.readFile(path.join(targetDir, "supabase", "config.toml"), "utf8"), /project_id = "app"/);
  assert.deepEqual(
    (await fs.readdir(path.join(targetDir, "supabase", "migrations"))).filter((fileName) => fileName.endsWith(".sql")),
    [
      "0001_core__20260316090000_core_v1.sql",
      "0002_admin__20260316091000_admin_v1.sql",
      "0003_admin__20260724121000_admin_user_invitations.sql",
      "0004_orgs__20260316091500_orgs_v1.sql",
      "0005_crm__20260316092000_crm_v1.sql",
      "0006_crm__20260316092010_crm_org_integration.sql",
      "0007_crm__20260421201523_portal_read_indexes.sql",
      "0008_crm__20260724120000_crm_status_authorization.sql",
    ],
  );

  await fs.access(path.join(targetDir, "supabase", "modules", "core", "migrations", "20260316090000_core_v1.sql"));
  await fs.access(path.join(targetDir, "supabase", "modules", "admin", "migrations", "20260316091000_admin_v1.sql"));
  await fs.access(path.join(targetDir, "supabase", "modules", "admin", "migrations", "20260724121000_admin_user_invitations.sql"));
  await fs.access(path.join(targetDir, "supabase", "modules", "orgs", "migrations", "20260316091500_orgs_v1.sql"));
  await fs.access(path.join(targetDir, "supabase", "modules", "crm", "migrations", "20260316092000_crm_v1.sql"));
  await fs.access(path.join(targetDir, "supabase", "modules", "crm", "migrations", "20260421201523_portal_read_indexes.sql"));
  const authorizationMigrationPath = path.join(
    targetDir,
    "supabase",
    "modules",
    "crm",
    "migrations",
    "20260724120000_crm_status_authorization.sql",
  );
  const authorizationMigration = await fs.readFile(authorizationMigrationPath, "utf8");
  assert.match(authorizationMigration, /COALESCE\(auth\.role\(\), ''\) <> 'service_role'/);
  assert.match(authorizationMigration, /NOT COALESCE\(public\.is_staff\(\), false\)/);
  assert.match(authorizationMigration, /ERRCODE = '42501'/);
  assert.match(authorizationMigration, /REVOKE EXECUTE ON FUNCTION public\.set_crm_status\(uuid, text, text\) FROM PUBLIC/);
  assert.match(authorizationMigration, /REVOKE EXECUTE ON FUNCTION public\.set_crm_status\(uuid, text, text\) FROM anon/);
  assert.match(authorizationMigration, /GRANT EXECUTE ON FUNCTION public\.set_crm_status\(uuid, text, text\) TO authenticated/);
  assert.match(authorizationMigration, /GRANT EXECUTE ON FUNCTION public\.set_crm_status\(uuid, text, text\) TO service_role/);
  await assert.rejects(() =>
    fs.access(path.join(targetDir, "supabase", "modules", "projects", "migrations", "20260316093000_projects_v1.sql")));
});

test("projects scaffolding resolves organizations without CRM", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({ modules: ["projects"] });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  const stack = await readJson(path.join(targetDir, "supabase", "clients", "sample-platform", "stack.json"));
  assert.deepEqual(stack.enabledModules, ["core", "admin", "orgs", "projects"]);

  const migrations = (await fs.readdir(path.join(targetDir, "supabase", "migrations")))
    .filter((fileName) => fileName.endsWith(".sql"));
  assert.deepEqual(migrations.slice(0, 5), [
    "0001_core__20260316090000_core_v1.sql",
    "0002_admin__20260316091000_admin_v1.sql",
    "0003_admin__20260724121000_admin_user_invitations.sql",
    "0004_orgs__20260316091500_orgs_v1.sql",
    "0005_projects__20260316093000_projects_v1.sql",
  ]);
  assert.equal(migrations.some((fileName) => fileName.includes("_crm__")), false);

  const manifest = await readJson(path.join(targetDir, "package.json"));
  assert.equal(manifest.dependencies["@brightweblabs/module-orgs"], `^${await releaseVersion("@brightweblabs/module-orgs")}`);
  assert.equal(manifest.dependencies["@brightweblabs/module-crm"], undefined);
  assert.match(await fs.readFile(path.join(targetDir, "config", "modules.ts"), "utf8"), /key: "orgs"[\s\S]*?enabled: true[\s\S]*?placement: "hidden"/);
  const shellConfig = await fs.readFile(path.join(targetDir, "config", "shell.ts"), "utf8");
  assert.match(shellConfig, /orgsModuleRegistration/);
  assert.doesNotMatch(shellConfig, /projectsModuleRegistration/);
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
  assert.equal(context.paths.componentsRoot, undefined);
  assert.ok(context.paths.readFirst.includes("config/shell.overrides.ts"));
  assert.deepEqual(context.starterRoutes, ["/crm"]);
  assert.match(examples, /First local setup/);
  assert.match(agents, /docs\/ai\/app-context\.json/);
  assert.match(
    await fs.readFile(path.join(targetDir, "app", "crm", "layout.tsx"), "utf8"),
    /@brightweblabs\/module-crm\/tokens\.css/,
  );
});

test("scaffolds only direct package mounts and no local component library", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["crm"],
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  await assert.rejects(fs.access(path.join(targetDir, "components")));
  await assert.rejects(fs.access(path.join(targetDir, "app", "page.tsx")));
  assert.match(
    await fs.readFile(path.join(targetDir, "app", "crm", "page.tsx"), "utf8"),
    /return <CrmDashboard \/>/,
  );
});

test("scaffolds a managed shell config and app-owned registration override seam", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["crm"],
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  const shellConfig = await fs.readFile(path.join(targetDir, "config", "shell.ts"), "utf8");
  const shellOverrides = await fs.readFile(path.join(targetDir, "config", "shell.overrides.ts"), "utf8");

  assert.match(shellConfig, /^\/\/ MANAGED BY BRIGHTWEB — regenerated by create-bw-app update;/);
  assert.match(shellConfig, /applyShellRegistrationOverrides/);
  assert.match(shellConfig, /shellRegistrationOverrides/);
  assert.match(shellConfig, /const modules = applyShellRegistrationOverrides\(/);
  assert.match(shellOverrides, /shellRegistrationOverrides: ShellRegistrationOverrides = \{\}/);
  assert.match(shellOverrides, /overrideNavHref/);
});

test("scaffolds platform env defaults without a local Resend adapter", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["admin"],
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  const envFile = await fs.readFile(path.join(targetDir, ".env.local"), "utf8");

  assert.match(envFile, /^RESEND_API_KEY=$/m);
  assert.match(envFile, /^RESEND_FROM_TRANSACTIONAL=$/m);
  assert.match(envFile, /^RESEND_FROM_MARKETING=$/m);
  assert.match(envFile, /^CONTACT_TO_EMAIL=$/m);
  assert.match(envFile, /^RESEND_WEBHOOK_SECRET=$/m);
  assert.match(envFile, /^MARKETING_WORKER_SECRET=$/m);
  assert.match(envFile, /^MARKETING_TEST_EMAIL=$/m);
  await assert.rejects(fs.access(path.join(targetDir, "lib", "email", "resend-base.ts")));
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
  const manifest = await readJson(path.join(targetDir, "package.json"));

  assert.equal(plan.template, "site");
  assert.equal(plan.packageUpdates.length, 0);
  assert.equal(plan.fileWrites.length, 0);
  assert.equal(manifest.dependencies.react, "19.2.4");
  assert.equal(manifest.dependencies["react-dom"], "19.2.4");
});

test("published updates resolve installed brightweb packages from npm and leave third-party deps alone", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["crm"],
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  await updateBrightwebDependencyVersion(targetDir, "@brightweblabs/core-auth", "^0.0.1");
  const before = await readJson(path.join(targetDir, "package.json"));
  await updateBrightwebApp(
    { targetDir },
    {
      fetchImpl: await createMockNpmFetch({
        versions: {
          "@brightweblabs/core-auth": "9.9.9",
        },
      }),
    },
  );

  const after = await readJson(path.join(targetDir, "package.json"));
  assert.equal(after.dependencies["@brightweblabs/core-auth"], "^9.9.9");
  assert.equal(after.dependencies.next, before.dependencies.next);
  assert.equal(after.dependencies.react, before.dependencies.react);
});

test("published updates fail when npm lookup fails", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["crm"],
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));
  const fetchImpl = await createMockNpmFetch({
    failingPackages: ["@brightweblabs/core-auth"],
  });

  await assert.rejects(
    () => buildBrightwebAppUpdatePlan(
      { targetDir },
      {
        fetchImpl,
      },
    ),
    /Failed to resolve published BrightWeb package versions from npm/,
  );
});

test("published updates can fall back to baked-in brightweb versions when explicitly allowed", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["crm"],
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  await updateBrightwebDependencyVersion(targetDir, "@brightweblabs/core-auth", "^0.0.1");
  const plan = await buildBrightwebAppUpdatePlan(
    { targetDir, allowStaleFallback: true },
    {
      fetchImpl: await createMockNpmFetch({
        failingPackages: ["@brightweblabs/core-auth"],
      }),
    },
  );

  const coreAuthUpdate = plan.packageUpdates.find((entry) => entry.packageName === "@brightweblabs/core-auth");
  assert.equal(coreAuthUpdate?.to, `^${await releaseVersion("@brightweblabs/core-auth")}`);
});

test("scaffolds site AI handoff files with site-specific context", async (t) => {
  const { tempRoot, targetDir } = await scaffoldSiteApp();
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  const context = await readJson(path.join(targetDir, "docs", "ai", "app-context.json"));
  const examples = await fs.readFile(path.join(targetDir, "docs", "ai", "examples.md"), "utf8");
  const agents = await fs.readFile(path.join(targetDir, "AGENTS.md"), "utf8");

  assert.equal(context.template, "site");
  assert.equal(context.modules, undefined);
  assert.deepEqual(context.starterRoutes, []);
  assert.equal(context.paths.uiComponentsRoot, undefined);
  await assert.rejects(fs.access(path.join(targetDir, "app", "page.tsx")));
  await assert.rejects(fs.access(path.join(targetDir, "components")));
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
    {
      workspaceRoot: REPO_ROOT,
      fetchImpl: await createMockNpmFetch(),
    },
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
    {
      workspaceRoot: REPO_ROOT,
      fetchImpl: await createMockNpmFetch(),
    },
  );

  assert.deepEqual(
    plan.packageUpdates.map((entry) => entry.packageName),
    ["@brightweblabs/core-auth"],
  );
  assert.deepEqual(plan.configFilesToWrite, ["package.json"]);
});

test("scaffold and preview globals scan every consumed BrightWeb package", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["crm"],
    workspaceRoot: REPO_ROOT,
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  const globals = await fs.readFile(path.join(targetDir, "app", "globals.css"), "utf8");
  assert.match(globals, /@source "\.\.\/node_modules\/@brightweblabs\/ui\/src";/);
  assert.match(globals, /@source "\.\.\/node_modules\/@brightweblabs\/app-shell\/src";/);
  assert.match(globals, /@source "\.\.\/node_modules\/@brightweblabs\/module-crm\/src";/);
  assert.doesNotMatch(globals, /module-(?:admin|projects)\/src/);

  const manifest = await readJson(path.join(targetDir, ".brightweb", "app-manifest.json"));
  assert.ok(manifest.managedFiles.includes("app/globals.css"));

  const previewGlobals = await fs.readFile(path.join(REPO_ROOT, "apps", "platform-preview", "app", "globals.css"), "utf8");
  assert.match(previewGlobals, /@source "\.\.\/\.\.\/\.\.\/packages\/ui\/src";/);
  assert.match(previewGlobals, /@source "\.\.\/\.\.\/\.\.\/packages\/app-shell\/src";/);
  assert.match(previewGlobals, /@source "\.\.\/\.\.\/\.\.\/packages\/module-crm\/src";/);
});

test("platform CRM preview uses the packaged live API client", async () => {
  const page = await fs.readFile(path.join(REPO_ROOT, "apps", "platform-preview", "app", "(shell)", "crm", "page.tsx"), "utf8");
  const crmApiRoot = path.join(REPO_ROOT, "apps", "platform-preview", "app", "api", "crm");
  const contactsRoute = await fs.readFile(path.join(crmApiRoot, "contacts", "route.ts"), "utf8");
  assert.match(page, /<CrmDashboard \/>/);
  assert.doesNotMatch(page, /client=|initialData=|mockClient/);
  assert.match(contactsRoute, /handleCrmContactsGetRequest\(request\)/);
  assert.match(contactsRoute, /handleCrmContactsPostRequest\(request\)/);
  assert.match(contactsRoute, /handleCrmContactsPatchRequest\(request\)/);
  assert.match(contactsRoute, /handleCrmContactsDeleteRequest\(request\)/);

  for (const [route, handler] of Object.entries({
    organizations: "handleCrmOrganizationsGetRequest",
    owners: "handleCrmOwnersGetRequest",
    report: "handleCrmReportGetRequest",
    stats: "handleCrmStatsGetRequest",
    timeline: "handleCrmTimelineGetRequest",
  })) {
    const source = await fs.readFile(path.join(crmApiRoot, route, "route.ts"), "utf8");
    assert.match(source, /dynamic = "force-dynamic"/);
    assert.ok(source.includes(`${handler}(request)`));
  }
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
    {
      workspaceRoot: REPO_ROOT,
      fetchImpl: await createMockNpmFetch(),
    },
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

  await fs.rm(path.join(targetDir, "app", "crm", "page.tsx"));
  await fs.rm(path.join(targetDir, "config", "shell.overrides.ts"));
  await fs.writeFile(path.join(targetDir, "app", "api", "crm", "stats", "route.ts"), "export {};\n", "utf8");

  const dryPlan = await buildBrightwebAppUpdatePlan(
    { targetDir },
    {
      workspaceRoot: REPO_ROOT,
      fetchImpl: await createMockNpmFetch(),
    },
  );
  const refreshPlan = await buildBrightwebAppUpdatePlan(
    { targetDir, refreshStarters: true },
    {
      workspaceRoot: REPO_ROOT,
      fetchImpl: await createMockNpmFetch(),
    },
  );

  assert.deepEqual(dryPlan.starterFilesMissing, [
    "config/shell.overrides.ts",
    "app/crm/page.tsx",
  ]);
  assert.deepEqual(dryPlan.starterFilesDrifted, ["app/api/crm/stats/route.ts"]);
  assert.deepEqual(refreshPlan.starterFilesToRefresh.sort(), [
    "app/api/crm/stats/route.ts",
    "app/crm/page.tsx",
    "config/shell.overrides.ts",
  ]);
});

test("never overwrites a customized shell override starter", async (t) => {
  const { tempRoot, targetDir } = await scaffoldPlatformApp({
    modules: ["crm"],
    workspaceRoot: REPO_ROOT,
  });
  t.after(async () => fs.rm(tempRoot, { recursive: true, force: true }));

  const overridesPath = path.join(targetDir, "config", "shell.overrides.ts");
  const customization = "export const shellRegistrationOverrides = { crm: (registration) => registration };\n";
  await fs.writeFile(overridesPath, customization, "utf8");

  const plan = await buildBrightwebAppUpdatePlan(
    { targetDir, refreshStarters: true },
    {
      workspaceRoot: REPO_ROOT,
      fetchImpl: await createMockNpmFetch(),
    },
  );

  assert.ok(plan.starterFilesDrifted.includes("config/shell.overrides.ts"));
  assert.ok(!plan.starterFilesToRefresh.includes("config/shell.overrides.ts"));

  await updateBrightwebApp(
    { targetDir, refreshStarters: true },
    {
      workspaceRoot: REPO_ROOT,
      fetchImpl: await createMockNpmFetch(),
    },
  );

  assert.equal(await fs.readFile(overridesPath, "utf8"), customization);
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
    {
      workspaceRoot: REPO_ROOT,
      fetchImpl: await createMockNpmFetch(),
    },
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
    {
      workspaceRoot: REPO_ROOT,
      fetchImpl: await createMockNpmFetch(),
    },
  );

  const manifest = await readJson(path.join(targetDir, "package.json"));
  assert.equal(manifest.dependencies["@brightweblabs/module-crm"], `^${await releaseVersion("@brightweblabs/module-crm")}`);
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
      fetchImpl: await createMockNpmFetch(),
      installRunner: async (packageManager: string, cwd: string) => {
        calls.push({ packageManager, cwd });
      },
    },
  );

  assert.deepEqual(calls, [{ packageManager: "pnpm", cwd: targetDir }]);
});
