import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { createBrightwebClientApp } from "../packages/create-bw-app/src/generator.mjs";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const boundaries = {
  core: "20261014183138_protect_profile_identity.sql",
  admin: "20261014183138_auth_verified_admin_acceptance.sql",
  orgs: "20261014183138_auth_verified_organization_membership.sql",
};
async function snapshot(directory: string) {
  const result: Record<string, string> = {};
  for (const name of await fs.readdir(directory, { recursive: true })) {
    const file = path.join(directory, name);
    if ((await fs.lstat(file)).isFile()) result[name] = await fs.readFile(file, "utf8");
  }
  return result;
}
async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bw-prerequisites-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const targetDir = path.join(root, "app"), cliRoot = path.join(root, "cli");
  await createBrightwebClientApp({ name: "prerequisites", template: "platform", modules: "admin,crm", install: false, yes: true }, { targetDir, workspaceRoot, dependencyMode: "published" });
  const source = path.join(workspaceRoot, "packages/create-bw-app");
  await fs.cp(source, cliRoot, { recursive: true, filter: file => path.basename(file) !== "node_modules" });
  await fs.symlink(path.join(source, "node_modules"), path.join(cliRoot, "node_modules"));
  // CLI selection is tested independently of SQL behavior. Prior to the identity
  // lane handoff these local-only stub files model its frozen filename contract.
  // Once delivered, this fixture uses the real shipped migration bytes instead.
  for (const [key, name] of Object.entries(boundaries)) {
    const file = path.join(cliRoot, "template/supabase/modules", key, "migrations", name);
    if (!(await fs.stat(file).catch(() => null))) await fs.writeFile(file, `SELECT '${key} prerequisite selection fixture';\n`);
  }
  const manifestPath = path.join(targetDir, ".brightweb/app-manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  for (const [key, boundary] of Object.entries(boundaries)) {
    const files = (await fs.readdir(path.join(cliRoot, "template/supabase/modules", key, "migrations"))).filter(name => name.endsWith(".sql")).sort();
    manifest.migrationCursor[key] = files.filter(name => name < boundary).at(-1);
  }
  const migrationsDir = path.join(targetDir, "supabase/migrations");
  for (const name of await fs.readdir(migrationsDir)) {
    for (const [key, boundary] of Object.entries(boundaries)) if (name.includes(`_${key}__`) && name.split(`_${key}__`)[1] >= boundary) await fs.rm(path.join(migrationsDir, name));
  }
  await fs.writeFile(manifestPath, JSON.stringify(manifest));
  const upgrade = (await import(pathToFileURL(path.join(cliRoot, "src/upgrade.mjs")).href)).upgradeBrightwebApp;
  const versions = JSON.parse(await fs.readFile(path.join(workspaceRoot, "brightweb-release.json"), "utf8")).packages;
  const runtime = { fetchImpl: async (url: string) => ({ ok: true, json: async () => ({ version: versions[decodeURIComponent(url.split("/").at(-2)!)] }) }) };
  return { targetDir, cliRoot, manifestPath, migrationsDir, manifest, upgrade, runtime };
}
for (const scope of ["admin", "orgs"]) {
  test(`${scope}-only refuses missing Core prerequisite before any app or SQL write`, async t => {
    const f = await fixture(t), before = await snapshot(f.targetDir);
    await assert.rejects(f.upgrade(scope, { targetDir: f.targetDir, install: true }, { ...f.runtime, installRunner: () => assert.fail("preflight must precede install") }), /Run bw upgrade core/);
    assert.deepEqual(await snapshot(f.targetDir), before);
  });
  test(`${scope}-only identity cutoff with destructive opt-in still refuses before writes or installation`, async t => {
    const f = await fixture(t), before = await snapshot(f.targetDir);
    let installations = 0;
    await assert.rejects(f.upgrade(scope, {
      targetDir: f.targetDir, throughMigration: boundaries[scope],
      includeDestructiveMigrations: true, install: true,
    }, { ...f.runtime, installRunner: async () => { installations++; } }), /Run bw upgrade core/);
    assert.deepEqual(await snapshot(f.targetDir), before);
    assert.equal(installations, 0);
  });
  test(`${scope}-only respects explicit pre-identity cutoff while Core is held back`, async t => {
    const f = await fixture(t);
    const result = await f.upgrade(scope, { targetDir: f.targetDir, throughMigration: f.manifest.migrationCursor[scope] }, f.runtime);
    assert.equal(result.migrationPlan.appends.length, 0);
    assert(result.migrationPlan.deferred.some((entry: any) => entry.originalFileName === boundaries[scope] || entry.fileName === boundaries[scope]));
    assert.equal(JSON.parse(await fs.readFile(f.manifestPath, "utf8")).migrationCursor.core, f.manifest.migrationCursor.core);
  });
  test(`${scope}-only follows exact Core assembly and retry adds no duplicate SQL`, async t => {
    const f = await fixture(t);
    const core = await f.upgrade("core", { targetDir: f.targetDir }, f.runtime);
    assert.equal(core.migrationPlan.appends.length, 1);
    const dependent = await f.upgrade(scope, { targetDir: f.targetDir }, f.runtime);
    assert.equal(dependent.migrationPlan.appends.length, 1);
    assert(path.basename(core.migrationPlan.appends[0].targetPath) < path.basename(dependent.migrationPlan.appends[0].targetPath));
    const before = await snapshot(f.targetDir);
    assert.equal((await f.upgrade(scope, { targetDir: f.targetDir }, f.runtime)).migrationPlan.appends.length, 0);
    assert.deepEqual(await snapshot(f.targetDir), before);
  });
  test(`${scope}-only rejects truncated Core source despite an advanced cursor`, async t => {
    const f = await fixture(t);
    const core = await f.upgrade("core", { targetDir: f.targetDir }, f.runtime);
    const file = core.migrationPlan.appends[0].targetPath;
    const bytes = await fs.readFile(file, "utf8");
    await fs.writeFile(file, bytes.slice(0, -10));
    const before = await snapshot(f.targetDir);
    await assert.rejects(f.upgrade(scope, { targetDir: f.targetDir }, f.runtime), /Core SQL verification/);
    assert.deepEqual(await snapshot(f.targetDir), before);
  });
}
test("full upgrade orders Core before dependent identity migrations regardless of cursor insertion order", async t => {
  const f = await fixture(t);
  f.manifest.migrationCursor = { orgs: f.manifest.migrationCursor.orgs, admin: f.manifest.migrationCursor.admin, ...f.manifest.migrationCursor };
  await fs.writeFile(f.manifestPath, JSON.stringify(f.manifest));
  const result = await f.upgrade(undefined, { targetDir: f.targetDir }, f.runtime);
  assert.deepEqual(result.migrationPlan.appends.map((entry: any) => entry.moduleKey), ["core", "admin", "orgs"]);
});

for (const missing of [false, true]) {
  test(`Core-only upgrade with ${missing ? "missing" : "null"} cursor gives explicit adoption recovery without writes`, async t => {
    const f = await fixture(t);
    if (missing) delete f.manifest.migrationCursor.core;
    else f.manifest.migrationCursor.core = null;
    await fs.writeFile(f.manifestPath, JSON.stringify(f.manifest));
    const before = await snapshot(f.targetDir);
    await assert.rejects(f.upgrade("core", { targetDir: f.targetDir }, f.runtime), /bw adopt --force --cursor/);
    assert.deepEqual(await snapshot(f.targetDir), before);
  });
}
