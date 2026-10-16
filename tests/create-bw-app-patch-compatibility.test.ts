import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBrightwebClientApp } from "../packages/create-bw-app/src/generator.mjs";
import { updateBrightwebApp } from "../packages/create-bw-app/src/update.mjs";
import { upgradeBrightwebApp } from "../packages/create-bw-app/src/upgrade.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const CRM = "@brightweblabs/module-crm";
const targetVersion = "0.18.5";

async function snapshot(root: string) {
  const files: Record<string, string> = {};
  async function walk(directory: string) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) files[path.relative(root, file)] = createHash("sha256").update(await fs.readFile(file)).digest("hex");
    }
  }
  await walk(root);
  return files;
}

async function fixture(t: any, owner = false) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "bw-app-patch-"));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, "consumer");
  const app = owner ? path.join(root, "apps/portal") : root;
  await createBrightwebClientApp({ name: "patched-app", template: "platform", modules: "crm,admin,projects", install: false, yes: true }, { targetDir: app, workspaceRoot: REPO_ROOT, dependencyMode: "published" });
  if (owner) {
    await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ private: true }));
    await fs.rm(path.join(app, "pnpm-workspace.yaml"));
    await fs.writeFile(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
  }
  await fs.mkdir(path.join(root, "patches"));
  await fs.writeFile(path.join(root, "patches/crm.patch"), "synthetic app-owned patch\n");
  await fs.writeFile(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  const release = JSON.parse(await fs.readFile(path.join(REPO_ROOT, "brightweb-release.json"), "utf8"));
  const runtime = { workspaceRoot: REPO_ROOT, fetchImpl: async (url: string) => ({ ok: true, json: async () => ({ version: decodeURIComponent(url.split("/").at(-2)!) === CRM ? targetVersion : release.packages[decodeURIComponent(url.split("/").at(-2)!)] }) }) };
  return { root, app, runtime };
}

async function writePatch(root: string, selector: string, format: "yaml" | "json", owner = false) {
  if (format === "yaml") {
    await fs.writeFile(path.join(root, "pnpm-workspace.yaml"), `${owner ? "packages:\n  - apps/*\n" : ""}patchedDependencies:\n  '${selector}': patches/crm.patch\n`);
  } else {
    const file = path.join(root, "package.json");
    const manifest = JSON.parse(await fs.readFile(file, "utf8"));
    manifest.pnpm = { patchedDependencies: { [selector]: "patches/crm.patch" } };
    await fs.writeFile(file, JSON.stringify(manifest));
  }
}

