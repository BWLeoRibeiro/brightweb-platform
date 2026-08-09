import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AppDashboard,
  buildUpcomingMilestoneDays,
  buildUpcomingTaskDays,
  buildProjectQuickCreateHref,
  buildTaskQuickCreateHref,
  ClientsView,
  getAttentionPreviewCapacity,
  ProjectQuickCreateAction,
  ProjectsView,
} from "../src/dashboard/dashboard-client.tsx";
import { createDashboardRequestGenerations } from "../src/dashboard/dashboard-request-generations.ts";
import {
  clearDashboardSectionErrors,
  setDashboardSectionError,
} from "../src/dashboard/dashboard-section-errors.ts";
import {
  parseDashboardBootstrapResponse,
  parseDashboardCrmResponse,
  parseDashboardOverviewShellResponse,
  parseDashboardProjectsResponse,
  parseDashboardTasksResponse,
  parseErrorFromPayload,
} from "../src/dashboard/dashboard-response-parser.ts";

const projects = {
  generatedAt: "2026-07-24T12:00:00.000Z",
  kpis: {
    projectsActive: 1,
    projectsAtRisk: 0,
    projectsOverdue: 1,
    projectsDueNext7Days: 0,
    projectsWithoutOwner: 0,
    projectBlockedTasks: 1,
    projectsAttention: 1,
    projectsOnTrack: 0,
  },
  projects: {
    overdue: [{
      id: "project-1",
      organizationName: "BrightWeb",
      name: "Platform",
      code: null,
      status: "active",
      health: "at_risk",
      ownerLabel: null,
      targetDate: "2026-07-25",
      taskStats: { total: 2, done: 1, overdue: 1, blocked: 1 },
    }],
    attention: [{
      id: "project-1",
      organizationName: "BrightWeb",
      name: "Platform",
      code: null,
      status: "active",
      health: "at_risk",
      ownerLabel: null,
      targetDate: "2026-07-25",
      taskStats: { total: 2, done: 1, overdue: 1, blocked: 1 },
      attentionReason: "overdue",
    }],
    milestones: [{
      id: "milestone-1",
      projectId: "project-1",
      projectName: "Platform",
      projectCode: null,
      title: "Dashboard shipped",
      status: "in_progress",
      targetDate: "2026-07-25",
    }],
    milestonesNext7Days: [{
      id: "milestone-week-1",
      projectId: "project-1",
      projectName: "Platform",
      projectCode: null,
      title: "Weekly dashboard shipped",
      status: "pending",
      targetDate: "2026-07-26",
    }],
  },
};

const crm = {
  generatedAt: "2026-07-24T12:00:00.000Z",
  kpis: {
    crmTotalContacts: 2,
    crmNewLast7Days: 1,
    crmNewLast30Days: 1,
    crmNewLastYear: 2,
    crmUnassignedContacts: 0,
  },
  crm: {
    statusBreakdown: { lead: 1, qualified: 1, proposal: 0, won: 0, lost: 0 },
    recentChanges: [{
      id: "change-1",
      contactId: "contact-1",
      contactLabel: "Ada",
      previousStatus: null,
      newStatus: "lead",
      changedAt: "2026-07-24T12:00:00.000Z",
    }],
    recentContacts: [{
      id: "contact-1",
      name: "Ada",
      company: null,
      status: "lead",
      lastChangedAt: "2026-07-24T12:00:00.000Z",
    }],
  },
};

const tasks = {
  generatedAt: "2026-07-24T12:00:00.000Z",
  kpis: { total: 1, dueThisWeek: 1, overdue: 0, blocked: 0 },
  tasks: [{
    id: "task-1",
    projectId: "project-1",
    projectName: "Platform",
    projectCode: null,
    title: "Harden dashboard",
    status: "in_progress",
    priority: "high",
    dueDate: null,
    blockedReason: null,
    milestoneId: null,
    updatedAt: "2026-07-24T12:00:00.000Z",
  }],
  attention: {
    total: 1,
    tasks: [{
      id: "task-1",
      projectId: "project-1",
      projectName: "Platform",
      projectCode: null,
      title: "Harden dashboard",
      status: "in_progress",
      priority: "high",
      dueDate: null,
      blockedReason: null,
      milestoneId: null,
      updatedAt: "2026-07-24T12:00:00.000Z",
    }],
  },
  pagination: { page: 1, pageSize: 50, hasMore: false },
};

