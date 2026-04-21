# CRM Module

The CRM module extends the platform with organizations, org membership, CRM contact data, status tracking, and invitation flows. It depends on the Admin layer because the current policies and privileged workflows assume RBAC is present.

> CRM builds on top of the `Core + Admin` platform baseline; selecting CRM adds CRM-owned schema, package wiring, and the starter CRM surface.

Use [Base Contract](./base-contract.md) for the support-tier rules and [base-contract.json](./base-contract.json) for the canonical symbol inventory.

## What schema it installs

- Baseline tables: `organizations`, `organization_members`, `crm_contacts`, `crm_status_log`, and `organization_invitations`
- Follow-up migrations: acceptance linkage, address support, contact/profile linking, and generalized tax identifier fields on organizations

## What package and domain logic it provides

| Concern | Current behavior |
| --- | --- |
| CRM package | `@brightweblabs/module-crm` exports shell registration for CRM nav groups and toolbar routes. |
| Server helpers | The package exports reusable CRM list and stats helpers plus the starter `getCrmDashboardData()` helper. |
| Route handlers | The package exports package-owned GET handlers for CRM contacts, organizations, stats, and owner options. |
| Shared dependencies | The package reads shared platform tables such as `profiles` and `user_role_assignments` in addition to CRM-owned tables. |

## Whether it adds starter routes and wiring

| Concern | Current behavior |
| --- | --- |
| Scaffold wiring | Selecting CRM adds the package dependency and enables CRM-related shell/config wiring in generated platform apps. |
| Starter routes | The current module template contributes the `/playground/crm` starter surface plus `/api/crm/contacts`, `/api/crm/organizations`, `/api/crm/stats`, and `/api/crm/owners`. |
| Shell behavior | The module registration adds CRM navigation groups and toolbar route definitions. |
| Dependency behavior | CRM resolves on top of the existing `Core + Admin` platform baseline because its current policies and privileged workflows assume RBAC is present. |

> The CRM module does **not** install a full ready-made CRM frontend on its own. It provides shared schema, policies, helper functions, and a light starter surface. Product-specific UI remains application-owned.

## Supported base contract

The current CRM contract is intentionally small:

### Stable

- `@brightweblabs/module-crm/registration`: `crmModuleRegistration`
- `@brightweblabs/module-crm`: `listCrmContacts()`
- `@brightweblabs/module-crm`: `listCrmOrganizations()`
- `@brightweblabs/module-crm`: `getCrmContactStatusStats()`
- `@brightweblabs/module-crm`: `listCrmOwnerOptions()`
- `@brightweblabs/module-crm`: `listCrmPrimaryContacts()`
- `@brightweblabs/module-crm`: `listCrmStatusTimeline()`
- `@brightweblabs/module-crm`: `handleCrmContactsGetRequest()`
- `@brightweblabs/module-crm`: `handleCrmOrganizationsGetRequest()`
- `@brightweblabs/module-crm`: `handleCrmStatsGetRequest()`
- `@brightweblabs/module-crm`: `handleCrmOwnersGetRequest()`

### Starter

- `@brightweblabs/module-crm`: `getCrmDashboardData()`

The starter helper is public because it helps a new app move quickly, but it is not the recommended long-term contract for app-owned CRM product logic. The stable CRM contract is now the smaller list/stats/owner helper set plus the package-owned GET handlers.

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

Treat this helper as starter page glue. It is the fastest way to prove the CRM module is wired, not the long-term reusable CRM contract.

### Build on the stable CRM helpers

```ts
import {
  getCrmContactStatusStats,
  listCrmContacts,
  listCrmOrganizations,
  listCrmStatusTimeline,
} from "@brightweblabs/module-crm";

const [contacts, organizations, stats, timeline] = await Promise.all([
  listCrmContacts(supabase, { page: 1, pageSize: 50 }),
  listCrmOrganizations(supabase, { page: 1, pageSize: 20 }),
  getCrmContactStatusStats(supabase),
  listCrmStatusTimeline(supabase),
]);
```

Use these helpers when you want reusable CRM primitives that an app or AI agent can compose into its own tables, dashboards, filters, and ownership flows.

Keep authentication at the page or route boundary, then pass the authenticated server Supabase client into the helpers you need. This lets larger apps progressively load sections and avoid dashboard-only overfetch. For example, an initial contacts page can load `listCrmContacts()`, `listCrmOrganizations()`, `getCrmContactStatusStats()`, and `listCrmStatusTimeline()` without also loading `listCrmOwnerOptions()` or `listCrmPrimaryContacts()`. Apps with custom ownership or role rules can replace `listCrmOwnerOptions()` with app-owned logic while still using the other CRM helpers.

`getCrmDashboardData()` remains backward-compatible and now composes these helpers internally. Treat it as starter page glue for generated apps, not as the only supported CRM loading shape.

### Mount the CRM GET handlers

```ts
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { handleCrmContactsGetRequest } = await import("@brightweblabs/module-crm");
  return handleCrmContactsGetRequest(request);
}
```

The current starter mounts:

- `/api/crm/contacts`
- `/api/crm/organizations`
- `/api/crm/stats`
- `/api/crm/owners`

### Register CRM in the app shell

```ts
import { crmModuleRegistration } from "@brightweblabs/module-crm/registration";
```

Wire that registration into your app shell when you want CRM navigation groups and CRM toolbar route behavior.

### Build your own UI on top

The generated starter only proves that the package is connected. You are still expected to build application-owned CRM tables, forms, filters, create and update flows, and business-specific workflows on top of the returned data and installed schema.

## How To Build On This

- Build on the `stable` CRM helpers and handlers first when you want reusable contacts, organizations, stats, and owner options.
- Build on the `stable` CRM shell registration when you want shared CRM navigation and toolbar wiring.
- Use `getCrmDashboardData()` when you want the current scaffolded CRM page payload quickly.
- Replace or wrap the starter helper once the client app needs different CRM slices, workflows, or page composition.
- Do not treat the current starter dashboard payload as the final CRM contract for every project.

For a broader integration overview, see [Using BrightWeb Modules](./using-modules.md).

## Related docs

- [Modules](./README.md)
- [Base Contract](./base-contract.md)
- [Using BrightWeb Modules](./using-modules.md)
- [Projects](./projects.md)
- [Platform Base](./platform-base.md)

## Implementation references

- `supabase/modules/crm/migrations`
- `packages/module-crm/src/index.ts`
- `packages/module-crm/src/data.ts`
- `packages/module-crm/src/handlers.ts`
- `packages/module-crm/src/registration.ts`
- `packages/create-bw-app/template/modules/crm`
- `supabase/module-registry.json`
