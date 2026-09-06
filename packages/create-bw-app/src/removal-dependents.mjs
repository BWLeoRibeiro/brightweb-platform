import fs from "node:fs/promises";
import path from "node:path";

// Conservative literal-import diagnostic, not a complete application bundler.
// Generated replacements and deliberate clean deletions are outside the surviving set.
export async function findSurvivingPackageImports(targetDir, packageName, excludedPaths) {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const imports = new RegExp(`(?:\\bfrom\\s*|\\bimport\\s*(?:\\(\\s*)?|\\brequire\\s*\\(\\s*)["']${escaped}(?:/[^"']*)?["']`);
  const stylesheetImports = new RegExp(`@(?:import|reference)\\s*(?:url\\(\\s*)?["']?${escaped}(?:/[^"'\\s);]+)?(?=["'\\s);]|$)`, "i");
  const sourceExtension = /\.(?:[cm]?[jt]sx?|mdx|css)$/i;
  const findings = [];
  const ignored = new Set(["node_modules", ".git", ".next", ".brightweb", "supabase", "dist", "build"]);
  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const fullPath = path.join(directory, entry.name);
      const relativePath = path.relative(targetDir, fullPath);
      if (excludedPaths.has(relativePath)) continue;
      if (entry.isSymbolicLink()) {
        // Do not read outside the app or silently declare linked source safe.
        if (entry.name.includes(".") && !sourceExtension.test(entry.name)) continue;
        findings.push(`${relativePath} (linked source; inspect dependencies explicitly)`);
      } else if (entry.isDirectory()) await visit(fullPath);
      else if (sourceExtension.test(entry.name)) {
        const source = await fs.readFile(fullPath, "utf8");
        if ((/\.css$/i.test(entry.name) ? stylesheetImports : imports).test(source)) findings.push(relativePath);
      }
    }
  }
  await visit(targetDir);
  return findings.sort();
}
