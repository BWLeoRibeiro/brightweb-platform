import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { prepareMaterializationDirectory } from "../scripts/materialize-client-migrations.mjs";
import { cursorMigrationStatus, planMigrationAppends } from "../packages/create-bw-app/src/migrations.mjs";

async function fixture(t: any) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "bw-tooling-audit-")));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test("legacy materialization refuses existing content and linked destinations without deleting bytes", async t => {
  const root = await fixture(t);
  const output = path.join(root, "output");
  await fs.mkdir(output);
  await fs.writeFile(path.join(output, "keep.txt"), "client-owned content");
  assert.throws(() => prepareMaterializationDirectory(output), /differs or is not generated/);
  assert.equal(await fs.readFile(path.join(output, "keep.txt"), "utf8"), "client-owned content");
  const alias = path.join(root, "alias");
  await fs.symlink(output, alias);
  assert.throws(() => prepareMaterializationDirectory(alias), /real directories/);
  assert.throws(() => prepareMaterializationDirectory(path.join(alias, "nested")), /real directories/);
  assert.deepEqual(await fs.readdir(output), ["keep.txt"]);
  const dangling = path.join(root, "dangling");
  await fs.symlink(path.join(root, "missing"), dangling);
  assert.throws(() => prepareMaterializationDirectory(dangling), /real directories/);
  const fresh = path.join(root, "new", "output");
  prepareMaterializationDirectory(fresh);
  assert.deepEqual(await fs.readdir(fresh), []);
});

test("migration cursor diagnostics and append planning reject unknown history consistently", async t => {
  const root = await fixture(t);
  const packageRoot = path.join(root, "package");
  await fs.mkdir(path.join(packageRoot, "migrations"), { recursive: true });
  await fs.writeFile(path.join(packageRoot, "migrations", "20260101_base.sql"), "select 1;\n");
  const catalogEntry = { packageRoot, version: "1.0.0" };
  for (const cursor of ["0000_missing.sql", "9999_missing.sql"]) {
    const status = await cursorMigrationStatus({ targetDir: root, moduleKey: "synthetic", cursor, catalogEntry });
    assert.deepEqual(status.missing, [`cursor ${cursor} does not exist in the shipped migration history`]);
    await assert.rejects(planMigrationAppends({ targetDir: root, moduleKeys: ["synthetic"], catalog: { synthetic: catalogEntry }, migrationCursor: { synthetic: cursor } }), /does not exist/);
  }
});

test("client migration targets reject path syntax before resolving repository files", async () => {
  const { validateClientSlug, readClientStack } = await import("../scripts/_db-modules.mjs");
  for (const slug of ["../outside", "/absolute", "client/nested", "client\\nested", "", "..", "demo\nother"]) {
    assert.throws(() => validateClientSlug(slug), /Client slug/);
    assert.throws(() => readClientStack(slug), /Client slug/);
  }
  assert.equal(validateClientSlug("synthetic-client-2"), "synthetic-client-2");
});

test("legacy materialization reuses identical generated files and preserves local runtime files", async t => {
  const root = await fixture(t), output = path.join(root, "generated");
  const files = { "manifest.json": JSON.stringify({ generatedAt: "old", files: [] }), "supabase/config.toml": "synthetic config" };
  await fs.mkdir(path.join(output, "supabase"), { recursive: true });
  for (const [relative, value] of Object.entries(files)) await fs.writeFile(path.join(output, relative), value);
  await fs.writeFile(path.join(output, "local-runtime"), "preserve");
  assert.equal(prepareMaterializationDirectory(output, { ...files, "manifest.json": JSON.stringify({ generatedAt: "new", files: [] }) }), false);
  assert.equal(await fs.readFile(path.join(output, "manifest.json"), "utf8"), files["manifest.json"]);
  assert.equal(await fs.readFile(path.join(output, "local-runtime"), "utf8"), "preserve");
  assert.throws(() => prepareMaterializationDirectory(output, { ...files, "supabase/config.toml": "changed" }), /differs/);
});
