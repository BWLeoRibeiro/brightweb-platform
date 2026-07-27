import fs from "node:fs/promises";
import path from "node:path";

const ROUTE_FILE_NAMES = new Set(["page.tsx", "route.ts"]);
const DIRECT_PACKAGE_EXPORT = /^export\s*\{[^}]+\}\s*from\s*["']@brightweblabs\/[a-z0-9-/]+["'];?$/;
const DIRECT_APP_HANDLER_EXPORT = /^export\s*\{[^}]+\}\s*from\s*["'](?:\.\.\/)+_handlers["'];?$/;
const DIRECT_APP_MOUNT_EXPORT = /^export\s*\{[^}]+\}\s*from\s*["']\.{1,2}\/[a-z0-9_./-]+["'];?$/i;
const STATIC_ROUTE_CONFIG = /^export\s+const\s+dynamic\s*=\s*["']force-dynamic["'];?$/;
const PACKAGE_IMPORT = /^import\s*\{[^}]+\}\s*from\s*["']@brightweblabs\/[a-z0-9-/]+["'];?$/;
const RELATIVE_IMPORT = /^import\s*\{[^}]+\}\s*from\s*["']\.{1,2}\/[a-z0-9_./-]+["'];?$/i;
const PACKAGE_HANDLER_FACTORY = /^export\s+const\s+(?:GET|POST|PATCH|DELETE)\s*=\s*[A-Za-z0-9_]+\([A-Za-z0-9_]+\);?$/;
const SINGLE_COMPONENT_MOUNT = /^import\s*\{\s*([A-Za-z0-9_]+)\s*\}\s*from\s*["']@brightweblabs\/[a-z0-9-/]+["'];\s*export\s+default\s+function\s+[A-Za-z0-9_]+\(\)\s*\{\s*return\s+<\1\s*\/>;\s*\}\s*$/s;
const PARAMETERIZED_COMPONENT_MOUNT = /^import\s*\{\s*InvitePage\s*\}\s*from\s*["']@brightweblabs\/core-auth\/ui["'];\s*export\s+default\s+async\s+function\s+Page\(\{\s*params\s*\}:\s*\{\s*params:\s*Promise<\{\s*invitationId:\s*string\s*\}>\s*\}\)\s*\{\s*const\s*\{\s*invitationId\s*\}\s*=\s*await\s+params;\s*return\s+<InvitePage\s+invitationId=\{invitationId\}\s+kind=["']admin["']\s*\/>;\s*\}\s*$/s;

function isDynamicPackageHandlerRoute(content) {
  if (!content.includes('export const dynamic = "force-dynamic";')) return false;
  const handlerBlocks = content.match(/export async function[\s\S]*?\n}/g) || [];
  if (handlerBlocks.length === 0) return false;
  for (const block of handlerBlocks) {
    const importedHandler = block.match(
      /const\s*\{\s*([A-Za-z0-9_]+)\s*\}\s*=\s*await\s+import\(["']@brightweblabs\/[a-z0-9-/]+["']\);/,
    )?.[1];
    if (!importedHandler || !new RegExp(`return\\s+${importedHandler}\\(`).test(block)) return false;
  }
  return content
    .replace('export const dynamic = "force-dynamic";', "")
    .replace(/export async function[\s\S]*?\n}/g, "")
    .trim() === "";
}

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

    const isDynamicPackageHandler = isDynamicPackageHandlerRoute(content);
    const isPackageHandlerFactory = executableLines.some((line) => PACKAGE_HANDLER_FACTORY.test(line))
      && executableLines.every(
        (line) =>
          PACKAGE_IMPORT.test(line)
          || RELATIVE_IMPORT.test(line)
          || STATIC_ROUTE_CONFIG.test(line)
          || PACKAGE_HANDLER_FACTORY.test(line),
      );
    const isSingleComponentPage = path.basename(filePath) === "page.tsx" && (
      SINGLE_COMPONENT_MOUNT.test(content)
      || PARAMETERIZED_COMPONENT_MOUNT.test(content)
    );

    if (executableLines.length > 5 && !isDynamicPackageHandler && !isSingleComponentPage) {
      violations.push(`${filePath}: has ${executableLines.length} executable lines (maximum 5)`);
      continue;
    }

    const isDirectExportRoute = executableLines.some(
      (line) =>
        DIRECT_PACKAGE_EXPORT.test(line)
        || DIRECT_APP_HANDLER_EXPORT.test(line)
        || DIRECT_APP_MOUNT_EXPORT.test(line),
    ) && executableLines.every(
      (line) =>
        DIRECT_PACKAGE_EXPORT.test(line)
        || DIRECT_APP_HANDLER_EXPORT.test(line)
        || DIRECT_APP_MOUNT_EXPORT.test(line)
        || STATIC_ROUTE_CONFIG.test(line),
    );
    if (!isDirectExportRoute && !isDynamicPackageHandler && !isPackageHandlerFactory && !isSingleComponentPage) {
      violations.push(`${filePath}: must directly re-export package handlers/pages or return one imported package component`);
    }
  }

  return violations;
}
