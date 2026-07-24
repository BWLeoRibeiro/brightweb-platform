import assert from "node:assert/strict";
import test from "node:test";

import { createDashboardRequestGenerations } from "../src/dashboard/dashboard-request-generations.ts";
import {
  parseDashboardBootstrapResponse,
  parseDashboardCrmResponse,
  parseDashboardProjectsResponse,
  parseDashboardTasksResponse,
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
};

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
