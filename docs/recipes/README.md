# Examples and Recipes

This section stays intentionally practical. When BrightWeb does not expose a one-command workflow, the recipe is written as a manual checklist instead of pretending more automation exists than it does.

## What these pages are for

- starting from the public scaffold and validating the starter routes
- understanding what still needs manual work after generation
- extending a generated app with shared modules after the first scaffold

## Baseline scaffold example

```bash
pnpm dlx create-bw-app
# choose: platform
# choose: no optional modules
# then run the generated app with:
cd <slug>
pnpm dev
```

Some BrightWeb workspaces also provide `pnpm create:client` as a wrapper and `pnpm --filter <slug> dev` as the workspace-specific run command.

## Manual follow-up reality

- There is no documented one-command installer today for adding CRM to an existing app after scaffold time.
- There is no documented one-command installer today for adding Projects to an existing app after scaffold time.
- Treat both as manual extensions of package wiring, env/config changes, and app-owned product UI work.

## Related docs

- [Getting Started](../foundations/README.md)
- [Installation](../foundations/installation.md)
- [Modules](../modules/README.md)

## Implementation references

- `supabase/README.md`
- `scripts/_db-modules.mjs`
- `packages/create-bw-app/src/generator.mjs`
- `packages/create-bw-app/template/base/config/modules.ts`
