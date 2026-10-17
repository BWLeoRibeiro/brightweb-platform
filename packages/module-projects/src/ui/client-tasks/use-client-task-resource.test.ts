import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { act, create } from "react-test-renderer";
import { useClientTaskResource } from "./use-client-task-resource";

test("task requests preserve uncertain retries, refresh conflicts and clear revoked data", async () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  Object.assign(globalThis, { window: new EventTarget(), document: new EventTarget(), IS_REACT_ACT_ENVIRONMENT: true });
  const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
  let getStatus = 200;
  let mutationStatus = 200;
  let failNetwork = false;
  let getCount = 0;
  const request = async (path: string, init?: RequestInit) => {
    if (!init?.method) {
      getCount += 1;
      return Response.json({ data: [{ id: "task", response: "private response" }] }, { status: getStatus });
    }
    requests.push({ path, body: JSON.parse(String(init.body)) });
    if (failNetwork) throw new Error("Connection lost after send");
    return Response.json({ data: {} }, { status: mutationStatus });
  };
  let resource!: ReturnType<typeof useClientTaskResource<Array<{ id: string; response: string }>>>;
  function Probe() { resource = useClientTaskResource("/tasks", request); return null; }
  let renderer: ReturnType<typeof create> | undefined;
  try {
    await act(async () => { renderer = create(createElement(Probe)); });
    assert.equal(resource.data?.[0]?.response, "private response");
    const body = { expectedRevision: 1, action: "submit", input: { response: "first" } };
    failNetwork = true;
    await act(async () => { await resource.mutate("/tasks/task", "POST", body); });
    await act(async () => { await resource.mutate("/tasks/task", "POST", body); });
    assert.equal(requests[0].body.requestId, requests[1].body.requestId, "identical uncertain retry must reuse the request id");
    await act(async () => { await resource.mutate("/tasks/task", "POST", { ...body, input: { response: "changed" } }); });
    assert.notEqual(requests[1].body.requestId, requests[2].body.requestId, "edited response needs a new request id");
    failNetwork = false;
    mutationStatus = 409;
    const readsBeforeConflict = getCount;
    await act(async () => { await resource.mutate("/tasks/task", "POST", body); });
    assert.ok(getCount > readsBeforeConflict, "conflict must reload current authorized state");
    assert.match(resource.message, /alterada/);
    mutationStatus = 403;
    await act(async () => { await resource.mutate("/tasks/task", "POST", body); });
    assert.equal(resource.data, null);
    assert.equal(resource.state, "unavailable");
    getStatus = 404;
    await act(async () => { await resource.refresh(); });
    assert.equal(resource.data, null);
    assert.equal(resource.state, "unavailable");
  } finally {
    await act(async () => renderer?.unmount());
    Object.assign(globalThis, { window: previousWindow, document: previousDocument });
  }
});

test("older task reads cannot restore content after a later access denial", async () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  Object.assign(globalThis, { window: new EventTarget(), document: new EventTarget(), IS_REACT_ACT_ENVIRONMENT: true });
  let resolveOld!: (response: Response) => void;
  const oldRead = new Promise<Response>((resolve) => { resolveOld = resolve; });
  let reads = 0;
  const request = async () => ++reads === 1 ? oldRead : Response.json({ data: [] }, { status: 403 });
  let resource!: ReturnType<typeof useClientTaskResource<object[]>>;
  function Probe() { resource = useClientTaskResource("/tasks", request); return null; }
  let renderer: ReturnType<typeof create> | undefined;
  try {
    await act(async () => { renderer = create(createElement(Probe)); });
    await act(async () => { await resource.refresh(); });
    assert.equal(resource.state, "unavailable");
    await act(async () => { resolveOld(Response.json({ data: [{ response: "revoked private content" }] })); });
    assert.equal(resource.data, null);
    assert.equal(resource.state, "unavailable");
  } finally {
    await act(async () => renderer?.unmount());
    Object.assign(globalThis, { window: previousWindow, document: previousDocument });
  }
});
