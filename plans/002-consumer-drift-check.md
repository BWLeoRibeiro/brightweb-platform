# Plan 002: Add a manifest-aware compatibility drift check

> **Executor instructions:** Implement a non-mutating check. Never edit a
> consumer repository or publish packages.
>
> **Drift check:** `git diff --stat 86a9d12..HEAD -- brightweb-release.json packages/create-bw-app scripts tests docs`

## Status

- **Priority:** P1
- **Effort:** M
- **Risk:** MED
- **Depends on:** Plan 001
- **Category:** DX / migration
- **Planned at:** commit `86a9d12`, 2026-07-29

## Why this matters

Pre-1.0 caret ranges do not cross minor releases, but widening ranges would
admit potentially breaking versions. The repository already has an exact
compatibility set and update planner; the missing bridge is a CI mode that uses
one coherent release set and fails when a consumer is stale.

## Current state

- `brightweb-release.json:1-15` records exact compatible package versions.
- `release:version` runs `sync-compatibility-set.mjs`.
- `update.mjs:83-137` independently requests npm `latest` for each installed
  package.
- `update --dry-run` returns success even when `plan.fileWrites` is non-empty
  (`update.mjs:586-603`).
- `bw doctor --strict` validates local manifest health, not latest compatible
  package drift.

## Scope

**In scope:** create-bw-app CLI parsing/help, update plan/version resolution,
compatibility-set generation, tests, scaffold scripts/docs or a reusable
workflow owned by this repo, and one Changeset.

**Out of scope:** changing all packages to 1.0, widening semver ranges,
Dependabot/Renovate configuration in consumer repos, automatic writes in check
mode, release/publish.

## Steps

1. **Publish one coherent compatibility map atomically.** Sync a validated
   compatibility field into the published `create-bw-app/package.json`, including
   the CLI version. The npm metadata response for one exact CLI version is the
   transport for both tool version and package map; do not fetch a separate raw
   file or assemble compatibility from independent per-package `latest`
   responses. Workspace mode reads the repository `brightweb-release.json`
   without network access.

   **Verify:** tests prove a mixed release set is rejected and a coherent map is
   used for every target version.

2. **Detect stale tooling explicitly.** Require contract version, exact package
   strings, and agreement between npm payload version and the map's CLI version.
   Before declaring an app current,
   distinguish current CLI, stale CLI, registry/network unavailable, and
   incompatible release metadata. Never silently fall back in CI check mode.

   **Verify:** mocked registry tests cover all four states with stable messages.

3. **Add `bw check`.** Compose compatibility drift with the existing
   manifest-aware doctor/upgrade ownership model. Do not use the legacy
   updater's template-byte comparison to decide whether a starter file is
   managed, owned, or skipped. Exit non-zero for required dependency changes,
   manifest-owned managed-file drift, incompatible release-set versions,
   module-config mismatch, or stale CLI. Report deliberately owned/skipped
   starter drift separately. `create-bw-app update --check` may exist as a thin
   compatibility alias only if it delegates to the same implementation.

   Use stable exit categories: current, consumer drift, and tool/metadata
   failure. Reject mutating or stale-fallback flags in check mode. Tests must
   spawn the CLI or reset `process.exitCode` so one case cannot contaminate the
   next.

   **Verify:** check mode leaves filesystem snapshots unchanged and returns
   success only for a current fixture.

4. **Expose a scaffolded adoption path.** Use the pinned local
   `create-bw-app` development dependency from Plan 001. Add a stable package
   script and/or reusable workflow example that runs `bw check`,
   `bw doctor --strict`, and normal consumer tests. Document that existing repos
   need a one-time CI adoption.

   **Verify:** generated README/help contains the exact command and no
   unversioned `latest` invocation.

5. **Add a Changeset for create-bw-app.**

## Verification

- `node --experimental-strip-types --loader ./tests/support/ts-extension-loader.mjs --test tests/create-bw-app-update.test.ts tests/create-bw-app-cli.test.ts`
- `pnpm check:compatibility-set`
- `pnpm check:create-bw-app-templates`
- `pnpm test`
- `pnpm build`

All must exit 0.

## Done criteria

- [ ] `bw check` performs no writes or installs.
- [ ] One compatibility set determines all BrightWeb target versions.
- [ ] Pending managed drift produces a deterministic non-zero exit.
- [ ] Network and stale-tool failures are distinguishable.
- [ ] Manifest-owned, consumer-owned, and skipped files are classified correctly.
- [ ] Existing consumers have a documented one-time adoption command.

## STOP conditions

- Compatibility metadata cannot be fetched atomically.
- The npm registry does not return the chosen package metadata field together
  with the matching CLI version; choose another atomic transport before coding.
- The only implementation would use a floating `latest` CLI in CI.
- The implementation would duplicate `.brightweb` ownership semantics inside
  the legacy updater.
