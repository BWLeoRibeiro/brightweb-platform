# Projects Module

The Projects module extends the platform with work-management data and project access rules. It depends directly on Organizations because projects are attached to organizations; it no longer requires CRM.

> Projects builds on top of the Core + Admin + Organizations platform baseline; selecting Projects auto-includes Organizations without CRM.

Use [Base Contract](./base-contract.md) for the support-tier rules and [base-contract.json](./base-contract.json) for the canonical symbol inventory.

## What schema it installs

- Baseline tables: `projects`, `project_members`, `project_milestones`, `project_tasks`, `project_links`, and `project_status_log`
- Follow-up migrations: explicit participating organizations, client audiences, client-safe content, lifecycle fields, staff-only internal RLS, project activity payload behavior, same-project task/milestone enforcement, and deliberately authored member-task collaboration

## What package and domain logic it provides

| Concern | Current behavior |
| --- | --- |
| Projects package | `@brightweblabs/module-projects` exports stable portfolio, dashboard, detail, mutation, and shell registration helpers. |
| Server helpers | The package covers atomic project setup, app-owned project CRUD, task/milestone/link management, assignable-profile lookup, member sync, explicit client access, and narrow client-safe reads. |
| Shared contracts | The package exports reusable project lifecycle, membership, visibility, client-access, and client-facing DTO contracts plus validation guards for app-owned forms. |

## Whether it adds starter routes and wiring

| Concern | Current behavior |
| --- | --- |
| Scaffold wiring | Selecting Projects adds the package dependency and enables project-related shell/config wiring in generated platform apps. |
| Package mounts | `@brightweblabs/module-projects/ui` exports package-owned portfolio and detail surfaces. `@brightweblabs/module-projects/routes` assembles authenticated server route pages, and `@brightweblabs/module-projects/route-handlers` exports thin Next.js-compatible HTTP adapters. |
| Shell behavior | The package exports registration plus independent Projects toolbar controls for host-owned shell layouts. |
| Dependency behavior | Projects resolves on top of Core + Admin + Organizations; CRM is not installed unless explicitly selected. |

> The package UI is route-agnostic. The platform scaffold mounts it at `/projetos` and mounts the client-safe project area at `/account/projetos`; host apps may own or replace those starter routes.

## Supported base contract

The current Projects contract splits reusable shared contracts, reusable server helpers, and starter-facing page assembly.

### Shared contracts

- `@brightweblabs/module-projects`: `PROJECT_STATUSES`, `PROJECT_HEALTH_STATES`
- `@brightweblabs/module-projects`: `PROJECT_CLIENT_ACCESS_MODES`, `PROJECT_MILESTONE_VISIBILITIES`
- `@brightweblabs/module-projects`: `PROJECT_MEMBER_ROLES`, `PROJECT_MEMBER_ROLE_LABELS_PT`
- `@brightweblabs/module-projects`: `TASK_STATUSES`, `TASK_PRIORITIES`
- `@brightweblabs/module-projects`: `MILESTONE_STATUSES`
- `@brightweblabs/module-projects`: `PROJECT_LINK_VISIBILITY`, `PROJECT_LINK_KIND`
- `@brightweblabs/module-projects`: `isProjectStatus()`, `isProjectHealth()`, `isTaskStatus()`, `isTaskPriority()`
- `@brightweblabs/module-projects`: `isMilestoneStatus()`, `isProjectMemberRole()`, `isProjectLinkVisibility()`, `isProjectLinkKind()`
- `@brightweblabs/module-projects`: `parsePositiveInt()`

### Server helpers

- `@brightweblabs/module-projects`: `listProjects()`, `getProjectPortfolioStats()`
- `@brightweblabs/module-projects`: `getProjectDashboard()` for internal staff workspaces
- `@brightweblabs/module-projects`: `listClientProjects()`, `getClientProject()` for client-safe account routes
- `@brightweblabs/module-projects`: `getProjectClientAccess()`, `updateProjectClientAccess()`, `updateProjectOrganizations()`
- `@brightweblabs/module-projects`: `createProjectWithAccess()`, `listProjectSetupOptions()`
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

### Package UI

- `@brightweblabs/module-projects/ui`: `ProjectsPage`, `ProjectDetailPage`, and client account project routes
- `@brightweblabs/module-projects/ui`: `createProjectsUiClient()`, `ProjectsUiProvider`
- `@brightweblabs/module-projects/ui`: `ProjectsToolbarControls`, `defaultProjectsUiDictionary`

