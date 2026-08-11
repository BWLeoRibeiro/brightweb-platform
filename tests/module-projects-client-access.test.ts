import assert from "node:assert/strict";
import test from "node:test";

import {
  createClientProjectDetailGetHandler,
  createClientProjectsGetHandler,
  createProjectClientAccessPatchHandler,
  createProjectClientAccessGetHandler,
  createProjectOrganizationsPatchHandler,
  createProjectsPatchHandler,
  createProjectsPostHandler,
  createProjectsSetupOptionsGetHandler,
  createProjectsActivityGetHandler,
  createProjectsDashboardGetHandler,
  createProjectsGetHandler,
  createProjectsOrganizationsGetHandler,
  createProjectsStatsGetHandler,
} from "../packages/module-projects/src/http.ts";
import {
  createProjectWithAccess,
  getClientProject,
  getProjectClientAccess,
  listClientOrganizations,
  listClientProjects,
  updateProjectClientAccess,
} from "../packages/module-projects/src/client-access.ts";
import { getProjectClientAccessSummary, getProjectDashboard } from "../packages/module-projects/src/server.ts";

const clientAccess = {
  ok: true as const,
  supabase: {},
  profileId: "profile-client",
  role: "client",
};

test("internal dashboard rejects the legacy client projection flag before reading data", async () => {
  await assert.rejects(
    () => getProjectDashboard({} as never, "project-1", { clientVisibleOnly: true }),
    /internal-only.*getClientProject/,
  );
});

test("every internal Projects GET boundary rejects client roles", async () => {
  let internalReadCalled = false;
  const dependencies = {
    getAccess: async () => clientAccess,
    listProjects: async () => { internalReadCalled = true; return { items: [], total: 0, page: 1, pageSize: 20 }; },
    getPortfolioStats: async () => { internalReadCalled = true; return {}; },
    getDashboard: async () => { internalReadCalled = true; return {}; },
    listActivity: async () => { internalReadCalled = true; return []; },
    queryActivity: async () => { internalReadCalled = true; return {}; },
  } as never;
  const request = new Request("https://example.test/api/projects");
  const context = { params: Promise.resolve({ id: "project-1" }) };
  const handlers = [
    () => createProjectsGetHandler(dependencies)(request),
    () => createProjectsStatsGetHandler(dependencies)(request),
    () => createProjectsDashboardGetHandler(dependencies)(request, context),
    () => createProjectsActivityGetHandler(dependencies)(request, context),
    () => createProjectsOrganizationsGetHandler(dependencies)(request),
  ];
  for (const invoke of handlers) {
    const response = await invoke();
    assert.equal(response.status, 403);
  }
  assert.equal(internalReadCalled, false);
});

test("client project list uses only the dedicated safe contract", async () => {
  const authenticatedClient = {};
  let receivedClient: unknown = null;
  const safeProject = {
    id: "project-1",
    name: "Portal",
    reference: "P-1",
    status: "active",
    organizations: [{ id: "org-1", name: "Cliente" }],
    startDate: null,
    targetDate: null,
    completedAt: null,
    archivedAt: null,
    clientSummary: "Resumo aprovado",
    clientScope: null,
    clientContact: null,
    metaPreview: [],
    progress: { percent: 0 },
  };
  const handler = createClientProjectsGetHandler({
    getAccess: async () => ({ ...clientAccess, supabase: authenticatedClient }),
    listClientProjects: async (client) => { receivedClient = client; return [safeProject]; },
    listClientOrganizations: async (client) => {
      assert.equal(client, authenticatedClient);
      return [{ id: "org-1", name: "Cliente", role: "member" }];
    },
    getClientProject: async (client, projectId) => {
      assert.equal(client, authenticatedClient);
      assert.equal(projectId, "project-1");
      return { ...safeProject, metas: [], documents: [] };
    },
  } as never);
  const response = await handler(new Request("https://example.test/api/account/projects"));
  const body = await response.json() as {
    items: Array<Record<string, unknown>>;
    organizations: Array<Record<string, unknown>>;
    featuredProject: Record<string, unknown> | null;
  };
  assert.equal(response.status, 200);
  assert.equal(receivedClient, authenticatedClient);
  assert.deepEqual(body.items, [safeProject]);
  assert.deepEqual(body.organizations, [{ id: "org-1", name: "Cliente", role: "member" }]);
  assert.equal(body.featuredProject?.id, "project-1");
  for (const forbiddenField of ["summary", "tasks", "members", "activity", "taskStats", "ownerEmail", "cancellationReason"]) {
    assert.equal(forbiddenField in body.items[0]!, false);
  }
});

