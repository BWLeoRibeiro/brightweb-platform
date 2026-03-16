# Dependency Resolution

BrightWeb resolves module order from the registry, not from ad hoc assumptions. The current chain is linear: **Core** first, then **Admin**, then **CRM**, then **Projects**.

## Current dependency rules

- **CRM requires Admin.** CRM policies and shared workflows assume the RBAC and governance layer already exists.
- **Projects requires CRM.** Projects attach to organizations and reuse CRM-owned organizational structure.
- **Admin depends on Core.** RBAC extends the shared profile and auth foundations in Core.

## Resolved install-order examples

| Install shape | Resolved order | Note |
| --- | --- | --- |
| Base only | Core → Admin | Platform always resolves to the `Core + Admin` database baseline; selecting Admin only controls whether the Admin starter UI and package wiring are scaffolded. |
| Base + CRM | Core → Admin → CRM | CRM depends on Admin, so RBAC and governance land before CRM schema and logic. |
| Base + CRM + Projects | Core → Admin → CRM → Projects | Projects depends on CRM, so the install order is fully resolved before client-only migrations. |

## Where the order comes from

- `supabase/module-registry.json` defines the module graph.
- `scripts/_db-modules.mjs` resolves enabled modules into a concrete apply order.

> Base-only nuance: platform always resolves to the `Core + Admin` database baseline; selecting Admin only controls whether the Admin starter UI and package wiring are scaffolded.

## Related docs

- [Platform Base](../../modules/platform-base.md)
- [Database Flow](./database-flow.md)
- [Modules](../../modules/README.md)

## Implementation references

- `supabase/module-registry.json`
- `scripts/_db-modules.mjs`
- `packages/create-bw-app/src/generator.mjs`
- `supabase/README.md`
