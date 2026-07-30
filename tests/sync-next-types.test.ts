import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const syncScriptPath = path.join(repoRoot, "scripts", "sync-next-types.mjs");

async function withTemporaryApp(run: (appDir: string) => Promise<void>) {
  const appDir = await mkdtemp(path.join(tmpdir(), "bw-sync-next-types-"));
  try {
    await run(appDir);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
}

function syncRouteTypes(appDir: string) {
  execFileSync(process.execPath, [syncScriptPath, appDir], {
    cwd: repoRoot,
    stdio: "pipe",
  });
}

test("preserves route types generated directly by next typegen", async () => {
  await withTemporaryApp(async (appDir) => {
    const targetDir = path.join(appDir, ".next", "types");
    await mkdir(targetDir, { recursive: true });
    await writeFile(path.join(targetDir, "routes.d.ts"), "fresh typegen routes");

    syncRouteTypes(appDir);

    assert.equal(
      await readFile(path.join(targetDir, "routes.d.ts"), "utf8"),
      "fresh typegen routes",
    );
  });
});

test("copies dev route types when no typegen output exists", async () => {
  await withTemporaryApp(async (appDir) => {
    const sourceDir = path.join(appDir, ".next", "dev", "types");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(path.join(sourceDir, "routes.d.ts"), "dev routes");

    syncRouteTypes(appDir);

    assert.equal(
      await readFile(path.join(appDir, ".next", "types", "routes.d.ts"), "utf8"),
      "dev routes",
    );
  });
});
