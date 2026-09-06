import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { useShellNotifications } from "../packages/app-shell/src/use-shell-notifications.ts";
import { useDashboardData } from "../packages/app-shell/src/dashboard/use-dashboard-data.ts";
import { ThemeProvider, useTheme } from "../packages/ui/src/components/theme-provider.tsx";
import type { DashboardDataClient, DashboardTasksData } from "../packages/app-shell/src/dashboard/types.ts";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function browser(t: test.TestContext) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const window = Object.assign(new EventTarget(), { setInterval: () => 1, clearInterval: () => {}, cleanup: [] as Array<() => Promise<void>> });
  Object.defineProperty(globalThis, "window", { configurable: true, value: window });
  t.after(async () => { for (const cleanup of window.cleanup) await cleanup(); if (previous) Object.defineProperty(globalThis, "window", previous); else delete globalThis.window; });
  return window;
}
const notification = (id: string) => ({ id, summary: id, createdAt: "2026-09-05T12:00:00Z" });
const items = (...ids: string[]) => Response.json({ items: ids.map(notification), unreadCount: ids.length, seenAt: null });
async function notificationHarness(t: test.TestContext) {
  const window = browser(t);
  const calls: Array<ReturnType<typeof deferred<Response>> & { url: string; method: string }> = [];
  t.mock.method(globalThis, "fetch", (url: string, init: RequestInit = {}) => {
    const call = { ...deferred<Response>(), url, method: init.method ?? "GET" }; calls.push(call); return call.promise;
  });
  let state!: ReturnType<typeof useShellNotifications>;
  function Harness(props: { endpoint: string; enabled?: boolean; refreshIntervalMs?: number }) { state = useShellNotifications(props); return null; }
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(Harness, { endpoint: "/old" })); });
  window.cleanup.push(async () => { await act(async () => renderer.unmount()); });
  await act(async () => calls[0].resolve(items("one", "two")));
  await act(async () => state.onOpenChange!(true));
  await act(async () => calls[1].resolve(items("one", "two")));
  return { calls, window, state: () => state, renderer, Harness };
}
for (const bulk of [false, true]) {
  test(`notification ${bulk ? "bulk" : "single"} dismissal cannot be reversed by an older read`, async (t) => {
    const h = await notificationHarness(t);
    await act(async () => h.window.dispatchEvent(new Event("brightweb:notifications:refresh")));
    const oldItems = h.calls.at(-1)!;
    await act(async () => bulk ? h.state().onDismissAll!() : h.state().onDismiss!("one"));
    const deletion = h.calls.at(-1)!;
    await act(async () => deletion.resolve(Response.json({ ok: true })));
    await act(async () => oldItems.resolve(items("one", "two")));
    assert.deepEqual(h.state().notifications!.map((item) => item.id), bulk ? [] : ["two"]);
    const freshItems = h.calls.findLast((call) => call.url === "/old?limit=8")!;
    await act(async () => freshItems.resolve(bulk ? items("new") : items("two", "new")));
    assert.deepEqual(h.state().notifications!.map((item) => item.id), bulk ? ["new"] : ["two", "new"]);
  });
  test(`notification ${bulk ? "bulk" : "single"} failure recovers only its current configuration`, async (t) => {
    const h = await notificationHarness(t);
    await act(async () => bulk ? h.state().onDismissAll!() : h.state().onDismiss!("one"));
    await act(async () => h.calls.at(-1)!.reject(new Error("failed")));
    const recovery = h.calls.findLast((call) => call.url === "/old?limit=8")!;
    await act(async () => recovery.resolve(items("one", "two")));
    assert.equal(h.state().notifications!.length, 2);
    await act(async () => bulk ? h.state().onDismissAll!() : h.state().onDismiss!("one"));
    const obsoleteDeletion = h.calls.at(-1)!;
    await act(async () => h.renderer.update(React.createElement(h.Harness, { endpoint: "/new" })));
    const newItems = h.calls.findLast((call) => call.url === "/new?limit=8")!;
    await act(async () => newItems.resolve(items("new")));
    const callCount = h.calls.length;
    await act(async () => obsoleteDeletion.reject(new Error("obsolete")));
    assert.equal(h.calls.length, callCount);
    assert.equal(h.state().notifications![0].id, "new");
  });
  test(`notification ${bulk ? "bulk" : "single"} completion after disabling does not restart reads`, async (t) => {
    const h = await notificationHarness(t);
    await act(async () => bulk ? h.state().onDismissAll!() : h.state().onDismiss!("one"));
    const deletion = h.calls.at(-1)!;
    await act(async () => h.renderer.update(React.createElement(h.Harness, { endpoint: "/old", enabled: false })));
    const count = h.calls.length;
    await act(async () => deletion.resolve(Response.json({ ok: true })));
    assert.equal(h.calls.length, count);
    assert.deepEqual(h.state().notifications, []);
  });
}
const taskData = (id: string, page = 1): DashboardTasksData => ({
  generatedAt: "2026-09-05T12:00:00Z", kpis: { total: 3, dueThisWeek: 0, overdue: 0, blocked: 0 },
  tasks: [{ id, projectId: "project", projectName: "Project", projectCode: null, title: id, status: "todo", priority: "medium", dueDate: null, blockedReason: null, milestoneId: null, updatedAt: "2026-09-05T12:00:00Z" }],
  attention: { total: 0, tasks: [] }, pagination: { page, pageSize: 1, hasMore: true },
});
test("task refresh owns its base, paging retries, and superseded results cannot append", async (t) => {
  const window = browser(t);
  const jobs: Array<ReturnType<typeof deferred<unknown>> & { options: { signal?: AbortSignal; page?: number } }> = [];
  const client: DashboardDataClient = { getProjects: async () => null, getCrm: async () => null, getTasks: (options = {}) => { const job = { ...deferred<unknown>(), options }; jobs.push(job); return job.promise; } };
  let state!: ReturnType<typeof useDashboardData>;
  function Harness() { state = useDashboardData({ client, sections: ["tasks"], initialData: { tasks: taskData("initial") }, messages: { dashboardError: "err", projectsUnavailable: "err", crmUnavailable: "err", tasksUnavailable: "tasks failed", updated: "ok" } }); return null; }
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(Harness)); });
  window.cleanup.push(async () => { await act(async () => renderer.unmount()); });
  await act(async () => state.refresh());
  await act(async () => state.loadMoreTasks());
  assert.equal(jobs.length, 1, "paging is blocked while base refresh is pending");
  await act(async () => jobs[0].resolve({ data: taskData("fresh") }));
  assert.equal(state.isTasksLoading, false);
  await act(async () => state.loadMoreTasks());
  await act(async () => jobs[1].reject(new Error("page failed")));
  assert.equal(state.isTasksLoadingMore, false);
  assert.equal(state.errors.tasks, "tasks failed");
  await act(async () => state.loadMoreTasks());
  assert.equal(jobs[2].options.page, 2);
  await act(async () => state.refresh());
  assert.equal(jobs[2].options.signal!.aborted, true);
  await act(async () => jobs[3].resolve({ data: taskData("newest") }));
  await act(async () => jobs[2].resolve({ data: taskData("obsolete-page", 2) }));
  assert.deepEqual(state.tasks!.tasks.map((task) => task.id), ["newest"]);
  await act(async () => state.loadMoreTasks());
  await act(async () => jobs[4].resolve({ data: taskData("page-two", 2) }));
  assert.deepEqual(state.tasks!.tasks.map((task) => task.id), ["newest", "page-two"]);
});
for (const failure of ["acquire", "read", "write"]) {
  test(`theme provider remains usable when storage ${failure} fails`, async (t) => {
    const window = browser(t);
    Object.assign(window, { matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
    Object.defineProperty(window, "localStorage", { get() { if (failure === "acquire") throw new Error("denied"); return { getItem() { if (failure === "read") throw new Error("denied"); return null; }, setItem() { if (failure === "write") throw new Error("denied"); } }; } });
    const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
    const classes = new Set<string>();
    const root = { classList: { add: (value: string) => classes.add(value), remove: (...values: string[]) => values.forEach((value) => classes.delete(value)) }, dataset: {}, style: {} };
    Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: root } });
    t.after(() => { if (previous) Object.defineProperty(globalThis, "document", previous); else delete globalThis.document; });
    let theme!: ReturnType<typeof useTheme>;
    function Probe() { theme = useTheme(); return null; }
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(React.createElement(ThemeProvider, { defaultTheme: "system" }, React.createElement(Probe))); });
    window.cleanup.push(async () => { await act(async () => renderer.unmount()); });
    assert.equal(theme.resolvedTheme, "dark"); assert.ok(classes.has("dark"));
    await act(async () => theme.setTheme("light"));
    assert.equal(theme.resolvedTheme, "light"); assert.ok(classes.has("light"));
  });
}

