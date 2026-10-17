import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBrightwebClientApp } from "../packages/create-bw-app/src/generator.mjs";
import { readAppManifest, writeAppManifest } from "../packages/create-bw-app/src/app-manifest.mjs";
import { upgradeBrightwebApp } from "../packages/create-bw-app/src/upgrade.mjs";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const profilePath = "app/(shell)/account/perfil/page.tsx";
const customProfile = 'export default function Profile() { return "App-owned profile"; }\n';
const runtime = {
  workspaceRoot,
  fetchImpl: async (url: string) => {
    const name = decodeURIComponent(url.split("/").at(-2)!);
    const pkg = JSON.parse(await fs.readFile(path.join(workspaceRoot, "packages", name.replace("@brightweblabs/", ""), "package.json"), "utf8"));
    return { ok: true, json: async () => ({ version: pkg.version }) };
  },
};
async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bw-profile-upgrade-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const targetDir = path.join(root, "app");
  await createBrightwebClientApp({ name: "profile-upgrade", template: "platform", modules: "projects", install: false, yes: true }, { targetDir, workspaceRoot, dependencyMode: "published" });
  return targetDir;
}
async function snapshot(directory: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      for (const [name, content] of Object.entries(await snapshot(path.join(directory, entry.name)))) files[`${entry.name}/${name}`] = content;
    } else files[entry.name] = (await fs.readFile(path.join(directory, entry.name))).toString("base64");
  }
  return files;
}

test("Projects generators track the profile page for future upgrades", async t => {
  const targetDir = await fixture(t);
  const manifest = await readAppManifest(targetDir);
  assert.equal(manifest.scaffoldFiles[profilePath]?.module, "projects");
  assert.match(await fs.readFile(path.join(targetDir, profilePath), "utf8"), /ClientProfilePage/);
});

test("legacy upgrade adds the missing profile page without changing app customizations and repeats as a no-op", async t => {
  const targetDir = await fixture(t);
  const manifest = await readAppManifest(targetDir);
  delete manifest.scaffoldFiles[profilePath];
  await fs.unlink(path.join(targetDir, profilePath));
  const accountPath = "app/(shell)/account/page.tsx";
  await fs.writeFile(path.join(targetDir, accountPath), 'export default function Account() { return "Custom account"; }\n');
  manifest.scaffoldFiles[accountPath].intent = "owned";
  await writeAppManifest(targetDir, manifest);
  const before = await snapshot(targetDir);
  const preview = await upgradeBrightwebApp(undefined, { targetDir, refreshStarters: true, dryRun: true }, runtime);
  assert.ok(preview.plan.starterFilesToRefresh.includes(profilePath));
  assert.deepEqual(await snapshot(targetDir), before, "Dry run must not create the route or modify ownership");
  await upgradeBrightwebApp(undefined, { targetDir, refreshStarters: true }, runtime);
  const after = await snapshot(targetDir);
  for (const [name, content] of Object.entries(before)) {
    if (name !== ".brightweb/app-manifest.json") assert.equal(after[name], content, `Upgrade changed existing app file: ${name}`);
  }
  assert.match(await fs.readFile(path.join(targetDir, profilePath), "utf8"), /ClientProfilePage/);
  assert.equal((await readAppManifest(targetDir)).scaffoldFiles[profilePath].module, "projects");
  const repeated = await upgradeBrightwebApp(undefined, { targetDir, refreshStarters: true }, runtime);
  assert.equal(repeated.plan.fileWrites.length, 0);
  assert.equal(repeated.migrationPlan.appends.length, 0);
  assert.deepEqual(await snapshot(targetDir), after);
});

for (const mode of ["drifted", "owned", "skipped"] as const) {
  test(`profile upgrade preserves an existing ${mode} ownership decision`, async t => {
    const targetDir = await fixture(t);
    const manifest = await readAppManifest(targetDir);
    assert.ok(manifest.scaffoldFiles[profilePath]);
    if (mode === "skipped") {
      await fs.unlink(path.join(targetDir, profilePath));
      manifest.scaffoldFiles[profilePath].intent = "skipped";
    } else {
      await fs.writeFile(path.join(targetDir, profilePath), customProfile);
      if (mode === "owned") manifest.scaffoldFiles[profilePath].intent = "owned";
    }
    await writeAppManifest(targetDir, manifest);
    const before = await snapshot(targetDir);
    await upgradeBrightwebApp(undefined, { targetDir, refreshStarters: true }, runtime);
    assert.deepEqual(await snapshot(targetDir), before);
  });
}

test("an untracked custom profile refuses the upgrade before any app writes", async t => {
  const targetDir = await fixture(t);
  const manifest = await readAppManifest(targetDir);
  delete manifest.scaffoldFiles[profilePath];
  await writeAppManifest(targetDir, manifest);
  await fs.writeFile(path.join(targetDir, profilePath), customProfile);
  const before = await snapshot(targetDir);
  await assert.rejects(upgradeBrightwebApp(undefined, { targetDir, refreshStarters: true }, runtime), /Untracked app file conflicts with scaffold output/);
  assert.deepEqual(await snapshot(targetDir), before);
});
