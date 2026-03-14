# Brightweb Supabase Structure

This directory is the canonical home for shared database architecture owned by `brightweb-platform`.

## Goal

Shared database changes should be authored by ownership area, not by client app:

- `modules/core`
- `modules/admin`
- `modules/crm`
- `modules/projects`
- `clients/<client-slug>`

## Rule

- `core` is applied to every client.
- Module migrations are applied only when that module is enabled for the client.
- Client-specific migrations are the exception, not the default.

## Historical source

The original shared migration history still lives in BeGreen under:

- `/Users/leoribeiro/Documents/02_Projects/BeGreen/2025-12_FullIdentity/03_Work/Website/Development/be-green/supabase/migrations`

That folder remains the source of the already-shipped SQL history for BeGreen.

This `platform/supabase` structure now contains the Brightweb-owned greenfield module migrations plus
the planning/materialization workflow for composing client-specific install order.

See:

- `docs/architecture/database-module-migration-structure.md`
- `docs/architecture/database-migration-classification.md`
- `docs/architecture/database-migration-authoring-workflow.md`
- `docs/architecture/database-migration-safety-policy.md`

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
pnpm db:new client:begreen bespoke_reporting_table
```

Print the effective apply order for a client:

```bash
pnpm db:plan begreen
```

Materialize an installable Supabase workdir for a client stack:

```bash
pnpm db:materialize begreen
```

This writes a generated workdir under `supabase/.generated/<client-slug>` with:

- ordered migrations merged from `core`, enabled modules, and client-only deltas
- a generated `config.toml`
- a `manifest.json` showing the source file for each materialized migration
