# Platform Base

The platform base is the default module-backed baseline for the **platform** template, not for every BrightWeb install.

If you scaffold a standalone `site` app, this page does not apply. It applies to the authenticated platform starter and the database/runtime layers that come with it.

> Platform always resolves to the `Core + Admin` database baseline; selecting Admin only controls whether the Admin package mount and wiring are scaffolded.

The practical platform base is currently **Core + Admin**.

That means the baseline platform install is already module-backed before optional business modules such as CRM or Projects are added.

Use [Base Contract](./base-contract.md) for the support-tier rules and [base-contract.json](./base-contract.json) for the canonical symbol inventory.

## What schema it installs

### Core

- Baseline tables: `profiles`, `app_activity_events`, `user_preferences`, and `user_notification_state`
- Follow-up migrations: shared auth/profile sync and rate-limit foundations used across platform apps

### Admin

- Baseline tables: `roles`, `user_role_assignments`, and `role_change_audit`
- Follow-up migrations: guarded role mutation, single-assignment rules, and default role-assignment behavior that downstream modules rely on

## What package and domain logic it provides

| Concern | Current behavior |
| --- | --- |
| Core helpers | The Core layer provides shared database helpers such as `current_profile_id()`, plus placeholder role helpers later replaced by Admin. |
| Auth package | `@brightweblabs/core-auth` provides the shared auth package used by platform apps for callback flows, reset-password flows, shared auth validation utilities, and shared client/server auth helpers. |
| Infra package | `@brightweblabs/infra` provides shared Supabase clients plus the canonical app-owned Resend transport and webhook signature verification helpers. It does not add a marketing-subscription or Resend Topics data model to the platform base. |
| Admin package | `@brightweblabs/module-admin` provides governance surfaces, admin handlers, role-aware server helpers, and injectable users/invitations UI. |
| Shell runtime | The baseline platform shell wiring is composed around `@brightweblabs/app-shell`, with Core auth and optional Admin UI surfaces attached to that runtime. |

## Whether it adds starter routes and wiring

| Concern | Current behavior |
| --- | --- |
| Scaffold wiring | Platform apps always get the baseline shell and `@brightweblabs/core-auth` package wiring. Admin UI package wiring is added when Admin is selected. |
| Package mounts | Core Auth adds no demo route. If Admin is selected, the template mounts `AdminUsersPage` at `/admin/users` and aliases the package-owned API handlers. |
| Database behavior | Platform always resolves to the `Core + Admin` database baseline; selecting Admin only controls whether the Admin package mount and wiring are scaffolded. |
| Site template | The standalone `site` template does not receive this platform base. |

## Supported base contract

The current platform-base contract is intentionally split into reusable and starter-facing surfaces.

### Stable

- `@brightweblabs/core-auth/shared`: shared validation, URL helpers, and auth constants
- `@brightweblabs/core-auth/client`: `useCooldownTimer()`
- `@brightweblabs/core-auth/server`: `requireServerPageAccess()`, `requireServerPageRoleAccess()`, `getServerAccess()`
- `@brightweblabs/ui`: shared avatar, search, skeleton, phone-input, and badge recipe surfaces
- `@brightweblabs/app-shell`: shell composition plus the platform theme controller and pre-hydration script
- `@brightweblabs/module-admin`: `listAdminUsers()`, `handleAdminUsersGetRequest()`, `handleAdminUsersRoleChangeRequest()`
- `@brightweblabs/module-admin/registration`: `adminModuleRegistration`
- `@brightweblabs/module-admin/ui`: `AdminUsersClient`, `AdminToolbarControls`, `createAdminUiClient`

### Starter

- `@brightweblabs/module-admin`: `getAdminUsersPageData()`
- `@brightweblabs/module-admin`: `AdminUsersPage`

### Internal

- Lower-level auth helpers such as `requireServerUserAccess()` and `requireServerRoleAccess()`
- Packaged admin UI and event helpers such as `AdminUsersClient`, `ADMIN_EVENTS`, and the admin event dispatch helpers
- Lower-level admin mutation composition such as `applyAdminRoleChanges()`

## How to use it in an app

The platform base is mostly consumed through package entrypoints rather than through a standalone admin product API.

### Auth helpers by runtime

