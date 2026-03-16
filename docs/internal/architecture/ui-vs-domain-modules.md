# UI vs Domain Modules

The current BrightWeb model separates shared platform ownership from application ownership. Shared modules own schema, policies, contracts, and domain and server logic. Applications built on BrightWeb own the actual product UI built on top of those shared layers.

| Owned by shared platform | Owned by application |
| --- | --- |
| Database tables, migrations, policies, and helper functions. | Product-specific page composition, flows, and interface design. |
| Shared domain helpers and package exports from `@brightweblabs/*` packages. | UI states and experiences that reflect the client product, not the generic platform baseline. |
| Light starter wiring such as shell registration, starter playground routes, and env flags. | The full working CRM, Projects, or admin experience the client ultimately ships. |

## What the optional modules are today

- Shared schema and RLS ownership.
- Shared server and domain queries, helper functions, and package contracts.
- Light starter surfaces to exercise package behavior in a scaffold.
- Not a drop-in finished frontend product.

> If you describe CRM or Projects as a full frontend module install, you will misrepresent the platform. The safer and more accurate statement is: these modules mainly install shared schema, logic, contracts, and starter wiring.

## What may come later

Optional shared UI packages may appear over time, but that is not the current platform delivery model. The docs should describe the current model, not a future possibility.

## Related docs

- [Modules](../../modules/README.md)
- [Modules: CRM](../../modules/crm.md)
- [Modules: Projects](../../modules/projects.md)

## Implementation references

- `README.md`
- `packages/module-crm/src`
- `packages/module-projects/src`
- `packages/create-bw-app/template/modules`
- `packages/ui/src`
