# UI vs Domain Modules

The current BrightWeb model separates reusable package ownership from product-specific application ownership. Shared modules own schema, policies, contracts, domain logic, HTTP behavior, and the reusable default UI. Applications own identity, configuration, route placement, service composition, and deliberate product-specific replacements.

| Owned by shared platform | Owned by application |
| --- | --- |
| Database tables, migrations, policies, and helper functions. | Product identity, enabled-module configuration, and environment values. |
| Shared domain helpers, handlers, UI clients, and package exports from `@brightweblabs/*`. | Server-only provider composition and secrets at the generated route boundary. |
| Complete reusable CRM, Marketing, Projects, Admin, auth, and shell surfaces. | Client-specific workflows or UI that materially differ from the shared product contract. |
| Thin route components and handler adapters used by generated apps. | Route ownership decisions and intentional forks recorded in the app manifest. |

## What the optional modules are today

- Shared schema and RLS ownership.
- Shared server and domain queries, helper functions, and package contracts.
- Package-owned default UI, loading states, toolbar controls, and injectable clients.
- Package-owned route pages or thin route-handler adapters mounted by the scaffold.
- A complete fast-start product surface that can be replaced when an app needs a genuinely different workflow.

> A module is both a domain package and a reusable frontend package. The generated application remains thin because it mounts those package surfaces instead of copying them locally.

## What may come later

Package UI can continue moving from `starter` to `stable` as its customization contracts mature. Product-specific divergence should still live behind an app-owned route or return to the package when it is broadly reusable.

## Related docs

- [Modules](../../modules/README.md)
- [Modules: CRM](../../modules/crm.md)
- [Modules: Marketing](../../modules/marketing.md)
- [Modules: Projects](../../modules/projects.md)

## Implementation references

- `README.md`
- `packages/module-crm/src`
- `packages/module-marketing/src`
- `packages/module-projects/src`
- `packages/create-bw-app/template/modules`
- `packages/ui/src`