import { projects, crm } from "./support/dashboard-fixtures.ts";
import { cn as shellClasses } from "../packages/app-shell/src/lib/utils.ts";

test("dashboard overview fallback isolates errors and a section refresh supersedes only that section", async (t) => {
  const window = browser(t);
  const overviews: Array<ReturnType<typeof deferred<unknown>>> = [];
  const projectRequests: Array<ReturnType<typeof deferred<unknown>>> = [];
  const crmRequests: Array<ReturnType<typeof deferred<unknown>>> = [];
  const client: DashboardDataClient = {
    getTasks: async () => null,
    getOverview: () => { const result = deferred<unknown>(); overviews.push(result); return result.promise; },
    getProjects: () => { const result = deferred<unknown>(); projectRequests.push(result); return result.promise; },
    getCrm: () => { const result = deferred<unknown>(); crmRequests.push(result); return result.promise; },
  };
  const notifications: string[] = [];
  let state!: ReturnType<typeof useDashboardData>;
  function Harness() { state = useDashboardData({ client, sections: ["projects", "crm"], initialData: { projects, crm }, messages: { dashboardError: "err", projectsUnavailable: "projects failed", crmUnavailable: "crm failed", tasksUnavailable: "err", updated: "updated" }, onNotify: (message) => notifications.push(message) }); return null; }
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(Harness)); });
  window.cleanup.push(async () => { await act(async () => renderer.unmount()); });
  await act(async () => state.refresh());
  await act(async () => overviews[0].reject(new Error("aggregate unavailable")));
  assert.equal(projectRequests.length, 1); assert.equal(crmRequests.length, 1);
  await act(async () => projectRequests[0].resolve({ data: projects }));
  await act(async () => crmRequests[0].reject(new Error("crm unavailable")));
  assert.equal(state.isProjectsLoading, false); assert.equal(state.isCrmLoading, false);
  assert.deepEqual(state.errors, { crm: "crm failed" }); assert.deepEqual(notifications, []);
  await act(async () => state.refresh());
  await act(async () => window.dispatchEvent(new CustomEvent("dashboard:refresh", { detail: { sections: ["projects"] } })));
  const freshProjects = { ...projects, kpis: { ...projects.kpis, projectsActive: 99 } };
  await act(async () => projectRequests[1].resolve({ data: freshProjects }));
  await act(async () => overviews[1].resolve({ data: { projects, crm } }));
  assert.equal(state.projects!.kpis.projectsActive, 99);
  assert.deepEqual(state.crm, crm); assert.deepEqual(state.errors, {});
  assert.equal(state.isProjectsLoading, false); assert.equal(state.isCrmLoading, false);
});

