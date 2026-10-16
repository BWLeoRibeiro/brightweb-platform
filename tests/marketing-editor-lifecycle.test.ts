import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { toLocalDateTime, fromLocalDateTime } from '../packages/module-marketing/src/ui/schedule-time.ts';

test('real campaign, workflow and social components preserve current editor state across late responses and plan changes', () => {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--loader', './tests/support/ts-extension-loader.mjs', '--loader', './tests/support/marketing-test-loader.mjs', './tests/support/marketing-lifecycle-scenarios.mjs'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

for (const zone of ['UTC', 'Europe/Lisbon', 'America/New_York', 'Asia/Kolkata']) {
  test(`campaign scheduling preserves stored instants in ${zone}`, () => {
    const script = `import assert from 'node:assert/strict'; import { toLocalDateTime, fromLocalDateTime } from './packages/module-marketing/src/ui/schedule-time.ts';
      for (const instant of ['2026-09-05T10:00:00.000Z', '2026-11-01T06:30:42.000Z', '2026-03-29T00:30:00.000Z']) assert.equal(fromLocalDateTime(toLocalDateTime(instant), instant), instant);
      const local='2026-09-05T10:15';assert.equal(toLocalDateTime(fromLocalDateTime(local)),local);`;
    const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], { cwd: new URL('..', import.meta.url), env: { ...process.env, TZ: zone }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  });
}

test('invalid and nonexistent local schedule times are rejected', () => {
  assert.equal(toLocalDateTime('invalid'), '');
  for (const value of ['', '2026-02-30T10:00', '2026-09-05T25:00']) assert.throws(() => fromLocalDateTime(value));
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', `import assert from 'node:assert/strict'; import {fromLocalDateTime} from './packages/module-marketing/src/ui/schedule-time.ts'; assert.throws(()=>fromLocalDateTime('2026-03-29T01:30'));`], { cwd: new URL('..', import.meta.url), env: { ...process.env, TZ: 'Europe/Lisbon' }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
