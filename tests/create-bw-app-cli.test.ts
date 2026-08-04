import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { addBrightwebModule } from "../packages/create-bw-app/src/add.mjs";
import { createFirstAdmin } from "../packages/create-bw-app/src/admin.mjs";
import { adoptBrightwebApp } from "../packages/create-bw-app/src/adopt.mjs";
import { hashFile, loadModuleCatalog, validateAppManifest } from "../packages/create-bw-app/src/app-manifest.mjs";
import { runBwCli } from "../packages/create-bw-app/src/bw.mjs";
import { MODULE_STARTER_FILES, PLATFORM_STARTER_FILES } from "../packages/create-bw-app/src/constants.mjs";
import { diffBrightwebScaffold } from "../packages/create-bw-app/src/diff.mjs";
import { doctorBrightwebApp } from "../packages/create-bw-app/src/doctor.mjs";
import { createBrightwebClientApp, resolveModuleOrder as resolveGeneratorModuleOrder } from "../packages/create-bw-app/src/generator.mjs";
import { removeBrightwebModule } from "../packages/create-bw-app/src/remove.mjs";
import { normalizeSafeRelativePath, resolveSafeRelativePath } from "../packages/create-bw-app/src/safe-path.mjs";
import { scaffoldBrightwebApp } from "../packages/create-bw-app/src/scaffold-cmd.mjs";
import { updateBrightwebApp } from "../packages/create-bw-app/src/update.mjs";
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

function createAdminClientFixture(options: {
  hasAdmin?: boolean;
  existingUser?: { id: string; email: string } | null;
  rpcError?: { message: string } | null;
  recoveryError?: { message: string } | null;
  deleteError?: { message: string } | null;
} = {}) {
  const calls = {
    createUser: [] as Array<Record<string, unknown>>,
    rpc: [] as Array<{ name: string; params: Record<string, unknown> }>,
    recovery: [] as Array<{ email: string; options: Record<string, unknown> }>,
    deletedUserIds: [] as string[],
  };
  const client = {
    from(table: string) {
      assert.equal(table, "user_role_assignments");
      return {
        select() { return this; },
        eq() { return this; },
        async limit() {
          return {
            data: options.hasAdmin ? [{ profile_id: "existing-admin-profile" }] : [],
            error: null,
          };
        },
      };
    },
    auth: {
      admin: {
        async listUsers() {
          return {
            data: { users: options.existingUser ? [options.existingUser] : [] },
            error: null,
          };
        },
        async createUser(input: Record<string, unknown>) {
          calls.createUser.push(input);
          return {
            data: { user: { id: "auth-user-1", email: input.email } },
            error: null,
          };
        },
        async deleteUser(userId: string) {
          calls.deletedUserIds.push(userId);
          return { error: options.deleteError || null };
        },
      },
      async resetPasswordForEmail(email: string, recoveryOptions: Record<string, unknown>) {
        calls.recovery.push({ email, options: recoveryOptions });
        return { error: options.recoveryError || null };
      },
    },
    async rpc(name: string, params: Record<string, unknown>) {
      calls.rpc.push({ name, params });
      return {
        data: options.rpcError ? null : [{ profile_id: "profile-1", previous_role_code: "client" }],
        error: options.rpcError || null,
      };
    },
  };
  return { client, calls };
}

const ADMIN_ENV = {
  NEXT_PUBLIC_APP_URL: "https://portal.example",
  NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.supabase.co",
  SUPABASE_SECRET_DEFAULT_KEY: "sb_secret_test-only",
};

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
  assert.equal(packageJson.scripts.build, "next build --webpack");
  assert.match(await fs.readFile(path.join(targetDir, "app", "fonts.ts"), "utf8"), /GeistSans as geistSans/);
  assert.match(await fs.readFile(path.join(targetDir, "app", "layout.tsx"), "utf8"), /geistSans\.variable/);
  assert.equal(
    await fs.readFile(path.join(targetDir, "pnpm-workspace.yaml"), "utf8"),
    "allowBuilds:\n  sharp: true\n",
  );
});

