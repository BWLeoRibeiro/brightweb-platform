# Release verification

A successful compilation proves neither database permissions nor an upgrade of an existing application. CI requires four independent jobs and the `required-verification` aggregate. Missing, skipped, cancelled and failed required jobs cannot produce a successful verification receipt.

## Run locally

Use the package-locked pnpm and Node 24, then `pnpm install --frozen-lockfile`. Install Chromium with `pnpm exec playwright install chromium`. Docker must be running for consumer acceptance.

- `pnpm test`: fast behavior and explicitly structural contracts.
- `pnpm test:database`: disposable PostgreSQL 17 transactions, permission denial, tenant isolation, migration preservation and recovery. No production credentials or external runtime installation.
- `pnpm check:packed-release`: independent full, core-only and site installs, plus installed upgrades of a customized published previous release in both application-local and repository-root migration layouts.
- `pnpm test:runtime`: production build against an explicit stateful fake backend. Unexpected backend routes and browser errors fail. This is wiring and browser behavior evidence, not RLS evidence.
- `pnpm test:consumer`: production build against actual disposable Supabase, applying generated migration files in their delivered order. Synthetic identities exercise real authentication and persisted browser operations.
- `pnpm verify:release`: the complete local release checks. Docker absence is a failure, never a successful skip.

For an existing installed consumer:

```sh
node tests/e2e/consumer-smoke.mjs --consumer-root /path/to/client/apps/portal --migrations-directory /path/to/client/supabase/migrations
```

The four consumer runner files have one canonical implementation under platform `tests/e2e`. Client repositories carry hash-recorded copies so their CI does not require cross-repository credentials or an unpublished package. Refresh them with `node scripts/sync-consumer-verification.mjs /path/to/client --write`; omit `--write` to check parity. The sync command refuses to overwrite local customizations. Client-specific roots and route names stay in the client’s test command, outside those shared files.

The consumer runner overrides backend environment variables for its child build/server; it does not edit client configuration or environment files. Use a clean disposable worktree because Next.js writes build outputs. Never supply production database credentials. Supabase resources have unique project IDs and are removed after success or failure. Invitation fixtures and campaign drafts must not deliver email.

## Interpreting evidence

SQL tests execute the shipped SQL with actual role/JWT sessions; they do not infer authorization from phrases in a migration. UI controller tests use deterministic late responses and clock ticks. Architecture checks remain useful for thin routes, exports and ownership, but are named and treated as structural constraints.

Keep positive fixture assertions as well as negative ones: an empty result does not prove the expected visible records remain. Keep targeted fault probes for high-impact contracts rather than chasing a blanket coverage percentage. Relevant permission, query-filter and timer mutations must cause their corresponding tests to fail.

CI uploads a verification receipt containing the tested source commit, lockfile hash, migration hashes, required job results and workflow URL. It is source verification provenance; it does not claim a deployment or npm publication occurred. Attach deployment identity separately when promoting a release.

## Enforcement

Require `required-verification` on main, including administrators, wherever the repository account supports protected branches. The platform release workflow accepts only successful main CI and explicitly verifies the tested SHA is still current main. Development synchronization uses that SHA even if Changesets changes the current checkout. Divergent development is preserved and reported, never overwritten.

Client CI and its receipt must be active before treating upgrades as automatically accepted. A repository without required checks can still receive an unchecked merge; a Vercel Git-triggered production deployment does not itself wait for GitHub CI. For private client repositories where GitHub rejects branch protection on the account's current plan, enable the supported protection capability or configure a separate tested-commit promotion path before calling production enforcement complete.

Retain human judgment for new product/design decisions and intentionally destructive changes. Routine preservation, install recovery, SQL permissions and critical application regressions belong in these automated gates.

## Repeated installation and recovery

`bw update --install` and `bw upgrade --install` reuse the last successful installation only when the package/lock inputs, package-manager configuration and declared patches still match and installed shared package versions satisfy the app requirements. The optional app-manifest receipt contains hashes, not configuration or credentials. A failed installer clears earlier proof; a retry invokes the installer again. Missing, malformed or mismatched installed package metadata and changed lock/configuration inputs also require installation. This avoids another installer run for an identical completed upgrade without treating a written package manifest as proof of installed dependencies. It does not promise to detect arbitrary corruption of every transitive installed file.


## App-owned pnpm patches during upgrade

Published-mode `bw update` and `bw upgrade` preflight the effective install owner's `patchedDependencies` before package, managed-file, app-manifest or SQL writes, including dry runs and retries whose package requirements were already written. The nearest `pnpm-workspace.yaml` selects that owner; a child lockfile does not hide a parent workspace. Its patch map takes precedence over legacy root `package.json` pnpm settings. A target outside a declared patch selector refuses with recovery instructions. The upgrader preserves patch files and their configuration. It does not infer patch compatibility from a filename, disable patch failures, or port customizations automatically.

When an existing patch selector supports the target version but does not cover its entire dependency range, the plan pins that package requirement to the exact target. This prevents a later resolution from silently moving outside the patch's declared support. A range already covering the full target requirement stays unchanged. This check concerns declared target versions, not arbitrary package-manager overrides, external config injection, patch applicability or proof that customized UI behavior works. Those remain installed-consumer acceptance checks.

A refused app needs a separately reviewed patch adoption: preserve the active patch, compare its old/new package preimages, apply it with the supported pnpm version, and verify the customized behavior against the installed target. If the same patch is proven compatible with both releases, its owner can explicitly approve a finite selector such as `@brightweblabs/module-crm@0.18.4 || 0.18.5`, retaining the same patch path/body. Otherwise recreate the customization using `pnpm patch` and `pnpm patch-commit`. Never select another inactive patch solely because its filename matches the new version. This is an app-owned configuration decision, separate from running the upgrader.

For an older attempt that already wrote dependencies, starter files or forward SQL before installation failed, retain those files, the old lock and patch, and the current migration cursors. After the reviewed compatible patch configuration is ready, rerun the same upgrade with `--install`. Existing exact migration files/cursors are verified and installation is retried; SQL is not removed or appended twice. A rollback instead requires the application's own pre-upgrade file backup; the CLI never guesses which app-owned files to undo. Refusal/recovery tests do not count as successful installed adoption. MQ/BeGreen remain incomplete until their exact candidate passes installation, customization and browser checks.
