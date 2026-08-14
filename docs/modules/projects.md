# Projects Module

The Projects module extends the platform with work-management data and project access rules. It depends directly on Organizations because projects are attached to organizations; it no longer requires CRM.

> Projects builds on top of the Core + Admin + Organizations platform baseline; selecting Projects auto-includes Organizations without CRM.

Use [Base Contract](./base-contract.md) for the support-tier rules and [base-contract.json](./base-contract.json) for the canonical symbol inventory.

## What schema it installs

- Baseline tables: `projects`, `project_members`, `project_milestones`, `project_tasks`, `project_links`, and `project_status_log`
- Follow-up migrations: explicit participating organizations, client audiences, client-safe content, lifecycle fields, staff-only internal RLS, and project activity payload behavior

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
| Package mounts | `@brightweblabs/module-projects/ui` exports package-owned portfolio and detail surfaces; hosts mount them on their preferred routes. |
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

Client responses may include the project reference, lifecycle, dates, client summary and scope, internal responsible contact, client-visible metas, and client-visible document links. They never include the internal summary, tasks, team assignments, notes, costs, activity, audit data, or internal files. Current and upcoming client work is derived from client-visible `project_milestones`; there is no separate free-text next-steps field.

The API and database enforce the boundary independently of the UI. Mount the shared handlers for `/api/account/projects`, `/api/account/projects/:id`, project setup options, participating organizations, and client-access configuration; hiding an internal component is not an authorization control.

### Existing-app rollout

The safe production boundary is `20260811121700_project_client_meta_preview.sql`. It includes the preceding enforcement migration, the narrow client-owned organization projection, and bounded client-visible meta previews while retaining the legacy next-steps SQL output for staged compatibility. Do not stop at the earlier expand migration: that leaves the fail-closed content and audience enforcement pending.

1. Upgrade the consumer with the new `create-bw-app` release and materialize the shared package, routes, and migrations through the enforcement boundary. An ordinary Projects upgrade stops there automatically:

   ```bash
   bw upgrade projects --refresh-starters --install
   ```

2. Review and apply the generated foundation, expand, member-sync hardening, and enforcement migrations in the same database rollout window, then deploy the upgraded application. Do not expose the expanded client-access schema while its fail-closed enforcement is still pending. Verify staff project editing and client-safe account reads against the enforcement boundary.
3. Before cleanup, snapshot legacy `project_members` and project owners, identify external members or owners that will be removed or cleared, and confirm every active project has the intended internal owner.
4. Only after the upgraded readers and writers are live, explicitly materialize the destructive identity cleanup and the removal of the legacy `client_next_steps` column, review their SQL, and apply them:

   ```bash
   bw upgrade projects --include-destructive-migrations
   ```

If cleanup is not approved, leave it deferred. Re-running an ordinary upgrade remains at the enforcement boundary and reports the held migration without applying it.

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