test("safe relative paths reject empty, absolute, traversal, drive, UNC, and containment escapes", () => {
  const targetDir = path.join(os.tmpdir(), "safe-target");
  for (const unsafePath of [
    "",
    "   ",
    "/tmp/escape.txt",
    "../escape.txt",
    "nested/../../escape.txt",
    "C:\\escape.txt",
    "C:escape.txt",
    "\\\\server\\share\\escape.txt",
  ]) {
    assert.throws(
      () => resolveSafeRelativePath(targetDir, unsafePath, "Test path"),
      /non-empty relative path|relative to the target directory|parent-directory traversal|inside the target directory/,
      unsafePath,
    );
  }
  assert.equal(normalizeSafeRelativePath("./app\\page.tsx"), "app/page.tsx");
  assert.equal(resolveSafeRelativePath(targetDir, "app/page.tsx"), path.join(targetDir, "app", "page.tsx"));
});

test("add, remove, update, and scaffold reject unsafe manifest-controlled paths before filesystem changes", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const manifestPath = path.join(targetDir, ".brightweb", "app-manifest.json");
  const manifest = await readJson(manifestPath);
  const [trackedPath, trackedRecord] = Object.entries(manifest.scaffoldFiles)[0];
  delete manifest.scaffoldFiles[trackedPath];
  manifest.scaffoldFiles["../outside.txt"] = trackedRecord;
  await writeJson(manifestPath, manifest);
  const packageBefore = await fs.readFile(path.join(targetDir, "package.json"), "utf8");

  const operations = [
    () => addBrightwebModule("projects", { targetDir }, { workspaceRoot: REPO_ROOT }),
    () => removeBrightwebModule("crm", { targetDir, yes: true }, { workspaceRoot: REPO_ROOT }),
    () => updateBrightwebApp({ targetDir }, { workspaceRoot: REPO_ROOT, fetchImpl: mockNpmFetch }),
    () => scaffoldBrightwebApp("list", [], { targetDir }, { workspaceRoot: REPO_ROOT }),
  ];
  for (const operation of operations) {
    await assert.rejects(operation, /Invalid BrightWeb app manifest:.*parent-directory traversal/);
  }

  assert.equal(await fs.readFile(path.join(targetDir, "package.json"), "utf8"), packageBefore);
  await assert.rejects(fs.access(path.join(root, "outside.txt")), { code: "ENOENT" });
});

test("invite-only scaffolds do not emit a signup route", async (t) => {
  const { root, targetDir } = await scaffold([]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await assert.rejects(
    fs.access(path.join(targetDir, "app", "(auth)", "signup", "page.tsx")),
    { code: "ENOENT" },
  );

  const manifest = await readJson(path.join(targetDir, ".brightweb", "app-manifest.json"));
  assert.equal(manifest.scaffoldFiles["app/(auth)/signup/page.tsx"], undefined);
  assert.doesNotMatch(
    await fs.readFile(path.join(targetDir, "README.md"), "utf8"),
    /`\/signup`/,
  );
});

test("bw admin create uses the transactional bootstrap and recovery flow without a password, and rolls back failures", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bw-admin-create-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await assert.rejects(
    () => createFirstAdmin(
      "create",
      { email: "owner@example.com", password: "must-not-enter-shell-history" },
      { targetDir: root, env: ADMIN_ENV },
    ),
    /Passwords are not accepted/,
  );

  const success = createAdminClientFixture();
  const result = await createFirstAdmin(
    "create",
    { email: " Owner@Example.com " },
    {
      targetDir: root,
      env: ADMIN_ENV,
      createClient: () => success.client,
      output: { write() {} },
    },
  );

  assert.equal(result.email, "owner@example.com");
  assert.deepEqual(success.calls.createUser, [{
    email: "owner@example.com",
    email_confirm: true,
  }]);
  assert.equal("password" in success.calls.createUser[0], false);
  assert.deepEqual(success.calls.rpc, [{
    name: "bootstrap_first_admin",
    params: {
      p_user_id: "auth-user-1",
      p_email: "owner@example.com",
    },
  }]);
  assert.equal("p_force" in success.calls.rpc[0].params, false);
  assert.deepEqual(success.calls.recovery, [{
    email: "owner@example.com",
    options: { redirectTo: "https://portal.example/reset-password" },
  }]);

  const failed = createAdminClientFixture({
    recoveryError: { message: "SMTP unavailable" },
  });
  await assert.rejects(
    () => createFirstAdmin(
      "create",
      { email: "owner@example.com" },
      {
        targetDir: root,
        env: ADMIN_ENV,
        createClient: () => failed.client,
        output: { write() {} },
      },
    ),
    /password-set email.*rolled back/,
  );
  assert.deepEqual(failed.calls.deletedUserIds, ["auth-user-1"]);
});

