# @brightweblabs/infra

## 0.3.0

### Minor Changes

- 7a2c7b2: Promote `@brightweblabs/infra/server` as the canonical app-owned Resend transport by adding stable webhook signature verification and retaining typed Resend errors.

  Update `create-bw-app` platform scaffolds to:

  - generate expanded Resend/marketing environment keys
  - include a local `lib/email/resend-base.ts` adapter that re-exports from `@brightweblabs/infra/server`
  - scope Resend readiness checks to admin-enabled stacks and require sender/webhook coverage instead of only `RESEND_API_KEY`

## 0.2.2

### Patch Changes

- 097992c: Align the published BrightWeb package line for platform scaffolds and move Supabase env validation to lazy runtime factories in infra.

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