test("client project list fetches a featured detail only when exactly one project is ongoing", async () => {
  const detailProjectIds: string[] = [];
  const handler = createClientProjectsGetHandler({
    getAccess: async () => clientAccess,
    listClientProjects: async () => [
      { id: "project-1", status: "active" },
      { id: "project-2", status: "paused" },
    ],
    listClientOrganizations: async () => [],
    getClientProject: async (_client, projectId) => {
      detailProjectIds.push(projectId);
      return { id: projectId };
    },
  } as never);
  const response = await handler(new Request("https://example.test/api/account/projects"));
  const body = await response.json() as { featuredProject: unknown };
  assert.equal(response.status, 200);
  assert.deepEqual(detailProjectIds, []);
  assert.equal(body.featuredProject, null);
});

test("client project list features the single ongoing project even when history is visible", async () => {
  const requestedProjectIds: string[] = [];
  const handler = createClientProjectsGetHandler({
    getAccess: async () => clientAccess,
    listClientProjects: async () => [
      { id: "project-active", status: "active" },
      { id: "project-complete", status: "completed" },
    ],
    listClientOrganizations: async () => [],
    getClientProject: async (_client, projectId) => {
      requestedProjectIds.push(projectId);
      return { id: projectId };
    },
  } as never);
  const response = await handler(new Request("https://example.test/api/account/projects"));
  const body = await response.json() as { featuredProject: { id: string } | null };
  assert.equal(response.status, 200);
  assert.deepEqual(requestedProjectIds, ["project-active"]);
  assert.equal(body.featuredProject?.id, "project-active");
});

test("client project list excludes archived projects from ongoing previews", async () => {
  const requestedProjectIds: string[] = [];
  const handler = createClientProjectsGetHandler({
    getAccess: async () => clientAccess,
    listClientProjects: async () => [
      { id: "project-archived", status: "active", archivedAt: "2026-08-01T00:00:00Z" },
      { id: "project-paused", status: "paused", archivedAt: null },
    ],
    listClientOrganizations: async () => [],
    getClientProject: async (_client, projectId) => {
      requestedProjectIds.push(projectId);
      return { id: projectId };
    },
  } as never);
  const response = await handler(new Request("https://example.test/api/account/projects"));
  const body = await response.json() as { featuredProject: { id: string } | null };
  assert.equal(response.status, 200);
  assert.deepEqual(requestedProjectIds, ["project-paused"]);
  assert.equal(body.featuredProject?.id, "project-paused");
});

test("client organization service uses only the authenticated narrow RPC", async () => {
  const calls: Array<{ name: string; args: unknown }> = [];
  const organizations = await listClientOrganizations({
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return {
        data: [
          { organization_id: "org-1", organization_name: "Cliente A", membership_role: "admin", email: "hidden@example.test" },
          { organization_id: "org-2", organization_name: "Cliente B", membership_role: "member" },
          { organization_id: "org-3", organization_name: "Invalid", membership_role: "owner" },
        ],
        error: null,
      };
    },
  } as never);
  assert.deepEqual(calls, [{ name: "list_current_client_organizations", args: undefined }]);
  assert.deepEqual(organizations, [
    { id: "org-1", name: "Cliente A", role: "admin" },
    { id: "org-2", name: "Cliente B", role: "member" },
  ]);
  assert.equal("email" in (organizations[0] as unknown as Record<string, unknown>), false);
});

test("client project detail returns a non-disclosing 404 when the safe query denies access", async () => {
  const handler = createClientProjectDetailGetHandler({
    getAccess: async () => clientAccess,
    getClientProject: async () => null,
  } as never);
  const response = await handler(
    new Request("https://example.test/api/account/projects/project-1"),
    { params: Promise.resolve({ id: "project-1" }) },
  );
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "PROJECT_NOT_FOUND");
});

