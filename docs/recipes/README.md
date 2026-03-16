# Examples and Recipes

These recipes stay intentionally practical and current. Where the repo does not expose a one-command workflow, the recipe is written as a manual checklist instead of pretending more automation exists than it does.

> Scaffolding examples default to the public `create-bw-app` CLI. Client stack planning and Supabase materialization steps are workspace-only and apply when the app lives inside this monorepo.

## Create a base app

```bash
pnpm dlx create-bw-app
# choose: platform
# choose: no optional modules
# then run the generated app with:
cd <slug>
pnpm dev
```

Inside this repo, `pnpm create:client` is the compatibility wrapper and `pnpm --filter <slug> dev` remains the workspace-specific run command.

## Add CRM later

> There is no documented one-command "add CRM to an existing app" installer today. Treat this as a manual workflow.

1. Add the CRM package and any required scaffold wiring the app needs.
2. Enable the CRM flag in the app environment and config where relevant.
3. Update `supabase/clients/<slug>/stack.json` so the client stack includes CRM.
4. Run `pnpm db:plan <slug>` to confirm the resolved order is Core → Admin → CRM.
5. Run `pnpm db:materialize <slug>` to generate the effective Supabase workdir.
6. Build the actual client UI on top of the shared CRM schema and package contracts.

## Add Projects later

> There is also no documented one-command "add Projects to an existing app" installer today. Projects should be treated as a manual extension of package wiring, client stack config, and app-owned UI work.

1. Add the Projects package and any required scaffold wiring the app needs.
2. Enable the Projects flag in the app environment and config where relevant.
3. Update `supabase/clients/<slug>/stack.json` so the client stack includes Projects.
4. Run `pnpm db:plan <slug>` and confirm the resolved order is Core → Admin → CRM → Projects.
5. Run `pnpm db:materialize <slug>` to generate the installable Supabase workdir.
6. Build the actual project-management UI inside the client app on top of the shared contracts.

## Run local Supabase for a client stack

```bash
pnpm db:plan <client-slug>
pnpm db:materialize <client-slug>
```

Materialization writes the generated Supabase workdir under `supabase/.generated/<client-slug>`.

## Related docs

- [Foundations](../foundations/README.md)
- [Getting Started](../foundations/getting-started.md)
- [Database Flow](../architecture/database-flow.md)
- [Modules](../modules/README.md)

## Repo sources

- `README.md`
- `supabase/README.md`
- `scripts/_db-modules.mjs`
- `packages/create-bw-app/src/generator.mjs`
- `packages/create-bw-app/template/base/config/modules.ts`
