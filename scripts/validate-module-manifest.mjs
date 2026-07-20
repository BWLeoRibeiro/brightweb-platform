import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const packagesDir = path.join(repoRoot, "packages");
const registryPath = path.join(repoRoot, "supabase", "module-registry.json");
const schemaPath = path.join(repoRoot, "docs", "modules", "module-manifest.schema.json");

const moduleKeyPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const capabilityPattern = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9_-]*\.(read|write|admin)$/;
const eventPattern = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9_-]*\.[a-z][a-z0-9_]*$/;
const permissionPattern = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9_-]+$/;
const surfaces = new Set(["all", "staff", "admin"]);
const healthKinds = new Set(["db-objects", "package-exports", "env", "route-mounted", "migration-cursor"]);

async function main() {
  const errors = [];
  await readJson(schemaPath, "module manifest schema", errors);
  const registry = await readJson(registryPath, "module registry", errors);
  const packageEntries = await loadModulePackages(errors);

  for (const entry of packageEntries) {
    entry.manifest = await readJson(entry.manifestPath, `manifest for ${entry.packageJson.name}`, errors);
    if (entry.manifest) {
      validateManifestShape(entry.manifest, entry.packageJson.name, errors);
    }
  }

  const validEntries = packageEntries.filter((entry) => entry.manifest && typeof entry.manifest.key === "string");
  validateReferences(validEntries, registry, errors);
  validateDependencyGraph(validEntries, registry, errors);
  validateRegistryParity(validEntries, registry, errors);
  await validateManifestPaths(validEntries, errors);
  await validateCapabilityExports(validEntries, errors);
  validateDatabaseOwnership(validEntries, errors);
  await validatePayloadSchemas(validEntries, errors);

  if (errors.length > 0) {
    console.error(`Module manifest validation failed with ${errors.length} error${errors.length === 1 ? "" : "s"}:`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Validated ${validEntries.length} module manifests against the v1 contract.`);
}

async function loadModulePackages(errors) {
  const dirents = await fs.readdir(packagesDir, { withFileTypes: true });
  const packageEntries = [];

  for (const dirent of dirents.filter((entry) => entry.isDirectory() && entry.name.startsWith("module-")).sort((a, b) => a.name.localeCompare(b.name))) {
    const packageDir = path.join(packagesDir, dirent.name);
    const packageJsonPath = path.join(packageDir, "package.json");
    const packageJson = await readJson(packageJsonPath, `${dirent.name} package.json`, errors);
    if (!packageJson) continue;

    const manifestPath = path.join(packageDir, "brightweb.module.json");
    if (!(await pathExists(manifestPath))) {
      errors.push(`${packageJson.name ?? dirent.name}: missing brightweb.module.json at the package root.`);
      continue;
    }

    packageEntries.push({ packageDir, packageJson, manifestPath });
  }

  return packageEntries;
}

function validateManifestShape(manifest, packageName, errors) {
  const location = `${packageName} manifest`;
  if (!validateObject(manifest, location, [
    "$comment", "contractVersion", "key", "title", "description", "requires", "capabilities", "capabilityExports",
    "events", "permissions", "registration", "database", "integrations", "tokens", "scaffold", "env", "jobs", "health", "upgrade",
  ], ["contractVersion", "key", "title", "description", "requires", "capabilities", "events", "permissions", "registration", "database"], errors)) return;

  if (manifest.$comment !== undefined) validateNonEmptyString(manifest.$comment, `${location}.$comment`, errors);
  if (manifest.contractVersion !== 1) errors.push(`${location}.contractVersion must equal 1.`);
  validatePatternString(manifest.key, moduleKeyPattern, `${location}.key`, "a kebab-case module key", errors);
  validateNonEmptyString(manifest.title, `${location}.title`, errors);
  validateNonEmptyString(manifest.description, `${location}.description`, errors);
  validateSemverRangeMap(manifest.requires, `${location}.requires`, errors);
  validateCapabilities(manifest.capabilities, `${location}.capabilities`, errors);
  if (manifest.capabilityExports !== undefined) validateCapabilityExportMap(manifest.capabilityExports, `${location}.capabilityExports`, errors);
  validateEvents(manifest.events, `${location}.events`, errors);
  validatePermissions(manifest.permissions, `${location}.permissions`, errors);
  validateNonEmptyString(manifest.registration, `${location}.registration`, errors);
  validateDatabase(manifest.database, `${location}.database`, errors);
  if (manifest.integrations !== undefined) validateIntegrations(manifest.integrations, `${location}.integrations`, errors);
  for (const field of ["tokens", "scaffold"]) {
    if (manifest[field] !== undefined) validateNonEmptyString(manifest[field], `${location}.${field}`, errors);
  }
  if (manifest.env !== undefined) validateObjectArray(manifest.env, `${location}.env`, errors, (entry, itemLocation) => {
    if (!validateObject(entry, itemLocation, ["name", "required", "usedFor"], ["name", "required"], errors)) return;
    validateNonEmptyString(entry.name, `${itemLocation}.name`, errors);
    if (typeof entry.required !== "boolean") errors.push(`${itemLocation}.required must be a boolean.`);
    if (entry.usedFor !== undefined) validateNonEmptyString(entry.usedFor, `${itemLocation}.usedFor`, errors);
  });
  if (manifest.jobs !== undefined) validateObjectArray(manifest.jobs, `${location}.jobs`, errors, (entry, itemLocation) => {
    if (!validateObject(entry, itemLocation, ["name", "route", "kind"], ["name", "route"], errors)) return;
    validateNonEmptyString(entry.name, `${itemLocation}.name`, errors);
    validateNonEmptyString(entry.route, `${itemLocation}.route`, errors);
    if (entry.kind !== undefined) validateNonEmptyString(entry.kind, `${itemLocation}.kind`, errors);
  });
  if (manifest.health !== undefined) validateObjectArray(manifest.health, `${location}.health`, errors, (entry, itemLocation) => {
    if (!validateObject(entry, itemLocation, ["id", "kind"], ["id", "kind"], errors)) return;
    validateNonEmptyString(entry.id, `${itemLocation}.id`, errors);
    if (!healthKinds.has(entry.kind)) errors.push(`${itemLocation}.kind must be one of: ${Array.from(healthKinds).join(", ")}.`);
  });
  if (manifest.upgrade !== undefined && validateObject(manifest.upgrade, `${location}.upgrade`, ["breaking", "downMigrations"], [], errors)) {
    for (const field of ["breaking", "downMigrations"]) {
      if (manifest.upgrade[field] !== undefined && typeof manifest.upgrade[field] !== "boolean") {
        errors.push(`${location}.upgrade.${field} must be a boolean.`);
      }
    }
  }
}

function validateCapabilities(value, location, errors) {
  if (!validateObject(value, location, ["provides", "consumes"], ["provides", "consumes"], errors)) return;
  for (const field of ["provides", "consumes"]) {
    validateObjectArray(value[field], `${location}.${field}`, errors, (entry, itemLocation) => {
      if (!validateObject(entry, itemLocation, ["name", "since"], ["name", "since"], errors)) return;
      validatePatternString(entry.name, capabilityPattern, `${itemLocation}.name`, "a valid capability name", errors);
      validateNonEmptyString(entry.since, `${itemLocation}.since`, errors);
    });
  }
}

function validateCapabilityExportMap(value, location, errors) {
  if (!validateMap(value, location, errors)) return;
  for (const [name, descriptor] of Object.entries(value)) {
    validatePatternString(name, capabilityPattern, `${location} key "${name}"`, "a valid capability name", errors);
    const itemLocation = `${location}[${JSON.stringify(name)}]`;
    if (!validateObject(descriptor, itemLocation, ["specifier", "symbol"], ["specifier", "symbol"], errors)) continue;
    validateNonEmptyString(descriptor.specifier, `${itemLocation}.specifier`, errors);
    validateNonEmptyString(descriptor.symbol, `${itemLocation}.symbol`, errors);
  }
}

function validateEvents(value, location, errors) {
  if (!validateObject(value, location, ["emits", "consumes"], ["emits", "consumes"], errors)) return;
  for (const field of ["emits", "consumes"]) {
    validateObjectArray(value[field], `${location}.${field}`, errors, (entry, itemLocation) => {
      const allowed = field === "emits" ? ["name", "since", "payloadSchema"] : ["name", "since"];
      if (!validateObject(entry, itemLocation, allowed, ["name", "since"], errors)) return;
      validatePatternString(entry.name, eventPattern, `${itemLocation}.name`, "a valid event name", errors);
      validateNonEmptyString(entry.since, `${itemLocation}.since`, errors);
      if (entry.payloadSchema !== undefined) validateNonEmptyString(entry.payloadSchema, `${itemLocation}.payloadSchema`, errors);
    });
  }
}

function validatePermissions(value, location, errors) {
  if (!validateObject(value, location, ["surfaces", "grants"], ["surfaces", "grants"], errors)) return;
  if (!surfaces.has(value.surfaces)) errors.push(`${location}.surfaces must be one of: all, staff, admin.`);
  validateObjectArray(value.grants, `${location}.grants`, errors, (entry, itemLocation) => {
    if (!validateObject(entry, itemLocation, ["name", "description", "defaultRoles"], ["name", "defaultRoles"], errors)) return;
    validatePatternString(entry.name, permissionPattern, `${itemLocation}.name`, "a valid permission name", errors);
    if (entry.description !== undefined) validateNonEmptyString(entry.description, `${itemLocation}.description`, errors);
    validateStringArray(entry.defaultRoles, `${itemLocation}.defaultRoles`, errors);
  });
}

function validateDatabase(value, location, errors) {
  if (!validateObject(value, location, ["namespace", "ownedObjects", "integrationObjects", "migrations"], ["namespace", "ownedObjects"], errors)) return;
  validateStringArray(value.namespace, `${location}.namespace`, errors);
  validateStringArray(value.ownedObjects, `${location}.ownedObjects`, errors);
  if (value.integrationObjects !== undefined) validateStringArray(value.integrationObjects, `${location}.integrationObjects`, errors);
  if (value.migrations !== undefined) validateNonEmptyString(value.migrations, `${location}.migrations`, errors);
}

function validateIntegrations(value, location, errors) {
  if (!validateMap(value, location, errors)) return;
  for (const [key, integration] of Object.entries(value)) {
    validatePatternString(key, moduleKeyPattern, `${location} key "${key}"`, "a kebab-case module key", errors);
    const itemLocation = `${location}[${JSON.stringify(key)}]`;
    if (!validateObject(integration, itemLocation, ["description", "consumes", "provides", "events"], [], errors)) continue;
    if (integration.description !== undefined) validateNonEmptyString(integration.description, `${itemLocation}.description`, errors);
    for (const field of ["consumes", "provides"]) {
      if (integration[field] !== undefined) validatePatternArray(integration[field], `${itemLocation}.${field}`, capabilityPattern, "capability", errors);
    }
    if (integration.events !== undefined) validatePatternArray(integration.events, `${itemLocation}.events`, eventPattern, "event", errors);
  }
}

function validateReferences(entries, registry, errors) {
  const manifestKeys = new Set();
  const registryKeys = new Set(Object.keys(registry?.modules ?? {}));
  for (const entry of entries) {
    if (manifestKeys.has(entry.manifest.key)) errors.push(`Duplicate module manifest key "${entry.manifest.key}".`);
    manifestKeys.add(entry.manifest.key);
  }
  const knownKeys = new Set([...manifestKeys, ...registryKeys]);
  for (const entry of entries) {
    for (const key of [...Object.keys(entry.manifest.requires ?? {}), ...Object.keys(entry.manifest.integrations ?? {})]) {
      if (!knownKeys.has(key)) errors.push(`${entry.packageJson.name}: references unknown module key "${key}".`);
    }
  }
}

function validateDependencyGraph(entries, registry, errors) {
  const graph = new Map(entries.map((entry) => [entry.manifest.key, Object.keys(entry.manifest.requires ?? {})]));
  if (registry?.modules?.core) graph.set("core", registry.modules.core.dependsOn ?? []);
  const visiting = [];
  const visited = new Set();
  let cycleFound = false;

  function visit(key) {
    if (visited.has(key) || cycleFound) return;
    const cycleIndex = visiting.indexOf(key);
    if (cycleIndex >= 0) {
      errors.push(`Circular module dependency detected: ${[...visiting.slice(cycleIndex), key].join(" -> ")}.`);
      cycleFound = true;
      return;
    }
    visiting.push(key);
    for (const dependency of graph.get(key) ?? []) {
      if (graph.has(dependency)) visit(dependency);
    }
    visiting.pop();
    visited.add(key);
  }

  for (const key of graph.keys()) visit(key);
}

function validateRegistryParity(entries, registry, errors) {
  for (const entry of entries) {
    const registryModule = registry?.modules?.[entry.manifest.key];
    if (!registryModule) continue;
    const manifestDependencies = Object.keys(entry.manifest.requires ?? {}).sort();
    const registryDependencies = [...(registryModule.dependsOn ?? [])].sort();
    if (JSON.stringify(manifestDependencies) !== JSON.stringify(registryDependencies)) {
      errors.push(`${entry.packageJson.name}: manifest requires [${manifestDependencies.join(", ")}] do not match registry dependsOn [${registryDependencies.join(", ")}].`);
    }
  }
}

async function validateManifestPaths(entries, errors) {
  for (const entry of entries) {
    for (const field of ["registration", "tokens", "scaffold"]) {
      if (entry.manifest[field] !== undefined) await validatePackagePath(entry, field, entry.manifest[field], errors);
    }
    if (entry.manifest.database?.migrations !== undefined) {
      await validatePackagePath(entry, "database.migrations", entry.manifest.database.migrations, errors);
    }
  }
}

async function validatePackagePath(entry, field, target, errors) {
  if (typeof target !== "string") return;
  const directPath = path.resolve(entry.packageDir, target);
  const exportsMap = entry.packageJson.exports;
  const exportTarget = exportsMap && typeof exportsMap === "object" ? exportsMap[target] : undefined;
  const exportedPath = typeof exportTarget === "string" ? path.resolve(entry.packageDir, exportTarget) : null;
  const exported = exportedPath ? await pathExists(exportedPath) : false;
  if (!(await pathExists(directPath)) && !exported) {
    errors.push(`${entry.packageJson.name}: ${field} path "${target}" does not exist and is not a package export subpath.`);
  }
}

async function validateCapabilityExports(entries, errors) {
  for (const entry of entries) {
    const providedCapabilities = Array.isArray(entry.manifest.capabilities?.provides) ? entry.manifest.capabilities.provides : [];
    const providedNames = new Set(providedCapabilities
      .map((capability) => capability && typeof capability === "object" ? capability.name : undefined)
      .filter((name) => typeof name === "string"));
    const mappings = entry.manifest.capabilityExports ?? {};
    for (const name of providedNames) {
      if (!mappings[name]) errors.push(`${entry.packageJson.name}: capability "${name}" is missing a capabilityExports mapping.`);
    }
    for (const [name, mapping] of Object.entries(mappings)) {
      if (!providedNames.has(name)) errors.push(`${entry.packageJson.name}: capabilityExports maps unprovided capability "${name}".`);
      if (!mapping || typeof mapping.specifier !== "string" || typeof mapping.symbol !== "string") continue;
      try {
        const exportNames = await getExportNamesForSpecifier(entry, mapping.specifier);
        if (!exportNames.has(mapping.symbol)) {
          errors.push(`${entry.packageJson.name}: symbol "${mapping.symbol}" is not exported from "${mapping.specifier}" for capability "${name}".`);
        }
      } catch (error) {
        errors.push(`${entry.packageJson.name}: cannot validate capability "${name}": ${error instanceof Error ? error.message : error}`);
      }
    }
  }
}

function validateDatabaseOwnership(entries, errors) {
  const ownedObjects = new Map();
  const integrationObjects = new Map();
  const namespaces = new Map();
  for (const entry of entries) {
    const moduleOwnedObjects = Array.isArray(entry.manifest.database?.ownedObjects) ? entry.manifest.database.ownedObjects : [];
    const moduleIntegrationObjects = Array.isArray(entry.manifest.database?.integrationObjects) ? entry.manifest.database.integrationObjects : [];
    const moduleNamespaces = Array.isArray(entry.manifest.database?.namespace) ? entry.manifest.database.namespace : [];
    for (const objectName of moduleOwnedObjects) {
      const owner = ownedObjects.get(objectName);
      if (owner && owner !== entry.manifest.key) errors.push(`Database object "${objectName}" is owned by both "${owner}" and "${entry.manifest.key}".`);
      ownedObjects.set(objectName, entry.manifest.key);
    }
    for (const objectName of moduleIntegrationObjects) {
      const author = integrationObjects.get(objectName);
      if (author && author !== entry.manifest.key) errors.push(`Database integration object "${objectName}" is authored by both "${author}" and "${entry.manifest.key}".`);
      integrationObjects.set(objectName, entry.manifest.key);
    }
    for (const namespace of moduleNamespaces) {
      const owner = namespaces.get(namespace);
      if (owner && owner !== entry.manifest.key) errors.push(`Database namespace prefix "${namespace}" is claimed by both "${owner}" and "${entry.manifest.key}".`);
      namespaces.set(namespace, entry.manifest.key);
    }
  }
}

async function validatePayloadSchemas(entries, errors) {
  for (const entry of entries) {
    const emittedEvents = Array.isArray(entry.manifest.events?.emits) ? entry.manifest.events.emits : [];
    for (const event of emittedEvents) {
      if (!event || typeof event !== "object" || !event.payloadSchema || typeof event.payloadSchema !== "string") continue;
      const payloadPath = path.resolve(entry.packageDir, event.payloadSchema);
      if (!(await pathExists(payloadPath))) {
        errors.push(`${entry.packageJson.name}: payload schema "${event.payloadSchema}" for event "${event.name}" does not exist.`);
        continue;
      }
      await readJson(payloadPath, `payload schema for event "${event.name}"`, errors);
    }
  }
}

async function getExportNamesForSpecifier(entry, specifier) {
  const subpath = specifier === entry.packageJson.name ? "." : specifier.startsWith(`${entry.packageJson.name}/`)
    ? `.${specifier.slice(entry.packageJson.name.length)}`
    : specifier;
  const exportTarget = entry.packageJson.exports?.[subpath];
  if (typeof exportTarget !== "string") throw new Error(`package export "${specifier}" is not mapped to a string file target.`);
  return collectRuntimeExports(path.join(entry.packageDir, exportTarget), new Map());
}

async function collectRuntimeExports(filePath, cache) {
  const normalizedPath = await resolveModulePath(filePath);
  if (cache.has(normalizedPath)) return cache.get(normalizedPath);
  const exportNames = new Set();
  cache.set(normalizedPath, exportNames);
  const source = await fs.readFile(normalizedPath, "utf8");

  for (const match of source.matchAll(/^\s*export\s+(?:const|let|var|async\s+function|function|class)\s+([A-Za-z_$][\w$]*)/gm)) exportNames.add(match[1]);
  for (const match of source.matchAll(/^\s*export\s*\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+)["']/gm)) exportNames.add(match[1]);
  for (const match of source.matchAll(/^\s*export\s*{\s*([^}]+)\s*}(?:\s*from\s*["']([^"']+)["'])?/gms)) {
    for (const name of match[1].split(",").map((value) => value.trim()).filter(Boolean).filter((value) => !value.startsWith("type "))) {
      const aliasMatch = name.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      exportNames.add(aliasMatch ? aliasMatch[2] : name);
    }
  }
  for (const match of source.matchAll(/^\s*export\s*\*\s*from\s*["']([^"']+)["']/gm)) {
    const childExports = await collectRuntimeExports(await resolveImportPath(path.dirname(normalizedPath), match[1]), cache);
    for (const name of childExports) exportNames.add(name);
  }
  return exportNames;
}

async function resolveModulePath(filePath) {
  if (!(await pathExists(filePath))) throw new Error(`missing module file "${path.relative(repoRoot, filePath)}".`);
  return filePath;
}

async function resolveImportPath(fromDir, specifier) {
  for (const candidate of [specifier, `${specifier}.ts`, `${specifier}.tsx`, `${specifier}.js`, `${specifier}.mjs`, path.join(specifier, "index.ts")]) {
    const absolutePath = path.resolve(fromDir, candidate);
    if (await pathExists(absolutePath)) return absolutePath;
  }
  throw new Error(`unable to resolve export path "${specifier}" from "${path.relative(repoRoot, fromDir)}".`);
}

function validateObject(value, location, allowed, required, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${location} must be an object.`);
    return false;
  }
  for (const field of required) if (!Object.hasOwn(value, field)) errors.push(`${location} is missing required field "${field}".`);
  for (const field of Object.keys(value)) if (!allowed.includes(field)) errors.push(`${location} contains unsupported field "${field}".`);
  return true;
}

