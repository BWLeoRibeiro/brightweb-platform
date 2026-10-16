import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBrightwebClientApp, createAppContextFile } from "../packages/create-bw-app/src/generator.mjs";
import { addBrightwebModule } from "../packages/create-bw-app/src/add.mjs";
import { updateBrightwebApp } from "../packages/create-bw-app/src/update.mjs";
import { upgradeBrightwebApp } from "../packages/create-bw-app/src/upgrade.mjs";
import { removeBrightwebModule } from "../packages/create-bw-app/src/remove.mjs";
import { adoptBrightwebApp } from "../packages/create-bw-app/src/adopt.mjs";
import { scaffoldBrightwebApp } from "../packages/create-bw-app/src/scaffold-cmd.mjs";
import { satisfiesVersion, hashFile, MANAGED_APP_FILES } from "../packages/create-bw-app/src/app-manifest.mjs";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
async function fixture(t: any, modules = "crm") {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bw-safety-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const targetDir = path.join(root, "app");
  await createBrightwebClientApp({ name: "safety", template: "platform", modules, install: false, yes: true }, { targetDir, workspaceRoot, dependencyMode: "published" });
  return { root, targetDir };
}
async function fetchImpl(url: string) {
  const name = decodeURIComponent(url.split("/").slice(-2, -1)[0]);
  const pkg = JSON.parse(await fs.readFile(path.join(workspaceRoot, "packages", name.replace("@brightweblabs/", ""), "package.json"), "utf8"));
  return { ok: true, json: async () => ({ version: pkg.version }) };
}
async function snapshot(directory: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) files[entry.name] = `link:${await fs.readlink(full)}`;
    else if (entry.isDirectory()) for (const [key, value] of Object.entries(await snapshot(full))) files[`${entry.name}/${key}`] = value;
    else files[entry.name] = await hashFile(full);
  }
  return files;
}
const actions = {
  add: (targetDir: string) => addBrightwebModule("admin", { targetDir }, { workspaceRoot }),
  update: (targetDir: string) => updateBrightwebApp({ targetDir, refreshStarters: true }, { workspaceRoot, fetchImpl }),
  upgrade: (targetDir: string) => upgradeBrightwebApp(undefined, { targetDir, refreshStarters: true }, { workspaceRoot, fetchImpl }),
  remove: (targetDir: string) => removeBrightwebModule("crm", { targetDir, yes: true }, { workspaceRoot }),
  adopt: (targetDir: string) => adoptBrightwebApp({ targetDir, force: true }, { workspaceRoot }),
  scaffold: (targetDir: string) => scaffoldBrightwebApp("manage", ["app/api/invitations/_dependencies.ts"], { targetDir }, { workspaceRoot }),
};
for (const [name, action] of Object.entries(actions)) {
  for (const kind of ["file", "ancestor", "dangling", "directory-target"]) {
    test(`${name} rejects ${kind} mutation boundary before changing app or sibling bytes`, async t => {
      const { root, targetDir } = await fixture(t);
      const relative = "app/api/invitations/_dependencies.ts";
      const destination = path.join(targetDir, relative);
      const sibling = path.join(root, "outside");
      if (kind === "ancestor") {
        await fs.rename(path.dirname(destination), sibling);
        await fs.symlink(sibling, path.dirname(destination));
      } else {
        if (kind === "file") await fs.copyFile(destination, sibling);
        await fs.rm(destination);
        if (kind === "directory-target") await fs.mkdir(destination);
        else await fs.symlink(sibling, destination);
      }
      const before = await snapshot(root);
      await assert.rejects(action(targetDir), /symlinks|filesystem type/);
      assert.deepEqual(await snapshot(root), before);
    });
  }
}
test("an explicitly selected root alias resolves to the canonical app directory", async t => {
  const { root, targetDir } = await fixture(t);
  const alias = path.join(root, "app-alias");
  await fs.symlink(targetDir, alias);
  await addBrightwebModule("admin", { targetDir: alias }, { workspaceRoot });
  const manifest = JSON.parse(await fs.readFile(path.join(targetDir, ".brightweb/app-manifest.json"), "utf8"));
  assert.ok(manifest.modules.admin);
});
for (const cursor of ["20990101000000_future.sql", "20260731125000_unknown.sql"]) {
  test(`unknown cursor ${cursor} never moves backward or writes package/config`, async t => {
    const { targetDir } = await fixture(t);
    const p = path.join(targetDir, ".brightweb/app-manifest.json");
    const m = JSON.parse(await fs.readFile(p, "utf8"));
    m.migrationCursor.core = cursor;
    await fs.writeFile(p, JSON.stringify(m));
    const before = await snapshot(targetDir);
    await assert.rejects(upgradeBrightwebApp(undefined, { targetDir }, { workspaceRoot, fetchImpl }), /cursor.*does not exist/);
    assert.deepEqual(await snapshot(targetDir), before);
  });
}
test("compatibility uses standard zero-major, prerelease and compound ranges", () => {
  for (const [version, range, expected] of [
    ["0.9.0", "^0.3.0", false], ["0.0.9", "^0.0.3", false],
    ["1.0.0-beta.1", ">=1.0.0", false], ["2.0.0", ">=1.0.0 <2.0.0", false],
    ["1.9.0", "1.x", true], ["1.2.3", "nonsense1.2.3", false],
    ["0.3.8", "^0.3.0", true], ["1.0.0", "workspace:*", true],
  ] as const) assert.equal(satisfiesVersion(version, range), expected, `${version} ${range}`);
});
test("generated ownership declares exact disjoint paths and defaults custom routes to the app", () => {
  for (const template of ["platform", "site"]) {
    const context = JSON.parse(createAppContextFile({ slug: "test", template, selectedModules: ["crm"] }));
    assert.equal(context.ownership.default, "app-owned");
    const { appOwned, generated, scaffoldManaged } = context.ownership;
    const all = [...appOwned, ...generated, ...scaffoldManaged];
    assert.equal(new Set(all).size, all.length);
    assert.equal(all.some((entry: string) => entry.includes("*")), false);
    assert.ok(generated.includes("docs/ai/app-context.json"));
    if (template === "platform") {
      assert.deepEqual(generated, MANAGED_APP_FILES);
      assert.ok(appOwned.includes("config/brand.ts"));
      assert.ok(appOwned.includes("app/theme.css"));
      assert.ok(appOwned.includes("config/social-media-plan.json"));
      assert.ok(!scaffoldManaged.includes("app/(shell)/custom/page.tsx"));
    }
  }
});
test("manage compares a core-only adapter against generated module selection", async t => {
  const { targetDir } = await fixture(t, "none");
  const relative = "app/api/invitations/_dependencies.ts";
  await scaffoldBrightwebApp("own", [relative], { targetDir }, { workspaceRoot });
  const result = await scaffoldBrightwebApp("manage", [relative], { targetDir }, { workspaceRoot });
  assert.equal(result.manifest.scaffoldFiles[relative].status, "current");
  assert.equal(result.manifest.scaffoldFiles[relative].hash, await hashFile(path.join(targetDir, relative)));
});
test("removal rejects surviving package imports without deleting custom content", async t => {
  const { targetDir } = await fixture(t);
  const custom = path.join(targetDir, "app/customer-report.tsx");
  await fs.writeFile(custom, 'export { CrmPage as default } from "@brightweblabs/module-crm/ui";\n');
  const before = await snapshot(targetDir);
  await assert.rejects(removeBrightwebModule("crm", { targetDir, yes: true }, { workspaceRoot }), /surviving app files.*customer-report/);
  assert.deepEqual(await snapshot(targetDir), before);
  await fs.writeFile(custom, "export default function ClientPage() { return null; }\n");
  await removeBrightwebModule("crm", { targetDir, yes: true }, { workspaceRoot });
  assert.equal(await fs.readFile(custom, "utf8"), "export default function ClientPage() { return null; }\n");
});
test("real app-owned seeds and content survive lifecycle changes byte-for-byte", async t => {
  const { targetDir } = await fixture(t);
  const files = ["config/brand.ts", "app/theme.css", "config/shell.overrides.ts", "config/social-media-plan.json"];
  for (const file of files) await fs.appendFile(path.join(targetDir, file), "\n/* Client-owned sentinel */\n");
  const before = await Promise.all(files.map(file => fs.readFile(path.join(targetDir, file), "utf8")));
  await addBrightwebModule("projects", { targetDir }, { workspaceRoot });
  await updateBrightwebApp({ targetDir, refreshStarters: true }, { workspaceRoot, fetchImpl });
  await upgradeBrightwebApp(undefined, { targetDir, refreshStarters: true }, { workspaceRoot, fetchImpl });
  await removeBrightwebModule("projects", { targetDir, yes: true }, { workspaceRoot });
  assert.deepEqual(await Promise.all(files.map(file => fs.readFile(path.join(targetDir, file), "utf8"))), before);
  assert.match(await fs.readFile(path.join(targetDir, "app/globals.css"), "utf8"), /@import "\.\/theme.css"/);
});

