# @brightweblabs/infra

## 0.2.1

### Patch Changes

- Move Supabase env resolution and validation into the client factory functions so published apps do not fail during import-time module evaluation. Keep temporary fallback support for `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` while the package graph converges on the current env names.

## 0.2.0

### Minor Changes

- 6923aeb: Update latest Next release.

## 0.1.1

### Patch Changes

- ec7ca19: Minor changes to all modules.

## 0.1.0

### Minor Changes

- Initial public release of the BrightWeb Labs platform packages.
