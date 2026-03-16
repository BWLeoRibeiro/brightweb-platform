# Brightweb Supabase Structure

This directory is the canonical home for the Brightweb database baseline and its forward migrations.

## Directory map

- `module-registry.json`: shared module dependency graph and migration source paths
- `modules/core`: always-on platform foundations
- `modules/admin`: RBAC and privileged governance behavior
- `modules/crm`: organizations, CRM contacts, and invitation flows
- `modules/projects`: project and work-management data
- `clients/<client-slug>`: true client-only schema deltas plus the client stack plan
- `.generated/<client-slug>`: materialized Supabase workdirs produced by `pnpm db:materialize`

## Ownership rule

Shared database changes should be authored by ownership area, not by client app:

- `core` is applied to every client
- shared module migrations are applied only when that module is enabled for the client
- client-specific migrations are the exception, not the default

In workspace scaffold mode, `create-bw-app` writes `supabase/clients/<slug>/stack.json` so the generated app modules and the database install plan stay aligned.

The module baselines in this repo are the canonical Brightweb v1 install path. Future schema work should extend them with forward migrations instead of carrying historical cleanup sequences.

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

Print the effective apply order for a client:

```bash
pnpm db:plan acme
```

Materialize an installable Supabase workdir for a client stack:

```bash
pnpm db:materialize acme
```

This writes a generated workdir under `supabase/.generated/<client-slug>` with:

- ordered migrations merged from `core`, enabled modules, and client-only deltas
- a generated `config.toml`
- a `manifest.json` showing the source file for each materialized migration

## Related READMEs

- `supabase/modules/core/README.md`
- `supabase/modules/admin/README.md`
- `supabase/modules/crm/README.md`
- `supabase/modules/projects/README.md`
- `supabase/clients/README.md`
