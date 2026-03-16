# Projects Module

The Projects module extends the platform with work-management data and project access rules. It depends on CRM because projects are attached to organizations, and it inherits the Admin and RBAC layer through that dependency chain.

> Projects builds on top of the `Core + Admin + CRM` platform baseline; selecting Projects adds Projects-owned schema, package wiring, and the starter projects surface.

Use [Base Contract](./base-contract.md) for the support-tier rules and [base-contract.json](./base-contract.json) for the canonical symbol inventory.

## What schema it installs

- Baseline tables: `projects`, `project_members`, `project_milestones`, `project_tasks`, `project_links`, and `project_status_log`
- Follow-up migrations: tighter team and observer RLS, organization-access contracts, lifecycle fields, and project activity payload behavior

## What package and domain logic it provides

| Concern | Current behavior |
| --- | --- |
| Projects package | `@brightweblabs/module-projects` exports shell registration for project navigation and toolbar behavior. |
| Server helpers | The package exports server-side portfolio helpers such as project listing, project stats, and schema-missing detection behavior. |
| Shared dependencies | The package reads shared CRM-owned organization data and shared profile/auth state to assemble project views. |

## Whether it adds starter routes and wiring

| Concern | Current behavior |
| --- | --- |
| Scaffold wiring | Selecting Projects adds the package dependency and enables project-related shell/config wiring in generated platform apps. |
| Starter routes | The current module template contributes the `/playground/projects` starter surface in the scaffold. |
| Shell behavior | The module registration adds project navigation items and project-specific toolbar surfaces. |
| Dependency behavior | Projects resolves on top of the existing `Core + Admin + CRM` platform baseline because projects are attached to organizations and inherit that dependency chain. |

> Projects does **not** install a full project management frontend product on its own. It mainly installs shared schema, access rules, and server and domain contracts that applications build on top of.

## Supported base contract

The current Projects contract splits reusable portfolio primitives from starter-facing page assembly.

### Stable

- `@brightweblabs/module-projects`: `listProjects()`
- `@brightweblabs/module-projects`: `getProjectPortfolioStats()`
- `@brightweblabs/module-projects/registration`: `projectsModuleRegistration`

### Starter

- `@brightweblabs/module-projects`: `getProjectsPortfolioPageData()`

### Internal

- `@brightweblabs/module-projects`: `isProjectsSchemaMissingError()`

## How to use it in an app

The current Projects package is mainly consumed through server helpers plus shell registration.

### Load portfolio data in a server page

```tsx
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const { getProjectsPortfolioPageData } = await import("@brightweblabs/module-projects");
  const data = await getProjectsPortfolioPageData();

  return <pre>{JSON.stringify(data.portfolioStats, null, 2)}</pre>;
}
```

Use `getProjectsPortfolioPageData()` when you want a starter portfolio payload for a page, and use lower-level helpers such as `listProjects()` when you need more custom filtering or pagination behavior.

Treat the portfolio page helper as starter page glue. Build app-owned project surfaces on the lower-level stable helpers when you need a longer-lived contract.

### Register Projects in the app shell

```ts
import { projectsModuleRegistration } from "@brightweblabs/module-projects/registration";
```

Wire that registration into your app shell when you want the Projects navigation item plus project-specific toolbar surfaces.

### Build application-owned project UI

The package gives you shared schema, access rules, and server-side data helpers. The actual portfolio screens, detail pages, boards, forms, and workflow UI remain application-owned.

## How To Build On This

- Build on `stable` helpers such as `listProjects()` and `getProjectPortfolioStats()` for app-owned project pages and flows.
- Use `getProjectsPortfolioPageData()` when you want the current starter portfolio screen quickly.
- Do not depend on `isProjectsSchemaMissingError()` for app-owned contracts; it is internal fallback logic for the current starter helper.

For a broader integration overview, see [Using BrightWeb Modules](./using-modules.md).

## Related docs

- [Modules](./README.md)
- [Base Contract](./base-contract.md)
- [Using BrightWeb Modules](./using-modules.md)
- [CRM](./crm.md)
- [Platform Base](./platform-base.md)

## Implementation references

- `supabase/modules/projects/migrations`
- `packages/module-projects/src/index.ts`
- `packages/module-projects/src/registration.ts`
- `packages/create-bw-app/template/modules/projects`
- `supabase/module-registry.json`
