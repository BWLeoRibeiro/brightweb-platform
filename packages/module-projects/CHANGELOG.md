# @brightweblabs/module-projects

## 0.8.0

### Minor Changes

- 965edd4: Make Projects page navigation serializable across React Server/Client boundaries and update generated Projects routes to pass URL patterns.

  Direct `ProjectsPage`, `ProjectDetailPage`, and `ProjectTasksPage` consumers must rename the `detailHref`, `boardHref`, and optional `organizationHref` navigation callbacks to `detailHrefPattern`, `boardHrefPattern`, and optional `organizationHrefPattern` strings.

## 0.7.2

### Patch Changes

- Updated dependencies [e02eaad]
  - @brightweblabs/core-auth@0.7.1
  - @brightweblabs/app-shell@0.7.1

## 0.7.1

### Patch Changes

- Updated dependencies [44a415e]
  - @brightweblabs/app-shell@0.7.0

## 0.7.0

### Minor Changes

- 10ae6b6: Close the scaffold gaps found while adopting the CLI for MQ Consulting.

  **theme** — the 14 `portal-*` typography utilities moved from
  `themes/mq-aliases.css` into `src/typography.css`. 21 source files across
  app-shell, module-admin, module-crm, module-projects and module-marketing use
  those classes, but they were only defined in a client theme file, so any app not
  importing the MQ aliases rendered packaged components with undefined
  typography. A client theme must never be load-bearing for package components.
  The hygiene guard now scans the base sheet and forbids redefining them in
  mq-aliases.

  **infra** — new `handleKeepaliveGetRequest`. Free-tier Supabase projects pause
  after ~7 days of inactivity; every scaffold now ships `/api/cron/keepalive` for
  a scheduler to call with `Authorization: Bearer $SUPABASE_KEEPALIVE_SECRET`.
  It runs a real count query, because an HTTP request that never reaches Postgres
  does not reset the inactivity timer.

  **module-projects** — new `ClientAccountPage` and `ClientProjectDetailRoute`.
  The client lens already shipped, but the template never mounted it, so every
  scaffolded app silently lacked `/account/projetos` and the account page had no
  projects section. These compose the pieces so app routes stay thin re-exports.

  **core-auth** — `AuthBrandConfig.splitHeadline` and `splitDescription` widen
  from `string` to `ReactNode`, so a brand can emphasise a word inside the auth
  headline.

  **create-bw-app** — `config/shell.overrides.ts` now exports
  `additionalShellModules`, and the generated `config/shell.ts` spreads it.
  `applyShellRegistrationOverrides` can only transform registrations that already
  exist, so an app-owned surface previously had nowhere to live except
  `config/shell.ts` — which `create-bw-app update` overwrites. Also mounts the
  client account routes when Projects is enabled, and ships the keepalive route.

### Patch Changes

- Updated dependencies [10ae6b6]
  - @brightweblabs/theme@0.5.0
  - @brightweblabs/infra@0.4.0
  - @brightweblabs/core-auth@0.7.0
  - @brightweblabs/ui@1.1.1
  - @brightweblabs/app-shell@0.6.2

## 0.6.3

### Patch Changes

- Updated dependencies [032215e]
  - @brightweblabs/core-auth@0.6.1

## 0.6.2

### Patch Changes

- Updated dependencies [41fa7ee]
  - @brightweblabs/core-auth@0.6.0

## 0.6.1

### Patch Changes

- ba77169: Normalize Next.js as a library peer dependency, add the marketing scaffold manifest, and keep the core scaffold migration set aligned.
- 3655e23: Harden staff-only project surfaces, client project scoping, and client-visible project links.
- Updated dependencies [ba77169]
- Updated dependencies [7eafa76]
  - @brightweblabs/app-shell@0.6.1
  - @brightweblabs/core-auth@0.5.1
  - @brightweblabs/infra@0.3.3

## 0.6.0

### Minor Changes

- 41714ca: Add the read-only client projects list, detail, and account preview lens with account project data fallbacks.
- 1c7c288: Add authenticated Projects HTTP handlers and live preview API wiring.

### Patch Changes

- Updated dependencies [22e50aa]
- Updated dependencies [41714ca]
  - @brightweblabs/core-auth@0.5.0

## 0.5.0

### Minor Changes

