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
- Projects: no route until `@brightweblabs/module-projects` exports a default UI surface.

Do not create a placeholder Projects page. If a product needs Projects UI, implement it in the package first and mount the exported surface from a one-line route.

## Validation checks

- The dependency and `transpilePackages` entries exist.
- `config/modules.ts` and `config/shell.ts` expose the selected module.
- New route files contain only direct `@brightweblabs/*` re-exports.
- Required migrations are present and applied through the normal database workflow.

## Related docs

- [The `bw` CLI](../foundations/bw-cli.md)
- [Using BrightWeb Modules](../modules/using-modules.md)
- [Validate Your Starter](../foundations/validate-your-starter.md)
