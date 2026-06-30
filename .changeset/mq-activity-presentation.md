---
"@brightweblabs/ui": minor
"@brightweblabs/module-projects": minor
"@brightweblabs/module-crm": minor
---

Share the MQ Consulting activity-feed presentation across packages, with
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
