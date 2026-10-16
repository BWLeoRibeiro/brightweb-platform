import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBrightwebClientApp } from "../packages/create-bw-app/src/generator.mjs";
import { applyMigrationWrites, planMigrationAppends } from "../packages/create-bw-app/src/migrations.mjs";
import { upgradeBrightwebApp } from "../packages/create-bw-app/src/upgrade.mjs";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bw-append-recovery-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const targetDir = path.join(root, "app");
  await createBrightwebClientApp({ name: "recovery", template: "platform", modules: "crm", install: false, yes: true }, { targetDir, workspaceRoot, dependencyMode: "published" });
  const manifestPath = path.join(targetDir, ".brightweb/app-manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const sources = (await fs.readdir(path.join(workspaceRoot, "supabase/modules/crm/migrations"))).filter(name => name.endsWith(".sql")).sort();
  manifest.migrationCursor.crm = sources.at(-3);
  await fs.writeFile(manifestPath, JSON.stringify(manifest));
  const migrationsDir = path.join(targetDir, "supabase/migrations");
  for (const name of await fs.readdir(migrationsDir)) {
    if (sources.slice(-2).some(source => name.endsWith(`_crm__${source}`))) await fs.rm(path.join(migrationsDir, name));
  }
  const fetchImpl = async (url: string) => {
    const name = decodeURIComponent(url.split("/").slice(-2, -1)[0]);
    const pkg = JSON.parse(await fs.readFile(path.join(workspaceRoot, "packages", name.replace("@brightweblabs/", ""), "package.json"), "utf8"));
    return { ok: true, json: async () => ({ version: pkg.version }) };
  };
  const runtime = { workspaceRoot, fetchImpl };
  const planned = await upgradeBrightwebApp(undefined, { targetDir, dryRun: true }, runtime);
  assert.equal(planned.migrationPlan.appends.length, 2);
  return { targetDir, migrationsDir, manifestPath, runtime, writes: planned.migrationPlan.appends };
}
async function snapshot(root: string): Promise<Record<string, string>> {
  const entries: Record<string, string> = {};
  for (const name of await fs.readdir(root, { recursive: true })) {
    const file = path.join(root, name);
    if ((await fs.stat(file)).isFile()) entries[name] = await fs.readFile(file, "utf8");
  }
  return entries;
}

test("retry after an interrupted SQL append reuses exact written history and completes the remaining migration", async t => {
  const f = await fixture(t);
  const initialManifest = await fs.readFile(f.manifestPath, "utf8");
  const historical = await snapshot(f.migrationsDir);
  const originalWrite = fs.writeFile;
  const fault = t.mock.method(fs, "writeFile", async (...args: any[]) => {
    if (String(args[0]) === f.writes[1].targetPath) throw new Error("Synthetic interrupted migration write");
    return (originalWrite as any)(...args);
  });
  await assert.rejects(upgradeBrightwebApp(undefined, { targetDir: f.targetDir }, f.runtime), /Synthetic interrupted migration write/);
  fault.mock.restore();
  assert.equal(await fs.readFile(f.manifestPath, "utf8"), initialManifest);
  const persisted = await fs.readFile(f.writes[0].targetPath, "utf8");
  const retry = await upgradeBrightwebApp(undefined, { targetDir: f.targetDir }, f.runtime);
  assert.equal(retry.migrationPlan.appends.length, 1, "Do not append the already written SQL a second time");
  assert.equal(await fs.readFile(f.writes[0].targetPath, "utf8"), persisted);
  const after = await snapshot(f.migrationsDir);
  assert.equal(Object.keys(after).length, Object.keys(historical).length + 2);
  for (const [file, content] of Object.entries(historical)) assert.equal(after[file], content);
  const again = await upgradeBrightwebApp(undefined, { targetDir: f.targetDir }, f.runtime);
  assert.equal(again.migrationPlan.appends.length, 0);
  assert.deepEqual(await snapshot(f.migrationsDir), after);
});

