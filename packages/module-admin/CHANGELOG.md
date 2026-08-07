# @brightweblabs/module-admin

## 0.8.18

### Patch Changes

- Updated dependencies [94e10d3]
- Updated dependencies [94e10d3]
- Updated dependencies [94e10d3]
  - @brightweblabs/app-shell@0.15.0

## 0.8.17

### Patch Changes

- Updated dependencies [cc7d41c]
  - @brightweblabs/ui@1.5.0
  - @brightweblabs/app-shell@0.14.4
  - @brightweblabs/core-auth@0.10.8

## 0.8.16

### Patch Changes

- Updated dependencies [1de7902]
  - @brightweblabs/ui@1.4.11
  - @brightweblabs/app-shell@0.14.3
  - @brightweblabs/core-auth@0.10.7

## 0.8.15

### Patch Changes

- ef36f3d: Replace the oversized, uppercase, widely tracked label treatment with compact sentence-case typography across shared portal surfaces. Keep monospace and uppercase styling only for structured data such as project codes and initials.
- Updated dependencies [ac5871e]
- Updated dependencies [ef36f3d]
  - @brightweblabs/app-shell@0.14.2
  - @brightweblabs/core-auth@0.10.6
  - @brightweblabs/ui@1.4.10

## 0.8.14

### Patch Changes

- ba9974c: Expire stale admin invitations before listing or replacing them, and show past expiry dates as expired instead of expiring today.
- Updated dependencies [db5a6ab]
- Updated dependencies [9fc9ee5]
  - @brightweblabs/ui@1.4.9
  - @brightweblabs/app-shell@0.14.1
  - @brightweblabs/core-auth@0.10.5

## 0.8.13

### Patch Changes

- b083ca3: Mount the shared Sonner toaster from every app shell by default, with an escape hatch for custom or disabled toast regions. Remove duplicate route-scoped toaster mounts from generated apps, localize project clipboard feedback, use warning severity for partial admin role changes, add context-specific marketing validation messages, and read Project UI failures only from the public error envelope.
- Updated dependencies [b083ca3]
  - @brightweblabs/app-shell@0.14.0

## 0.8.12

### Patch Changes

- Updated dependencies [fa591ab]
- Updated dependencies [b065163]
  - @brightweblabs/ui@1.4.8
  - @brightweblabs/app-shell@0.13.0
  - @brightweblabs/core-auth@0.10.4

## 0.8.11

### Patch Changes

- Updated dependencies [69eb6d5]
  - @brightweblabs/app-shell@0.12.0

## 0.8.10

### Patch Changes

- Updated dependencies [da843d7]
  - @brightweblabs/app-shell@0.11.5

## 0.8.9

### Patch Changes

- Updated dependencies [4ba15c1]
  - @brightweblabs/app-shell@0.11.4

## 0.8.8

### Patch Changes

- 5b75161: Add optional task and project start dates with date-range validation, introduce an accessible BrightWeb selector with a fully styled popup across all package UI dropdowns, and organize task, CRM contact, CRM organization, and project creation sheets into consistent semantic sections.
- Updated dependencies [5b75161]
- Updated dependencies [5b75161]
  - @brightweblabs/app-shell@0.11.3
  - @brightweblabs/ui@1.4.7
  - @brightweblabs/core-auth@0.10.3

## 0.8.7

### Patch Changes

- Updated dependencies [29ae3b0]
  - @brightweblabs/ui@1.4.6
  - @brightweblabs/app-shell@0.11.2
  - @brightweblabs/core-auth@0.10.2

## 0.8.6

### Patch Changes

- 05e0902: Standardize platform actions on the flat Projects button treatment and migrate shell and module toolbars to the shared Button primitive.
- 05e0902: Add semantic KPI and structured-data typography roles, then align headings,
  labels, metadata, controls, and numeric values with their intended shared roles.