test("client services use authenticated narrow RPCs and discard extra internal fields", async () => {
  const calls: Array<{ name: string; args: unknown }> = [];
  const supabase = {
    rpc: async (name: string, args?: unknown) => {
      calls.push({ name, args });
      if (name === "list_current_client_projects") {
        return {
          data: [{
            project_id: "project-1",
            name: "Portal",
            reference: "P-1",
            status: "active",
            client_summary: "Aprovado",
            meta_preview: [
              { id: "meta-current", title: "Revisão", status: "in_progress", target_date: "2026-08-20", position: 2 },
            ],
            organizations: [{ organization_id: "org-1", organization_name: "Cliente" }],
            progress_percent: 50,
            tasks: [{ title: "internal" }],
            cost: 1000,
          }],
          error: null,
        };
      }
      return {
        data: [{
          project_id: "project-1",
          name: "Portal",
          reference: "P-1",
          status: "active",
          client_summary: "Aprovado",
          organizations: [],
          progress_percent: 50,
          metas: [{ id: "meta-1", title: "Entrega", status: "pending", position: 0 }],
          documents: [{ id: "doc-1", label: "Brief", url: "https://example.test", kind: "doc", created_at: "2026-08-11" }],
          members: [{ email: "internal@example.test" }],
        }],
        error: null,
      };
    },
  } as never;
  const list = await listClientProjects(supabase);
  const detail = await getClientProject(supabase, "project-1");
  assert.deepEqual(calls, [
    { name: "list_current_client_projects", args: undefined },
    { name: "get_current_client_project", args: { target_project_id: "project-1" } },
  ]);
  assert.equal("tasks" in (list[0] as unknown as Record<string, unknown>), false);
  assert.equal("cost" in (list[0] as unknown as Record<string, unknown>), false);
  assert.deepEqual(list[0]?.metaPreview, [{
    id: "meta-current",
    title: "Revisão",
    status: "in_progress",
    targetDate: "2026-08-20",
    completedAt: null,
    position: 2,
  }]);
  assert.equal("members" in (detail as unknown as Record<string, unknown>), false);
  assert.equal(detail?.metas[0]?.title, "Entrega");
  assert.equal(detail?.documents[0]?.label, "Brief");
});

test("atomic creation service serializes the locked database contract", async () => {
  let call: { name: string; args: Record<string, unknown> } | null = null;
  const supabase = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      call = { name, args };
      return { data: [{ project_id: "project-1", created: false }], error: null };
    },
  } as never;
  const result = await createProjectWithAccess(supabase, {
    idempotencyKey: "018f47a2-4b6d-7a1c-9b11-8f90c6dc55a1",
    project: {
      organizationId: "org-1",
      name: " Portal ",
      clientSummary: " Resumo ",
      clientContactProfileId: "client-1",
    },
    participatingOrganizationIds: ["org-2", "org-1"],
    members: [{ profileId: "staff-1", role: "owner" }],
    clientAccess: {
      mode: "selected_clients",
      organizations: [{ organizationId: "org-2", selectedProfileIds: ["client-1"] }],
    },
  });
  assert.deepEqual(result, { projectId: "project-1", created: false });
  assert.equal(call?.name, "create_project_with_client_access");
  assert.deepEqual(call?.args.p_organization_ids, ["org-1", "org-2"]);
  assert.deepEqual(call?.args.p_members, [{ profile_id: "staff-1", role: "owner" }]);
  assert.deepEqual(call?.args.p_client_access, {
    mode: "selected_clients",
    organization_ids: ["org-2"],
    profile_grants: [{ organization_id: "org-2", profile_id: "client-1" }],
  });
  assert.deepEqual(call?.args.p_project, {
    name: "Portal",
    code: null,
    status: "planned",
    primary_organization_id: "org-1",
    start_date: null,
    target_date: null,
    cancellation_reason: null,
    summary: null,
    client_summary: "Resumo",
    client_scope: null,
    client_contact_profile_id: "client-1",
  });
});

