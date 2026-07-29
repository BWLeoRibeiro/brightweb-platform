# BrightWeb Design-System Execution Plan

Audited against `86a9d12` and reconciled with the review-fix head `ebcf07b`
before execution. The detailed plans retain the original audit SHA in their
drift checks so later executors can see every intervening change.

This file turns the eight design plans into mergeable implementation units.
The detailed contract for each unit remains in `plans/001-*.md` through
`plans/008-*.md`.

## Delivery rule

All reusable design changes land in `brightweb-platform` packages, templates,
tests, or release tooling. Consumer applications may be opened as validation
fixtures, but their components must not be patched to make platform work pass.

Existing independent repositories need one explicit adoption change to invoke
the platform drift check. After that, compatible package and managed-file drift
is detected centrally.

## Execution pipeline

```text
Gate 1: propagation
  site identity/dependencies + pinned CLI ──> compatibility set ──> bw check
             │
             v
Gate 2: characterization
  package token boundaries ──> primitive gallery ──> computed/screenshot baselines
             │
             v
Gate 3: shared APIs
  geometry ──> Input/Search/Phone ──> Select/Textarea/Tabs ──> component variants
             │
             v
Gate 4: bounded migrations
  typography/layout ──> semantic theme tokens ──> package-by-package callers
             │
             v
  Changesets + full CI ──> operator-owned release/publish
```

Do not start Gate 4 theme derivation until Gate 2 baselines are reviewed and
accepted.

## Pull-request sequence

### Preflight: establish a clean baseline

- Run `pnpm install --frozen-lockfile`; stop if the lockfile changes.
- Run the three focused design tests directly with Node, not
  `pnpm test -- <files>` because the root script ignores file filtering.
- Run `pnpm build` and record any pre-existing failure at the reconciled head.

### PR 1a: Enforce package token ownership

- **Source plan:** 003
- **Primary modules:** `tests/`, `packages/theme/`, `packages/app-shell/`,
  module manifests
- **Work:**
  - replace aggregate phantom-token analysis with per-published-package
    resolution;
  - reconcile module token manifests with package exports;
- **Tests:** negative fixtures prove unrelated module CSS and optional MQ aliases
  cannot satisfy a package contract.
- **Changeset:** none; test/manifest contract only.

### PR 1b: Repair confirmed phantom tokens

- **Depends on:** PR 1a must fail first.
- **Work:** move `--sheet-header-surface` to its neutral owner and replace
  app-shell's MQ-only status token with a semantic theme token.
- **Tests:** focused theme-contract/UI-hygiene tests, full `pnpm test`, build.
- **Rollback:** revert token ownership and its package Changeset together; never
  retain a test allowlist that imports unrelated module CSS.

### PR 2: Make site scaffolds consume theme and UI

- **Source plan:** 001
- **Primary modules:** `packages/create-bw-app/`, compatibility scripts, template
  fixture tests
- **Work:**
  - make `.brightweb/app-manifest.json` authoritative for template identity;
  - add theme/UI to site dependency defaults and the pinned CLI to scaffold
    development dependencies;
  - make the hard-coded site `createPackageJson` branch consume the declarative
    policy and include UI's `lucide-react` peer;
  - honor workspace mode for sites;
  - generalize required-dependency reconciliation;
  - import shared theme CSS before site-owned overrides;
  - keep brand CSS app-owned and validate its required platform import boundary
    without overwriting it;
  - typecheck both generated fixtures.
- **Tests:** manifest-backed and legacy classification matrix; missing/current
  dependency matrix; platform and site fixture typechecks; generated Next/CSS
  build; packed-package contents check so validation does not rely only on
  workspace symlinks.
- **Rollback:** revert as one unit. Adding dependencies without manifest-driven
  classification is forbidden.

### PR 3a: Publish an atomic compatibility contract

- Sync the exact map into the published CLI package metadata and validate
  contract version plus CLI/map version agreement.
- Resolve published targets from one CLI metadata response; workspace mode uses
  local `brightweb-release.json`.
- Treat old/malformed metadata as incompatible rather than mixing per-package
  latest versions.

### PR 3b: Add manifest-aware `bw check`

- **Source plan:** 002
- **Primary modules:** create-bw-app update/CLI, release metadata, CLI tests/docs
- **Work:**
  - bundle one coherent release map;
  - distinguish current CLI, stale CLI, unavailable metadata, and incompatible
    set;
  - compose compatibility drift with manifest-aware doctor/upgrade ownership;
  - add a write-free `bw check` with deterministic exit codes;
  - scaffold/document the one-time consumer CI adoption.
