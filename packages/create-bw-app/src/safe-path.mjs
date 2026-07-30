import path from "node:path";

const WINDOWS_DRIVE_PATH = /^[A-Za-z]:/;

export function normalizeSafeRelativePath(relativePath, label = "Path") {
  if (typeof relativePath !== "string" || relativePath.trim() === "") {
    throw new Error(`${label} must be a non-empty relative path.`);
  }

  const value = relativePath.trim();
  if (
    path.posix.isAbsolute(value)
    || path.win32.isAbsolute(value)
    || WINDOWS_DRIVE_PATH.test(value)
    || value.startsWith("\\\\")
  ) {
    throw new Error(`${label} must be relative to the target directory: ${relativePath}`);
  }

  const portablePath = value.replaceAll("\\", "/");
  if (portablePath.split("/").includes("..")) {
    throw new Error(`${label} must not contain parent-directory traversal: ${relativePath}`);
  }

  const normalized = path.posix.normalize(portablePath).replace(/^\.\//, "");
  if (normalized === "." || normalized === "") {
    throw new Error(`${label} must identify a path inside the target directory.`);
  }
  return normalized;
}

export function resolveSafeRelativePath(targetDir, relativePath, label = "Path") {
  const root = path.resolve(targetDir);
  const normalized = normalizeSafeRelativePath(relativePath, label);
  const resolved = path.resolve(root, ...normalized.split("/"));
  const relativeToRoot = path.relative(root, resolved);
  if (
    relativeToRoot === ""
    || relativeToRoot === ".."
    || relativeToRoot.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativeToRoot)
  ) {
    throw new Error(`${label} resolves outside the target directory: ${relativePath}`);
  }
  return resolved;
}
