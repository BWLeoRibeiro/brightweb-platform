import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packages = fileURLToPath(new URL("../packages", import.meta.url));
const layerOrder = "@layer theme, base, components, utilities;";

async function cssFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries
    .filter((entry) => entry.name !== "node_modules" && !entry.name.startsWith("."))
    .map(async (entry) => {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) return cssFiles(filename);
      return entry.isFile() && entry.name.endsWith(".css") ? [filename] : [];
    }));
  return files.flat();
}

test("shared layered styles establish the same order independently of chunk arrival", async () => {
  const styles = await cssFiles(packages);
  const checked: string[] = [];
  for (const filename of styles) {
    const source = (await readFile(filename, "utf8")).replace(/\/\*[\s\S]*?\*\//g, "").trimStart();
    // Entry points importing the reset must establish the contract too, even
    // when their own source contains no layer block. Each file carries its own
    // statement so extraction or import deduplication cannot remove its guard.
    if (!/@layer\s/.test(source) && !/@import\s+["'](?:tailwindcss|@brightweblabs\/theme\/css|\.\/tokens\.css)["']/.test(source)) continue;
    const relative = path.relative(packages, filename);
    assert.ok(source.startsWith(layerOrder), `${relative} must begin with ${layerOrder}`);
    checked.push(relative);
  }
  assert.ok(checked.includes("theme/src/index.css"));
  assert.ok(checked.includes("core-auth/tokens.css"));
  assert.ok(checked.includes("module-marketing/src/social-media/section-hero.module.css"));
});
