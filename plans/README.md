# BrightWeb Design-System Implementation Plans

Generated on 2026-07-29 against commit `86a9d12`, then reconciled with
`feat/review-fixes` at `ebcf07b`. The original SHA remains in each drift check
to expose intervening changes. These plans keep the source-of-truth changes in
`brightweb-platform`. Consumer repositories are used only as validation
fixtures; do not patch their UI components to make a plan pass.

For the mergeable PR sequence, parallel worktree lanes, conflict rules, and
test matrix, use [`IMPLEMENTATION.md`](./IMPLEMENTATION.md).

## Outcome

After this sequence:

- new platform and site scaffolds consume the platform-owned theme/UI boundary;
- existing consumers have a non-mutating CI check for compatible package and
  managed-file drift;
- package-token ownership, primitive geometry, typography, page widths, and
  brand theming have enforceable contracts;
- broad migrations happen only after static and visual baselines exist.

Central packages cannot update an existing repository until that repository
adopts the drift-check command once. The platform can own the command, scaffold,
documentation, and reusable workflow, but it cannot silently edit independent
Git repositories.

## Execution order and status

| Plan | Title | Priority | Effort | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| 001 | Put site scaffolds on the BrightWeb design-system boundary | P1 | M | — | TODO |
| 002 | Add a compatibility-set-driven consumer drift check | P1 | M | 001 | TODO |
| 003 | Establish package and visual characterization gates | P1 | M | — | TODO |
| 004 | Add shared form primitives and control geometry | P1 | L | 003 | TODO |
| 005 | Canonicalize typography and page-layout roles | P2 | L | 003 | TODO |
| 006 | Make themes primitive-driven and package-safe | P1 | L | 003 | TODO |
| 007 | Repair shared component defaults and local shadows | P2 | M | 003, 004 | TODO |
| 008 | Migrate remaining consumers in bounded visual batches | P2 | L | 004–007 | TODO |

Status values: `TODO`, `IN PROGRESS`, `DONE`, `BLOCKED: <reason>`, or
`REJECTED: <reason>`.

## Dependency notes

- Plans 001–003 are mechanism and characterization work. They should land
  before broad visual changes.
- Plan 004 introduces public APIs before replacing raw controls.
- Plans 005–007 retain compatibility aliases and current defaults until Plan
  008 proves each migration batch visually.
- Plan 006 must not begin its cascade rewrite until Plan 003 has computed-token
  and screenshot baselines for neutral/MQ light and dark.
- Publishing is not part of any plan. Each package change needs a Changeset,
  but release/version/publish remains a separate operator action.

## Findings considered and rejected

- **Move every package to 1.0 immediately:** rejected as a propagation fix.
  `@brightweblabs/ui` is already 1.x, while the compatibility set and updater
  are the correct cross-package mechanism. A 1.0 declaration should reflect
  API stability, not work around missing consumer CI.
- **Use wider pre-1.0 dependency ranges:** rejected. Automatically accepting
  every minor release removes the compatibility-set gate and can admit breaking
  changes.
- **Patch `be-green/apps/site/components/ui` directly:** rejected for this
  sequence. It would repair one consumer while leaving the scaffold defect.
- **Mechanically replace all typography classes, numbered tokens, or `dark:`
  utilities in one pass:** rejected because static tests cannot detect wrapping,
  cascade, or density regressions across hundreds of sites.
