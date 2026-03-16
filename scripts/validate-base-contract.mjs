import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const manifestPath = path.join(repoRoot, "docs", "modules", "base-contract.json");
const splitManifestIndexPath = path.join(repoRoot, "docs", "modules", "base-contract", "index.json");
const allowedKinds = new Set(["helper", "handler", "registration", "hook", "shared-helper"]);
const allowedStatuses = new Set(["stable", "starter", "internal"]);
const allowedRuntimes = new Set(["server", "client", "shared", "shell"]);

async function main() {
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  if (!Array.isArray(manifest)) {
    throw new Error("Base contract manifest must be a JSON array.");
  }

  const packageMap = await loadPackageMap();
  const seen = new Set();
  const knownSymbols = new Set();

  for (const [index, entry] of manifest.entries()) {
    validateManifestEntry(entry, index);
    knownSymbols.add(entry.symbol);

    const duplicateKey = `${entry.packageName}::${entry.symbol}`;
    if (seen.has(duplicateKey)) {
      throw new Error(`Duplicate base contract entry "${duplicateKey}".`);
    }
    seen.add(duplicateKey);

    const sourcePath = path.join(repoRoot, entry.source);
    await assertPathExists(sourcePath, `Missing source for manifest entry "${duplicateKey}"`);

    const exportNames = await getExportNamesForSpecifier(entry.packageName, packageMap);
    if (!exportNames.has(entry.symbol)) {
      throw new Error(`Symbol "${entry.symbol}" is not exported from "${entry.packageName}".`);
    }
  }

  for (const [index, entry] of manifest.entries()) {
    for (const field of ["buildOn", "replaces"]) {
      for (const symbol of entry[field] ?? []) {
        if (!knownSymbols.has(symbol)) {
          throw new Error(`Invalid manifest entry at index ${index}: "${field}" references unknown symbol "${symbol}".`);
        }
      }
    }
  }

  await validateSplitManifestIndex(manifest);
  await validateDocsLinks(path.join(repoRoot, "docs", "modules"));

  console.log(`Validated ${manifest.length} base contract entries.`);
}

async function validateSplitManifestIndex(fullManifest) {
  const index = JSON.parse(await fs.readFile(splitManifestIndexPath, "utf8"));
  if (!index || typeof index !== "object" || Array.isArray(index)) {
    throw new Error("Split base contract index must be an object.");
  }

  if (index.version !== 1) {
    throw new Error("Split base contract index must declare version 1.");
  }

  if (index.canonicalManifest !== "../base-contract.json") {
    throw new Error("Split base contract index must point to ../base-contract.json.");
  }

  if (!Array.isArray(index.moduleFiles) || index.moduleFiles.length === 0) {
    throw new Error("Split base contract index must include moduleFiles.");
  }

  const grouped = groupEntriesByModule(fullManifest);
  const seenModuleKeys = new Set();

  for (const descriptor of index.moduleFiles) {
    validateSplitIndexDescriptor(descriptor);

    if (seenModuleKeys.has(descriptor.moduleKey)) {
      throw new Error(`Duplicate split manifest descriptor for "${descriptor.moduleKey}".`);
    }
    seenModuleKeys.add(descriptor.moduleKey);

    const relativeFilePath = path.join("docs", "modules", "base-contract", descriptor.file);
    const moduleFilePath = path.join(repoRoot, relativeFilePath);
    await assertPathExists(moduleFilePath, `Missing split manifest file "${relativeFilePath}".`);

    const docPath = path.resolve(path.dirname(splitManifestIndexPath), descriptor.doc);
    await assertPathExists(docPath, `Missing split manifest doc "${descriptor.doc}" for "${descriptor.moduleKey}".`);

    const moduleManifest = JSON.parse(await fs.readFile(moduleFilePath, "utf8"));
    if (!Array.isArray(moduleManifest)) {
      throw new Error(`Split manifest "${descriptor.file}" must be a JSON array.`);
    }

    const expectedEntries = grouped.get(descriptor.moduleKey) ?? [];
    if (descriptor.entryCount !== expectedEntries.length) {
      throw new Error(`Split manifest "${descriptor.file}" entryCount does not match the canonical manifest.`);
    }

    if (JSON.stringify(moduleManifest) !== JSON.stringify(expectedEntries)) {
      throw new Error(`Split manifest "${descriptor.file}" does not match the canonical entries for "${descriptor.moduleKey}".`);
    }
  }

  for (const moduleKey of grouped.keys()) {
    if (!seenModuleKeys.has(moduleKey)) {
      throw new Error(`Canonical manifest module "${moduleKey}" is missing from the split manifest index.`);
    }
  }
}

function validateSplitIndexDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) {
    throw new Error("Split manifest descriptors must be objects.");
  }

  for (const field of ["moduleKey", "title", "file", "doc", "summary"]) {
    if (typeof descriptor[field] !== "string" || descriptor[field].trim().length === 0) {
      throw new Error(`Split manifest descriptor field "${field}" must be a non-empty string.`);
    }
  }

  if (!Number.isInteger(descriptor.entryCount) || descriptor.entryCount < 0) {
    throw new Error(`Split manifest descriptor "${descriptor.moduleKey}" must have a non-negative integer entryCount.`);
  }
}

function groupEntriesByModule(entries) {
  const grouped = new Map();
  for (const entry of entries) {
    const bucket = grouped.get(entry.moduleKey) ?? [];
    bucket.push(entry);
    grouped.set(entry.moduleKey, bucket);
  }
  return grouped;
}

function validateManifestEntry(entry, index) {
  const prefix = `Invalid manifest entry at index ${index}`;
  const requiredStringFields = ["moduleKey", "packageName", "symbol", "kind", "status", "runtime", "summary", "auth", "source"];

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`${prefix}: entry must be an object.`);
  }

  for (const field of requiredStringFields) {
    if (typeof entry[field] !== "string" || entry[field].trim().length === 0) {
      throw new Error(`${prefix}: "${field}" must be a non-empty string.`);
    }
  }

  if (!Array.isArray(entry.notes) || entry.notes.some((value) => typeof value !== "string")) {
    throw new Error(`${prefix}: "notes" must be an array of strings.`);
  }

  if (!Array.isArray(entry.inputs)) {
    throw new Error(`${prefix}: "inputs" must be an array.`);
  }
  entry.inputs.forEach((value, inputIndex) => validateInputDescriptor(value, `${prefix}: inputs[${inputIndex}]`));

  if (!Array.isArray(entry.outputs)) {
    throw new Error(`${prefix}: "outputs" must be an array.`);
  }
  entry.outputs.forEach((value, outputIndex) => validateOutputDescriptor(value, `${prefix}: outputs[${outputIndex}]`));

  if (!allowedKinds.has(entry.kind)) {
    throw new Error(`${prefix}: unsupported kind "${entry.kind}".`);
  }
  if (!allowedStatuses.has(entry.status)) {
    throw new Error(`${prefix}: unsupported status "${entry.status}".`);
  }
  if (!allowedRuntimes.has(entry.runtime)) {
    throw new Error(`${prefix}: unsupported runtime "${entry.runtime}".`);
  }

  if (entry.examples !== undefined) {
    if (!Array.isArray(entry.examples)) {
      throw new Error(`${prefix}: "examples" must be an array when provided.`);
    }
    for (const [exampleIndex, example] of entry.examples.entries()) {
      if (!example || typeof example !== "object" || Array.isArray(example)) {
        throw new Error(`${prefix}: examples[${exampleIndex}] must be an object.`);
      }
      for (const field of ["label", "code"]) {
        if (typeof example[field] !== "string" || example[field].trim().length === 0) {
          throw new Error(`${prefix}: examples[${exampleIndex}].${field} must be a non-empty string.`);
        }
      }
    }
  }

  for (const field of ["buildOn", "replaces"]) {
    if (entry[field] !== undefined) {
      if (!Array.isArray(entry[field]) || entry[field].some((value) => typeof value !== "string" || value.trim().length === 0)) {
        throw new Error(`${prefix}: "${field}" must be an array of non-empty strings when provided.`);
      }
    }
  }

  if (entry.http !== undefined) {
    validateHttpDescriptor(entry.http, `${prefix}: http`);
  }
}

function validateInputDescriptor(descriptor, prefix) {
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) {
    throw new Error(`${prefix} must be an object.`);
  }

  for (const field of ["name", "type", "description"]) {
    if (typeof descriptor[field] !== "string" || descriptor[field].trim().length === 0) {
      throw new Error(`${prefix}.${field} must be a non-empty string.`);
    }
  }

  if (typeof descriptor.required !== "boolean") {
    throw new Error(`${prefix}.required must be a boolean.`);
  }
}

function validateOutputDescriptor(descriptor, prefix) {
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) {
    throw new Error(`${prefix} must be an object.`);
  }

  for (const field of ["type", "description"]) {
    if (typeof descriptor[field] !== "string" || descriptor[field].trim().length === 0) {
      throw new Error(`${prefix}.${field} must be a non-empty string.`);
    }
  }
}

function validateHttpDescriptor(descriptor, prefix) {
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) {
    throw new Error(`${prefix} must be an object.`);
  }

  for (const field of ["method", "path"]) {
    if (typeof descriptor[field] !== "string" || descriptor[field].trim().length === 0) {
      throw new Error(`${prefix}.${field} must be a non-empty string.`);
    }
  }

  for (const field of ["query", "body"]) {
    if (!Array.isArray(descriptor[field])) {
      throw new Error(`${prefix}.${field} must be an array.`);
    }
    descriptor[field].forEach((value, index) => validateInputDescriptor(value, `${prefix}.${field}[${index}]`));
  }

  for (const field of ["success", "errors"]) {
    if (!Array.isArray(descriptor[field])) {
      throw new Error(`${prefix}.${field} must be an array.`);
    }
    descriptor[field].forEach((value, index) => validateOutputDescriptor(value, `${prefix}.${field}[${index}]`));
  }
}