test("attention preview capacity uses whole rows in the space below the card", () => {
  assert.equal(getAttentionPreviewCapacity(390, 1_200), 3);
  assert.equal(getAttentionPreviewCapacity(1_280, 720, 450), 3);
  assert.equal(getAttentionPreviewCapacity(1_280, 900, 450), 4);
  assert.equal(getAttentionPreviewCapacity(1_280, 972, 450), 5);
  assert.equal(getAttentionPreviewCapacity(1_280, 1_044, 450), 6);
  assert.equal(getAttentionPreviewCapacity(1_280, 1_044, 650), 3);
});

test("project milestone timeline groups the next seven calendar days", () => {
  const days = buildUpcomingMilestoneDays([
    { ...projects.projects.milestones[0], id: "milestone-a", targetDate: "2026-08-08" },
    { ...projects.projects.milestones[0], id: "milestone-b", targetDate: "2026-08-12" },
    { ...projects.projects.milestones[0], id: "milestone-c", targetDate: "2026-08-12" },
    { ...projects.projects.milestones[0], id: "milestone-later", targetDate: "2026-08-14" },
  ], new Date(2026, 7, 7, 12));

  assert.deepEqual(days.map((day) => day.count), [0, 1, 0, 0, 0, 2, 0]);
  assert.deepEqual(days.map((day) => day.weekday), ["sex", "sáb", "dom", "seg", "ter", "qua", "qui"]);
  assert.equal(days[0]?.isToday, true);
  assert.equal(days[6]?.dateKey, "2026-08-13");
  assert.equal(days[1]?.fullDate, "Sábado, 8 de agosto");
  assert.deepEqual(days[5]?.milestones.map((milestone) => milestone.id), ["milestone-b", "milestone-c"]);
});

test("task pulse groups due tasks into the next seven UTC calendar days", () => {
  const days = buildUpcomingTaskDays([
    { ...tasks.tasks[0], id: "task-today", dueDate: "2026-08-09" },
    { ...tasks.tasks[0], id: "task-midweek-a", dueDate: "2026-08-12" },
    { ...tasks.tasks[0], id: "task-midweek-b", dueDate: "2026-08-12" },
    { ...tasks.tasks[0], id: "task-later", dueDate: "2026-08-16" },
  ], "2026-08-09T12:00:00.000Z");

  assert.deepEqual(days.map((day) => day.count), [1, 0, 0, 2, 0, 0, 0]);
  assert.deepEqual(days.map((day) => day.weekday), ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]);
  assert.equal(days[0]?.isToday, true);
  assert.deepEqual(days[3]?.tasks.map((task) => task.id), ["task-midweek-a", "task-midweek-b"]);
});

test("dashboard request generations gate stale success, error, and loading writes per section", async () => {
  const generations = createDashboardRequestGenerations();
  const older = generations.begin(["projects", "crm"]);
  const newerProjects = generations.begin(["projects"]);
  const state = {
    projects: "initial",
    projectError: null as string | null,
    projectsLoading: true,
    crm: "initial",
  };

  await Promise.resolve().then(() => {
    if (generations.isCurrent(newerProjects, "projects")) {
      state.projects = "newer";
      state.projectsLoading = false;
    }
  });
  await Promise.resolve().then(() => {
    if (generations.isCurrent(older, "projects")) state.projects = "older";
    if (generations.isCurrent(older, "projects")) state.projectError = "stale failure";
    if (generations.isCurrent(older, "projects")) state.projectsLoading = false;
    if (generations.isCurrent(older, "crm")) state.crm = "older overview";
  });

  assert.equal(generations.isCurrent(older, "projects"), false);
  assert.equal(generations.isCurrent(older, "crm"), true);
  assert.equal(generations.isCurrent(newerProjects, "projects"), true);
  assert.deepEqual(state, {
    projects: "newer",
    projectError: null,
    projectsLoading: false,
    crm: "older overview",
  });

  const newerCrm = generations.begin(["crm"]);
  assert.equal(generations.isCurrent(older, "crm"), false);
  assert.equal(generations.isCurrent(newerProjects, "projects"), true);
  assert.equal(generations.isCurrent(newerCrm, "crm"), true);
});

