# Plan 006: Make themes primitive-driven and package-safe

> **Executor instructions:** This is the highest-risk plan. Do not alter cascade
> structure before Plan 003 baselines exist.
>
> **Drift check:** `git diff --stat 86a9d12..HEAD -- packages/theme packages/module-projects packages/ui packages/app-shell packages/module-crm tests apps/platform-preview`

## Status

- **Priority:** P1
- **Effort:** L
- **Risk:** HIGH
- **Depends on:** Plan 003
- **Category:** architecture / theming
- **Planned at:** commit `86a9d12`, 2026-07-29

## Current state

- Base dark mode re-declares primitives and L1/L2 semantics in
  `tokens.css:470-582`.
- MQ root/dark/light repeats primitives, semantic layers, and package recipes.
- 57 `dark:` occurrences remain across 29 package source files; only asset/icon
  visibility and chart selector emission are clear structural exceptions.
- Projects declares 79 opaque `--project-ui-color-*` tokens.
- MQ imported after base theme intentionally wins globally in preview, so a
  non-isolated neutral/MQ side-by-side is misleading.

## Steps

1. Define and test an allowed brand primitive contract plus documented semantic
   exceptions. Add key-symmetry and computed-value tests for neutral/MQ
   light/dark.
2. Introduce intent-bearing Projects tokens by component family. Keep numbered
   tokens as deprecated aliases for a release; prohibit new numbered tokens.
3. Classify every `dark:` recipe before enforcing the boundary. Replace
   theme-specific color/surface recipes in bounded families with semantic
   tokens. Preserve reviewed structural and interaction-state cases, including
   asset/icon visibility, chart selector emission, and ARIA-invalid/focus/
   selected contrast where no equivalent semantic state token exists.
4. Make shared L1/L2/L3 semantics derive from the brand primitive contract.
   Reduce MQ to primitives and explicit exceptions without changing computed
   baselines.
5. Remove the duplicated explicit-light semantic block in its own PR only after
   runtime no-class → dark → light → dark sequences prove equivalent class and
   `[data-theme]` precedence.
6. Document the minimal brand contract and import order.

## Verification

- `node --experimental-strip-types --loader ./tests/support/ts-extension-loader.mjs --test tests/theme-contract.test.ts tests/ui-hygiene.test.ts`
- `pnpm test`
- `pnpm build`
- computed-token snapshots for neutral/MQ light/dark
- gallery and representative CRM/Projects/Dashboard/Auth screenshots

Expected: every planned computed token matches baseline unless the plan records
and approves the intentional delta.

## Done criteria

- [ ] Brand files override only allowed primitives/exceptions.
- [ ] Package-boundary token checks pass independently.
- [ ] Numbered Project tokens are deprecated aliases, not active authoring API.
- [ ] Non-exception color/surface `dark:` count reaches zero and every exception
  is documented by category.
- [ ] Runtime light/dark toggling and MQ import order remain correct.

## STOP conditions

- Any unapproved computed-token or screenshot delta.
- A runtime-injected token is mistaken for a theme default.
- Neutral-vs-MQ comparison lacks document isolation.
- Removing a numbered alias would break a published consumer.
- Exact computed parity conflicts with a proposed minimal primitive contract;
  expand explicit semantic exceptions instead of silently accepting a delta.
