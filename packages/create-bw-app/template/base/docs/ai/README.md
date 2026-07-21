# Agent Guide

This generated project follows BrightWeb's thin-app contract: environment values, settings, theme overrides, shell wiring, assets, migrations, docs, and direct package mounts only.

## Project shape

- `app/`: root layout plus direct package mounts.
- `config/`: brand, module, and shell settings.
- `public/brand/`: shell brand assets.
- `supabase/`: selected module migrations.
- `.env.local`: local service configuration.

## Editing strategy

- Change identity in `config/brand.ts` and visual tokens in `app/theme.css`.
- Use `config/shell.overrides.ts` for app-specific navigation or toolbar changes.
- Keep route files declarative: direct package re-exports, or one import plus one component return when Next.js requires a no-props page wrapper.
- Move any new UI, data access, state, or helpers to the owning package before mounting it.
- Projects intentionally contributes no route until its package ships a mountable UI surface.

## Validation checklist

1. Confirm `.env.local` is populated.
2. Run the app build or type check.
3. Validate each route listed in `docs/ai/app-context.json`.
4. Confirm new route files contain no JSX, function bodies, fetches, or state.
