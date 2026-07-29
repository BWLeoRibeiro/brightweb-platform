# Plan 004: Add shared form primitives and control geometry

> **Executor instructions:** Introduce additive APIs first. Preserve current
> public defaults until representative consumers and gallery snapshots pass.
>
> **Drift check:** `git diff --stat 86a9d12..HEAD -- packages/theme packages/ui packages/app-shell tests apps/platform-preview`

## Status

- **Priority:** P1
- **Effort:** L
- **Risk:** MED
- **Depends on:** Plan 003
- **Category:** architecture / accessibility
- **Planned at:** commit `86a9d12`, 2026-07-29

## Current state

- There are 44 raw `<select>` and 13 raw `<textarea>` elements outside UI.
- Dashboard tabs are a local pressed-button implementation.
- Button defaults to 36px/`--radius-control`; Input to
  44px/`--radius-card`; SearchField overrides Input to 32/36px; PhoneInput has
  no styled outer control.
- `Input` uses foreground opacity recipes instead of the `--input`/`--border`
  contract.
- App-sheet controls define another 28/36px geometry vocabulary.

## Scope

Theme control tokens, UI Input/Select/Textarea/Tabs/SearchField/PhoneInput/Button
APIs and exports, app-sheet aliases, gallery/examples, focused tests, affected
package docs, and Changesets.

Bulk replacement of all 57 raw controls is deferred to Plan 008.

## Steps

1. Define one named geometry scale while preserving current computed defaults:
   `xs=24px`, `sm=32px`, `md=36px`, `lg=44px`. One scale does not mean every
   component has the same default. Preserve Button at `md`, Input at `lg`,
   SearchField at `sm/md`, and app-sheet view/edit at `28px/md`. Add distinct
   named shape aliases for current 10px and 12px radii; do not converge radii
   without a separately approved visual delta.
2. Add native-semantic `Select` and `Textarea` primitives that forward native
   props/ref and preserve browser semantics. Add root and subpath exports.
3. Add accessible Tabs primitives using the direct Radix Tabs package unless
   investigation proves it cannot compose the existing motion indicator. Cover
   tablist/tab/tabpanel semantics, roving arrow-key focus, activation mode,
   disabled tabs, and controlled/uncontrolled state.
4. Give Input a typed size/tone API that consumes `--input` and `--border`.
   Rebuild SearchField through that API rather than five style overrides.
5. Give PhoneInput a shared outer-control recipe while preserving its tested
   combobox/listbox contract.
6. Route app-sheet edit/view/date/textarea recipes through shared geometry
   aliases.
7. Migrate one representative Admin/CRM/Projects consumer per new primitive;
   do not bulk replace.

## Tests

- Model new render/prop tests after PhoneInput coverage in
  `tests/ui-patterns.test.ts`.
- Cover ref/native prop forwarding, disabled/invalid/focus states, all sizes,
  Tabs keyboard behavior, and gallery snapshots.
- Assert the representative adjacent Button/Input/Select/SearchField geometry
  resolves to declared tokens.

## Verification

- `node --experimental-strip-types --loader ./tests/support/ts-extension-loader.mjs --test tests/ui-patterns.test.ts tests/ui-hygiene.test.ts tests/theme-contract.test.ts`
- `pnpm test`
- `pnpm build`

## Done criteria

- [ ] Public Select, Textarea, and Tabs APIs exist with subpath exports.
- [ ] Shared controls use one named geometry contract.
- [ ] Input consumes semantic input/border tokens.
- [ ] SearchField no longer overrides height/radius/border/background/type ad hoc.
- [ ] Raw-control inventory is lower and cannot increase.
- [ ] Current unrelated consumer geometry remains unchanged.

## STOP conditions

- A default change affects more consumers than the representative batch.
- Named geometry tokens change any existing default screenshot.
- Native Select cannot meet a required interaction without a separately named
  custom combobox primitive.
- Tabs migration changes routing/state semantics.
