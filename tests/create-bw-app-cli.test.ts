import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { addBrightwebModule } from "../packages/create-bw-app/src/add.mjs";
import { adoptBrightwebApp } from "../packages/create-bw-app/src/adopt.mjs";
import { loadModuleCatalog, validateAppManifest } from "../packages/create-bw-app/src/app-manifest.mjs";
import { runBwCli } from "../packages/create-bw-app/src/bw.mjs";
import { MODULE_STARTER_FILES, PLATFORM_STARTER_FILES } from "../packages/create-bw-app/src/constants.mjs";
import { diffBrightwebScaffold } from "../packages/create-bw-app/src/diff.mjs";
import { doctorBrightwebApp } from "../packages/create-bw-app/src/doctor.mjs";
import { createBrightwebClientApp, resolveModuleOrder as resolveGeneratorModuleOrder } from "../packages/create-bw-app/src/generator.mjs";
import { removeBrightwebModule } from "../packages/create-bw-app/src/remove.mjs";
import { scaffoldBrightwebApp } from "../packages/create-bw-app/src/scaffold-cmd.mjs";
import { upgradeBrightwebApp } from "../packages/create-bw-app/src/upgrade.mjs";
import { resolveModuleOrder as resolveScriptModuleOrder } from "../scripts/_db-modules.mjs";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

