import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { syncConsumerVerification } from '../scripts/sync-consumer-verification.mjs';

test('consumer checks export and verify, while custom edits are preserved before any update', async t => {
  const root = await mkdtemp(join(tmpdir(), 'bw-verification-sync-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await syncConsumerVerification(root, { write: true });
  await syncConsumerVerification(root);
  const target = join(root, 'tests/e2e/consumer-smoke.mjs');
  const customized = '// Client-owned extension\n' + await readFile(target, 'utf8');
  await writeFile(target, customized);
  await assert.rejects(syncConsumerVerification(root), /differs from platform/);
  await assert.rejects(syncConsumerVerification(root, { write: true }), /Preserve customized/);
  assert.equal(await readFile(target, 'utf8'), customized);
});
