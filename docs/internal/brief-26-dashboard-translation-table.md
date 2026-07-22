# Brief 26 dashboard translation ledger

The map was fixed before implementation. MQ remains read-only. The aggregate surface is shell-owned; module-specific visual components arrive through dashboard contributions on the existing shell registration.

## Dashboard route files

| MQ source (relative to `app/(app)/dashboard/`) | Package destination | Status |
| --- | --- | --- |
| `page.tsx` | `packages/app-shell/src/dashboard/dashboard-client.tsx` (`AppDashboard`) and `apps/platform-preview/app/dashboard/page.tsx` | Translated |
| `dashboard-client.tsx` | `packages/app-shell/src/dashboard/dashboard-client.tsx` | Translated |
| `use-dashboard-data.ts` | `packages/app-shell/src/dashboard/use-dashboard-data.ts` | Translated with injectable `DashboardDataClient` |
| `dashboard-response-parser.ts` | `packages/app-shell/src/dashboard/dashboard-response-parser.ts` | Translated |
| `events.ts` | `packages/app-shell/src/dashboard/events.ts` | Translated |
| `events.test.ts` | `tests/app-shell-config.test.ts` | Translated |
| `loading.tsx` | `packages/app-shell/src/dashboard/dashboard-loading.tsx` and `apps/platform-preview/app/dashboard/loading.tsx` | Translated |
| `hooks/use-dashboard-refresh-events.ts` | `packages/app-shell/src/dashboard/hooks/use-dashboard-refresh-events.ts` | Translated |

## Imported MQ components

| MQ import | Destination / integration |
| --- | --- |
| `components/projects/project-summary-card.tsx` | Existing `packages/module-projects/src/ui/shared/project-summary-card.tsx`; exported and injected by `projectsModuleRegistration` |
| `components/projects/project-summary-card-skeleton.tsx` | Existing `packages/module-projects/src/ui/shared/project-summary-card-skeleton.tsx`; exported and injected by `projectsModuleRegistration` |
| `components/projects/task-tags.tsx` | Existing `packages/module-projects/src/ui/shared/task-tags.tsx`; tags injected by `projectsModuleRegistration` |
| `components/ui/skeleton.tsx` | Existing `@brightweblabs/ui` skeleton exports |
| `components/ui/tooltip.tsx` | Existing `@brightweblabs/ui` tooltip exports |
| `components/app/portal-action.tsx` | `packages/app-shell/src/dashboard/primitives.tsx` |
| `components/app/portal-section-heading.tsx` | `packages/app-shell/src/dashboard/primitives.tsx` |
| `components/app/portal-typography.ts` | Dashboard primitives backed by the existing MQ alias utilities |
| `contexts/auth-context.tsx` | Replaced by injectable `viewerFirstName` shell glue |
| `lib/http/client.ts` | Replaced by injectable `DashboardDataClient` |

## MQ global classes

No MQ global rule was copied into an app component. Existing packaged equivalents are reused:

| MQ class | Packaged location |
| --- | --- |
| `.brand-panel`, `.row-hover-sweep` | `packages/theme/src/surfaces.css` |
| `.portal-label`, `.portal-body`, `.portal-card-title`, `.portal-heading`, `.portal-metric-xl`, `.portal-metric-display` | `packages/theme/themes/mq-aliases.css` |
| `.project-section-icon` | `packages/module-projects/tokens.css` |

Dashboard-only surface, status, error, and shadow recipes live in `packages/app-shell/src/dashboard/dashboard.css` and resolve exclusively through theme/module tokens.

## Header parity

MQ `/dashboard` registers `Visão geral` / `Dashboard`, renders no contextual toolbar controls, and keeps the alerts utility visible. The preview route mirrors that arrangement through `AppHeader` and the packaged notifications utility.