test("concurrent notification dismissals keep pending IDs hidden during refresh and retain new items", async (t) => {
  const h = await notificationHarness(t);
  await act(async () => h.state().onDismiss!("one")); const first = h.calls.at(-1)!;
  await act(async () => h.state().onDismiss!("two")); const second = h.calls.at(-1)!;
  await act(async () => first.resolve(Response.json({ ok: true })));
  const intermediate = h.calls.findLast((call) => call.url === "/old?limit=8")!;
  await act(async () => intermediate.resolve(items("two", "new")));
  assert.deepEqual(h.state().notifications!.map((item) => item.id), ["new"]);
  await act(async () => second.resolve(Response.json({ ok: true })));
  await act(async () => h.calls.findLast((call) => call.url === "/old?limit=8")!.resolve(items("new")));
  assert.deepEqual(h.state().notifications!.map((item) => item.id), ["new"]);
});

test("notification mutation completion after unmount cannot schedule recovery", async (t) => {
  const h = await notificationHarness(t);
  await act(async () => h.state().onDismiss!("one")); const deletion = h.calls.at(-1)!;
  await act(async () => h.renderer.unmount());
  const count = h.calls.length;
  await act(async () => deletion.reject(new Error("late failure")));
  assert.equal(h.calls.length, count);
});

test("shell class overrides preserve canonical typography and independent colors", () => {
  const classes = shellClasses("text-label text-muted-foreground", "text-body text-destructive").split(" ");
  assert.ok(classes.includes("text-body")); assert.ok(classes.includes("text-destructive"));
  assert.ok(!classes.includes("text-label")); assert.ok(!classes.includes("text-muted-foreground"));
});


