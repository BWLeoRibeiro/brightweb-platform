# Modules

BrightWeb modules extend the platform through shared schema, domain logic, package helpers, shell registrations, and mountable package surfaces. The public promise for those modules is the **base contract** documented in this section.

> Generated apps stay thin. Product UI and reusable behavior belong in the owning package, while app repositories retain settings and direct mounts.

## Read this section with the right mental model

The `platform` template has two layers:

- the platform base, which always resolves to the `Core + Admin` database baseline
- optional package wiring and mounts, which may add Admin, CRM, and Projects; CRM and Projects auto-include the hidden Organizations foundation

Selecting `admin` in the scaffold affects the Admin package mount and wiring. It does not remove the Admin database baseline from platform mode.

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
| Admin | Governance helpers, RBAC package wiring, and package-owned users, roles, invitations, and toolbar UI. | Selecting `admin` adds `/admin/users`, direct package-owned API handler aliases, and the Admin UI token source. | Yes, for the default users and invitations surface. |
| Organizations | Organizations, membership, invitations, and organization access helpers. | Auto-included when CRM or Projects is selected; hidden in navigation. | No. It is a shared domain foundation. |
| CRM | CRM contacts and status logs, plus CRM-to-organizations integration. | Selecting CRM adds package wiring, shell registration, env flags, and `/crm`. | Yes, for the package-owned default dashboard. |
| Projects | `projects`, `project_members`, `project_milestones`, `project_tasks`, `project_links`, `project_status_log`, plus follow-up access and activity behavior. | Selecting `projects` adds package wiring and env flags, but no route or generated nav. | No default UI yet. |

## Pages in this section

- [Base Contract](./base-contract.md): support tiers, extension rules, and the canonical contract inventory.
- [Using BrightWeb Modules](./using-modules.md): integration entrypoints, code-level usage patterns, and current package contracts.
- [Platform Base](./platform-base.md)
- [Organizations](./orgs.md): shared organization schema, membership, and package helpers.
- [CRM](./crm.md): CRM-owned schema, runtime wiring, and CRM package behavior.
- [Projects](./projects.md): Projects-owned schema, runtime wiring, and project package behavior.

## What module selection affects in the scaffold

- generated package dependencies
- copied direct page and API handler mounts from the module template folders
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
- `packages/module-orgs/src`
- `packages/module-projects/src`
- `supabase/module-registry.json`
- `supabase/modules/admin/migrations`
- `supabase/modules/crm/migrations`
- `supabase/modules/orgs/migrations`
- `supabase/modules/projects/migrations`