test("dashboard section errors accumulate independently and clear only refreshed sections", () => {
  const projectsFailed = setDashboardSectionError({}, "projects", "Projetos indisponíveis.");
  const crmAndProjectsFailed = setDashboardSectionError(projectsFailed, "crm", "CRM indisponível.");
  const allFailed = setDashboardSectionError(crmAndProjectsFailed, "tasks", "Tarefas indisponíveis.");

  assert.deepEqual(allFailed, {
    projects: "Projetos indisponíveis.",
    crm: "CRM indisponível.",
    tasks: "Tarefas indisponíveis.",
  });
  assert.deepEqual(clearDashboardSectionErrors(allFailed, ["crm"]), {
    projects: "Projetos indisponíveis.",
    tasks: "Tarefas indisponíveis.",
  });

  const hookSource = readFileSync(new URL("../src/dashboard/use-dashboard-data.ts", import.meta.url), "utf8");
  const clientSource = readFileSync(new URL("../src/dashboard/dashboard-client.tsx", import.meta.url), "utf8");
  assert.match(hookSource, /errors: DashboardSectionErrors/);
  assert.match(hookSource, /setDashboardSectionError\(current, "projects", messages\.projectsUnavailable\)/);
  assert.match(hookSource, /setDashboardSectionError\(current, "crm", messages\.crmUnavailable\)/);
  assert.match(hookSource, /setDashboardSectionError\(current, "tasks", messages\.tasksUnavailable\)/);
  assert.doesNotMatch(hookSource, /setError\(\(current\) => current \?\?/);
  assert.match(clientSource, /errors\.map\(\(error\) =>/);
});

test("dashboard parsers accept fully valid nested contracts", () => {
  assert.deepEqual(parseDashboardProjectsResponse({ data: projects }), { data: projects, error: null });
  assert.deepEqual(parseDashboardCrmResponse({ data: crm }), { data: crm, error: null });
  assert.deepEqual(parseDashboardTasksResponse({ data: tasks }), { data: tasks, error: null });
  assert.deepEqual(
    parseDashboardBootstrapResponse({ data: { projects, crm, tasks } }),
    { data: { projects, crm, tasks }, error: null },
  );
});

test("dashboard parsers reject malformed nested KPI values, items, enums, and nullability", () => {
  assert.equal(parseDashboardProjectsResponse({
    data: { ...projects, kpis: { ...projects.kpis, projectsActive: "1" } },
  }).data, null);
  assert.equal(parseDashboardProjectsResponse({
    data: {
      ...projects,
      projects: { ...projects.projects, attention: [{ ...projects.projects.attention[0], attentionReason: "unknown" }] },
    },
  }).data, null);
  assert.equal(parseDashboardProjectsResponse({
    data: {
      ...projects,
      projects: { ...projects.projects, milestonesNext7Days: [{ ...projects.projects.milestonesNext7Days[0], status: "unknown" }] },
    },
  }).data, null);
  assert.equal(parseDashboardProjectsResponse({
    data: {
      ...projects,
      projects: { overdue: [{ ...projects.projects.overdue[0], health: "unknown" }] },
    },
  }).data, null);
  assert.equal(parseDashboardCrmResponse({
    data: {
      ...crm,
      crm: {
        ...crm.crm,
        recentChanges: [{ ...crm.crm.recentChanges[0], previousStatus: 42 }],
      },
    },
  }).data, null);
  assert.equal(parseDashboardCrmResponse({
    data: {
      ...crm,
      crm: { ...crm.crm, statusBreakdown: { ...crm.crm.statusBreakdown, won: -1 } },
    },
  }).data, null);
  assert.equal(parseDashboardCrmResponse({
    data: { ...crm, crm: { ...crm.crm, monthlyNewContacts: "not-a-series" } },
  }).data, null);
  assert.equal(parseDashboardCrmResponse({
    data: { ...crm, crm: { ...crm.crm, monthlyNewContacts: [{ month: "2026-13", count: 1 }] } },
  }).data, null);
  assert.equal(parseDashboardCrmResponse({
    data: { ...crm, crm: { ...crm.crm, recentContacts: [{ ...crm.crm.recentContacts[0], createdAt: 42 }] } },
  }).data, null);
  assert.equal(parseDashboardTasksResponse({
    data: { ...tasks, tasks: [{ ...tasks.tasks[0], priority: "critical" }] },
  }).data, null);
  assert.equal(parseDashboardTasksResponse({
    data: { ...tasks, tasks: [{ ...tasks.tasks[0], milestoneId: 7 }] },
  }).data, null);
});

test("dashboard parsers read publicError envelopes, plain strings, and reject garbage errors", () => {
  const publicError = { error: { code: "FORBIDDEN", message: "Forbidden." } };

  assert.equal(parseDashboardProjectsResponse(publicError).error, "Forbidden.");
  assert.equal(parseDashboardCrmResponse(publicError).error, "Forbidden.");
  assert.equal(parseDashboardTasksResponse(publicError).error, "Forbidden.");
  assert.equal(parseDashboardBootstrapResponse(publicError).error, "Forbidden.");
  assert.equal(parseDashboardOverviewShellResponse(publicError).error, "Forbidden.");
  assert.equal(parseErrorFromPayload(publicError, "fallback"), "Forbidden.");

  assert.equal(parseDashboardProjectsResponse({ error: "Sessão expirada." }).error, "Sessão expirada.");
  assert.equal(parseDashboardBootstrapResponse({ error: "Sessão expirada." }).error, "Sessão expirada.");
  assert.equal(parseErrorFromPayload({ error: "Sessão expirada." }, "fallback"), "Sessão expirada.");

  assert.equal(parseDashboardProjectsResponse({ error: 500 }).error, null);
  assert.equal(parseDashboardProjectsResponse({ error: { code: "FORBIDDEN" } }).error, null);
  assert.equal(parseDashboardProjectsResponse({ error: null }).error, null);
  assert.equal(parseDashboardBootstrapResponse({ error: { message: 42 } }).error, null);
  assert.equal(parseDashboardTasksResponse({ error: { code: "FORBIDDEN" } }).error, null);
  assert.equal(parseErrorFromPayload({ error: { code: "FORBIDDEN" } }, "fallback"), "fallback");
  assert.equal(parseErrorFromPayload({ error: 500 }, "fallback"), "fallback");
});

test("dashboard overview preserves the branded bento layout", () => {
  const clientSource = readFileSync(new URL("../src/dashboard/dashboard-client.tsx", import.meta.url), "utf8");
  const stylesheet = readFileSync(new URL("../src/dashboard/dashboard.css", import.meta.url), "utf8");

  assert.match(clientSource, /className="brand-panel relative overflow-hidden/);
  assert.match(clientSource, /function HeroMetrics/);
  assert.match(clientSource, /function ProjectsKpiCard/);
  assert.match(clientSource, /function CrmKpiCard/);
  assert.match(clientSource, /<ProjectsKpiCard[\s\S]*<CrmKpiCard[\s\S]*<AttentionTasksCard[\s\S]*<MilestonesPanel/);
  assert.match(clientSource, /grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-\[330px\]/);
  assert.match(clientSource, /md:text-\[length:var\(--text-ui-dashboard-title-lg\)\]/);
  assert.doesNotMatch(clientSource, /md:text-heading-1 text-\[length:var\(--text-ui-dashboard-title-lg\)\]/);
  assert.match(clientSource, /const showLoading = isLoading && !projects/);
  assert.match(clientSource, /const showLoading = isLoading && !crm/);
  assert.match(clientSource, /<ProjectsKpiCard projects=\{data\.projects\} isLoading=\{data\.isProjectsLoading\}/);
  assert.match(clientSource, /<CrmKpiCard crm=\{data\.crm\} isLoading=\{data\.isCrmLoading\}/);
  assert.match(clientSource, /lg:col-start-3 lg:row-start-1 lg:row-span-2 lg:h-full/);
  assert.doesNotMatch(clientSource, /href=\{`\/crm\?contact=/);
  assert.doesNotMatch(stylesheet, /\.dashboard-briefing\s*\{/);
  assert.doesNotMatch(clientSource, /function ProjectsMilestonesList/);
  assert.match(clientSource, /function OverviewView[\s\S]*<MilestonesPanel/);
});

test("projects dashboard presents one coherent, accessible health story", () => {
  const clientSource = readFileSync(new URL("../src/dashboard/dashboard-client.tsx", import.meta.url), "utf8");
  const stylesheet = readFileSync(new URL("../src/dashboard/dashboard.css", import.meta.url), "utf8");

  assert.match(clientSource, /projectsAttention \?\? 0/);
  assert.match(clientSource, /allAttentionIsMissingOwners/);
  assert.match(clientSource, /activeProjects === 1[\s\S]*dictionary\.welcome\.activeProjectOne/);
  assert.match(clientSource, /overdueProjects > 0 \? "risk" : "neutral"/);
  assert.match(clientSource, /role="img"[\s\S]*aria-label=\{`\$\{onTrackCount\}/);
  assert.match(clientSource, /function PortfolioHealthCard/);
  assert.doesNotMatch(clientSource, /md:grid-cols-\[minmax\(10rem,0\.7fr\)/);
  assert.doesNotMatch(clientSource, /dashboard-projects-grid--single/);
  assert.match(stylesheet, /grid-template-columns: minmax\(0, 1fr\) 23\.75rem/);
  assert.match(stylesheet, /@media \(min-width: 1081px\)/);
  assert.match(stylesheet, /position: sticky;[\s\S]*top: 1\.5rem/);
  assert.match(clientSource, /dictionary\.projects\.noOwner, tone: "watch"/);
  assert.doesNotMatch(stylesheet, /dashboard-attention-count/);
  assert.doesNotMatch(stylesheet, /gap: 1\.375rem/);
});

test("projects dashboard keeps its health card in populated and empty states", () => {
  const populatedHtml = renderToStaticMarkup(createElement(ProjectsView, { projects, isLoading: false }));
  const onTrackProjects = {
    ...projects,
    kpis: {
      ...projects.kpis,
      projectsAttention: 0,
      projectsOnTrack: 3,
    },
    projects: { ...projects.projects, overdue: [], attention: [] },
  };
  const emptyProjects = {
    ...projects,
    kpis: {
      ...projects.kpis,
      projectsActive: 0,
      projectsAttention: 0,
      projectsOnTrack: 0,
    },
    projects: { overdue: [], attention: [], milestones: [] },
  };
  const onTrackHtml = renderToStaticMarkup(createElement(ProjectsView, { projects: onTrackProjects, isLoading: false }));
  const emptyHtml = renderToStaticMarkup(createElement(ProjectsView, { projects: emptyProjects, isLoading: false }));

  assert.match(populatedHtml, />Resumo</);
  assert.doesNotMatch(populatedHtml, />EM CURSO</);
  assert.match(populatedHtml, /data-health-status="true"[^>]*>[^]*Requer atenção/);
  assert.match(onTrackHtml, /data-health-status="true"[^>]*>[^]*No rumo/);
  assert.match(emptyHtml, /data-health-status="true"[^>]*>[^]*Sem projetos/);
  assert.match(populatedHtml, />projetos em curso</);
  assert.match(populatedHtml, />metas previstas</);
  assert.match(populatedHtml, />nos próximos 7 dias</);
  assert.doesNotMatch(populatedHtml, />Com base em prazos/);
  assert.match(populatedHtml, /dashboard-projects-health[\s\S]*dashboard-projects-attention/);
  assert.match(emptyHtml, />Resumo</);
  assert.match(emptyHtml, />Tudo no rumo</);
  assert.match(emptyHtml, /--project-hero-subtle/);
});

test("contacts dashboard keeps the summary hierarchy, aligned chart labels, and empty state", () => {
  const monthlyNewContacts = Array.from({ length: 12 }, (_, index) => ({
    month: `2025-${String(index + 1).padStart(2, "0")}`,
    count: index === 11 ? 2 : 0,
  }));
  const populatedCrm = {
    ...crm,
    crm: {
      ...crm.crm,
      monthlyNewContacts,
      recentContacts: [{
        ...crm.crm.recentContacts[0],
        createdAt: "2026-08-04T12:00:00.000Z",
      }],
    },
  };

  const populatedHtml = renderToStaticMarkup(createElement(ClientsView, { crm: populatedCrm, isLoading: false }));
  assert.match(populatedHtml, /dashboard-clients-grid/);
  assert.match(populatedHtml, /dashboard-rhythm-card/);
  assert.match(populatedHtml, />Resumo</);
  assert.match(populatedHtml, />A crescer</);
  assert.match(populatedHtml, /aria-labelledby="dashboard-client-rhythm-title"/);
  assert.match(populatedHtml, /id="dashboard-client-rhythm-title"/);
  assert.match(populatedHtml, /role="group" aria-label="Este mês: 2 contactos; vs\. mês anterior: 0 contactos\."/);
  assert.match(populatedHtml, /data-rhythm-month-label="2025-01"/);
  assert.match(populatedHtml, /aria-label="dezembro · 2 contactos"/);
  assert.match(populatedHtml, />Adicionado a</);
  assert.match(populatedHtml, />04\/08</);

  const emptyCrm = {
    ...crm,
    crm: { ...crm.crm, monthlyNewContacts, recentContacts: [] },
  };
  const emptyHtml = renderToStaticMarkup(createElement(ClientsView, { crm: emptyCrm, isLoading: false }));
  assert.match(emptyHtml, />0<\/span> contactos</);
  assert.match(emptyHtml, />Sem contactos recentes\.</);
  assert.match(emptyHtml, />Novo contacto</);
  assert.match(emptyHtml, /flex h-full flex-col items-center justify-center gap-3/);
});

test("dashboard tabs share quick-create, count-pill, and empty-state primitives", () => {
  const clientSource = readFileSync(new URL("../src/dashboard/dashboard-client.tsx", import.meta.url), "utf8");
  const primitivesSource = readFileSync(new URL("../src/dashboard/primitives.tsx", import.meta.url), "utf8");

  assert.match(primitivesSource, /export function QuickCreateAction/);
  assert.match(primitivesSource, /prefetch=\{false\}/);
  assert.match(primitivesSource, /export function DashboardCountPill/);
  assert.match(primitivesSource, /neutral:[\s\S]*accent:[\s\S]*warning:/);
  assert.match(primitivesSource, /px-2\.5 py-1 text-label font-bold/);
  assert.match(primitivesSource, /dashboardMonoTabularClassName/);
  assert.match(primitivesSource, /export function DashboardEmptyState/);
  assert.match(clientSource, /<QuickCreateAction[\s\S]*href="\/crm\?create=contact"/);
  assert.match(clientSource, /<DashboardCountPill count=\{kpis\?\.projectsAttention \?\? 0\} tone="warning"/);
  assert.match(clientSource, /id="dashboard-project-attention" className=\{CARD_TITLE\}/);
  assert.match(clientSource, /<div className=\{`min-h-0 flex-1 \$\{bodyClassName\}`\}>/);
  assert.match(clientSource, /dashboard-contacts-list flex-1 p-5/);
  assert.match(clientSource, /className="min-h-64 flex-1 bg-/);
  assert.match(clientSource, /TODO\(dashboard-crm\): deep-link contact cards/);
  assert.doesNotMatch(clientSource, /<Link[\s\S]{0,180}surface-button-brand[\s\S]{0,180}>\s*<Plus/);
});

test("projects dashboard provides a quick-create handoff to the projects module", () => {
  const html = renderToStaticMarkup(createElement(ProjectsView, { projects, isLoading: false }));
  const customAction = ProjectQuickCreateAction({
    href: "/projetos",
    label: "Novo projeto",
  });

  assert.match(html, /href="\/projects"[^>]*>Ver todos os projetos/);
  assert.match(html, /href="\/projects\?create=project"[^>]*>[\s\S]*Novo projeto/);
  assert.equal(customAction.props.href, "/projetos?create=project");
  assert.equal(buildProjectQuickCreateHref("/projetos?view=grid#recent"), "/projetos?view=grid&create=project#recent");
  assert.equal(buildTaskQuickCreateHref("/projetos?view=tasks#urgent"), "/projetos?view=tasks&create=task#urgent");
});

test("dashboard renders the restored branded overview with live KPI content", () => {
  const client = {
    async getProjects() { return { data: projects }; },
    async getCrm() { return { data: crm }; },
    async getTasks() { return { data: tasks }; },
  };
  const html = renderToStaticMarkup(createElement(AppDashboard, {
    client,
    contributions: [{ key: "test", sections: ["projects", "crm", "tasks"] }],
    initialData: { projects, crm, tasks },
    viewerFirstName: "Leonel",
  }));

  assert.match(html, /class="brand-panel [^"]*"/);
  assert.match(html, /href="\/projects"[^>]*>[\s\S]*Projetos[\s\S]*1[\s\S]*ativos/);
  assert.match(html, /href="\/crm"[^>]*>[\s\S]*CRM[\s\S]*2[\s\S]*contactos/);
  assert.match(html, />Tarefas</);
  assert.match(html, />Próximas metas</);
  assert.match(html, /class="truncate text-meta"[^>]*>Platform · <span class="text-data">PROJECT-/);
  assert.doesNotMatch(html, /class="text-data truncate text-label"/);
  assert.match(html, /lg:col-span-2 lg:col-start-1 lg:row-start-2/);
  assert.doesNotMatch(html, /h-\[340px\]/);
  assert.match(html, /lg:col-start-3 lg:row-start-1 lg:row-span-2 lg:h-full/);
  assert.doesNotMatch(html, /dashboard-briefing/);
});