### Route assembly

- `@brightweblabs/module-projects/routes`: `ProjectsRoutePage`, `ProjectDetailRoutePage`, `ProjectBoardRoutePage`, and `ProjectTasksRoutePage`
- `@brightweblabs/module-projects/routes`: Portuguese scaffold adapters `ProjectsPortugueseRoutePage`, `ProjectDetailPortugueseRoutePage`, `ProjectBoardPortugueseRoutePage`, and `ProjectTasksPortugueseRoutePage`
- The generic route pages accept a `ProjectsNavigationConfig`; the Portuguese adapters use the generated `/projetos` route family.
- These server components enforce `admin` or `staff` page access and load the package-owned portfolio or project dashboard data before rendering the UI.

### Route-handler adapters

`@brightweblabs/module-projects/route-handlers` provides thin adapters for the generated Next.js route files. They cover:

- project lists, creation, statistics, setup options, and organization creation;
- project detail reads, updates, deletion, activity, members, organizations, and client-access configuration;
- task, milestone, and link creation, updates, and deletion;
- client-safe project list and detail reads;
- member-task configuration, publication and review, plus narrow member task reads and actions.

Use these adapters when the host route should be a direct package re-export. Import the lower-level `handle*Request()` functions from the package root when the app needs to compose additional request behavior.

### Internal

- `@brightweblabs/module-projects`: `isProjectsSchemaMissingError()`

## How to use it in an app

