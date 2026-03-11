# create-bw-app

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