test("removal rejects preserved stylesheet imports and references before changing app bytes", async t => {
  const { targetDir } = await fixture(t);
  const stylesheet = path.join(targetDir, "app/theme.css");
  for (const directive of [
    '@import "@brightweblabs/module-crm/tokens.css";',
    '@import url("@brightweblabs/module-crm/tokens.css");',
    '@import url(@brightweblabs/module-crm/tokens.css);',
    '@reference "@brightweblabs/module-crm/tokens.css";',
  ]) {
    await fs.writeFile(stylesheet, `${directive}\n`);
    const before = await snapshot(targetDir);
    await assert.rejects(removeBrightwebModule("crm", { targetDir, yes: true }, { workspaceRoot }), /surviving app files.*theme.css/);
    assert.deepEqual(await snapshot(targetDir), before);
  }
  await fs.writeFile(stylesheet, '@import "@brightweblabs/module-crm-other/tokens.css";\n');
  await removeBrightwebModule("crm", { targetDir, yes: true }, { workspaceRoot });
  assert.match(await fs.readFile(stylesheet, "utf8"), /module-crm-other/);
});

test("removal rejects an app-owned MDX import before changing files", async t => {
  const { targetDir } = await fixture(t);
  const page = path.join(targetDir, "app", "custom-page.mdx");
  await fs.writeFile(page, 'import { ContactCard } from "@brightweblabs/module-crm/ui";\n\n# Client-owned page\n');
  const before = await snapshot(targetDir);
  await assert.rejects(removeBrightwebModule("crm", { targetDir, yes: true }, { workspaceRoot }), /custom-page\.mdx/);
  assert.deepEqual(await snapshot(targetDir), before);
});