- b0362c3: Ship the consolidated platform surface release: shell navigation, dashboard,
  theme switching, branded status pages, packaged authentication and invitation
  flows, Admin, CRM, Projects, and organization persistence. Add tokenized Geist
  typography, shared UI primitives, MQ parity, and accessibility and robustness
  hardening across those surfaces.

### Patch Changes

- Updated dependencies [b0362c3]
- Updated dependencies [b0362c3]
  - @brightweblabs/app-shell@0.6.0
  - @brightweblabs/core-auth@0.4.0
  - @brightweblabs/theme@0.4.0
  - @brightweblabs/ui@1.1.0
  - @brightweblabs/infra@0.3.2

## 0.4.4

### Patch Changes

- Updated dependencies [1a86493]
  - @brightweblabs/app-shell@0.5.0
  - @brightweblabs/ui@1.0.2

## 0.4.3

### Patch Changes

- @brightweblabs/ui@1.0.1
- @brightweblabs/app-shell@0.4.1

## 0.4.2

### Patch Changes

- 741ffec: Ship the BrightWeb v1 module manifest with the projects package.
- 3c0d84b: Align Supabase SSR and the shared Supabase client dependency across infrastructure, auth, and domain packages to avoid duplicate cookie implementations and incompatible client types.
- 090bc48: Align workspace UI consumers with the Lucide 1.x peer range required by `@brightweblabs/ui` 1.0.
- 3c0d84b: Complete module database ownership metadata, including cross-module integration objects, and align declared core compatibility with the published catalog.
- e7a7b89: Extract organizations, membership, invitations, and shared helpers into the organizations foundation module. Preserve the CRM organization-list alias and make CRM and Projects auto-resolve Organizations without forcing Projects to install CRM.
- Updated dependencies [80b69b1]
- Updated dependencies [3c0d84b]
- Updated dependencies [090bc48]
- Updated dependencies [2bb53ad]
- Updated dependencies [798e75f]
- Updated dependencies [3c0d84b]
- Updated dependencies [80b69b1]
- Updated dependencies [090bc48]
  - @brightweblabs/ui@1.0.0
  - @brightweblabs/infra@0.3.1
  - @brightweblabs/core-auth@0.3.4
  - @brightweblabs/app-shell@0.4.0

## 0.4.1

### Patch Changes

- 1550f0b: Expose the activity message composers through a dedicated `./activity-messages`
  subpath. The composers (`composeProjectMessage` / `composeCrmMessage`) are pure
  and client-safe, but the package root also re-exports server-only data
  functions, so importing them from the barrel pulled `server-only` into client
  bundles. Import from `@brightweblabs/module-projects/activity-messages` and
  `@brightweblabs/module-crm/activity-messages` in client components instead.

## 0.4.0

### Minor Changes

- cc8cfaa: Share the MQ Consulting activity-feed presentation across packages, with
  language parameterised so each app supplies its own dictionary (pt-PT shipped
  as the default):

  - `@brightweblabs/ui` adds `./activity-format` (framework-free `MsgSeg` /
    `ActivityChange` types plus `formatActivityValue` and `toActivityChanges`,
    both taking injected field labels, person fields, locale and system/boolean
    words) and `./activity-message` (the `ActivityMessage` renderer). Both are
    also re-exported from the package root.
  - `@brightweblabs/module-projects` adds `composeProjectMessage(item, actor,
dict?)` with a `ProjectActivityDictionary` type and the default
    `ptProjectActivityDictionary`, plus `activityActorName`.
  - `@brightweblabs/module-crm` adds `composeCrmMessage(item, actor, dict?)` with
    a `CrmActivityDictionary` type and the default `ptCrmActivityDictionary`.

  Each module renders one written sentence per event (actor → verb → entity →
  change). Apps compose a cross-domain feed by dispatching on the event-type
  prefix to the relevant module composer and rendering the result with
  `ActivityMessage`.

- 0423b3c: Add `listProjectActivity(supabase, projectId)`, a dedicated, lazy-loadable
  project activity query adopted from the MQ Consulting portal. It merges
  payload-referenced and directly-attributed `app_activity_events`, dedupes and
  caps the feed at 50 rows, and resolves every referenced profile id (actor plus
  member ids in `member_*`/`project_members_synced` payloads) to display names in
  a single query — enriching the payload with `profile_name`/`*_profile_names`
  so consumers render people instead of raw ids. Pairs with `getProjectDashboard`
  no longer loading activity inline (see previous release).
