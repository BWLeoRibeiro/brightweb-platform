import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";

import type { ProjectDashboardData, ProjectLink } from "../packages/module-projects/src/types.ts";
import { ptProjectActivityDictionary } from "../packages/module-projects/src/activity-messages.ts";
import { listAccountProjects } from "../packages/module-projects/src/account-projects.ts";
import {
  createProjectsAssignableProfilesGetHandler,
  createProjectsActivityGetHandler,
  createProjectsDeleteHandler,
  createProjectsLinksDeleteHandler,
  createProjectsLinksPatchHandler,
  createProjectsLinksPostHandler,
  createProjectsMembersPutHandler,
  createProjectsMilestonesDeleteHandler,
  createProjectsMilestonesPatchHandler,
  createProjectsMilestonesPostHandler,
  createProjectsOrganizationsPostHandler,
  createProjectsPatchHandler,
  createProjectsPostHandler,
  createProjectsTasksDeleteHandler,
  createProjectsTasksPatchHandler,
  createProjectsTasksPostHandler,
} from "../packages/module-projects/src/http.ts";
import { getClientProjectHealth } from "../packages/module-projects/src/server.ts";
import { defaultProjectsUiDictionary } from "../packages/module-projects/src/ui/dictionary.ts";
import { clientProjectsDictionary } from "../packages/module-projects/src/ui/client/dictionary.ts";
import { defaultDashboardDictionary } from "../packages/app-shell/src/dashboard/dictionary.ts";
import { resolveProjectsNavigation } from "../packages/module-projects/src/ui/navigation.ts";
import { parseProjectBoardApiError, parseTaskListPayload } from "../packages/module-projects/src/ui/project-board-response-parser.ts";
import { parseProjectDashboardPayload, parseProjectLinksPayload, projectDetailDataReducer } from "../packages/module-projects/src/ui/project-detail-data-provider.tsx";
import { createProjectsModuleRegistration } from "../packages/module-projects/src/registration.ts";
import {
  getCompactCollectionPreview,
  hasCompactCollectionOverflow,
} from "../packages/module-projects/src/ui/shared/compact-collection-model.ts";

function collectDictionaryStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(collectDictionaryStrings);
}

test("project-facing Portuguese copy consistently calls milestones metas", () => {
  const visibleCopy = collectDictionaryStrings({
    projects: defaultProjectsUiDictionary,
    clientProjects: clientProjectsDictionary,
    activity: ptProjectActivityDictionary,
    dashboardMilestones: defaultDashboardDictionary.milestones,
  });

  assert.equal(visibleCopy.some((label) => /milestone|marcos?/i.test(label)), false);
  assert.equal(defaultProjectsUiDictionary.detail.milestones, "Metas");
  assert.equal(defaultProjectsUiDictionary.forms.newMilestone, "Nova meta");
  assert.equal(clientProjectsDictionary.list.milestones(1, 2), "1/2 metas");
  assert.equal(defaultDashboardDictionary.milestones.emptyDescription, "Metas com data aparecem aqui.");
});

