# @brightweblabs/module-crm

## 0.5.0

### Minor Changes

- 31d7611: Add the complete CRM contact write path, SQL-backed single and bulk funnel status transitions, staff-only HTTP handlers, the status-changed event contract, and scaffolded POST/PATCH routes.
- 2bb53ad: Ship the package-owned default CRM dashboard, focused CRM UI surfaces, domain tokens, route-backed client, and a ready-to-render `/crm` scaffold route.
- e7a7b89: Extract organizations, membership, invitations, and shared helpers into the organizations foundation module. Preserve the CRM organization-list alias and make CRM and Projects auto-resolve Organizations without forcing Projects to install CRM.

### Patch Changes

- 741ffec: Ship the BrightWeb v1 module manifest with the CRM package.
- 3c0d84b: Align Supabase SSR and the shared Supabase client dependency across infrastructure, auth, and domain packages to avoid duplicate cookie implementations and incompatible client types.
- 090bc48: Align workspace UI consumers with the Lucide 1.x peer range required by `@brightweblabs/ui` 1.0.
- 3c0d84b: Complete module database ownership metadata, including cross-module integration objects, and align declared core compatibility with the published catalog.
- f8b2157: Remove the CRM package's unused theme build dependency, trim unused theme CSS subpath exports while preserving the app-level CSS runtime contract, and retire the redundant CRM playground alias from new app scaffolds.
- Updated dependencies [80b69b1]
- Updated dependencies [3c0d84b]
- Updated dependencies [090bc48]
- Updated dependencies [3c0d84b]
- Updated dependencies [2bb53ad]
- Updated dependencies [e7a7b89]
- Updated dependencies [798e75f]
- Updated dependencies [3c0d84b]
- Updated dependencies [80b69b1]
- Updated dependencies [090bc48]
  - @brightweblabs/ui@1.0.0
  - @brightweblabs/infra@0.3.1
  - @brightweblabs/core-auth@0.3.4
  - @brightweblabs/module-orgs@0.2.0
  - @brightweblabs/app-shell@0.4.0

## 0.4.1

### Patch Changes

- 1550f0b: Expose the activity message composers through a dedicated `./activity-messages`
  subpath. The composers (`composeProjectMessage` / `composeCrmMessage`) are pure
  and client-safe, but the package root also re-exports server-only data
  functions, so importing them from the barrel pulled `server-only` into client
  bundles. Import from `@brightweblabs/module-projects/activity-messages` and
  `@brightweblabs/module-crm/activity-messages` in client components instead.

## 0.4.0

### Minor Changes

- cc8cfaa: Share the MQ Consulting activity-feed presentation across packages, with
  language parameterised so each app supplies its own dictionary (pt-PT shipped
  as the default):

  - `@brightweblabs/ui` adds `./activity-format` (framework-free `MsgSeg` /
    `ActivityChange` types plus `formatActivityValue` and `toActivityChanges`,
    both taking injected field labels, person fields, locale and system/boolean
    words) and `./activity-message` (the `ActivityMessage` renderer). Both are
    also re-exported from the package root.
  - `@brightweblabs/module-projects` adds `composeProjectMessage(item, actor,
dict?)` with a `ProjectActivityDictionary` type and the default
    `ptProjectActivityDictionary`, plus `activityActorName`.
  - `@brightweblabs/module-crm` adds `composeCrmMessage(item, actor, dict?)` with
    a `CrmActivityDictionary` type and the default `ptCrmActivityDictionary`.

  Each module renders one written sentence per event (actor → verb → entity →
  change). Apps compose a cross-domain feed by dispatching on the event-type
  prefix to the relevant module composer and rendering the result with
  `ActivityMessage`.

### Patch Changes

- c99a284: Use `count: "exact"` instead of `count: "planned"` when listing CRM contacts
  and organizations and when computing contact status stats, so reported totals
  are accurate rather than Postgres planner estimates. Adopted from the MQ
  Consulting portal.
- Updated dependencies [cc8cfaa]
  - @brightweblabs/ui@0.4.0
  - @brightweblabs/app-shell@0.3.1

## 0.3.4

### Patch Changes

- fd505a0: Improve portal read performance by using planned display counts for CRM and project dashboards/lists, replacing CRM status row aggregation with head-only count queries, and adding read-path indexes to CRM and Projects module migrations.

## 0.3.3

### Patch Changes

- Add composable CRM primary-contact and status-timeline loaders, and refactor the starter dashboard loader to compose the stable CRM helpers.

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

- 2adbe49: Expand the CRM package from a starter dashboard helper into a broader stable base contract with reusable CRM list and stats helpers, package-owned GET handlers, mounted CRM starter routes, structured base-contract manifests, and updated docs for the new supported CRM surfaces.

## 0.2.0

### Minor Changes

- 6923aeb: Update latest Next release.

### Patch Changes

- Updated dependencies [6923aeb]
  - @brightweblabs/app-shell@0.3.0
  - @brightweblabs/core-auth@0.3.0
  - @brightweblabs/infra@0.2.0

## 0.1.4

### Patch Changes

- Updated dependencies [dd6fddd]
  - @brightweblabs/core-auth@0.2.0
  - @brightweblabs/app-shell@0.2.0

## 0.1.3

### Patch Changes

- ec7ca19: Minor changes to all modules.
- Updated dependencies [ec7ca19]
  - @brightweblabs/app-shell@0.1.2
  - @brightweblabs/core-auth@0.1.2
  - @brightweblabs/infra@0.1.1

## 0.1.2

### Patch Changes

- 98baa62: Change the CRM organization tax identifier field from `nif` to `taxIdentifierValue`.

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
