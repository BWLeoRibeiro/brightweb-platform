import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { syncModuleMigrations } from "../scripts/sync-db-module-migrations.mjs";

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bw-module-parity-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const bundle = path.join(root, "packages/create-bw-app/template");
  const registry = JSON.stringify({ modules: { core: { path: "supabase/modules/core/migrations", dependsOn: [] } } });
  for (const directory of [root, bundle]) {
    await fs.mkdir(path.join(directory, "supabase/modules/core/migrations"), { recursive: true });
    await fs.writeFile(path.join(directory, "supabase/module-registry.json"), registry);
    await fs.writeFile(path.join(directory, "supabase/modules/core/migrations/20260101000000_base.sql"), "select 1;\n");
  }
  return { root, source: path.join(root, "supabase/modules/core/migrations"), bundle: path.join(bundle, "supabase/modules/core/migrations") };
}

test("canonical module migrations and bundled registry match", async () => {
  const result = await syncModuleMigrations();
  assert.ok(result.checked > 0);
  assert.deepEqual(result.added, []);
  assert.equal(result.registryChanged, false);
});

test("new canonical migration requires sync, which copies its exact bytes idempotently", async (t) => {
  const f = await fixture(t);
  const name = "20260201000000_forward.sql";
  const sql = "-- Unicode is preserved: ação\nselect 2;\n";
  await fs.writeFile(path.join(f.source, name), sql);
  await assert.rejects(syncModuleMigrations(f.root), /Missing packaged migration/);
  assert.deepEqual((await syncModuleMigrations(f.root, { write: true })).added, [`core/${name}`]);
  assert.equal(await fs.readFile(path.join(f.bundle, name), "utf8"), sql);
  assert.deepEqual((await syncModuleMigrations(f.root, { write: true })).added, []);
});

test("changed or missing shipped history is rejected before any new file is copied", async (t) => {
  const f = await fixture(t);
  const base = "20260101000000_base.sql";
  const added = "20260201000000_forward.sql";
  await fs.writeFile(path.join(f.source, added), "select 2;");
  await fs.writeFile(path.join(f.source, base), "select 3;");
  await assert.rejects(syncModuleMigrations(f.root, { write: true }), /Shipped migration differs/);
  await assert.rejects(fs.stat(path.join(f.bundle, added)), { code: "ENOENT" });
  assert.equal(await fs.readFile(path.join(f.bundle, base), "utf8"), "select 1;\n");
  await fs.unlink(path.join(f.source, base));
  await assert.rejects(syncModuleMigrations(f.root, { write: true }), /missing from canonical source/);
  await assert.rejects(fs.stat(path.join(f.bundle, added)), { code: "ENOENT" });
});

test("module registry changes are derived from canonical source", async (t) => {
  const f = await fixture(t);
  const registryPath = path.join(f.root, "supabase/module-registry.json");
  const registry = JSON.parse(await fs.readFile(registryPath, "utf8"));
  registry.modules.core.description = "Updated description";
  await fs.writeFile(registryPath, JSON.stringify(registry));
  await assert.rejects(syncModuleMigrations(f.root), /Module registry differs/);
  await syncModuleMigrations(f.root, { write: true });
  assert.equal((await syncModuleMigrations(f.root)).registryChanged, false);
});
