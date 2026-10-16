import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function verificationReceipt({ required, results, root = process.cwd() }) {
  if (!required.length || required.some(name => results[name]?.result !== 'success')) {
    throw new Error('Required verification failed, was skipped, or is missing');
  }
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const hash = file => createHash('sha256').update(readFileSync(join(root, file))).digest('hex');
  const migrations = {};
  function walk(directory) {
    for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
      if (['node_modules', '.git', '.next', '.env', '.temp', '.backups', '.generated'].includes(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && path.includes('/migrations/') && path.endsWith('.sql')) migrations[path] = hash(path);
    }
  }
  walk('.');
  return {
    schemaVersion: 1,
    commit: git('rev-parse', 'HEAD'),
    dirty: git('status', '--porcelain').length > 0,
    node: process.version,
    packageManager: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).packageManager,
    lockfileSha256: hash('pnpm-lock.yaml'),
    migrations,
    requiredResults: Object.fromEntries(required.map(name => [name, results[name].result])),
    runUrl: process.env.GITHUB_RUN_ID ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const receipt = verificationReceipt({ required: (process.env.BW_REQUIRED_JOBS ?? '').split(',').filter(Boolean), results: JSON.parse(process.env.BW_JOB_RESULTS ?? '{}') });
  mkdirSync('verification-results', { recursive: true });
  writeFileSync('verification-results/receipt.json', `${JSON.stringify(receipt, null, 2)}\n`);
}
