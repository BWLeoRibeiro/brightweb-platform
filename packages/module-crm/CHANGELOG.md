# @brightweblabs/module-crm

## 0.17.2

### Patch Changes

- Updated dependencies [7e53c23]
  - @brightweblabs/core-auth@0.10.11
  - @brightweblabs/ui@1.5.3
  - @brightweblabs/module-orgs@0.6.1
  - @brightweblabs/app-shell@0.15.9

## 0.17.1

### Patch Changes

- 5e273cc: Clear contact and organization creation URL intents when their right rails close so cancelled creation flows do not reopen after reload or navigation.

## 0.17.0

### Minor Changes

- 9063aaa: Add client invitations tied to organizations, a CRM organization access page, invitation history, safe organization member role/removal operations, and shared branded invitation and authentication email designs. New CRM starters mount the organization detail route and organization member API handlers.

### Patch Changes

- Updated dependencies [9063aaa]
  - @brightweblabs/module-orgs@0.6.0
  - @brightweblabs/core-auth@0.10.10
  - @brightweblabs/ui@1.5.2
  - @brightweblabs/app-shell@0.15.8

## 0.16.8

### Patch Changes

- Updated dependencies [973f7e1]
  - @brightweblabs/app-shell@0.15.7
  - @brightweblabs/module-orgs@0.5.7

## 0.16.7

### Patch Changes

- Updated dependencies [612fe63]
  - @brightweblabs/app-shell@0.15.6
  - @brightweblabs/module-orgs@0.5.6

## 0.16.6

### Patch Changes

- Updated dependencies [60232ce]
  - @brightweblabs/app-shell@0.15.5
  - @brightweblabs/module-orgs@0.5.5
  - @brightweblabs/ui@1.5.1
  - @brightweblabs/core-auth@0.10.9

## 0.16.5

### Patch Changes

- 5906c1c: Limit the dashboard's recently added contacts to the five newest records.

## 0.16.4

### Patch Changes

- Updated dependencies [d6795af]
  - @brightweblabs/app-shell@0.15.4
  - @brightweblabs/module-orgs@0.5.4

## 0.16.3

### Patch Changes

- Updated dependencies [95a44ed]
  - @brightweblabs/app-shell@0.15.3
  - @brightweblabs/module-orgs@0.5.3

## 0.16.2

### Patch Changes

- Updated dependencies [fb3bb21]
  - @brightweblabs/app-shell@0.15.2
  - @brightweblabs/module-orgs@0.5.2

## 0.16.1

### Patch Changes

- Updated dependencies [ce90992]
  - @brightweblabs/app-shell@0.15.1
  - @brightweblabs/module-orgs@0.5.1

## 0.16.0

### Minor Changes

- 94e10d3: Add a twelve-month contact rhythm view to the shared dashboard, distinguish contact creation dates, and provide deep-linked new-contact actions that open the CRM creation flow.
- 94e10d3: Use one shared organization-creation sheet in CRM and Projects, including optional member invitations. Contact and project drafts now resume with the newly created organization selected, and both use the same compact, accessible plus button.

### Patch Changes

- Updated dependencies [94e10d3]
- Updated dependencies [94e10d3]
- Updated dependencies [94e10d3]
- Updated dependencies [94e10d3]
  - @brightweblabs/app-shell@0.15.0
  - @brightweblabs/module-orgs@0.5.0

## 0.15.18

### Patch Changes

- 557eeb9: Keep the CRM contacts table flush with its shared card surface even when card defaults add padding.

## 0.15.17

### Patch Changes

- cc7d41c: Standardize application surfaces on a single polymorphic Card recipe with explicit visual, density, and motion variants. Migrate dashboard and module cards to the shared foundation, preserve native link behavior for interactive project cards, and make dashboard project-card styling independent of route-level stylesheet loading.
- Updated dependencies [cc7d41c]
  - @brightweblabs/ui@1.5.0
  - @brightweblabs/app-shell@0.14.4
  - @brightweblabs/core-auth@0.10.8
  - @brightweblabs/module-orgs@0.4.12

## 0.15.16

### Patch Changes

- Updated dependencies [1de7902]
  - @brightweblabs/ui@1.4.11
  - @brightweblabs/app-shell@0.14.3
  - @brightweblabs/core-auth@0.10.7
  - @brightweblabs/module-orgs@0.4.11

## 0.15.15

### Patch Changes

- Match contact updated dates to the table's muted body-text weight and color while retaining compact tabular typography.

## 0.15.14

### Patch Changes

- 3d61932: Read the CRM timeline from retained activity events so status changes and contact deletions remain visible after a contact is deleted.
- ef36f3d: Replace the oversized, uppercase, widely tracked label treatment with compact sentence-case typography across shared portal surfaces. Keep monospace and uppercase styling only for structured data such as project codes and initials.
- Updated dependencies [ac5871e]
- Updated dependencies [ef36f3d]
  - @brightweblabs/app-shell@0.14.2
  - @brightweblabs/core-auth@0.10.6
  - @brightweblabs/module-orgs@0.4.10
  - @brightweblabs/ui@1.4.10

## 0.15.13

### Patch Changes

