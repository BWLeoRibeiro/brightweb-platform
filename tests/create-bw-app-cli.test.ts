import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { addBrightwebModule } from "../packages/create-bw-app/src/add.mjs";
import { adoptBrightwebApp } from "../packages/create-bw-app/src/adopt.mjs";
import { loadModuleCatalog, validateAppManifest } from "../packages/create-bw-app/src/app-manifest.mjs";
import { runBwCli } from "../packages/create-bw-app/src/bw.mjs";
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
  await fs.appendFile(path.join(fixture.targetDir, "app", "crm", "page.tsx"), "\n// adopted app drift\n");
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
  assert.match(manifest.scaffoldFiles["app/crm/page.tsx"].hash, /^sha256:/);
  assert.match(manifest.scaffoldFiles["app/crm/layout.tsx"].hash, /^sha256:/);
  assert.match(manifest.scaffoldFiles["app/api/crm/timeline/route.ts"].hash, /^sha256:/);
  const packageJson = await readJson(path.join(targetDir, "package.json"));
  assert.equal(packageJson.dependencies["@brightweblabs/theme"], `^${release.packages["@brightweblabs/theme"]}`);
});

test("database module order implementations stay in sync for the current registry", async () => {
  const registry = await readJson(path.join(REPO_ROOT, "supabase", "module-registry.json"));
  const selections = [
    ["core"],
    ["admin"],
    ["orgs"],
    ["crm"],
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
  const starterPath = path.join(targetDir, "app", "crm", "page.tsx");
  await fs.appendFile(starterPath, "\n// app-owned drift\n");

  const result = await upgradeBrightwebApp("crm", { targetDir, refreshStarters: true }, { workspaceRoot: REPO_ROOT, fetchImpl: mockNpmFetch });
  assert.equal(result.migrationPlan.writes.length, 3);
  assert.ok(result.drifted.includes("app/crm/page.tsx"));
  assert.match(await fs.readFile(starterPath, "utf8"), /app-owned drift/);
  const appended = await fs.readFile(result.migrationPlan.writes[0].targetPath, "utf8");
  const release = await readJson(path.join(REPO_ROOT, "brightweb-release.json"));
  assert.match(appended, new RegExp(`^-- bw-module: crm@${release.packages["@brightweblabs/module-crm"].replaceAll(".", "\\.")} 20260316092010_crm_org_integration\\.sql`));
});

test("bw upgrade never refreshes an owned scaffold file", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const relativePath = "app/crm/page.tsx";
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
  assert.equal((await doctorBrightwebApp({ targetDir }, { workspaceRoot: REPO_ROOT })).ok, true);
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
  await fs.appendFile(path.join(targetDir, "app", "crm", "page.tsx"), "\n// drift\n");
  const advisory = await doctorBrightwebApp({ targetDir }, { workspaceRoot: REPO_ROOT });
  assert.equal(advisory.ok, true);
  assert.equal(advisory.checks.find((entry: { id: string }) => entry.id === "scaffold")?.status, "WARN");
  const strict = await doctorBrightwebApp({ targetDir, strict: true }, { workspaceRoot: REPO_ROOT });
  assert.equal(strict.ok, false);
});

test("bw scaffold own and skip acknowledge divergence, while reality mismatches fail doctor", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const ownedRelativePath = "app/crm/page.tsx";
  const skippedRelativePath = "app/crm/layout.tsx";
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
  const relativePath = "app/crm/page.tsx";
  const missingRelativePath = "app/crm/layout.tsx";
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
  assert.equal(preview.manifest.scaffoldFiles["app/crm/page.tsx"].status, "drifted");
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
  const missingPath = "app/crm/layout.tsx";
  await fs.rm(path.join(targetDir, missingPath));
  await runBwCli([
    "adopt",
    "--target-dir", targetDir,
    "--own", "app/crm/page.tsx",
    "--skip", missingPath,
  ], { workspaceRoot: REPO_ROOT });
  const manifest = await readJson(path.join(targetDir, ".brightweb", "app-manifest.json"));
  assert.equal(manifest.scaffoldFiles["app/crm/page.tsx"].intent, "owned");
  assert.equal(manifest.scaffoldFiles[missingPath].intent, "skipped");
});

test("bw diff prints a real unified diff and identifies a clean file", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const clean = await diffBrightwebScaffold("app/api/crm/contacts/route.ts", { targetDir }, { workspaceRoot: REPO_ROOT });
  assert.equal(clean.identical, true);
  await fs.appendFile(path.join(targetDir, "app", "crm", "page.tsx"), "\n// app-owned change\n");
  const changed = await diffBrightwebScaffold("app/crm/page.tsx", { targetDir }, { workspaceRoot: REPO_ROOT });
  assert.equal(changed.identical, false);
  assert.match(changed.diff, /^--- a\/template\//);
  assert.match(changed.diff, /^\+\/\/ app-owned change$/m);
  const listed = await diffBrightwebScaffold(undefined, { targetDir, list: true }, { workspaceRoot: REPO_ROOT });
  assert.ok(listed.drift.drifted.includes("app/crm/page.tsx"));
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
  const driftedPath = path.join(targetDir, "app", "crm", "page.tsx");
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
  assert.equal(manifest.scaffoldFiles["app/crm/page.tsx"], undefined);
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