Generated apps mount the package-owned route pages and task UI. Use the portfolio helpers for app-owned lists, the dashboard helpers for internal detail pages, and the mutation helpers for custom write flows.

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
import { requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";

export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const { supabase } = await requireServerPageRoleAccess(["admin", "staff"]);
  const { getProjectDashboard } = await import("@brightweblabs/module-projects");
  const data = await getProjectDashboard(supabase, params.projectId);

  return <pre>{JSON.stringify(data.project, null, 2)}</pre>;
}
```

Use `getProjectDashboard()` only for authenticated internal workspaces. It always returns the internal dashboard; the legacy `clientVisibleOnly` argument is rejected rather than attempting an unsafe partial projection. Client routes must use `listClientProjects()` and `getClientProject()`, which read the dedicated database RPCs and return the narrow client DTO. Do not derive a client response from the full dashboard object.

### Client project access model

Projects distinguish participation from visibility:

- `project_organizations` records every organization involved in the project.
- `project_client_organizations` records the organizations selected for client access.
- `project_client_profiles` narrows selected-client mode to named client profiles.
- `project_members` is internal-only and accepts staff or administrators, never clients.

New projects default to hidden. The atomic setup flow creates the project, participating organizations, internal team, owner, client-safe content, and client audience in one idempotent database transaction. Owners and global administrators can later edit the audience under the project access surface.

Client responses may include the project reference, lifecycle, dates, client summary and scope, internal responsible contact, client-visible metas, and client-visible document links. They never include the internal summary, internal tasks, team assignments, notes, costs, activity, audit data, or internal files. Deliberately published member tasks use their own narrow task APIs; they are not a projection of the internal dashboard. Current and upcoming client work is derived from client-visible `project_milestones`; there is no separate free-text next-steps field.

The API and database enforce the boundary independently of the UI. Mount the shared handlers for `/api/account/projects`, `/api/account/projects/:id`, project setup options, participating organizations, and client-access configuration; hiding an internal component is not an authorization control.

### Unified tasks and member collaboration

The shared task panel combines internal and member tasks. In creation, `Tarefa para` selects `Equipa interna` or `Membros da organização` before `Responsável (opcional)`. The assignee list follows that choice; changing the recipient type clears incompatible assignment, and an existing task's type stays locked.

UI terminology uses members for people accessing the portal. Existing `client` role identifiers, database names and API paths remain unchanged. Organization membership and project audience are separate from the internal `project_members` team.

- Existing tasks remain internal. Creating a member task does not turn a private internal task into shared content.
- A member task starts as a private draft. Saving and publishing are separate actions; editing published configuration withdraws it until it is explicitly published again.
- Access requires current project access and eligibility in the chosen organization and task audience. Selecting a responsible person grants no additional access.
- Eligible members can start a published task and submit a versioned response. Authorized staff review the exact submission version; returning it requires feedback. Withdrawal invalidates the current review while retaining submission history.
- Use package-provided capabilities for available actions. Combining the panels does not expand project, task, milestone, member-management or publication permissions.

The package exports `listClientProjectTasks()`, `actOnClientProjectTask()`, `getProjectClientTaskWorkbench()` and `manageProjectClientTask()`. Mount their shared HTTP handlers through:

| Route | Actions |
| --- | --- |
| `/api/projects/:id/client-tasks` | Staff workbench reads and member-task creation. |
| `/api/projects/:id/client-tasks/:taskId` | Authorized configuration, publication, withdrawal and submission review. |
| `/api/account/projects/:id/tasks` | Narrow reads of currently accessible member tasks. |
| `/api/account/projects/:id/tasks/:taskId` | Capability-checked member task actions. |

Keep these handlers and the database RPC checks as the authorization boundary. Do not give members internal task mutation handlers or the full project dashboard.

### Existing-app rollout

The legacy client-access staging boundary is `20260811121700_project_client_meta_preview.sql`. It includes the preceding enforcement migration, the narrow client-owned organization projection, and bounded client-visible meta previews while retaining the legacy next-steps SQL output for staged compatibility. Do not stop at the earlier expand migration: that leaves the fail-closed content and audience enforcement pending. This staging boundary is not the complete schema required by the current member-task UI.

1. For an existing app still before the destructive cleanup, prepare the shared packages and routes and materialize the legacy staging boundary explicitly:

   ```bash
   bw upgrade projects --through-migration 20260811121700_project_client_meta_preview.sql --refresh-starters --install
   ```

2. Review and apply the generated foundation, expand, member-sync hardening, and enforcement migrations in the same database rollout window. Keep a compatible intermediate application deployment while cleanup is deferred; do not deploy the current member-task UI against only this legacy boundary. Verify staff project editing and client-safe account reads before advancing the rollout.
3. Before cleanup, snapshot legacy `project_members` and project owners, identify external members or owners that will be removed or cleared, and confirm every active project has the intended internal owner.
4. Only after the upgraded readers and writers are live, explicitly materialize the destructive identity cleanup and the removal of the legacy `client_next_steps` column, review their SQL, and apply them:

   ```bash
   bw upgrade projects --include-destructive-migrations
   ```

5. Before deploying the current task UI, review and apply the remaining forward migrations through `20261015143936_client_task_collaboration.sql`, together with the required Core, Admin and Organizations identity migrations. The package fails closed when the required database contract is missing. The preceding task/milestone migration rejects invalid existing cross-project links; investigate and review any data repair separately rather than editing released SQL or silently discarding relationships. Verify internal-task isolation, explicit publication, member submission and staff review against the completed schema.

If cleanup is not approved, leave it deferred. An ordinary upgrade stops before the first pending destructive migration and reports the held boundary. Do not advance a recorded cursor past unapplied SQL or treat the legacy staging boundary as proof that current member-task operations are ready.

### Register Projects in the app shell

```ts
import { projectsModuleRegistration } from "@brightweblabs/module-projects/registration";
```

Wire that registration into your app shell when you want the Projects navigation item plus project-specific toolbar surfaces.

### Mount the package-owned project UI

```tsx
import { ProjectsPage } from "@brightweblabs/module-projects/ui";
import "@brightweblabs/module-projects/tokens.css";

export default function ProjectsRoute() {
  return <ProjectsPage initialData={initialData} organizations={organizations} />;
}
```

Pass a `ProjectsUiClient` to use non-default endpoints or local preview data. `ProjectDetailPage` accepts the same client plus `initialData`, host-derived permissions, configurable navigation, and composition slots.

### Mount package-owned server routes

Generated Portuguese routes can directly re-export the packaged adapters:

```tsx
export { ProjectsPortugueseRoutePage as default } from "@brightweblabs/module-projects/routes";
```

For a different route family, pass host-owned navigation to a generic route page:

```tsx
import { ProjectsRoutePage } from "@brightweblabs/module-projects/routes";

export default function ProjectsRoute() {
  return <ProjectsRoutePage navigation={{
    listHref: "/projects",
    detailHrefPattern: "/projects/:projectId",
    boardHrefPattern: "/projects/:projectId/board",
  }} />;
}
```

Generated API routes similarly re-export one or more adapters from `@brightweblabs/module-projects/route-handlers`, keeping authorization and response behavior in the package.

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
- `packages/module-projects/src/routes.tsx`
- `packages/module-projects/src/route-handlers.ts`
- `packages/create-bw-app/template/modules/projects`
- `supabase/module-registry.json`
