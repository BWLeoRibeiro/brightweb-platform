# create-bw-app

## 0.22.2

### Patch Changes

- 2312a99: Add staff-facing consent-topic creation, editing, activation, and ordering with scaffolded API routes. Aggregate project task counters in a security-invoker database view and use a planned count for the unfiltered task-dashboard total to keep portfolio and dashboard reads scalable.

## 0.22.1

### Patch Changes

- Drop and recreate the notification-items function when upgrading its table return shape so generated database migrations apply cleanly.

## 0.22.0

### Minor Changes

- a9508ef: Add the shared activity-notification inbox, authenticated notification handlers,
  and default shell bell wiring for scaffolded platform applications.
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

## 0.20.0

### Minor Changes

- abe0722: Scaffolded apps now render only the selected modules' toolbar controls plus the notifications AlertsMenu in the shell header, matching the platform preview without importing uninstalled modules. Module add, remove, and update operations keep that generated toolbar wiring synchronized. BREAKING for the CLI: `bw admin create --force` has been removed — the bootstrap RPC is replaced with a two-argument signature that always refuses once an administrator exists; add further administrators through the in-app role controls.

### Patch Changes

- 90c9bf0: Converge theme state on one BrightWeb provider, default new apps to the system theme, improve packaged auth geometry and accessibility, make pnpm plus keepalive setup reproducible in generated apps, and bound Marketing audience processing.
- c2bd394: Keep scaffold hashes synchronized after adding or removing modules so a subsequent doctor run sees the generated app as healthy.
- cc1af39: Process persisted Resend events and all derived recipient, suppression, and subscription mutations in one retry-safe database transaction.
- ed96652: Reject unsafe manifest-controlled filesystem paths before add, remove, update, scaffold, diff, doctor, or upgrade operations can access files.

## 0.19.0

### Minor Changes

- 1830b1e: Add the first-administrator bootstrap command, transactional profile and role setup, Supabase-aware Vercel region scaffolding, and deployed function-region diagnostics.

## 0.18.6

### Patch Changes

- 3364b17: Give aggregate Projects and Tasks dashboard handlers context-free route signatures, and typecheck an all-modules generated Platform fixture in the scaffold contract gate.

## 0.18.5

### Patch Changes

- 5c4cd96: Wire scaffolded dashboards to authenticated module-owned Projects, CRM, and Tasks data producers, preserve independent section failures, and enforce registration-to-endpoint parity in tests.

## 0.18.4

### Patch Changes

- a3cc06d: Render registered primary toolbar actions even when no title is supplied, wire scaffolded shell action dispatch and active navigation titles, add the missing admin invitation routes, and guard template/preview shell prop parity.

## 0.18.3

### Patch Changes

- c8070f6: Expose the configured admin destination in the mobile shell, return a real 404
  from legacy invite-only signup mounts, and stop scaffolding the unavailable
  signup route in new invite-only apps.

## 0.18.2

### Patch Changes

- 965edd4: Make Projects page navigation serializable across React Server/Client boundaries and update generated Projects routes to pass URL patterns.

  Direct `ProjectsPage`, `ProjectDetailPage`, and `ProjectTasksPage` consumers must rename the `detailHref`, `boardHref`, and optional `organizationHref` navigation callbacks to `detailHrefPattern`, `boardHrefPattern`, and optional `organizationHrefPattern` strings.

## 0.18.1

### Patch Changes

- e02eaad: Handle expired recovery errors and implicit recovery sessions from Supabase URL fragments before allowing password updates.

  Render every resolved module navigation group in the mobile navigation and wire generated and preview apps to provide them. `MobileNav` callers must now pass the resolved groups through the new required `navGroups` prop.

## 0.18.0

### Minor Changes

- 44a415e: Render every module-provided navigation group in the desktop sidebar, in registration order. Modules that own their own group, including Marketing, now appear in scaffolded apps instead of only the hardcoded CRM group being reachable.

  The `DesktopSidebar` direct-call API is updated from CRM-specific props to `navGroups`, `isNavGroupExpanded`, `isNavGroupActive`, and `onToggleNavGroup`.

## 0.17.0

### Minor Changes

- b4d4d96: Scaffold Portuguese project routes by default.

  Portuguese is the ratified default locale and `module-projects` already
  defaults to `/projetos`, but the template emitted the English preview variant:
  `/projects/[id]/{board,tasks}` wired to `projectsPreviewModuleRegistration`.
  Any pt-PT client had to rename the routes and swap the registration by hand —
  in `config/shell.ts` and `config/modules.ts`, both of which
  `create-bw-app update` regenerates, so the customization was lost on update.

  Routes are now `/projetos/[projectId]/{quadro,tarefas}` with
  `projectsModuleRegistration`, matching the package default and the toolbar
  route matchers it already ships (which look for `/tarefas` and `/quadro`).

  BREAKING for existing scaffolded apps: an app on the old English routes should
  either keep them — `createProjectsModuleRegistration("/projects")` still
  accepts a custom base href — or rename its route folders to match. Nothing in
  the packages changed; this only affects newly scaffolded apps.