- `@brightweblabs/core-auth/shared` is for shared validation and redirect URL helpers.
- `@brightweblabs/core-auth/client` is for client-only React hooks such as resend cooldown behavior.
- `@brightweblabs/core-auth/server` is for page guards and current-user access on the server.
- `@brightweblabs/infra/server` is for app-owned Resend transport and webhook verification.

Auth email sending remains Supabase-owned (`supabase.auth.*` + Supabase Auth SMTP settings).

```ts
import { requireServerPageAccess, requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";

const { supabase, user, profileId } = await requireServerPageAccess();
const adminOnly = await requireServerPageRoleAccess("admin");
```

### Shared UI and theme

`@brightweblabs/ui` 1.0 exposes the stable component system from its root and per-component subpaths. The avatar, search, skeleton, table-skeleton, and phone-input exports build on `@brightweblabs/theme` tokens and typography utilities.

Theme runtime ownership lives in `@brightweblabs/app-shell`. Render `ThemeScript` in the root layout head before wrapping app content with `ThemeProvider`; this prevents a flash and makes the shell AccountMenu drive persistent light, dark, and system modes directly. `useTheme()` exposes both the selected mode and its resolved light/dark value.

### Admin routes and data helpers

If you select Admin, the generated app directly mounts the package-owned page and handlers.

```ts
export { handleAdminUsersGetRequest as GET } from "@brightweblabs/module-admin";
```

```tsx
export { AdminUsersPage as default } from "@brightweblabs/module-admin";
```

Treat `getAdminUsersPageData()` as package page glue. Build reusable admin surfaces in the package on `listAdminUsers()` and the stable handlers.

### Shell registration

If your app uses `@brightweblabs/app-shell`, the Admin starter also wires `adminModuleRegistration` into the shell configuration so admin nav and toolbar surfaces appear in the platform runtime.

### Aggregate dashboard

`AppDashboard` is the shell-owned aggregate dashboard. Give it a `DashboardDataClient`, optional server-loaded `initialData`, and the `dashboardContributions` returned by `buildClientAppShellRegistration()`. CRM contributes the client section; Projects contributes the project, task, and milestone sections plus its package-native cards and tags. If a module is absent, its tab and bento cells are omitted.

Import `@brightweblabs/app-shell/dashboard.css` once in the route layout. The dashboard dictionary defaults to MQ's Portuguese copy and can be replaced through the `dictionary` prop.

```tsx
const built = buildClientAppShellRegistration(registration);

<AppDashboard
  client={dashboardClient}
  contributions={built.dashboardContributions}
  initialData={initialDashboardData}
  viewerFirstName={viewer.firstName}
/>
```

### Not-found and error routes

`NotFoundPage` and `ErrorPage` package the MQ Portuguese status surfaces for thin
Next.js route mounts. `NotFoundPage` owns a neutral full-page frame and accepts an
optional `brandLogo` plus `footerBackHref` and `footerBackLabel` overrides.
`ErrorPage` is a client component with the standard Next.js `error` and `reset`
contract.

```tsx
// app/not-found.tsx
export { NotFoundPage as default } from "@brightweblabs/app-shell";
```

```tsx
// app/error.tsx
"use client";

export { ErrorPage as default } from "@brightweblabs/app-shell";
```

Import `@brightweblabs/theme/themes/mq-aliases` after the base theme CSS to use
the literal MQ `heading-2`, `paragraph`, and `label` typography aliases.

## How To Build On This

- Build on `stable` auth helpers, admin handlers, and admin listing helpers for project-owned server logic.
- Use `starter` helpers like `getAdminUsersPageData()` when you want the scaffolded screen quickly.
- Do not depend on `internal` auth or packaged admin UI helpers for app-owned contracts.

For a broader integration overview, see [Using BrightWeb Modules](./using-modules.md).

## Related docs

- [Installation](../foundations/installation.md)
- [Modules](./README.md)
- [Base Contract](./base-contract.md)
- [Using BrightWeb Modules](./using-modules.md)
- [CRM](./crm.md)
- [Projects](./projects.md)

## Implementation references

- `packages/core-auth/src`
- `packages/module-admin/src`
- `packages/create-bw-app/template/base`
- `packages/create-bw-app/template/modules/admin`
- `packages/create-bw-app/src/generator.mjs`
- `supabase/module-registry.json`
- `supabase/modules/core/migrations`
- `supabase/modules/admin/migrations`
