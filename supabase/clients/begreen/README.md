# BeGreen Database Adoption Policy

BeGreen is the first real client implementation and already has an applied flat migration history outside Brightweb.

## Source of historical truth

- `/Users/leoribeiro/Documents/02_Projects/BeGreen/2025-12_FullIdentity/03_Work/Website/Development/be-green/supabase/migrations`

## Rule

For BeGreen:

- do not rewrite old migration history
- do not attempt to reorder old SQL into Brightweb module folders and replay it
- treat the live BeGreen schema as the current baseline
- apply new Brightweb-owned changes as forward migrations only

## From now on

When BeGreen needs a new shared database change:

1. write the migration in Brightweb under the correct module owner
2. apply it to BeGreen as a forward migration
3. keep any truly unique BeGreen-only schema delta under `clients/begreen/migrations`

## When to use `clients/begreen/migrations`

Use this only when the change:

- is unique to BeGreen
- should not become a shared platform feature
- should not be applied to future clients by default

If a BeGreen-only change later becomes reusable, promote the concept into the correct shared module and stop extending the client-only path.