for (const linked of [false, true]) {
  test(`upgrade ${linked ? "rejects linked" : "supports"} parent migration owner without modifying historical SQL`, async t => {
    const { root, targetDir } = await fixture(t);
    await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ private: true }));
    await fs.writeFile(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - app\n");
    await fs.rename(path.join(targetDir, "supabase"), path.join(root, "supabase"));
    const migrationDir = path.join(root, "supabase/migrations");
    const manifestPath = path.join(targetDir, ".brightweb/app-manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const historical = await snapshot(migrationDir);
    // Rewind one real migration and remove only its materialized file to model
    // a previous consumer. The next upgrade must actually append a SQL file.
    const latest = manifest.migrationCursor.crm;
    const files = await fs.readdir(migrationDir);
    const missing = files.find(name => name.endsWith(`_crm__${latest}`));
    assert.ok(missing);
    await fs.rm(path.join(migrationDir, missing));
    const sourceNames = (await fs.readdir(path.join(workspaceRoot, "supabase/modules/crm/migrations"))).filter(name => name.endsWith(".sql")).sort();
    manifest.migrationCursor.crm = sourceNames[sourceNames.indexOf(latest) - 1];
    await fs.writeFile(manifestPath, JSON.stringify(manifest));
    if (linked) {
      await fs.rename(migrationDir, path.join(root, "outside-migrations"));
      await fs.symlink(path.join(root, "outside-migrations"), migrationDir);
    }
    const before = await snapshot(root);
    if (linked) {
      await assert.rejects(upgradeBrightwebApp(undefined, { targetDir }, { workspaceRoot, fetchImpl }), /symlinks/);
      assert.deepEqual(await snapshot(root), before);
    } else {
      await upgradeBrightwebApp(undefined, { targetDir }, { workspaceRoot, fetchImpl });
      const after = await snapshot(migrationDir);
      for (const [file, hash] of Object.entries(historical)) {
        if (file !== missing) assert.equal(after[file], hash);
      }
      assert.equal(Object.keys(after).length, Object.keys(historical).length);
      await upgradeBrightwebApp(undefined, { targetDir }, { workspaceRoot, fetchImpl });
      assert.deepEqual(await snapshot(migrationDir), after);
    }
  });
}

