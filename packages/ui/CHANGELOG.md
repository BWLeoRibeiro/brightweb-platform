# @brightweblabs/ui

## 1.4.11

### Patch Changes

- 1de7902: Remove the remaining presentational uppercase and expanded letter spacing from shared project references, attention ranks, menu shortcuts, and avatars. Structured values keep their source casing without CSS forcing it.

## 1.4.10

### Patch Changes

- Updated dependencies [ef36f3d]
  - @brightweblabs/theme@0.8.0

## 1.4.9

### Patch Changes

- db5a6ab: Render phone country calling codes as fixed, non-selectable prefixes so users can only edit the subscriber number, while preserving full E.164 values for controlled and native form submissions.

## 1.4.8

### Patch Changes

- fa591ab: Allow dropdown calendars to navigate up to 25 years beyond the current year by default while preserving consumer-provided date boundaries.

## 1.4.7

### Patch Changes

- 5b75161: Add optional task and project start dates with date-range validation, introduce an accessible BrightWeb selector with a fully styled popup across all package UI dropdowns, and organize task, CRM contact, CRM organization, and project creation sheets into consistent semantic sections.

## 1.4.6

### Patch Changes

- 29ae3b0: Preserve semantic button foregrounds when canonical typography classes are merged, pair brand button fills with a dedicated brand foreground token, and migrate the project danger zone from hardcoded Rose colors to shared semantic danger tokens.
- Updated dependencies [29ae3b0]
  - @brightweblabs/theme@0.7.4

## 1.4.5

### Patch Changes

- 05e0902: Standardize platform actions on the flat Projects button treatment and migrate shell and module toolbars to the shared Button primitive.
- 05e0902: Add semantic KPI and structured-data typography roles, then align headings,
  labels, metadata, controls, and numeric values with their intended shared roles.
- Updated dependencies [05e0902]
  - @brightweblabs/theme@0.7.3

## 1.4.4

### Patch Changes

- Updated dependencies [360f518]
  - @brightweblabs/theme@0.7.2

## 1.4.3

### Patch Changes

- 9547657: Show the pointer cursor consistently for enabled shared buttons and module toolbar controls.

## 1.4.2

### Patch Changes

- Keep the branded button foreground token from being removed when consumers add toolbar typography utilities.

## 1.4.1

### Patch Changes

- f12ce99: Pair brand button surfaces with a dedicated foreground token so client accent palettes retain readable action labels.
- Updated dependencies [f12ce99]
  - @brightweblabs/theme@0.7.1

## 1.4.0

### Minor Changes

- 3d52715: Redesign the shared invitation and recovery journeys for a more structured professional-services portal experience.

  Add reusable, localizable password-strength APIs; responsive auth layouts and state primitives; distinct invitation loading, success, invalid, expired, accepted, revoked, and acceptance-error states; and invalid recovery-link handling.

  Add kind-aware authenticated invitation acceptance, including admin-role invitations, and scaffold the required dependency for new BrightWeb applications.

  Improve admin invitation creation and management with visible form guidance, inline delivery feedback, retryable loading errors, responsive mobile cards, expiry cues, and confirmed revocation.

  Upgrade the default admin invitation email with a robust responsive layout, role context, expiry information, and a plain-text fallback.

### Patch Changes

- Updated dependencies [3d52715]
  - @brightweblabs/theme@0.7.0

## 1.2.0

### Minor Changes

- 90c9bf0: Converge theme state on one BrightWeb provider, default new apps to the system theme, improve packaged auth geometry and accessibility, make pnpm plus keepalive setup reproducible in generated apps, and bound Marketing audience processing.

### Patch Changes

- c05dc17: Migrate package-owned interface typography to the canonical visual-role utilities while preserving contextual auth, report, dashboard, and compact-control sizing.
- Updated dependencies [1ecd0c1]
  - @brightweblabs/theme@0.5.1

## 1.1.1

### Patch Changes

- Updated dependencies [10ae6b6]
  - @brightweblabs/theme@0.5.0

## 1.1.0

### Minor Changes

- b0362c3: Ship the consolidated platform surface release: shell navigation, dashboard,
  theme switching, branded status pages, packaged authentication and invitation
  flows, Admin, CRM, Projects, and organization persistence. Add tokenized Geist
  typography, shared UI primitives, MQ parity, and accessibility and robustness
  hardening across those surfaces.

### Patch Changes

- Updated dependencies [b0362c3]
  - @brightweblabs/theme@0.4.0

## 1.0.2

### Patch Changes

- 1a86493: Add the MQ-parity shell frame, sidebar rail, account menu, fully tokenized shell and CRM visual contract, typography aliases, systemic border color, and table pagination styling used by the CRM dashboard. Guard package components against raw color recipes.
- Updated dependencies [1a86493]
  - @brightweblabs/theme@0.3.0

## 1.0.1

### Patch Changes

- Updated dependencies [799817d]
  - @brightweblabs/theme@0.2.1

## 1.0.0

### Major Changes

- 090bc48: Declare the merged BrightWeb UI system stable at 1.0.0. This breaking release moves React, React DOM, Next.js, and Lucide to peer dependencies, removes `next-themes` in favor of the package-owned `ThemeProvider`, and renames the MQ-specific `marketing` and `marketingLink` button variants to token-driven `accent` and `accentLink` variants. It also adds the merged avatar, search, skeleton, phone, password, sheet, tooltip, badge, card, table, and related component improvements and subpath exports.

### Minor Changes

- 80b69b1: Add domain-neutral Tier-2 application patterns for section headings, actions, table pagination, surface cards, stats, status pills, KPI breakdowns, empty states, initials avatars, and role badges.

### Patch Changes

- 2bb53ad: Ship the package-owned default CRM dashboard, focused CRM UI surfaces, domain tokens, route-backed client, and a ready-to-render `/crm` scaffold route.
- Updated dependencies [b59df44]
- Updated dependencies [f8b2157]
  - @brightweblabs/theme@0.2.0

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

## 0.3.1

### Patch Changes

- Fix PasswordInput visibility toggle positioning inside the input.

## 0.3.0

### Minor Changes

- 6923aeb: Update latest Next release.

## 0.2.0

### Minor Changes

- dd6fddd: Refactor package boundaries across the workspace and align the preview sandbox setup.

  - add explicit `@brightweblabs/core-auth/shared` exports and remove the root `core-auth` barrel in favor of canonical `shared`, `client`, and `server` entrypoints
  - add UI subpath exports and update first-party consumers to import directly from those package entrypoints
  - simplify app-shell navigation primitives and refresh the platform preview sandbox copy to reflect its internal sandbox role
  - update `create-bw-app` templates and generator metadata to match the new preview app and package import surfaces

## 0.1.1

### Patch Changes

- ec7ca19: Minor changes to all modules.

## 0.1.0

### Minor Changes

- Initial public release of the BrightWeb Labs platform packages.
