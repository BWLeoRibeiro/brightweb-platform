import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBrightwebClientApp, createManagedPlatformFiles, createOptionalModuleRouteFiles } from "../packages/create-bw-app/src/generator.mjs";
import { assertGeneratedFileInventory, MANAGED_PLATFORM_FILES, MODULE_SELECTED_FILES } from "../packages/create-bw-app/src/file-policy.mjs";
import { addBrightwebModule } from "../packages/create-bw-app/src/add.mjs";
import { adoptBrightwebApp } from "../packages/create-bw-app/src/adopt.mjs";
import { removeBrightwebModule } from "../packages/create-bw-app/src/remove.mjs";
import { scaffoldBrightwebApp } from "../packages/create-bw-app/src/scaffold-cmd.mjs";
import { upgradeBrightwebApp } from "../packages/create-bw-app/src/upgrade.mjs";
import { buildBrightwebAppUpdatePlan } from "../packages/create-bw-app/src/update.mjs";
import { getModuleMigrations } from "../packages/create-bw-app/src/migrations.mjs";
import { readAppManifest, writeAppManifest } from "../packages/create-bw-app/src/app-manifest.mjs";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const runtime = {
  workspaceRoot,
  fetchImpl: async (url: string) => {
    const name = decodeURIComponent(url.split("/").at(-2)!);
    const pkg = JSON.parse(await fs.readFile(path.join(workspaceRoot, "packages", name.replace("@brightweblabs/", ""), "package.json"), "utf8"));
    return { ok: true, json: async () => ({ version: pkg.version }) };
  },
};
async function fixture(t: any, modules = "crm") {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bw-ownership-transitions-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const targetDir = path.join(root, "app");
  await createBrightwebClientApp({ name: "transitions", template: "platform", modules, install: false, yes: true }, { targetDir, workspaceRoot, dependencyMode: "published" });
  return targetDir;
}
const skippedPath = "app/(shell)/crm/layout.tsx";
const ownedPath = "app/(shell)/crm/page.tsx";
const customPage = 'export default function CustomerPage() { return "Customer content"; }\n';
async function customize(targetDir: string) {
  await fs.unlink(path.join(targetDir, skippedPath));
  await scaffoldBrightwebApp("skip", [skippedPath], { targetDir }, runtime);
  await fs.writeFile(path.join(targetDir, ownedPath), customPage);
  await scaffoldBrightwebApp("own", [ownedPath], { targetDir }, runtime);
}
async function assertCustomization(targetDir: string) {
  const manifest = await readAppManifest(targetDir);
  assert.equal(manifest.scaffoldFiles[skippedPath].intent, "skipped");
  assert.equal(manifest.scaffoldFiles[ownedPath].intent, "owned");
  await assert.rejects(fs.stat(path.join(targetDir, skippedPath)), { code: "ENOENT" });
  assert.equal(await fs.readFile(path.join(targetDir, ownedPath), "utf8"), customPage);
}

test("pending destructive migrations are gated again after an explicitly staged rollout", async t => {
  const targetDir = await fixture(t, "projects");
  const first = "20260811122000_project_client_access_identity_cleanup.sql";
  const second = "20260811122500_remove_project_client_next_steps.sql";
  const manifest = await readAppManifest(targetDir);
  manifest.migrationCursor.projects = first;
  await writeAppManifest(targetDir, manifest);
  for (const moduleKey of [undefined, "projects"]) {
    const held = await upgradeBrightwebApp(moduleKey, { targetDir, dryRun: true }, runtime);
    assert.equal(held.migrationPlan.nextCursor.projects, first);
    assert.ok(!held.migrationPlan.appends.some((entry: any) => entry.originalFileName === second));
    assert.ok(held.migrationPlan.deferred.some((entry: any) => entry.fileName === second));
  }
  await assert.rejects(upgradeBrightwebApp("projects", { targetDir, dryRun: true, throughMigration: second }, runtime), /includes destructive migration.*remove_project_client_next_steps/);
  const unchanged = await upgradeBrightwebApp("projects", { targetDir, dryRun: true, throughMigration: first }, runtime);
  assert.equal(unchanged.migrationPlan.appends.length, 0);
  const approved = await upgradeBrightwebApp("projects", { targetDir, includeDestructiveMigrations: true, throughMigration: second }, runtime);
  assert.deepEqual(approved.migrationPlan.appends.map((entry: any) => entry.originalFileName), [second]);
  assert.equal((await readAppManifest(targetDir)).migrationCursor.projects, second);
  const resumed = await upgradeBrightwebApp("projects", { targetDir, dryRun: true }, runtime);
  assert.ok(resumed.migrationPlan.appends.every((entry: any) => entry.originalFileName > second));
  assert.equal(resumed.migrationPlan.deferred.length, 0);
});

