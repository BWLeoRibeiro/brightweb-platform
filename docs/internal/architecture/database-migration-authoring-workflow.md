# Database Migration Authoring Workflow

This document defines how Brightweb should create new database migrations from now on.

## Principle

Write migrations where the ownership lives:

- shared foundation -> `core`
- RBAC and governance -> `admin`
- organizations and CRM -> `crm`
- work management -> `projects`
- one-off client exceptions -> `clients/<slug>`

## File locations

```text
supabase/modules/core/migrations
supabase/modules/admin/migrations
supabase/modules/crm/migrations
supabase/modules/projects/migrations
supabase/clients/<slug>/migrations
```

## Commands

Create a migration:

```bash
pnpm db:new <module> <migration-name>
```

Examples:

```bash
pnpm db:new core alerts_cursor_backfill
pnpm db:new admin tighten_role_change_guard
pnpm db:new crm contact_owner_index
pnpm db:new projects project_task_priority_enum
pnpm db:new client:acme custom_reporting_snapshot
```

Print the apply plan for a client:

```bash
pnpm db:plan acme
```

## Apply order

1. `core`
2. enabled shared modules in dependency order
3. client-only migrations

## Rules

### Use `core` when

- every client needs the change
- it affects auth/profile sync
- it affects shared helper functions
- it affects global alerts/events/preferences/rate limits

### Use `admin` when

- the change affects roles
- the change affects role audit or assignment
- the change affects admin-only governance policies or RPCs

### Use `crm` when

- the change affects organizations
- the change affects CRM contacts
- the change affects org membership/invitations

### Use `projects` when

- the change affects projects, tasks, milestones, links, or project access policies

### Use `clients/<slug>` when

- the change is intentionally unique to one client
- the shared product should not inherit it

## Baseline note

Brightweb v1 ships a clean module baseline in this repo.

From this point onward:

- keep module ownership clear
- add new changes as forward migrations
- avoid reintroducing temporary cleanup files into the canonical install path

See also:

- `database-migration-safety-policy.md`
