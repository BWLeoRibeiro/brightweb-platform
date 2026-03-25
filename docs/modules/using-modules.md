# Using BrightWeb Modules

This page explains how the shared BrightWeb modules are consumed in a generated app.

The shared modules are currently consumed through:

- package entrypoints
- generated scaffold wiring
- server-side page helpers
- shell registration objects
- a small number of route handlers

Use this page together with the per-module pages when you need to answer both of these questions:

1. What does this module install?
2. How do I actually use it in an app?

Use [Base Contract](./base-contract.md) for the support-tier rules and [base-contract.json](./base-contract.json) when you need the canonical machine-readable inventory.

## Integration model

In a generated platform app, module usage usually happens in 3 places:

1. `config/modules.ts` decides which modules are enabled.
2. `config/shell.ts` wires each enabled module registration into `@brightweblabs/app-shell`.
3. App routes call the module package directly for server data, route handlers, or auth helpers.

That means BrightWeb module usage is primarily a package and wiring model. The stable base contract sits inside that model, but this page is focused on how those pieces get used in a real app.

## Typical entrypoints

| Package | Typical entrypoints | Support tier | What you use them for |
| --- | --- | --- | --- |
| `@brightweblabs/core-auth/shared` | `AUTH_RESEND_COOLDOWN_SECONDS`, `validateEmail()`, `validatePassword()`, `buildSignupCallbackUrl()`, `buildResetPasswordRedirectUrl()` | `stable` | Shared auth validation, constants, and URL derivation. |
| `@brightweblabs/core-auth/client` | `useCooldownTimer()` | `stable` | Client-side auth UI behavior such as resend cooldowns. |
| `@brightweblabs/core-auth/server` | `requireServerPageAccess()`, `requireServerPageRoleAccess()`, `getServerAccess()` | `stable` | Server-side auth and role gating in pages, layouts, and handlers. |
| `@brightweblabs/infra/server` | `resendApiRequest()`, `verifyResendWebhookSignature()`, `getTransactionalSender()`, `getMarketingSender()`, `getContactDestination()`, `getResendWebhookSecret()` | `stable` | Canonical app-owned Resend transport and webhook verification helpers. |
| `@brightweblabs/module-admin` | `listAdminUsers()`, `handleAdminUsersGetRequest()`, `handleAdminUsersRoleChangeRequest()` | `stable` | Reusable admin listing plus package-owned admin HTTP handlers. |
| `@brightweblabs/module-admin` | `getAdminUsersPageData()` | `starter` | Starter admin page payload for the scaffolded users screen. |
| `@brightweblabs/module-admin/registration` | `adminModuleRegistration` | `stable` | Admin app-shell navigation and toolbar registration. |
| `@brightweblabs/module-crm` | `listCrmContacts()`, `listCrmOrganizations()`, `getCrmContactStatusStats()`, `listCrmOwnerOptions()` | `stable` | Reusable CRM list, stats, and owner-option primitives for app-owned CRM UIs and workflows. |
| `@brightweblabs/module-crm` | `handleCrmContactsGetRequest()`, `handleCrmOrganizationsGetRequest()`, `handleCrmStatsGetRequest()`, `handleCrmOwnersGetRequest()` | `stable` | Package-owned CRM GET handlers that can be mounted directly from Next.js routes. |
| `@brightweblabs/module-crm` | `getCrmDashboardData()` | `starter` | Starter CRM dashboard payload for the scaffolded CRM page. |
| `@brightweblabs/module-crm/registration` | `crmModuleRegistration` | `stable` | CRM app-shell navigation groups and toolbar registration. |
| `@brightweblabs/module-projects` | `listProjects()`, `getProjectPortfolioStats()`, `getProjectDashboard()`, `listProjectTasks()`, `listProjectMilestones()`, `listProjectLinks()`, `getClientProjectHealth()` | `stable` | Reusable project portfolio, detail, and client-health helpers. |
| `@brightweblabs/module-projects` | `createProject()`, `createProjectOrganization()`, `updateProject()`, `deleteProject()`, `createProjectTask()`, `updateProjectTask()`, `deleteProjectTask()`, `createProjectMilestone()`, `updateProjectMilestone()`, `deleteProjectMilestone()`, `createProjectLink()`, `updateProjectLink()`, `deleteProjectLink()`, `listProjectAssignableProfiles()`, `syncProjectMembers()`, `listOrgAdminProjectsByProfile()` | `stable` | App-owned project write flows and assignment helpers. |
| `@brightweblabs/module-projects` | `getProjectsPortfolioPageData()` | `starter` | Starter portfolio payload for the scaffolded projects page. |
| `@brightweblabs/module-projects/registration` | `projectsModuleRegistration` | `stable` | Projects app-shell navigation and toolbar registration. |

