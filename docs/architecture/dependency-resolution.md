# Dependency Resolution

BrightWeb resolves module order from the registry, not from ad hoc assumptions. The current chain is linear: **Core** first, then **Admin**, then **CRM**, then **Projects**.

## Current dependency rules

- **CRM requires Admin.** CRM policies and shared workflows assume the RBAC and governance layer already exists.
- **Projects requires CRM.** Projects attach to organizations and reuse CRM-owned organizational structure.
- **Admin depends on Core.** RBAC extends the shared profile and auth foundations in Core.

## Resolved install-order examples

| Install shape | Resolved order | Note |
| --- | --- | --- |
| Base only | Core → Admin | In workspace mode the generator keeps Admin governance enabled for platform auth and RBAC even if the admin UI surface is not selected. |
| Base + CRM | Core → Admin → CRM | CRM depends on Admin, so RBAC and governance land before CRM schema and logic. |
| Base + CRM + Projects | Core → Admin → CRM → Projects | Projects depends on CRM, so the install order is fully resolved before client-only migrations. |

## Where the order comes from

- `supabase/module-registry.json` defines the module graph.
- `scripts/_db-modules.mjs` resolves enabled modules into a concrete apply order.
- The scaffold generator mirrors that logic when it creates `supabase/clients/<slug>/stack.json` in workspace mode.

> Base-only nuance: even if the admin UI module is not selected as a starter surface, the current workspace generator still keeps Admin governance enabled when resolving the database stack for a platform app.

## Related docs

- [Platform Base](../foundations/platform-base.md)
- [Database Flow](./database-flow.md)
- [Modules](../modules/README.md)

## Repo sources

- `supabase/module-registry.json`
- `scripts/_db-modules.mjs`
- `packages/create-bw-app/src/generator.mjs`
- `supabase/README.md`
