import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { addBrightwebModule } from "../packages/create-bw-app/src/add.mjs";
import { validateAppManifest } from "../packages/create-bw-app/src/app-manifest.mjs";
import { doctorBrightwebApp } from "../packages/create-bw-app/src/doctor.mjs";
import { createBrightwebClientApp } from "../packages/create-bw-app/src/generator.mjs";
import { upgradeBrightwebApp } from "../packages/create-bw-app/src/upgrade.mjs";

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

test("scaffold writes a valid app manifest", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const manifest = await readJson(path.join(targetDir, ".brightweb", "app-manifest.json"));
  assert.deepEqual(validateAppManifest(manifest), []);
  assert.equal(manifest.app.template, "platform");
  assert.equal(manifest.modules.crm.version, "0.4.1");
  assert.match(manifest.scaffoldFiles["app/playground/crm/page.tsx"].hash, /^sha256:/);
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
  assert.equal(updated.modules.orgs.version, "0.1.0");
  assert.equal(updated.modules.projects.version, "0.4.1");
  assert.equal(updated.migrationCursor.projects, "20260421201528_portal_read_indexes.sql");
  await fs.access(path.join(targetDir, "app", "playground", "projects", "page.tsx"));
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
    if (name.includes("_crm__20260316092010_") || name.includes("_crm__20260421201523_")) await fs.rm(path.join(migrationsDir, name));
  }
  const starterPath = path.join(targetDir, "app", "playground", "crm", "page.tsx");
  await fs.appendFile(starterPath, "\n// app-owned drift\n");

  const result = await upgradeBrightwebApp("crm", { targetDir, refreshStarters: true }, { workspaceRoot: REPO_ROOT, fetchImpl: mockNpmFetch });
  assert.equal(result.migrationPlan.writes.length, 2);
  assert.ok(result.drifted.includes("app/playground/crm/page.tsx"));
  assert.match(await fs.readFile(starterPath, "utf8"), /app-owned drift/);
  const appended = await fs.readFile(result.migrationPlan.writes[0].targetPath, "utf8");
  assert.match(appended, /^-- bw-module: crm@0\.4\.1 20260316092010_crm_org_integration\.sql/);
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

test("bw doctor fails when a scaffold file drifts", () => expectDoctorFault(async (targetDir) => {
  await fs.appendFile(path.join(targetDir, "app", "playground", "crm", "page.tsx"), "\n// drift\n");
}, "scaffold"));

test("bw doctor --report stamps lastDoctor", async (t) => {
  const { root, targetDir } = await scaffold(["crm"]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await doctorBrightwebApp({ targetDir, report: true }, { workspaceRoot: REPO_ROOT });
  const manifest = await readJson(path.join(targetDir, ".brightweb", "app-manifest.json"));
  assert.equal(manifest.lastDoctor.ok, true);
  assert.ok(Date.parse(manifest.lastDoctor.at));
});
