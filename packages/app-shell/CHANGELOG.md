# @brightweblabs/app-shell

## 0.11.3

### Patch Changes

- 5b75161: Refocus the shared dashboard on today’s attention, active work, and recent CRM changes, and align the marketing workspace with shared shell chrome through a simpler campaign ledger, staged sending actions, and one authoritative create action per collection.
- 5b75161: Add optional task and project start dates with date-range validation, introduce an accessible BrightWeb selector with a fully styled popup across all package UI dropdowns, and organize task, CRM contact, CRM organization, and project creation sheets into consistent semantic sections.
- Updated dependencies [5b75161]
  - @brightweblabs/ui@1.4.7

## 0.11.2

### Patch Changes

- Updated dependencies [29ae3b0]
  - @brightweblabs/ui@1.4.6

## 0.11.1

### Patch Changes

- 05e0902: Standardize platform actions on the flat Projects button treatment and migrate shell and module toolbars to the shared Button primitive.
- 05e0902: Add semantic KPI and structured-data typography roles, then align headings,
  labels, metadata, controls, and numeric values with their intended shared roles.
- Updated dependencies [05e0902]
- Updated dependencies [05e0902]
  - @brightweblabs/ui@1.4.5

## 0.11.0

### Minor Changes

- 9518642: Add lifecycle-safe deletion UI and APIs for projects, organizations, CRM records, marketing resources, recipients, invitations, and per-user notification dismissal. Generated applications now include the required routes, permission wiring, and database migration.

## 0.10.3

### Patch Changes

- 360f518: Remove the elevated shadow from primary header toolbar actions so application navigation bars use a flat, consistent surface.
  - @brightweblabs/ui@1.4.4

## 0.10.2

### Patch Changes

- 9547657: Show the pointer cursor consistently for enabled shared buttons and module toolbar controls.
- Updated dependencies [9547657]
  - @brightweblabs/ui@1.4.3

## 0.10.1

### Patch Changes

- Updated dependencies
  - @brightweblabs/ui@1.4.2

## 0.10.0

### Minor Changes

- Standardize faster cancellable, observable latest-request behavior across collection surfaces; add authoritative CRM organization and joined timeline search plus aggregate dashboard metrics; add paginated Marketing search, filters, create actions, toolbar registration, and lazy analytics loading; preserve useful rows while requests refresh; and scaffold database indexes for contains-search and common filters.

### Patch Changes

- Updated dependencies
  - @brightweblabs/infra@0.7.0

## 0.9.3

### Patch Changes

- Updated dependencies
- Updated dependencies [f12ce99]
  - @brightweblabs/infra@0.6.0
  - @brightweblabs/ui@1.4.1

## 0.9.2

### Patch Changes

- 6bba363: Normalize account-menu and CRM sheet typography so secondary account text uses natural casing and shared sheet headings, labels, and status controls follow the platform type scale.

## 0.9.1

### Patch Changes

- Standardize account and sheet typography around natural-case secondary data, clearer panel titles, restrained structural labels, and reusable sentence-case field labels across platform modules.

## 0.9.0

### Minor Changes

- a9508ef: Add the shared activity-notification inbox, authenticated notification handlers,
  and default shell bell wiring for scaffolded platform applications.
- Add an authenticated Supabase Realtime activity stream with MQ-compatible notification and refresh coverage across the notification inbox, CRM, Admin, Dashboard, Projects portfolio/detail/board/account views, and project activity.

  Publish `app_activity_events` with domain-aware RLS, retain removed/deleted project audiences without broadening the canonical project ACL, and emit missing Admin role-change events so every supported mutation invalidates the matching live surfaces.

- Add reusable, responsive module top-bar composition with registry-gated CRM,
  Projects, and Admin controls, full CRM sorting parity, mobile access to route
  actions and notifications, and actor-aware notification inbox details.

  Generate the same route-driven toolbar integration for new and updated apps,
  without putting module behavior in application shell layouts.

### Patch Changes

- Updated dependencies [14c7881]
- Updated dependencies
- Updated dependencies [3d52715]
  - @brightweblabs/infra@0.5.0
  - @brightweblabs/ui@1.4.0

## 0.8.0

### Minor Changes