function validateMap(value, location, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${location} must be an object.`);
    return false;
  }
  return true;
}

function validateSemverRangeMap(value, location, errors) {
  if (!validateMap(value, location, errors)) return;
  for (const [key, item] of Object.entries(value)) {
    validatePatternString(key, moduleKeyPattern, `${location} key "${key}"`, "a kebab-case module key", errors);
    if (!isSemverRange(item)) errors.push(`${location}[${JSON.stringify(key)}] must be a semver range; received ${JSON.stringify(item)}.`);
  }
}

function isSemverRange(value) {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  const partialVersion = String.raw`(?:v?(?:0|[1-9]\d*|[xX*])(?:\.(?:0|[1-9]\d*|[xX*])){0,2}(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)`;
  const comparator = new RegExp(`^(?:<=|>=|<|>|=|~|\\^)?${partialVersion}$`);
  const hyphenRange = new RegExp(`^${partialVersion}\\s+-\\s+${partialVersion}$`);

  return value.trim().split(/\s*\|\|\s*/).every((alternative) => {
    if (alternative === "*" || hyphenRange.test(alternative)) return true;
    return alternative.split(/\s+/).every((token) => comparator.test(token));
  });
}

function validateObjectArray(value, location, errors, validateItem) {
  if (!Array.isArray(value)) {
    errors.push(`${location} must be an array.`);
    return;
  }
  value.forEach((item, index) => validateItem(item, `${location}[${index}]`));
}

function validateStringArray(value, location, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${location} must be an array.`);
    return;
  }
  value.forEach((item, index) => validateNonEmptyString(item, `${location}[${index}]`, errors));
}

function validatePatternArray(value, location, pattern, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${location} must be an array.`);
    return;
  }
  value.forEach((item, index) => validatePatternString(item, pattern, `${location}[${index}]`, `a valid ${label} name`, errors));
}

function validateNonEmptyString(value, location, errors) {
  if (typeof value !== "string" || value.trim().length === 0) errors.push(`${location} must be a non-empty string.`);
}

function validatePatternString(value, pattern, location, expectation, errors) {
  if (typeof value !== "string" || !pattern.test(value)) errors.push(`${location} must be ${expectation}; received ${JSON.stringify(value)}.`);
}

async function readJson(filePath, label, errors) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    errors.push(`Unable to read ${label} at "${path.relative(repoRoot, filePath)}": ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
