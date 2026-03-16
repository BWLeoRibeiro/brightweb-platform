# Database Module Migration Structure

## Decision

Brightweb database migrations are owned by platform area, not by client app.

## Canonical structure

```text
supabase/
  modules/
    core/
    admin/
    crm/
    projects/
  clients/
    <client-slug>/
```

## Ownership rules

### `core`

Owns shared foundations applied to every client:

- profile/auth sync
- shared helper functions
- shared notification and event primitives
- shared preferences and rate limits

### `admin`

Owns global governance:

- roles
- role assignments
- role audit
- admin-only role mutation helpers
- default role-assignment behavior

### `crm`

Owns:

- organizations
- org membership
- organization invitations
- CRM contacts and status history
- CRM/org policies and helper functions

### `projects`

Owns:

- project records
- project members
- milestones
- tasks
- links
- project activity and project-specific RLS

### `clients/<slug>`

Owns:

- one-off schema deltas that should never become shared platform behavior

## Provisioning model

For a new client:

1. Create Supabase project
2. Apply `core`
3. Apply enabled module migrations
4. Apply client-specific migrations only if needed
5. Seed first admin and required baseline data
6. Configure env vars, auth URLs, Resend, and any CMS integration

## Important rule

Do not build one giant schema for every client by default.

Install:

- shared foundation
- purchased modules
- rare client-only extensions

This keeps module rollout, rollback, and upgrades much safer.
