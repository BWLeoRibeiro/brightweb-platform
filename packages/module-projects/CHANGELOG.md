# @brightweblabs/module-projects

## 0.3.0

### Minor Changes

- Expand the projects module with full server-side project APIs (dashboard/detail retrieval, create/update/delete flows, tasks, milestones, links, member sync and assignable members) so consuming apps can drop duplicated local projects service layers.
- Add dedicated `contracts`, `types`, and `server` export entrypoints for module-only consumption in app code.

### Patch Changes

- Keep project queries safe for deployments where `public.profiles.phone` is absent by using phone-safe profile selects across the expanded server API.
- Switch package dependencies to published semver ranges so apps can consume the module as a direct package dependency outside the monorepo.

## 0.2.4

### Patch Changes

- 74144ef: Fix project portfolio queries to gracefully handle deployments where `public.profiles.phone` is missing by retrying without phone columns, while keeping `ownerPhone` and `organizationOwnerPhone` in the returned shape.

## 0.2.3

### Patch Changes

- 097992c: Align the published BrightWeb package line for platform scaffolds and move Supabase env validation to lazy runtime factories in infra.
- Updated dependencies [097992c]
  - @brightweblabs/core-auth@0.3.2
  - @brightweblabs/infra@0.2.2

## 0.2.2

### Patch Changes

- Keep the current projects portfolio profile query compatible with the current profile schema (stop exposing profile `phone` fields from project portfolio data when `public.profiles.phone` does not exist) and republish the package against the aligned auth and infra package line.
- Updated dependencies
  - @brightweblabs/core-auth@0.3.1
  - @brightweblabs/infra@0.2.1

## 0.2.1

### Patch Changes

- 1c51e1c: Avoid requiring `public.profiles.phone` in project portfolio queries so the package works with the current core profile schema.

## 0.2.0

### Minor Changes

- 6923aeb: Update latest Next release.

### Patch Changes

- Updated dependencies [6923aeb]
  - @brightweblabs/app-shell@0.3.0
  - @brightweblabs/core-auth@0.3.0
  - @brightweblabs/infra@0.2.0

## 0.1.3

### Patch Changes

- Updated dependencies [dd6fddd]
  - @brightweblabs/core-auth@0.2.0
  - @brightweblabs/app-shell@0.2.0

## 0.1.2

### Patch Changes

- ec7ca19: Minor changes to all modules.
- Updated dependencies [ec7ca19]
  - @brightweblabs/app-shell@0.1.2
  - @brightweblabs/core-auth@0.1.2
  - @brightweblabs/infra@0.1.1

## 0.1.1

### Patch Changes

- a36ed3b: Replace internal workspace protocol dependencies with published version ranges.
- Updated dependencies [a36ed3b]
  - @brightweblabs/app-shell@0.1.1

## 0.1.0

### Minor Changes

- Initial public release of the BrightWeb Labs platform packages.

### Patch Changes

- Updated dependencies
  - @brightweblabs/app-shell@0.1.0
  - @brightweblabs/infra@0.1.0
