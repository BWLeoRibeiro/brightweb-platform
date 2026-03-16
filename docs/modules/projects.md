# Projects Module

The Projects module extends the platform with work-management data and project access rules. It depends on CRM because projects are attached to organizations, and it inherits the Admin and RBAC layer through that dependency chain.

## What schema it installs

- `projects` as the main project record table.
- `project_members` for project team membership and role scope.
- `project_milestones` and `project_tasks` for work-tracking structure.
- `project_links` and `project_status_log` for supporting resources and status history.
- Later migrations tighten team and observer RLS, organization-access contracts, lifecycle fields, and project activity payload behavior.

## What package and domain logic it provides

- `@brightweblabs/module-projects` exports shell registration for project navigation and toolbar behavior.
- It exports server-side portfolio helpers such as project listing, project stats, and schema-missing detection behavior.
- The package reads shared CRM-owned organization data and shared profile/auth state to assemble project views.

## Whether it adds starter routes and wiring

| Area | Current behavior |
| --- | --- |
| Scaffold wiring | Selecting Projects adds the package dependency and enables project-related shell/config wiring in generated platform apps. |
| Starter routes | The current module template contributes the `/playground/projects` starter surface in the scaffold. |
| Shell behavior | The module registration adds project navigation items and project-specific toolbar surfaces. |

> Projects does **not** install a full project management frontend product into client apps. It mainly installs shared schema, access rules, and server and domain contracts that client apps build on top of.

## Related docs

- [Modules](./README.md)
- [CRM](./crm.md)
- [UI vs Domain Modules](../ui-vs-domain-modules.md)

## Repo sources

- `supabase/modules/projects/migrations`
- `packages/module-projects/src/index.ts`
- `packages/module-projects/src/registration.ts`
- `packages/create-bw-app/template/modules/projects`
- `supabase/module-registry.json`
