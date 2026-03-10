import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const registryPath = path.join(rootDir, "supabase", "module-registry.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolveModuleOrder(registry, enabledModules) {
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

function main() {
  const clientSlug = process.argv[2];

  if (!clientSlug) {
    console.error("Usage: node scripts/plan-client-migrations.mjs <client-slug>");
    process.exit(1);
  }

  const stackPath = path.join(rootDir, "supabase", "clients", clientSlug, "stack.json");
  if (!fs.existsSync(stackPath)) {
    console.error(`Client stack file not found: ${stackPath}`);
    process.exit(1);
  }

  const registry = readJson(registryPath);
  const stack = readJson(stackPath);
  const moduleOrder = resolveModuleOrder(registry, stack.enabledModules ?? []);

  const plan = {
    client: stack.client,
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

  console.log(JSON.stringify(plan, null, 2));
}

main();
