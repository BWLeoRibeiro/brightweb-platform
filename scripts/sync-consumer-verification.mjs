import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const sourceRoot = path.resolve(import.meta.dirname, '..');
const files = ['browser-errors.mjs', 'consumer-backend.mjs', 'consumer-smoke.mjs', 'critical-workflows-browser.mjs'];
const digest = content => createHash('sha256').update(content).digest('hex');
async function optionalRead(file) {
  try { return await readFile(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// Shared test implementation is maintained here; client commands own paths and
// module configuration. Refuse to replace locally customized test implementations.
export async function syncConsumerVerification(targetRoot, { write = false } = {}) {
  const target = path.join(path.resolve(targetRoot), 'tests/e2e');
  const manifestPath = path.join(target, 'brightweb-verification.json');
  const previousBytes = await optionalRead(manifestPath);
  const previous = previousBytes ? JSON.parse(previousBytes) : { files: {} };
  const copies = [];
  for (const name of files) {
    const content = await readFile(path.join(sourceRoot, 'tests/e2e', name));
    const existing = await optionalRead(path.join(target, name));
    if (write && existing && digest(existing) !== digest(content)) {
      assert.equal(digest(existing), previous.files[name], `Preserve customized consumer check: ${name}; review it before updating`);
    }
    if (!write) assert(existing && existing.equals(content), `Consumer check differs from platform: ${name}`);
    copies.push({ name, content });
  }
  const manifest = { source: 'brightweb-platform/tests/e2e', files: Object.fromEntries(copies.map(({ name, content }) => [name, digest(content)])) };
  if (write) {
    await mkdir(target, { recursive: true });
    for (const { name, content } of copies) await writeFile(path.join(target, name), content);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  } else assert.deepEqual(previous, manifest, 'Consumer verification provenance differs');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert(process.argv[2] && !process.argv[2].startsWith('--'), 'Pass an explicit client repository root');
  await syncConsumerVerification(process.argv[2], { write: process.argv.includes('--write') });
}
