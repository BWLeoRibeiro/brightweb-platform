# Plan 001: Put site scaffolds on the BrightWeb design-system boundary

> **Executor instructions:** Work only in this platform worktree. Follow every
> verification gate. Do not edit `be-green` or publish packages.
>
> **Drift check:** `git diff --stat 86a9d12..HEAD -- packages/create-bw-app scripts tests docs`
> Stop if the cited template/update contracts changed materially.

## Status

- **Priority:** P1
- **Effort:** M
- **Risk:** MED
- **Depends on:** none
- **Category:** architecture / migration
- **Planned at:** commit `86a9d12`, 2026-07-29

## Why this matters

The canonical site scaffold currently creates an independent design system, so
platform theme/UI fixes cannot reach generated sites. Adding shared packages
alone is unsafe: the updater currently classifies any app containing a
BrightWeb package as a platform app. This plan fixes identity, dependency
ownership, template wiring, and fixture verification together.

## Current state

- `packages/create-bw-app/src/constants.mjs:190-195` defines
  `SITE_DEPENDENCY_DEFAULTS` without `@brightweblabs/theme` or
  `@brightweblabs/ui`.
- `packages/create-bw-app/template/site/base/app/globals.css:1` imports
  Tailwind and owns an independent token system.
- `packages/create-bw-app/src/update.mjs:153-159` treats any app with a
  BrightWeb package as `platform`.
- `.brightweb/app-manifest.json` already records `template: "site"` through
  `createInitialAppManifest` in `generator.mjs:1502-1511`.
- `mergeManagedPackageUpdates` in `update.mjs:199-244` updates installed
  packages and has only one hard-coded missing dependency exception.
- As of reconciliation commit `ebcf07b`,
  `scripts/check-create-bw-app-templates.mjs` already validates dependency
  declarations and typechecks both generated fixtures. This is a landed
  prerequisite, not remaining implementation work.

## Commands

| Purpose | Command | Expected |
| --- | --- | --- |
| Focused tests | `node --experimental-strip-types --loader ./tests/support/ts-extension-loader.mjs --test tests/create-bw-app-update.test.ts tests/create-bw-app-cli.test.ts tests/compatibility-set-sync.test.ts` | exit 0 |
| Template gate | `pnpm check:create-bw-app-templates` | exit 0; both fixtures validated |
| Compatibility | `pnpm check:compatibility-set` | exit 0 |
| Full test | `pnpm test` | exit 0 |
| Build | `pnpm build` | exit 0 |

## Scope

**In scope:**

- `packages/create-bw-app/src/constants.mjs`
- `packages/create-bw-app/src/generator.mjs`
- `packages/create-bw-app/src/update.mjs`
- `packages/create-bw-app/src/app-manifest.mjs`
- `packages/create-bw-app/template/site/base/app/globals.css`
- `packages/create-bw-app/template/site/base/app/layout.tsx`
- `packages/create-bw-app/template/site/base/AGENTS.md`
- `scripts/{sync,validate}-compatibility-set.mjs`
- `scripts/check-create-bw-app-templates.mjs`
- related create/update/template tests, docs, and one Changeset

**Out of scope:**

- consumer source files;
- migrating existing local component libraries;
- redesigning the starter's brand;
- npm versioning or publication.

## Steps

### 1. Make manifest identity authoritative

Update template detection to read and validate `.brightweb/app-manifest.json`
first. Use its template value when it is `platform` or `site`. Retain the
existing heuristics only for legacy apps without a manifest; report ambiguous
BrightWeb-package-only apps rather than silently choosing platform.

**Verify:** focused update tests cover manifest-backed site, manifest-backed
platform, legacy platform, legacy site, malformed manifest, and ambiguity.

### 2. Add site design dependencies and a pinned CLI to the compatibility contract

Make `createPackageJson` consume a declarative per-template dependency policy;
its current site branch hard-codes four framework/font dependencies and does not
consume `SITE_DEPENDENCY_DEFAULTS`. Add theme, UI, and UI's `lucide-react` peer
to the site policy. Extend compatibility sync and
validation so both app and site BrightWeb defaults are generated from
`brightweb-release.json`. Add `create-bw-app` as a managed development
dependency for both scaffold types so generated apps can run a stable local
`bw` command in CI. Do not use an unversioned `pnpm dlx ...@latest` invocation
or duplicate version literals in a third place.

**Verify:** `pnpm check:compatibility-set` reports both dependency sets and the
CLI development dependency aligned.

### 3. Generalize required-dependency reconciliation

Replace the `module-orgs` one-off with a template/module-derived required
BrightWeb dependency set. Updates may add missing required packages and update
installed required packages; they must not remove, relocate, or rewrite
consumer-owned third-party dependencies.

Resolve versions for the complete required set before reconciling the installed
set; the current registry path only looks up packages already installed. Honor
workspace mode for sites instead of forcing `published`.

**Verify:** a legacy site update plan adds the required design packages only; a
current site is a no-op; a workspace site uses `workspace:*`; a platform CRM app
still adds orgs when missing.

### 4. Wire the site template through shared foundations

Import `@brightweblabs/theme/css` before site-owned overrides and configure
Tailwind source scanning/Next transpilation as required for shared UI source.
Keep `app/globals.css` app-owned so brand tokens are never overwritten. Scaffold
and validate a required import/source boundary with an actionable `bw check`
failure if the owner removes it; do not claim the entire brand file is managed.
Reconcile manifest/app-context/AGENTS ownership language in the same PR. Do not
make the starter mount demo components.

**Verify:** generated site imports Button and Input from published subpaths in a
temporary typecheck fixture without local `components/ui`.

### 5. Extend the landed generated-site validation

Build on the existing dependency assertions, `next typegen`, and
`tsc --noEmit` checks. Add validation for the shared theme import, emitted
Next/CSS output, and packed package contents so the gate does not pass only
because workspace symlinks make unpublished files available.

**Verify:** `pnpm check:create-bw-app-templates` fails when the site theme import
or dependency is intentionally removed, then passes after restoration. The
packed-package assertion must fail when a required published file is excluded.

### 6. Record package impact

Add a Changeset for `create-bw-app`; include theme/UI only if their published
files changed.

## Done criteria

- [ ] Manifest-backed sites remain classified as sites after theme/UI install.
- [ ] New sites contain shared theme/UI dependencies and no local UI library.
- [ ] Existing sites can acquire missing required dependencies via an update plan.
- [ ] Compatibility sync/validation covers app and site defaults.
- [ ] Generated apps expose the pinned local `bw` binary used by CI scripts.
- [ ] Both generated templates typecheck in the template gate.
- [ ] Required CI gates pass and no consumer repo was modified.

## STOP conditions

- A generated manifest has no reliable template field.
- Shared theme import cannot preserve a final site-owned brand override layer.
- The only repair path would overwrite an app-owned brand stylesheet.
- Site support would require importing platform modules or database wiring.
- The change requires publishing to verify correctness.

## Maintenance notes

Future required scaffold dependencies must be declared through the same
template/module contract; do not add another package-specific exception to the
updater.
