# Validate Your Starter

This page is the first-run checklist for a freshly generated app. Use it after installation so you can confirm the generated routes, env readiness, and starter config all match what the scaffold promises today.

## Platform validation path

Start the generated app, then check the routes in this order.

| Route | What you should see | What a non-green state usually means |
| --- | --- | --- |
| `/` | Starter home page with brand details, env readiness, enabled modules, and links to preview routes. | The page can still load before every env key is set. Expect “Setup in progress” until the required values are present. |
| `/bootstrap` | Client bootstrap checklist with identity, environment, services, enabled modules, and launch readiness sections. | “Blocked” or missing checks mean the generated env keys still need real values. |
| `/preview/app-shell` | The generated app-shell preview based on `config/shell.ts` and the enabled module registrations. | Missing or incomplete nav items usually mean the shell config or `config/modules.ts` do not match your intended starter state. |
| `/playground/auth` | Shared auth playground for validating the platform auth layer. | Callback or auth failures usually point to missing `NEXT_PUBLIC_APP_URL` or incomplete Supabase Auth setup. |
| `/playground/crm` | CRM playground route if CRM was selected. It should either show a connected snapshot or a configuration-required panel. | A warning state usually means the CRM schema or required Supabase keys are missing. |
| `/playground/projects` | Projects playground route if Projects was selected. It should either show a portfolio snapshot or a configuration-required panel. | A warning state usually means the Projects schema or required Supabase keys are missing. |
| `/playground/admin` | Admin playground route if Admin was selected. It should either show a governance snapshot or a configuration-required panel. | A warning state usually means the admin schema, admin-side env keys, or role-ready data are missing. |

## Site validation path

The site starter has a lighter validation loop.

1. Run the generated app.
2. Open `/`.
3. Confirm the homepage renders with the generated `config/site.ts` values.
4. Change the site name, description, or CTA labels in `config/site.ts`.
5. Refresh the page and confirm those edits are visible immediately.
6. Make one visual change in `app/globals.css` and confirm the starter reflects the updated tokens or typography.

## What counts as a successful first run

### Platform

- The app boots locally without missing dependency errors.
- `/` and `/bootstrap` render and describe the current setup truthfully.
- The generated module routes exist only for the modules you enabled.
- The non-connected states are understandable enough for you to tell which external value or schema piece is still missing.

### Site

- The homepage renders locally without any env setup.
- `config/site.ts` changes show up in the rendered page.
- The starter visual language changes when you edit `app/globals.css`.

## If the platform starter is not ready yet

- Re-check the values in `.env.local`.
- Review `config/brand.ts` and `config/modules.ts` for starter state that no longer belongs in env.
- Confirm the target Supabase project contains the schema required by the enabled modules.
- Re-run the route checks above and use the starter error panels as the current source of truth.

## Related docs

- [Installation](./installation.md)
- [Environment and Services](./environment-and-services.md)
- [Project Structure](./project-structure.md)
- [Platform First Run](../recipes/platform-first-run.md)