test("notification polling preference changes do not detach an active dismissal", async (t) => {
  const h = await notificationHarness(t);
  await act(async () => h.state().onDismiss!("one"));
  const deletion = h.calls.at(-1)!;
  await act(async () => h.renderer.update(React.createElement(h.Harness, { endpoint: "/old", refreshIntervalMs: 60_000 })));
  await act(async () => deletion.resolve(Response.json({ ok: true })));
  const recovery = h.calls.findLast((call) => call.url === "/old?limit=8")!;
  await act(async () => recovery.resolve(items("two")));
  assert.deepEqual(h.state().notifications!.map((item) => item.id), ["two"]);
});

test("duplicate notification dismissal shares its pending mutation and optimistic count", async t => {
  const h = await notificationHarness(t);
  await act(async () => { h.state().onDismiss!("one"); h.state().onDismiss!("one"); });
  assert.equal(h.calls.filter(call => call.method === "DELETE").length, 1);
  assert.equal(h.state().notifications.length, 1);
});

test("dashboard client replacement loads the new source and ignores old requests", async t => {
  const window = browser(t);
  const oldRequest = deferred<any>();
  const first = { getTasks: () => oldRequest.promise } as unknown as DashboardDataClient;
  const second = { getTasks: async () => ({ data: taskData("new-client") }) } as unknown as DashboardDataClient;
  let state!: ReturnType<typeof useDashboardData>;
  function Harness({ client }: { client: DashboardDataClient }) {
    state = useDashboardData({ client, sections: ["tasks"], messages: { dashboardError: "err", projectsUnavailable: "err", crmUnavailable: "err", tasksUnavailable: "err", updated: "ok" } }); return null;
  }
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(React.createElement(Harness, { client: first })); });
  window.cleanup.push(async () => { await act(async () => tree.unmount()); });
  await act(async () => tree.update(React.createElement(Harness, { client: second })));
  await act(async () => oldRequest.resolve({ data: taskData("old-client") }));
  assert.deepEqual(state.tasks?.tasks.map(task => task.id), ["new-client"]);
  assert.equal(state.isTasksLoading, false);
});

test("notification endpoint replacement clears feed state and rejects stale dismissals before recovery", async t => {
  const h = await notificationHarness(t);
  await act(async () => h.renderer.update(React.createElement(h.Harness, { endpoint: "/new" })));
  assert.deepEqual(h.state().notifications, []);
  assert.equal(h.state().unreadCount, 0);
  assert.equal(h.state().seenAt, null);
  assert.equal(h.state().loading, true);
  const count = h.calls.length;
  await act(async () => { h.state().onDismiss!("one"); h.state().onDismissAll!(); });
  assert.equal(h.calls.length, count, "old feed IDs cannot be dismissed through the new endpoint");
  const failedItems = h.calls.findLast(call => call.url === "/new?limit=8")!;
  await act(async () => failedItems.reject(new Error("new feed unavailable")));
  assert.deepEqual(h.state().notifications, []);
  await act(async () => h.state().onDismiss!("one"));
  assert.equal(h.calls.length, count);
  await act(async () => h.window.dispatchEvent(new Event("brightweb:notifications:refresh")));
  const freshItems = h.calls.findLast(call => call.url === "/new?limit=8")!;
  await act(async () => freshItems.resolve(items("new")));
  const recoveredCount = h.calls.length;
  await act(async () => h.state().onDismiss!("one"));
  assert.equal(h.calls.length, recoveredCount, "loaded feed still rejects IDs it does not own");
  await act(async () => h.state().onDismiss!("new"));
  assert.equal(h.calls.at(-1)!.url, "/new");
  assert.equal(h.calls.at(-1)!.method, "DELETE");
});

test("closed notification feed replacement clears old items while only loading the new summary", async t => {
  const h = await notificationHarness(t);
  await act(async () => h.state().onOpenChange!(false));
  await act(async () => h.renderer.update(React.createElement(h.Harness, { endpoint: "/new" })));
  assert.deepEqual(h.state().notifications, []);
  assert.equal(h.state().unreadCount, 0);
  assert.equal(h.state().seenAt, null);
  assert.equal(h.calls.filter(call => call.url === "/new?limit=8").length, 0);
  await act(async () => h.state().onOpenChange!(true));
  const freshItems = h.calls.findLast(call => call.url === "/new?limit=8")!;
  await act(async () => freshItems.resolve(items("new")));
  assert.deepEqual(h.state().notifications!.map(item => item.id), ["new"]);
});
