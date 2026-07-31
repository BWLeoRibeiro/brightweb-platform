# @brightweblabs/theme

## 0.7.1

### Patch Changes

- 8573a3f: Pair brand button surfaces with a dedicated foreground token so client accent palettes retain readable action labels.

## 0.7.0

### Minor Changes

- 3d52715: Redesign the shared invitation and recovery journeys for a more structured professional-services portal experience.

  Add reusable, localizable password-strength APIs; responsive auth layouts and state primitives; distinct invitation loading, success, invalid, expired, accepted, revoked, and acceptance-error states; and invalid recovery-link handling.

  Add kind-aware authenticated invitation acceptance, including admin-role invitations, and scaffold the required dependency for new BrightWeb applications.

  Improve admin invitation creation and management with visible form guidance, inline delivery feedback, retryable loading errors, responsive mobile cards, expiry cues, and confirmed revocation.

  Upgrade the default admin invitation email with a robust responsive layout, role context, expiry information, and a plain-text fallback.

## 0.5.1

### Patch Changes

- 1ecd0c1: Add canonical visual-role typography utilities while retaining the existing typography systems as compatibility aliases.

## 0.5.0

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

## 0.4.0

### Minor Changes

- b0362c3: Ship the consolidated platform surface release: shell navigation, dashboard,
  theme switching, branded status pages, packaged authentication and invitation
  flows, Admin, CRM, Projects, and organization persistence. Add tokenized Geist
  typography, shared UI primitives, MQ parity, and accessibility and robustness
  hardening across those surfaces.

## 0.3.0

### Minor Changes

- 1a86493: Add the MQ-parity shell frame, sidebar rail, account menu, fully tokenized shell and CRM visual contract, typography aliases, systemic border color, and table pagination styling used by the CRM dashboard. Guard package components against raw color recipes.

## 0.2.1

### Patch Changes

- 799817d: Verify OIDC trusted publishing for packages first published manually. No code changes.

## 0.2.0

### Minor Changes

- b59df44: Introduce the BrightWeb UI foundation with neutral brand tokens, Tailwind mappings, typography, layered resets, structural surfaces, tint helpers, and MQ compatibility overrides.

### Patch Changes

- f8b2157: Remove the CRM package's unused theme build dependency, trim unused theme CSS subpath exports while preserving the app-level CSS runtime contract, and retire the redundant CRM playground alias from new app scaffolds.