for (const operation of ["update", "upgrade"] as const) {
  const run = (app: string, runtime: any, options: any = {}) => operation === "update"
    ? updateBrightwebApp({ targetDir: app, refreshStarters: true, ...options }, runtime)
    : upgradeBrightwebApp(undefined, { targetDir: app, refreshStarters: true, ...options }, runtime);

  for (const owner of [false, true]) for (const format of ["yaml", "json"] as const) {
    test(`${operation} refuses incompatible ${format} app patch before writes (${owner ? "workspace owner" : "standalone"})`, async t => {
      const { root, app, runtime } = await fixture(t, owner);
      await writePatch(root, `${CRM}@0.18.4`, format, owner);
      const before = await snapshot(root);
      let installations = 0;
      for (const options of [{ install: true }, { install: false }, { dryRun: true, install: true }]) {
        await assert.rejects(run(app, { ...runtime, installRunner: async () => { installations++; } }, options), /Upgrade blocked before writes: app-owned patch.*0\.18\.4[\s\S]*0\.18\.5[\s\S]*pnpm patch-commit[\s\S]*previous attempt/);
        assert.deepEqual(await snapshot(root), before, "Refusal/retry must preserve package, config, SQL, patch and manifest bytes");
      }
      assert.equal(installations, 0);
    });
  }

  test(`${operation} refuses already-written package/SQL state, then retries after a reviewed compatible patch`, async t => {
    const { root, app, runtime } = await fixture(t);
    let installations = 0;
    const installRunner = async () => { installations++; throw new Error("Prior installation failed"); };
    await assert.rejects(run(app, { ...runtime, installRunner }, { install: true }), /Prior installation failed/);
    assert.equal(JSON.parse(await fs.readFile(path.join(app, "package.json"), "utf8")).dependencies[CRM], `^${targetVersion}`);
    await writePatch(root, `${CRM}@0.18.4`, "yaml");
    const partial = await snapshot(root);
    await assert.rejects(run(app, { ...runtime, installRunner }, { install: true }), /Upgrade blocked before writes/);
    assert.deepEqual(await snapshot(root), partial, "Existing partial state is preserved, never rolled back implicitly");
    assert.equal(installations, 1);
    const patch = await fs.readFile(path.join(root, "patches/crm.patch"));
    // Synthetic reviewed configuration; real app patch migration is a separate
    // owner-reviewed operation, never performed by the upgrader itself.
    await writePatch(root, `${CRM}@>=0.18.4 <0.19.0`, "yaml");
    const beforeRecovery = await snapshot(path.join(app, "supabase/migrations"));
    const recovery = { ...runtime, installRunner: async () => { installations++; } };
    await run(app, recovery, { install: true });
    assert.equal(installations, 2, "Partial prior failure still requires installation");
    assert.deepEqual(await snapshot(path.join(app, "supabase/migrations")), beforeRecovery, "Recovery does not duplicate or rewrite SQL");
    assert.deepEqual(await fs.readFile(path.join(root, "patches/crm.patch")), patch, "App patch body remains intact");
  });

  test(`${operation} allows compatible exact/range/name patches and ignores unrelated app patches`, async t => {
    const { root, app, runtime } = await fixture(t);
    for (const selector of [`${CRM}@${targetVersion}`, `${CRM}@>=0.18.4 <0.19.0`, CRM, "unrelated-package@1.0.0"]) {
      await writePatch(root, selector, "yaml");
      const result = await run(app, runtime, { dryRun: true });
      assert.equal(result.plan.targetVersions[CRM], selector === `${CRM}@${targetVersion}` ? targetVersion : `^${targetVersion}`);
    }
    await writePatch(root, `${CRM}@0.18.4 || 0.18.5`, "yaml");
    const result = await run(app, runtime, { dryRun: true });
    assert.equal(result.plan.targetVersions[CRM], targetVersion, "Finite supported versions constrain the actual dependency requirement");
  });
}

test("patch preflight stops at the nearest standalone pnpm settings boundary", async t => {
  const { root, app, runtime } = await fixture(t, true);
  await writePatch(root, `${CRM}@0.18.4`, "yaml", true);
  await fs.writeFile(path.join(app, "pnpm-workspace.yaml"), "allowBuilds:\n  sharp: true\n");
  await updateBrightwebApp({ targetDir: app, dryRun: true }, runtime);
});

test("a stray child lockfile cannot hide an enclosing workspace patch", async t => {
  const { root, app, runtime } = await fixture(t, true);
  await writePatch(root, `${CRM}@0.18.4`, "yaml", true);
  await fs.writeFile(path.join(app, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  const before = await snapshot(root);
  await assert.rejects(upgradeBrightwebApp(undefined, { targetDir: app, install: true }, runtime), /Upgrade blocked before writes/);
  assert.deepEqual(await snapshot(root), before);
});

test("pnpm settings patch map takes precedence over legacy package configuration", async t => {
  const { root, app, runtime } = await fixture(t);
  await writePatch(root, `${CRM}@0.18.4`, "json");
  await writePatch(root, `${CRM}@0.18.4 || 0.18.5`, "yaml");
  const result = await updateBrightwebApp({ targetDir: app, dryRun: true }, runtime);
  assert.equal(result.plan.targetVersions[CRM], targetVersion);
});
