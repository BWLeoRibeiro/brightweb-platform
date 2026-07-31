# @brightweblabs/module-crm

## 0.13.2

### Patch Changes

- 9547657: Show the pointer cursor consistently for enabled shared buttons and module toolbar controls.
- Updated dependencies [9547657]
  - @brightweblabs/ui@1.4.3
  - @brightweblabs/app-shell@0.10.2
  - @brightweblabs/core-auth@0.9.4
  - @brightweblabs/module-orgs@0.3.19

## 0.13.1

### Patch Changes

- Updated dependencies
  - @brightweblabs/ui@1.4.2
  - @brightweblabs/app-shell@0.10.1
  - @brightweblabs/core-auth@0.9.3
  - @brightweblabs/module-orgs@0.3.18

## 0.13.0

### Minor Changes

- Standardize faster cancellable, observable latest-request behavior across collection surfaces; add authoritative CRM organization and joined timeline search plus aggregate dashboard metrics; add paginated Marketing search, filters, create actions, toolbar registration, and lazy analytics loading; preserve useful rows while requests refresh; and scaffold database indexes for contains-search and common filters.

### Patch Changes

- Keep independently loaded CRM summary resources in stable pending, resolved-empty, or unavailable states across dashboards, browsers, reports, and contact forms.
- Updated dependencies
  - @brightweblabs/infra@0.7.0
  - @brightweblabs/app-shell@0.10.0
  - @brightweblabs/core-auth@0.9.2
  - @brightweblabs/module-orgs@0.3.17

## 0.12.0

### Minor Changes

- Make collection searches and filters feel immediate across CRM, Projects, and Admin with abortable requests, search-only debouncing, pending feedback, and privacy-safe timing metrics. Filter Admin user searches at the role-assignment level so result counts and pagination include only matching profiles.

### Patch Changes

- Updated dependencies
- Updated dependencies [f12ce99]
  - @brightweblabs/infra@0.6.0
  - @brightweblabs/ui@1.4.1
  - @brightweblabs/app-shell@0.9.3
  - @brightweblabs/core-auth@0.9.1
  - @brightweblabs/module-orgs@0.3.16

## 0.11.2

### Patch Changes

- 6bba363: Normalize account-menu and CRM sheet typography so secondary account text uses natural casing and shared sheet headings, labels, and status controls follow the platform type scale.
- Updated dependencies [6bba363]
  - @brightweblabs/app-shell@0.9.2
  - @brightweblabs/module-orgs@0.3.15

## 0.11.1

### Patch Changes

- Standardize account and sheet typography around natural-case secondary data, clearer panel titles, restrained structural labels, and reusable sentence-case field labels across platform modules.
- Updated dependencies
  - @brightweblabs/app-shell@0.9.1
  - @brightweblabs/module-orgs@0.3.14

## 0.11.0

### Minor Changes

- Add an authenticated Supabase Realtime activity stream with MQ-compatible notification and refresh coverage across the notification inbox, CRM, Admin, Dashboard, Projects portfolio/detail/board/account views, and project activity.

  Publish `app_activity_events` with domain-aware RLS, retain removed/deleted project audiences without broadening the canonical project ACL, and emit missing Admin role-change events so every supported mutation invalidates the matching live surfaces.

- Add reusable, responsive module top-bar composition with registry-gated CRM,
  Projects, and Admin controls, full CRM sorting parity, mobile access to route
  actions and notifications, and actor-aware notification inbox details.

  Generate the same route-driven toolbar integration for new and updated apps,
  without putting module behavior in application shell layouts.

### Patch Changes

- Updated dependencies [14c7881]
- Updated dependencies [a9508ef]
- Updated dependencies
- Updated dependencies [3d52715]
- Updated dependencies
- Updated dependencies [a475672]
  - @brightweblabs/core-auth@0.9.0
  - @brightweblabs/infra@0.5.0
  - @brightweblabs/app-shell@0.9.0
  - @brightweblabs/ui@1.4.0
  - @brightweblabs/module-orgs@0.3.13

## 0.10.1

### Patch Changes

