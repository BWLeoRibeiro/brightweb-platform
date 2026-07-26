import assert from "node:assert/strict";
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

function membershipClient(result: { data: { role: string } | null; error: { message: string } | null }) {
  const calls: Array<[string, string]> = [];
  return {
    calls,
    client: {
      from(table: string) {
        assert.equal(table, "organization_members");
        return {
          select(columns: string) {
            assert.equal(columns, "role");
            return this;
          },
          eq(column: string, value: string) {
            calls.push([column, value]);
            return this;
          },
          async maybeSingle() {
            return result;
          },
        };
      },
    },
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
  if (result.ok) {
    assert.equal(result.isOrgMember, true);
    assert.equal(result.isOrgAdmin, true);
  }
});

test("organization management scopes client access to admin membership", async () => {
  const membership = membershipClient({ data: { role: "admin" }, error: null });
  const guard = createOrganizationManageAccessGuard(accessDependencies({
    ok: true,
    user,
    profileId: "profile-1",
    role: "client",
    supabase: {},
  }, membership.client));

  const result = await guard("org-1");
  assert.equal(result.ok, true);
  assert.deepEqual(membership.calls, [
    ["organization_id", "org-1"],
    ["profile_id", "profile-1"],
  ]);

  const member = membershipClient({ data: { role: "member" }, error: null });
  const denied = await createOrganizationManageAccessGuard(accessDependencies({
    ok: true,
    user,
    profileId: "profile-1",
    role: "client",
    supabase: {},
  }, member.client))("org-1");
  assert.deepEqual(denied, {
    ok: false,
    status: 403,
    error: "Acesso proibido.",
  });
});

test("organization management surfaces membership query failures", async () => {
  const membership = membershipClient({ data: null, error: { message: "membership unavailable" } });
  const result = await createOrganizationManageAccessGuard(accessDependencies({
    ok: true,
    user,
    profileId: "profile-1",
    role: "client",
    supabase: {},
  }, membership.client))("org-1");

  assert.deepEqual(result, {
    ok: false,
    status: 500,
    error: "membership unavailable",
  });
});
