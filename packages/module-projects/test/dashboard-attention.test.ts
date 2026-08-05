import assert from "node:assert/strict";
import test from "node:test";
import type { DashboardAssignedTask } from "@brightweblabs/app-shell";
import {
  buildTasksDashboardData,
  getDashboardProjectAttentionReason,
  getDashboardTaskAttentionState,
  rankDashboardAttentionProjects,
  rankDashboardAttentionTasks,
} from "../src/dashboard.ts";
import type { ProjectListItem } from "../src/data.ts";

const now = new Date("2026-08-05T12:00:00.000Z");

function task(
  id: string,
  overrides: Partial<DashboardAssignedTask> = {},
): DashboardAssignedTask {
  return {
    id,
    projectId: "project-1",
    projectName: "Projeto",
    projectCode: "PRJ-1",
    title: id,
    status: "todo",
    priority: "medium",
    dueDate: "2026-08-05",
    blockedReason: null,
    milestoneId: null,
    updatedAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

function project(id: string, overrides: Partial<ProjectListItem> = {}): ProjectListItem {
  return {
    id,
    organizationId: "organization-1",
    organizationName: "Organização",
    organizationOwnerLabel: null,
    organizationOwnerEmail: null,
    organizationOwnerPhone: null,
    name: id,
    code: id.toUpperCase(),
    status: "active",
    health: "on_track",
    ownerProfileId: "profile-1",
    ownerLabel: "Ada Lovelace",
    ownerEmail: "ada@example.test",
    ownerPhone: null,
    activatedAt: "2026-08-01",
    startDate: "2026-08-01",
    targetDate: "2026-08-20",
    completedAt: null,
    cancellationReason: null,
    summary: null,
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
    taskStats: { total: 4, done: 1, overdue: 0, blocked: 0 },
    milestoneStats: { total: 1, achieved: 0, delayed: 0 },
    ...overrides,
  };
}

test("project attention reasons stay project-level and prioritize the strongest signal", () => {
  assert.equal(getDashboardProjectAttentionReason(project("overdue", { targetDate: "2026-08-04" }), now), "overdue");
  assert.equal(getDashboardProjectAttentionReason(project("risk", { health: "at_risk" }), now), "at_risk");
  assert.equal(getDashboardProjectAttentionReason(project("blocked", { taskStats: { total: 4, done: 1, overdue: 0, blocked: 2 } }), now), "blocked_tasks");
  assert.equal(getDashboardProjectAttentionReason(project("unowned", { ownerProfileId: null, ownerLabel: null }), now), "without_owner");
  assert.equal(getDashboardProjectAttentionReason(project("soon", { targetDate: "2026-08-10" }), now), "due_soon");
  assert.equal(getDashboardProjectAttentionReason(project("healthy"), now), null);
});

test("project attention queue ranks severity before date and omits healthy projects", () => {
  const ranked = rankDashboardAttentionProjects([
    project("soon", { targetDate: "2026-08-10" }),
    project("healthy"),
    project("risk", { health: "at_risk", targetDate: "2026-08-30" }),
    project("overdue-later", { targetDate: "2026-08-04" }),
    project("overdue-earlier", { targetDate: "2026-08-01" }),
    project("unowned", { ownerProfileId: null, ownerLabel: null }),
  ], now);

  assert.deepEqual(ranked.map((item) => item.id), ["overdue-earlier", "overdue-later", "risk", "unowned", "soon"]);
});

test("attention states use calendar dates and keep blocked separate from overdue", () => {
  assert.equal(getDashboardTaskAttentionState(task("blocked", { status: "blocked", dueDate: "2026-08-01" }), now), "blocked");
  assert.equal(getDashboardTaskAttentionState(task("overdue", { dueDate: "2026-08-04" }), now), "overdue");
  assert.equal(getDashboardTaskAttentionState(task("today"), now), "today");
  assert.equal(getDashboardTaskAttentionState(task("soon", { dueDate: "2026-08-12" }), now), "soon");
  assert.equal(getDashboardTaskAttentionState(task("later", { dueDate: "2026-08-13" }), now), null);
  assert.equal(getDashboardTaskAttentionState(task("undated", { dueDate: null }), now), null);
});

test("attention ranking applies category, then priority, then due date", () => {
  const ranked = rankDashboardAttentionTasks([
    task("today-urgent", { priority: "urgent" }),
    task("overdue-low", { priority: "low", dueDate: "2026-08-01" }),
    task("blocked-low", { status: "blocked", priority: "low", dueDate: "2026-09-01" }),
    task("blocked-urgent", { status: "blocked", priority: "urgent", dueDate: null }),
    task("overdue-urgent-newer", { priority: "urgent", dueDate: "2026-08-04" }),
    task("overdue-urgent-older", { priority: "urgent", dueDate: "2026-08-02" }),
    task("soon-urgent", { priority: "urgent", dueDate: "2026-08-08" }),
    task("later", { priority: "urgent", dueDate: "2026-08-20" }),
  ], now);

  assert.deepEqual(ranked.map((item) => item.id), [
    "blocked-urgent",
    "blocked-low",
    "overdue-urgent-older",
    "overdue-urgent-newer",
    "overdue-low",
    "today-urgent",
    "soon-urgent",
  ]);
});

test("tasks response exposes honest pagination beyond the former 100-task ceiling", () => {
  const data = buildTasksDashboardData({
    generatedAt: now.toISOString(),
    total: 145,
    dueThisWeek: 12,
    overdue: 7,
    blocked: 3,
    tasks: Array.from({ length: 50 }, (_, index) => task(`task-${index}`)),
    attentionTotal: 27,
    attentionTasks: [task("attention")],
    page: 2,
    pageSize: 50,
  });

  assert.deepEqual(data.pagination, { page: 2, pageSize: 50, hasMore: true });
  assert.equal(data.kpis.total, 145);
  assert.equal(data.attention.total, 27);
});