- c05dc17: Migrate package-owned interface typography to the canonical visual-role utilities while preserving contextual auth, report, dashboard, and compact-control sizing.
- a03392d: Toolbar actions now flow through a shell action registry (ShellActionsProvider / useShellAction) instead of fire-and-forget window events: header, breadcrumb, search, filter, and create controls stay disabled until the routed page has registered every handler they dispatch, so an interaction can never be silently swallowed (#84). Module action listeners migrated to the registry with a window-event compatibility bridge for shells without a provider; page-to-toolbar state sync events are unchanged. The CRM organization sheet also blocks re-submits while a save is in flight.
- Updated dependencies [c05dc17]
- Updated dependencies [90c9bf0]
- Updated dependencies [abe0722]
- Updated dependencies [a03392d]
  - @brightweblabs/app-shell@0.8.0
  - @brightweblabs/core-auth@0.7.3
  - @brightweblabs/ui@1.2.0
  - @brightweblabs/module-orgs@0.3.11

## 0.10.0

### Minor Changes

- 5c4cd96: Wire scaffolded dashboards to authenticated module-owned Projects, CRM, and Tasks data producers, preserve independent section failures, and enforce registration-to-endpoint parity in tests.

### Patch Changes

- Updated dependencies [5c4cd96]
  - @brightweblabs/app-shell@0.7.4
  - @brightweblabs/module-orgs@0.3.10

## 0.9.4

### Patch Changes

- Updated dependencies [a3cc06d]
  - @brightweblabs/app-shell@0.7.3
  - @brightweblabs/module-orgs@0.3.9

## 0.9.3

### Patch Changes

- Updated dependencies [c8070f6]
  - @brightweblabs/app-shell@0.7.2
  - @brightweblabs/core-auth@0.7.2
  - @brightweblabs/module-orgs@0.3.8

## 0.9.2

### Patch Changes

- Updated dependencies [e02eaad]
  - @brightweblabs/core-auth@0.7.1
  - @brightweblabs/app-shell@0.7.1
  - @brightweblabs/module-orgs@0.3.7

## 0.9.1

### Patch Changes

- Updated dependencies [44a415e]
  - @brightweblabs/app-shell@0.7.0
  - @brightweblabs/module-orgs@0.3.6

## 0.9.0

### Minor Changes

- b701aad: Stop advertising a Marketing route from the CRM nav.

  `module-crm` put an "Email Marketing" item at `/admin/marketing` inside its own
  nav group. `module-marketing` depends on `module-crm`, never the reverse, so
  this inverted the declared dependency — and it 404'd in both configurations:

  - **Marketing enabled** — duplicated, and wrong. `module-marketing` registers
    its own group at `/marketing`, which is where the surface actually mounts, so
    the CRM copy pointed at a route no scaffolded app generates.
  - **Marketing disabled** — CRM advertised a module the app did not even have.

  The item is removed; `module-marketing` already contributes the nav for its own
  surface. Apps that rewrote the href through `shell.overrides.ts` (the workaround
  the `create-bw-app` template documents) can drop that override — the nav now
  comes from the module that owns the route.

  A hygiene test asserts no module registration links a route owned by another
  module, so the boundary is enforced rather than remembered.

## 0.8.5

### Patch Changes

- Updated dependencies [10ae6b6]
  - @brightweblabs/infra@0.4.0
  - @brightweblabs/core-auth@0.7.0
  - @brightweblabs/ui@1.1.1
  - @brightweblabs/module-orgs@0.3.5
  - @brightweblabs/app-shell@0.6.2

## 0.8.4

### Patch Changes

- Updated dependencies [032215e]
  - @brightweblabs/core-auth@0.6.1
  - @brightweblabs/module-orgs@0.3.4

## 0.8.3

### Patch Changes

- Updated dependencies [41fa7ee]
  - @brightweblabs/core-auth@0.6.0
  - @brightweblabs/module-orgs@0.3.3

## 0.8.2

### Patch Changes

- b9575c3: Fix campaign and workflow consent enforcement, delivery recovery, activity triggers, and the CRM event manifest declaration.
- Updated dependencies [ba77169]
- Updated dependencies [7eafa76]
  - @brightweblabs/app-shell@0.6.1
  - @brightweblabs/core-auth@0.5.1
  - @brightweblabs/infra@0.3.3
  - @brightweblabs/module-orgs@0.3.2

## 0.8.1

### Patch Changes

- Updated dependencies [22e50aa]
- Updated dependencies [41714ca]
  - @brightweblabs/core-auth@0.5.0
  - @brightweblabs/module-orgs@0.3.1

## 0.8.0

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
  - @brightweblabs/module-orgs@0.3.0
  - @brightweblabs/ui@1.1.0
  - @brightweblabs/infra@0.3.2

## 0.7.0

### Minor Changes

- 1a86493: Translate the CRM dashboard to the MQ composition with the contacts table, Timeline and Organizações right rail, embedded report hero, exported shell toolbar controls, and theme-controlled CRM geometry and typography.

### Patch Changes

- Updated dependencies [1a86493]
  - @brightweblabs/app-shell@0.5.0
  - @brightweblabs/ui@1.0.2
  - @brightweblabs/module-orgs@0.2.3

## 0.6.0

### Minor Changes

- e4afe0e: Port the complete CRM dashboard and operational report into the module package, with Portuguese dictionary defaults, reusable organization and timeline browsers, bulk actions, report data helpers, and thin starter routes for `/crm` and `/crm/report`.

## 0.5.2

### Patch Changes

- @brightweblabs/ui@1.0.1
- @brightweblabs/app-shell@0.4.1
- @brightweblabs/module-orgs@0.2.2

## 0.5.1

### Patch Changes

- Updated dependencies [775366c]
  - @brightweblabs/module-orgs@0.2.1

## 0.5.0

### Minor Changes

- 31d7611: Add the complete CRM contact write path, SQL-backed single and bulk funnel status transitions, staff-only HTTP handlers, the status-changed event contract, and scaffolded POST/PATCH routes.
- 2bb53ad: Ship the package-owned default CRM dashboard, focused CRM UI surfaces, domain tokens, route-backed client, and a ready-to-render `/crm` scaffold route.
- e7a7b89: Extract organizations, membership, invitations, and shared helpers into the organizations foundation module. Preserve the CRM organization-list alias and make CRM and Projects auto-resolve Organizations without forcing Projects to install CRM.

### Patch Changes

- 741ffec: Ship the BrightWeb v1 module manifest with the CRM package.
- 3c0d84b: Align Supabase SSR and the shared Supabase client dependency across infrastructure, auth, and domain packages to avoid duplicate cookie implementations and incompatible client types.
- 090bc48: Align workspace UI consumers with the Lucide 1.x peer range required by `@brightweblabs/ui` 1.0.
- 3c0d84b: Complete module database ownership metadata, including cross-module integration objects, and align declared core compatibility with the published catalog.
- f8b2157: Remove the CRM package's unused theme build dependency, trim unused theme CSS subpath exports while preserving the app-level CSS runtime contract, and retire the redundant CRM playground alias from new app scaffolds.
- Updated dependencies [80b69b1]
- Updated dependencies [3c0d84b]
- Updated dependencies [090bc48]
- Updated dependencies [3c0d84b]
- Updated dependencies [2bb53ad]
- Updated dependencies [e7a7b89]
- Updated dependencies [798e75f]
- Updated dependencies [3c0d84b]
- Updated dependencies [80b69b1]
- Updated dependencies [090bc48]
  - @brightweblabs/ui@1.0.0
  - @brightweblabs/infra@0.3.1
  - @brightweblabs/core-auth@0.3.4
  - @brightweblabs/module-orgs@0.2.0
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

### Patch Changes

- c99a284: Use `count: "exact"` instead of `count: "planned"` when listing CRM contacts
  and organizations and when computing contact status stats, so reported totals
  are accurate rather than Postgres planner estimates. Adopted from the MQ
  Consulting portal.
- Updated dependencies [cc8cfaa]
  - @brightweblabs/ui@0.4.0
  - @brightweblabs/app-shell@0.3.1

## 0.3.4

### Patch Changes

- fd505a0: Improve portal read performance by using planned display counts for CRM and project dashboards/lists, replacing CRM status row aggregation with head-only count queries, and adding read-path indexes to CRM and Projects module migrations.

## 0.3.3

### Patch Changes

- Add composable CRM primary-contact and status-timeline loaders, and refactor the starter dashboard loader to compose the stable CRM helpers.

## 0.3.2

### Patch Changes

- Updated dependencies [7a2c7b2]
  - @brightweblabs/infra@0.3.0
  - @brightweblabs/core-auth@0.3.3

## 0.3.1

### Patch Changes

- Updated dependencies [097992c]
  - @brightweblabs/core-auth@0.3.2
  - @brightweblabs/infra@0.2.2

## 0.3.0

### Minor Changes

- 2adbe49: Expand the CRM package from a starter dashboard helper into a broader stable base contract with reusable CRM list and stats helpers, package-owned GET handlers, mounted CRM starter routes, structured base-contract manifests, and updated docs for the new supported CRM surfaces.

## 0.2.0

### Minor Changes

- 6923aeb: Update latest Next release.

### Patch Changes

- Updated dependencies [6923aeb]
  - @brightweblabs/app-shell@0.3.0
  - @brightweblabs/core-auth@0.3.0
  - @brightweblabs/infra@0.2.0

## 0.1.4

### Patch Changes

- Updated dependencies [dd6fddd]
  - @brightweblabs/core-auth@0.2.0
  - @brightweblabs/app-shell@0.2.0

## 0.1.3

### Patch Changes

- ec7ca19: Minor changes to all modules.
- Updated dependencies [ec7ca19]
  - @brightweblabs/app-shell@0.1.2
  - @brightweblabs/core-auth@0.1.2
  - @brightweblabs/infra@0.1.1

## 0.1.2

### Patch Changes

- 98baa62: Change the CRM organization tax identifier field from `nif` to `taxIdentifierValue`.

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
