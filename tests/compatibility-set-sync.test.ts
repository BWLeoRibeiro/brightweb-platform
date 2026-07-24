import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

test("syncs the compatibility set and app defaults after package versions change", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bw-compatibility-sync-"));
  t.after(() => fs.rm(tempRoot, { recursive: true, force: true }));

  await fs.mkdir(path.join(tempRoot, "scripts"), { recursive: true });
  for (const scriptName of ["compatibility-set.mjs", "sync-compatibility-set.mjs", "validate-compatibility-set.mjs"]) {
    await fs.copyFile(path.join(REPO_ROOT, "scripts", scriptName), path.join(tempRoot, "scripts", scriptName));
  }

  await writeJson(path.join(tempRoot, "packages", "app-shell", "package.json"), {
    name: "@brightweblabs/app-shell",
    version: "1.2.0",
  });
  await writeJson(path.join(tempRoot, "packages", "create-bw-app", "package.json"), {
    name: "create-bw-app",
    version: "2.1.0",
  });
  await fs.mkdir(path.join(tempRoot, "packages", "create-bw-app", "src"), { recursive: true });
  await fs.writeFile(
    path.join(tempRoot, "packages", "create-bw-app", "src", "constants.mjs"),
    [
      "export const APP_DEPENDENCY_DEFAULTS = {",
      '  "@brightweblabs/app-shell": "^1.1.0",',
      '  "react": "19.2.4",',
      "};",
      "",
    ].join("\n"),
  );
  await writeJson(path.join(tempRoot, "brightweb-release.json"), {
    contractVersion: 1,
    packages: {
      "@brightweblabs/app-shell": "1.1.0",
      "create-bw-app": "2.0.0",
    },
  });

  await execFileAsync(process.execPath, [path.join(tempRoot, "scripts", "sync-compatibility-set.mjs"), "--repo-root", tempRoot]);

  const compatibilitySet = JSON.parse(await fs.readFile(path.join(tempRoot, "brightweb-release.json"), "utf8"));
  const constants = await fs.readFile(path.join(tempRoot, "packages", "create-bw-app", "src", "constants.mjs"), "utf8");
  assert.deepEqual(compatibilitySet.packages, {
    "@brightweblabs/app-shell": "1.2.0",
    "create-bw-app": "2.1.0",
  });
  assert.match(constants, /"@brightweblabs\/app-shell": "\^1\.2\.0"/);
  assert.match(constants, /"react": "19\.2\.4"/);

  const validation = await execFileAsync(process.execPath, [path.join(tempRoot, "scripts", "validate-compatibility-set.mjs"), "--repo-root", tempRoot]);
  assert.match(validation.stdout, /Validated 2 compatibility-set package versions and 1 app dependency defaults/);
});
