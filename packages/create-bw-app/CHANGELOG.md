# create-bw-app

## 0.9.1

### Patch Changes

- 5a4d6bf: Add a `create-bw-app update` subcommand that updates installed `@brightweblabs/*` packages in an existing app, re-syncs managed BrightWeb config files, reports starter-file drift, and optionally refreshes starter routes or runs install.

## 0.9.0

### Minor Changes

- 2adbe49: Expand the CRM package from a starter dashboard helper into a broader stable base contract with reusable CRM list and stats helpers, package-owned GET handlers, mounted CRM starter routes, structured base-contract manifests, and updated docs for the new supported CRM surfaces.

### Patch Changes

- d1fe3af: Generate `.env.local` for platform starters instead of `.env.example`, move generated brand and module state into `config/brand.ts` and `config/modules.ts`, and update the scaffold docs to match the new config ownership model.

## 0.8.0

### Minor Changes

- 7527b84: Stop generating `.env.local` in platform app scaffolds and keep `.env.example` as the single generated environment template. Update the generated starter copy and docs to instruct developers to copy `.env.example` to `.env.local` when they need local credentials or overrides.
- 7527b84: Refresh the Brightweb database scaffold to use a clean v1 module baseline instead of carrying legacy transitional migration history. Remove BeGreen-specific database references from the generated platform surfaces and align the repo docs with Brightweb-owned forward migration history.

## 0.7.0

### Minor Changes

- a94eabd: Updated to generate proper DB schema/migrations in the proper folders.

## 0.6.0

### Minor Changes

- 4053ddd: Refresh the generated starters to the current Next.js baseline, align starter design tokens across the site and platform templates, and add Tailwind CSS support to the platform starter.

## 0.5.0

### Minor Changes

- 6923aeb: Update latest Next release.

## 0.4.0

### Minor Changes

- dd6fddd: Refactor package boundaries across the workspace and align the preview sandbox setup.

  - add explicit `@brightweblabs/core-auth/shared` exports and remove the root `core-auth` barrel in favor of canonical `shared`, `client`, and `server` entrypoints
  - add UI subpath exports and update first-party consumers to import directly from those package entrypoints
  - simplify app-shell navigation primitives and refresh the platform preview sandbox copy to reflect its internal sandbox role
  - update `create-bw-app` templates and generator metadata to match the new preview app and package import surfaces

## 0.3.0

### Minor Changes

- 27d13af: Rename the public CLI package from `create-brightweblabs` to `create-bw-app` and update the executable, docs, and local wrapper references.

## 0.2.0

### Minor Changes

- 18dc438: Add the publishable `create-bw-app` CLI package for scaffolding new BrightWeb client apps.
