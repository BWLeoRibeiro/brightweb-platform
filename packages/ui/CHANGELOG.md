# @brightweblabs/ui

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
