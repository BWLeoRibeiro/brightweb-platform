# Modules

Optional modules currently extend the platform mostly through shared schema, domain logic, package helpers, and light starter wiring. They should not be treated as fully packaged frontend products that drop a finished UI into each client app.

> Today the shared modules are mostly **schema and domain modules**. Client apps are still expected to build their own product UI on top of the shared database and package contracts.

## Module overview

| Module | Schema / tables | Package / logic | Starter wiring | Full UI |
| --- | --- | --- | --- | --- |
| CRM | `organizations`, `organization_members`, `crm_contacts`, `crm_status_log`, `organization_invitations` plus follow-up org and contact columns and constraints. | Server data helpers and shell registration via `@brightweblabs/module-crm`. | Module selection affects package wiring, shell registration, env flags, and the `/playground/crm` starter surface. | No. It does not install a full production CRM frontend for the client app. |
| Projects | `projects`, `project_members`, `project_milestones`, `project_tasks`, `project_links`, `project_status_log` plus later activity and access-policy refinements. | Server portfolio and query helpers plus shell registration via `@brightweblabs/module-projects`. | Module selection affects package wiring, shell registration, env flags, and the `/playground/projects` starter surface. | No. It does not install a full ready-made project management product UI. |

## Read the module pages next

- [CRM](./crm.md)
- [Projects](./projects.md)

## What module selection affects in the scaffold

- Generated package dependencies.
- Copied starter playground and API files from the module template folders.
- Generated `next.config.ts` and shell/config wiring for enabled module packages.
- Client stack enablement inside `supabase/clients/<slug>/stack.json` in workspace mode.

## Related docs

- [Foundations](../foundations/README.md)
- [UI vs Domain Modules](../architecture/ui-vs-domain-modules.md)
- [Dependency Resolution](../architecture/dependency-resolution.md)

## Repo sources

- `packages/create-bw-app/src/generator.mjs`
- `packages/create-bw-app/template/modules`
- `packages/module-crm/src`
- `packages/module-projects/src`
- `supabase/modules/crm/migrations`
- `supabase/modules/projects/migrations`