async function readJson(filePath: string) { return JSON.parse(await fs.readFile(filePath, "utf8")); }
async function writeJson(filePath: string, value: unknown) { await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`); }

async function scaffold(modules = ["crm"]) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bw-cli-test-"));
  const targetDir = path.join(root, "app");
  await createBrightwebClientApp({ name: "cli-test", template: "platform", modules: modules.join(","), install: false, yes: true }, { targetDir, dependencyMode: "published", workspaceRoot: REPO_ROOT, banner: "test" });
  return { root, targetDir };
}

async function mockNpmFetch(url: string) {
  const encodedName = url.split("/").slice(-2, -1)[0] || "";
  const packageName = decodeURIComponent(encodedName);
  const folder = packageName.replace("@brightweblabs/", "");
  const manifest = await readJson(path.join(REPO_ROOT, "packages", folder, "package.json"));
  return { ok: true, status: 200, async json() { return { version: manifest.version }; } };
}

async function migrationSnapshot(targetDir: string) {
  const migrationsDir = path.join(targetDir, "supabase", "migrations");
  return Object.fromEntries(await Promise.all((await fs.readdir(migrationsDir)).sort().map(async (name) => [name, await fs.readFile(path.join(migrationsDir, name), "utf8")])));
}

async function legacyFixture() {
  const fixture = await scaffold(["crm"]);
  const migrationsDir = path.join(fixture.targetDir, "supabase", "migrations");
  const baselineNames: Record<string, string> = {
    core: "20260316090000_core_v1.sql",
    admin: "20260316091000_admin_v1.sql",
    orgs: "20260316091500_orgs_v1.sql",
    crm: "20260316092000_crm_v1.sql",
  };
  const originalFiles = await fs.readdir(migrationsDir);
  const baselineContents: Record<string, string> = {};
  for (const [moduleKey, baselineName] of Object.entries(baselineNames)) {
    const original = originalFiles.find((name) => name.includes(`_${moduleKey}__${baselineName}`));
    assert.ok(original, `${moduleKey} baseline exists`);
    baselineContents[baselineName] = `-- Brightweb ${moduleKey} v1 baseline.\n${await fs.readFile(path.join(migrationsDir, original), "utf8")}`;
  }
  for (const name of originalFiles) await fs.rm(path.join(migrationsDir, name));
  for (const [name, content] of Object.entries(baselineContents)) await fs.writeFile(path.join(migrationsDir, name), content);
  await fs.rm(path.join(fixture.targetDir, ".brightweb", "app-manifest.json"));
  await fs.appendFile(path.join(fixture.targetDir, "app", "(shell)", "crm", "page.tsx"), "\n// adopted app drift\n");
  return fixture;
}

test("scaffold writes a valid app manifest", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const manifest = await readJson(path.join(targetDir, ".brightweb", "app-manifest.json"));
  assert.deepEqual(validateAppManifest(manifest), []);
  assert.equal(manifest.app.template, "platform");
  const release = await readJson(path.join(REPO_ROOT, "brightweb-release.json"));
  assert.equal(manifest.modules.crm.version, release.packages["@brightweblabs/module-crm"]);
  assert.match(manifest.scaffoldFiles["app/(shell)/crm/page.tsx"].hash, /^sha256:/);
  assert.match(manifest.scaffoldFiles["app/(shell)/crm/layout.tsx"].hash, /^sha256:/);
  assert.match(manifest.scaffoldFiles["app/api/crm/timeline/route.ts"].hash, /^sha256:/);
  const packageJson = await readJson(path.join(targetDir, "package.json"));
  assert.equal(packageJson.dependencies["@brightweblabs/theme"], `^${release.packages["@brightweblabs/theme"]}`);
  assert.equal(packageJson.dependencies.geist, "1.7.2");
  assert.equal(packageJson.dependencies.next, "^16.0.0");
  assert.equal(packageJson.dependencies.react, "^19.0.0");
  assert.equal(packageJson.dependencies["react-dom"], "^19.0.0");
  assert.match(await fs.readFile(path.join(targetDir, "app", "fonts.ts"), "utf8"), /GeistSans as geistSans/);
  assert.match(await fs.readFile(path.join(targetDir, "app", "layout.tsx"), "utf8"), /geistSans\.variable/);
});

test("database module order implementations stay in sync for the current registry", async () => {
  const registry = await readJson(path.join(REPO_ROOT, "supabase", "module-registry.json"));
  const selections = [
    ["core"],
    ["admin"],
    ["orgs"],
    ["crm"],
    ["marketing"],
    ["projects"],
    ["crm", "projects"],
    ["projects", "crm"],
  ];

  for (const selection of selections) {
    assert.deepEqual(
      resolveGeneratorModuleOrder(registry, selection),
      resolveScriptModuleOrder(registry, selection),
      `module order drifted for ${selection.join(",")}`,
    );
  }
});

test("marketing scaffolds its full thin surface and auto-enables CRM plus Organizations", async (t) => {
  const { root, targetDir } = await scaffold(["marketing"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const release = await readJson(path.join(REPO_ROOT, "brightweb-release.json"));
  const packageJson = await readJson(path.join(targetDir, "package.json"));
  assert.equal(
    packageJson.dependencies["@brightweblabs/module-marketing"],
    `^${release.packages["@brightweblabs/module-marketing"]}`,
  );
  assert.equal(
    packageJson.dependencies["@brightweblabs/module-crm"],
    `^${release.packages["@brightweblabs/module-crm"]}`,
  );
  assert.equal(
    packageJson.dependencies["@brightweblabs/module-orgs"],
    `^${release.packages["@brightweblabs/module-orgs"]}`,
  );

  const appManifest = await readJson(
    path.join(targetDir, ".brightweb", "app-manifest.json"),
  );
  assert.deepEqual(Object.keys(appManifest.modules).sort(), ["crm", "marketing", "orgs"]);
  for (const relativePath of MODULE_STARTER_FILES.marketing) {
    await fs.access(path.join(targetDir, relativePath));
    assert.equal(appManifest.scaffoldFiles[relativePath]?.module, "marketing");
  }

  const stack = await readJson(
    path.join(targetDir, "supabase", "clients", "cli-test", "stack.json"),
  );
  assert.deepEqual(stack.enabledModules, ["core", "admin", "orgs", "crm", "marketing"]);
  assert.equal(
    (await fs.readdir(path.join(targetDir, "supabase", "migrations")))
      .some((name) => name.includes("_marketing__20260726170000_marketing_engine_safety.sql")),
    true,
  );

  const modulesConfig = await fs.readFile(path.join(targetDir, "config", "modules.ts"), "utf8");
  assert.match(modulesConfig, /key: "orgs"[\s\S]*?enabled: true/);
  assert.match(modulesConfig, /key: "crm"[\s\S]*?enabled: true/);
  assert.match(modulesConfig, /key: "marketing"[\s\S]*?enabled: true/);

  const shellConfig = await fs.readFile(path.join(targetDir, "config", "shell.ts"), "utf8");
  assert.match(shellConfig, /orgsModuleRegistration/);
  assert.match(shellConfig, /crmModuleRegistration/);
  assert.match(shellConfig, /marketingModuleRegistration/);

  const envFile = await fs.readFile(path.join(targetDir, ".env.local"), "utf8");
  for (const variableName of [
    "PUBLIC_APP_URL",
    "RESEND_API_KEY",
    "RESEND_WEBHOOK_SECRET",
    "MARKETING_WORKER_SECRET",
    "MARKETING_FROM_EMAIL",
    "MARKETING_FROM_NAME",
  ]) {
    assert.match(envFile, new RegExp(`^${variableName}=`, "m"));
  }
  const envConfig = await fs.readFile(path.join(targetDir, "config", "env.ts"), "utf8");
  assert.match(envConfig, /key: "RESEND_API_KEY"[\s\S]*?requiredFor: \["marketing"\]/);
  assert.match(envConfig, /key: "MARKETING_WORKER_SECRET"[\s\S]*?requiredFor: \["marketing"\]/);

  assert.match(
    await fs.readFile(path.join(targetDir, "app", "(shell)", "marketing", "page.tsx"), "utf8"),
    /MarketingPage as default.*@brightweblabs\/module-marketing/,
  );
  assert.match(
    await fs.readFile(path.join(targetDir, "app", "api", "marketing", "_handlers.ts"), "utf8"),
    /createResendEmailSender[\s\S]*?createNoopEmailSender[\s\S]*?MARKETING_WORKER_SECRET/,
  );
});

test("CRM, Projects, and Admin scaffold organization and invitation mounts", async (t) => {
  const { root, targetDir } = await scaffold(["crm", "projects", "admin"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const mountFiles = [
    "app/api/organizations/route.ts",
    "app/api/organizations/[id]/route.ts",
    "app/api/organizations/[id]/invitations/route.ts",
    "app/api/organizations/[id]/invitations/[invitationId]/route.ts",
    "app/api/invitations/[invitationId]/route.ts",
    "app/api/invitations/[invitationId]/accept/route.ts",
    "app/api/invitations/[invitationId]/register/route.ts",
    "app/(auth)/admin-invite/[invitationId]/page.tsx",
  ];

  for (const relativePath of mountFiles) {
    const [generated, template, preview] = await Promise.all([
      fs.readFile(path.join(targetDir, relativePath), "utf8"),
      fs.readFile(path.join(REPO_ROOT, "packages", "create-bw-app", "template", "base", relativePath), "utf8"),
      fs.readFile(path.join(REPO_ROOT, "apps", "platform-preview", relativePath), "utf8"),
    ]);
    assert.equal(generated, template);
    assert.equal(template, preview);
  }

  const dependenciesPath = "app/api/invitations/_dependencies.ts";
  assert.equal(
    await fs.readFile(path.join(targetDir, dependenciesPath), "utf8"),
    await fs.readFile(path.join(REPO_ROOT, "apps", "platform-preview", dependenciesPath), "utf8"),
  );

  const appManifest = await readJson(path.join(targetDir, ".brightweb", "app-manifest.json"));
  for (const relativePath of [...mountFiles, dependenciesPath]) {
    assert.equal(appManifest.scaffoldFiles[relativePath]?.module, "platform-base");
  }
});

test("full-modules scaffold mounts shell, auth, account, dashboard, projects, admin, CRM, and marketing", async (t) => {
  const enabledModules = ["crm", "projects", "admin", "marketing"];
  const { root, targetDir } = await scaffold(enabledModules);
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  for (const relativePath of PLATFORM_STARTER_FILES) {
    await fs.access(path.join(targetDir, relativePath));
  }
  for (const moduleKey of enabledModules) {
    for (const relativePath of MODULE_STARTER_FILES[moduleKey]) {
      await fs.access(path.join(targetDir, relativePath));
    }
  }

  const packageJson = await readJson(path.join(targetDir, "package.json"));
  assert.equal(packageJson.dependencies.next, "^16.0.0");
  assert.equal(packageJson.dependencies.react, "^19.0.0");
  assert.equal(packageJson.dependencies["react-dom"], "^19.0.0");
  for (const packageName of [
    "@brightweblabs/module-admin",
    "@brightweblabs/module-crm",
    "@brightweblabs/module-marketing",
    "@brightweblabs/module-orgs",
    "@brightweblabs/module-projects",
  ]) {
    assert.ok(packageJson.dependencies[packageName], `${packageName} is installed`);
  }

  const shellLayout = await fs.readFile(
    path.join(targetDir, "app", "(shell)", "shell-layout-client.tsx"),
    "utf8",
  );
  assert.match(shellLayout, /AppShellFrame/);
  assert.match(shellLayout, /DesktopSidebar/);
  assert.match(shellLayout, /AppHeader/);
  const rootLayout = await fs.readFile(path.join(targetDir, "app", "layout.tsx"), "utf8");
  assert.match(rootLayout, /ThemeProvider/);
  assert.match(rootLayout, /ThemeScript/);

  const shellConfig = await fs.readFile(path.join(targetDir, "config", "shell.ts"), "utf8");
  for (const registration of [
    "adminModuleRegistration",
    "crmModuleRegistration",
    "marketingModuleRegistration",
    "projectsPreviewModuleRegistration",
  ]) {
    assert.match(shellConfig, new RegExp(registration));
  }
  assert.match(shellConfig, /dashboardModuleRegistration/);
  assert.match(shellConfig, /dashboardContributions/);

  const projectsBoundary = await fs.readFile(
    path.join(targetDir, "app", "(shell)", "projects", "projects-live-mounts.tsx"),
    "utf8",
  );
  assert.match(projectsBoundary, /^"use client";/);
  for (const pageName of ["ProjectsPage", "ProjectDetailPage", "ProjectBoardPage", "ProjectTasksPage"]) {
    assert.match(projectsBoundary, new RegExp(pageName));
  }

  const stack = await readJson(
    path.join(targetDir, "supabase", "clients", "cli-test", "stack.json"),
  );
  assert.deepEqual(stack.enabledModules, [
    "core",
    "admin",
    "orgs",
    "crm",
    "projects",
    "marketing",
  ]);
  const appManifest = await readJson(
    path.join(targetDir, ".brightweb", "app-manifest.json"),
  );
  assert.deepEqual(Object.keys(appManifest.modules).sort(), [
    "admin",
    "crm",
    "marketing",
    "orgs",
    "projects",
  ]);
});

test("module catalog resolves core from the workspace compatibility set", async () => {
  const release = await readJson(path.join(REPO_ROOT, "brightweb-release.json"));
  const catalog = await loadModuleCatalog({ targetDir: REPO_ROOT, workspaceRoot: REPO_ROOT });
  assert.equal(catalog.core.version, release.packages["@brightweblabs/core-auth"]);
});

test("bw add projects resolves orgs, writes overlays, migrations, and manifest state", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const appManifestPath = path.join(targetDir, ".brightweb", "app-manifest.json");
  const packagePath = path.join(targetDir, "package.json");
  const appManifest = await readJson(appManifestPath);
  const packageJson = await readJson(packagePath);
  delete appManifest.modules.orgs;
  delete packageJson.dependencies["@brightweblabs/module-orgs"];
  await writeJson(appManifestPath, appManifest);
  await writeJson(packagePath, packageJson);

  const result = await addBrightwebModule("projects", { targetDir }, { workspaceRoot: REPO_ROOT });
  assert.deepEqual(result.newModules, ["orgs", "projects"]);
  const updated = await readJson(appManifestPath);
  const release = await readJson(path.join(REPO_ROOT, "brightweb-release.json"));
  assert.equal(updated.modules.orgs.version, release.packages["@brightweblabs/module-orgs"]);
  assert.equal(updated.modules.projects.version, release.packages["@brightweblabs/module-projects"]);
  assert.equal(updated.migrationCursor.projects, "20260421201528_portal_read_indexes.sql");
  assert.match(await fs.readFile(path.join(targetDir, "app", "globals.css"), "utf8"), /@source "\.\.\/node_modules\/@brightweblabs\/module-projects\/src";/);
  await assert.rejects(fs.access(path.join(targetDir, "app", "playground", "projects", "page.tsx")));
  const migrations = await fs.readdir(path.join(targetDir, "supabase", "migrations"));
  assert.ok(migrations.some((name) => name.includes("_projects__20260316093000_projects_v1.sql")));
});

test("bw add reports a clean module version conflict", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const manifestPath = path.join(targetDir, ".brightweb", "app-manifest.json");
  const manifest = await readJson(manifestPath);
  manifest.modules.orgs.version = "0.0.1";
  await writeJson(manifestPath, manifest);
  await assert.rejects(() => addBrightwebModule("projects", { targetDir }, { workspaceRoot: REPO_ROOT }), /projects requires orgs@>=0\.1.*Compatibility set/s);
});

test("bw upgrade appends only unapplied migrations and preserves drifted scaffold files", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const manifestPath = path.join(targetDir, ".brightweb", "app-manifest.json");
  const manifest = await readJson(manifestPath);
  manifest.migrationCursor.crm = "20260316092000_crm_v1.sql";
  await writeJson(manifestPath, manifest);
  const migrationsDir = path.join(targetDir, "supabase", "migrations");
  for (const name of await fs.readdir(migrationsDir)) {
    if (
      name.includes("_crm__20260316092010_")
      || name.includes("_crm__20260421201523_")
      || name.includes("_crm__20260724120000_")
    ) await fs.rm(path.join(migrationsDir, name));
  }
  const starterPath = path.join(targetDir, "app", "(shell)", "crm", "page.tsx");
  await fs.appendFile(starterPath, "\n// app-owned drift\n");

  const result = await upgradeBrightwebApp("crm", { targetDir, refreshStarters: true }, { workspaceRoot: REPO_ROOT, fetchImpl: mockNpmFetch });
  assert.equal(result.migrationPlan.writes.length, 3);
  assert.ok(result.drifted.includes("app/(shell)/crm/page.tsx"));
  assert.match(await fs.readFile(starterPath, "utf8"), /app-owned drift/);
  const appended = await fs.readFile(result.migrationPlan.writes[0].targetPath, "utf8");
  const release = await readJson(path.join(REPO_ROOT, "brightweb-release.json"));
  assert.match(appended, new RegExp(`^-- bw-module: crm@${release.packages["@brightweblabs/module-crm"].replaceAll(".", "\\.")} 20260316092010_crm_org_integration\\.sql`));
});

test("bw upgrade never refreshes an owned scaffold file", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const relativePath = "app/(shell)/crm/page.tsx";
  const starterPath = path.join(targetDir, relativePath);
  await scaffoldBrightwebApp("own", [relativePath], { targetDir }, { workspaceRoot: REPO_ROOT });
  await fs.appendFile(starterPath, "\n// owned after acknowledgement\n");

  const result = await upgradeBrightwebApp("crm", { targetDir, refreshStarters: true }, { workspaceRoot: REPO_ROOT, fetchImpl: mockNpmFetch });
  assert.ok(!result.plan.starterFilesToRefresh.includes(relativePath));
  assert.match(await fs.readFile(starterPath, "utf8"), /owned after acknowledgement/);
});

async function expectDoctorFault(seed: (targetDir: string) => Promise<void>, checkId: string) {
  const { root, targetDir } = await scaffold(["crm"]);
  try {
    await seed(targetDir);
    const result = await doctorBrightwebApp({ targetDir }, { workspaceRoot: REPO_ROOT });
    assert.equal(result.ok, false);
    assert.equal(result.checks.find((entry: { id: string }) => entry.id === checkId)?.status, "FAIL");
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}

test("bw doctor passes a fresh scaffold", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const result = await doctorBrightwebApp({ targetDir }, { workspaceRoot: REPO_ROOT });
  assert.equal(result.ok, true);
  assert.equal(result.checks.find((entry: { id: string }) => entry.id === "runtime-singletons")?.status, "PASS");
});

test("bw doctor fails when the app store resolves duplicate runtimes", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const version of ["19.0.0", "19.2.4"]) {
    const packageDir = path.join(
      targetDir,
      "node_modules",
      ".pnpm",
      `react@${version}`,
      "node_modules",
      "react",
    );
    await fs.mkdir(packageDir, { recursive: true });
    await writeJson(path.join(packageDir, "package.json"), { name: "react", version });
  }
  const result = await doctorBrightwebApp({ targetDir }, { workspaceRoot: REPO_ROOT });
  assert.equal(result.ok, false);
  assert.equal(result.checks.find((entry: { id: string }) => entry.id === "runtime-singletons")?.status, "FAIL");
  assert.match(
    result.checks.find((entry: { id: string }) => entry.id === "runtime-singletons")?.message || "",
    /react: 19\.0\.0, 19\.2\.4/,
  );
});

test("bw doctor fails when a module dependency is removed", () => expectDoctorFault(async (targetDir) => {
  const filePath = path.join(targetDir, "package.json");
  const value = await readJson(filePath);
  delete value.dependencies["@brightweblabs/module-crm"];
  await writeJson(filePath, value);
}, "packages"));

test("bw doctor fails when an enabled flag is flipped", () => expectDoctorFault(async (targetDir) => {
  const filePath = path.join(targetDir, "config", "modules.ts");
  const content = await fs.readFile(filePath, "utf8");
  await fs.writeFile(filePath, content.replace(/(key: "crm",[\s\S]*?enabled:) true/, "$1 false"));
}, "exposure"));

test("bw doctor fails when a migration file is deleted", () => expectDoctorFault(async (targetDir) => {
  const migrationsDir = path.join(targetDir, "supabase", "migrations");
  const name = (await fs.readdir(migrationsDir)).find((entry) => entry.includes("_crm__20260316092000_crm_v1.sql"));
  assert.ok(name);
  await fs.rm(path.join(migrationsDir, name));
}, "migrations"));

test("bw doctor warns on undecided scaffold drift and fails it only in strict mode", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.appendFile(path.join(targetDir, "app", "(shell)", "crm", "page.tsx"), "\n// drift\n");
  const advisory = await doctorBrightwebApp({ targetDir }, { workspaceRoot: REPO_ROOT });
  assert.equal(advisory.ok, true);
  assert.equal(advisory.checks.find((entry: { id: string }) => entry.id === "scaffold")?.status, "WARN");
  const strict = await doctorBrightwebApp({ targetDir, strict: true }, { workspaceRoot: REPO_ROOT });
  assert.equal(strict.ok, false);
});

test("bw scaffold own and skip acknowledge divergence, while reality mismatches fail doctor", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const ownedRelativePath = "app/(shell)/crm/page.tsx";
  const skippedRelativePath = "app/(shell)/crm/layout.tsx";
  const ownedPath = path.join(targetDir, ownedRelativePath);
  const skippedPath = path.join(targetDir, skippedRelativePath);
  const skippedContent = await fs.readFile(skippedPath, "utf8");
  await fs.appendFile(ownedPath, "\n// intentional fork\n");
  await fs.rm(skippedPath);

  const before = await doctorBrightwebApp({ targetDir }, { workspaceRoot: REPO_ROOT });
  assert.equal(before.checks.find((entry: { id: string }) => entry.id === "scaffold")?.status, "WARN");
  await scaffoldBrightwebApp("own", [ownedRelativePath], { targetDir }, { workspaceRoot: REPO_ROOT });
  await scaffoldBrightwebApp("skip", [skippedRelativePath], { targetDir }, { workspaceRoot: REPO_ROOT });
  const acknowledged = await doctorBrightwebApp({ targetDir }, { workspaceRoot: REPO_ROOT });
  assert.equal(acknowledged.ok, true);
  assert.equal(acknowledged.checks.find((entry: { id: string }) => entry.id === "scaffold")?.status, "PASS");
  assert.equal(acknowledged.checks.find((entry: { id: string }) => entry.id === "scaffold-owned")?.status, "INFO");
  assert.equal(acknowledged.checks.find((entry: { id: string }) => entry.id === "scaffold-skipped")?.status, "INFO");
  assert.match(acknowledged.checks.find((entry: { id: string }) => entry.id === "scaffold")?.message || "", /1 owned, 1 skipped/);

  await fs.rm(ownedPath);
  const missingOwned = await doctorBrightwebApp({ targetDir }, { workspaceRoot: REPO_ROOT });
  assert.equal(missingOwned.ok, false);
  assert.equal(missingOwned.checks.find((entry: { id: string }) => entry.id === "scaffold-intent-mismatch")?.status, "FAIL");

  await fs.writeFile(skippedPath, skippedContent);
  const existingSkipped = await doctorBrightwebApp({ targetDir }, { workspaceRoot: REPO_ROOT });
  assert.equal(existingSkipped.ok, false);
  assert.match(existingSkipped.checks.find((entry: { id: string }) => entry.id === "scaffold-intent-mismatch")?.message || "", /skipped, current/);
});

test("bw scaffold list and manage expose and reset per-file intent", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const relativePath = "app/(shell)/crm/page.tsx";
  const missingRelativePath = "app/(shell)/crm/layout.tsx";
  const missingPath = path.join(targetDir, missingRelativePath);
  const missingContent = await fs.readFile(missingPath, "utf8");
  await fs.appendFile(path.join(targetDir, relativePath), "\n// fork\n");
  await scaffoldBrightwebApp("own", [relativePath], { targetDir }, { workspaceRoot: REPO_ROOT });
  await fs.rm(missingPath);
  await scaffoldBrightwebApp("skip", [missingRelativePath], { targetDir }, { workspaceRoot: REPO_ROOT });
  const listed = await scaffoldBrightwebApp("list", [], { targetDir }, { workspaceRoot: REPO_ROOT });
  assert.deepEqual(listed.entries.find((entry: { relativePath: string }) => entry.relativePath === relativePath), {
    relativePath,
    module: "crm",
    status: "drifted",
    intent: "owned",
  });
  await runBwCli(["scaffold", "list", "--target-dir", targetDir], { workspaceRoot: REPO_ROOT });
  const managed = await scaffoldBrightwebApp("manage", [relativePath], { targetDir }, { workspaceRoot: REPO_ROOT });
  assert.equal(managed.changes[0].intent, "managed");
  assert.equal(managed.changes[0].status, "drifted");
  const manifest = await readJson(path.join(targetDir, ".brightweb", "app-manifest.json"));
  assert.equal(manifest.scaffoldFiles[relativePath].intent, undefined);
  const managedMissing = await scaffoldBrightwebApp("manage", [missingRelativePath], { targetDir }, { workspaceRoot: REPO_ROOT });
  assert.equal(managedMissing.changes[0].status, "missing");
  assert.equal(managedMissing.manifest.scaffoldFiles[missingRelativePath].intent, undefined);
  await fs.writeFile(missingPath, missingContent);
  const managedCurrent = await scaffoldBrightwebApp("manage", [missingRelativePath], { targetDir }, { workspaceRoot: REPO_ROOT });
  assert.equal(managedCurrent.changes[0].status, "current");
  await assert.rejects(() => scaffoldBrightwebApp("skip", [relativePath], { targetDir }, { workspaceRoot: REPO_ROOT }), /Cannot skip existing/);
  await fs.rm(path.join(targetDir, relativePath));
  await assert.rejects(() => scaffoldBrightwebApp("own", [relativePath], { targetDir }, { workspaceRoot: REPO_ROOT }), /Cannot own missing/);
});

test("bw doctor --report stamps lastDoctor", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await doctorBrightwebApp({ targetDir, report: true }, { workspaceRoot: REPO_ROOT });
  const manifest = await readJson(path.join(targetDir, ".brightweb", "app-manifest.json"));
  assert.equal(manifest.lastDoctor.ok, true);
  assert.ok(Date.parse(manifest.lastDoctor.at));
});

test("bw adopt dry-runs without writes, then records baseline cursors and honest drift", async (t) => {
  const { root, targetDir } = await legacyFixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const migrationsBefore = await migrationSnapshot(targetDir);
  const preview = await adoptBrightwebApp({ targetDir, dryRun: true, ownedSurface: ["shell"] }, { workspaceRoot: REPO_ROOT, now: "2026-07-20T10:00:00.000Z" });
  await assert.rejects(() => fs.access(path.join(targetDir, ".brightweb", "app-manifest.json")));
  assert.deepEqual(await migrationSnapshot(targetDir), migrationsBefore);
  assert.equal(preview.manifest.migrationCursor.crm, "20260316092000_crm_v1.sql");
  assert.equal(preview.manifest.adoptionNotes.cursorStrategies.crm, "baseline-header");
  assert.equal(preview.manifest.scaffoldFiles["app/(shell)/crm/page.tsx"].status, "drifted");
  assert.deepEqual(preview.manifest.ownedSurfaces, ["shell"]);
  assert.ok(preview.warnings.some((warning: string) => warning.includes("Later package migrations are UNAPPLIED")));

  const result = await adoptBrightwebApp({ targetDir, ownedSurface: ["shell"] }, { workspaceRoot: REPO_ROOT, now: "2026-07-20T10:00:00.000Z" });
  assert.deepEqual(validateAppManifest(result.manifest), []);
  assert.deepEqual(await migrationSnapshot(targetDir), migrationsBefore);
});

test("bw adopt cursor override wins and existing manifests require --force", async (t) => {
  const { root, targetDir } = await legacyFixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const result = await adoptBrightwebApp({ targetDir, cursor: ["crm=20260421201523_portal_read_indexes.sql"] }, { workspaceRoot: REPO_ROOT });
  assert.equal(result.manifest.migrationCursor.crm, "20260421201523_portal_read_indexes.sql");
  assert.equal(result.manifest.adoptionNotes.cursorStrategies.crm, "override");
  await assert.rejects(() => adoptBrightwebApp({ targetDir }, { workspaceRoot: REPO_ROOT }), /Refusing to overwrite/);
});

test("bw adopt records repeatable own and skip scaffold intent", async (t) => {
  const { root, targetDir } = await legacyFixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const missingPath = "app/(shell)/crm/layout.tsx";
  await fs.rm(path.join(targetDir, missingPath));
  await runBwCli([
    "adopt",
    "--target-dir", targetDir,
    "--own", "app/(shell)/crm/page.tsx",
    "--skip", missingPath,
  ], { workspaceRoot: REPO_ROOT });
  const manifest = await readJson(path.join(targetDir, ".brightweb", "app-manifest.json"));
  assert.equal(manifest.scaffoldFiles["app/(shell)/crm/page.tsx"].intent, "owned");
  assert.equal(manifest.scaffoldFiles[missingPath].intent, "skipped");
});

test("bw diff prints a real unified diff and identifies a clean file", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const clean = await diffBrightwebScaffold("app/api/crm/contacts/route.ts", { targetDir }, { workspaceRoot: REPO_ROOT });
  assert.equal(clean.identical, true);
  await fs.appendFile(path.join(targetDir, "app", "(shell)", "crm", "page.tsx"), "\n// app-owned change\n");
  const changed = await diffBrightwebScaffold("app/(shell)/crm/page.tsx", { targetDir }, { workspaceRoot: REPO_ROOT });
  assert.equal(changed.identical, false);
  assert.match(changed.diff, /^--- a\/template\//);
  assert.match(changed.diff, /^\+\/\/ app-owned change$/m);
  const listed = await diffBrightwebScaffold(undefined, { targetDir, list: true }, { workspaceRoot: REPO_ROOT });
  assert.ok(listed.drift.drifted.includes("app/(shell)/crm/page.tsx"));
});

test("bw remove refuses a required module and preserves migrations", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const migrationsBefore = await migrationSnapshot(targetDir);
  await assert.rejects(() => removeBrightwebModule("orgs", { targetDir, yes: true }, { workspaceRoot: REPO_ROOT }), /crm require.* it/);
  assert.deepEqual(await migrationSnapshot(targetDir), migrationsBefore);
});

test("bw remove deletes clean scaffold files, leaves drifted files, and never touches migrations", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const driftedPath = path.join(targetDir, "app", "(shell)", "crm", "page.tsx");
  const cleanPath = path.join(targetDir, "app", "api", "crm", "contacts", "route.ts");
  await fs.appendFile(driftedPath, "\n// keep me\n");
  const migrationsBefore = await migrationSnapshot(targetDir);
  const preview = await removeBrightwebModule("crm", { targetDir }, { workspaceRoot: REPO_ROOT });
  assert.equal(preview.dryRun, true);
  await fs.access(cleanPath);
  await removeBrightwebModule("crm", { targetDir, yes: true }, { workspaceRoot: REPO_ROOT });
  await fs.access(driftedPath);
  await assert.rejects(() => fs.access(cleanPath));
  const packageJson = await readJson(path.join(targetDir, "package.json"));
  const manifest = await readJson(path.join(targetDir, ".brightweb", "app-manifest.json"));
  assert.equal(packageJson.dependencies["@brightweblabs/module-crm"], undefined);
  assert.equal(manifest.modules.crm, undefined);
  assert.equal(manifest.scaffoldFiles["app/(shell)/crm/page.tsx"], undefined);
  assert.deepEqual(await migrationSnapshot(targetDir), migrationsBefore);
});

test("bw doctor fails a null migration cursor unless adoption allows it", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const manifestPath = path.join(targetDir, ".brightweb", "app-manifest.json");
  const manifest = await readJson(manifestPath);
  manifest.migrationCursor.crm = null;
  await writeJson(manifestPath, manifest);
  const failed = await doctorBrightwebApp({ targetDir }, { workspaceRoot: REPO_ROOT });
  assert.equal(failed.ok, false);
  assert.match(failed.checks.find((entry: { id: string }) => entry.id === "migrations")?.message, /crm: migration cursor is null/);
  manifest.adoptionNotes = { allowUncursored: true };
  await writeJson(manifestPath, manifest);
  const allowed = await doctorBrightwebApp({ targetDir }, { workspaceRoot: REPO_ROOT });
  assert.notEqual(allowed.checks.find((entry: { id: string }) => entry.id === "migration-cursor-crm")?.status, "FAIL");
  await assert.rejects(() => upgradeBrightwebApp("crm", { targetDir }, { workspaceRoot: REPO_ROOT, fetchImpl: mockNpmFetch }), /Migration upgrade blocked.*null migration cursor/);
});

test("app-owned nav modules have a sanctioned home outside the managed shell config", async (t) => {
  // config/shell.ts is regenerated by `create-bw-app update`, and
  // applyShellRegistrationOverrides can only transform registrations that
  // already exist — so an app-owned surface had nowhere to live except a file
  // the CLI would overwrite. shell.overrides.ts now carries them.
  const { root, targetDir } = await scaffold(["projects"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const overrides = await fs.readFile(path.join(targetDir, "config", "shell.overrides.ts"), "utf8");
  assert.match(overrides, /export const additionalShellModules: ShellModuleRegistration<ShellContextualAction>\[\] = \[\]/);

  const shellConfig = await fs.readFile(path.join(targetDir, "config", "shell.ts"), "utf8");
  assert.match(shellConfig, /import \{ additionalShellModules, shellRegistrationOverrides \} from "\.\/shell\.overrides"/);
  assert.match(shellConfig, /registrations\.push\(\.\.\.additionalShellModules\)/);
});

test("enabling projects mounts the client account surfaces", async (t) => {
  // The client lens shipped in module-projects but the template never mounted
  // it, so every scaffolded app silently lacked /account/projetos.
  const { root, targetDir } = await scaffold(["projects"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const accountPage = await fs.readFile(path.join(targetDir, "app", "(shell)", "account", "page.tsx"), "utf8");
  assert.match(accountPage, /ClientAccountPage as default/);

  for (const relativePath of [
    ["app", "(shell)", "account", "projetos", "page.tsx"],
    ["app", "(shell)", "account", "projetos", "loading.tsx"],
    ["app", "(shell)", "account", "projetos", "[projectId]", "page.tsx"],
    ["app", "(shell)", "account", "projetos", "[projectId]", "loading.tsx"],
  ]) {
    await fs.access(path.join(targetDir, ...relativePath));
  }
});

test("every scaffold ships the keepalive route so free-tier projects do not idle-pause", async (t) => {
  const { root, targetDir } = await scaffold([]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const route = await fs.readFile(path.join(targetDir, "app", "api", "cron", "keepalive", "route.ts"), "utf8");
  assert.match(route, /handleKeepaliveGetRequest as GET/);

  const envConfig = await fs.readFile(path.join(targetDir, "config", "env.ts"), "utf8");
  assert.match(envConfig, /SUPABASE_KEEPALIVE_SECRET/);
});

test("rebranding survives update because brand marks live outside the managed shell config", async (t) => {
  // config/shell.ts is regenerated by `create-bw-app update`, so logo paths
  // hardcoded there were reverted to scaffold defaults on every update.
  // config/brand.ts is written once and never regenerated.
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const brand = await fs.readFile(path.join(targetDir, "config", "brand.ts"), "utf8");
  assert.match(brand, /export const starterShellBrand: StarterShellBrand = \{/);
  assert.match(brand, /collapsedLogo: \{ src: "\/brand\/logo-mark\.svg"/);

  const shellConfig = await fs.readFile(path.join(targetDir, "config", "shell.ts"), "utf8");
  assert.match(shellConfig, /brand: starterShellBrand,/);
  assert.doesNotMatch(shellConfig, /logo-mark\.svg/);
  assert.doesNotMatch(shellConfig, /logo-light\.svg/);
  assert.doesNotMatch(shellConfig, /logo-dark\.svg/);
});
