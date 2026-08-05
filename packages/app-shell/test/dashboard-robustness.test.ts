import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AppDashboard, getAttentionPreviewCapacity } from "../src/dashboard/dashboard-client.tsx";
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
  assert.match(clientSource, /<MilestonesPanel items=\{milestones\} isLoading=\{isLoading && !projects\} \/>/);
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
