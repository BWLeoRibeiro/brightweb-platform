import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  changedPublishablePackages,
  checkPackageChangesets,
  parseChangesetPackages,
} from "../scripts/check-package-changesets.mjs";

const execFile = promisify(execFileCallback);

test("changeset frontmatter supports quoted scoped and unscoped package names", () => {
  assert.deepEqual(
    Array.from(parseChangesetPackages('---\n"@brightweblabs/module-orgs": patch\ncreate-bw-app: minor\n---\n\nSummary.\n')),
    ["@brightweblabs/module-orgs", "create-bw-app"],
  );
});

test("changed package files map to each publishable package independently", () => {
  const packages = new Map([
    ["packages/module-orgs/", "@brightweblabs/module-orgs"],
    ["packages/create-bw-app/", "create-bw-app"],
  ]);
  assert.deepEqual(
    Array.from(changedPublishablePackages([
      "packages/module-orgs/src/invitations.ts",
      "packages/create-bw-app/template/base/package.json",
      "tests/example.test.ts",
    ], packages)).sort(),
    ["@brightweblabs/module-orgs", "create-bw-app"],
  );
});

test("package changeset coverage reports every missing publishable package", async (t) => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bw-changeset-coverage-"));
  t.after(() => fs.rm(repoRoot, { recursive: true, force: true }));
  await Promise.all([
    fs.mkdir(path.join(repoRoot, "packages", "module-orgs"), { recursive: true }),
    fs.mkdir(path.join(repoRoot, "packages", "create-bw-app"), { recursive: true }),
    fs.mkdir(path.join(repoRoot, ".changeset"), { recursive: true }),
  ]);
  await Promise.all([
    fs.writeFile(path.join(repoRoot, "packages", "module-orgs", "package.json"), JSON.stringify({ name: "@brightweblabs/module-orgs", private: false })),
    fs.writeFile(path.join(repoRoot, "packages", "create-bw-app", "package.json"), JSON.stringify({ name: "create-bw-app", private: false })),
    fs.writeFile(path.join(repoRoot, ".changeset", "member-flow.md"), '---\n"@brightweblabs/module-orgs": patch\n---\n'),
  ]);

  const result = await checkPackageChangesets({
    repoRoot,
    changedFiles: [
      "packages/module-orgs/src/invitations.ts",
      "packages/create-bw-app/src/doctor.mjs",
      ".changeset/member-flow.md",
    ],
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ["create-bw-app"]);
});

test("an older pending changeset cannot cover a new package change", async (t) => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bw-stale-changeset-"));
  t.after(() => fs.rm(repoRoot, { recursive: true, force: true }));
  await Promise.all([
    fs.mkdir(path.join(repoRoot, "packages", "module-orgs"), { recursive: true }),
    fs.mkdir(path.join(repoRoot, ".changeset"), { recursive: true }),
  ]);
  await fs.writeFile(path.join(repoRoot, "packages", "module-orgs", "package.json"), JSON.stringify({ name: "@brightweblabs/module-orgs", private: false }));
  await fs.writeFile(path.join(repoRoot, ".changeset", "older.md"), '---\n"@brightweblabs/module-orgs": patch\n---\n');
  const result = await checkPackageChangesets({ repoRoot, changedFiles: ["packages/module-orgs/src/invitations.ts"] });
  assert.deepEqual(result.missing, ["@brightweblabs/module-orgs"]);
});