- Updated dependencies [05e0902]
- Updated dependencies [05e0902]
  - @brightweblabs/ui@1.4.5
  - @brightweblabs/app-shell@0.11.1
  - @brightweblabs/core-auth@0.10.1

## 0.8.5

### Patch Changes

- Updated dependencies [9518642]
  - @brightweblabs/app-shell@0.11.0
  - @brightweblabs/core-auth@0.10.0

## 0.8.4

### Patch Changes

- Updated dependencies [360f518]
  - @brightweblabs/app-shell@0.10.3
  - @brightweblabs/ui@1.4.4
  - @brightweblabs/core-auth@0.9.5

## 0.8.3

### Patch Changes

- 9547657: Show the pointer cursor consistently for enabled shared buttons and module toolbar controls.
- Updated dependencies [9547657]
  - @brightweblabs/ui@1.4.3
  - @brightweblabs/app-shell@0.10.2
  - @brightweblabs/core-auth@0.9.4

## 0.8.2

### Patch Changes

- Updated dependencies
  - @brightweblabs/ui@1.4.2
  - @brightweblabs/app-shell@0.10.1
  - @brightweblabs/core-auth@0.9.3

## 0.8.1

### Patch Changes

- Standardize faster cancellable, observable latest-request behavior across collection surfaces; add authoritative CRM organization and joined timeline search plus aggregate dashboard metrics; add paginated Marketing search, filters, create actions, toolbar registration, and lazy analytics loading; preserve useful rows while requests refresh; and scaffold database indexes for contains-search and common filters.
- Updated dependencies
  - @brightweblabs/infra@0.7.0
  - @brightweblabs/app-shell@0.10.0
  - @brightweblabs/core-auth@0.9.2

## 0.8.0

### Minor Changes

- Make collection searches and filters feel immediate across CRM, Projects, and Admin with abortable requests, search-only debouncing, pending feedback, and privacy-safe timing metrics. Filter Admin user searches at the role-assignment level so result counts and pagination include only matching profiles.

### Patch Changes

- Updated dependencies
- Updated dependencies [f12ce99]
  - @brightweblabs/infra@0.6.0
  - @brightweblabs/ui@1.4.1
  - @brightweblabs/app-shell@0.9.3
  - @brightweblabs/core-auth@0.9.1

## 0.7.2

### Patch Changes

- Updated dependencies [6bba363]
  - @brightweblabs/app-shell@0.9.2

## 0.7.1

### Patch Changes

- Updated dependencies
  - @brightweblabs/app-shell@0.9.1

## 0.7.0

### Minor Changes

- Add an authenticated Supabase Realtime activity stream with MQ-compatible notification and refresh coverage across the notification inbox, CRM, Admin, Dashboard, Projects portfolio/detail/board/account views, and project activity.

  Publish `app_activity_events` with domain-aware RLS, retain removed/deleted project audiences without broadening the canonical project ACL, and emit missing Admin role-change events so every supported mutation invalidates the matching live surfaces.

- 3d52715: Redesign the shared invitation and recovery journeys for a more structured professional-services portal experience.

  Add reusable, localizable password-strength APIs; responsive auth layouts and state primitives; distinct invitation loading, success, invalid, expired, accepted, revoked, and acceptance-error states; and invalid recovery-link handling.

  Add kind-aware authenticated invitation acceptance, including admin-role invitations, and scaffold the required dependency for new BrightWeb applications.

  Improve admin invitation creation and management with visible form guidance, inline delivery feedback, retryable loading errors, responsive mobile cards, expiry cues, and confirmed revocation.

  Upgrade the default admin invitation email with a robust responsive layout, role context, expiry information, and a plain-text fallback.

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

## 0.5.11

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

## 0.5.10

### Patch Changes

- Updated dependencies [5c4cd96]
  - @brightweblabs/app-shell@0.7.4

## 0.5.9

### Patch Changes

- Updated dependencies [a3cc06d]
  - @brightweblabs/app-shell@0.7.3

## 0.5.8

