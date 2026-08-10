import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);

test("direct organization assignments resolve stale pending invitations", async () => {
  const source = await readFile(path.join(repoRoot, "packages/module-orgs/src/invitations.ts"), "utf8");

  assert.match(source, /resolvedProfilesByEmail\.set\(invite\.email, member\.profileId\)/);
  assert.match(source, /resolvedProfilesByEmail\.set\(invite\.email, profileId\)/);
  assert.match(source, /status: "accepted"/);
  assert.match(source, /accepted_by_profile_id: profileId/);
  assert.match(source, /\.eq\("invited_email", email\)\.eq\("status", "pending"\)/);
});
