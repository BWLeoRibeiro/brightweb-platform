import fs from "node:fs";
import path from "node:path";

export const rootDir = path.resolve(import.meta.dirname, "..");
export const registryPath = path.join(rootDir, "supabase", "module-registry.json");

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function resolveModuleOrder(registry, enabledModules) {
  const resolved = [];
  const visiting = new Set();
  const visited = new Set();

  function visit(key) {
    if (visited.has(key)) return;
    if (visiting.has(key)) {
      throw new Error(`Circular module dependency detected at "${key}".`);
    }

    const moduleConfig = registry.modules[key];
    if (!moduleConfig) {
      throw new Error(`Unknown module "${key}" in client stack.`);
    }

    visiting.add(key);
    for (const dependency of moduleConfig.dependsOn ?? []) {
      visit(dependency);
    }
    visiting.delete(key);
    visited.add(key);
    resolved.push(key);
  }

  for (const key of enabledModules) {
    visit(key);
  }

  return resolved;
}

export function readClientStack(clientSlug) {
  const stackPath = path.join(rootDir, "supabase", "clients", clientSlug, "stack.json");
  if (!fs.existsSync(stackPath)) {
    throw new Error(`Client stack file not found: ${stackPath}`);
  }

  return {
    stackPath,
    stack: readJson(stackPath),
  };
}

export function getClientMigrationPlan(clientSlug) {
  const registry = readJson(registryPath);
  const { stackPath, stack } = readClientStack(clientSlug);
  const moduleOrder = resolveModuleOrder(registry, stack.enabledModules ?? []);

  return {
    registry,
    stack,
    stackPath,
    moduleOrder,
    steps: [
      ...moduleOrder.map((key) => ({
        type: "module",
        key,
        path: registry.modules[key].path,
        description: registry.modules[key].description,
      })),
      {
        type: "client",
        key: stack.client.slug,
        path: stack.clientMigrationPath,
        description: "Client-only migrations, if any.",
      },
    ],
  };
}

export function listSqlFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];

  return fs.readdirSync(dirPath)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort()
    .map((fileName) => path.join(dirPath, fileName));
}

export function collectMaterializedFiles(clientSlug) {
  const plan = getClientMigrationPlan(clientSlug);
  const files = [];

  for (const step of plan.steps) {
    const absoluteDir = path.join(rootDir, step.path);
    for (const filePath of listSqlFiles(absoluteDir)) {
      files.push({
        step,
        path: filePath,
        relativePath: path.relative(rootDir, filePath),
        fileName: path.basename(filePath),
      });
    }
  }

  return {
    ...plan,
    files,
  };
}
