# Plan 008: Migrate remaining consumers in bounded visual batches

> **Executor instructions:** Execute one package family per PR/Changeset. Never
> combine all migrations into a mechanical repository-wide rewrite.
>
> **Drift check:** compare every selected package with `86a9d12` and with the
> baseline screenshots created by Plan 003.

## Status

- **Priority:** P2
- **Effort:** L
- **Risk:** HIGH
- **Depends on:** Plans 004, 005, 006, and 007
- **Category:** migration
- **Planned at:** commit `86a9d12`, 2026-07-29

## Migration rule

Each PR changes one visual concern in one coherent component/route family.
Never combine control replacement, typography, theming, and component-shadow
consolidation merely because the files live in the same package.

Concern order:

1. live/loading page-width pairs;
2. typography plus explicit tone;
3. Projects semantic token families;
4. classified dark-mode recipes;
5. controls;
6. shared component defaults/shadows;
7. preview and scaffold templates.

Within each concern, migrate package families in this order: UI/app-shell,
Admin/Auth, CRM, Projects list, Projects detail/board/create, Marketing, then
preview/templates.

For each batch:

1. Record starting inventory and route screenshots.
2. Change exactly one of: controls, typography/layout, theme tokens, or
   component variants.
3. Preserve compatibility aliases and the other visual dimensions.
6. Run focused tests, full tests/build, and compare screenshots.
7. Add the affected package Changeset. Stop before publishing.

## Required verification per batch

- changed-package focused tests;
- `pnpm test`;
- `pnpm check:create-bw-app-templates` when templates/defaults are touched;
- `pnpm build`;
- desktop/mobile light/dark screenshots for every affected route;
- `git diff --name-only` contains only the selected batch, tests, docs, and
  Changesets.

## Done criteria

- [ ] Raw Select/Textarea inventories reach zero outside documented specialized
  controls.
- [ ] Typography legacy inventories reach zero before alias removal is planned.
- [ ] Literal page-width inventory reaches zero.
- [ ] Non-exception color/surface `dark:` inventory reaches zero.
- [ ] Numbered Project tokens have no live consumers.
- [ ] No route has an unapproved geometry, wrapping, or theme delta.

## STOP conditions

- A replacement changes control semantics or keyboard behavior.
- A typography change alters wrapping without explicit approval.
- A theme change cannot be verified in both light and dark.
- A migration needs a consumer-repo patch to make platform tests pass.
- The proposed PR changes more than one independent visual concern and cannot
  be rolled back without reverting unrelated improvements.
