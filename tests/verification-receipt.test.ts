import assert from 'node:assert/strict';
import test from 'node:test';
import { verificationReceipt } from '../scripts/verification-receipt.mjs';

test('missing, skipped, failed and cancelled required checks cannot produce a success receipt', () => {
  for (const result of [undefined, 'skipped', 'failure', 'cancelled']) {
    assert.throws(() => verificationReceipt({ required: ['build', 'database'], results: { build: { result: 'success' }, database: { result } } }), /Required verification/);
  }
  assert.throws(() => verificationReceipt({ required: [], results: {} }), /Required verification/);
});
test('receipt records tested commit, locked dependencies and migration hashes without configuration values', () => {
  const receipt = verificationReceipt({ required: ['build'], results: { build: { result: 'success' } } });
  assert.match(receipt.commit, /^[a-f0-9]{40}$/);
  assert.match(receipt.lockfileSha256, /^[a-f0-9]{64}$/);
  assert.ok(Object.keys(receipt.migrations).length > 0);
  assert.ok(Object.values(receipt.migrations).every(value => /^[a-f0-9]{64}$/.test(value as string)));
  assert.deepEqual(receipt.requiredResults, { build: 'success' });
});
