import assert from "node:assert/strict";
import test from "node:test";

import {
  parseDashboardCrmResponse,
  parseDashboardProjectsResponse,
  parseDashboardTasksResponse,
} from "../packages/app-shell/src/dashboard/dashboard-response-parser.ts";
import {
  buildCrmDashboardOverviewData,
} from "../packages/module-crm/src/dashboard.ts";
import {
  createCrmDashboardOverviewGetHandler,
} from "../packages/module-crm/src/http.ts";
import type {
  CrmContact,
  CrmStatusLog,
} from "../packages/module-crm/src/data.ts";
import {
  buildProjectsDashboardData,
  buildTasksDashboardData,
  getTasksDashboardData,
} from "../packages/module-projects/src/dashboard.ts";
import {
  createProjectsDashboardGetHandler,
  createProjectsDashboardOverviewGetHandler,
  createTasksDashboardGetHandler,
} from "../packages/module-projects/src/http.ts";
import type { ProjectListItem } from "../packages/module-projects/src/data.ts";

const generatedAt = "2026-07-24T12:00:00.000Z";

const project: ProjectListItem = {
  id: "project-1",
  organizationId: "org-1",
  organizationName: "BrightWeb",
  organizationOwnerLabel: null,
  organizationOwnerEmail: null,
  organizationOwnerPhone: null,
  name: "Platform",
  code: "BW-1",
  status: "active",
  health: "at_risk",
  ownerProfileId: "profile-1",
  ownerLabel: "Ada Lovelace",
  ownerEmail: "ada@example.com",
  ownerPhone: null,
  activatedAt: "2026-07-01",
  targetDate: "2026-07-23",
  completedAt: null,
  cancellationReason: null,
  summary: null,
  createdAt: "2026-07-01T09:00:00.000Z",
  updatedAt: generatedAt,
  taskStats: { total: 2, done: 0, overdue: 1, blocked: 1 },
  milestoneStats: { total: 1, achieved: 0, delayed: 1 },
};

const contact: CrmContact = {
  id: "contact-1",
  first_name: "Grace",
  last_name: "Hopper",
  email: "grace@example.com",
  phone: null,
  status: "lead",
  source: "referral",
  owner_id: null,
  organization_id: "org-1",
  created_at: "2026-07-23T10:00:00.000Z",
  updated_at: generatedAt,
  organizations: { name: "Compiler Works" },
};

const statusChange: CrmStatusLog = {
  id: "change-1",
  contact_id: contact.id,
  previous_status: null,
  new_status: "lead",
  reason: null,
  changed_at: generatedAt,
  changed_by_user_id: null,
  changed_by_label: null,
  contact_label: "Grace Hopper",
};

test("aggregate dashboard handlers do not expose dynamic-route context", () => {
  const dependencies = {} as never;

  assert.equal(createProjectsDashboardOverviewGetHandler(dependencies).length, 1);
  assert.equal(createTasksDashboardGetHandler(dependencies).length, 1);
  assert.equal(createCrmDashboardOverviewGetHandler(dependencies).length, 1);
  assert.equal(createProjectsDashboardGetHandler(dependencies).length, 2);
});

test("Projects dashboard handler returns a full payload accepted by the real parser", async () => {
  const oldStatsPayload = { total: 1, planned: 0, active: 1, atRisk: 1, overdue: 1 };
  assert.equal(parseDashboardProjectsResponse(oldStatsPayload).data, null);

  const data = buildProjectsDashboardData({
    generatedAt,
    portfolioStats: oldStatsPayload,
    overdueProjects: [project],
    attentionProjects: [project],
    attentionTotal: 1,
    milestones: [{ id: "milestone-1", projectId: project.id, projectName: project.name, projectCode: project.code, title: "Release", status: "in_progress", targetDate: "2026-07-25" }],
    dueNext7Days: 0,
    withoutOwner: 0,
    blockedTasks: 1,
  });
  const handler = createProjectsDashboardOverviewGetHandler({
    getAccess: async () => ({ ok: true, supabase: {}, profileId: "profile-1", role: "admin" }),
    getProjectsDashboardData: async () => data,
  } as never);
  const response = await handler(new Request("https://example.test/api/dashboard/projects"));
  const parsed = parseDashboardProjectsResponse(await response.json());

  assert.equal(response.status, 200);
  assert.equal(parsed.error, null);
  assert.equal(parsed.data?.kpis.projectsActive, 1);
  assert.equal(parsed.data?.kpis.projectBlockedTasks, 1);
  assert.equal(parsed.data?.kpis.projectsAttention, 1);
  assert.equal(parsed.data?.projects.overdue[0]?.name, "Platform");
  assert.equal(parsed.data?.projects.attention[0]?.attentionReason, "overdue");
  assert.equal(parsed.data?.projects.milestones[0]?.title, "Release");
});

