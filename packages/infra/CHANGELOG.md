# @brightweblabs/infra

## 0.5.0

### Minor Changes

- Add an authenticated Supabase Realtime activity stream with MQ-compatible notification and refresh coverage across the notification inbox, CRM, Admin, Dashboard, Projects portfolio/detail/board/account views, and project activity.

  Publish `app_activity_events` with domain-aware RLS, retain removed/deleted project audiences without broadening the canonical project ACL, and emit missing Admin role-change events so every supported mutation invalidates the matching live surfaces.

### Patch Changes

- 14c7881: Keep password-recovery code exchange authoritative in the reset page by disabling Supabase's competing automatic browser exchange, preventing false expired-link messages without accepting unrelated signed-in sessions.

## 0.4.0

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

## 0.3.3

### Patch Changes

- ba77169: Normalize Next.js as a library peer dependency, add the marketing scaffold manifest, and keep the core scaffold migration set aligned.

## 0.3.2

### Patch Changes

- b0362c3: Fix static public Supabase environment inlining and align generated application
  templates with the platform CSS, font, React, Geist, migration, and runtime
  dependency contracts.

## 0.3.1

### Patch Changes

- 3c0d84b: Align Supabase SSR and the shared Supabase client dependency across infrastructure, auth, and domain packages to avoid duplicate cookie implementations and incompatible client types.

## 0.3.0

### Minor Changes

- 7a2c7b2: Promote `@brightweblabs/infra/server` as the canonical app-owned Resend transport by adding stable webhook signature verification and retaining typed Resend errors.

  Update `create-bw-app` platform scaffolds to:

  - generate expanded Resend/marketing environment keys
  - include a local `lib/email/resend-base.ts` adapter that re-exports from `@brightweblabs/infra/server`
  - scope Resend readiness checks to admin-enabled stacks and require sender/webhook coverage instead of only `RESEND_API_KEY`

## 0.2.2

### Patch Changes

- 097992c: Align the published BrightWeb package line for platform scaffolds and move Supabase env validation to lazy runtime factories in infra.

## 0.2.1

### Patch Changes

- Move Supabase env resolution and validation into the client factory functions so published apps do not fail during import-time module evaluation. Keep temporary fallback support for `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` while the package graph converges on the current env names.

## 0.2.0

### Minor Changes

- 6923aeb: Update latest Next release.

## 0.1.1

### Patch Changes

- ec7ca19: Minor changes to all modules.

## 0.1.0

### Minor Changes

- Initial public release of the BrightWeb Labs platform packages.