- **Tests:** file-tree snapshot proves zero writes; managed/owned/skipped file
  matrix; exit-code/message matrix; coherent versus mixed release sets; network
  failure.
- **Rollback:** check mode is additive. Revert CLI/check docs without changing
  consumer dependency ranges.

### PR 4: Add deterministic design characterization

- **Source plan:** 003
- **Primary modules:** platform preview, UI/theme tests
- **Work:**
  - add non-increasing inventories for raw controls, type vocabularies, numbered
    tokens, page widths, and theme-specific color modifiers;
  - add deterministic fixture routes for data, fonts, time, and motion;
  - add isolated neutral and MQ `/preview/primitives` documents;
  - add an explicit root Playwright dependency/configuration;
  - capture neutral/MQ light/dark computed tokens and desktop/mobile screenshots.
- **Tests:** gallery route smoke test plus stable computed-token fixtures.
- **Rollback:** baseline generation must be deterministic. Stop if screenshots
  differ between identical local runs.

### PR 5: Introduce control geometry and repair existing inputs

- **Source plan:** 004
- **Primary modules:** theme tokens, UI Input/SearchField/PhoneInput/Button,
  app-shell sheet recipes
- **Work:**
  - add the named `24/32/36/44px` size scale while preserving each component's
    current default and both current radius shapes;
  - add typed Input size/tone variants;
  - rebuild SearchField through Input variants;
  - give PhoneInput a shared outer-control recipe;
  - route app-sheet controls through the same aliases.
- **Tests:** rendered geometry contracts, native prop/ref forwarding,
  invalid/disabled/focus states, gallery snapshots.
- **Rollback:** additive tokens/variants can remain if a caller migration is
  reverted. Do not change global defaults and caller recipes in the same commit.

### PR 6: Add Select and Textarea

- **Source plan:** 004
- **Primary modules:** `packages/ui/`, representative Admin/CRM/Projects callers
- **Work:** add native-semantic primitives, public root/subpath exports, and
  migrate one representative caller per package.
- **Tests:** all native props/ref, controlled/uncontrolled values, disabled,
  invalid, option groups, placeholder, resize/rows, light/dark snapshots.
- **Rollback:** revert representative callers first; additive exports may stay.

### PR 7: Add semantic Tabs

- **Source plan:** 004
- **Primary modules:** UI and Dashboard segmented control
- **Work:** direct Radix Tabs dependency, tablist/tab/tabpanel semantics, roving
  keyboard focus, controlled and uncontrolled selection, motion-indicator
  composition.
- **Tests:** ArrowLeft/Right, Home/End, disabled tabs, focus restoration,
  controlled selection, reduced motion.
- **Rollback:** preserve the existing Dashboard pressed-button path until all
  behavior tests pass; switch it in a separate commit.

### PR 8: Add component variants and classify shadows

- **Source plan:** 007
- **Primary modules:** UI FieldLabel/SurfaceCard/StatTile and module wrappers
- **Work:** additive label/card/tile variants, app-sheet composition, consolidate
  only equivalent local shadows, rename intentional specializations.
- **Tests:** characterize every unoverridden current use before any default
  change; rendered variant matrix and screenshots.
- **Rollback:** revert caller conversions independently of the additive API.

### PR 9a: Add type and page-layout contracts without consumers

- **Source plan:** 005
- **Primary modules:** theme typography/layout, app-shell, one live/loading route
  pair per width
- **Work:** publish an exact computed-style mapping table; add canonical roles
  with explicit tone mappings; retain byte/computed-equivalent deprecated
  aliases; add semantic `detail/workspace/wide` containers. Do not reduce the
  type ramp.
- **Tests:** computed typography, wrapping screenshots, paired live/loading
  geometry at 375/768/900/1024/1440px.
- **Rollback:** aliases remain. Revert one package or route pair without
  reverting the canonical contract.

### PR 9b+: Migrate widths, then typography, by route family

- Migrate exact live/loading width pairs first: Projects detail, Projects
  board/tasks, then Admin/portfolio/Dashboard wide layouts.
- Migrate typography by package and route family only when family, size, weight,
  line height, tracking, transform, and explicit tone match.
- One concern and one screenshot-owned family per PR.

### PR 10: Introduce semantic Projects token bridges

- **Source plan:** 006
- **Primary modules:** theme and Projects tokens
- **Work:** introduce intent-bearing aliases by component family and make old
  numbered public tokens alias the new name. Do not rename all declarations and
  consumers in one PR.
- **Tests:** package token boundary, computed light/dark values, representative
  family screenshots.
- **Rollback:** keep both old and new aliases during the migration window.

### PR 10b+: Migrate classified dark recipes by component family