test("CRM dashboard handler turns the live stats shape into non-zero parser-safe data", async () => {
  const oldStatsPayload = {
    total: 1,
    byStatus: { lead: 1, qualified: 0, proposal: 0, won: 0, lost: 0 },
  };
  assert.equal(parseDashboardCrmResponse(oldStatsPayload).data, null);

  const data = buildCrmDashboardOverviewData({
    generatedAt,
    stats: oldStatsPayload,
    contacts: [contact],
    recentChanges: [statusChange],
    newLast7Days: 1,
    newLast30Days: 1,
    newLastYear: 1,
    unassignedContacts: 1,
  });
  const handler = createCrmDashboardOverviewGetHandler({
    getAccess: async () => ({ ok: true, supabase: {}, profileId: "profile-1", role: "admin" }),
    getDashboardOverview: async () => data,
  } as never);
  const response = await handler(new Request("https://example.test/api/dashboard/crm"));
  const parsed = parseDashboardCrmResponse(await response.json());

  assert.equal(response.status, 200);
  assert.equal(parsed.error, null);
  assert.equal(parsed.data?.kpis.crmTotalContacts, 1);
  assert.equal(parsed.data?.kpis.crmNewLast7Days, 1);
  assert.equal(parsed.data?.crm.statusBreakdown.lead, 1);
  assert.equal(parsed.data?.crm.recentContacts[0]?.company, "Compiler Works");
});

test("CRM dashboard builds exactly twelve ordered monthly contact points across year boundaries", () => {
  const data = buildCrmDashboardOverviewData({
    generatedAt: "2026-07-24T12:00:00.000Z",
    stats: { total: 5, byStatus: { lead: 5, qualified: 0, proposal: 0, won: 0, lost: 0 } },
    contacts: [],
    recentChanges: [],
    newLast7Days: 2,
    newLast30Days: 2,
    newLastYear: 5,
    unassignedContacts: 0,
    createdDatesLastYear: [
      "2025-08-01T09:00:00.000Z",
      "2025-12-12T09:00:00.000Z",
      "2026-01-03T09:00:00.000Z",
      "2026-07-01T09:00:00.000Z",
      "2026-07-20T09:00:00.000Z",
    ],
  });

  assert.deepEqual(data.crm.monthlyNewContacts, [
    { month: "2025-08", count: 1 }, { month: "2025-09", count: 0 },
    { month: "2025-10", count: 0 }, { month: "2025-11", count: 0 },
    { month: "2025-12", count: 1 }, { month: "2026-01", count: 1 },
    { month: "2026-02", count: 0 }, { month: "2026-03", count: 0 },
    { month: "2026-04", count: 0 }, { month: "2026-05", count: 0 },
    { month: "2026-06", count: 0 }, { month: "2026-07", count: 2 },
  ]);
});

test("Tasks dashboard handler returns assigned task rollups accepted by the real parser", async () => {
  const data = buildTasksDashboardData({
    generatedAt,
    total: 1,
    dueThisWeek: 1,
    overdue: 0,
    blocked: 0,
    tasks: [{
      id: "task-1",
      projectId: project.id,
      projectName: project.name,
      projectCode: project.code,
      title: "Ship the dashboard",
      status: "in_progress",
      priority: "high",
      dueDate: "2026-07-25",
      blockedReason: null,
      milestoneId: null,
      updatedAt: generatedAt,
    }],
    attentionTotal: 1,
    attentionTasks: [{
      id: "task-1",
      projectId: project.id,
      projectName: project.name,
      projectCode: project.code,
      title: "Ship the dashboard",
      status: "in_progress",
      priority: "high",
      dueDate: "2026-07-25",
      blockedReason: null,
      milestoneId: null,
      updatedAt: generatedAt,
    }],
    page: 1,
    pageSize: 50,
  });
  let requestedProfileId: string | undefined;
  let requestedOptions: { page?: number; pageSize?: number } | undefined;
  const handler = createTasksDashboardGetHandler({
    getAccess: async () => ({ ok: true, supabase: {}, profileId: "profile-1", role: "admin" }),
    getTasksDashboardData: async (_supabase: unknown, profileId: string | undefined, _now: Date, options: { page?: number; pageSize?: number }) => {
      requestedProfileId = profileId;
      requestedOptions = options;
      return data;
    },
  } as never);
  const response = await handler(new Request("https://example.test/api/dashboard/tasks?page=3&pageSize=25"));
  const parsed = parseDashboardTasksResponse(await response.json());

  assert.equal(response.status, 200);
  assert.equal(requestedProfileId, "profile-1");
  assert.deepEqual(requestedOptions, { page: 3, pageSize: 25 });
  assert.equal(parsed.error, null);
  assert.equal(parsed.data?.kpis.total, 1);
  assert.equal(parsed.data?.tasks[0]?.title, "Ship the dashboard");
});

test("task dashboard returns exact counts for pagination and attention summaries", async () => {
  const countModes: Array<string | undefined> = [];
  const excludedStatuses: string[] = [];
  const supabase = {
    from(table: string) {
      assert.equal(table, "project_tasks");
      const result = { data: [], count: 0, error: null };
      const query = {
        select(_columns: string, options?: { count?: string }) {
          if (options?.count) countModes.push(options.count);
          return query;
        },
        neq(column: string, value: string) {
          if (column === "status") excludedStatuses.push(value);
          return query;
        },
        eq() { return query; },
        gte() { return query; },
        lte() { return query; },
        lt() { return query; },
        or() { return query; },
        order() { return query; },
        limit() { return query; },
        range() { return query; },
        then(resolve: (value: typeof result) => unknown) {
          return Promise.resolve(resolve(result));
        },
      };
      return query;
    },
  };

  await getTasksDashboardData(supabase as never, undefined, new Date(generatedAt));
  assert.deepEqual(countModes, ["exact", "exact", "exact", "exact", "exact"]);
  assert.ok(excludedStatuses.filter((status) => status === "blocked").length >= 2);
});
