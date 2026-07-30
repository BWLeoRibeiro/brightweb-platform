# Plan 003: Establish package and visual characterization gates

> **Executor instructions:** This plan adds evidence and low-risk ownership
> fixes. Do not begin broad visual migration here.
>
> **Drift check:** `git diff --stat 86a9d12..HEAD -- packages/theme packages/ui packages/app-shell packages/module-projects apps/platform-preview tests`

## Status

- **Priority:** P1
- **Effort:** M
- **Risk:** LOW
- **Depends on:** none
- **Category:** tests / architecture
- **Planned at:** commit `86a9d12`, 2026-07-29

## Why this matters

Existing hygiene tests are strong at whole-repo color checks but can miss a
token defined by the wrong package. Large type/theme migrations also lack a
compact visual reference. This plan makes later changes measurable before they
touch defaults.

## Current state

- `app-sheet.tsx:7` consumes `--sheet-header-surface`; only
  `module-projects/tokens.css:2` defines it.
- app-shell status pages consume optional MQ alias `--mq-brand-400`.
- `theme-contract.test.ts:226-247` concatenates several packages, hiding
  cross-package phantoms.
- Projects exports `tokens.css` but its module manifest omits the token file, so
  `theme-contract.test.ts:269-281` skips it.
- No preview route renders the public UI catalog side by side.

## Scope

Package-boundary test helpers, module manifest/export agreement, neutral token
defaults for confirmed phantoms, preview primitives route, screenshot/computed
token fixtures, tests, docs, and Changesets for packages whose runtime CSS
changes.

## Steps

1. Build a per-package token resolver using each published package's legitimate
   dependencies, own CSS, and documented runtime-injected-variable allowlist.
   Do not concatenate the whole monorepo.
2. Make exported module token files discoverable and require manifest/export
   agreement. Classify semantic aliases, component recipes, and runtime tokens
   rather than forcing them through one regex.
3. Move `--sheet-header-surface` to theme/app-shell ownership and replace the
   status-page MQ primitive with a neutral semantic token.
4. Add non-increasing inventories for raw Select/Textarea/Button uses,
   typography vocabularies, numbered project tokens, unofficial page widths,
   and color/surface `dark:` modifiers. Baselines are migration counters, not
   permission for new uses.
5. Add deterministic fixture routes for controls, fields, feedback, overlays,
   navigation, data display, and Tier-2 patterns. Seed data; remove live auth/
   database/network/time dependencies; wait for fonts; disable motion.
6. Add isolated neutral and MQ primitives documents. The current preview imports
   MQ globally, so variable toggles inside that document are not a truthful
   neutral comparison.
7. Add `@playwright/test` as an explicit root development dependency, a checked
   in Playwright config, computed-token assertions, and screenshot baselines for
   neutral/MQ light/dark at desktop and mobile widths.

## Verification

- `node --experimental-strip-types --loader ./tests/support/ts-extension-loader.mjs --test tests/theme-contract.test.ts tests/ui-hygiene.test.ts tests/ui-patterns.test.ts`
- `pnpm build`
- preview gallery route returns 200 in both theme states

Expected: all pass; removing a package-owned token or adding a raw control makes
the focused suite fail with the owning package/file named.

## Done criteria

- [ ] Per-package analysis catches both confirmed phantom-token cases.
- [ ] Runtime variables are explicitly classified, not given fake defaults.
- [ ] Projects token CSS is covered by its module/package contract.
- [ ] Inventory counts cannot increase.
- [ ] Gallery and computed-token baselines exist before theme refactoring.

## STOP conditions

- A suspected phantom is injected by Radix/runtime; classify it instead.
- Neutral and MQ cannot coexist truthfully in one document; use isolation.
- A proposed test requires importing unrelated module CSS to make a package pass.
- Baselines depend on live authentication/data, external fonts, wall-clock time,
  or animation.