test("module-selected and managed output inventories reject omissions and undeclared outputs", async () => {
  const moduleKeys = ["admin", "orgs", "crm", "marketing", "projects"];
  for (let mask = 0; mask < 2 ** moduleKeys.length; mask++) {
    const selectedModules = moduleKeys.filter((_, index) => mask & (1 << index));
    const routes = createOptionalModuleRouteFiles(selectedModules);
    assert.deepEqual(Object.keys(routes).sort(), [...MODULE_SELECTED_FILES].sort());
    const files = await createManagedPlatformFiles({ slug: "inventory", selectedModules });
    assert.deepEqual(Object.keys(files).sort(), [...MANAGED_PLATFORM_FILES].sort());
    assert.deepEqual(JSON.parse(files["docs/ai/app-context.json"]).ownership.generated.sort(), Object.keys(files).sort());
  }
  assert.throws(() => assertGeneratedFileInventory({}, ["required.ts"], "Test"), /missing required.ts/);
  assert.throws(() => assertGeneratedFileInventory({ "undeclared.ts": "" }, [], "Test"), /unexpected undeclared.ts/);
});

for (const modules of ["none", "crm"]) {
  test(`missing membership route refresh respects ${modules} module selection`, async t => {
    const targetDir = await fixture(t, modules);
    const relativePath = "app/api/organizations/[id]/members/[profileId]/route.ts";
    const original = await fs.readFile(path.join(targetDir, relativePath), "utf8");
    await fs.unlink(path.join(targetDir, relativePath));
    const plan = await buildBrightwebAppUpdatePlan({ targetDir, refreshStarters: true }, runtime);
    const writes = plan.fileWrites.filter((entry: any) => entry.relativePath === relativePath);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].content, original);
    if (modules === "none") {
      assert.match(original, /status: 404/);
      assert.doesNotMatch(writes[0].content, /@brightweblabs\/module-orgs/);
      assert.equal(plan.manifest.dependencies["@brightweblabs/module-orgs"], undefined);
    } else assert.match(writes[0].content, /@brightweblabs\/module-orgs/);
    await upgradeBrightwebApp(undefined, { targetDir, refreshStarters: true }, runtime);
    assert.equal(await fs.readFile(path.join(targetDir, relativePath), "utf8"), original);
  });
}

test("forced cursor repair retains exact-path owned and skipped decisions and owned surfaces", async t => {
  const targetDir = await fixture(t);
  await customize(targetDir);
  const previous = await readAppManifest(targetDir);
  previous.ownedSurfaces = ["shell"];
  await writeAppManifest(targetDir, previous);
  const options = { targetDir, force: true, cursor: [`crm=${previous.migrationCursor.crm}`], ownedSurface: ["theme"] };
  const preview = await adoptBrightwebApp({ ...options, dryRun: true }, runtime);
  assert.equal(preview.manifest.scaffoldFiles[skippedPath].intent, "skipped");
  assert.equal(preview.manifest.scaffoldFiles[ownedPath].intent, "owned");
  assert.deepEqual((await readAppManifest(targetDir)).ownedSurfaces, ["shell"]);
  await adoptBrightwebApp(options, runtime);
  assert.deepEqual((await readAppManifest(targetDir)).ownedSurfaces, ["shell", "theme"]);
  await upgradeBrightwebApp(undefined, { targetDir, refreshStarters: true }, runtime);
  await assertCustomization(targetDir);
});