### Patch Changes

- Updated dependencies [c8070f6]
  - @brightweblabs/app-shell@0.7.2
  - @brightweblabs/core-auth@0.7.2

## 0.5.7

### Patch Changes

- Updated dependencies [e02eaad]
  - @brightweblabs/core-auth@0.7.1
  - @brightweblabs/app-shell@0.7.1

## 0.5.6

### Patch Changes

- Updated dependencies [44a415e]
  - @brightweblabs/app-shell@0.7.0

## 0.5.5

### Patch Changes

- Updated dependencies [10ae6b6]
  - @brightweblabs/infra@0.4.0
  - @brightweblabs/core-auth@0.7.0
  - @brightweblabs/ui@1.1.1
  - @brightweblabs/app-shell@0.6.2

## 0.5.4

### Patch Changes

- Updated dependencies [032215e]
  - @brightweblabs/core-auth@0.6.1

## 0.5.3

### Patch Changes

- Updated dependencies [41fa7ee]
  - @brightweblabs/core-auth@0.6.0

## 0.5.2

### Patch Changes

- Updated dependencies [ba77169]
- Updated dependencies [7eafa76]
  - @brightweblabs/app-shell@0.6.1
  - @brightweblabs/core-auth@0.5.1
  - @brightweblabs/infra@0.3.3

## 0.5.1

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
  - @brightweblabs/ui@1.1.0
  - @brightweblabs/infra@0.3.2

## 0.4.1

### Patch Changes

- Updated dependencies [1a86493]
  - @brightweblabs/app-shell@0.5.0
  - @brightweblabs/ui@1.0.2

## 0.4.0

### Minor Changes

- a461564: Keep generated apps thin by removing demo pages, local feature components, and helper libraries; mount CRM and Admin package surfaces directly, expose the package-owned `AdminUsersPage`, and omit a Projects route until the package ships default UI.

## 0.3.5

### Patch Changes

- @brightweblabs/ui@1.0.1
- @brightweblabs/app-shell@0.4.1

## 0.3.4

### Patch Changes

- 741ffec: Ship the BrightWeb v1 module manifest with the admin package.
- 090bc48: Align workspace UI consumers with the Lucide 1.x peer range required by `@brightweblabs/ui` 1.0.
- 3c0d84b: Complete module database ownership metadata, including cross-module integration objects, and align declared core compatibility with the published catalog.
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

## 0.3.3

### Patch Changes

- Updated dependencies [cc8cfaa]
  - @brightweblabs/ui@0.4.0
  - @brightweblabs/app-shell@0.3.1

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

- 6923aeb: Update latest Next release.

### Patch Changes

- Updated dependencies [6923aeb]
  - @brightweblabs/app-shell@0.3.0
  - @brightweblabs/core-auth@0.3.0
  - @brightweblabs/infra@0.2.0
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
  - @brightweblabs/core-auth@0.2.0
  - @brightweblabs/ui@0.2.0
  - @brightweblabs/app-shell@0.2.0

## 0.1.2

### Patch Changes

- ec7ca19: Minor changes to all modules.
- Updated dependencies [ec7ca19]
  - @brightweblabs/app-shell@0.1.2
  - @brightweblabs/core-auth@0.1.2
  - @brightweblabs/infra@0.1.1
  - @brightweblabs/ui@0.1.1

## 0.1.1

### Patch Changes

- a36ed3b: Replace internal workspace protocol dependencies with published version ranges.
- Updated dependencies [a36ed3b]
  - @brightweblabs/app-shell@0.1.1
  - @brightweblabs/core-auth@0.1.1

## 0.1.0

### Minor Changes

- Initial public release of the BrightWeb Labs platform packages.

### Patch Changes

- Updated dependencies
  - @brightweblabs/app-shell@0.1.0
  - @brightweblabs/core-auth@0.1.0
  - @brightweblabs/infra@0.1.0
  - @brightweblabs/ui@0.1.0
