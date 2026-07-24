# Brief 30 admin parity translation

Source of truth: MQ portal admin and shell files in
`apps/portal/app/(app)/admin/**` and `components/app/layout/**`.

## Translation table

| MQ source | MQ lines | Package or preview destination | Status |
| --- | ---: | --- | --- |
| `app/(app)/admin/page.tsx` | 1–5 | `apps/platform-preview/app/admin/page.tsx` | Literal redirect to `/admin/users` |
| `app/(app)/admin/users/page.tsx` | 1–43 | `packages/module-admin/src/users-page.tsx`, `packages/module-admin/src/ui/admin-users.tsx` | Server loader retained; package UI mounted with injectable client |
| `app/(app)/admin/users/users-client.tsx` | 1–819 | `packages/module-admin/src/ui/admin-users.tsx` | Users table, tabs, roles, invitations, dialogs, events, and viewport pagination translated |
| `app/(app)/admin/users/loading.tsx` | 1–45 | `packages/module-admin/src/ui/loading.tsx` | Literal skeleton structure translated to shared UI primitives |
| `components/app/layout/components/admin-controls.tsx` | 1–121 | `packages/module-admin/src/ui/toolbar-controls.tsx` | Search and role filter translated into packaged AppHeader controls |
| `components/app/layout/index.tsx` | 86, 268–276, 797–826, 1179–1186 | `packages/module-admin/src/registration.ts`, `packages/module-admin/src/ui/toolbar-controls.tsx`, `apps/platform-preview/app/admin/layout.tsx` | Admin toolbar route, title metadata, event synchronization, and shell placement translated |

## MQ global classes and recipes ported

| MQ global | Destination | Status |
| --- | --- | --- |
| `.dashboard-reveal` | `.admin-dashboard-reveal` in `packages/module-admin/tokens.css` | Scoped port with the same 640ms reveal timing |
| `.project-section-icon` | `.admin-section-icon` in `packages/module-admin/tokens.css` | Scoped literal geometry and token colors |
| `.tint-soft` role-pill stops | `.admin-role-pill` and `.admin-role-dot` in `packages/module-admin/tokens.css` | Same 34% border and 10% card tint recipe, moved out of component source |
| Admin role aliases (`client`, `staff`, `admin`) | `--role-client`, `--role-team`, `--role-admin` consumed by `AdminRolePill` | Reuses the shared MQ theme role palette without component color recipes |

## Preview and removals

- Added `/admin`, which redirects to `/admin/users` like MQ.
- Added `/admin/users` inside `AppShellFrame` with deterministic mock users and invitations.
- Deleted `apps/platform-preview/app/playground/admin/page.tsx`; the packaged surface supersedes the diagnostic playground.

## Hygiene

- Portuguese UI copy is centralized in `packages/module-admin/src/ui/dictionary.ts`.
- `AdminUsersClient` contains no direct `fetch`; all reads and writes use `AdminUiClient`.
- Component source contains no hex, `rgb`/`rgba`, or `color-mix` recipes.
