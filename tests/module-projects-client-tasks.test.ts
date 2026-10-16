import assert from "node:assert/strict";
import test from "node:test";
import {
  CLIENT_TASK_LIMITS,
  ClientTaskBoundaryError,
  parseClientTaskActionRequest,
  parseStaffClientTaskActionRequest,
} from "../packages/module-projects/src/client-tasks-contracts.ts";
import {
  actOnClientProjectTask,
  getProjectClientTaskWorkbench,
  listClientProjectTasks,
  manageProjectClientTask,
  normalizeClientTask,
  normalizeStaffClientTask,
} from "../packages/module-projects/src/client-tasks.ts";
import {
  createClientProjectTaskPostHandler,
  createClientProjectTasksGetHandler,
  createProjectClientTaskPatchHandler,
  createProjectClientTasksGetHandler,
  createProjectClientTasksPostHandler,
  type ClientTasksHttpDependencies,
} from "../packages/module-projects/src/client-tasks-http.ts";
import {
  createProjectsTasksPostHandler,
  createProjectsTasksPatchHandler,
  createProjectsTasksDeleteHandler,
} from "../packages/module-projects/src/http.ts";

const projectId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const profileId = "44444444-4444-4444-8444-444444444444";
const organizationId = "55555555-5555-4555-8555-555555555555";
const milestoneId = "66666666-6666-4666-8666-666666666666";
const context = () => ({ params: Promise.resolve({ id: projectId, itemId: taskId }) });
const rawTask = () => ({
  id: taskId, project_id: projectId, client_title: "Confirm the layout", client_instructions: "Send approval.",
  publication_generation: 2, workflow: "submitted", revision: 4, due_date: "2026-10-20",
  milestone: { id: milestoneId, title: "Approval", internal_notes: "PRIVATE" },
  responsible_label: "Client", response: "Approved", review_feedback: null, submission_sequence: 1,
  title: "PRIVATE", description: "PRIVATE", selected_profile_ids: [profileId], organization_id: organizationId,
  internal_notes: "PRIVATE", receipt_payload: { secret: "PRIVATE" },
});
const rawStaffTask = () => ({
  ...rawTask(), publication: "published", audience_mode: "selected", responsible_profile_id: profileId,
  submissions: [{ sequence: 1, task_revision: 4, publication_generation: 2, response: "Approved",
    submitted_at: "2026-10-15T12:00:00Z", submitted_by_profile_id: profileId, review_feedback: null, secret: "PRIVATE" }],
});
const config = () => ({ clientTitle: "Confirm", clientInstructions: "Please approve.", organizationId,
  audienceMode: "selected", selectedProfileIds: [profileId], responsibleProfileId: profileId,
  milestoneId, dueDate: "2026-10-20" });
