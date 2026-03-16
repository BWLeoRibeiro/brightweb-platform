# CRM Module

The CRM module extends the platform with organizations, org membership, CRM contact data, status tracking, and invitation flows. It depends on the Admin layer because the current policies and privileged workflows assume RBAC is present.

> CRM builds on top of the `Core + Admin` platform baseline; selecting CRM adds CRM-owned schema, package wiring, and the starter CRM surface.

## What schema it installs

- Baseline tables: `organizations`, `organization_members`, `crm_contacts`, `crm_status_log`, and `organization_invitations`
- Follow-up migrations: acceptance linkage, address support, contact/profile linking, and generalized tax identifier fields on organizations

## What package and domain logic it provides

| Concern | Current behavior |
| --- | --- |
| CRM package | `@brightweblabs/module-crm` exports shell registration for CRM nav groups and toolbar routes. |
| Server helpers | The package exports server-side CRM data helpers such as `getCrmDashboardData()`. |
| Shared dependencies | The package reads shared platform tables such as `profiles` and `user_role_assignments` in addition to CRM-owned tables. |

## Whether it adds starter routes and wiring

| Concern | Current behavior |
| --- | --- |
| Scaffold wiring | Selecting CRM adds the package dependency and enables CRM-related shell/config wiring in generated platform apps. |
| Starter routes | The current module template contributes the `/playground/crm` starter surface in the scaffold. |
| Shell behavior | The module registration adds CRM navigation groups and toolbar route definitions. |
| Dependency behavior | CRM resolves on top of the existing `Core + Admin` platform baseline because its current policies and privileged workflows assume RBAC is present. |

> The CRM module does **not** install a full ready-made CRM frontend on its own. It provides shared schema, policies, helper functions, and a light starter surface. Product-specific UI remains application-owned.

## How to use it in an app

The current CRM package is primarily a server/data helper plus shell registration package.

### Load CRM data in a server page

```tsx
export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const { getCrmDashboardData } = await import("@brightweblabs/module-crm");
  const data = await getCrmDashboardData();

  return <pre>{JSON.stringify(data.stats, null, 2)}</pre>;
}
```

Use `getCrmDashboardData()` when you want the package to load and normalize the starter CRM dataset for a page or dashboard.

### Register CRM in the app shell

```ts
import { crmModuleRegistration } from "@brightweblabs/module-crm/registration";
```

Wire that registration into your app shell when you want CRM navigation groups and CRM toolbar route behavior.

### Build your own UI on top

The generated starter only proves that the package is connected. You are still expected to build application-owned CRM tables, forms, filters, create and update flows, and business-specific workflows on top of the returned data and installed schema.

For a broader integration overview, see [Using BrightWeb Modules](./using-modules.md).

## Related docs

- [Modules](./README.md)
- [Using BrightWeb Modules](./using-modules.md)
- [Projects](./projects.md)
- [Platform Base](./platform-base.md)

## Implementation references

- `supabase/modules/crm/migrations`
- `packages/module-crm/src/index.ts`
- `packages/module-crm/src/registration.ts`
- `packages/create-bw-app/template/modules/crm`
- `supabase/module-registry.json`
