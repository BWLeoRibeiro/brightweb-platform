# Validate Your Starter

A generated app is deliberately thin. Validate settings, dependency wiring, migrations, and the package-owned surfaces that were selected; do not expect demo or placeholder pages.

## Platform validation

1. Fill `.env.local` and confirm `NEXT_PUBLIC_APP_URL` matches the current environment.
2. Run the app build or type check.
3. Check `config/brand.ts`, `config/modules.ts`, `config/shell.ts`, and `config/shell.overrides.ts`.
4. Validate the mounted routes that apply:

| Module | Generated route | Expected result |
| --- | --- | --- |
| CRM | `/crm` | The package-owned CRM dashboard loads with configured auth and schema. |
| Admin | `/admin/users` | The package-owned users surface loads for an admin user. |
| Projects | None | Package and migrations are installed; no default UI or generated navigation ships yet. |

The generated CRM and Admin API routes are direct aliases of package-owned handlers. Auth ships as package wiring only and has no playground.

## Site validation

The site scaffold has settings, theme tokens, root layout wiring, and no default feature route. Run its build, review `config/site.ts` and `app/globals.css`, then mount a package-owned surface when one is ready.

## Thinness check

Every scaffolded `route.ts` is a direct package re-export. A `page.tsx` may use a no-props wrapper whose only statement mounts one imported package component. State, fetches, branching, demos, and helper libraries belong in packages.

## Related docs

- [Installation](./installation.md)
- [Environment and Services](./environment-and-services.md)
- [Project Structure](./project-structure.md)
- [Platform First Run](../recipes/platform-first-run.md)