- Reduce the size and visual emphasis of updated dates in the shared contacts table.

## 0.15.12

### Patch Changes

- c88018a: Align the organization danger zone to the same full-width geometry and card radius as the surrounding detail sections.
- Updated dependencies [db5a6ab]
- Updated dependencies [9fc9ee5]
  - @brightweblabs/ui@1.4.9
  - @brightweblabs/app-shell@0.14.1
  - @brightweblabs/core-auth@0.10.5
  - @brightweblabs/module-orgs@0.4.9

## 0.15.11

### Patch Changes

- bfcd6bc: Render organization websites as normalized, keyboard-focusable external links in the organization detail view while preserving the URL input in edit mode.

## 0.15.10

### Patch Changes

- Updated dependencies [b083ca3]
  - @brightweblabs/app-shell@0.14.0
  - @brightweblabs/module-orgs@0.4.8

## 0.15.9

### Patch Changes

- 15f4153: Make CRM organization cards visibly interactive with a full-card click target, pointer cursor, hover elevation, and keyboard focus treatment.

## 0.15.8

### Patch Changes

- Updated dependencies [fa591ab]
- Updated dependencies [b065163]
  - @brightweblabs/ui@1.4.8
  - @brightweblabs/app-shell@0.13.0
  - @brightweblabs/core-auth@0.10.4
  - @brightweblabs/module-orgs@0.4.7

## 0.15.7

### Patch Changes

- Updated dependencies [69eb6d5]
  - @brightweblabs/app-shell@0.12.0
  - @brightweblabs/module-orgs@0.4.6

## 0.15.6

### Patch Changes

- Updated dependencies [da843d7]
  - @brightweblabs/app-shell@0.11.5
  - @brightweblabs/module-orgs@0.4.5

## 0.15.5

### Patch Changes

- Updated dependencies [4ba15c1]
  - @brightweblabs/app-shell@0.11.4
  - @brightweblabs/module-orgs@0.4.4

## 0.15.4

### Patch Changes

- e0d4385: Ignore a phone country dial code without a subscriber number when detecting or saving CRM contact changes.

## 0.15.3

### Patch Changes

- 8138f26: Prevent unchanged CRM contact and organization editors from submitting when entering edit mode.

## 0.15.2

### Patch Changes

- 1222a62: Keep CRM contact and organization sheets controlled while editing so dialog-generated close events cannot dismiss active forms.

## 0.15.1

### Patch Changes

- 7c3ea34: Keep contact and organization sheets open during editing when an outside interaction occurs, preventing accidental dismissal and lost changes.

## 0.15.0

### Minor Changes

- 5b75161: Add optional task and project start dates with date-range validation, introduce an accessible BrightWeb selector with a fully styled popup across all package UI dropdowns, and organize task, CRM contact, CRM organization, and project creation sheets into consistent semantic sections.

### Patch Changes

- Updated dependencies [5b75161]
- Updated dependencies [5b75161]
  - @brightweblabs/app-shell@0.11.3
  - @brightweblabs/ui@1.4.7
  - @brightweblabs/core-auth@0.10.3
  - @brightweblabs/module-orgs@0.4.3

## 0.14.4

### Patch Changes

- Updated dependencies [29ae3b0]
  - @brightweblabs/ui@1.4.6
  - @brightweblabs/app-shell@0.11.2
  - @brightweblabs/core-auth@0.10.2
  - @brightweblabs/module-orgs@0.4.2

## 0.14.3

### Patch Changes

- 95e7ae7: Keep CRM sidebar previews stable at one entry with matching loading geometry and visible collection counts.

## 0.14.2

### Patch Changes

- 05e0902: Standardize platform actions on the flat Projects button treatment and migrate shell and module toolbars to the shared Button primitive.
- 05e0902: Add semantic KPI and structured-data typography roles, then align headings,
  labels, metadata, controls, and numeric values with their intended shared roles.
- 05e0902: Stabilize the CRM dashboard sidebar around a one-entry baseline while timeline and organization previews load.
- Updated dependencies [05e0902]
- Updated dependencies [05e0902]
  - @brightweblabs/ui@1.4.5
  - @brightweblabs/app-shell@0.11.1
  - @brightweblabs/core-auth@0.10.1
  - @brightweblabs/module-orgs@0.4.1

## 0.14.1

### Patch Changes

- 5c8ca12: Replace the native organization deletion prompt with an accessible in-app confirmation dialog that requires the exact organization name.

## 0.14.0

### Minor Changes

- 9518642: Add lifecycle-safe deletion UI and APIs for projects, organizations, CRM records, marketing resources, recipients, invitations, and per-user notification dismissal. Generated applications now include the required routes, permission wiring, and database migration.

### Patch Changes

- Updated dependencies [9518642]
  - @brightweblabs/app-shell@0.11.0
  - @brightweblabs/core-auth@0.10.0
  - @brightweblabs/module-orgs@0.4.0

## 0.13.3

### Patch Changes

- Updated dependencies [360f518]
  - @brightweblabs/app-shell@0.10.3
  - @brightweblabs/module-orgs@0.3.20
  - @brightweblabs/ui@1.4.4
  - @brightweblabs/core-auth@0.9.5

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
