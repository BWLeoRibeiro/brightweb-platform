# Projects Module

The Projects module extends the platform with work-management data and project access rules. It depends directly on Organizations because projects are attached to organizations; it no longer requires CRM.

> Projects builds on top of the Core + Admin + Organizations platform baseline; selecting Projects auto-includes Organizations without CRM.

Use [Base Contract](./base-contract.md) for the support-tier rules and [base-contract.json](./base-contract.json) for the canonical symbol inventory.

## What schema it installs

- Baseline tables: `projects`, `project_members`, `project_milestones`, `project_tasks`, `project_links`, and `project_status_log`
- Follow-up migrations: tighter team and observer RLS, organization-access contracts, lifecycle fields, and project activity payload behavior

## What package and domain logic it provides

| Concern | Current behavior |
| --- | --- |
| Projects package | `@brightweblabs/module-projects` exports stable portfolio, dashboard, detail, mutation, and shell registration helpers. |
| Server helpers | The package covers app-owned project CRUD, task/milestone/link management, assignable-profile lookup, member sync, and client-health summaries. |
| Shared contracts | The package exports reusable project status and link/task/milestone constants plus validation guards for app-owned forms. |

## Whether it adds starter routes and wiring

| Concern | Current behavior |
| --- | --- |
| Scaffold wiring | Selecting Projects adds the package dependency and enables project-related shell/config wiring in generated platform apps. |
| Package mounts | None. The scaffold does not create a placeholder route until the package exports default UI. |
| Shell behavior | The package exports an opt-in registration, but the scaffold does not install it while no default Projects route exists. |
| Dependency behavior | Projects resolves on top of Core + Admin + Organizations; CRM is not installed unless explicitly selected. |

> Projects does **not** install a default frontend or generated navigation. It installs shared schema, access rules, and server/domain contracts; add reusable UI to the package before mounting its route and opting into its shell registration.

## Supported base contract

The current Projects contract splits reusable shared contracts, reusable server helpers, and starter-facing page assembly.

### Stable shared contracts

- `@brightweblabs/module-projects`: `PROJECT_STATUSES`, `PROJECT_HEALTH_STATES`
- `@brightweblabs/module-projects`: `PROJECT_MEMBER_ROLES`, `PROJECT_MEMBER_ROLE_LABELS_PT`
- `@brightweblabs/module-projects`: `TASK_STATUSES`, `TASK_PRIORITIES`
- `@brightweblabs/module-projects`: `MILESTONE_STATUSES`
- `@brightweblabs/module-projects`: `PROJECT_LINK_VISIBILITY`, `PROJECT_LINK_KIND`
- `@brightweblabs/module-projects`: `isProjectStatus()`, `isProjectHealth()`, `isTaskStatus()`, `isTaskPriority()`
- `@brightweblabs/module-projects`: `isMilestoneStatus()`, `isProjectMemberRole()`, `isProjectLinkVisibility()`, `isProjectLinkKind()`
- `@brightweblabs/module-projects`: `parsePositiveInt()`

### Stable server helpers

- `@brightweblabs/module-projects`: `listProjects()`, `getProjectPortfolioStats()`
- `@brightweblabs/module-projects`: `getProjectDashboard()`, `getClientProjectHealth()`
- `@brightweblabs/module-projects`: `listProjectTasks()`, `listProjectMilestones()`, `listProjectLinks()`
- `@brightweblabs/module-projects`: `listProjectAssignableProfiles()`, `syncProjectMembers()`
- `@brightweblabs/module-projects`: `createProjectOrganization()`, `createProject()`, `updateProject()`, `deleteProject()`
- `@brightweblabs/module-projects`: `createProjectTask()`, `updateProjectTask()`, `deleteProjectTask()`
- `@brightweblabs/module-projects`: `createProjectMilestone()`, `updateProjectMilestone()`, `deleteProjectMilestone()`
- `@brightweblabs/module-projects`: `createProjectLink()`, `updateProjectLink()`, `deleteProjectLink()`
- `@brightweblabs/module-projects`: `listOrgAdminProjectsByProfile()`
- `@brightweblabs/module-projects/registration`: `projectsModuleRegistration`

### Starter

- `@brightweblabs/module-projects`: `getProjectsPortfolioPageData()`

### Internal

- `@brightweblabs/module-projects`: `isProjectsSchemaMissingError()`

## How to use it in an app

The current Projects package is mainly consumed through server helpers plus shell registration. Use the portfolio helpers for app-owned lists, the dashboard helpers for detail pages, and the mutation helpers for write flows.

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

Treat the portfolio page helper as starter page glue. Build package-owned project surfaces on the lower-level stable helpers before adding a thin app mount.

### Load a project dashboard in a server page

```tsx
import { requireServerPageAccess } from "@brightweblabs/core-auth/server";

export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const { supabase } = await requireServerPageAccess();
  const { getProjectDashboard } = await import("@brightweblabs/module-projects");
  const data = await getProjectDashboard(supabase, params.projectId);

  return <pre>{JSON.stringify(data.project, null, 2)}</pre>;
}
```

Use `getProjectDashboard()` for app-owned detail pages, `getClientProjectHealth()` when you only need the client-facing summary, and the mutation helpers when your app owns the write path.

### Register Projects in the app shell

```ts
import { projectsModuleRegistration } from "@brightweblabs/module-projects/registration";
```

Wire that registration into your app shell when you want the Projects navigation item plus project-specific toolbar surfaces.

### Build application-owned project UI

The package gives you shared schema, access rules, and server-side data helpers. The actual portfolio screens, detail pages, boards, forms, and workflow UI remain application-owned.

## How To Build On This

- Build on `stable` helpers such as `listProjects()`, `getProjectPortfolioStats()`, and `getProjectDashboard()` for app-owned project pages and flows.
- Use the project mutation helpers when your app owns create, edit, delete, and member-assignment flows.
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