for (const conflict of ["different bytes", "duplicate source", "linked source"]) {
  test(`interrupted append recovery rejects ${conflict} before making further writes`, async t => {
    const f = await fixture(t);
    await fs.writeFile(f.writes[0].targetPath, f.writes[0].content);
    if (conflict === "different bytes") await fs.appendFile(f.writes[0].targetPath, "\n-- incomplete or modified\n");
    else if (conflict === "duplicate source") await fs.writeFile(path.join(f.migrationsDir, `9999_crm__${f.writes[0].originalFileName}`), f.writes[0].content);
    else {
      const outside = path.join(path.dirname(f.targetDir), "outside.sql");
      await fs.rename(f.writes[0].targetPath, outside);
      await fs.symlink(outside, f.writes[0].targetPath);
    }
    const before = await snapshot(path.dirname(f.targetDir));
    await assert.rejects(upgradeBrightwebApp(undefined, { targetDir: f.targetDir }, f.runtime), /Cannot recover migration|symlinks/);
    assert.deepEqual(await snapshot(path.dirname(f.targetDir)), before);
  });
}

test("an append refuses to overwrite a file created after planning", async t => {
  const f = await fixture(t);
  await fs.writeFile(f.writes[0].targetPath, "-- independently created history\n");
  await assert.rejects(applyMigrationWrites(f.writes), { code: "EEXIST" });
  assert.equal(await fs.readFile(f.writes[0].targetPath, "utf8"), "-- independently created history\n");
  await assert.rejects(fs.stat(f.writes[1].targetPath), { code: "ENOENT" });
});

for (const state of ["missing predecessor", "reversed sequence", "truncated source"]) {
  test(`recovery rejects ${state} without changing SQL or cursor`, async t => {
    const f = await fixture(t);
    if (state === "missing predecessor") await fs.writeFile(f.writes[1].targetPath, f.writes[1].content);
    else if (state === "reversed sequence") {
      await fs.writeFile(path.join(f.migrationsDir, "9998.sql"), f.writes[1].content);
      await fs.writeFile(path.join(f.migrationsDir, "9999.sql"), f.writes[0].content);
    } else await fs.writeFile(f.writes[0].targetPath, f.writes[0].content.slice(0, -20));
    const before = await snapshot(f.targetDir);
    await assert.rejects(upgradeBrightwebApp(undefined, { targetDir: f.targetDir }, f.runtime), state === "truncated source" ? /Cannot recover migration/ : /contiguous ordered prefix/);
    assert.deepEqual(await snapshot(f.targetDir), before);
  });
}

test("recovery preserves leading source blank lines after the provenance header", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bw-blank-sql-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const targetDir = path.join(root, "app"), packageRoot = path.join(root, "module");
  await fs.mkdir(targetDir);
  await fs.mkdir(path.join(packageRoot, "migrations"), { recursive: true });
  await fs.writeFile(path.join(packageRoot, "migrations/20260101000000_blank.sql"), "\n\nSELECT 1;\n");
  const options = { targetDir, moduleKeys: ["fixture"], catalog: { fixture: { packageRoot, version: "1.0.0" } } };
  const first = await planMigrationAppends(options);
  await applyMigrationWrites(first.writes);
  const before = await snapshot(targetDir);
  const retry = await planMigrationAppends(options);
  assert.equal(retry.appends.length, 0);
  assert.equal(retry.recovered.length, 1);
  assert.deepEqual(await snapshot(targetDir), before);
});

for (const missingFirst of [false, true]) {
  test(`cross-module recovery ${missingFirst ? "refuses a gap before later module" : "accepts an ordered prefix"}`, async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "bw-cross-module-recovery-"));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const targetDir = path.join(root, "app");
    await fs.mkdir(targetDir);
    const catalog: Record<string, any> = {};
    for (const key of ["first", "second"]) {
      const packageRoot = path.join(root, key);
      await fs.mkdir(path.join(packageRoot, "migrations"), { recursive: true });
      await fs.writeFile(path.join(packageRoot, "migrations/20260101000000_step.sql"), `SELECT '${key}';\n`);
      catalog[key] = { packageRoot, version: "1.0.0" };
    }
    const options = { targetDir, moduleKeys: ["first", "second"], catalog };
    const first = await planMigrationAppends(options);
    await applyMigrationWrites(missingFirst ? [first.writes[1]] : first.writes);
    const before = await snapshot(targetDir);
    if (missingFirst) await assert.rejects(planMigrationAppends(options), /contiguous ordered prefix/);
    else assert.equal((await planMigrationAppends(options)).recovered.length, 2);
    assert.deepEqual(await snapshot(targetDir), before);
  });
}
