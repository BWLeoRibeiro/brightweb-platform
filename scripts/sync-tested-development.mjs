import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Changesets may change the checkout. Only the explicit CI-tested main commit
// is eligible for development; an unmerged version commit never is.
export function syncTestedDevelopment(sha, { cwd = process.cwd(), remote = 'origin' } = {}) {
  if (!/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('A full tested commit SHA is required');
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('fetch', '--quiet', remote, 'main', 'development');
  if (git('rev-parse', `${remote}/main`) !== sha) throw new Error('Main advanced since CI; refusing stale synchronization');
  const development = git('rev-parse', `${remote}/development`);
  if (development === sha) return 'unchanged';
  try { git('merge-base', '--is-ancestor', development, sha); }
  catch { return 'diverged'; }
  // A normal push also rejects any concurrent, non-fast-forward remote change.
  git('push', remote, `${sha}:refs/heads/development`);
  return 'updated';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = syncTestedDevelopment(process.env.CI_HEAD_SHA);
  if (result === 'diverged') console.warn('::warning::Development has unmerged work and was preserved; synchronization remains pending.');
  console.log(result);
}
