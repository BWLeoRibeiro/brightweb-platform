import assert from "node:assert/strict";
import test from "node:test";
import { inviteOrganizationMembers } from "../packages/module-orgs/src/invitations.ts";

for (const transactionSucceeds of [true, false]) test(`direct membership ${transactionSucceeds ? "success" : "failure"} never reconciles invitations outside its transaction`, async () => {
  let transactionCalls = 0;
  const client = {
    from(table: string) {
      const query: Record<string, unknown> = {};
      for (const method of ["select", "in", "order", "limit", "eq"]) query[method] = () => query;
      // Any JavaScript fallback or compensating write must fail this contract.
      for (const method of ["update", "delete", "upsert", "insert"]) query[method] = () => {
        assert.fail(`${table}.${method} must execute inside assign_organization_member_atomic`);
      };
      const result = () => {
        if (table === "profiles") return { data: [{ id: "profile-1", email: "person@example.invalid" }], error: null };
        if (table === "organizations") return { data: { name: "Synthetic" }, error: null };
        if (table === "organization_invitations") return { data: [], error: null };
        assert.fail(`unexpected direct-member table read: ${table}`);
      };
      query.maybeSingle = async () => result();
      query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
      return query;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      transactionCalls += 1;
      assert.equal(name, "assign_organization_member_atomic");
      assert.deepEqual(args, {
        p_organization_id: "org-1", p_profile_id: "profile-1", p_email: "person@example.invalid",
        p_role: "member", p_actor_profile_id: "actor-1",
      });
      return transactionSucceeds
        ? { data: { status: "already_member" }, error: null }
        : { data: null, error: { code: "BW001", message: "synthetic contact integration failure" } };
    },
  };
  const result = await inviteOrganizationMembers(client as never, "org-1", [{ email: "person@example.invalid", role: "member" }], "actor-1");
  assert.equal(transactionCalls, 1);
  assert.equal(result.outcomes[0]?.status, transactionSucceeds ? "already_member" : "api_failed");
  assert.equal(result.summary.failedContactLinks, transactionSucceeds ? 0 : 1);
});
