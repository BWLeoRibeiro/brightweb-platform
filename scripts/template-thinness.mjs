import fs from "node:fs/promises";
import path from "node:path";

const ROUTE_FILE_NAMES = new Set(["page.tsx", "route.ts"]);
const DIRECT_PACKAGE_EXPORT = /^export\s*\{[^}]+\}\s*from\s*["']@brightweblabs\/[a-z0-9-/]+["'];?$/;
const STATIC_ROUTE_CONFIG = /^export\s+const\s+dynamic\s*=\s*["']force-dynamic["'];?$/;
const SINGLE_COMPONENT_MOUNT = /^import\s*\{\s*([A-Za-z0-9_]+)\s*\}\s*from\s*["']@brightweblabs\/[a-z0-9-/]+["'];\s*export\s+default\s+function\s+[A-Za-z0-9_]+\(\)\s*\{\s*return\s+<\1\s*\/>;\s*\}\s*$/s;

async function collectRouteFiles(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) return collectRouteFiles(absolutePath);
    return ROUTE_FILE_NAMES.has(entry.name) ? [absolutePath] : [];
  }));
  return nested.flat();
}

/**
 * Thin-route heuristic: generated HTTP routes are direct package re-exports.
 * Pages are either direct re-exports or exactly one BrightWeb component import
 * plus a no-props function whose only statement returns that component. A static
 * `dynamic` route config is allowed when a package mount must not prerender. This
 * rejects state, fetches, branching, event handlers, and business logic.
 */
export async function findTemplateThinnessViolations(templateRoot) {
  const violations = [];

  for (const filePath of await collectRouteFiles(templateRoot)) {
    const content = await fs.readFile(filePath, "utf8");
    const executableLines = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//"));

    if (executableLines.length > 5) {
      violations.push(`${filePath}: has ${executableLines.length} executable lines (maximum 5)`);
      continue;
    }

    const isDirectExportRoute = executableLines.some((line) => DIRECT_PACKAGE_EXPORT.test(line))
      && executableLines.every((line) => DIRECT_PACKAGE_EXPORT.test(line) || STATIC_ROUTE_CONFIG.test(line));
    const isSingleComponentPage = path.basename(filePath) === "page.tsx" && SINGLE_COMPONENT_MOUNT.test(content);
    if (!isDirectExportRoute && !isSingleComponentPage) {
      violations.push(`${filePath}: must directly re-export package handlers/pages or return one imported package component`);
    }
  }

  return violations;
}
