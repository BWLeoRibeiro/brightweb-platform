import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import type { ProjectDashboardData, ProjectLink } from "../packages/module-projects/src/types.ts";
import { defaultProjectsUiDictionary } from "../packages/module-projects/src/ui/dictionary.ts";
import { parseProjectBoardApiError, parseTaskListPayload } from "../packages/module-projects/src/ui/project-board-response-parser.ts";
import { parseProjectDashboardPayload, parseProjectLinksPayload, projectDetailDataReducer } from "../packages/module-projects/src/ui/project-detail-data-provider.tsx";
import { createProjectsModuleRegistration } from "../packages/module-projects/src/registration.ts";

const project = { id: "project-1", organizationId: "org-1", organizationName: "MQ", organizationOwnerLabel: null, organizationOwnerEmail: null, organizationOwnerPhone: null, name: "Projeto", code: "MQ-1", status: "active", health: "on_track", ownerProfileId: null, ownerLabel: null, ownerEmail: null, ownerPhone: null, activatedAt: null, targetDate: null, completedAt: null, cancellationReason: null, summary: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", taskStats: { total: 0, done: 0, overdue: 0, blocked: 0 }, milestoneStats: { total: 0, achieved: 0, delayed: 0 } } satisfies ProjectDashboardData["project"];
const link = { id: "link-1", projectId: "project-1", label: "Drive", url: "https://example.com", visibility: "staff", kind: "drive", createdAt: project.createdAt, updatedAt: project.updatedAt } satisfies ProjectLink;
const dashboard = { project, members: [], milestones: [], tasks: [], links: [link], activity: [] } satisfies ProjectDashboardData;

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

test("Projects package UI contains the literal list/detail translation and no raw component colors", () => {
  const root = join(process.cwd(), "packages/module-projects/src/ui");
  const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
  const source = files(root).filter((file) => /\.(?:ts|tsx)$/.test(file)).map((file) => readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b|rgba?\(|color-mix\(/i);
  assert.doesNotMatch(source, /\bfont-medium\b/);
  for (const symbol of ["ProjectsPage", "ProjectDetailPage", "ProjectsToolbarControls", "ProjectDetailDataProvider", "ProjectBoardKanban", "ProjectTasksPage", "ProjectBoardLoading"]) assert.match(readFileSync(join(root, "index.ts"), "utf8"), new RegExp(symbol.replace("ProjectsToolbarControls", "toolbar-controls").replace("ProjectDetailDataProvider", "project-detail-data-provider").replace("ProjectsPage", "projects-page").replace("ProjectDetailPage", "project-detail-page").replace("ProjectBoardKanban", "project-board-kanban").replace("ProjectTasksPage", "project-tasks-page").replace("ProjectBoardLoading", "project-board-loading")));
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
