# Invitation and direct membership transactions

Admin and organization acceptance now execute one service-only database RPC each. The server supplies the authenticated identity's email and profile ID; the RPC verifies that they match the invitation and an auth-linked profile. Browser roles cannot execute these operations. Functions use invoker privileges and an empty search path; no auth-table grants are added.

The invitation row is locked before checking status or expiry. Access assignment, invitation finalization and activity/audit writes commit together. A retry of an already accepted invitation for the same profile returns the prior success without reassigning a subsequently changed role or membership. Revocation and acceptance serialize on the same row. Expired pending invitations become expired without granting access.

Organizations can be installed without CRM. When CRM is installed, its `link_organization_invitation_contact` integration runs inside the acceptance transaction; a missing integration migration rejects the acceptance rather than falling back to partial writes. The optional TypeScript `ensureCrmContactForProfile` argument accepts the stock CRM function, branded with the Orgs-exported `DATABASE_INVITATION_CONTACT_INTEGRATION` symbol. Acceptance does not invoke callbacks outside the transaction. Unmarked/custom callbacks fail before any operation with `INVITATION_CONTACT_INTEGRATION_MIGRATION_REQUIRED`; there is no silent customization loss. Omit the callback for orgs-only adapters (including older generated no-op callbacks). Direct membership assignments from batch invitations use the same database integration contract; they never invoke an asynchronous callback between membership writes.

Custom integrations must add a **client-owned forward migration**, not edit a shipped migration. Define `public.client_organization_invitation_contact_hook(uuid, uuid) RETURNS uuid`, taking profile ID then organization ID and returning the linked contact ID (or null for deliberate no-contact behavior). This hook takes precedence over the stock CRM integration and runs inside the transaction; throw on failure. Use invoker privileges, an empty search path, fully qualified objects, revoke execution from PUBLIC/anon/authenticated, and grant only service_role. Package migrations never own or replace this client-prefixed function; maintain it alongside client migrations and verify it after upgrades. After migrating and testing the custom behavior, set `contactIntegration: "database"` on acceptance/registration adapters and `createOrganizationRequestHandlers` (or direct `inviteOrganizationMembers` options) to explicitly acknowledge it. Do not brand custom callbacks as stock.

## Direct membership changes

For each existing profile in a batch, `assign_organization_member_atomic` resolves the current membership inside one service-only transaction. Membership, CRM linking, primary-contact selection and pending-invitation reconciliation commit together. A failure rolls back only that transaction; the server never deletes membership or restores a role from an earlier snapshot. Each person retains an independent outcome, so one failure does not undo successful people in the batch. New-account invitation emails remain outside database transactions.

The transaction locks matching invitation rows, the matching profile and the organization in the same order as acceptance, then resolves membership under a row lock. Concurrent grants are handled through the unique membership constraint. An unchanged-role retry still reconciles CRM and pending invitations. A retry is a new request for the supplied role: if another authorized operation changed that role in between, the new request can deliberately change it again. This is not an exactly-once command protocol.

Unmarked custom callbacks are rejected before the batch starts until explicitly migrated and acknowledged. The client-owned hook keeps precedence over stock CRM and its writes share the membership transaction. SQL hook errors fail the person's operation; there is no fallback to asynchronous compensation.

## Upgrade order

Apply `20260906101616_atomic_admin_invitation_acceptance.sql`, `20260906101616_atomic_organization_invitation_acceptance.sql`, and, for apps with CRM, `20260906101616_atomic_invitation_contact_link.sql` through the normal module migration workflow before deploying the acceptance handlers. Direct membership handlers additionally require `20260906113855_atomic_organization_member_assignment.sql`. Both authoritative module histories and the CLI's bundled histories contain identical files. No existing migration is rewritten. Missing RPCs fail closed; there is no non-atomic compatibility fallback.

Auth-user creation is a separate service operation. Registration reuses the same acceptance transaction and retains the account if a later step fails or its response is uncertain. A pending registration retry resolves the same account and retries acceptance; it never deletes a potentially accepted identity on a transport error. This may leave an account with its ordinary default role after an unsuccessful invitation attempt. It does not grant the invited role or membership unless acceptance commits.

Registration through an already accepted link uses the stored accepting profile and only confirms the idempotent RPC result: it never creates an account or synchronizes profile metadata. If that profile was deleted, the replay is rejected.

Failed email delivery and failed invitation cleanup are distinct outcomes. If cleanup fails, staff see retained-invitation recovery guidance instead of a false claim that no invitation was saved.

## Local database verification

`tests/integration/invitation-transactions.mjs` starts a fresh loopback-only PostgreSQL cluster in a new temporary directory and stops it afterward. It never accepts a database URL or an existing database directory. It loads the real bundled Core/Admin/Orgs/CRM/Marketing migration history against a minimal synthetic auth schema. The fixture does not grant service-role access to auth.users. Tests cover browser-role denial, wrong identity, expiry, idempotent retry, final-write and activity rollback, CRM rollback, orgs-only installation, both orders of two-session acceptance/revocation races, and direct membership transactions. Direct membership cases cover concurrent grants and role edits surviving CRM failure, atomic primary-contact and invitation reconciliation, retry outcomes, custom hook precedence, and both acceptance/assignment orders.

Install `embedded-postgres@18.4.0-beta.17` in an external scratch npm workspace with its required binary setup scripts enabled; do not add it to a client app. Set `BW_POSTGRES_RUNTIME` to that workspace's node_modules directory:

```sh
BW_POSTGRES_RUNTIME=/absolute/scratch/node_modules node tests/integration/invitation-transactions.mjs
```

The same runner now includes [workflow persistence checks](./workflow-transactions.md).

These checks establish actual PostgreSQL transaction and privilege behavior. They do not inspect or certify the migration state of a deployed Supabase project.
