# @brightweblabs/core-auth

## 0.11.0

### Minor Changes

- 456e836: Add atomic project setup with participating organizations, internal teams, and explicit organization or selected-client access; introduce narrow client-safe project APIs, client-facing content fields, paused lifecycle support, client-visible metas, and staff-only internal project boundaries. Client-visible metas are now the single source of truth for current and upcoming work, with bounded previews shipped at the non-destructive compatibility boundary before the separate free-text client-next-steps field is removed. Role changes now surface project reassignment requirements cleanly. Add module-scoped migration cutoffs and hold marked destructive migrations during ordinary `bw upgrade`; cleanup now requires the explicit `--include-destructive-migrations` opt-in after the fail-closed enforcement boundary is deployed.

### Patch Changes

- a8c1e01: Share the branded light cover-header composition across client account and project surfaces.
- 88aa2b8: Give client account profiles a light cover-card identity treatment using shared avatar and status primitives.
- Updated dependencies [456e836]
- Updated dependencies [a8c1e01]
  - @brightweblabs/ui@1.5.4

## 0.10.11

### Patch Changes

- 7e53c23: Use authentication-specific recipient and closing copy in all generated authentication and security email templates while preserving invitation wording for invitation emails.
- Updated dependencies [7e53c23]
  - @brightweblabs/ui@1.5.3

## 0.10.10

### Patch Changes

- 9063aaa: Add client invitations tied to organizations, a CRM organization access page, invitation history, safe organization member role/removal operations, and shared branded invitation and authentication email designs. New CRM starters mount the organization detail route and organization member API handlers.
- Updated dependencies [9063aaa]
  - @brightweblabs/ui@1.5.2

## 0.10.9

### Patch Changes

- @brightweblabs/ui@1.5.1

## 0.10.8

### Patch Changes

- cc7d41c: Standardize application surfaces on a single polymorphic Card recipe with explicit visual, density, and motion variants. Migrate dashboard and module cards to the shared foundation, preserve native link behavior for interactive project cards, and make dashboard project-card styling independent of route-level stylesheet loading.
- Updated dependencies [cc7d41c]
  - @brightweblabs/ui@1.5.0

## 0.10.7

### Patch Changes

- Updated dependencies [1de7902]
  - @brightweblabs/ui@1.4.11

## 0.10.6

### Patch Changes

- ef36f3d: Replace the oversized, uppercase, widely tracked label treatment with compact sentence-case typography across shared portal surfaces. Keep monospace and uppercase styling only for structured data such as project codes and initials.
  - @brightweblabs/ui@1.4.10

## 0.10.5

### Patch Changes

- Updated dependencies [db5a6ab]
  - @brightweblabs/ui@1.4.9

## 0.10.4

### Patch Changes

- Updated dependencies [fa591ab]
  - @brightweblabs/ui@1.4.8

## 0.10.3

### Patch Changes

- 5b75161: Add optional task and project start dates with date-range validation, introduce an accessible BrightWeb selector with a fully styled popup across all package UI dropdowns, and organize task, CRM contact, CRM organization, and project creation sheets into consistent semantic sections.
- Updated dependencies [5b75161]
  - @brightweblabs/ui@1.4.7

## 0.10.2

### Patch Changes

- Updated dependencies [29ae3b0]
  - @brightweblabs/ui@1.4.6

## 0.10.1

### Patch Changes

- 05e0902: Add semantic KPI and structured-data typography roles, then align headings,
  labels, metadata, controls, and numeric values with their intended shared roles.
- Updated dependencies [05e0902]
- Updated dependencies [05e0902]
  - @brightweblabs/ui@1.4.5

## 0.10.0

### Minor Changes

- 9518642: Add lifecycle-safe deletion UI and APIs for projects, organizations, CRM records, marketing resources, recipients, invitations, and per-user notification dismissal. Generated applications now include the required routes, permission wiring, and database migration.

## 0.9.5

### Patch Changes

- @brightweblabs/ui@1.4.4

## 0.9.4

### Patch Changes

- Updated dependencies [9547657]
  - @brightweblabs/ui@1.4.3

## 0.9.3

### Patch Changes

- Updated dependencies
  - @brightweblabs/ui@1.4.2

## 0.9.2

### Patch Changes

- Updated dependencies
  - @brightweblabs/infra@0.7.0

## 0.9.1

### Patch Changes

- Updated dependencies
- Updated dependencies [f12ce99]
  - @brightweblabs/infra@0.6.0
  - @brightweblabs/ui@1.4.1

## 0.9.0

### Minor Changes

- a9508ef: Add the shared activity-notification inbox, authenticated notification handlers,
  and default shell bell wiring for scaffolded platform applications.
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

- 14c7881: Keep password-recovery code exchange authoritative in the reset page by disabling Supabase's competing automatic browser exchange, preventing false expired-link messages without accepting unrelated signed-in sessions.
- a475672: Keep auth notice padding and corner geometry in the shared component stylesheet, route the remaining account-profile load error through the shared notice, and support rich notice content with valid markup so error and status messages render consistently in every BrightWeb portal.
- Updated dependencies [14c7881]
- Updated dependencies
- Updated dependencies [3d52715]
  - @brightweblabs/infra@0.5.0
  - @brightweblabs/ui@1.4.0