## 0.16.0

### Minor Changes

- 26fde70: Move shell brand marks into `config/brand.ts` so rebranding survives updates.

  The logo paths, home href and aria-label were generated into `config/shell.ts`,
  which `create-bw-app update` regenerates — so any app that swapped in client
  artwork had it reverted to the scaffold defaults on the next update. They now
  live in `config/brand.ts` as `starterShellBrand`, which is written once at
  scaffold time and never regenerated, and `shell.ts` just references it.

  This is the same class of problem as `additionalShellModules`: a file the CLI
  owns was the only place to put app-owned values.

  The Ferramentas section's `collapsedHref` now also prefers the first
  app-owned nav entry before falling back to the first module route, so an app
  with its own tools surface gets a sensible collapsed target.

## 0.15.0

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

## 0.14.1

### Patch Changes

- 41fa7ee: Add organization and invitation mounts to generated platform apps and make magic-link login an explicit opt-in.

## 0.14.0

### Minor Changes

- 0dd5212: Bring platform scaffolds to full package parity with an authenticated shell, auth/account/dashboard mounts, complete Projects routes, selectable Marketing, module-resolved database stacks, caret runtime ranges, and duplicate-runtime doctor checks.

## 0.13.3

### Patch Changes

- ba77169: Normalize Next.js as a library peer dependency, add the marketing scaffold manifest, and keep the core scaffold migration set aligned.

## 0.13.2

### Patch Changes

- b0362c3: Fix static public Supabase environment inlining and align generated application
  templates with the platform CSS, font, React, Geist, migration, and runtime
  dependency contracts.

## 0.13.1

### Patch Changes

- e4afe0e: Port the complete CRM dashboard and operational report into the module package, with Portuguese dictionary defaults, reusable organization and timeline browsers, bulk actions, report data helpers, and thin starter routes for `/crm` and `/crm/report`.

## 0.13.0

### Minor Changes

- a461564: Keep generated apps thin by removing demo pages, local feature components, and helper libraries; mount CRM and Admin package surfaces directly, expose the package-owned `AdminUsersPage`, and omit a Projects route until the package ships default UI.

### Patch Changes

- 046192f: Generate module-aware Tailwind source directives and use the shared BrightWeb theme tokens in platform starters.

## 0.12.0

### Minor Changes

- 9cf3d8d: Add per-file scaffold intent, the `bw scaffold` command, and intent-aware doctor, adoption, upgrade, and removal behavior.

## 0.11.0

### Minor Changes

- df5a3bd: Add `bw adopt`, `bw diff`, and `bw remove` for safely bringing legacy apps under the manifest contract, inspecting scaffold drift, and removing module package wiring without touching migration history.
- 31d7611: Add the complete CRM contact write path, SQL-backed single and bulk funnel status transitions, staff-only HTTP handlers, the status-changed event contract, and scaffolded POST/PATCH routes.
- 2bb53ad: Ship the package-owned default CRM dashboard, focused CRM UI surfaces, domain tokens, route-backed client, and a ready-to-render `/crm` scaffold route.
- e7a7b89: Extract organizations, membership, invitations, and shared helpers into the organizations foundation module. Preserve the CRM organization-list alias and make CRM and Projects auto-resolve Organizations without forcing Projects to install CRM.
- 798e75f: Generate managed shell wiring with a preserved `config/shell.overrides.ts` customization seam.
- 2bd1d84: Add the `bw` app lifecycle CLI, machine-readable app manifests, module installation, migration-aware upgrades, and app health checks.

### Patch Changes

- 741ffec: Align generated app dependency defaults with the current BrightWeb compatibility set.
- 2191b72: Replace the legacy green starter mark in generated platform brand assets with a BrightWeb-owned BW mark.
- 3c0d84b: Keep database ordering implementations in sync, load core compatibility from the shared catalog, include the shell override in agent context, and load CRM tokens in the playground route.
- f8b2157: Remove the CRM package's unused theme build dependency, trim unused theme CSS subpath exports while preserving the app-level CSS runtime contract, and retire the redundant CRM playground alias from new app scaffolds.
- 090bc48: Update generated app dependency defaults so scaffolded platform and site apps install the Lucide 1.x peer required by `@brightweblabs/ui` 1.0.

## 0.10.1

### Patch Changes

- fd505a0: Improve portal read performance by using planned display counts for CRM and project dashboards/lists, replacing CRM status row aggregation with head-only count queries, and adding read-path indexes to CRM and Projects module migrations.

## 0.10.0

### Minor Changes

- 7a2c7b2: Promote `@brightweblabs/infra/server` as the canonical app-owned Resend transport by adding stable webhook signature verification and retaining typed Resend errors.

  Update `create-bw-app` platform scaffolds to:

  - generate expanded Resend/marketing environment keys
  - include a local `lib/email/resend-base.ts` adapter that re-exports from `@brightweblabs/infra/server`
  - scope Resend readiness checks to admin-enabled stacks and require sender/webhook coverage instead of only `RESEND_API_KEY`

