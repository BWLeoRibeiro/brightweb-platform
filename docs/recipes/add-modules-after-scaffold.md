# Add Modules After Scaffold

Use `bw add` to add package wiring, thin mounts, and migrations to an existing generated platform app.

```bash
bw add projects --dry-run
bw add projects
pnpm install
```

The command resolves transitive requirements, updates package and shell settings, copies direct package mounts, appends unapplied Supabase migrations, and updates `.brightweb/app-manifest.json`.

## Generated mounts

- CRM: `app/crm/page.tsx` plus direct package handler aliases under `app/api/crm/`.
- Admin: `app/admin/users/page.tsx` plus direct package handler aliases under `app/api/admin/users/`.
- Marketing: `app/marketing/page.tsx` plus campaign, topic, segment, workflow, analytics, worker, webhook, and unsubscribe routes under `app/api/marketing/`.
- Projects: package-owned staff routes under `app/projetos/`, client account routes, and direct adapters under `app/api/projects/` and `app/api/account/projects/`.

Generated product pages remain thin direct package mounts. Customize reusable behavior in the owning package, or mark an app route as owned before replacing its starter composition.

## Validation checks

- The dependency and `transpilePackages` entries exist.
- `config/modules.ts` and `config/shell.ts` expose the selected module.
- New route files contain only direct `@brightweblabs/*` re-exports.
- Required migrations are present and applied through the normal database workflow.

## Related docs

- [The `bw` CLI](../foundations/bw-cli.md)
- [Using BrightWeb Modules](../modules/using-modules.md)
- [Validate Your Starter](../foundations/validate-your-starter.md)
