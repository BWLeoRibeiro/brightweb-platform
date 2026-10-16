import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
test('both task sheets validate drafts and isolate concurrent submissions across editor, client and project changes', () => {
  const result=spawnSync(process.execPath,['--experimental-strip-types','--loader','./tests/support/ts-extension-loader.mjs','--loader','./tests/support/projects-form-loader.mjs','./tests/support/projects-form-scenarios.mjs'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+result.stderr);
});