## 0.9.9

### Patch Changes

- 097992c: Align the published BrightWeb package line for platform scaffolds and move Supabase env validation to lazy runtime factories in infra.

## 0.9.8

### Patch Changes

- Refresh the published BrightWeb package defaults so newly scaffolded platform apps start from the current `core-auth`, `infra`, and `module-projects` release line instead of stale fallback versions.

## 0.9.7

### Patch Changes

- d847928: Ship the selected platform Supabase migration baseline in published `create-bw-app` scaffolds, including the module registry, generated client stack metadata, the modular shared SQL sources, and a Supabase CLI-ready `supabase/migrations` output.

## 0.9.6

### Patch Changes

- e319fc0: Ship the selected platform Supabase migration baseline in published `create-bw-app` scaffolds, including the module registry, resolved shared SQL migrations, and generated client stack metadata.

## 0.9.5

### Patch Changes

- b6cb74a: Resolve published `@brightweblabs/*` update targets from npm at update time.

  `create-bw-app update` now looks up installed BrightWeb package versions from the npm registry when it runs in published mode, instead of relying only on the CLI's baked-in version map. Published updates now fail fast when registry resolution fails, with an explicit `--allow-stale-fallback` escape hatch for intentionally using the baked-in fallback versions.

## 0.9.4

### Patch Changes

- 0d9aa83: Improve the platform starter structure and CRM route scaffolding.

  `create-bw-app` now scaffolds a top-level `components/` folder for app-owned starter UI, updates the generated AI handoff docs and app context to point agents at that layer, and moves the preview and auth playground components out of route folders.

  The CRM starter routes also now share a reusable lazy-loaded module route handler helper instead of repeating the same dynamic import wrapper in each route file.

## 0.9.3

### Patch Changes

- de3f14a: Align published Brightweb dependency defaults with the current package versions so newly scaffolded platform apps do not install stale package releases that are missing supported subpath exports such as `@brightweblabs/core-auth/shared`.

## 0.9.2

### Patch Changes

- aeba8d3: Add AI handoff files to generated apps, including `AGENTS.md`, `docs/ai/README.md`, `docs/ai/examples.md`, and `docs/ai/app-context.json`.

  Platform and site starters now get different `app-context.json` shapes so agents receive template-specific guidance instead of one generic schema. The updater also keeps the generated app context file in sync for existing apps.

## 0.9.1

### Patch Changes

- 5a4d6bf: Add a `create-bw-app update` subcommand that updates installed `@brightweblabs/*` packages in an existing app, re-syncs managed BrightWeb config files, reports starter-file drift, and optionally refreshes starter routes or runs install.

## 0.9.0

### Minor Changes

- 2adbe49: Expand the CRM package from a starter dashboard helper into a broader stable base contract with reusable CRM list and stats helpers, package-owned GET handlers, mounted CRM starter routes, structured base-contract manifests, and updated docs for the new supported CRM surfaces.

### Patch Changes

- d1fe3af: Generate `.env.local` for platform starters instead of `.env.example`, move generated brand and module state into `config/brand.ts` and `config/modules.ts`, and update the scaffold docs to match the new config ownership model.

## 0.8.0

### Minor Changes

- 7527b84: Stop generating `.env.local` in platform app scaffolds and keep `.env.example` as the single generated environment template. Update the generated starter copy and docs to instruct developers to copy `.env.example` to `.env.local` when they need local credentials or overrides.
- 7527b84: Refresh the Brightweb database scaffold to use a clean v1 module baseline instead of carrying legacy transitional migration history. Remove BeGreen-specific database references from the generated platform surfaces and align the repo docs with Brightweb-owned forward migration history.

## 0.7.0

### Minor Changes

- a94eabd: Updated to generate proper DB schema/migrations in the proper folders.

## 0.6.0

### Minor Changes

- 4053ddd: Refresh the generated starters to the current Next.js baseline, align starter design tokens across the site and platform templates, and add Tailwind CSS support to the platform starter.

## 0.5.0

### Minor Changes

- 6923aeb: Update latest Next release.

## 0.4.0

### Minor Changes

- dd6fddd: Refactor package boundaries across the workspace and align the preview sandbox setup.

  - add explicit `@brightweblabs/core-auth/shared` exports and remove the root `core-auth` barrel in favor of canonical `shared`, `client`, and `server` entrypoints
  - add UI subpath exports and update first-party consumers to import directly from those package entrypoints
  - simplify app-shell navigation primitives and refresh the platform preview sandbox copy to reflect its internal sandbox role
  - update `create-bw-app` templates and generator metadata to match the new preview app and package import surfaces

## 0.3.0

### Minor Changes

- 27d13af: Rename the public CLI package from `create-brightweblabs` to `create-bw-app` and update the executable, docs, and local wrapper references.

## 0.2.0

### Minor Changes

- 18dc438: Add the publishable `create-bw-app` CLI package for scaffolding new BrightWeb client apps.