test("bw admin create always refuses when an admin exists and never promotes an existing Auth user", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bw-admin-guard-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const existingAdmin = createAdminClientFixture({ hasAdmin: true });
  await assert.rejects(
    () => createFirstAdmin(
      "create",
      { email: "second@example.com" },
      { targetDir: root, env: ADMIN_ENV, createClient: () => existingAdmin.client },
    ),
    /administrator already exists.*in-app admin role controls/,
  );
  assert.equal(existingAdmin.calls.createUser.length, 0);

  const existingUser = createAdminClientFixture({
    existingUser: { id: "auth-existing", email: "second@example.com" },
  });
  await assert.rejects(
    () => createFirstAdmin(
      "create",
      { email: "second@example.com" },
      { targetDir: root, env: ADMIN_ENV, createClient: () => existingUser.client },
    ),
    /already exists.*Refusing to promote/,
  );
  assert.equal(existingUser.calls.createUser.length, 0);
});

test("bw admin create rejects the removed --force flag and dry-runs without it", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bw-admin-force-removed-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const withForce = createAdminClientFixture();
  await assert.rejects(
    () => createFirstAdmin(
      "create",
      { email: "owner@example.com", force: true },
      { targetDir: root, env: ADMIN_ENV, createClient: () => withForce.client },
    ),
    /--force has been removed; use the in-app admin role controls to add administrators\./,
  );
  assert.equal(withForce.calls.createUser.length, 0);

  const dryRun = createAdminClientFixture();
  let dryRunOutput = "";
  const result = await createFirstAdmin(
    "create",
    { email: "owner@example.com", dryRun: true },
    {
      targetDir: root,
      env: ADMIN_ENV,
      createClient: () => dryRun.client,
      output: { write(chunk: string) { dryRunOutput += chunk; } },
    },
  );
  assert.deepEqual(result, { dryRun: true, email: "owner@example.com" });
  assert.equal("forced" in result, false);
  assert.match(dryRunOutput, /DRY RUN owner@example\.com can be created as the first administrator\./);
  assert.doesNotMatch(dryRunOutput, /--force/);
  assert.equal(dryRun.calls.createUser.length, 0);
});

test("platform scaffolds pin mapped Vercel regions and leave a valid commented fallback for unknown regions", async (t) => {
  const knownRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bw-region-known-test-"));
  const unknownRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bw-region-unknown-test-"));
  t.after(() => Promise.all([
    fs.rm(knownRoot, { recursive: true, force: true }),
    fs.rm(unknownRoot, { recursive: true, force: true }),
  ]));

  const knownTarget = path.join(knownRoot, "app");
  await createBrightwebClientApp(
    {
      name: "region-known",
      template: "platform",
      modules: "none",
      supabaseRegion: "eu-west-3",
      install: false,
      yes: true,
    },
    { targetDir: knownTarget, dependencyMode: "published", workspaceRoot: REPO_ROOT, banner: "test" },
  );
  assert.deepEqual(await readJson(path.join(knownTarget, "vercel.json")), {
    $schema: "https://openapi.vercel.sh/vercel.json",
    regions: ["cdg1"],
  });
  assert.match(await fs.readFile(path.join(knownTarget, ".env.local"), "utf8"), /^SUPABASE_PROJECT_REGION=eu-west-3$/m);
  const knownManifest = await readJson(path.join(knownTarget, ".brightweb", "app-manifest.json"));
  assert.deepEqual(knownManifest.infrastructure, {
    supabaseRegion: "eu-west-3",
    vercelRegion: "cdg1",
  });

  const unknownTarget = path.join(unknownRoot, "app");
  await createBrightwebClientApp(
    {
      name: "region-unknown",
      template: "platform",
      modules: "none",
      supabaseRegion: "moon-1",
      install: false,
      yes: true,
    },
    { targetDir: unknownTarget, dependencyMode: "published", workspaceRoot: REPO_ROOT, banner: "test" },
  );
  assert.deepEqual(await readJson(path.join(unknownTarget, "vercel.json")), {
    $schema: "https://openapi.vercel.sh/vercel.json",
  });
  assert.match(
    await fs.readFile(path.join(unknownTarget, "README.md"), "utf8"),
    /<!-- vercel\.json region placeholder:/,
  );
});

