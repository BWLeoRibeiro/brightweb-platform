# Modules

BrightWeb modules extend the platform through shared schema, domain logic, package helpers, shell registrations, and light starter wiring. The public promise for those modules is the **base contract** documented in this section.

> The shared modules are primarily schema and domain modules. Applications built on BrightWeb are still expected to build their own product UI on top of the stable base contract and replace starter scaffolding as needed.

## Read this section with the right mental model

The `platform` template has two layers:

- the platform base, which always resolves to the `Core + Admin` database baseline
- optional starter surfaces and package wiring, which may add `admin`, `crm`, and `projects`

Selecting `admin` in the scaffold affects the Admin starter UI and package wiring. It does not remove the Admin database baseline from platform mode.

## Support tiers

The current base contract uses three support tiers:

- `stable`: supported base surface intended for reuse across projects
- `starter`: starter-facing convenience surface that proves the module is wired and can be replaced later
- `internal`: exported or repo-visible surface that is not part of the supported public promise

Use [Base Contract](./base-contract.md) for the canonical support-tier rules and [base-contract.json](./base-contract.json) for the machine-readable inventory.

## Module overview

| Area | What it owns | What scaffold selection changes | Full UI |
| --- | --- | --- | --- |
| Platform Base | Core auth/profile foundations plus the Admin-backed database baseline that platform apps depend on. | Every `platform` app gets this runtime and database baseline. | No. It is the base runtime, not a finished product surface. |
| Admin | Governance helpers, RBAC package wiring, and the optional Admin starter surface. | Selecting `admin` adds the Admin package wiring and starter routes such as `/playground/admin`. | No. It is a starter governance surface, not a full admin product. |
| CRM | `organizations`, `organization_members`, `crm_contacts`, `crm_status_log`, `organization_invitations`, plus follow-up CRM constraints and helpers. | Selecting `crm` adds package wiring, shell registration, env flags, and `/playground/crm`. | No. Product-specific CRM UI remains app-owned. |
| Projects | `projects`, `project_members`, `project_milestones`, `project_tasks`, `project_links`, `project_status_log`, plus follow-up access and activity behavior. | Selecting `projects` adds package wiring, shell registration, env flags, and `/playground/projects`. | No. It does not install a full project management frontend on its own. |

## Pages in this section

- [Base Contract](./base-contract.md): support tiers, extension rules, and the canonical contract inventory.
- [Using BrightWeb Modules](./using-modules.md): integration entrypoints, code-level usage patterns, and current package contracts.
- [Platform Base](./platform-base.md)
- [CRM](./crm.md): CRM-owned schema, runtime wiring, and CRM package behavior.
- [Projects](./projects.md): Projects-owned schema, runtime wiring, and project package behavior.

## What module selection affects in the scaffold

- generated package dependencies
- copied starter playground and API files from the module template folders
- generated `next.config.ts`, env flags, and shell/config wiring for enabled packages
- the client database stack plan when you scaffold in workspace mode

## Related docs

- [Getting Started](../foundations/README.md)
- [Base Contract](./base-contract.md)
- [Using BrightWeb Modules](./using-modules.md)
- [Examples and Recipes](../recipes/README.md)

## Implementation references

- `packages/create-bw-app/src/generator.mjs`
- `packages/create-bw-app/template/modules`
- `packages/module-admin/src`
- `packages/module-crm/src`
- `packages/module-projects/src`
- `supabase/module-registry.json`
- `supabase/modules/admin/migrations`
- `supabase/modules/crm/migrations`
- `supabase/modules/projects/migrations`
