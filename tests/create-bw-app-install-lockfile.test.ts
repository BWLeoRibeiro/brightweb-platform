import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const exec = promisify(execFile);
const generator = new URL("../packages/create-bw-app/src/generator.mjs", import.meta.url).href;
const updater = new URL("../packages/create-bw-app/src/update.mjs", import.meta.url).href;

for (const workspace of [false, true]) {
  test(`explicit upgrade installation reconciles a stale lockfile in CI (${workspace ? "workspace" : "standalone"})`, async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "bw-ci-lockfile-"));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const targetDir = workspace ? path.join(root, "app") : root;
    await fs.mkdir(targetDir, { recursive: true });
    await fs.mkdir(path.join(root, "vendor"));
    await fs.writeFile(path.join(root, "vendor/package.json"), JSON.stringify({ name: "local-install-fixture", version: "1.0.0" }));
    await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ name: "lockfile-fixture", private: true, dependencies: { "local-install-fixture": "file:./vendor" } }));
    if (workspace) await fs.writeFile(path.join(targetDir, "package.json"), JSON.stringify({ name: "fixture-app", private: true }));
    const settings = path.join(root, "pnpm-workspace.yaml");
    const packages = workspace ? "packages:\n  - app\n" : "packages: []\n";
    await fs.writeFile(settings, `${packages}overrides:\n  unused-lockfile-fixture: 1.0.0\n`);
    const env = { ...process.env, CI: "true", npm_config_offline: "true", npm_config_ignore_scripts: "true" };
    await exec("pnpm", ["install", "--no-frozen-lockfile"], { cwd: root, env });
    const lockfile = path.join(root, "pnpm-lock.yaml");
    const before = await fs.readFile(lockfile, "utf8");
    assert.match(before, /unused-lockfile-fixture/);
    await fs.writeFile(settings, packages);

    // Ordinary installs must still honor CI's frozen-lockfile policy.
    await assert.rejects(exec(process.execPath, ["--input-type=module", "-e",
      `import { runInstall } from ${JSON.stringify(generator)}; await runInstall("pnpm", ${JSON.stringify(root)});`,
    ], { cwd: root, env }), (error: any) => {
      // pnpm reports diagnostics on different streams across platforms/reporters.
      assert.match(`${error.stdout}\n${error.stderr}`, /ERR_PNPM_LOCKFILE_CONFIG_MISMATCH/);
      return true;
    });
    assert.equal(await fs.readFile(lockfile, "utf8"), before);

    const plan = { targetDir, workspaceRoot: workspace ? root : null, dependencyMode: workspace ? "workspace" : "published", packageManager: "pnpm" };
    await exec(process.execPath, ["--input-type=module", "-e",
      `import { reconcileDependencyInstallation } from ${JSON.stringify(updater)}; await reconcileDependencyInstallation(${JSON.stringify(plan)});`,
    ], { cwd: root, env });
    assert.doesNotMatch(await fs.readFile(lockfile, "utf8"), /unused-lockfile-fixture/);
    // The resulting lockfile must support a normal frozen CI install again.
    await exec("pnpm", ["install", "--frozen-lockfile"], { cwd: root, env });
    assert.equal(await fs.readFile(settings, "utf8"), packages);
  });
}
