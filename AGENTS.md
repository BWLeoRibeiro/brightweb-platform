# BrightWeb Platform Agent Rules

These rules are project-specific guardrails for working in this repo. They supplement global Codex/GStack behavior and should be followed before making release, publish, CI, or package changes.

## Release And Publish Work

- Read the existing workflows before any release or publish work:
  - `.github/workflows/ci.yml`
  - `.github/workflows/release.yml`
- This repo uses Changesets. Package changes require a changeset.
- If a package was already manually published, add an empty changeset and explain why so release state stays explicit without republishing.
- Do not manually publish npm packages unless the user explicitly asks.
- If manually publishing is requested, verify the npm version before and after publishing, and confirm CI will not republish the same version.

## CI And Verification

- CI gates are:
  - `pnpm release:check`
  - `pnpm check:create-bw-app-templates`
  - `pnpm build`
- Also run `pnpm test` when touching:
  - `create-bw-app` package defaults
  - package versions
  - package manifests
  - update or scaffold behavior
- Run `pnpm check:base-contract` when touching `docs/modules/base-contract*.json`.

## Package And Starter Safety

- Prefer package-native patterns and keep existing public exports stable unless the user explicitly asks for a breaking change.
- Generated starter and package dependency defaults must stay aligned with published npm versions and tests.
- Keep release automation, package manifests, starter templates, and test expectations in sync.

## Worktree Hygiene

- Keep unrelated dirty worktree changes separate unless the user explicitly says to commit all changes.
- Do not fold unrelated local edits into release, publish, or package-version work.