test("a consumed changeset can cover the Changesets version commit", async (t) => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bw-consumed-changeset-"));
  t.after(() => fs.rm(repoRoot, { recursive: true, force: true }));
  await fs.mkdir(path.join(repoRoot, "packages", "module-orgs"), { recursive: true });
  await fs.mkdir(path.join(repoRoot, ".changeset"), { recursive: true });
  await fs.writeFile(path.join(repoRoot, "packages", "module-orgs", "package.json"), JSON.stringify({ name: "@brightweblabs/module-orgs", private: false }));
  await execFile("git", ["init"], { cwd: repoRoot });
  await execFile("git", ["config", "user.email", "test@example.com"], { cwd: repoRoot });
  await execFile("git", ["config", "user.name", "Test"], { cwd: repoRoot });
  await fs.writeFile(path.join(repoRoot, ".changeset", "release.md"), '---\n"@brightweblabs/module-orgs": minor\n---\n');
  await execFile("git", ["add", "."], { cwd: repoRoot });
  await execFile("git", ["commit", "-m", "feature"], { cwd: repoRoot });
  const { stdout: baseRef } = await execFile("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
  await fs.unlink(path.join(repoRoot, ".changeset", "release.md"));
  const result = await checkPackageChangesets({
    repoRoot,
    baseRef: baseRef.trim(),
    changedFiles: ["packages/module-orgs/package.json", ".changeset/release.md"],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.declaredPackages, ["@brightweblabs/module-orgs"]);
});

test("a Changesets version commit ignores metadata-only dependent bumps", async (t) => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bw-dependent-version-bump-"));
  t.after(() => fs.rm(repoRoot, { recursive: true, force: true }));
  await Promise.all([
    fs.mkdir(path.join(repoRoot, "packages", "module-projects"), { recursive: true }),
    fs.mkdir(path.join(repoRoot, "packages", "module-orgs"), { recursive: true }),
    fs.mkdir(path.join(repoRoot, ".changeset"), { recursive: true }),
  ]);
  await Promise.all([
    fs.writeFile(path.join(repoRoot, "packages", "module-projects", "package.json"), JSON.stringify({ name: "@brightweblabs/module-projects", private: false })),
    fs.writeFile(path.join(repoRoot, "packages", "module-orgs", "package.json"), JSON.stringify({ name: "@brightweblabs/module-orgs", private: false })),
  ]);
  await execFile("git", ["init"], { cwd: repoRoot });
  await execFile("git", ["config", "user.email", "test@example.com"], { cwd: repoRoot });
  await execFile("git", ["config", "user.name", "Test"], { cwd: repoRoot });
  await fs.writeFile(path.join(repoRoot, ".changeset", "release.md"), '---\n"@brightweblabs/module-projects": patch\n---\n');
  await execFile("git", ["add", "."], { cwd: repoRoot });
  await execFile("git", ["commit", "-m", "feature"], { cwd: repoRoot });
  const { stdout: baseRef } = await execFile("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
  await fs.unlink(path.join(repoRoot, ".changeset", "release.md"));

  const result = await checkPackageChangesets({
    repoRoot,
    baseRef: baseRef.trim(),
    changedFiles: [
      "packages/module-projects/package.json",
      "packages/module-projects/CHANGELOG.md",
      "packages/module-orgs/package.json",
      "packages/module-orgs/CHANGELOG.md",
      ".changeset/release.md",
    ],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.missing, []);
});

test("a consumed changeset does not hide unversioned package source changes", async (t) => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bw-version-source-change-"));
  t.after(() => fs.rm(repoRoot, { recursive: true, force: true }));
  await fs.mkdir(path.join(repoRoot, "packages", "create-bw-app", "src"), { recursive: true });
  await fs.mkdir(path.join(repoRoot, ".changeset"), { recursive: true });
  await fs.writeFile(path.join(repoRoot, "packages", "create-bw-app", "package.json"), JSON.stringify({ name: "create-bw-app", private: false }));
  await execFile("git", ["init"], { cwd: repoRoot });
  await execFile("git", ["config", "user.email", "test@example.com"], { cwd: repoRoot });
  await execFile("git", ["config", "user.name", "Test"], { cwd: repoRoot });
  await fs.writeFile(path.join(repoRoot, ".changeset", "release.md"), '---\n"@brightweblabs/module-projects": patch\n---\n');
  await execFile("git", ["add", "."], { cwd: repoRoot });
  await execFile("git", ["commit", "-m", "feature"], { cwd: repoRoot });
  const { stdout: baseRef } = await execFile("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
  await fs.unlink(path.join(repoRoot, ".changeset", "release.md"));

  const result = await checkPackageChangesets({
    repoRoot,
    baseRef: baseRef.trim(),
    changedFiles: [
      "packages/create-bw-app/package.json",
      "packages/create-bw-app/src/constants.mjs",
      ".changeset/release.md",
    ],
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ["create-bw-app"]);
});
