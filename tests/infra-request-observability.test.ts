import assert from "node:assert/strict";
import test from "node:test";

import {
  appendServerTiming,
  createLatestRequestController,
  isAbortError,
  observedFetch,
  type UiRequestMetric,
} from "../packages/infra/src/request-observability.ts";
import { createAdminUiClient } from "../packages/module-admin/src/ui/client.ts";
import { createCrmUiClient } from "../packages/module-crm/src/ui/client.ts";
import { createMarketingUiClient } from "../packages/module-marketing/src/ui/client.ts";
import { createProjectsUiClient } from "../packages/module-projects/src/ui/client.ts";

test("latest request controller aborts superseded work and guards stale completions", () => {
  const controller = createLatestRequestController();
  const first = controller.begin();
  assert.equal(controller.hasActiveRequest(), true);
  const second = controller.begin();
  assert.equal(first.signal.aborted, true);
  assert.equal(first.isCurrent(), false);
  assert.equal(second.isCurrent(), true);
  first.finish();
  assert.equal(controller.hasActiveRequest(), true);
  second.finish();
  assert.equal(controller.hasActiveRequest(), false);
});

test("abort detection accepts platform abort errors only", () => {
  assert.equal(isAbortError(new DOMException("stale", "AbortError")), true);
  assert.equal(isAbortError(new Error("failed")), false);
});

test("observedFetch reports privacy-safe completion and response size", async () => {
  const metrics: UiRequestMetric[] = [];
  const response = await observedFetch(
    (async () => new Response("{}", { status: 200, headers: { "content-length": "2" } })) as typeof fetch,
    "/api/example?search=private",
    undefined,
    { domain: "crm", operation: "contacts.list", observer: (metric) => metrics.push(metric) },
  );

  assert.equal(response.status, 200);
  assert.equal(metrics.length, 1);
  assert.deepEqual({ ...metrics[0], durationMs: 0 }, {
    domain: "crm",
    operation: "contacts.list",
    outcome: "completed",
    durationMs: 0,
    status: 200,
    responseBytes: 2,
  });
  assert.doesNotMatch(JSON.stringify(metrics), /private/);
});

test("observer failures never change successful request outcomes", async () => {
  const response = await observedFetch(
    (async () => new Response("ok", { status: 200 })) as typeof fetch,
    "/api/example",
    undefined,
    {
      domain: "test",
      operation: "observer-failure",
      observer: () => { throw new Error("telemetry unavailable"); },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "ok");
});

test("observedFetch distinguishes aborted requests without recording request data", async () => {
  const metrics: UiRequestMetric[] = [];
  await assert.rejects(
    observedFetch(
      (async () => { throw new DOMException("Aborted", "AbortError"); }) as typeof fetch,
      "/api/example?search=private",
      undefined,
      { domain: "projects", operation: "projects.list", observer: (metric) => metrics.push(metric) },
    ),
    { name: "AbortError" },
  );
  assert.equal(metrics[0]?.outcome, "aborted");
  assert.equal(metrics[0]?.status, null);
  assert.doesNotMatch(JSON.stringify(metrics), /private/);
});

test("observedFetch reports failed HTTP responses and still returns them", async () => {
  const metrics: UiRequestMetric[] = [];
  const response = await observedFetch(
    (async () => new Response("unavailable", { status: 503 })) as typeof fetch,
    "/api/example",
    undefined,
    { domain: "projects", operation: "projects.list", observer: (metric) => metrics.push(metric) },
  );

  assert.equal(response.status, 503);
  assert.equal(metrics.length, 1);
  assert.equal(metrics[0]?.outcome, "failed");
  assert.equal(metrics[0]?.status, 503);
});

test("observedFetch reports network failures once and preserves the rejection", async () => {
  const metrics: UiRequestMetric[] = [];
  const failure = new TypeError("network unavailable");

  await assert.rejects(
    observedFetch(
      (async () => { throw failure; }) as typeof fetch,
      "/api/example",
      undefined,
      { domain: "marketing", operation: "campaigns.list", observer: (metric) => metrics.push(metric) },
    ),
    failure,
  );
  assert.equal(metrics.length, 1);
  assert.equal(metrics[0]?.outcome, "failed");
  assert.equal(metrics[0]?.status, null);
});

test("list clients forward AbortSignal to their authoritative fetch", async () => {
  const controller = new AbortController();
  const signals: AbortSignal[] = [];
  const abortingFetcher = (async (_input: URL | RequestInfo, init?: RequestInit) => {
    if (init?.signal) signals.push(init.signal);
    throw new DOMException("Aborted", "AbortError");
  }) as typeof fetch;

  const crm = createCrmUiClient("/api/crm", abortingFetcher);
  const projects = createProjectsUiClient("/api/projects", abortingFetcher);
  const admin = createAdminUiClient("/api/admin/users", abortingFetcher);
  const marketing = createMarketingUiClient("/api/marketing", abortingFetcher);
  await Promise.all([
    assert.rejects(crm.listContacts({}, { signal: controller.signal }), { name: "AbortError" }),
    assert.rejects(crm.queryTimeline({}, { signal: controller.signal }), { name: "AbortError" }),
    assert.rejects(projects.listProjects({}, { signal: controller.signal }), { name: "AbortError" }),
    assert.rejects(projects.listOrganizations({ signal: controller.signal }), { name: "AbortError" }),
    assert.rejects(admin.listUsers({ page: 1, pageSize: 10 }, { signal: controller.signal }), { name: "AbortError" }),
    assert.rejects(marketing.queryCampaigns({}, { signal: controller.signal }), { name: "AbortError" }),
  ]);

  assert.deepEqual(signals, Array.from({ length: 6 }, () => controller.signal));
});

test("server timing appends sanitized durations without replacing existing metrics", () => {
  const response = new Response("{}", { headers: { "server-timing": "cache;dur=1" } });
  appendServerTiming(response, [
    { name: "db list", durationMs: 12.345 },
    { name: "enrich", durationMs: 4.2 },
  ]);
  assert.equal(response.headers.get("server-timing"), "cache;dur=1, db_list;dur=12.3, enrich;dur=4.2");
});
