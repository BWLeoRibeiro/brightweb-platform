# Platform Base

The platform base is the default module-backed baseline for the **platform** template, not for every BrightWeb install.

If you scaffold a standalone `site` app, this page does not apply. It applies to the authenticated platform starter and the database/runtime layers that come with it.

> Platform always resolves to the `Core + Admin` database baseline; selecting Admin only controls whether the Admin starter UI and package wiring are scaffolded.

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
| Infra package | `@brightweblabs/infra` provides shared Supabase clients plus the canonical app-owned Resend transport and webhook signature verification helpers. |
| Admin package | `@brightweblabs/module-admin` provides the admin package for governance surfaces, admin handlers, and role-aware server helpers. |
| Shell runtime | The baseline platform shell wiring is composed around `@brightweblabs/app-shell`, with Core auth and optional Admin UI surfaces attached to that runtime. |

## Whether it adds starter routes and wiring

| Concern | Current behavior |
| --- | --- |
| Scaffold wiring | Platform apps always get the baseline shell and `@brightweblabs/core-auth` package wiring. Admin UI package wiring is added when the Admin starter surface is selected. |
| Starter routes | The platform starter includes `/playground/auth` for the Core auth layer. If Admin is selected, the module template also contributes `/playground/admin` plus the starter admin API routes. |
| Database behavior | Platform always resolves to the `Core + Admin` database baseline; selecting Admin only controls whether the Admin starter UI and package wiring are scaffolded. |
| Site template | The standalone `site` template does not receive this platform base. |

## Supported base contract

The current platform-base contract is intentionally split into reusable and starter-facing surfaces.

### Stable

- `@brightweblabs/core-auth/shared`: shared validation, URL helpers, and auth constants
- `@brightweblabs/core-auth/client`: `useCooldownTimer()`
- `@brightweblabs/core-auth/server`: `requireServerPageAccess()`, `requireServerPageRoleAccess()`, `getServerAccess()`
- `@brightweblabs/module-admin`: `listAdminUsers()`, `handleAdminUsersGetRequest()`, `handleAdminUsersRoleChangeRequest()`
- `@brightweblabs/module-admin/registration`: `adminModuleRegistration`

### Starter

- `@brightweblabs/module-admin`: `getAdminUsersPageData()`

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

### Admin routes and data helpers

If you select the Admin starter surface, the generated app can mount package-owned handlers and server data helpers.

```ts
export async function GET(request: Request) {
  const { handleAdminUsersGetRequest } = await import("@brightweblabs/module-admin");
  return handleAdminUsersGetRequest(request);
}
```

```tsx
const { getAdminUsersPageData } = await import("@brightweblabs/module-admin");
const { users } = await getAdminUsersPageData();
```

Treat `getAdminUsersPageData()` as starter page glue. Build app-owned admin pages on `listAdminUsers()` and the stable handlers when you need a longer-lived contract.

### Shell registration

If your app uses `@brightweblabs/app-shell`, the Admin starter also wires `adminModuleRegistration` into the shell configuration so admin nav and toolbar surfaces appear in the platform runtime.

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
