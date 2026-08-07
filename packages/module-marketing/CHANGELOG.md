# @brightweblabs/module-marketing

## 0.4.16

### Patch Changes

- Updated dependencies [95a44ed]
  - @brightweblabs/app-shell@0.15.3

## 0.4.15

### Patch Changes

- Updated dependencies [fb3bb21]
  - @brightweblabs/app-shell@0.15.2

## 0.4.14

### Patch Changes

- Updated dependencies [ce90992]
  - @brightweblabs/app-shell@0.15.1

## 0.4.13

### Patch Changes

- Updated dependencies [94e10d3]
- Updated dependencies [94e10d3]
- Updated dependencies [94e10d3]
  - @brightweblabs/app-shell@0.15.0

## 0.4.12

### Patch Changes

- cc7d41c: Standardize application surfaces on a single polymorphic Card recipe with explicit visual, density, and motion variants. Migrate dashboard and module cards to the shared foundation, preserve native link behavior for interactive project cards, and make dashboard project-card styling independent of route-level stylesheet loading.
- Updated dependencies [cc7d41c]
  - @brightweblabs/ui@1.5.0
  - @brightweblabs/app-shell@0.14.4
  - @brightweblabs/core-auth@0.10.8

## 0.4.11

### Patch Changes

- Updated dependencies [1de7902]
  - @brightweblabs/ui@1.4.11
  - @brightweblabs/app-shell@0.14.3
  - @brightweblabs/core-auth@0.10.7

## 0.4.10

### Patch Changes

- ef36f3d: Replace the oversized, uppercase, widely tracked label treatment with compact sentence-case typography across shared portal surfaces. Keep monospace and uppercase styling only for structured data such as project codes and initials.
- Updated dependencies [ac5871e]
- Updated dependencies [ef36f3d]
  - @brightweblabs/app-shell@0.14.2
  - @brightweblabs/core-auth@0.10.6
  - @brightweblabs/ui@1.4.10

## 0.4.9

### Patch Changes

- Updated dependencies [db5a6ab]
- Updated dependencies [9fc9ee5]
  - @brightweblabs/ui@1.4.9
  - @brightweblabs/app-shell@0.14.1
  - @brightweblabs/core-auth@0.10.5

## 0.4.8

### Patch Changes

- b083ca3: Mount the shared Sonner toaster from every app shell by default, with an escape hatch for custom or disabled toast regions. Remove duplicate route-scoped toaster mounts from generated apps, localize project clipboard feedback, use warning severity for partial admin role changes, add context-specific marketing validation messages, and read Project UI failures only from the public error envelope.
- Updated dependencies [b083ca3]
  - @brightweblabs/app-shell@0.14.0

## 0.4.7

### Patch Changes

- Updated dependencies [fa591ab]
- Updated dependencies [b065163]
  - @brightweblabs/ui@1.4.8
  - @brightweblabs/app-shell@0.13.0
  - @brightweblabs/core-auth@0.10.4

## 0.4.6

### Patch Changes

- Updated dependencies [69eb6d5]
  - @brightweblabs/app-shell@0.12.0

## 0.4.5

### Patch Changes

- Updated dependencies [da843d7]
  - @brightweblabs/app-shell@0.11.5

## 0.4.4

### Patch Changes

- Updated dependencies [4ba15c1]
  - @brightweblabs/app-shell@0.11.4

## 0.4.3

### Patch Changes

- 5b75161: Refocus the shared dashboard on today’s attention, active work, and recent CRM changes, and align the marketing workspace with shared shell chrome through a simpler campaign ledger, staged sending actions, and one authoritative create action per collection.
- 5b75161: Add optional task and project start dates with date-range validation, introduce an accessible BrightWeb selector with a fully styled popup across all package UI dropdowns, and organize task, CRM contact, CRM organization, and project creation sheets into consistent semantic sections.
- Updated dependencies [5b75161]
- Updated dependencies [5b75161]
  - @brightweblabs/app-shell@0.11.3
  - @brightweblabs/ui@1.4.7
  - @brightweblabs/core-auth@0.10.3

## 0.4.2

### Patch Changes