async function loadPackageMap() {
  const packagesDir = path.join(repoRoot, "packages");
  const dirents = await fs.readdir(packagesDir, { withFileTypes: true });
  const packageMap = new Map();

  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;

    const packageDir = path.join(packagesDir, dirent.name);
    const packageJsonPath = path.join(packageDir, "package.json");
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
      if (typeof packageJson.name === "string" && packageJson.exports) {
        packageMap.set(packageJson.name, { dir: packageDir, exports: packageJson.exports });
      }
    } catch {
      continue;
    }
  }

  return packageMap;
}

async function getExportNamesForSpecifier(specifier, packageMap) {
  const packageName = Array.from(packageMap.keys())
    .sort((left, right) => right.length - left.length)
    .find((candidate) => specifier === candidate || specifier.startsWith(`${candidate}/`));

  if (!packageName) {
    throw new Error(`Unknown package specifier "${specifier}".`);
  }

  const packageInfo = packageMap.get(packageName);
  const subpath = specifier === packageName ? "." : `.${specifier.slice(packageName.length)}`;
  const exportTarget = packageInfo.exports[subpath];

  if (typeof exportTarget !== "string") {
    throw new Error(`Package export "${specifier}" is not mapped to a string file target.`);
  }

  const entrypointPath = path.join(packageInfo.dir, exportTarget);
  return collectRuntimeExports(entrypointPath, new Map());
}

async function collectRuntimeExports(filePath, cache) {
  const normalizedPath = await resolveModulePath(filePath);
  if (cache.has(normalizedPath)) {
    return cache.get(normalizedPath);
  }

  const exportNames = new Set();
  cache.set(normalizedPath, exportNames);

  const source = await fs.readFile(normalizedPath, "utf8");

  for (const match of source.matchAll(/^\s*export\s+(?:const|let|var|async\s+function|function|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    exportNames.add(match[1]);
  }

  for (const match of source.matchAll(/^\s*export\s*\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+)["']/gm)) {
    exportNames.add(match[1]);
  }

  for (const match of source.matchAll(/^\s*export\s*{\s*([^}]+)\s*}(?:\s*from\s*["']([^"']+)["'])?/gms)) {
    const names = match[1]
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value) => !value.startsWith("type "));

    for (const name of names) {
      const aliasMatch = name.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      exportNames.add(aliasMatch ? aliasMatch[2] : name);
    }
  }

  for (const match of source.matchAll(/^\s*export\s*\*\s*from\s*["']([^"']+)["']/gm)) {
    const starPath = await resolveImportPath(path.dirname(normalizedPath), match[1]);
    const childExports = await collectRuntimeExports(starPath, cache);
    for (const name of childExports) {
      exportNames.add(name);
    }
  }

  return exportNames;
}

async function resolveModulePath(filePath) {
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
  await assertPathExists(resolved, `Missing module file "${resolved}"`);
  return resolved;
}

async function resolveImportPath(fromDir, specifier) {
  const candidates = [
    specifier,
    `${specifier}.ts`,
    `${specifier}.tsx`,
    `${specifier}.js`,
    `${specifier}.mjs`,
    path.join(specifier, "index.ts"),
    path.join(specifier, "index.tsx"),
    path.join(specifier, "index.js"),
    path.join(specifier, "index.mjs"),
  ];

  for (const candidate of candidates) {
    const absolutePath = path.resolve(fromDir, candidate);
    try {
      await fs.access(absolutePath);
      return absolutePath;
    } catch {
      continue;
    }
  }

  throw new Error(`Unable to resolve export path "${specifier}" from "${fromDir}".`);
}

async function validateDocsLinks(docsDir) {
  const docFiles = (await fs.readdir(docsDir))
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => path.join(docsDir, fileName));

  for (const docFile of docFiles) {
    const source = await fs.readFile(docFile, "utf8");
    for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const linkTarget = match[1].trim();
      if (!linkTarget || linkTarget.startsWith("#") || /^[a-z]+:/i.test(linkTarget)) {
        continue;
      }

      const cleanTarget = linkTarget.split("#")[0].split("?")[0];
      const resolved = path.resolve(path.dirname(docFile), cleanTarget);
      await assertPathExists(resolved, `Broken docs link "${linkTarget}" in "${path.relative(repoRoot, docFile)}"`);
    }
  }
}

async function assertPathExists(targetPath, errorMessage) {
  try {
    await fs.access(targetPath);
  } catch {
    throw new Error(errorMessage);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
