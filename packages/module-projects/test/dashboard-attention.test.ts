import assert from "node:assert/strict";
import test from "node:test";
import type { DashboardAssignedTask } from "@brightweblabs/app-shell";
import {
  buildTasksDashboardData,
  getDashboardTaskAttentionState,
  rankDashboardAttentionTasks,
} from "../src/dashboard.ts";

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