test("remove, cursor repair, and re-add retain path decisions until an explicit manage action", async t => {
  const targetDir = await fixture(t);
  await customize(targetDir);
  const driftedPath = "app/(shell)/crm/report/page.tsx";
  const before = await readAppManifest(targetDir);
  const migrationsBefore = await fs.readdir(path.join(targetDir, "supabase/migrations"));
  await fs.writeFile(path.join(targetDir, driftedPath), customPage);
  const removal = await removeBrightwebModule("crm", { targetDir, yes: true }, runtime);
  assert.ok(removal.retainedFiles.includes(skippedPath));
  assert.ok(removal.retainedFiles.includes(ownedPath));
  assert.equal((await readAppManifest(targetDir)).modules.crm, undefined);
  await assertCustomization(targetDir);
  await adoptBrightwebApp({ targetDir, force: true }, runtime);
  await assertCustomization(targetDir);
  const adopted = await readAppManifest(targetDir);
  assert.equal(adopted.migrationCursor.crm, before.migrationCursor.crm);
  assert.equal(adopted.scaffoldFiles[driftedPath].hash, before.scaffoldFiles[driftedPath].hash);
  assert.equal(adopted.scaffoldFiles[driftedPath].intent, undefined);
  assert.equal(adopted.scaffoldFiles[driftedPath].status, "drifted");
  const readded = await addBrightwebModule("crm", { targetDir }, runtime);
  assert.equal(readded.migrationPlan.appends.length, 0);
  await upgradeBrightwebApp(undefined, { targetDir, refreshStarters: true }, runtime);
  assert.deepEqual(await fs.readdir(path.join(targetDir, "supabase/migrations")), migrationsBefore);
  assert.equal(await fs.readFile(path.join(targetDir, driftedPath), "utf8"), customPage);
  await assertCustomization(targetDir);
  await scaffoldBrightwebApp("manage", [skippedPath], { targetDir }, runtime);
  await upgradeBrightwebApp(undefined, { targetDir, refreshStarters: true }, runtime);
  assert.equal((await readAppManifest(targetDir)).scaffoldFiles[skippedPath].intent, undefined);
  assert.match(await fs.readFile(path.join(targetDir, skippedPath), "utf8"), /export default/);
  assert.equal(await fs.readFile(path.join(targetDir, ownedPath), "utf8"), customPage);
});


test("forced adoption preserves an exact removed-module cursor even when later files exist", async t => {
  const targetDir = await fixture(t);
  await removeBrightwebModule("crm", { targetDir, yes: true }, runtime);
  const previous = await readAppManifest(targetDir);
  const shipped = await getModuleMigrations("crm");
  assert.ok(shipped.length > 1);
  previous.migrationCursor.crm = shipped[0].fileName;
  await writeAppManifest(targetDir, previous);
  await adoptBrightwebApp({ targetDir, force: true }, runtime);
  const adopted = await readAppManifest(targetDir);
  assert.equal(adopted.modules.crm, undefined);
  assert.equal(adopted.migrationCursor.crm, shipped[0].fileName);
  assert.equal(adopted.adoptionNotes.cursorStrategies.crm, "retained");
  const override = shipped.at(-1).fileName;
  await adoptBrightwebApp({ targetDir, force: true, cursor: [`crm=${override}`] }, runtime);
  assert.equal((await readAppManifest(targetDir)).migrationCursor.crm, override);
});

for (const cursor of ["20990101000000_unknown.sql", null]) {
  test(`forced adoption refuses unknown removed-module history (${cursor}) until a valid override`, async t => {
    const targetDir = await fixture(t);
    await removeBrightwebModule("crm", { targetDir, yes: true }, runtime);
    const previous = await readAppManifest(targetDir);
    const validCursor = previous.migrationCursor.crm;
    previous.migrationCursor.crm = cursor;
    await writeAppManifest(targetDir, previous);
    const manifestPath = path.join(targetDir, ".brightweb/app-manifest.json");
    const originalManifest = await fs.readFile(manifestPath, "utf8");
    await assert.rejects(adoptBrightwebApp({ targetDir, force: true }, runtime), /Retained migration cursor for removed module crm does not name a shipped migration/);
    await assert.rejects(adoptBrightwebApp({ targetDir, force: true, cursor: ["crm=20990101000000_unknown.sql"] }, runtime), /Cursor override for crm does not name a shipped migration/);
    assert.equal(await fs.readFile(manifestPath, "utf8"), originalManifest);
    await adoptBrightwebApp({ targetDir, force: true, cursor: [`crm=${validCursor}`] }, runtime);
    assert.equal((await readAppManifest(targetDir)).migrationCursor.crm, validCursor);
    const readd = await addBrightwebModule("crm", { targetDir, dryRun: true }, runtime);
    assert.equal(readd.migrationPlan.appends.length, 0);
  });
}

test("forced adoption refuses an unknown retained module instead of dropping its history", async t => {
  const targetDir = await fixture(t);
  const previous = await readAppManifest(targetDir);
  previous.migrationCursor.unknown = "20260101000000_unknown.sql";
  await writeAppManifest(targetDir, previous);
  await assert.rejects(adoptBrightwebApp({ targetDir, force: true }, runtime), /Unknown retained migration module: unknown/);
  assert.deepEqual(await readAppManifest(targetDir), previous);
});