test("scaffolded shell derives its title and resolves registered module controls", async (t) => {
  const { root, targetDir } = await scaffold(["crm", "projects"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const shellLayout = await fs.readFile(
    path.join(targetDir, "app", "(shell)", "shell-layout-client.tsx"),
    "utf8",
  );

  assert.match(shellLayout, /const activeNavItem = shellNavItems\.reduce/);
  assert.match(shellLayout, /title=\{activeNavItem\?\.label\}/);
  assert.match(shellLayout, /onToolbarAction=\{handleToolbarAction\}/);
  assert.match(shellLayout, /<ShellActionsProvider>/);
  assert.match(shellLayout, /useShellAction\("projects-back-to-portfolio"/);
  assert.doesNotMatch(shellLayout, /toolbarWindowEventByAction|window\.dispatchEvent/);
  assert.match(shellLayout, /getModuleToolbarControls/);
  assert.doesNotMatch(shellLayout, /@brightweblabs\/module-(admin|crm|projects)/);

  const toolbarControls = await fs.readFile(
    path.join(targetDir, "config", "module-toolbar-controls.tsx"),
    "utf8",
  );
  assert.match(toolbarControls, /CrmToolbarControls/);
  assert.match(toolbarControls, /ProjectsToolbarControls/);
  assert.match(toolbarControls, /ProjectBoardToolbarControls/);
  assert.match(toolbarControls, /resolveShellToolbarSurface\(pathname, toolbarRoutes\)/);
  assert.match(toolbarControls, /crm: \(\) => <CrmToolbarControls/);
  assert.match(toolbarControls, /projects: \(\) => <ProjectsToolbarControls/);
  assert.match(toolbarControls, /"project-board": \(\) => <ProjectBoardToolbarControls/);
  assert.doesNotMatch(toolbarControls, /AdminToolbarControls/);
});

test("core-only scaffold does not import or declare optional module toolbar packages", async (t) => {
  const { root, targetDir } = await scaffold([]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const packageJson = await readJson(path.join(targetDir, "package.json"));
  const toolbarControls = await fs.readFile(
    path.join(targetDir, "config", "module-toolbar-controls.tsx"),
    "utf8",
  );

  assert.doesNotMatch(toolbarControls, /@brightweblabs\/module-/);
  for (const packageName of [
    "@brightweblabs/module-admin",
    "@brightweblabs/module-crm",
    "@brightweblabs/module-projects",
  ]) {
    assert.equal(packageJson.dependencies[packageName], undefined);
  }
});

test("admin scaffold mounts invitation list, create, and revoke handlers", async (t) => {
  const { root, targetDir } = await scaffold(["admin"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const invitationsRoute = await fs.readFile(
    path.join(targetDir, "app", "api", "admin", "users", "invitations", "route.ts"),
    "utf8",
  );
  const revokeRoute = await fs.readFile(
    path.join(
      targetDir,
      "app",
      "api",
      "admin",
      "users",
      "invitations",
      "[invitationId]",
      "route.ts",
    ),
    "utf8",
  );

  assert.match(invitationsRoute, /handleAdminUserInvitationsGetRequest/);
  assert.match(invitationsRoute, /handleAdminUserInvitationsPostRequest/);
  assert.match(revokeRoute, /handleAdminUserInvitationDeleteRequest/);
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
  const toolbarConfig = await fs.readFile(path.join(targetDir, "config", "module-toolbar-controls.tsx"), "utf8");
  assert.match(toolbarConfig, /MarketingToolbarControls/);
  assert.match(toolbarConfig, /marketing:\s*\(\)\s*=>\s*<MarketingToolbarControls/);
  assert.equal(
    (await fs.readdir(path.join(targetDir, "supabase", "migrations")))
      .some((name) => name.includes("_marketing__20260731130400_marketing_collection_indexes.sql")),
    true,
  );

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
  assert.match(rootLayout, /defaultTheme="system"/);
  const globalsCss = await fs.readFile(path.join(targetDir, "app", "globals.css"), "utf8");
  assert.match(globalsCss, /@brightweblabs\/core-auth\/src/);

  const shellConfig = await fs.readFile(path.join(targetDir, "config", "shell.ts"), "utf8");
  for (const registration of [
    "adminModuleRegistration",
    "crmModuleRegistration",
    "marketingModuleRegistration",
    "projectsModuleRegistration",
  ]) {
    assert.match(shellConfig, new RegExp(registration));
  }
  assert.match(shellConfig, /dashboardModuleRegistration/);
  assert.match(shellConfig, /dashboardContributions/);

  const projectsBoundary = await fs.readFile(
    path.join(targetDir, "app", "(shell)", "projetos", "projetos-live-mounts.tsx"),
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
  assert.equal(updated.migrationCursor.projects, "20260804123000_project_start_date.sql");
  assert.match(await fs.readFile(path.join(targetDir, "app", "globals.css"), "utf8"), /@source "\.\.\/node_modules\/@brightweblabs\/module-projects\/src";/);
  assert.match(
    await fs.readFile(path.join(targetDir, "config", "module-toolbar-controls.tsx"), "utf8"),
    /ProjectsToolbarControls/,
  );
  await assert.rejects(fs.access(path.join(targetDir, "app", "playground", "projects", "page.tsx")));
  const migrations = await fs.readdir(path.join(targetDir, "supabase", "migrations"));
  assert.ok(migrations.some((name) => name.includes("_projects__20260316093000_projects_v1.sql")));
  assert.ok(migrations.some((name) => name.includes("_projects__20260731121000_project_notification_audiences.sql")));
  assert.ok(migrations.some((name) => name.includes("_projects__20260731123000_project_realtime_visibility.sql")));
  assert.ok(migrations.some((name) => name.includes("_projects__20260731124000_project_task_stats.sql")));
  assert.ok(migrations.some((name) => name.includes("_projects__20260731130300_project_collection_indexes.sql")));
  assert.ok(migrations.some((name) => name.includes("_projects__20260801122000_project_member_sync.sql")));
  const doctor = await doctorBrightwebApp({ targetDir }, { workspaceRoot: REPO_ROOT });
  assert.equal(doctor.ok, true);
  assert.equal(doctor.checks.find((entry: { id: string }) => entry.id === "scaffold")?.status, "PASS");
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
  manifest.modules.crm.version = "0.0.1";
  await writeJson(manifestPath, manifest);
  const migrationsDir = path.join(targetDir, "supabase", "migrations");
  for (const name of await fs.readdir(migrationsDir)) {
    if (
      name.includes("_crm__20260316092010_")
      || name.includes("_crm__20260421201523_")
      || name.includes("_crm__20260724120000_")
      || name.includes("_crm__20260731130200_")
    ) await fs.rm(path.join(migrationsDir, name));
  }
  const starterPath = path.join(targetDir, "app", "(shell)", "crm", "page.tsx");
  await fs.appendFile(starterPath, "\n// app-owned drift\n");

  const result = await upgradeBrightwebApp("crm", { targetDir, refreshStarters: true }, { workspaceRoot: REPO_ROOT, fetchImpl: mockNpmFetch });
  assert.equal(result.migrationPlan.writes.length, 4);
  assert.ok(result.drifted.includes("app/(shell)/crm/page.tsx"));
  assert.match(await fs.readFile(starterPath, "utf8"), /app-owned drift/);
  const appended = await fs.readFile(result.migrationPlan.writes[0].targetPath, "utf8");
  const release = await readJson(path.join(REPO_ROOT, "brightweb-release.json"));
  const upgradedManifest = await readJson(manifestPath);
  assert.equal(upgradedManifest.modules.crm.version, release.packages["@brightweblabs/module-crm"]);
  assert.match(appended, new RegExp(`^-- bw-module: crm@${release.packages["@brightweblabs/module-crm"].replaceAll(".", "\\.")} 20260316092010_crm_org_integration\\.sql`));
});

test("bw upgrade installs and tracks deletion routes introduced after the original scaffold", async (t) => {
  const { root, targetDir } = await scaffold(["marketing"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const notificationRelativePath = "app/api/notifications/route.ts";
  const notificationPath = path.join(targetDir, notificationRelativePath);
  await fs.writeFile(
    notificationPath,
    'export { handleNotificationsGetRequest as GET, handleNotificationsPostRequest as POST } from "@brightweblabs/core-auth/notifications";\n',
    "utf8",
  );

  const recipientRelativePath = "app/api/marketing/campaigns/[id]/recipients/[recipientId]/route.ts";
  await fs.rm(path.join(targetDir, recipientRelativePath));

  const manifestPath = path.join(targetDir, ".brightweb", "app-manifest.json");
  const manifest = await readJson(manifestPath);
  manifest.scaffoldFiles[notificationRelativePath].hash = await hashFile(notificationPath);
  manifest.scaffoldFiles[notificationRelativePath].status = "current";
  delete manifest.scaffoldFiles[recipientRelativePath];

  const organizationRelativePath = "app/api/organizations/[id]/route.ts";
  const organizationPath = path.join(targetDir, organizationRelativePath);
  await fs.writeFile(
    organizationPath,
    'export const dynamic = "force-dynamic";\n\nexport async function PATCH() { return new Response(null); }\n',
    "utf8",
  );
  manifest.scaffoldFiles[organizationRelativePath].hash = await hashFile(organizationPath);
  manifest.scaffoldFiles[organizationRelativePath].status = "current";
  await writeJson(manifestPath, manifest);

  const result = await upgradeBrightwebApp(
    undefined,
    { targetDir, refreshStarters: true },
    { workspaceRoot: REPO_ROOT, fetchImpl: mockNpmFetch },
  );

  assert.ok(result.plan.starterFilesToRefresh.includes(notificationRelativePath));
  assert.ok(result.plan.starterFilesToRefresh.includes(recipientRelativePath));
  assert.match(await fs.readFile(notificationPath, "utf8"), /handleNotificationsDeleteRequest as DELETE/);
  assert.match(await fs.readFile(path.join(targetDir, recipientRelativePath), "utf8"), /marketingCampaignRecipientDelete as DELETE/);
  assert.match(await fs.readFile(organizationPath, "utf8"), /handleOrganizationDeleteRequest/);

  const upgradedManifest = await readJson(manifestPath);
  assert.equal(upgradedManifest.scaffoldFiles[notificationRelativePath].module, "platform-base");
  assert.equal(upgradedManifest.scaffoldFiles[notificationRelativePath].status, "current");
  assert.equal(upgradedManifest.scaffoldFiles[recipientRelativePath].module, "marketing");
  assert.equal(upgradedManifest.scaffoldFiles[recipientRelativePath].status, "current");
  assert.equal(upgradedManifest.scaffoldFiles[organizationRelativePath].hash, await hashFile(organizationPath));
  assert.equal(upgradedManifest.scaffoldFiles[organizationRelativePath].status, "current");
});

test("full bw upgrade includes core migrations recorded outside the optional module map", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const manifestPath = path.join(targetDir, ".brightweb", "app-manifest.json");
  const manifest = await readJson(manifestPath);
  manifest.migrationCursor.core = "20260731122000_core_realtime_activity.sql";
  await writeJson(manifestPath, manifest);

  const migrationsDir = path.join(targetDir, "supabase", "migrations");
  for (const name of await fs.readdir(migrationsDir)) {
    if (name.includes("_core__20260731130000_profile_search_indexes.sql")) {
      await fs.rm(path.join(migrationsDir, name));
    }
  }

  const result = await upgradeBrightwebApp(undefined, { targetDir }, { workspaceRoot: REPO_ROOT, fetchImpl: mockNpmFetch });
  assert.ok(result.migrationPlan.writes.some((entry) => entry.moduleKey === "core"));
  const updated = await readJson(manifestPath);
  assert.equal(updated.migrationCursor.core, "20260801120000_core_notification_dismissals.sql");
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

test("bw doctor warns when x-vercel-id reports a deployed function outside the mapped Supabase region", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.appendFile(path.join(targetDir, ".env.local"), "SUPABASE_PROJECT_REGION=eu-west-3\n");
  await writeJson(path.join(targetDir, "vercel.json"), {
    $schema: "https://openapi.vercel.sh/vercel.json",
    regions: ["cdg1"],
  });

  const result = await doctorBrightwebApp(
    {
      targetDir,
      deploymentUrl: "https://portal.example",
    },
    {
      workspaceRoot: REPO_ROOT,
      async fetchImpl(url: string, init: { method: string }) {
        assert.equal(url, "https://portal.example/api/cron/keepalive");
        assert.equal(init.method, "GET");
        return {
          headers: {
            get(name: string) {
              return name === "x-vercel-id" ? "cdg1::iad1::request-123" : null;
            },
          },
        };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(
    result.checks.find((entry: { id: string }) => entry.id === "function-region-config")?.status,
    "PASS",
  );
  const deployed = result.checks.find((entry: { id: string }) => entry.id === "function-region-deployed");
  assert.equal(deployed?.status, "WARN");
  assert.match(deployed?.message || "", /iad1 does not match cdg1 for Supabase eu-west-3/);
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
  assert.doesNotMatch(
    await fs.readFile(path.join(targetDir, "config", "module-toolbar-controls.tsx"), "utf8"),
    /CrmToolbarControls/,
  );
  assert.deepEqual(await migrationSnapshot(targetDir), migrationsBefore);
  const doctor = await doctorBrightwebApp({ targetDir }, { workspaceRoot: REPO_ROOT });
  assert.equal(doctor.ok, true);
  assert.equal(doctor.checks.find((entry: { id: string }) => entry.id === "scaffold")?.status, "PASS");
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