test("internal dashboard summary exposes readiness counts without client identities", async () => {
  const supabase = {
    rpc: async (name: string, args: unknown) => {
      assert.equal(name, "get_project_client_access_summary");
      assert.deepEqual(args, { target_project_id: "project-1" });
      return {
        data: {
          mode: "selected_clients",
          organization_names: ["Cliente A", "Cliente B"],
          organization_count: 2,
          selected_client_count: 3,
          content_readiness: {
            has_summary: true,
            has_scope: false,
            has_contact: true,
            client_visible_milestone_count: 4,
            shared_document_count: 2,
          },
          eligible_clients: [{ profile_id: "must-not-escape", email: "private@example.test" }],
        },
        error: null,
      };
    },
  } as never;
  const summary = await getProjectClientAccessSummary(supabase, "project-1");
  assert.deepEqual(summary, {
    mode: "selected_clients",
    organizationNames: ["Cliente A", "Cliente B"],
    organizationCount: 2,
    selectedClientCount: 3,
    contentReadiness: {
      hasSummary: true,
      hasScope: false,
      hasContact: true,
      clientVisibleMilestoneCount: 4,
      sharedDocumentCount: 2,
    },
  });
  assert.equal("eligibleClients" in (summary as unknown as Record<string, unknown>), false);
});

test("management configuration uses one atomic RPC and maps all participant candidates", async () => {
  const calls: Array<{ name: string; args: unknown }> = [];
  const configuration = {
    mode: "selected_clients",
    updated_at: "2026-08-11T12:00:00Z",
    client_summary: "Resumo",
    client_scope: "Âmbito",
    client_contact_profile_id: "staff-1",
    organizations: [
      {
        organization_id: "org-1",
        organization_name: "Cliente A",
        is_primary: true,
        selected_for_client_access: true,
        eligible_clients: [{ profile_id: "client-1", label: "Cliente", email: "client@example.test" }],
        selected_profile_ids: ["client-1"],
      },
      {
        organization_id: "org-2",
        organization_name: "Parceiro",
        is_primary: false,
        selected_for_client_access: false,
        eligible_clients: [],
        selected_profile_ids: [],
      },
    ],
  };
  const supabase = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return name === "get_project_access_configuration"
        ? { data: configuration, error: null }
        : { data: null, error: null };
    },
  } as never;
  const before = await getProjectClientAccess(supabase, "project-1");
  assert.equal(before.organizations[0]?.selectedForClientAccess, true);
  assert.equal(before.organizations[1]?.selectedForClientAccess, false);
  await updateProjectClientAccess(supabase, "project-1", {
    mode: "selected_clients",
    organizations: [{ organizationId: "org-1", selectedProfileIds: ["client-1"] }],
    clientSummary: "Resumo",
    clientScope: "Âmbito",
    clientContactProfileId: "staff-1",
  });
  assert.deepEqual(calls[1], {
    name: "set_project_client_configuration",
    args: {
      target_project_id: "project-1",
      target_configuration: {
        mode: "selected_clients",
        organization_ids: ["org-1"],
        profile_grants: [{ organization_id: "org-1", profile_id: "client-1" }],
        client_summary: "Resumo",
        client_scope: "Âmbito",
        client_contact_profile_id: "staff-1",
      },
    },
  });
  assert.equal(calls[2]?.name, "get_project_access_configuration");
});