test("published upgrade plans new SQL from its matching release bundle before replacing old installed packages", async t => {
  const { root, targetDir } = await fixture(t);
  const oldPackageRoot = path.join(targetDir, "node_modules/@brightweblabs/module-crm");
  await fs.mkdir(path.join(oldPackageRoot, "migrations"), { recursive: true });
  await fs.copyFile(path.join(workspaceRoot, "packages/module-crm/brightweb.module.json"), path.join(oldPackageRoot, "brightweb.module.json"));
  await fs.writeFile(path.join(oldPackageRoot, "package.json"), JSON.stringify({ name: "@brightweblabs/module-crm", version: "0.0.1" }));
  const sourceDir = path.join(workspaceRoot, "supabase/modules/crm/migrations");
  const sources = (await fs.readdir(sourceDir)).filter(name => name.endsWith(".sql")).sort();
  for (const name of sources.slice(0, -1)) await fs.copyFile(path.join(sourceDir, name), path.join(oldPackageRoot, "migrations", name));
  const manifestPath = path.join(targetDir, ".brightweb/app-manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const migrationsDir = path.join(targetDir, "supabase/migrations");
  const latest = manifest.migrationCursor.crm;
  const removed = (await fs.readdir(migrationsDir)).find(name => name.endsWith(`_crm__${latest}`));
  assert.ok(removed);
  await fs.rm(path.join(migrationsDir, removed));
  manifest.migrationCursor.crm = sources.at(-2);
  await fs.writeFile(manifestPath, JSON.stringify(manifest));
  const before = await snapshot(migrationsDir);
  const result = await upgradeBrightwebApp(undefined, { targetDir }, { fetchImpl });
  assert.equal(result.migrationPlan.appends.length, 1);
  assert.equal(result.migrationPlan.appends[0].moduleKey, "crm");
  const after = await snapshot(migrationsDir);
  assert.equal(Object.keys(after).length, Object.keys(before).length + 1);
  for (const [name, hash] of Object.entries(before)) assert.equal(after[name], hash);
  const unchanged = await snapshot(root);
  await assert.rejects(upgradeBrightwebApp(undefined, { targetDir }, {
    fetchImpl: async () => ({ ok: true, json: async () => ({ version: "99.0.0" }) }),
  }), /Migration sources .* unavailable/);
  assert.deepEqual(await snapshot(root), unchanged, "Unavailable target SQL must fail before any write");
});

for (const nestedWorkspace of [false, true]) {
  test(`upgrade rejects ancestor SQL outside ${nestedWorkspace ? "nearest workspace" : "declared ownership"} before writes`, async t => {
    const { root, targetDir } = await fixture(t);
    await fs.rename(path.join(targetDir, "supabase"), path.join(root, "supabase"));
    if (nestedWorkspace) {
      await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ private: true }));
      await fs.writeFile(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - app\n");
      await fs.writeFile(path.join(targetDir, "pnpm-workspace.yaml"), "packages: []\n");
    }
    const before = await snapshot(root);
    await assert.rejects(upgradeBrightwebApp(undefined, { targetDir }, { workspaceRoot, fetchImpl }), /declared workspace/);
    assert.deepEqual(await snapshot(root), before);
  });
}

for (const configuration of ['{"packages": []}', '"packages": []', "{packages: []}"]) {
  test(`upgrade respects nested workspace syntax ${configuration}`, async t => {
    const { root, targetDir } = await fixture(t);
    await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ private: true }));
    await fs.writeFile(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - app\n");
    await fs.rename(path.join(targetDir, "supabase"), path.join(root, "supabase"));
    await fs.writeFile(path.join(targetDir, "pnpm-workspace.yaml"), configuration);
    const before = await snapshot(root);
    await assert.rejects(upgradeBrightwebApp(undefined, { targetDir }, { workspaceRoot, fetchImpl }), /declared workspace/);
    assert.deepEqual(await snapshot(root), before);
  });
}