- Updated dependencies [29ae3b0]
  - @brightweblabs/ui@1.4.6
  - @brightweblabs/app-shell@0.11.2
  - @brightweblabs/core-auth@0.10.2

## 0.4.1

### Patch Changes

- 05e0902: Standardize platform actions on the flat Projects button treatment and migrate shell and module toolbars to the shared Button primitive.
- 05e0902: Add semantic KPI and structured-data typography roles, then align headings,
  labels, metadata, controls, and numeric values with their intended shared roles.
- Updated dependencies [05e0902]
- Updated dependencies [05e0902]
  - @brightweblabs/ui@1.4.5
  - @brightweblabs/app-shell@0.11.1
  - @brightweblabs/core-auth@0.10.1

## 0.4.0

### Minor Changes

- 9518642: Add lifecycle-safe deletion UI and APIs for projects, organizations, CRM records, marketing resources, recipients, invitations, and per-user notification dismissal. Generated applications now include the required routes, permission wiring, and database migration.

### Patch Changes

- Updated dependencies [9518642]
  - @brightweblabs/app-shell@0.11.0
  - @brightweblabs/core-auth@0.10.0

## 0.3.3

### Patch Changes

- Updated dependencies [360f518]
  - @brightweblabs/app-shell@0.10.3
  - @brightweblabs/ui@1.4.4
  - @brightweblabs/core-auth@0.9.5

## 0.3.2

### Patch Changes

- Updated dependencies [9547657]
  - @brightweblabs/ui@1.4.3
  - @brightweblabs/app-shell@0.10.2
  - @brightweblabs/core-auth@0.9.4

## 0.3.1

### Patch Changes

- Updated dependencies
  - @brightweblabs/ui@1.4.2
  - @brightweblabs/app-shell@0.10.1
  - @brightweblabs/core-auth@0.9.3

## 0.3.0

### Minor Changes

- 2312a99: Add staff-facing consent-topic creation, editing, activation, and ordering with scaffolded API routes. Aggregate project task counters in a security-invoker database view and use a planned count for the unfiltered task-dashboard total to keep portfolio and dashboard reads scalable.
- Standardize faster cancellable, observable latest-request behavior across collection surfaces; add authoritative CRM organization and joined timeline search plus aggregate dashboard metrics; add paginated Marketing search, filters, create actions, toolbar registration, and lazy analytics loading; preserve useful rows while requests refresh; and scaffold database indexes for contains-search and common filters.

### Patch Changes

- Keep campaign recipients, workflow runs, and segment previews in explicit loading or unavailable states until their requests resolve, instead of flashing final empty states.
- Updated dependencies
  - @brightweblabs/infra@0.7.0
  - @brightweblabs/app-shell@0.10.0
  - @brightweblabs/core-auth@0.9.2

## 0.2.15

### Patch Changes

- Updated dependencies
- Updated dependencies [f12ce99]
  - @brightweblabs/infra@0.6.0
  - @brightweblabs/ui@1.4.1
  - @brightweblabs/app-shell@0.9.3
  - @brightweblabs/core-auth@0.9.1

## 0.2.14

### Patch Changes

- Updated dependencies [6bba363]
  - @brightweblabs/app-shell@0.9.2

## 0.2.13

### Patch Changes

- Updated dependencies
  - @brightweblabs/app-shell@0.9.1

## 0.2.12

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

## 0.2.10

### Patch Changes

- c05dc17: Migrate package-owned interface typography to the canonical visual-role utilities while preserving contextual auth, report, dashboard, and compact-control sizing.
- 90c9bf0: Converge theme state on one BrightWeb provider, default new apps to the system theme, improve packaged auth geometry and accessibility, make pnpm plus keepalive setup reproducible in generated apps, and bound Marketing audience processing.
- cc1af39: Process persisted Resend events and all derived recipient, suppression, and subscription mutations in one retry-safe database transaction.
- Updated dependencies [c05dc17]
- Updated dependencies [90c9bf0]
- Updated dependencies [abe0722]
- Updated dependencies [a03392d]
  - @brightweblabs/app-shell@0.8.0
  - @brightweblabs/core-auth@0.7.3
  - @brightweblabs/ui@1.2.0