test("atomic project creation preserves all four steps and idempotency", async () => {
  let received: unknown = null;
  const handler = createProjectsPostHandler({
    getAccess: async () => ({ ok: true, supabase: {}, profileId: "staff-1", role: "staff" }),
    createProjectWithAccess: async (_supabase, input) => {
      received = input;
      return { projectId: "project-1", created: true };
    },
  } as never);
  const payload = {
    idempotencyKey: "018f47a2-4b6d-7a1c-9b11-8f90c6dc55a1",
    project: {
      organizationId: "org-1",
      name: "Portal",
      clientSummary: "Resumo aprovado",
      clientScope: "Área pública",
    },
    participatingOrganizationIds: ["org-1", "org-2"],
    members: [
      { profileId: "staff-1", role: "owner" },
      { profileId: "staff-2", role: "contributor" },
    ],
    clientAccess: {
      mode: "selected_clients",
      organizations: [{ organizationId: "org-2", selectedProfileIds: ["client-1"] }],
    },
  };
  const response = await handler(new Request("https://example.test/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }));
  assert.equal(response.status, 201);
  assert.deepEqual(received, payload);
  assert.deepEqual(await response.json(), {
    data: { id: "project-1", name: "Portal", ownerProfileId: "staff-1", created: true },
  });
});

test("legacy project creation delegates to the atomic private-by-default contract", async () => {
  let received: unknown = null;
  const handler = createProjectsPostHandler({
    getAccess: async () => ({ ok: true, supabase: {}, profileId: "staff-1", role: "staff" }),
    createProjectWithAccess: async (_supabase, input) => {
      received = input;
      return { projectId: "project-legacy", created: true };
    },
    createProject: async () => { throw new Error("legacy two-transaction writer must not run"); },
  } as never);
  const response = await handler(new Request("https://example.test/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ organizationId: "org-1", name: "Portal legado" }),
  }));
  assert.equal(response.status, 201);
  const input = received as {
    idempotencyKey: string;
    participatingOrganizationIds: string[];
    members: Array<{ profileId: string; role: string }>;
    clientAccess: { mode: string; organizations: unknown[] };
  };
  assert.match(input.idempotencyKey, /^[0-9a-f-]{36}$/i);
  assert.deepEqual(input.participatingOrganizationIds, ["org-1"]);
  assert.deepEqual(input.members, [{ profileId: "staff-1", role: "owner" }]);
  assert.deepEqual(input.clientAccess, { mode: "hidden", organizations: [] });
});

test("generic project PATCH cannot mutate ownership outside the team RPC", async () => {
  let updated = false;
  const handler = createProjectsPatchHandler({
    getAccess: async () => ({ ok: true, supabase: {}, profileId: "owner-1", role: "staff" }),
    updateProject: async () => { updated = true; },
    getDashboard: async () => ({}),
  } as never);
  const response = await handler(
    new Request("https://example.test/api/projects/project-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ownerProfileId: "owner-2" }),
    }),
    { params: Promise.resolve({ id: "project-1" }) },
  );
  assert.equal(response.status, 400);
  assert.equal(updated, false);
  assert.equal((await response.json()).error.code, "EMPTY_UPDATE");
});

test("atomic project creation rejects audiences outside participating organizations", async () => {
  let created = false;
  const handler = createProjectsPostHandler({
    getAccess: async () => ({ ok: true, supabase: {}, profileId: "staff-1", role: "staff" }),
    createProjectWithAccess: async () => { created = true; return { projectId: "project-1", created: true }; },
  } as never);
  const response = await handler(new Request("https://example.test/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      idempotencyKey: "018f47a2-4b6d-7a1c-9b11-8f90c6dc55a1",
      project: { organizationId: "org-1", name: "Portal" },
      participatingOrganizationIds: ["org-1"],
      members: [{ profileId: "staff-1", role: "owner" }],
      clientAccess: {
        mode: "all_org_clients",
        organizations: [{ organizationId: "org-other", selectedProfileIds: [] }],
      },
    }),
  }));
  assert.equal(response.status, 400);
  assert.equal(created, false);
});

test("atomic creation reports idempotency payload conflicts without creating a duplicate", async () => {
  const handler = createProjectsPostHandler({
    getAccess: async () => ({ ok: true, supabase: {}, profileId: "staff-1", role: "staff" }),
    createProjectWithAccess: async () => {
      throw new Error("The idempotency key was already used with another request.");
    },
  } as never);
  const response = await handler(new Request("https://example.test/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      idempotencyKey: "018f47a2-4b6d-7a1c-9b11-8f90c6dc55a1",
      project: { organizationId: "org-1", name: "Portal" },
      participatingOrganizationIds: ["org-1"],
      members: [{ profileId: "staff-1", role: "owner" }],
      clientAccess: { mode: "hidden", organizations: [] },
    }),
  }));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "IDEMPOTENCY_CONFLICT");
});

test("setup options are staff-only and scoped to requested organizations", async () => {
  let received: unknown = null;
  const handler = createProjectsSetupOptionsGetHandler({
    getAccess: async () => ({ ok: true, supabase: {}, profileId: "staff-1", role: "staff" }),
    listProjectSetupOptions: async (_supabase, profileId, organizationIds) => {
      received = { profileId, organizationIds };
      return { staff: [], organizations: [] };
    },
  } as never);
  const response = await handler(new Request(
    "https://example.test/api/projects/setup-options?organizationIds=11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222",
  ));
  assert.equal(response.status, 200);
  assert.deepEqual(received, {
    profileId: "staff-1",
    organizationIds: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"],
  });
});

