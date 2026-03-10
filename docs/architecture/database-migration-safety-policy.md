# Database Migration Safety Policy

This policy defines how Brightweb evolves client databases safely while moving from BeGreen-first history to Brightweb-owned module migrations.

## Core rule

Use forward migrations only.

Do not rewrite, reorder, or replay already-applied production migration history casually.

## What this means

### Allowed

- add new migrations on top of the current real schema
- create new shared Brightweb migrations for future work
- create client-only forward migrations when truly needed
- refactor ownership in Brightweb docs and folders without changing the live database

### Not allowed

- editing historical BeGreen SQL files that have already been applied to production
- moving old migration files into a new order and replaying them as if history changed
- assuming a fresh client can safely replay BeGreen’s entire flat history without review
- mixing one-off client behavior into shared module migrations

## Current state

BeGreen is the first real client and already has a flat migration history in:

- `/Users/leoribeiro/Documents/02_Projects/BeGreen/2025-12_FullIdentity/03_Work/Website/Development/be-green/supabase/migrations`

Brightweb is now the source of truth for future shared database work in:

- `supabase/modules/core`
- `supabase/modules/admin`
- `supabase/modules/crm`
- `supabase/modules/projects`
- `supabase/clients/<slug>`

## Safety model by client type

### Existing client: BeGreen

- treat the current database schema as authoritative
- do not attempt to reconstruct it by replaying newly reorganized Brightweb folders
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
4. never “back-edit” old BeGreen history to pretend the structure existed earlier

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

- BeGreen production history stays intact
- Brightweb owns future shared migrations
- BeGreen receives new schema changes as forward migrations only
- new clients should start from Brightweb module-based schema, not from BeGreen’s historical flat folder
