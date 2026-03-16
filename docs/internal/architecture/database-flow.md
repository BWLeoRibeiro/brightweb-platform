# Database Flow

BrightWeb uses a modular database ownership model. Shared migrations live under module folders, client stacks declare enabled modules, and compatible tooling can plan or materialize an installable Supabase workdir from that resolved stack.

## Module migrations

- `supabase/modules/core` owns shared auth/profile, events, preferences, notification state, and rate-limit foundations.
- `supabase/modules/admin` owns RBAC, role assignment, role audit, and governance helpers.
- `supabase/modules/crm` owns organizations, CRM contacts, membership, invitations, and CRM-specific policies and helpers.
- `supabase/modules/projects` owns projects, tasks, milestones, links, activity, and project-specific access rules.

## Client stack files

> In workspace mode, a new platform app can get `supabase/clients/<slug>/stack.json` plus a client-only migrations folder. The stack records enabled modules, client migration path, and notes about the resolved database stack.

## Materialization

Materialization writes a generated Supabase workdir under `supabase/.generated/<client-slug>`. That workdir includes ordered migrations merged from Core, enabled modules, and client-only deltas, plus a generated `config.toml` and a `manifest.json` mapping the source of each migration.

## Use the existing commands

```bash
pnpm db:plan acme
pnpm db:materialize acme
```

```bash
pnpm db:new core profile_notification_cursor
pnpm db:new admin role_change_guard
pnpm db:new crm organization_invite_expiry
pnpm db:new projects task_due_date_index
pnpm db:new client:acme bespoke_reporting_table
```

## Baseline install vs forward-only upgrades

| Client type | Current rule |
| --- | --- |
| New client | Provision from the BrightWeb module structure: apply Core, then enabled shared modules in dependency order, then client-only migrations if needed. |
| Existing deployed stack | Treat the live schema as authoritative and apply new BrightWeb-owned changes as forward migrations only. |

## Practical flow

1. Choose the client and confirm its enabled modules.
2. Resolve apply order from the module registry and stack file.
3. Plan or materialize the generated Supabase workdir.
4. Apply new changes as forward migrations only.
5. Keep client-only migrations rare and isolated.

## Related docs

- [Dependency Resolution](./dependency-resolution.md)
- [Database Module Migration Structure](./database-module-migration-structure.md)
- [Database Migration Authoring Workflow](./database-migration-authoring-workflow.md)
- [Database Migration Safety Policy](./database-migration-safety-policy.md)

## Implementation references

- `docs/internal/architecture/database-module-migration-structure.md`
- `docs/internal/architecture/database-migration-authoring-workflow.md`
- `docs/internal/architecture/database-migration-safety-policy.md`
- `scripts/_db-modules.mjs`
