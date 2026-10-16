# Database behavior gate

Run `pnpm test:database` after `pnpm install --frozen-lockfile`. CI runs the same command as a required verification job. The lockfile pins `embedded-postgres` and its native PostgreSQL 17 binaries; the workspace allows their symlink hydration install scripts. No Docker, external runtime directory, database URL, Supabase credentials, or production connection is used. Each invocation creates and deletes its own temporary cluster and asserts PostgreSQL major version 17.

The fixture supplies the Supabase database roles, `auth.users`, request-claim auth helpers, realtime publication, and default table grants. It executes the shipped module migrations and tests their real transactions, row locks, RLS, function grants, and triggers. It does not emulate GoTrue, PostgREST, storage, email delivery, or full Supabase extensions; those require separate application integration coverage.

- Invitation and membership checks cover service-only grants, wrong identity, expiration/revocation, retry, custom hook rollback, and concurrent state transitions, with and without CRM.
- Minimal generated Core/Admin and Projects applications apply their actual numbered consumer migrations without reordering and without CRM, then exercise auth identity creation and an authenticated project creation. This catches cross-module migration-order defects that separate module tests can hide.
- Projects first inserts a customer record into the original Projects baseline, applies the subsequent migration history, and verifies preserved identity/content and the organization backfill. Separate authenticated sessions then prove administrator creation, retry, staff/client denial, organization isolation, audience revocation, internal-row RLS, and contributor task permissions.
- Marketing checks cover atomic node replacement, rollback, stale/foreign input rejection, activation, and concurrent edits.

Each assertion must observe persisted results or SQL denial, not migration text. The project creation denial fixture intentionally names the staff caller as a proposed project owner: removing the administrator guard must fail the test even when downstream owner permissions would allow creation. This was verified by changing that guard only in a disposable copy; the unmodified suite passes and the mutated suite fails at the staff denial assertion.

Connections have bounded statement and idle-transaction timeouts. Concurrency tests observe PostgreSQL lock waits instead of sleeping for a guessed duration. All records use synthetic identities under `example.invalid`.

## Real Supabase consumer gate

`node tests/e2e/generated-app-smoke.mjs --real-backend` builds a generated consumer against a real disposable Supabase stack using `tests/e2e/consumer-backend.mjs`. It requires Docker and the package-locked Supabase CLI 2.116.0. Missing Docker or unhealthy services fail the suite; they never produce a skipped pass. The backend copies the consumer's materialized migrations into a fresh local Supabase project before startup, seeds synthetic users through GoTrue, and seeds projects through PostgREST. Browser tests use the resulting application and real session cookies.

All service URLs are checked for loopback hosts. Each run uses a unique project ID and free ports; teardown explicitly stops that ID and deletes its volumes. Existing local Supabase instances are not reset or stopped. CLI output containing local credentials is not emitted. Mail is captured by the local test stack. No remote project link or deployment occurs.
