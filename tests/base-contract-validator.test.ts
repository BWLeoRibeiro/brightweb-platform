import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveImportPath, resolveModulePath } from "../scripts/validate-base-contract.mjs";

test("base-contract module resolution returns files for direct, extension, and index targets", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "base-contract-resolver-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "direct.ts"), "export const direct = true;\n");
  await fs.mkdir(path.join(root, "directory"));
  await fs.writeFile(path.join(root, "directory", "index.tsx"), "export const indexed = true;\n");
  await fs.mkdir(path.join(root, "empty-directory"));

  assert.equal(await resolveModulePath(path.join(root, "direct.ts")), path.join(root, "direct.ts"));
  assert.equal(await resolveImportPath(root, "./direct"), path.join(root, "direct.ts"));
  assert.equal(await resolveImportPath(root, "./direct.ts"), path.join(root, "direct.ts"));
  assert.equal(await resolveImportPath(root, "./directory"), path.join(root, "directory", "index.tsx"));
  await assert.rejects(
    () => resolveImportPath(root, "./empty-directory"),
    /Unable to resolve export path/,
  );
});