test("participating organization changes require admin or project owner", async () => {
  let updated = false;
  const context = { params: Promise.resolve({ id: "project-1" }) };
  const contributor = createProjectOrganizationsPatchHandler({
    getAccess: async () => ({ ok: true, supabase: {}, profileId: "staff-1", role: "staff" }),
    getProjectAccess: async () => ({ projectRole: "contributor", permissions: {} }),
    updateProjectOrganizations: async () => { updated = true; return {} as never; },
  } as never);
  const request = () => new Request("https://example.test/api/projects/project-1/organizations", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ organizationIds: ["org-1"] }),
  });
  assert.equal((await contributor(request(), context)).status, 403);
  assert.equal(updated, false);

  const admin = createProjectOrganizationsPatchHandler({
    getAccess: async () => ({ ok: true, supabase: {}, profileId: "admin-1", role: "admin" }),
    getProjectAccess: async () => { throw new Error("admin bypasses lookup"); },
    updateProjectOrganizations: async () => {
      updated = true;
      return { mode: "hidden", organizations: [], clientSummary: null, clientScope: null, clientContactProfileId: null };
    },
  } as never);
  assert.equal((await admin(request(), context)).status, 200);
  assert.equal(updated, true);
});

test("staff access PATCH preserves the three-mode organization/profile payload", async () => {
  let received: unknown = null;
  const handler = createProjectClientAccessPatchHandler({
    getAccess: async () => ({ ok: true, supabase: {}, profileId: "staff-1", role: "staff" }),
    getProjectAccess: async () => ({ projectRole: "owner", permissions: {} }),
    updateProjectClientAccess: async (_supabase, projectId, input) => {
      received = { projectId, input };
      return { mode: input.mode, organizations: [], updatedAt: null };
    },
  } as never);
  const response = await handler(
    new Request("https://example.test/api/projects/project-1/client-access", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "selected_clients",
        organizations: [{ organizationId: "org-1", selectedProfileIds: ["client-1", "client-1"] }],
      }),
    }),
    { params: Promise.resolve({ id: "project-1" }) },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(received, {
    projectId: "project-1",
    input: {
      mode: "selected_clients",
      organizations: [{ organizationId: "org-1", selectedProfileIds: ["client-1"] }],
    },
  });
});

test("client-access management allows admins and project owners", async () => {
  const configuration = { mode: "hidden", organizations: [], updatedAt: null };
  const adminHandler = createProjectClientAccessGetHandler({
    getAccess: async () => ({ ok: true, supabase: {}, profileId: "admin-1", role: "admin" }),
    getProjectAccess: async () => { throw new Error("admin must bypass project-role lookup"); },
    getProjectClientAccess: async () => configuration,
  } as never);
  const ownerHandler = createProjectClientAccessGetHandler({
    getAccess: async () => ({ ok: true, supabase: {}, profileId: "owner-1", role: "staff" }),
    getProjectAccess: async () => ({ projectRole: "owner", permissions: {} }),
    getProjectClientAccess: async () => configuration,
  } as never);
  const context = { params: Promise.resolve({ id: "project-1" }) };
  assert.equal((await adminHandler(new Request("https://example.test"), context)).status, 200);
  assert.equal((await ownerHandler(new Request("https://example.test"), context)).status, 200);
});

test("client-access management rejects contributor and observer staff before reading grants", async () => {
  let configRead = false;
  let configUpdated = false;
  for (const projectRole of ["contributor", "observer"] as const) {
    const dependencies = {
      getAccess: async () => ({ ok: true, supabase: {}, profileId: "staff-1", role: "staff" }),
      getProjectAccess: async () => ({ projectRole, permissions: {} }),
      getProjectClientAccess: async () => { configRead = true; return { mode: "hidden", organizations: [], updatedAt: null }; },
      updateProjectClientAccess: async () => { configUpdated = true; return { mode: "hidden", organizations: [], updatedAt: null }; },
    } as never;
    const getResponse = await createProjectClientAccessGetHandler(dependencies)(
      new Request("https://example.test/api/projects/project-1/client-access"),
      { params: Promise.resolve({ id: "project-1" }) },
    );
    const patchResponse = await createProjectClientAccessPatchHandler(dependencies)(
      new Request("https://example.test/api/projects/project-1/client-access", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "hidden", organizations: [] }),
      }),
      { params: Promise.resolve({ id: "project-1" }) },
    );
    assert.equal(getResponse.status, 403);
    assert.equal(patchResponse.status, 403);
  }
  assert.equal(configRead, false);
  assert.equal(configUpdated, false);
});
