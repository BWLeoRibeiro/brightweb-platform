# @brightweblabs/module-orgs

## 0.3.0

### Minor Changes

- b0362c3: Ship the consolidated platform surface release: shell navigation, dashboard,
  theme switching, branded status pages, packaged authentication and invitation
  flows, Admin, CRM, Projects, and organization persistence. Add tokenized Geist
  typography, shared UI primitives, MQ parity, and accessibility and robustness
  hardening across those surfaces.

### Patch Changes

- Updated dependencies [b0362c3]
- Updated dependencies [b0362c3]
  - @brightweblabs/app-shell@0.6.0
  - @brightweblabs/core-auth@0.4.0
  - @brightweblabs/infra@0.3.2

## 0.2.3

### Patch Changes

- Updated dependencies [1a86493]
  - @brightweblabs/app-shell@0.5.0

## 0.2.2

### Patch Changes

- @brightweblabs/app-shell@0.4.1

## 0.2.1

### Patch Changes

- 775366c: Republish with resolved dependency ranges. 0.2.0 was published manually (npm publish) which bypassed workspace-protocol rewriting, shipping a literal `workspace:*` dependency on @brightweblabs/app-shell that is unresolvable for consumers. No code changes.

## 0.2.0

### Minor Changes

- e7a7b89: Extract organizations, membership, invitations, and shared helpers into the organizations foundation module. Preserve the CRM organization-list alias and make CRM and Projects auto-resolve Organizations without forcing Projects to install CRM.

### Patch Changes

- 3c0d84b: Align Supabase SSR and the shared Supabase client dependency across infrastructure, auth, and domain packages to avoid duplicate cookie implementations and incompatible client types.
- 3c0d84b: Complete module database ownership metadata, including cross-module integration objects, and align declared core compatibility with the published catalog.
- Updated dependencies [090bc48]
- Updated dependencies [798e75f]
- Updated dependencies [3c0d84b]
- Updated dependencies [80b69b1]
  - @brightweblabs/app-shell@0.4.0
