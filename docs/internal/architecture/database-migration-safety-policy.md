# Database Migration Safety Policy

This policy defines how Brightweb evolves client databases safely from the Brightweb v1 module baseline onward.

## Core rule

Use forward migrations only.

Do not rewrite, reorder, or replay already-applied migration history casually.

## What this means

### Allowed

- add new migrations on top of the current real schema
- create new shared Brightweb migrations for future work
- create client-only forward migrations when truly needed
- refactor ownership in Brightweb docs and folders without changing the live database

### Not allowed

- editing SQL files that have already been applied to a deployed environment
- moving old migration files into a new order and replaying them as if history changed
- mixing baseline cleanup history into a fresh install path when the final shape is already known
- mixing one-off client behavior into shared module migrations

Brightweb is now the source of truth for future shared database work in:

- `supabase/modules/core`
- `supabase/modules/admin`
- `supabase/modules/crm`
- `supabase/modules/projects`
- `supabase/clients/<slug>`

## Safety model by client type

### Existing deployed stack

- treat the current database schema as authoritative
- do not attempt to reconstruct it by replaying rewritten folders
- apply only forward migrations from this point onward

### New client

- provision from Brightweb-owned module structure
- apply `core`
- apply enabled module migrations in dependency order
- apply client-only migrations only if needed

## Adoption rule for shared module work

When a new shared schema change is needed:

1. classify the change by owner: `core`, `admin`, `crm`, `projects`, or `client`
2. create a new forward migration in Brightweb
3. apply it only to clients that need that module
4. never “back-edit” already-applied history to pretend the structure existed earlier

## Release gate before applying SQL

Before any migration is applied to a real client database:

1. confirm target client and enabled modules
2. confirm the migration owner bucket is correct
3. confirm the change is forward-only
4. confirm whether it is shared or client-only
5. confirm rollback expectations
6. confirm affected tables, functions, triggers, and policies

## Special rule for RLS and helper functions

Changes to:

- RLS policies
- helper functions used in policies
- auth/profile sync functions
- admin role mutation functions

must be treated as high risk and reviewed as shared platform changes, not casual client tweaks.

## Practical summary

- deployed stacks keep their applied history intact
- Brightweb owns future shared migrations
- deployed stacks receive new schema changes as forward migrations only
- new clients should start from the Brightweb module baseline
