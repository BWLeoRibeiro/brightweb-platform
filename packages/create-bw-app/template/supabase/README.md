# Brightweb Supabase Structure

This directory is the scaffold-owned home for the Brightweb shared database module baselines and forward migrations that were selected for this project.

## Directory map

- `module-registry.json`: shared module dependency graph and migration source paths
- `config.toml`: standard Supabase CLI config for this project
- `migrations/*.sql`: CLI-ready ordered migrations for `supabase db push`
- `modules/core`: always-on platform foundations
- `modules/admin`: RBAC and privileged governance behavior
- `modules/crm`: organizations, CRM contacts, and invitation flows
- `modules/projects`: project and work-management data
- `clients/<client-slug>`: true client-only schema deltas plus the client stack plan
- `clients/<client-slug>`: client stack metadata and client-only migrations for this project

## Ownership rule

Shared database changes should be authored by ownership area, not by client app:

- `core` is applied to every client
- shared module migrations are applied only when that module is enabled for the client
- client-specific migrations are the exception, not the default

`create-bw-app` writes `supabase/clients/<slug>/stack.json` so the generated app modules and the database install plan stay aligned.

These module baselines are the project-local Brightweb install path for the selected stack. Future schema work should extend them with forward migrations instead of carrying historical cleanup sequences.

Maintainer references:

- `docs/internal/architecture/database-module-migration-structure.md`
- `docs/internal/architecture/database-migration-authoring-workflow.md`
- `docs/internal/architecture/database-migration-safety-policy.md`

## Authoring workflow

Create a new shared module migration:

```bash
pnpm db:new core profile_notification_cursor
pnpm db:new admin role_change_guard
pnpm db:new crm organization_invite_expiry
pnpm db:new projects task_due_date_index
```

Create a client-only migration:

```bash
pnpm db:new client:acme bespoke_reporting_table
```

The shipped `module-registry.json` records the shared module dependency graph for this project.

Projects created from the published scaffold should use the Supabase files in this folder directly. `supabase/migrations/*.sql` is the flat ordered layout that Supabase CLI reads, while `supabase/modules/*/migrations` remains the project-local modular source layout. Repo-level `db:materialize` is a deprecated Brightweb workspace compatibility command and is not the intended workflow for standalone generated apps.

## Related READMEs

- `supabase/modules/core/README.md`
- `supabase/modules/admin/README.md`
- `supabase/modules/crm/README.md`
- `supabase/modules/projects/README.md`
- `supabase/clients/README.md`
