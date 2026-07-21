# Dependency Resolution

BrightWeb resolves module order from the registry, not from ad hoc assumptions. Core and Admin establish the base, Organizations builds on them, and CRM and Projects independently build on Organizations.

## Current dependency rules

- **Organizations requires Admin.** Its policies and privileged workflows assume the RBAC and governance layer already exists.
- **CRM requires Organizations.** CRM contacts attach to shared organization records.
- **Projects requires Organizations.** Projects attach to organizations without requiring CRM.
- **Admin depends on Core.** RBAC extends the shared profile and auth foundations in Core.

## Resolved install-order examples

| Install shape | Resolved order | Note |
| --- | --- | --- |
| Base only | Core → Admin | Platform always resolves to the `Core + Admin` database baseline; selecting Admin only controls whether the Admin package mount and wiring are scaffolded. |
| Base + CRM | Core → Admin → Organizations → CRM | Shared organization schema lands before CRM contacts and integration seams. |
| Base + Projects | Core → Admin → Organizations → Projects | Projects receives organization structure without installing CRM. |
| Base + CRM + Projects | Core → Admin → Organizations → CRM → Projects | CRM and Projects share Organizations; requested module order breaks the tie between the two leaf modules. |

## Where the order comes from

- `supabase/module-registry.json` defines the module graph.
- `scripts/_db-modules.mjs` resolves enabled modules into a concrete apply order.

> Base-only nuance: platform always resolves to the `Core + Admin` database baseline; selecting Admin only controls whether the Admin package mount and wiring are scaffolded.

## Related docs

- [Platform Base](../../modules/platform-base.md)
- [Database Flow](./database-flow.md)
- [Modules](../../modules/README.md)

## Implementation references

- `supabase/module-registry.json`
- `scripts/_db-modules.mjs`
- `packages/create-bw-app/src/generator.mjs`
- `supabase/README.md`
