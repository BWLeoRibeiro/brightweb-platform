# Plan 007: Repair shared component defaults and local shadows

> **Drift check:** `git diff --stat 86a9d12..HEAD -- packages/ui packages/app-shell packages/module-admin packages/module-crm packages/module-projects packages/module-marketing tests apps/platform-preview`

## Status

- **Priority:** P2
- **Effort:** M
- **Risk:** MED
- **Depends on:** Plans 003 and 004
- **Category:** architecture
- **Planned at:** commit `86a9d12`, 2026-07-29

## Current state

- FieldLabel has 52 uses; 49 override `className`.
- SurfaceCard has 15 uses; 13 override `className`.
- ProjectSurfaceCard shadows the shared card.
- StatTile callers override padding/borders.
- Local StatusPill/RoleBadge/SectionHeading/KpiBreakdownBar names overlap public
  UI exports, but not all local semantics are equivalent.

## Steps

1. Characterize the few non-overridden FieldLabel/SurfaceCard/StatTile uses.
2. Add explicit variants instead of changing defaults blindly:
   FieldLabel `default/compact/sheet`; SurfaceCard `as/padding/tone/motion`;
   StatTile density/divider options.
3. Route app-sheet label and card recipes through those variants.
4. Compare each local shadow with the public primitive. Consolidate only
   equivalent anatomy; retain and rename true module specializations. In
   particular, do not force Dashboard KPI motion/tone, Marketing campaign status,
   compact Projects headings, or ProjectSurfaceCard dark/animation behavior into
   a generic primitive without an explicit matching API.
5. Migrate repeated identical override recipes and make their inventory
   non-increasing.

## Verification

- rendered API tests in `tests/ui-patterns.test.ts`;
- UI hygiene inventories;
- gallery snapshots;
- representative module screenshots;
- full `pnpm test` and `pnpm build`.

## Done criteria

- [ ] Repeated overrides have named package APIs.
- [ ] Shared defaults remain stable until their consumers are characterized.
- [ ] Equivalent shadows compose public primitives.
- [ ] Non-equivalent specializations are explicitly named/documented.

## STOP conditions

- A local component differs in semantics, interaction, or compact geometry.
- Consolidation requires weakening accessibility or public prop contracts.
