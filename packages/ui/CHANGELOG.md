# @brightweblabs/ui

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

## 0.3.1

### Patch Changes

- Fix PasswordInput visibility toggle positioning inside the input.

## 0.3.0

### Minor Changes

- 6923aeb: Update latest Next release.

## 0.2.0

### Minor Changes

- dd6fddd: Refactor package boundaries across the workspace and align the preview sandbox setup.

  - add explicit `@brightweblabs/core-auth/shared` exports and remove the root `core-auth` barrel in favor of canonical `shared`, `client`, and `server` entrypoints
  - add UI subpath exports and update first-party consumers to import directly from those package entrypoints
  - simplify app-shell navigation primitives and refresh the platform preview sandbox copy to reflect its internal sandbox role
  - update `create-bw-app` templates and generator metadata to match the new preview app and package import surfaces

## 0.1.1

### Patch Changes

- ec7ca19: Minor changes to all modules.

## 0.1.0

### Minor Changes

- Initial public release of the BrightWeb Labs platform packages.
