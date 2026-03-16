# Using BrightWeb Modules

This page explains the public integration surface of the current BrightWeb modules.

The shared modules are not primarily exposed as standalone REST products. Today they are mostly consumed through:

- package entrypoints
- generated scaffold wiring
- server-side page helpers
- shell registration objects
- a small number of route handlers

Use this page together with the per-module pages when you need to answer both of these questions:

1. What does this module install?
2. How do I actually use it in an app?

## Integration model

In a generated platform app, module usage usually happens in 3 places:

1. `config/modules.ts` and environment flags decide which modules are enabled.
2. `config/shell.ts` wires each enabled module registration into `@brightweblabs/app-shell`.
3. App routes call the module package directly for server data, route handlers, or auth helpers.

That means the module contract is currently a TypeScript package contract more than a public HTTP API contract.

## Current public entrypoints

| Package | Typical entrypoints | What you use them for |
| --- | --- | --- |
| `@brightweblabs/core-auth/shared` | `validateEmail()`, `validatePassword()`, `buildSignupCallbackUrl()`, `buildResetPasswordRedirectUrl()` | Shared auth validation and URL derivation. |
| `@brightweblabs/core-auth/client` | `useCooldownTimer()` | Client-side auth UI behavior such as resend cooldowns. |
| `@brightweblabs/core-auth/server` | `requireServerPageAccess()`, `requireServerPageRoleAccess()`, `getServerAccess()` | Server-side auth and role gating in pages, layouts, and handlers. |
| `@brightweblabs/module-admin` | `getAdminUsersPageData()`, `listAdminUsers()`, `handleAdminUsersGetRequest()`, `handleAdminUsersRoleChangeRequest()` | Admin user data and starter route handlers. |
| `@brightweblabs/module-admin/registration` | `adminModuleRegistration` | Admin app-shell navigation and toolbar registration. |
| `@brightweblabs/module-crm` | `getCrmDashboardData()` | Server-side CRM dashboard and summary data loading. |
| `@brightweblabs/module-crm/registration` | `crmModuleRegistration` | CRM app-shell navigation groups and toolbar registration. |
| `@brightweblabs/module-projects` | `getProjectsPortfolioPageData()`, `listProjects()`, `getProjectPortfolioStats()` | Server-side project portfolio loading and filtering. |
| `@brightweblabs/module-projects/registration` | `projectsModuleRegistration` | Projects app-shell navigation and toolbar registration. |

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
const { getAdminUsersPageData } = await import("@brightweblabs/module-admin");
const { users } = await getAdminUsersPageData();
```

Use these helpers when you want the package to own the initial query and normalization logic. Then build your own UI on top of the returned data.

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

Admin currently exposes route-handler helpers that can be re-exported from your Next.js route files.

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

## Module-specific usage notes

### Platform Base

- Use `@brightweblabs/core-auth/server` to gate pages and get the current signed-in user context.
- Use `@brightweblabs/core-auth/shared` for validation and callback URL helpers.
- Use `@brightweblabs/module-admin` when you need admin user listing, role changes, or admin starter routes.

### CRM

- Use `getCrmDashboardData()` from a server page or server component to fetch CRM starter data.
- Use `crmModuleRegistration` when you want CRM navigation groups and toolbar routes in the app shell.
- Build your own forms, tables, actions, and workflows on top of the returned CRM data and CRM schema.

### Projects

- Use `getProjectsPortfolioPageData()` for starter portfolio pages.
- Use `listProjects()` and `getProjectPortfolioStats()` when you need lower-level project listing and metrics helpers.
- Use `projectsModuleRegistration` when you want project navigation and toolbar behavior in the shell.

## What is not documented as a stable external API

The current public docs still do not describe BrightWeb modules as standalone external APIs with versioned endpoint reference pages, request and response schemas, or SDK-style API reference material.

The current public contract is the package surface plus the generated integration patterns above. If that contract grows, it should be documented here explicitly rather than only implied by source files.

## Related docs

- [Modules](./README.md)
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
- `packages/create-bw-app/template/modules/admin/app/playground/admin/page.tsx`
- `packages/create-bw-app/template/modules/crm/app/playground/crm/page.tsx`
- `packages/create-bw-app/template/modules/projects/app/playground/projects/page.tsx`
- `apps/platform-preview/config/shell.ts`