const start = () => ({ requestId, expectedRevision: 4, action: "start", input: {} });
const submit = () => ({ requestId, expectedRevision: 4, action: "submit", input: { response: "Approved" } });
const create = () => ({ requestId, expectedRevision: null, action: "create", input: config() });
const bodyRequest = (body: unknown, method = "POST") => new Request("https://example.test/api/tasks", {
  method, headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
const dependencies = (overrides: Partial<ClientTasksHttpDependencies> = {}): ClientTasksHttpDependencies => ({
  getAccess: async () => ({ ok: true, supabase: {}, profileId, role: "client" }),
  listClientProjectTasks: async () => [normalizeClientTask(rawTask())],
  actOnClientProjectTask: async () => normalizeClientTask(rawTask()),
  getProjectClientTaskWorkbench: async () => ({ tasks: [], organizations: [], capabilities: {
    canCreateTasks: false, canShareClientTasks: false, canReviewClientTasks: false,
  } }),
  manageProjectClientTask: async () => normalizeStaffClientTask(rawStaffTask()),
  ...overrides,
});
function rpc(result: { data: unknown; error: { code: string; message: string } | null }) {
  const calls: Array<{ name: string; params: unknown }> = [];
  const client = { rpc: async (name: string, params: unknown) => { calls.push({ name, params }); return result; } };
  return { client: client as never, calls };
}
function invalidInput(fn: () => unknown) {
  assert.throws(fn, (error: unknown) => error instanceof ClientTaskBoundaryError && error.code === "INVALID_INPUT");
}

test("client DTO reconstructs only the safe fields, including nested milestone", () => {
  const task = normalizeClientTask(rawTask());
  assert.deepEqual(Object.keys(task).sort(), ["id", "projectId", "clientTitle", "clientInstructions", "publicationGeneration",
    "workflow", "revision", "dueDate", "milestone", "responsibleLabel", "response", "reviewFeedback", "submissionSequence"].sort());
  assert.deepEqual(task.milestone, { id: milestoneId, title: "Approval" });
  assert.equal(JSON.stringify(task).includes("PRIVATE"), false);
  assert.equal(task.response, "Approved");
});

test("staff DTO exposes deliberate history while stripping internal task and receipt fields", () => {
  const task = normalizeStaffClientTask(rawStaffTask());
  assert.equal(task.submissions[0]?.submittedByProfileId, profileId);
  assert.equal(task.submissions[0]?.taskRevision, 4);
  assert.equal(task.organizationId, organizationId);
  assert.equal(JSON.stringify(task).includes("PRIVATE"), false);
});

test("malformed SQL DTO fails closed instead of casting or coercing fields", () => {
  for (const change of [{ revision: "4" }, { workflow: "done" }, { project_id: null }, { response: {} },
    { milestone: [] }, { submission_sequence: 0 }, { revision: -1 }, { client_instructions: undefined }]) {
    assert.throws(() => normalizeClientTask({ ...rawTask(), ...change }), ClientTaskBoundaryError);
  }
});

test("client inputs permit only start and a nonblank response, with exact envelopes", () => {
  assert.deepEqual(parseClientTaskActionRequest(start()), start());
  assert.deepEqual(parseClientTaskActionRequest(submit()), submit());
  for (const value of [null, [], { ...start(), actorId: profileId }, { ...start(), requestId: "bad" },
    { ...start(), expectedRevision: null }, { ...start(), expectedRevision: 0.5 },
    { ...start(), action: "accept" }, { ...start(), input: { status: "done" } },
    { ...submit(), input: { response: " " } }, { ...submit(), input: { response: "ok", publication: "published" } },
    { ...submit(), input: { response: "x".repeat(CLIENT_TASK_LIMITS.response + 1) } }]) {
    invalidInput(() => parseClientTaskActionRequest(value));
  }
});

test("staff create/configure inputs reject protected fields, bad dates and duplicate/oversized audiences", () => {
  assert.deepEqual(parseStaffClientTaskActionRequest(create()), create());
  assert.deepEqual(parseStaffClientTaskActionRequest({ ...create(), expectedRevision: 4, action: "configure" }).action, "configure");
  for (const input of [{ ...config(), title: "internal" }, { ...config(), dueDate: "2026-02-30" },
    { ...config(), organizationId: "bad" }, { ...config(), audienceMode: "everyone" },
    { ...config(), selectedProfileIds: [profileId, profileId.toUpperCase()] },
    { ...config(), selectedProfileIds: Array(501).fill(profileId) }, { ...config(), clientTitle: " " },
    { ...config(), audienceMode: "all_eligible" }, { ...config(), clientTitle: "x".repeat(241) },
    { ...config(), clientInstructions: "x".repeat(20_001) }, { ...config(), responsibleProfileId: undefined }]) {
    invalidInput(() => parseStaffClientTaskActionRequest({ ...create(), input }));
  }
  invalidInput(() => parseStaffClientTaskActionRequest({ ...create(), expectedRevision: 4 }));
});

test("publish/withdraw inputs are empty and review targets exact submission sequence", () => {
  for (const action of ["publish", "withdraw"]) {
    assert.equal(parseStaffClientTaskActionRequest({ ...start(), action }).action, action);
    invalidInput(() => parseStaffClientTaskActionRequest({ ...start(), action, input: { revision: 2 } }));
  }
  for (const action of ["return", "accept"]) {
    const request = { ...start(), action, input: { submissionSequence: 1, feedback: "Please revise." } };
    assert.deepEqual(parseStaffClientTaskActionRequest(request), request);
    for (const input of [{ feedback: "Please revise." }, { submissionSequence: 0, feedback: "No" },
      { submissionSequence: 1, feedback: "No", publicationGeneration: 2 }]) {
      invalidInput(() => parseStaffClientTaskActionRequest({ ...request, input }));
    }
  }
  invalidInput(() => parseStaffClientTaskActionRequest({ ...start(), action: "return", input: { submissionSequence: 1, feedback: " " } }));
});

test("client list uses only the dedicated RPC and maps inaccessible/missing to an empty list", async () => {
  const success = rpc({ data: [rawTask()], error: null });
  assert.equal((await listClientProjectTasks(success.client, projectId))[0]?.id, taskId);
  assert.deepEqual(success.calls, [{ name: "list_current_client_project_tasks", params: { p_project_id: projectId } }]);
  for (const code of ["42501", "P0002"]) {
    const denied = rpc({ data: null, error: { code, message: "PRIVATE ID" } });
    assert.deepEqual(await listClientProjectTasks(denied.client, projectId), []);
  }
});

test("client action sends camel input, identity-free exact RPC arguments and preserves retry key", async () => {
  const fixture = rpc({ data: rawTask(), error: null });
  const request = parseClientTaskActionRequest(submit());
  await actOnClientProjectTask(fixture.client, projectId, taskId, request);
  await actOnClientProjectTask(fixture.client, projectId, taskId, request);
  const expected = { name: "act_on_current_client_project_task", params: { p_project_id: projectId, p_task_id: taskId,
    p_request_id: requestId, p_expected_revision: 4, p_action: "submit", p_input: { response: "Approved" } } };
  assert.deepEqual(fixture.calls, [expected, expected]);
});

test("staff create uses null task/revision and exact authored configuration", async () => {
  const fixture = rpc({ data: rawStaffTask(), error: null });
  await manageProjectClientTask(fixture.client, projectId, null, parseStaffClientTaskActionRequest(create()));
  assert.deepEqual(fixture.calls, [{ name: "manage_project_client_task", params: { p_project_id: projectId,
    p_task_id: null, p_request_id: requestId, p_expected_revision: null, p_action: "create", p_input: config() } }]);
});

test("workbench normalizes snake capability and directory keys without exposing email or other metadata", async () => {
  const fixture = rpc({ data: { tasks: [rawStaffTask()], organizations: [{ id: organizationId, name: "Client Org",
    eligible_clients: [{ profile_id: profileId, label: "Client", email: "PRIVATE" }] }],
    capabilities: { can_create_tasks: true, can_share_client_tasks: true, can_review_client_tasks: false, can_manage_project: true } }, error: null });
  const workbench = await getProjectClientTaskWorkbench(fixture.client, projectId);
  assert.deepEqual(workbench.organizations, [{ id: organizationId, name: "Client Org", eligibleClients: [{ profileId, label: "Client" }] }]);
  assert.deepEqual(workbench.capabilities, { canCreateTasks: true, canShareClientTasks: true, canReviewClientTasks: false });
  assert.equal(JSON.stringify(workbench).includes("PRIVATE"), false);
  assert.equal(fixture.calls[0]?.name, "get_project_client_task_workbench");
});

test("RPC adapters reject cross-project/task data and do not silently accept invalid arrays", async () => {
  for (const data of [null, {}, [{ ...rawTask(), project_id: organizationId }]]) {
    const fixture = rpc({ data, error: null });
    await assert.rejects(() => listClientProjectTasks(fixture.client, projectId), ClientTaskBoundaryError);
  }
  const fixture = rpc({ data: { ...rawTask(), id: organizationId }, error: null });
  await assert.rejects(() => actOnClientProjectTask(fixture.client, projectId, taskId, parseClientTaskActionRequest(start())), ClientTaskBoundaryError);
});

test("every HTTP boundary enforces authentication and separate client/staff role gates before data access", async () => {
  let calls = 0;
  const query = async () => { calls++; throw new Error("must not run"); };
  const cases = [
    [createClientProjectTasksGetHandler, "staff"], [createClientProjectTaskPostHandler, "admin"],
    [createProjectClientTasksGetHandler, "client"], [createProjectClientTasksPostHandler, "client"],
    [createProjectClientTaskPatchHandler, "client"],
  ] as const;
  for (const [factory, role] of cases) {
    const deps = dependencies({ getAccess: async () => ({ ok: true, supabase: {}, role, profileId }),
      listClientProjectTasks: query, actOnClientProjectTask: query, getProjectClientTaskWorkbench: query, manageProjectClientTask: query });
    const response = await factory(deps)(bodyRequest(start()), context());
    assert.equal(response.status, 403);
    assert.match(response.headers.get("cache-control")!, /no-store/);
    const unauthenticated = await factory({ ...deps, getAccess: async () => ({ ok: false, status: 401, error: "PRIVATE" }) })(bodyRequest(start()), context());
    assert.equal(unauthenticated.status, 401);
    assert.equal((await unauthenticated.text()).includes("PRIVATE"), false);
  }
  assert.equal(calls, 0);
});

test("client and staff GET HTTP return their dedicated data envelopes with no-store", async () => {
  const client = await createClientProjectTasksGetHandler(dependencies())(new Request("https://example.test"), context());
  assert.deepEqual(await client.json(), { data: [normalizeClientTask(rawTask())] });
  assert.equal(client.headers.get("cache-control"), "private, no-store, max-age=0");
  const staff = await createProjectClientTasksGetHandler(dependencies({ getAccess: async () => ({ ok: true, role: "staff", profileId, supabase: {} }) }))(new Request("https://example.test"), context());
  assert.equal(staff.status, 200);
  assert.deepEqual((await staff.json() as { data: { tasks: unknown[] } }).data.tasks, []);
});

test("HTTP create/configure accept only the action matching the route and preserve full response types", async () => {
  const deps = dependencies({ getAccess: async () => ({ ok: true, role: "staff", profileId, supabase: {} }) });
  const post = createProjectClientTasksPostHandler(deps);
  const patch = createProjectClientTaskPatchHandler(deps);
  assert.equal((await post(bodyRequest(create()), context())).status, 201);
  assert.equal((await patch(bodyRequest({ ...create(), action: "configure", expectedRevision: 4 }, "PATCH"), context())).status, 200);
  assert.equal((await post(bodyRequest({ ...start(), action: "publish" }), context())).status, 400);
  assert.equal((await patch(bodyRequest(create(), "PATCH"), context())).status, 400);
});

test("HTTP rejects malformed/oversized bodies, unknown keys and bad route IDs without invoking mutation", async () => {
  let mutations = 0;
  const handler = createClientProjectTaskPostHandler(dependencies({ actOnClientProjectTask: async () => { mutations++; return normalizeClientTask(rawTask()); } }));
  for (const payload of [{ ...start(), actor: profileId }, { ...submit(), input: { response: "x", internal: "PRIVATE" } }]) {
    assert.equal((await handler(bodyRequest(payload), context())).status, 400);
  }
  assert.equal((await handler(new Request("https://example.test", { method: "POST", body: "{" }), context())).status, 400);
  assert.equal((await handler(new Request("https://example.test", { method: "POST", body: "x".repeat(CLIENT_TASK_LIMITS.bodyBytes + 1) }), context())).status, 413);
  assert.equal((await handler(bodyRequest(start()), { params: Promise.resolve({ id: "bad", itemId: taskId }) })).status, 400);
  assert.equal((await handler(bodyRequest(start()), { params: Promise.resolve({ id: projectId }) })).status, 400);
  assert.equal(mutations, 0);
});

test("HTTP maps SQL failures without leaking error messages, identifiers or private payloads", async () => {
  for (const [code, status, publicCode] of [["42501", 403, "FORBIDDEN"], ["P0002", 404, "NOT_FOUND"],
    ["40001", 409, "CONFLICT"], ["BW409", 409, "CONFLICT"], ["22023", 400, "INVALID_INPUT"],
    ["PGRST202", 503, "MIGRATION_REQUIRED"], ["XX000", 500, "REQUEST_FAILED"]] as const) {
    const fixture = rpc({ data: null, error: { code, message: `PRIVATE ${taskId}` } });
    const handler = createClientProjectTaskPostHandler(dependencies({
      getAccess: async () => ({ ok: true, supabase: fixture.client, profileId, role: "client" }), actOnClientProjectTask,
    }));
    const response = await handler(bodyRequest(start()), context());
    const text = await response.text();
    assert.equal(response.status, status, code);
    assert.equal((JSON.parse(text) as { error: { code: string } }).error.code, publicCode);
    assert.equal(text.includes("PRIVATE"), false);
    assert.equal(text.includes(taskId), false);
    assert.match(response.headers.get("cache-control")!, /no-store/);
    if (code === "PGRST202") assert.match(text, /Apply.*migration/);
  }
});

test("missing migration on client list fails closed instead of pretending there are no tasks", async () => {
  const fixture = rpc({ data: null, error: { code: "PGRST202", message: "PRIVATE" } });
  const response = await createClientProjectTasksGetHandler(dependencies({
    getAccess: async () => ({ ok: true, supabase: fixture.client, profileId, role: "client" }), listClientProjectTasks,
  }))(new Request("https://example.test"), context());
  assert.equal(response.status, 503);
  assert.equal((await response.json() as { error: { code: string } }).error.code, "MIGRATION_REQUIRED");
});

test("client action missing row gives generic 404 and malformed response gives 502", async () => {
  for (const [data, status] of [[null, 404], [{ ...rawTask(), workflow: "done" }, 502]] as const) {
    const fixture = rpc({ data, error: null });
    const response = await createClientProjectTaskPostHandler(dependencies({
      getAccess: async () => ({ ok: true, supabase: fixture.client, profileId, role: "client" }), actOnClientProjectTask,
    }))(bodyRequest(start()), context());
    assert.equal(response.status, status);
  }
});

test("internal task contributor creation preserves the existing dashboard response and owner-only content/delete boundaries", async () => {
  let creates = 0;
  let updates = 0;
  let deletes = 0;
  const dashboard = { project: { id: projectId }, tasks: [], markers: ["legacy-dashboard-contract"] };
  const deps = (projectRole: string, assignee = profileId) => ({
    getAccess: async () => ({ ok: true, supabase: {}, profileId, role: "staff" }),
    getProjectAccess: async () => ({ projectRole, permissions: {}, viewerProfileId: profileId }),
    getProjectTaskAssignment: async () => ({ assigneeProfileId: assignee }),
    getDashboard: async () => dashboard,
    createTask: async () => { creates++; },
    updateTask: async () => { updates++; },
    deleteTask: async () => { deletes++; },
  });
  for (const role of ["owner", "contributor"]) {
    const response = await createProjectsTasksPostHandler(deps(role) as never)(bodyRequest({ title: "Internal preparation" }), context());
    assert.equal(response.status, 201, role);
    assert.deepEqual(await response.json(), { data: dashboard });
  }
  for (const role of ["observer", "none"]) {
    assert.equal((await createProjectsTasksPostHandler(deps(role) as never)(bodyRequest({ title: "Internal preparation" }), context())).status, 403);
    assert.equal((await createProjectsTasksPatchHandler(deps(role) as never)(bodyRequest({ status: "in_progress" }, "PATCH"), context())).status, 403);
  }
  assert.equal((await createProjectsTasksPatchHandler(deps("contributor") as never)(bodyRequest({ status: "in_progress" }, "PATCH"), context())).status, 200);
  assert.equal((await createProjectsTasksPatchHandler(deps("contributor", organizationId) as never)(bodyRequest({ status: "in_progress" }, "PATCH"), context())).status, 403);
  assert.equal((await createProjectsTasksPatchHandler(deps("contributor") as never)(bodyRequest({ title: "Unauthorized title edit" }, "PATCH"), context())).status, 403);
  for (const role of ["contributor", "observer", "none"]) {
    assert.equal((await createProjectsTasksDeleteHandler(deps(role) as never)(new Request("https://example.test", { method: "DELETE" }), context())).status, 403);
  }
  assert.equal(creates, 2);
  assert.equal(updates, 1);
  assert.equal(deletes, 0);
});
