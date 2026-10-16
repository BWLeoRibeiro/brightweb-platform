import fs from "node:fs/promises";
import path from "node:path";
import { normalizeSafeRelativePath } from "./safe-path.mjs";

// The caller-selected app root may be an alias (including macOS /var). Resolve
// that boundary once; links beneath it are never writable lifecycle targets.
// This preflight assumes no concurrent filesystem edits; it is not a sandbox.
export async function assertMutationTargets(targetDir, relativePaths) {
  const root = await fs.realpath(path.resolve(targetDir));
  if (!(await fs.stat(root)).isDirectory()) throw new Error("App root must be a directory.");
  for (const input of new Set(relativePaths)) {
    const relativePath = normalizeSafeRelativePath(input, "Mutation target");
    let current = root;
    const parts = relativePath.split("/");
    for (const [index, part] of parts.entries()) {
      current = path.join(current, part);
      const stat = await fs.lstat(current).catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      if (!stat) break;
      if (stat.isSymbolicLink()) throw new Error(`Lifecycle writes do not follow symlinks: ${relativePath}`);
      if (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile()) {
        throw new Error(`Unexpected filesystem type at mutation target: ${relativePath}`);
      }
    }
  }
}
