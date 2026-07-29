# Plan 005: Canonicalize typography and page-layout roles

> **Drift check:** `git diff --stat 86a9d12..HEAD -- packages/theme packages/app-shell packages/module-admin packages/module-projects packages/module-crm tests apps/platform-preview`

## Status

- **Priority:** P2
- **Effort:** L
- **Risk:** HIGH
- **Depends on:** Plan 003
- **Category:** architecture / migration
- **Planned at:** commit `86a9d12`, 2026-07-29

## Why this matters

Four active type vocabularies and three hard-coded page widths mean a design
change still requires package-by-package editing. The safe migration is to name
semantic roles once, retain compatibility aliases, and move live/loading route
pairs together.

## Current state

- `theme/src/typography.css` defines `text-ui-*` and near-duplicate `portal-*`.
- `themes/mq-aliases.css` retains `heading-*`/`paragraph-*`.
- Projects adds TypeScript wrappers around portal classes.
- Live/loading pages independently use `1260px`, `1360px`, and `1480px`.

## Target contract

- `text-ui-*` is the canonical platform typography API.
- Color/tone is separate from type role.
- `portal-*` and MQ classes remain deprecated aliases for at least one release.
- Page widths use semantic roles (`detail`, `workspace`, `wide`) shared by
  live/loading states; names describe purpose, not pixel values.

## Steps

1. Write a role mapping table from every legacy class to canonical type role,
   noting any color/weight/line-height difference. Do not map by name alone.
2. Add canonical roles that reproduce current computed typography exactly.
   `portal-*` currently owns color while `text-ui-*` intentionally does not, so
   every mapping must carry an explicit tone class/token. Do not reduce or
   redesign the underlying type ramp during parity migration.
3. Keep `portal-*` and MQ implementations byte/computed-value equivalent while
   marking them deprecated; remove only byte-identical scroll utilities.
4. Add semantic page-width tokens/primitives and migrate one live/loading route
   pair for each width.
5. Migrate typography one package at a time, with computed-style and screenshot
   comparisons at wrap-sensitive widths.
6. Remove aliases only in a later breaking/deprecation plan after downstream
   usage is proven zero.

## Verification

- focused theme/UI tests and full `pnpm test`;
- `pnpm build`;
- gallery screenshots and route screenshots at 375, 768, 900, 1024, and 1440px;
- inventories for legacy type vocabularies and literal page widths decrease.

## Done criteria

- [ ] Every type vocabulary has a documented canonical mapping.
- [ ] Every portal-to-text-ui mapping preserves its explicit color/tone.
- [ ] New code can use only canonical roles.
- [ ] Live/loading route pairs share semantic container roles.
- [ ] No unapproved wrapping or layout shift exists in visual baselines.
- [ ] Compatibility aliases remain until a deliberate removal release.

## STOP conditions

- Two candidate roles differ in computed typography or color ownership.
- A proposed change reduces the type ramp or introduces an intentional visual
  redesign in the parity migration.
- A page-width migration changes its responsive grid breakpoint.
- Visual comparison is unavailable for a package being migrated.
