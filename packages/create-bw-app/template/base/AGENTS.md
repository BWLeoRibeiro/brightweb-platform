# AGENTS.md

This is a thin BrightWeb platform app. The app owns environment values and settings; reusable UI, domain behavior, and helpers belong in `@brightweblabs/*` packages.

## Start here

- `README.md`: setup commands and mounted package routes.
- `docs/ai/app-context.json`: machine-readable module, path, and ownership summary.
- `config/brand.ts`: client identity and contact defaults.
- `config/modules.ts`: selected module set and route metadata.
- `config/shell.overrides.ts`: app-owned shell customizations.
- `app/theme.css`: app-owned theme token overrides.
- `.env.local`: runtime service values.

## Working rules

- Keep every `route.ts` as a direct package re-export; a `page.tsx` may instead import one package component and return only that mount.
- Do not add feature components, demos, hooks, data access, or helper libraries to this app.
- Put reusable behavior in the owning package, then mount its export here.
- Keep identity and theme changes in config and theme files.
- Check `config/modules.ts` before assuming an optional route exists. Projects currently has no default UI route.

## First validation pass

1. Fill `.env.local` with real service values.
2. Run the local type check or build.
3. Validate `/crm` and `/admin/users` only when their modules are enabled.
