import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const VALIDATOR_PATH = path.join(REPO_ROOT, "scripts", "validate-module-manifest.mjs");

type Manifest = Record<string, any>;

function validManifest(key: string): Manifest {
  return {
    contractVersion: 1,
    key,
    title: `${key} module`,
    description: `Fixture for ${key}.`,
    requires: {},
    capabilities: { provides: [], consumes: [] },
    events: { emits: [], consumes: [] },
    permissions: { surfaces: "staff", grants: [] },
    registration: "./registration.ts",
    database: { namespace: [`${key}_`], ownedObjects: [`${key}_records`] },
  };
}

async function createFixture(manifests: Manifest[]) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bw-manifest-validator-"));
  await fs.mkdir(path.join(root, "docs", "modules"), { recursive: true });
  await fs.mkdir(path.join(root, "supabase"), { recursive: true });
  await fs.writeFile(path.join(root, "docs", "modules", "module-manifest.schema.json"), "{}\n");
  await fs.writeFile(path.join(root, "supabase", "module-registry.json"), `${JSON.stringify({
    modules: Object.fromEntries(manifests.map((manifest) => [manifest.key, { dependsOn: Object.keys(manifest.requires ?? {}) }])),
  }, null, 2)}\n`);

  for (const manifest of manifests) {
    const packageDir = path.join(root, "packages", `module-${manifest.key}`);
    await fs.mkdir(packageDir, { recursive: true });
    await fs.writeFile(path.join(packageDir, "package.json"), `${JSON.stringify({ name: `@brightweblabs/module-${manifest.key}`, version: "1.0.0" }, null, 2)}\n`);
    await fs.writeFile(path.join(packageDir, "brightweb.module.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await fs.writeFile(path.join(packageDir, "registration.ts"), "export {};\n");
  }
  return root;
}

async function runValidator(root: string) {
  return execFileAsync(process.execPath, [VALIDATOR_PATH, "--repo-root", root]);
}

async function expectInvalid(manifests: Manifest[], pattern: RegExp) {
  const root = await createFixture(manifests);
  try {
    await assert.rejects(runValidator(root), (error: any) => {
      assert.match(error.stderr, pattern);
      return true;
    });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

test("accepts a fully valid module manifest", async (t) => {
  const root = await createFixture([validManifest("alpha")]);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const result = await runValidator(root);
  assert.match(result.stdout, /Validated 1 module manifests against the v1 contract/);
});

test("rejects an invalid capability name", async () => {
  const manifest = validManifest("alpha");
  manifest.capabilities.consumes = [{ name: "invalid", since: "1.0.0" }];
  await expectInvalid([manifest], /capabilities\.consumes\[0\]\.name must be a valid capability name/);
});

test("rejects cyclic module requirements", async () => {
  const alpha = validManifest("alpha");
  const beta = validManifest("beta");
  alpha.requires = { beta: "^1.0.0" };
  beta.requires = { alpha: "^1.0.0" };
  await expectInvalid([alpha, beta], /Circular module dependency detected: alpha -> beta -> alpha/);
});

test("rejects a missing registration path", async () => {
  const manifest = validManifest("alpha");
  manifest.registration = "./missing.ts";
  await expectInvalid([manifest], /registration path "\.\/missing\.ts" does not exist/);
});

test("rejects a non-array integrationObjects field", async () => {
  const manifest = validManifest("alpha");
  manifest.database.integrationObjects = "beta_records";
  await expectInvalid([manifest], /database\.integrationObjects must be an array/);
});

test("rejects integration objects owned by another module", async () => {
  const alpha = validManifest("alpha");
  const beta = validManifest("beta");
  alpha.database.integrationObjects = ["beta_records"];
  await expectInvalid([alpha, beta], /integration object "beta_records".*owned by "beta"/);
});