## 0.2.9

### Patch Changes

- Updated dependencies [5c4cd96]
  - @brightweblabs/app-shell@0.7.4

## 0.2.8

### Patch Changes

- Updated dependencies [a3cc06d]
  - @brightweblabs/app-shell@0.7.3

## 0.2.7

### Patch Changes

- Updated dependencies [c8070f6]
  - @brightweblabs/app-shell@0.7.2
  - @brightweblabs/core-auth@0.7.2

## 0.2.6

### Patch Changes

- Updated dependencies [e02eaad]
  - @brightweblabs/core-auth@0.7.1
  - @brightweblabs/app-shell@0.7.1

## 0.2.5

### Patch Changes

- 29774b0: Read marketing data with the service role instead of the caller's session.

  `MarketingPage` gated on `requireServerPageRoleAccess(["staff", "admin"])` and
  then reused that request-scoped client for every read. All marketing tables are
  service-role-only — RLS grants no policy to `authenticated` — so:

  - campaigns, topics, workflows and analytics silently returned **empty**, and
  - `marketing_segments`, which additionally revokes the table grant from
    `authenticated`, threw `permission denied for table marketing_segments`.

  The page therefore returned a 500, and would have rendered blank even if
  segments had not been revoked. Found on a live deployment, where `/marketing`
  failed with that digest while every other surface worked.

  The role gate still runs against the caller's session; only the data reads use
  `createServiceRoleClient()`. Apps without `SUPABASE_SECRET_DEFAULT_KEY` now get
  an explicit error naming the missing variable rather than an empty page.

- Updated dependencies [44a415e]
  - @brightweblabs/app-shell@0.7.0

## 0.2.4

### Patch Changes

- Updated dependencies [10ae6b6]
  - @brightweblabs/infra@0.4.0
  - @brightweblabs/core-auth@0.7.0
  - @brightweblabs/ui@1.1.1
  - @brightweblabs/app-shell@0.6.2

## 0.2.3

### Patch Changes

- Updated dependencies [032215e]
  - @brightweblabs/core-auth@0.6.1

## 0.2.2

### Patch Changes

- Updated dependencies [41fa7ee]
  - @brightweblabs/core-auth@0.6.0

## 0.2.1

### Patch Changes

- 89b5a6e: Style the marketing workspaces and align the UI client, HTTP handlers, and localized interface contract.
- b9575c3: Fix campaign and workflow consent enforcement, delivery recovery, activity triggers, and the CRM event manifest declaration.
- Updated dependencies [ba77169]
- Updated dependencies [7eafa76]
  - @brightweblabs/app-shell@0.6.1
  - @brightweblabs/core-auth@0.5.1
  - @brightweblabs/infra@0.3.3

## 0.2.0

### Minor Changes

- a4e9cf7: Add consent-aware marketing workflow automation, activity triggers, worker processing, and staff REST endpoints.
- 43acafa: Add the consent-aware campaign sending backbone, including campaign persistence,
  recipient expansion, an injectable email worker, Resend delivery, verified
  webhooks, and staff-gated API handlers.
- 401b93e: Introduce the consent-first Marketing module with topic subscriptions, stable unsubscribe tokens, suppression checks, and public token-gated unsubscribe handlers.
- dbc9a46: Add saved marketing audience segments, staff APIs, live previews, and consent-safe campaign targeting.
- 794b281: Add the staff-facing Marketing campaign workspace UI: an injectable UI client,
  pt-PT dictionary, the campaign list and editor (topic picker, body with a
  personalization token picker, and send/schedule/cancel/retry/test controls with
  a recipient-status panel), a topics endpoint, and shell nav registration.
- 6e2948c: Add the staff-facing workflow workspace with trigger configuration, a linear ordered step editor, activation controls, and recent run visibility.
- cce8a81: Add staff-only marketing analytics with unique-recipient engagement rates and campaign queue breakdowns.

### Patch Changes

- Updated dependencies [22e50aa]
- Updated dependencies [41714ca]
  - @brightweblabs/core-auth@0.5.0
