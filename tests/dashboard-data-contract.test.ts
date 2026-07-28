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
} from "../packages/module-projects/src/dashboard.ts";
import {
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

test("Projects dashboard handler returns a full payload accepted by the real parser", async () => {
  const oldStatsPayload = { total: 1, planned: 0, active: 1, atRisk: 1, overdue: 1 };
  assert.equal(parseDashboardProjectsResponse(oldStatsPayload).data, null);

  const data = buildProjectsDashboardData({
    generatedAt,
    portfolioStats: oldStatsPayload,
    overdueProjects: [project],
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
  assert.equal(parsed.data?.projects.overdue[0]?.name, "Platform");
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
  });
  let requestedProfileId: string | undefined;
  const handler = createTasksDashboardGetHandler({
    getAccess: async () => ({ ok: true, supabase: {}, profileId: "profile-1", role: "admin" }),
    getTasksDashboardData: async (_supabase: unknown, profileId: string | undefined) => {
      requestedProfileId = profileId;
      return data;
    },
  } as never);
  const response = await handler(new Request("https://example.test/api/dashboard/tasks"));
  const parsed = parseDashboardTasksResponse(await response.json());

  assert.equal(response.status, 200);
  assert.equal(requestedProfileId, "profile-1");
  assert.equal(parsed.error, null);
  assert.equal(parsed.data?.kpis.total, 1);
  assert.equal(parsed.data?.tasks[0]?.title, "Ship the dashboard");
});