For the full symbol-level classification, including `internal` exports that are visible in source but not part of the supported promise, use [base-contract.json](./base-contract.json).

## Common usage patterns

### 1. Read module data in a server route or page

The current starters call the module packages directly from server pages.

```tsx
export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const { getCrmDashboardData } = await import("@brightweblabs/module-crm");
  const data = await getCrmDashboardData();

  return <pre>{JSON.stringify(data.stats, null, 2)}</pre>;
}
```

The same pattern exists for the Projects and Admin starters:

```tsx
const { getProjectsPortfolioPageData } = await import("@brightweblabs/module-projects");
const portfolio = await getProjectsPortfolioPageData();
```

```tsx
import { requireServerPageAccess } from "@brightweblabs/core-auth/server";

export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const { supabase } = await requireServerPageAccess();
  const { getProjectDashboard } = await import("@brightweblabs/module-projects");
  const project = await getProjectDashboard(supabase, params.projectId);

  return <pre>{JSON.stringify(project.project, null, 2)}</pre>;
}
```

```tsx
const { getAdminUsersPageData } = await import("@brightweblabs/module-admin");
const { users } = await getAdminUsersPageData();
```

Use these helpers when you want the package to own the initial query and normalization logic. Then build your own UI on top of the returned data.

If you need a longer-lived reusable surface, prefer the `stable` helpers from the manifest over starter page helpers.

For CRM specifically, the stable path is now the smaller helper set:

```ts
const [contacts, organizations, stats, owners] = await Promise.all([
  listCrmContacts(supabase, { page: 1, pageSize: 50 }),
  listCrmOrganizations(supabase, { page: 1, pageSize: 20 }),
  getCrmContactStatusStats(supabase),
  listCrmOwnerOptions(supabase),
]);
```

### 2. Register module navigation and toolbar behavior in the shell

If your app uses `@brightweblabs/app-shell`, wire the module registrations into your shell config.

```ts
import type { ShellContextualAction, ShellModuleRegistration } from "@brightweblabs/app-shell";
import { crmModuleRegistration } from "@brightweblabs/module-crm/registration";
import { projectsModuleRegistration } from "@brightweblabs/module-projects/registration";
import { adminModuleRegistration } from "@brightweblabs/module-admin/registration";

const dashboardModuleRegistration: ShellModuleRegistration<ShellContextualAction> = {
  key: "dashboard",
  placement: "primary",
  navItems: [{ href: "/dashboard", label: "Dashboard" }],
};

const modules = [
  dashboardModuleRegistration,
  crmModuleRegistration,
  projectsModuleRegistration,
  adminModuleRegistration,
];
```

This is the current mechanism for getting module-owned nav items, nav groups, and toolbar route/action registration into the platform shell.

### 3. Mount starter API routes by delegating to package handlers

Admin and CRM expose route-handler helpers that can be re-exported from your Next.js route files.

```ts
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { handleAdminUsersGetRequest } = await import("@brightweblabs/module-admin");
  return handleAdminUsersGetRequest(request);
}
```

```ts
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { handleAdminUsersRoleChangeRequest } = await import("@brightweblabs/module-admin");
  return handleAdminUsersRoleChangeRequest(request);
}
```

Use this pattern when a package already owns the HTTP handling contract and your app just needs to mount it under a route.

CRM follows the same pattern:

```ts
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { handleCrmContactsGetRequest } = await import("@brightweblabs/module-crm");
  return handleCrmContactsGetRequest(request);
}
```

The current CRM starter mounts these package-owned GET handlers at:

- `/api/crm/contacts`
- `/api/crm/organizations`
- `/api/crm/stats`
- `/api/crm/owners`

### 4. Consume auth from the shared, client, and server entrypoints

The auth package is intentionally split by runtime.

#### Shared helpers

