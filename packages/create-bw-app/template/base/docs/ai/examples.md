# Agent Examples

## First local setup

- Fill `.env.local`.
- Review `config/brand.ts`, `config/modules.ts`, and `app/theme.css`.
- Run the app build.
- Validate the package routes listed in `docs/ai/app-context.json`.

## Add a product surface

- Implement and export the surface from its `@brightweblabs/*` package.
- Add any package contract entry and tests there.
- Add a route file containing only a direct package re-export.
- Register the route in module and shell settings.

## Customize the shell

- Keep package registrations intact.
- Put app-specific href or visibility changes in `config/shell.overrides.ts`.
- Rebuild and verify the affected mounted route.
