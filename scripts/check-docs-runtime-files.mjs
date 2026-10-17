import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));
const docsRoot = path.join(workspaceRoot, "docs");
const tracePath = path.join(workspaceRoot, "apps/dev-docs/.next/server/app/docs/[[...slug]]/page.js.nft.json");
const trace = JSON.parse(readFileSync(tracePath, "utf8"));
const bundledFiles = new Set(trace.files.map((file) => path.resolve(path.dirname(tracePath), file)));

function publicDocFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.name.startsWith(".") || (directory === docsRoot && entry.name === "internal")) return [];
    if (entry.isDirectory()) return publicDocFiles(file);
    return /\.mdx?$/i.test(entry.name) ? [file] : [];
  });
}

const docs = publicDocFiles(docsRoot);
assert.ok(docs.length > 0, "Expected public documentation sources");
const missing = docs.filter((file) => !bundledFiles.has(file));
assert.deepEqual(missing.map((file) => path.relative(workspaceRoot, file)), [],
  "Documentation sources must be bundled for runtime regeneration");
console.log(`Documentation runtime bundle includes all ${docs.length} public sources.`);
