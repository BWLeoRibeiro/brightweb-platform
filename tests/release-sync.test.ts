import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { syncTestedDevelopment } from '../scripts/sync-tested-development.mjs';

function fixture(t: any) {
  const root = mkdtempSync(join(tmpdir(), 'bw-release-sync-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const remote = join(root, 'remote.git');
  const cwd = join(root, 'checkout');
  const run = (dir: string, ...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  run(root, 'init', '--bare', remote); run(root, 'clone', remote, cwd);
  const git = (...args: string[]) => run(cwd, ...args);
  git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'Test');
  git('checkout', '-b', 'main');
  const commit = (text: string) => { writeFileSync(join(cwd, 'fixture'), text); git('add', '.'); git('commit', '-m', text); return git('rev-parse', 'HEAD'); };
  const initial = commit('initial'); git('push', 'origin', 'main', 'main:development');
  const tested = commit('tested'); git('push', 'origin', 'main');
  return { cwd, git, commit, tested, initial };
}
test('synchronizes tested main even after Changesets checks out an unmerged version commit', t => {
  const f = fixture(t); f.git('checkout', '-b', 'changeset-release/main');
  const unmerged = f.commit('unmerged version');
  assert.equal(syncTestedDevelopment(f.tested, { cwd: f.cwd }), 'updated');
  assert.equal(f.git('ls-remote', 'origin', 'refs/heads/development').split('\t')[0], f.tested);
  assert.equal(f.git('rev-parse', 'HEAD'), unmerged);
  assert.equal(syncTestedDevelopment(f.tested, { cwd: f.cwd }), 'unchanged');
});
test('rejects stale CI and preserves development when main advances', t => {
  const f = fixture(t); f.commit('new main'); f.git('push', 'origin', 'main');
  assert.throws(() => syncTestedDevelopment(f.tested, { cwd: f.cwd }), /Main advanced/);
  assert.equal(f.git('ls-remote', 'origin', 'refs/heads/development').split('\t')[0], f.initial);
});
test('preserves divergent development', t => {
  const f = fixture(t); f.git('checkout', '-b', 'development', f.initial);
  const own = f.commit('in flight'); f.git('push', 'origin', 'development');
  assert.equal(syncTestedDevelopment(f.tested, { cwd: f.cwd }), 'diverged');
  assert.equal(f.git('ls-remote', 'origin', 'refs/heads/development').split('\t')[0], own);
});