- 90c9bf0: Converge theme state on one BrightWeb provider, default new apps to the system theme, improve packaged auth geometry and accessibility, make pnpm plus keepalive setup reproducible in generated apps, and bound Marketing audience processing.
- a03392d: Toolbar actions now flow through a shell action registry (ShellActionsProvider / useShellAction) instead of fire-and-forget window events: header, breadcrumb, search, filter, and create controls stay disabled until the routed page has registered every handler they dispatch, so an interaction can never be silently swallowed (#84). Module action listeners migrated to the registry with a window-event compatibility bridge for shells without a provider; page-to-toolbar state sync events are unchanged. The CRM organization sheet also blocks re-submits while a save is in flight.

### Patch Changes

- c05dc17: Migrate package-owned interface typography to the canonical visual-role utilities while preserving contextual auth, report, dashboard, and compact-control sizing.
- abe0722: Surface server publicError envelopes ({error: {code, message}}) in dashboard section errors instead of always falling back to generic copy, and treat data-less error payloads as envelopes.
- Updated dependencies [c05dc17]
- Updated dependencies [90c9bf0]
  - @brightweblabs/ui@1.2.0

## 0.7.4

### Patch Changes

- 5c4cd96: Wire scaffolded dashboards to authenticated module-owned Projects, CRM, and Tasks data producers, preserve independent section failures, and enforce registration-to-endpoint parity in tests.

## 0.7.3

### Patch Changes

- a3cc06d: Render registered primary toolbar actions even when no title is supplied, wire scaffolded shell action dispatch and active navigation titles, add the missing admin invitation routes, and guard template/preview shell prop parity.

## 0.7.2

### Patch Changes

- c8070f6: Expose the configured admin destination in the mobile shell, return a real 404
  from legacy invite-only signup mounts, and stop scaffolding the unavailable
  signup route in new invite-only apps.

## 0.7.1

### Patch Changes

- e02eaad: Handle expired recovery errors and implicit recovery sessions from Supabase URL fragments before allowing password updates.

  Render every resolved module navigation group in the mobile navigation and wire generated and preview apps to provide them. `MobileNav` callers must now pass the resolved groups through the new required `navGroups` prop.

## 0.7.0

### Minor Changes

- 44a415e: Render every module-provided navigation group in the desktop sidebar, in registration order. Modules that own their own group, including Marketing, now appear in scaffolded apps instead of only the hardcoded CRM group being reachable.

  The `DesktopSidebar` direct-call API is updated from CRM-specific props to `navGroups`, `isNavGroupExpanded`, `isNavGroupActive`, and `onToggleNavGroup`.

## 0.6.2

### Patch Changes

- @brightweblabs/ui@1.1.1

## 0.6.1

### Patch Changes

- ba77169: Normalize Next.js as a library peer dependency, add the marketing scaffold manifest, and keep the core scaffold migration set aligned.

## 0.6.0

### Minor Changes

- b0362c3: Ship the consolidated platform surface release: shell navigation, dashboard,
  theme switching, branded status pages, packaged authentication and invitation
  flows, Admin, CRM, Projects, and organization persistence. Add tokenized Geist
  typography, shared UI primitives, MQ parity, and accessibility and robustness
  hardening across those surfaces.

### Patch Changes

- Updated dependencies [b0362c3]
  - @brightweblabs/ui@1.1.0

## 0.5.0

### Minor Changes

- 1a86493: Add the MQ-parity shell frame, sidebar rail, account menu, fully tokenized shell and CRM visual contract, typography aliases, systemic border color, and table pagination styling used by the CRM dashboard. Guard package components against raw color recipes.

### Patch Changes

- Updated dependencies [1a86493]
  - @brightweblabs/ui@1.0.2

## 0.4.1

### Patch Changes

- @brightweblabs/ui@1.0.1

## 0.4.0

### Minor Changes

- 798e75f: Add pure, typed shell registration override helpers and resolve overlapping toolbar routes by specificity, including dynamic path segments. The matcher fix can change toolbar selection for apps that relied on the previous order-dependent resolution.
- 80b69b1: Retokenize shell controls, navigation, borders, fills, hover states, and typography against the shared theme contract. This is a visual change for consumers that relied on the previous hardcoded black and white alpha styling.

### Patch Changes

- 090bc48: Align workspace UI consumers with the Lucide 1.x peer range required by `@brightweblabs/ui` 1.0.
- 3c0d84b: Remove the unused `next-themes` dependency from the app shell package.
- Updated dependencies [80b69b1]
- Updated dependencies [2bb53ad]
- Updated dependencies [090bc48]
  - @brightweblabs/ui@1.0.0

## 0.3.1

### Patch Changes

- Updated dependencies [cc8cfaa]
  - @brightweblabs/ui@0.4.0

## 0.3.0

### Minor Changes

- 6923aeb: Update latest Next release.

### Patch Changes

- Updated dependencies [6923aeb]
  - @brightweblabs/ui@0.3.0

## 0.2.0

### Minor Changes

- dd6fddd: Refactor package boundaries across the workspace and align the preview sandbox setup.

  - add explicit `@brightweblabs/core-auth/shared` exports and remove the root `core-auth` barrel in favor of canonical `shared`, `client`, and `server` entrypoints
  - add UI subpath exports and update first-party consumers to import directly from those package entrypoints
  - simplify app-shell navigation primitives and refresh the platform preview sandbox copy to reflect its internal sandbox role
  - update `create-bw-app` templates and generator metadata to match the new preview app and package import surfaces

### Patch Changes

- Updated dependencies [dd6fddd]
  - @brightweblabs/ui@0.2.0

## 0.1.2

### Patch Changes

- ec7ca19: Minor changes to all modules.
- Updated dependencies [ec7ca19]
  - @brightweblabs/ui@0.1.1

## 0.1.1

### Patch Changes

- a36ed3b: Replace internal workspace protocol dependencies with published version ranges.

## 0.1.0

### Minor Changes

- Initial public release of the BrightWeb Labs platform packages.

### Patch Changes

- Updated dependencies
  - @brightweblabs/ui@0.1.0
