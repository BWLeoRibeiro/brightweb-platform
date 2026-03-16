# Platform First Run

Use this recipe when you have just scaffolded a `platform` app and want to get from the generated files to a trustworthy local validation pass.

## When to use it

- You scaffolded a `platform` app with `create-bw-app`
- You want to confirm the generated routes and starter config before building product-specific UI
- You need a simple path that stays aligned with the public scaffold behavior

## Starting point

- A newly generated platform app
- The generated `.env.local` file in the project root
- Access to the Supabase and Resend values you want to use locally

## Steps

1. Scaffold the app.

   ```bash
   pnpm dlx create-bw-app
   ```

2. Review `config/brand.ts` and `config/modules.ts`.
3. Fill the real service values in `.env.local`.
4. Install dependencies if you skipped install during scaffold time.
5. Run the app locally.
6. Open `/`, `/bootstrap`, `/preview/app-shell`, and `/playground/auth`.
7. If you enabled CRM, Projects, or Admin, also open the matching `/playground/*` route for each selected module.

## Validation checks

- `/` shows the expected brand, enabled modules, and setup status.
- `/bootstrap` reflects the current env and service state instead of stale placeholder information.
- `/preview/app-shell` shows the expected nav and module registrations for the selected module set.
- `/playground/auth` renders the auth sandbox.
- Optional module routes either connect successfully or show a clear configuration-required state.

## What remains app-owned

- The real product routes, page composition, and interface design
- The final auth UX beyond the starter validation surfaces
- Module-specific product workflows, forms, tables, and task flows

## Related docs

- [Installation](../foundations/installation.md)
- [Environment and Services](../foundations/environment-and-services.md)
- [Validate Your Starter](../foundations/validate-your-starter.md)
- [Modules](../modules/README.md)