- Build an exception taxonomy first.
- Preserve structural and interaction-driven cases until equivalent semantic
  state contracts exist.
- Start with leaf packages; change shared UI recipes only after semantics are
  stable.

### PR 11a-e: Derive shared semantics from brand primitives

- **Source plan:** 006
- **Primary modules:** theme base/MQ CSS and theme contracts
- **Work:** serialize five independently revertible PRs: allowed primitive/
  semantic-exception schema; neutral derivation; dark derivation; MQ reduction;
  explicit-light removal after toggle precedence tests.
- **Tests:** exact computed-token baseline matrix and all representative route
  screenshots.
- **Rollback:** one commit per theme layer. Any unapproved computed delta blocks
  merge.

### PR 12+: Migrate controls and component variants by concern

- **Source plan:** 008
- **Order:** controls first, then defaults/shadows; within each concern use
  UI/app-shell, Admin/Auth, CRM, Projects list, Projects detail, Marketing,
  preview/templates.
- Each PR changes one concern in one coherent family and receives its own
  Changeset.
- Alias removal is a later, separately approved breaking/deprecation release.

## Parallel worktree lanes

| Lane | Work | Can start | Merge constraint |
| --- | --- | --- | --- |
| A | PR 1 package boundaries | immediately | merge before theme/token work |
| B | PR 2 then PR 3 propagation | immediately | sequential; shared create-bw-app |
| C | PR 4 characterization | immediately | merge before PRs 5-12 |
| D | PRs 5-8 shared APIs | after PR 4 | sequential inside UI/app-shell |
| E | PR 9 typography/layout | after PR 4 | contract first; route pairs later |
| F | PR 10 token bridges/dark families | after PR 1 + PR 4 | merge before PR 11 |
| G | PR 11a-e theme derivation | after PRs 9-10 | exclusive theme ownership |
| H | PR 12 package migrations | after relevant APIs/tokens | one package per worktree |

Launch A, B, and C in parallel. Merge A and C before starting D/E/F. Merge
D/E/F, rebase, then give G exclusive ownership of `packages/theme` and theme
contract fixtures. Package migration worktrees begin only after their required
shared APIs are merged.

## Conflict rules

- Only one active worktree may edit `packages/theme/src/tokens.css`,
  `packages/theme/src/typography.css`, or `tests/theme-contract.test.ts`.
- UI primitive PRs own `packages/ui/src/index.ts` and
  `packages/ui/package.json`; serialize their export-map commits.
- Propagation PRs own create-bw-app update/generator tests and must be sequential.
- Migration worktrees must not modify shared primitive defaults. If a caller
  needs a new variant, stop and add it through the shared-API lane first.

## Test matrix

```text
Scaffold/update
  manifest present
    ├── platform
    ├── site
    └── malformed/unsupported -> actionable failure
  manifest absent
    ├── unambiguous legacy platform/site
    └── ambiguous -> stop, no writes
  compatibility and ownership
    ├── current
    ├── stale packages
    ├── stale CLI
    ├── mixed release map
    ├── registry unavailable
    ├── managed file drift -> fail
    ├── owned/skipped file drift -> report
    └── intent mismatch -> fail

Shared UI
  each primitive
    ├── native props + ref
    ├── controlled/uncontrolled state
    ├── disabled + invalid + focus
    ├── keyboard contract
    └── light/dark rendered geometry

Theme/migrations
  neutral + MQ
    ├── light + dark
    ├── mobile + tablet + desktop
    ├── computed token snapshot
    └── representative route screenshot
```

## Required gates for every PR

1. Focused tests for the changed contract.
2. `pnpm release:check`.
3. `pnpm check:compatibility-set`.
4. `pnpm check:create-bw-app-templates`.
5. `pnpm test`.
6. `pnpm build`.
7. Changeset for every changed published package.
8. No npm publish, version bump, consumer patch, or unrelated formatting.

Focused Node test command:

```bash
node --experimental-strip-types \
  --loader ./tests/support/ts-extension-loader.mjs \
  --test <explicit test files>
```

Do not use `pnpm test -- <files>` as a filter; the root package script expands
the full suite regardless of the extra arguments.

## Definition of done

- New sites and platforms share the package-owned design foundation.
- Consumer CI can fail on stale compatible packages without writing files.
- Every published package resolves its token contract independently.
- Raw Select/Textarea, legacy typography, literal page widths, numbered token
  consumers, and non-structural `dark:` inventories reach zero through bounded
  migrations.
- Neutral/MQ light/dark screenshots show no unapproved geometry, wrapping, or
  contrast changes.
- Alias removal and release/publish remain explicit later decisions.