## 0.7.3

### Patch Changes

- c05dc17: Migrate package-owned interface typography to the canonical visual-role utilities while preserving contextual auth, report, dashboard, and compact-control sizing.
- 90c9bf0: Converge theme state on one BrightWeb provider, default new apps to the system theme, improve packaged auth geometry and accessibility, make pnpm plus keepalive setup reproducible in generated apps, and bound Marketing audience processing.
- Updated dependencies [c05dc17]
- Updated dependencies [90c9bf0]
  - @brightweblabs/ui@1.2.0

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
  - @brightweblabs/infra@0.4.0
  - @brightweblabs/ui@1.1.1

## 0.6.1

### Patch Changes

- 032215e: Load `tokens.css` from the auth UI surfaces that need it.

  `tokens.css` defines every `.auth-*` rule, but was imported only by
  `account-page.tsx`. Consuming apps therefore rendered login, signup,
  forgot-password, reset-password, invite, post-login and confirmed with no
  layout at all, unless a session happened to load `/account` first and leave the
  stylesheet in the page bundle. The generated `create-bw-app` scaffold does not
  import it either, so a freshly scaffolded app hit this on its very first screen.

  `auth-layout.tsx` now imports the stylesheet on behalf of the six pages that
  compose it, and `post-login-page.tsx` imports it directly because it uses
  `.auth-layout__brand-logo`, `.auth-post-login` and `.auth-spinner` without
  going through `AuthLayout`. A hygiene test asserts every core-auth component
  using an `.auth-*` class reaches `tokens.css` through its import graph.

## 0.6.0

### Minor Changes

- 41fa7ee: Add organization and invitation mounts to generated platform apps and make magic-link login an explicit opt-in.

## 0.5.1

### Patch Changes

- ba77169: Normalize Next.js as a library peer dependency, add the marketing scaffold manifest, and keep the core scaffold migration set aligned.
- 7eafa76: Harden account profile errors, validation, persistence checks, and project read authorization.
- Updated dependencies [ba77169]
  - @brightweblabs/infra@0.3.3

## 0.5.0

### Minor Changes

- 22e50aa: Add the account/profile surface, API handlers, injectable UI client, and profile persistence layer.
- 41714ca: Add project read access validation and an injectable projects slot on the account page.

## 0.4.0

### Minor Changes

- b0362c3: Ship the consolidated platform surface release: shell navigation, dashboard,
  theme switching, branded status pages, packaged authentication and invitation
  flows, Admin, CRM, Projects, and organization persistence. Add tokenized Geist
  typography, shared UI primitives, MQ parity, and accessibility and robustness
  hardening across those surfaces.

### Patch Changes

- Updated dependencies [b0362c3]
- Updated dependencies [b0362c3]
  - @brightweblabs/ui@1.1.0
  - @brightweblabs/infra@0.3.2

## 0.3.4

### Patch Changes

- 3c0d84b: Align Supabase SSR and the shared Supabase client dependency across infrastructure, auth, and domain packages to avoid duplicate cookie implementations and incompatible client types.
- Updated dependencies [3c0d84b]
  - @brightweblabs/infra@0.3.1

## 0.3.3

### Patch Changes

- Updated dependencies [7a2c7b2]
  - @brightweblabs/infra@0.3.0

## 0.3.2

### Patch Changes

- 097992c: Align the published BrightWeb package line for platform scaffolds and move Supabase env validation to lazy runtime factories in infra.
- Updated dependencies [097992c]
  - @brightweblabs/infra@0.2.2

## 0.3.1

### Patch Changes

- Updated dependencies
  - @brightweblabs/infra@0.2.1

## 0.3.0

### Minor Changes

- 6923aeb: Update latest Next release.

### Patch Changes

- Updated dependencies [6923aeb]
  - @brightweblabs/infra@0.2.0

## 0.2.0

### Minor Changes

- dd6fddd: Refactor package boundaries across the workspace and align the preview sandbox setup.

  - add explicit `@brightweblabs/core-auth/shared` exports and remove the root `core-auth` barrel in favor of canonical `shared`, `client`, and `server` entrypoints
  - add UI subpath exports and update first-party consumers to import directly from those package entrypoints
  - simplify app-shell navigation primitives and refresh the platform preview sandbox copy to reflect its internal sandbox role
  - update `create-bw-app` templates and generator metadata to match the new preview app and package import surfaces

## 0.1.2

### Patch Changes

- ec7ca19: Minor changes to all modules.
- Updated dependencies [ec7ca19]
  - @brightweblabs/infra@0.1.1

## 0.1.1

### Patch Changes

- a36ed3b: Replace internal workspace protocol dependencies with published version ranges.

## 0.1.0

### Minor Changes

- Initial public release of the BrightWeb Labs platform packages.

### Patch Changes

- Updated dependencies
  - @brightweblabs/infra@0.1.0
