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
pnpm db:new client:begreen custom_reporting_snapshot
```

Print the apply plan for a client:

```bash
pnpm db:plan begreen
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

## Transition note

Historical BeGreen migrations are still flat. Do not rewrite production history casually.

From Brightweb v1 onward:

- new migrations should follow the module structure
- old BeGreen history remains reference material
- equivalent shared logic should be re-authored into Brightweb-owned modules over time

See also:

- `database-migration-safety-policy.md`