```ts
import {
  AUTH_RESEND_COOLDOWN_SECONDS,
  buildResetPasswordRedirectUrl,
  buildSignupCallbackUrl,
  validateEmail,
  validatePassword,
} from "@brightweblabs/core-auth/shared";
```

#### Client hooks

```tsx
import { useCooldownTimer } from "@brightweblabs/core-auth/client";

const cooldown = useCooldownTimer(AUTH_RESEND_COOLDOWN_SECONDS);
```

#### Server guards

```ts
import { requireServerPageAccess, requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";

const { supabase, user, profileId } = await requireServerPageAccess();
const adminAccess = await requireServerPageRoleAccess("admin");
```

Use `shared` for runtime-independent logic, `client` for React hooks, and `server` for page and route protection.

### 5. Use infra transport helpers for app-owned email flows

For app-owned email behavior (contact forms, invites, campaigns, and webhook verification), use `@brightweblabs/infra/server`.

```ts
import {
  getMarketingSender,
  resendApiRequest,
  verifyResendWebhookSignature,
} from "@brightweblabs/infra/server";
```

Auth email flows should stay on `supabase.auth.*` and Supabase Auth SMTP/project settings.

## Module-specific usage notes

### Platform Base

- Use `@brightweblabs/core-auth/server` to gate pages and get the current signed-in user context.
- Use `@brightweblabs/core-auth/shared` for validation and callback URL helpers.
- Use `@brightweblabs/module-admin` when you need admin user listing, role changes, or admin starter routes.

### CRM

- Build on `listCrmContacts()`, `listCrmOrganizations()`, `getCrmContactStatusStats()`, and `listCrmOwnerOptions()` when you need reusable CRM data primitives.
- Mount the package-owned CRM GET handlers when you want the package to own the initial HTTP contract.
- Treat `getCrmDashboardData()` as `starter` page glue for the scaffolded CRM screen.
- Build your own forms, tables, actions, and workflows on top of the CRM schema and replace the starter page payload when needed.

### Projects

- Build on `listProjects()` and `getProjectPortfolioStats()` when you need reusable project listing and metrics helpers.
- Use `getProjectDashboard()` and `getClientProjectHealth()` for detail and client-facing project views.
- Use the task, milestone, link, and member helpers when your app owns project write flows.
- Treat `getProjectsPortfolioPageData()` as `starter` page glue for the scaffolded portfolio screen.
- Use `projectsModuleRegistration` when you want project navigation and toolbar behavior in the shell.

## Related contract docs

- [Base Contract](./base-contract.md) defines the support tiers.
- [base-contract.json](./base-contract.json) is the canonical symbol inventory.
- The module pages explain what each module installs, what is stable, and what is only starter scaffolding.

## Related docs

- [Modules](./README.md)
- [Base Contract](./base-contract.md)
- [Platform Base](./platform-base.md)
- [CRM](./crm.md)
- [Projects](./projects.md)
- [Project Structure](../foundations/project-structure.md)

## Implementation references

- `packages/core-auth/src/shared.ts`
- `packages/core-auth/src/client.ts`
- `packages/core-auth/src/server.ts`
- `packages/module-admin/src/index.ts`
- `packages/module-admin/src/registration.ts`
- `packages/module-crm/src/index.ts`
- `packages/module-crm/src/registration.ts`
- `packages/module-projects/src/index.ts`
- `packages/module-projects/src/registration.ts`
- `packages/create-bw-app/template/base/app/playground/auth/auth-playground.tsx`
- `packages/create-bw-app/template/modules/admin/app/api/admin/users/route.ts`
- `packages/create-bw-app/template/modules/admin/app/api/admin/users/roles/route.ts`
- `packages/create-bw-app/template/modules/crm/app/api/crm/contacts/route.ts`
- `packages/create-bw-app/template/modules/crm/app/api/crm/organizations/route.ts`
- `packages/create-bw-app/template/modules/crm/app/api/crm/stats/route.ts`
- `packages/create-bw-app/template/modules/crm/app/api/crm/owners/route.ts`
- `packages/create-bw-app/template/modules/admin/app/playground/admin/page.tsx`
- `packages/create-bw-app/template/modules/crm/app/playground/crm/page.tsx`
- `packages/create-bw-app/template/modules/projects/app/playground/projects/page.tsx`
- `apps/platform-preview/config/shell.ts`
