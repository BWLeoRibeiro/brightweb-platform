import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createOrganizationManageAccessGuard,
  createOrganizationsStaffAccessGuard,
  type OrganizationAccessDependencies,
} from "../packages/module-orgs/src/access.ts";

const user = {
  id: "user-1",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "2026-07-26T00:00:00.000Z",
};

function accessDependencies(
  access: Record<string, unknown>,
  serviceClient: unknown = {},
): OrganizationAccessDependencies {
  return {
    getAccess: async () => access as never,
    getServiceClient: () => serviceClient as never,
  };
}

test("organization staff access remaps missing profiles and rejects client roles", async () => {
  const missingProfileGuard = createOrganizationsStaffAccessGuard(accessDependencies({
    ok: false,
    status: 409,
    error: "Perfil em falta.",
  }));
  assert.deepEqual(await missingProfileGuard(), {
    ok: false,
    status: 403,
    error: "Perfil não encontrado.",
  });

  const clientGuard = createOrganizationsStaffAccessGuard(accessDependencies({
    ok: true,
    user,
    profileId: "profile-1",
    role: "client",
    supabase: {},
  }));
  assert.deepEqual(await clientGuard(), {
    ok: false,
    status: 403,
    error: "Acesso proibido.",
  });
});

test("organization staff access returns the service client for staff roles", async () => {
  const serviceClient = { kind: "service-role" };
  const guard = createOrganizationsStaffAccessGuard(accessDependencies({
    ok: true,
    user,
    profileId: "profile-1",
    role: "staff",
    supabase: {},
  }, serviceClient));

  const result = await guard();
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.profileId, "profile-1");
    assert.equal(result.role, "staff");
    assert.equal(result.serviceSupabase, serviceClient);
  }
});

test("organization management bypasses membership queries for platform staff", async () => {
  const serviceClient = {
    from() {
      throw new Error("staff access must not query organization membership");
    },
  };
  const guard = createOrganizationManageAccessGuard(accessDependencies({
    ok: true,
    user,
    profileId: "profile-1",
    role: "admin",
    supabase: {},
  }, serviceClient));

  const result = await guard("org-1");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.role, "admin");
});

test("organization management rejects clients even when they are organization administrators", async () => {
  const serviceClient = {
    from() {
      throw new Error("client access must be rejected before organization membership is queried");
    },
  };
  const denied = await createOrganizationManageAccessGuard(accessDependencies({
    ok: true,
    user,
    profileId: "profile-1",
    role: "client",
    supabase: {},
  }, serviceClient))("org-1");
  assert.deepEqual(denied, {
    ok: false,
    status: 403,
    error: "Acesso proibido.",
  });
});

test("organization management RLS removes direct organization-admin writes", async () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase/modules/orgs/migrations/20260812120000_staff_only_organization_access_management.sql",
  );
  const templatePath = path.join(
    process.cwd(),
    "packages/create-bw-app/template/supabase/modules/orgs/migrations/20260812120000_staff_only_organization_access_management.sql",
  );
  const [migration, template] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(templatePath, "utf8"),
  ]);

  assert.equal(template, migration);
  assert.match(migration, /DROP POLICY IF EXISTS "Org admins manage org members"/);
  assert.match(migration, /DROP POLICY IF EXISTS "Org admins manage organization invitations"/);
  assert.doesNotMatch(migration, /CREATE POLICY/);
});
