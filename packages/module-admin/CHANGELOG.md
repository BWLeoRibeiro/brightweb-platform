# @brightweblabs/module-admin

## 0.3.5

### Patch Changes

- @brightweblabs/ui@1.0.1
- @brightweblabs/app-shell@0.4.1

## 0.3.4

### Patch Changes

- 741ffec: Ship the BrightWeb v1 module manifest with the admin package.
- 090bc48: Align workspace UI consumers with the Lucide 1.x peer range required by `@brightweblabs/ui` 1.0.
- 3c0d84b: Complete module database ownership metadata, including cross-module integration objects, and align declared core compatibility with the published catalog.
- Updated dependencies [80b69b1]
- Updated dependencies [3c0d84b]
- Updated dependencies [090bc48]
- Updated dependencies [2bb53ad]
- Updated dependencies [798e75f]
- Updated dependencies [3c0d84b]
- Updated dependencies [80b69b1]
- Updated dependencies [090bc48]
  - @brightweblabs/ui@1.0.0
  - @brightweblabs/infra@0.3.1
  - @brightweblabs/core-auth@0.3.4
  - @brightweblabs/app-shell@0.4.0

## 0.3.3

### Patch Changes

- Updated dependencies [cc8cfaa]
  - @brightweblabs/ui@0.4.0
  - @brightweblabs/app-shell@0.3.1

## 0.3.2

### Patch Changes

- Updated dependencies [7a2c7b2]
  - @brightweblabs/infra@0.3.0
  - @brightweblabs/core-auth@0.3.3

## 0.3.1

### Patch Changes

- Updated dependencies [097992c]
  - @brightweblabs/core-auth@0.3.2
  - @brightweblabs/infra@0.2.2

## 0.3.0

### Minor Changes

- 6923aeb: Update latest Next release.

### Patch Changes

- Updated dependencies [6923aeb]
  - @brightweblabs/app-shell@0.3.0
  - @brightweblabs/core-auth@0.3.0
  - @brightweblabs/infra@0.2.0
  - @brightweblabs/ui@0.3.0

## 0.2.0

### Minor Changes

- dd6fddd: Refactor package boundaries across the workspace and align the preview sandbox setup.

  - add explicit `@brightweblabs/core-auth/shared` exports and remove the root `core-auth` barrel in favor of canonical `shared`, `client`, and `server` entrypoints
  - add UI subpath exports and update first-party consumers to import directly from those package entrypoints
  - simplify app-shell navigation primitives and refresh the platform preview sandbox copy to reflect its internal sandbox role
  - update `create-bw-app` templates and generator metadata to match the new preview app and package import surfaces

### Patch Changes

- Updated dependencies [dd6fddd]
  - @brightweblabs/core-auth@0.2.0
  - @brightweblabs/ui@0.2.0
  - @brightweblabs/app-shell@0.2.0

## 0.1.2

### Patch Changes

- ec7ca19: Minor changes to all modules.
- Updated dependencies [ec7ca19]
  - @brightweblabs/app-shell@0.1.2
  - @brightweblabs/core-auth@0.1.2
  - @brightweblabs/infra@0.1.1
  - @brightweblabs/ui@0.1.1

## 0.1.1

### Patch Changes

- a36ed3b: Replace internal workspace protocol dependencies with published version ranges.
- Updated dependencies [a36ed3b]
  - @brightweblabs/app-shell@0.1.1
  - @brightweblabs/core-auth@0.1.1

## 0.1.0

### Minor Changes

- Initial public release of the BrightWeb Labs platform packages.

### Patch Changes

- Updated dependencies
  - @brightweblabs/app-shell@0.1.0
  - @brightweblabs/core-auth@0.1.0
  - @brightweblabs/infra@0.1.0
  - @brightweblabs/ui@0.1.0
