# @brightweblabs/app-shell

## 0.15.9

### Patch Changes

- Updated dependencies [7e53c23]
  - @brightweblabs/ui@1.5.3

## 0.15.8

### Patch Changes

- Updated dependencies [9063aaa]
  - @brightweblabs/ui@1.5.2

## 0.15.7

### Patch Changes

- 973f7e1: Redesign the Tarefas dashboard as a responsive task list and sticky pulse summary with configurable task actions, accessible urgency and seven-day due-date breakdowns, stable loading geometry, and centered actionable empty states across dashboard collections.

## 0.15.6

### Patch Changes

- 612fe63: Align the projects, contacts, and tasks dashboard tabs on shared actions, count pills, empty states, spacing, and accessible summary-card patterns.

## 0.15.5

### Patch Changes

- 60232ce: Restructure the Contactos dashboard into a responsive recent-contact grid and sticky Resumo card, with aligned monthly labels, accessible point tooltips, and preserved empty-state behavior.
  - @brightweblabs/ui@1.5.1

## 0.15.4

### Patch Changes

- d6795af: Restructure the projects dashboard into a responsive attention-list and sticky portfolio-health layout, with complete seven-day milestone data for the new timeline.

## 0.15.3

### Patch Changes

- 95a44ed: Keep the theme bootstrap server-renderable so Next.js applications do not encounter a client-rendered script error during hydration.

## 0.15.2

### Patch Changes

- fb3bb21: Add a URL-based dashboard quick action that opens the new-project form from the Projects tab, including direct and new-tab navigation.

## 0.15.1

### Patch Changes

- ce90992: Show an "Este mês" headline with a delta chip versus the previous month on the contacts rhythm card, replacing the duplicated "Últimos 30 dias" label; adds thisMonth and vsPreviousMonth as optional dictionary keys.

## 0.15.0

### Minor Changes

- 94e10d3: Add a twelve-month contact rhythm view to the shared dashboard, distinguish contact creation dates, and provide deep-linked new-contact actions that open the CRM creation flow.

### Patch Changes

- 94e10d3: Make project health, attention counts, ownership gaps, deadlines, and empty milestones tell one consistent and accessible dashboard story.
- 94e10d3: Load the theme bootstrap through Next.js before hydration to avoid React client-rendered script errors.

## 0.14.4

### Patch Changes

- cc7d41c: Standardize application surfaces on a single polymorphic Card recipe with explicit visual, density, and motion variants. Migrate dashboard and module cards to the shared foundation, preserve native link behavior for interactive project cards, and make dashboard project-card styling independent of route-level stylesheet loading.
- Updated dependencies [cc7d41c]
  - @brightweblabs/ui@1.5.0

## 0.14.3

### Patch Changes

- Updated dependencies [1de7902]
  - @brightweblabs/ui@1.4.11

## 0.14.2

### Patch Changes

- ac5871e: Align the Projects dashboard with the approved card language by normalizing legacy all-caps organization names for display, reducing attention-card due-date typography by one token step, and reusing Overview's Próximas metas panel in the Projects view.
- ef36f3d: Replace the oversized, uppercase, widely tracked label treatment with compact sentence-case typography across shared portal surfaces. Keep monospace and uppercase styling only for structured data such as project codes and initials.
  - @brightweblabs/ui@1.4.10

## 0.14.1

### Patch Changes

- 9fc9ee5: Bring dashboard project-attention rows into parity with the approved prototype using reusable design-system recipes, natural-case metadata, richer context, and intentional responsive behavior.
- Updated dependencies [db5a6ab]
  - @brightweblabs/ui@1.4.9

## 0.14.0

### Minor Changes

- b083ca3: Mount the shared Sonner toaster from every app shell by default, with an escape hatch for custom or disabled toast regions. Remove duplicate route-scoped toaster mounts from generated apps, localize project clipboard feedback, use warning severity for partial admin role changes, add context-specific marketing validation messages, and read Project UI failures only from the public error envelope.

## 0.13.0

### Minor Changes

- b065163: Add a project portfolio briefing to the dashboard with ranked attention projects, real upcoming project metas, healthy and loading states, and project-card interaction affordances shared with the Projects module.

### Patch Changes

- Updated dependencies [fa591ab]
  - @brightweblabs/ui@1.4.8

## 0.12.0

### Minor Changes

- 69eb6d5: Replace the clipped dashboard task preview with a responsive attention queue that ranks blocked, overdue, due-today, and due-soon work by priority and deadline. Add honest task totals, paginated full-task loading beyond 100 items, and a Projects-owned canonical dashboard task row. Update generated dashboard clients to request subsequent task pages.

## 0.11.5

### Patch Changes

- da843d7: Use “meta” consistently across the Portuguese dashboard and project interfaces while preserving milestone API compatibility.

## 0.11.4

### Patch Changes

- 4ba15c1: Restore the branded dashboard hero and bento layout, and preserve canonical typography roles when composing them with semantic text colors.

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