test("project detail hero only renders selected project dates and combines complete ranges", () => {
  const heroSource = readFileSync(
    join(process.cwd(), "packages/module-projects/src/ui/project-detail-hero.tsx"),
    "utf8",
  );

  assert.match(heroSource, /const hasStartDate = Boolean\(project\.startDate\)/);
  assert.match(heroSource, /const hasTargetDate = Boolean\(project\.targetDate\)/);
  assert.match(heroSource, /\{hasStartDate \|\| hasTargetDate \? \(/);
  assert.match(heroSource, /hasBothProjectDates[\s\S]*dictionary\.detail\.projectDates/);
  assert.match(heroSource, /ProjectHeroDate label=\{dictionary\.detail\.projectStartShort\}/);
  assert.match(heroSource, /ProjectHeroDate label=\{dictionary\.detail\.projectEndShort\}/);
  assert.match(heroSource, /xl:divide-x/);
  assert.match(heroSource, /grid-cols-\[auto_minmax\(2\.5rem,1fr\)_auto\]/);
  assert.equal(defaultProjectsUiDictionary.detail.projectManager, "Gestor do projeto");
  assert.equal(defaultProjectsUiDictionary.detail.projectDates, "Período do projeto");
  assert.equal(defaultProjectsUiDictionary.detail.projectStartDate, "Data de início");
  assert.equal(defaultProjectsUiDictionary.detail.projectDueDate, "Prazo do projeto");
});

test("compact collection previews preserve the 0/1/2/3 boundary and gate overflow at 4+", () => {
  for (const count of [0, 1, 2, 3, 4, 9]) {
    const items = Array.from({ length: count }, (_, index) => index);
    assert.deepEqual(getCompactCollectionPreview(items), items.slice(0, 3));
    assert.equal(hasCompactCollectionOverflow(count), count >= 4);
  }
});

test("Projects compact cards use natural three-row previews, viewer expansion, and reduced-motion reveals", () => {
  const uiRoot = join(process.cwd(), "packages/module-projects/src/ui");
  const cardSources = [
    "project-recent-activity.tsx",
    "project-detail-team-card.tsx",
    "project-links-card.tsx",
  ].map((file) => readFileSync(join(uiRoot, file), "utf8"));
  const sharedSource = readFileSync(join(uiRoot, "shared/compact-collection.tsx"), "utf8");
  const skeletonSource = readFileSync(join(uiRoot, "shared/compact-collection-skeleton.tsx"), "utf8");

  for (const source of cardSources) {
    assert.match(source, /getCompactCollectionPreview/);
    assert.match(source, /CompactCollectionHeaderActions/);
    assert.doesNotMatch(source, /h-\[17\.75rem\]|transition-\[padding\]/);
  }
  assert.match(sharedSource, /motion-safe:animate-in[\s\S]*motion-safe:fade-in-0[\s\S]*motion-safe:slide-in-from-bottom-1[\s\S]*motion-safe:duration-200/);
  assert.match(sharedSource, /^"use client";/);
  assert.match(skeletonSource, /CompactCollectionContentSkeleton[\s\S]*min-h-\[3\.25rem\]/);
});

test("Projects activity endpoint keeps the legacy array response and exposes bounded pagination", async () => {
  const pageCalls: unknown[] = [];
  let legacyCalls = 0;
  const handler = createProjectsActivityGetHandler({
    getAccess: async () => ({ ok: true, supabase: {} }),
    listActivity: async () => {
      legacyCalls += 1;
      return [];
    },
    queryActivity: async (_supabase: unknown, projectId: string, query: unknown) => {
      pageCalls.push({ projectId, query });
      return { items: [], page: 2, pageSize: 3, total: 7, totalPages: 3 };
    },
  } as never);

  const pagedResponse = await handler(
    new Request("https://example.test/api/projects/project-1/activity?page=2&pageSize=3"),
    { params: Promise.resolve({ id: "project-1" }) },
  );
  assert.equal(pagedResponse.status, 200);
  assert.deepEqual(pageCalls, [{ projectId: "project-1", query: { page: 2, pageSize: 3 } }]);
  assert.deepEqual(await pagedResponse.json(), { items: [], page: 2, pageSize: 3, total: 7, totalPages: 3 });

  const legacyResponse = await handler(
    new Request("https://example.test/api/projects/project-1/activity"),
    { params: Promise.resolve({ id: "project-1" }) },
  );
  assert.equal(legacyResponse.status, 200);
  assert.equal(legacyCalls, 1);
  assert.deepEqual(await legacyResponse.json(), []);
});

test("Projects portfolio cancels stale requests and debounces only search", () => {
  const controller = readFileSync(join(process.cwd(), "packages/module-projects/src/ui/projects-portfolio/use-projects-portfolio-controller.ts"), "utf8");
  const client = readFileSync(join(process.cwd(), "packages/module-projects/src/ui/client.ts"), "utf8");
  const list = readFileSync(join(process.cwd(), "packages/module-projects/src/ui/projects-portfolio/projects-portfolio-list.tsx"), "utf8");
  assert.match(controller, /signal: controller\.signal/);
  assert.match(controller, /setIsLoading\(true\)[\s\S]*window\.setTimeout\(\(\) => \{[\s\S]*setDebouncedSearch/);
  assert.doesNotMatch(controller, /setTimeout\(\(\) => \{\s*void loadProjects/);
  assert.match(client, /signal: requestOptions\.signal/);
  assert.match(list, /aria-busy=\{isLoading\}/);
});

test("create-project organization choices never present unresolved or failed data as empty", () => {
  const source = readFileSync(join(process.cwd(), "packages/module-projects/src/ui/create-project-sheet.tsx"), "utf8");
  assert.match(source, /organizationsLoadState[^\n]*"idle" \| "pending" \| "fulfilled" \| "rejected"/);
  assert.match(source, /setOrganizationsLoadState\("pending"\)[\s\S]*requestRaw/);
  assert.match(source, /isLoadingOrganizations \?[\s\S]*loadingOrganizations[\s\S]*organizationsLoadState === "rejected"[\s\S]*loadOrganizationsError[\s\S]*hasOrganizations/);
  assert.match(source, /role="alert"[\s\S]*loadOrganizationsError/);
});

const project = { id: "project-1", organizationId: "org-1", organizationName: "MQ", organizationOwnerLabel: null, organizationOwnerEmail: null, organizationOwnerPhone: null, name: "Projeto", code: "MQ-1", status: "active", health: "on_track", ownerProfileId: null, ownerLabel: null, ownerEmail: null, ownerPhone: null, activatedAt: null, startDate: null, targetDate: null, completedAt: null, cancellationReason: null, summary: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", taskStats: { total: 0, done: 0, overdue: 0, blocked: 0 }, milestoneStats: { total: 0, achieved: 0, delayed: 0 } } satisfies ProjectDashboardData["project"];
const link = { id: "link-1", projectId: "project-1", label: "Drive", url: "https://example.com", visibility: "staff", kind: "drive", createdAt: project.createdAt, updatedAt: project.updatedAt } satisfies ProjectLink;
const dashboard = { project, members: [], milestones: [], tasks: [], links: [link], activity: [] } satisfies ProjectDashboardData;

test("account projects adapter preserves schema and legacy-role fallbacks", async () => {
  const supabase = {} as never;
  const schemaError = new Error('relation "public.projects" does not exist');
  let schemaCalls = 0;
  const dependencies = {
    isProjectsSchemaMissingError: (error: unknown) => error === schemaError,
    listOrgAdminProjectsByProfile: async () => {
      schemaCalls += 1;
      throw schemaError;
    },
  };

  assert.deepEqual(
    await listAccountProjects(supabase, "profile-1", { limit: 3 }, dependencies as never),
    { items: [], schemaMissing: true, error: null },
  );
  assert.equal(schemaCalls, 1);

  const scopedCalls: Array<{ profileId: string; options: unknown }> = [];
  const fallbackDependencies = {
    isProjectsSchemaMissingError: () => false,
    listOrgAdminProjectsByProfile: async (
      _client: unknown,
      profileId: string,
      options: unknown,
    ) => {
      scopedCalls.push({ profileId, options });
      if (scopedCalls.length === 1) {
        throw new Error('relation "user_role_assignments" does not exist');
      }
      return [project];
    },
  };

  assert.deepEqual(
    await listAccountProjects(supabase, "profile-1", { limit: 3 }, fallbackDependencies as never),
    { items: [project], schemaMissing: false, error: null },
  );
  assert.deepEqual(scopedCalls, [
    { profileId: "profile-1", options: { limit: 3 } },
    {
      profileId: "profile-1",
      options: { limit: 3, skipAdminRoleCheck: true },
    },
  ]);

  let fallbackSchemaCalls = 0;
  const fallbackSchemaDependencies = {
    isProjectsSchemaMissingError: (error: unknown) => error === schemaError,
    listOrgAdminProjectsByProfile: async () => {
      fallbackSchemaCalls += 1;
      if (fallbackSchemaCalls === 1) {
        throw new Error('relation "user_role_assignments" does not exist');
      }
      throw schemaError;
    },
  };
  assert.deepEqual(
    await listAccountProjects(supabase, "profile-1", undefined, fallbackSchemaDependencies as never),
    { items: [], schemaMissing: true, error: null },
  );
  assert.equal(fallbackSchemaCalls, 2);
});

test("client project health enforces client link visibility in the query and result", async () => {
  const linkFilters: Array<[string, unknown]> = [];
  const databaseProject = {
    id: project.id,
    organization_id: project.organizationId,
    organizations: { name: project.organizationName, primary_contact: null },
    name: project.name,
    code: project.code,
    status: project.status,
    health: project.health,
    owner_profile_id: null,
    owner: null,
    activated_at: null,
    start_date: null,
    target_date: null,
    completed_at: null,
    cancellation_reason: null,
    summary: null,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  };
  const clientLink = { ...link, id: "link-client", visibility: "client" };
  const rowsByTable: Record<string, unknown[]> = {
    projects: [databaseProject],
    project_tasks: [],
    project_milestones: [],
    project_links: [
      {
        id: link.id,
        project_id: link.projectId,
        label: link.label,
        url: link.url,
        visibility: link.visibility,
        kind: link.kind,
        created_at: link.createdAt,
        updated_at: link.updatedAt,
      },
      {
        id: clientLink.id,
        project_id: clientLink.projectId,
        label: clientLink.label,
        url: clientLink.url,
        visibility: clientLink.visibility,
        kind: clientLink.kind,
        created_at: clientLink.createdAt,
        updated_at: clientLink.updatedAt,
      },
    ],
    project_members: [],
  };
  const supabase = {
    from(table: string) {
      let rows = rowsByTable[table] ?? [];
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: unknown) {
          if (table === "project_links") {
            linkFilters.push([column, value]);
            if (column === "visibility") {
              rows = rows.filter((row) => (
                typeof row === "object"
                && row !== null
                && (row as Record<string, unknown>)[column] === value
              ));
            }
          }
          return query;
        },
        order() {
          return query;
        },
        maybeSingle() {
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };

  const result = await getClientProjectHealth(supabase as never, project.id);

  assert.deepEqual(linkFilters, [
    ["project_id", project.id],
    ["visibility", "client"],
  ]);
  assert.deepEqual(result.links.map((item) => item.id), [clientLink.id]);
});

test("every Projects write handler rejects non-staff access before invoking data dependencies", async () => {
  let dependencyCalls = 0;
  const forbiddenDependency = async () => {
    dependencyCalls += 1;
    throw new Error("write dependency must not run");
  };
  const dependencies = {
    getAccess: async () => ({
      ok: true,
      supabase: {},
      profileId: "profile-client",
      role: "client",
    }),
    createOrganization: forbiddenDependency,
    createProject: forbiddenDependency,
    updateProject: forbiddenDependency,
    deleteProject: forbiddenDependency,
    syncMembers: forbiddenDependency,
    createMilestone: forbiddenDependency,
    updateMilestone: forbiddenDependency,
    deleteMilestone: forbiddenDependency,
    createTask: forbiddenDependency,
    updateTask: forbiddenDependency,
    deleteTask: forbiddenDependency,
    createLink: forbiddenDependency,
    updateLink: forbiddenDependency,
    deleteLink: forbiddenDependency,
  };
  const writeHandlerFactories = [
    createProjectsOrganizationsPostHandler,
    createProjectsPostHandler,
    createProjectsPatchHandler,
    createProjectsDeleteHandler,
    createProjectsMembersPutHandler,
    createProjectsMilestonesPostHandler,
    createProjectsMilestonesPatchHandler,
    createProjectsMilestonesDeleteHandler,
    createProjectsTasksPostHandler,
    createProjectsTasksPatchHandler,
    createProjectsTasksDeleteHandler,
    createProjectsLinksPostHandler,
    createProjectsLinksPatchHandler,
    createProjectsLinksDeleteHandler,
  ];
  const context = {
    params: Promise.resolve({ id: project.id, itemId: "item-1" }),
  };

  for (const createHandler of writeHandlerFactories) {
    const response = await createHandler(dependencies as never)(
      new Request(`https://example.test/api/projects/${project.id}`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
      context,
    );
    assert.equal(response.status, 403, createHandler.name);
  }
  assert.equal(dependencyCalls, 0);
});

test("assignable profiles GET rejects clients and allows staff", async () => {
  let clientListCalls = 0;
  const context = { params: Promise.resolve({ id: project.id }) };
  const clientHandler = createProjectsAssignableProfilesGetHandler({
    getAccess: async () => ({
      ok: true,
      supabase: {},
      profileId: "profile-client",
      role: "client",
    }),
    listAssignableProfiles: async () => {
      clientListCalls += 1;
      return [];
    },
  } as never);

  const forbidden = await clientHandler(
    new Request(`https://example.test/api/projects/${project.id}/members`),
    context,
  );
  assert.equal(forbidden.status, 403);
  assert.equal(clientListCalls, 0);

  const staffOptions = [{
    profileId: "profile-staff",
    label: "Staff Member",
    email: "staff@example.test",
    organizationRole: "staff",
    projectRole: null,
  }];
  const staffHandler = createProjectsAssignableProfilesGetHandler({
    getAccess: async () => ({
      ok: true,
      supabase: {},
      profileId: "profile-staff",
      role: "staff",
    }),
    listAssignableProfiles: async () => staffOptions,
  } as never);

  const allowed = await staffHandler(
    new Request(`https://example.test/api/projects/${project.id}/members`),
    context,
  );
  assert.equal(allowed.status, 200);
  assert.deepEqual(await allowed.json(), staffOptions);
});

test("Projects detail provider accepts package dashboard payloads", () => {
  assert.deepEqual(parseProjectDashboardPayload({ data: dashboard }), dashboard);
  assert.equal(parseProjectDashboardPayload({ data: { project } }), null);
  assert.deepEqual(parseProjectLinksPayload({ data: [link] }), [link]);
  assert.equal(parseProjectLinksPayload({ data: [{ ...link, kind: "spreadsheet" }] }), null);
});

test("Projects detail reducer replaces links without changing the dashboard record", () => {
  const links = [{ ...link, id: "link-2", label: "Brief" }];
  assert.deepEqual(projectDetailDataReducer(dashboard, { type: "replace-links", links }), { ...dashboard, links });
});

test("Projects board parser accepts task lists and preserves API errors", () => {
  const task = { id: "task-1", projectId: project.id, milestoneId: null, title: "Board task", description: null, status: "todo", health: "on_track", priority: "medium", assigneeProfileId: null, assigneeLabel: null, reporterProfileId: null, reporterLabel: null, dueDate: null, position: 1, blockedReason: null, createdAt: project.createdAt, updatedAt: project.updatedAt } as const;
  assert.deepEqual(parseTaskListPayload({ data: [task] }), [task]);
  assert.equal(parseTaskListPayload({ data: [{ id: "task-1" }] }), null);
  assert.equal(parseProjectBoardApiError({ error: "Move rejected" }, "Fallback"), "Move rejected");
  assert.equal(parseProjectBoardApiError({}, "Fallback"), "Fallback");
});

test("Projects UI ships Portuguese defaults and configurable shell registration", () => {
  assert.equal(defaultProjectsUiDictionary.locale, "pt-PT");
  assert.equal(defaultProjectsUiDictionary.status.planned, "A planear");
  const registration = createProjectsModuleRegistration("/projects");
  assert.equal(registration.navItems?.[0]?.href, "/projects");
  assert.deepEqual(registration.toolbarActions?.projects?.map((item) => item.action), ["projects-refresh", "projects-new-menu"]);
  assert.deepEqual(registration.toolbarActions?.["project-detail"]?.map((item) => [item.label, item.placement]), [["Projetos", "back"], ["Ver tarefas", "contextual"]]);
  assert.deepEqual(registration.toolbarActions?.["project-board"]?.map((item) => item.action), ["projects-back-to-portfolio"]);
});

test("Projects navigation patterns resolve URL-encoded identifiers", () => {
  const navigation = resolveProjectsNavigation({
    listHref: "/projetos",
    detailHrefPattern: "/projetos/:projectId",
    boardHrefPattern: "/projetos/:projectId/tarefas/:projectId",
    organizationHrefPattern: "/crm/:organizationId",
  });

  assert.equal(navigation.listHref, "/projetos");
  assert.equal(navigation.detailHref("project /?"), "/projetos/project%20%2F%3F");
  assert.equal(
    navigation.boardHref("project /?"),
    "/projetos/project%20%2F%3F/tarefas/project%20%2F%3F",
  );
  assert.equal(navigation.organizationHref("org/#1"), "/crm/org%2F%231");
});

test("Projects navigation applies defaults when configuration is omitted or partial", () => {
  const defaults = resolveProjectsNavigation();
  assert.equal(defaults.listHref, "/projects");
  assert.equal(defaults.detailHref("project-1"), "/projects/project-1");
  assert.equal(defaults.boardHref("project-1"), "/projects/project-1/tasks");
  assert.equal(defaults.organizationHref("org-1"), "/crm");

  const partial = resolveProjectsNavigation({ listHref: "/projetos" });
  assert.equal(partial.listHref, "/projetos");
  assert.equal(partial.detailHref("project-1"), "/projects/project-1");
  assert.equal(partial.boardHref("project-1"), "/projects/project-1/tasks");
  assert.equal(partial.organizationHref("org-1"), "/crm");
});

test("ProjectsNavigationConfig contains no function-typed members", () => {
  const configPath = join(process.cwd(), "packages/module-projects/src/ui/types.ts");
  const program = ts.createProgram([configPath], {
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ESNext,
  });
  const sourceFile = program.getSourceFile(configPath);
  assert.ok(sourceFile, "Projects UI type source must be part of the TypeScript program");
  const declaration = sourceFile.statements.find(
    (statement): statement is ts.TypeAliasDeclaration => (
      ts.isTypeAliasDeclaration(statement) && statement.name.text === "ProjectsNavigationConfig"
    ),
  );
  assert.ok(declaration, "ProjectsNavigationConfig must remain a public type alias");

  const checker = program.getTypeChecker();
  const configType = checker.getTypeAtLocation(declaration.name);
  function containsFunction(type: ts.Type): boolean {
    return type.getCallSignatures().length > 0
      || (type.isUnion() && type.types.some(containsFunction));
  }
  const functionMembers = checker.getPropertiesOfType(configType).flatMap((property) => {
    const propertyDeclaration = property.valueDeclaration ?? property.declarations?.[0];
    if (!propertyDeclaration) return [];
    const propertyType = checker.getTypeOfSymbolAtLocation(property, propertyDeclaration);
    return containsFunction(propertyType) ? [property.name] : [];
  });

  assert.deepEqual(
    functionMembers,
    [],
    `ProjectsNavigationConfig crosses the Server/Client boundary and must contain only serializable values; function members: ${functionMembers.join(", ")}`,
  );
});

test("Projects package UI contains the literal list/detail translation and no raw component colors", () => {
  const root = join(process.cwd(), "packages/module-projects/src/ui");
  const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
  const source = files(root).filter((file) => /\.(?:ts|tsx)$/.test(file)).map((file) => readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b|rgba?\(|color-mix\(/i);
  assert.doesNotMatch(source, /\bfont-medium\b/);
  for (const symbol of ["ProjectsPage", "ProjectDetailPage", "ProjectsToolbarControls", "ProjectDetailDataProvider", "ProjectBoardKanban", "ProjectTasksPage", "ProjectBoardLoading"]) assert.match(readFileSync(join(root, "index.ts"), "utf8"), new RegExp(symbol.replace("ProjectsToolbarControls", "toolbar-controls").replace("ProjectDetailDataProvider", "project-detail-data-provider").replace("ProjectsPage", "projects-page").replace("ProjectDetailPage", "project-detail-page").replace("ProjectBoardKanban", "project-board-kanban").replace("ProjectTasksPage", "project-tasks-page").replace("ProjectBoardLoading", "project-board-loading")));
});

test("Projects board toolbar waits for authoritative page actions", () => {
  const root = join(process.cwd(), "packages/module-projects/src/ui");
  const toolbar = readFileSync(join(root, "project-board-toolbar-controls.tsx"), "utf8");
  const milestoneHook = readFileSync(join(root, "hooks/use-project-board-milestone-events.ts"), "utf8");
  const taskMount = readFileSync(join(root, "project-detail-create-sheets/project-detail-create-sheets-mount.tsx"), "utf8");

  assert.match(toolbar, /useShellActionReady\(PROJECTS_EVENTS\.setBoardMilestone\)/);
  assert.match(toolbar, /useShellActionReady\(PROJECTS_EVENTS\.openNewTask\)/);
  assert.match(toolbar, /disabled=\{!milestoneActionReady\}/);
  assert.match(toolbar, /disabled=\{!newTaskActionReady\}/);
  assert.match(milestoneHook, /useShellAction<ProjectsBoardSetMilestoneDetail>\(PROJECTS_EVENTS\.setBoardMilestone/);
  assert.match(taskMount, /useShellAction\(PROJECTS_EVENTS\.openNewTask/);
});

test("Projects UI barrel exposes only the supported documented component families", () => {
  const barrel = readFileSync(join(process.cwd(), "packages/module-projects/src/ui/index.ts"), "utf8");
  const ledger = readFileSync(join(process.cwd(), "docs/ui-components.md"), "utf8");
  const supportedExports = [
    "./project-activity-card",
    "./project-detail-data-provider",
    "./project-detail-page",
    "./project-board-kanban",
    "./project-board-loading",
    "./project-board-toolbar-controls",
    "./project-tasks-page",
    "./project-state-badge",
    "./projects-page",
    "./projects-portfolio/index",
    "./toolbar-controls",
    "./shared/project-summary-card",
    "./shared/project-summary-card-skeleton",
  ];

  for (const exportPath of supportedExports) {
    assert.match(barrel, new RegExp(`from "${exportPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
  assert.match(barrel, /export \{ TaskDueMeta, TaskPriorityTag, TaskStatusTag \} from "\.\/shared\/task-tags"/);
  assert.doesNotMatch(barrel, /project-overview-stat-card|project-detail-hero|project-pill|shared-fields/);
  assert.match(ledger, /\| `TaskPriorityTag`, `TaskStatusTag`, `TaskDueMeta` \| `@brightweblabs\/module-projects\/ui` \|/);
  assert.match(ledger, /\| `ProjectDetailHero`, `ProjectDetailMetadataStrip`, `ProjectDetailTeamCard` \| internal to `@brightweblabs\/module-projects` \|/);
  assert.doesNotMatch(ledger, /ProjectOverviewStatCard/);
});

test("Projects keeps the public list payload type without its dead parser", () => {
  const parser = readFileSync(join(process.cwd(), "packages/module-projects/src/ui/projects-list-response-parser.ts"), "utf8");
  const barrel = readFileSync(join(process.cwd(), "packages/module-projects/src/ui/index.ts"), "utf8");
  const dashboardParser = readFileSync(join(process.cwd(), "packages/app-shell/src/dashboard/dashboard-response-parser.ts"), "utf8");

  assert.match(parser, /export type ListProjectsPayload/);
  assert.doesNotMatch(parser, /parseListProjectsPayload|isListProjectsPayload|isProjectItem|parseErrorFromPayload/);
  assert.match(barrel, /export type \{ ListProjectsPayload \}/);
  assert.match(dashboardParser, /export function parseDashboardBootstrapResponse/);
});

test("Projects Portuguese UI copy is owned by the dictionary", () => {
  const root = join(process.cwd(), "packages/module-projects/src/ui");
  const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
  const source = files(root).filter((file) => /\.(?:ts|tsx)$/.test(file) && !file.endsWith("dictionary.ts")).map((file) => readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(source, /[À-ÿ]|\b(?:Atrasadas|Bloqueada|Concluída|Criar|Editar|Eliminar|Equipa|Filtros|Hoje|Marcos|Nenhum|Novo|Portefólio|Prioridade|Projeto|Responsável|Sem|Tarefa|Todas|Utilizador)\b/);
});

test("Projects preview exposes list, detail, board, and tasks routes", () => {
  const previewRoot = join(process.cwd(), "apps/platform-preview/app/(shell)/projects");
  for (const route of ["page.tsx", "[id]/page.tsx", "[id]/board/page.tsx", "[id]/tasks/page.tsx"]) {
    assert.match(readFileSync(join(previewRoot, route), "utf8"), /ProjectsPage|ProjectDetailPage|ProjectBoardPage|ProjectTasksPage/);
  }
});

test("Projects portfolio grid keeps MQ columns at responsive boundaries", () => {
  const tokens = readFileSync(join(process.cwd(), "packages/module-projects/tokens.css"), "utf8");
  const tablet = tokens.indexOf("@media (min-width: 768px)");
  const mqNarrow = tokens.indexOf("@media (max-width: 900px)");
  const desktop = tokens.indexOf("@media (min-width: 1024px)");

  assert.ok(tablet >= 0 && mqNarrow > tablet && desktop > mqNarrow);
  assert.match(tokens.slice(tablet, mqNarrow), /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(tokens.slice(mqNarrow, desktop), /grid-template-columns:\s*1fr/);
  assert.match(tokens.slice(desktop), /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
});
