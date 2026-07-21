# @brightweblabs/app-shell

## 0.4.0

### Minor Changes

- 798e75f: Add pure, typed shell registration override helpers and resolve overlapping toolbar routes by specificity, including dynamic path segments. The matcher fix can change toolbar selection for apps that relied on the previous order-dependent resolution.
- 80b69b1: Retokenize shell controls, navigation, borders, fills, hover states, and typography against the shared theme contract. This is a visual change for consumers that relied on the previous hardcoded black and white alpha styling.

### Patch Changes

- 090bc48: Align workspace UI consumers with the Lucide 1.x peer range required by `@brightweblabs/ui` 1.0.
- 3c0d84b: Remove the unused `next-themes` dependency from the app shell package.
- Updated dependencies [80b69b1]
- Updated dependencies [2bb53ad]
- Updated dependencies [090bc48]
  - @brightweblabs/ui@1.0.0

## 0.3.1

### Patch Changes

- Updated dependencies [cc8cfaa]
  - @brightweblabs/ui@0.4.0

## 0.3.0

### Minor Changes

- 6923aeb: Update latest Next release.

### Patch Changes

- Updated dependencies [6923aeb]
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
  - @brightweblabs/ui@0.2.0

## 0.1.2

### Patch Changes

- ec7ca19: Minor changes to all modules.
- Updated dependencies [ec7ca19]
  - @brightweblabs/ui@0.1.1

## 0.1.1

### Patch Changes

- a36ed3b: Replace internal workspace protocol dependencies with published version ranges.

## 0.1.0

### Minor Changes

- Initial public release of the BrightWeb Labs platform packages.

### Patch Changes

- Updated dependencies
  - @brightweblabs/ui@0.1.0
