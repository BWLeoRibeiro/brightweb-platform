import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setupBrightwebFeature } from "../packages/create-bw-app/src/setup.mjs";
import { createBrightwebClientApp } from "../packages/create-bw-app/src/generator.mjs";
import { updateBrightwebApp } from "../packages/create-bw-app/src/update.mjs";

const repo = path.resolve(import.meta.dirname, "..");
const files = ["config/social-media-plan.json", "app/(shell)/marketing/social-media/page.tsx", "config/shell.overrides.ts"];
async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bw-social-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const targetDir = path.join(root, "app");
  await createBrightwebClientApp({ name: "social-test", template: "platform", modules: "marketing", install: false, yes: true }, { targetDir, dependencyMode: "published", workspaceRoot: repo, banner: "test" });
  const pkg = path.join(targetDir, "node_modules/@brightweblabs/module-marketing");
  await fs.mkdir(pkg, { recursive: true });
  await fs.writeFile(path.join(pkg, "package.json"), JSON.stringify({ exports: { "./social-media": "./page.js", "./registration": "./registration.js" } }));
  await fs.writeFile(path.join(pkg, "page.js"), "");
  await fs.writeFile(path.join(pkg, "registration.js"), "export function withSocialMediaNavigation() {}");
  return { root, targetDir, pkg };
}
async function snapshot(targetDir: string) {
  return Promise.all(files.map(file => fs.readFile(path.join(targetDir, file), "utf8").catch(() => null)));
}

test("social setup dry-run writes nothing; setup and rerun preserve client bytes", async t => {
  const { targetDir } = await fixture(t);
  const before = await snapshot(targetDir);
  await setupBrightwebFeature("social-media", { targetDir, dryRun: true });
  assert.deepEqual(await snapshot(targetDir), before);
  await setupBrightwebFeature("social-media", { targetDir });
  const generated = await snapshot(targetDir);
  assert.deepEqual(JSON.parse(generated[0]!), { title: "Social media", period: "", sections: [{ id: "calendario", title: "Calendário" }], types: {}, events: [] });
  assert.match(generated[1]!, /SocialMediaPage plan=\{plan\}/);
  await fs.writeFile(path.join(targetDir, files[0]), "custom content\r\n");
  await fs.writeFile(path.join(targetDir, files[1]), "custom page\r\n");
  const customized = await snapshot(targetDir);
  await setupBrightwebFeature("social-media", { targetDir });
  assert.deepEqual(await snapshot(targetDir), customized);
  await updateBrightwebApp({ targetDir, refreshStarters: true }, { workspaceRoot: repo, fetchImpl: async (url: string) => {
    const name = decodeURIComponent(url.split("/").slice(-2, -1)[0]);
    const pkg = JSON.parse(await fs.readFile(path.join(repo, "packages", name.replace("@brightweblabs/", ""), "package.json"), "utf8"));
    return { ok: true, status: 200, json: async () => ({ version: pkg.version }) };
  } });
  assert.deepEqual(await snapshot(targetDir), customized);
});

test("social setup prerequisites and unsupported shell fail before generating files", async t => {
  const { targetDir, pkg } = await fixture(t);
  await fs.writeFile(path.join(pkg, "registration.js"), "export const old = true;");
  await assert.rejects(setupBrightwebFeature("social-media", { targetDir }), /Install or upgrade/);
  assert.equal((await snapshot(targetDir))[0], null);
  await fs.writeFile(path.join(pkg, "registration.js"), "export function withSocialMediaNavigation() {}");
  await fs.writeFile(path.join(targetDir, files[2]), "export { custom as shellRegistrationOverrides } from './custom';\n");
  await assert.rejects(setupBrightwebFeature("social-media", { targetDir }), /Cannot safely identify/);
  assert.equal((await snapshot(targetDir))[1], null);
  await fs.writeFile(path.join(targetDir, "config/modules.ts"), 'const modules = [{ key: "marketing", enabled: false }];');
  await assert.rejects(setupBrightwebFeature("social-media", { targetDir }), /installed and enabled/);
});

test("social setup rejects target and ancestor symlinks before any writes", async t => {
  const { root, targetDir } = await fixture(t);
  const outside = path.join(root, "outside");
  await fs.mkdir(outside);
  await fs.symlink(outside, path.join(targetDir, "app/(shell)/marketing/social-media"));
  const before = await snapshot(targetDir);
  await assert.rejects(setupBrightwebFeature("social-media", { targetDir }), /symlinks/);
  assert.deepEqual(await snapshot(targetDir), before);
  assert.deepEqual(await fs.readdir(outside), []);
  await fs.rm(path.join(targetDir, "app/(shell)/marketing/social-media"));
  await fs.writeFile(path.join(outside, "plan"), "untouched");
  await fs.symlink(path.join(outside, "plan"), path.join(targetDir, files[0]));
  await assert.rejects(setupBrightwebFeature("social-media", { targetDir }), /symlinks/);
  assert.equal(await fs.readFile(path.join(outside, "plan"), "utf8"), "untouched");
});

test("social setup rejects untyped and comment-only shell declarations and preserves existing overrides", async t => {
  const { targetDir } = await fixture(t);
  const shellPath = path.join(targetDir, files[2]);
  for (const source of [
    'export const shellRegistrationOverrides = {};\n',
    '/* export const shellRegistrationOverrides: ShellRegistrationOverrides = {}; */\n',
    '// export const shellRegistrationOverrides: ShellRegistrationOverrides = {};\n',
  ]) {
    await fs.writeFile(shellPath, source);
    await assert.rejects(setupBrightwebFeature("social-media", { targetDir }), /Cannot safely identify/);
    assert.equal(await fs.readFile(shellPath, "utf8"), source);
    assert.equal((await snapshot(targetDir))[0], null);
  }
  const source = 'import type { ShellRegistrationOverrides } from "@brightweblabs/app-shell";\nexport const shellRegistrationOverrides: ShellRegistrationOverrides = { marketing: registration => ({ ...registration, title: "Custom" }) };\n';
  await fs.writeFile(shellPath, source);
  await setupBrightwebFeature("social-media", { targetDir });
  const result = await fs.readFile(shellPath, "utf8");
  assert.ok(result.startsWith(source));
  assert.match(result, /withSocialMediaNavigation\(shellRegistrationOverrides.marketing\)/);
});