- c99a284: Adopt MQ Consulting portal improvements as the baseline:

  - Use `count: "exact"` instead of `count: "planned"` for project portfolio
    stats and project list queries so totals are accurate rather than planner
    estimates.
  - `createProjectTask` now returns the single created `ProjectTask` (with
    assignee/reporter joins) instead of re-listing every task in the project.
    **Breaking:** the return type changes from `ProjectTask[]` to `ProjectTask`.
  - `getProjectDashboard` no longer eagerly loads the activity feed inline; it
    fetches the project row in parallel with tasks/milestones/links/members and
    returns `activity: []`. Activity moves to a dedicated lazy-loaded query in a
    follow-up release. **Breaking:** `ProjectDashboardData.activity` is now
    always empty from this function.

### Patch Changes

- Updated dependencies [cc8cfaa]
  - @brightweblabs/ui@0.4.0
  - @brightweblabs/app-shell@0.3.1

## 0.3.3

### Patch Changes

- fd505a0: Improve portal read performance by using planned display counts for CRM and project dashboards/lists, replacing CRM status row aggregation with head-only count queries, and adding read-path indexes to CRM and Projects module migrations.

## 0.3.2

### Patch Changes

- Updated dependencies [7a2c7b2]
  - @brightweblabs/infra@0.3.0
  - @brightweblabs/core-auth@0.3.3

## 0.3.1

### Patch Changes

- 8f595e8: Route project activity logging through `@brightweblabs/infra/server` `createServiceRoleClient()` so the module no longer directly reads legacy Supabase service-role environment variable names.

## 0.3.0

### Minor Changes

- Expand the projects module with full server-side project APIs (dashboard/detail retrieval, create/update/delete flows, tasks, milestones, links, member sync and assignable members) so consuming apps can drop duplicated local projects service layers.
- Add dedicated `contracts`, `types`, and `server` export entrypoints for module-only consumption in app code.

### Patch Changes

- Keep project queries safe for deployments where `public.profiles.phone` is absent by using phone-safe profile selects across the expanded server API.
- Switch package dependencies to published semver ranges so apps can consume the module as a direct package dependency outside the monorepo.

## 0.2.4

### Patch Changes

- 74144ef: Fix project portfolio queries to gracefully handle deployments where `public.profiles.phone` is missing by retrying without phone columns, while keeping `ownerPhone` and `organizationOwnerPhone` in the returned shape.

## 0.2.3

### Patch Changes

- 097992c: Align the published BrightWeb package line for platform scaffolds and move Supabase env validation to lazy runtime factories in infra.
- Updated dependencies [097992c]
  - @brightweblabs/core-auth@0.3.2
  - @brightweblabs/infra@0.2.2

## 0.2.2

### Patch Changes

- Keep the current projects portfolio profile query compatible with the current profile schema (stop exposing profile `phone` fields from project portfolio data when `public.profiles.phone` does not exist) and republish the package against the aligned auth and infra package line.
- Updated dependencies
  - @brightweblabs/core-auth@0.3.1
  - @brightweblabs/infra@0.2.1

## 0.2.1

### Patch Changes

- 1c51e1c: Avoid requiring `public.profiles.phone` in project portfolio queries so the package works with the current core profile schema.

## 0.2.0

### Minor Changes

- 6923aeb: Update latest Next release.

### Patch Changes

- Updated dependencies [6923aeb]
  - @brightweblabs/app-shell@0.3.0
  - @brightweblabs/core-auth@0.3.0
  - @brightweblabs/infra@0.2.0

## 0.1.3

### Patch Changes

- Updated dependencies [dd6fddd]
  - @brightweblabs/core-auth@0.2.0
  - @brightweblabs/app-shell@0.2.0

## 0.1.2

### Patch Changes

- ec7ca19: Minor changes to all modules.
- Updated dependencies [ec7ca19]
  - @brightweblabs/app-shell@0.1.2
  - @brightweblabs/core-auth@0.1.2
  - @brightweblabs/infra@0.1.1

## 0.1.1

### Patch Changes

- a36ed3b: Replace internal workspace protocol dependencies with published version ranges.
- Updated dependencies [a36ed3b]
  - @brightweblabs/app-shell@0.1.1

## 0.1.0

### Minor Changes

- Initial public release of the BrightWeb Labs platform packages.

### Patch Changes

- Updated dependencies
  - @brightweblabs/app-shell@0.1.0
  - @brightweblabs/infra@0.1.0
