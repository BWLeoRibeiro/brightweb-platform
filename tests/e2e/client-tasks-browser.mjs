import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { observeBrowserErrors } from "./browser-errors.mjs";

// Compatible with consumer-smoke --context-setup / --consumer-checks. The
// production browser may contact only the app and disposable loopback services.
export async function setupContext(context) {
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || ["data:", "blob:"].includes(url.protocol)
      ? route.continue()
      : route.abort("blockedbyclient");
  });
}

function localOrigin(value) {
  const url = new URL(value);
  assert(["localhost", "127.0.0.1"].includes(url.hostname), "Browser evidence must use disposable loopback services");
  return url.origin;
}

const safeTaskKeys = ["id", "projectId", "clientTitle", "clientInstructions", "publicationGeneration", "workflow", "revision", "dueDate", "milestone", "responsibleLabel", "response", "reviewFeedback", "submissionSequence"].sort();

export async function runConsumerChecks({ appUrl, backend, user, project, staffProjectsPath = "/projetos", setupContext: configureContext = setupContext }) {
  localOrigin(appUrl); localOrigin(backend.url);
  assert(["/projetos", "/projects"].includes(staffProjectsPath), "Use the explicit supported consumer or preview Projects route");
  assert(user.email.endsWith("@example.invalid"));
  // Keep extension retries independent of shared consumer fixtures.
  project = await backend.createProject({ profileId: user.profileId });
  const fixtureSuffix = randomUUID().slice(0, 8);
  const { chromium, expect } = await import("playwright/test");
  const evidenceDir = path.resolve(process.env.CLIENT_TASK_BROWSER_EVIDENCE_DIR ?? path.join(import.meta.dirname, "../../verification-results/client-tasks"));
  await mkdir(evidenceDir, { recursive: true });
  const evidence = { mutationResponseControls: [], navigation: [], startedAt: new Date().toISOString(), mode: "served production build; actual GoTrue and disposable Supabase", checks: [], screenshots: [], persisted: {} };
  const save = async () => writeFile(path.join(evidenceDir, "browser-results.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  const stage = async (name, action) => {
    evidence.currentStage = name;
    console.log(`[client-tasks-browser] ${name}`);
    await save();
    let timer;
    try { await Promise.race([action(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Stage exceeded 60 seconds: ${name}`)), 60_000); })]); } finally { clearTimeout(timer); }
    evidence.checks.push({ name, status: "pass" });
    await save();
  };
  const screen = async (page, name) => {
    const filename = `browser-${name}.png`;
    await page.screenshot({ path: path.join(evidenceDir, filename), fullPage: true, timeout: 10_000 });
    evidence.screenshots.push(filename);
  };
  const rest = async (endpoint, { token = backend.serviceKey, method = "GET", body, headers = {}, statuses = [200, 201, 204] } = {}) => {
    const response = await fetch(`${backend.url}${endpoint}`, {
      method, headers: { apikey: backend.anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation", ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30_000),
    });
    const data = await response.json().catch(() => null);
    assert(statuses.includes(response.status), `Local ${method} ${endpoint.split("?")[0]} status ${response.status}, code ${data?.code ?? "unknown"}`);
    return { status: response.status, data };
  };
  const tokenFor = async (person) => {
    assert(person.email.endsWith("@example.invalid"));
    const { data } = await rest("/auth/v1/token?grant_type=password", { method: "POST", body: { email: person.email, password: person.password } });
    assert(data?.access_token, "Actual GoTrue password login provides a current local token");
    return data.access_token;
  };
  const browser = await chromium.launch();
  let staffContext, staffPage, clientContext, clientPage;
  let staffNoErrors, clientNoErrors;
  let allowRevocationDenial = false;
  let task, accepted, submittedFirst, submittedSecond, submitRequest, milestoneId;
  const staffPath = `${staffProjectsPath}/${project.projectId}`;
  const accountPath = `/account/projetos/${project.projectId}`;
  const collectionPath = `/api/projects/${project.projectId}/client-tasks`;
  const clientCollectionPath = `/api/account/projects/${project.projectId}/tasks`;
  const title = "Aprovar conteúdos para publicação";
  const instructions = "Leia o texto de exemplo e indique a aprovação ou as alterações necessárias. Apenas estas instruções são partilhadas.";
  const firstResponse = "Solicito a correção do segundo parágrafo.";
  const secondResponse = "Texto revisto e aprovado para publicação.";
  const feedback = "Especifique a redação final do segundo parágrafo, por favor.";
  const uiMutation = async (page, pathname, action, trigger, status = 200) => {
    console.log(`[client-tasks-browser] UI action ${action} awaiting response`);
    const pending = page.waitForResponse((response) => {
      if (new URL(response.url()).pathname !== pathname || !["POST", "PATCH"].includes(response.request().method())) return false;
      return response.request().postDataJSON()?.action === action;
    }, { timeout: 15_000 });
    await trigger();
    console.log(`[client-tasks-browser] UI action ${action} triggered`);
    const response = await pending;
    console.log(`[client-tasks-browser] UI action ${action} HTTP ${response.status()}`);
    assert.equal(response.status(), status, `${action} saves through the actual application boundary`);
    const request = response.request().postDataJSON();
    if (status >= 400) return { task: null, request };
    // An identical authorized receipt retry is a full-response HTTP control.
    // Context requests finish and buffer the body before returning, unlike the
    // unread page-fetch body used only for its status by this UI.
    const replay = await page.request.fetch(`${appUrl}${pathname}`, { method: response.request().method(), data: request, timeout: 10_000 });
    assert.equal(replay.status(), status, "Identical authorized mutation retry returns the original success class");
    const replayText = await replay.text();
    const replayData = JSON.parse(replayText).data;
    assert(replayData?.id, "Mutation retry has a fully readable task JSON response");
    const headers = replay.headers();
    evidence.mutationResponseControls.push({ action, status: replay.status(), bodyFullyRead: true, bodyBytes: Buffer.byteLength(replayText), headers: Object.fromEntries(["content-type", "content-length", "transfer-encoding", "cache-control"].filter((name) => headers[name] !== undefined).map((name) => [name, headers[name]])), resultingRevision: replayData.revision });
    // The UI intentionally ignores the mutation body and reauthorizes through
    // GET. Read the same persisted surface through the context request client;
    // Chromium can defer response.body() for an unread page-fetch body.
    const collection = action === "create" ? pathname : pathname.slice(0, pathname.lastIndexOf("/"));
    const current = await page.request.get(`${appUrl}${collection}`, { timeout: 10_000 });
    assert.equal(current.status(), 200, "Current task reread remains authorized after mutation");
    const body = await current.json();
    const tasks = Array.isArray(body.data) ? body.data : body.data.tasks;
    const wanted = action === "create" ? tasks.find((item) => item.clientTitle === request.input.clientTitle) : tasks.find((item) => item.id === pathname.split("/").at(-1));
    assert(wanted, "Mutation result persists on the current authorized collection");
    return { task: wanted, request };
  };
  const loginChecks = [];
  const login = async (context, person, destination) => {
    context.setDefaultTimeout(15_000);
    context.setDefaultNavigationTimeout(30_000);
    const page = await context.newPage();
    loginChecks.push(observeBrowserErrors(page, { appUrl, additionalOrigins: [backend.url], expectedResponse: (response) => allowRevocationDenial && response.status() === 403 && new URL(response.url()).pathname.startsWith(`${clientCollectionPath}/`) && response.request().method() === "POST" }));
    page.on("requestfailed", (request) => { const item = { time: new Date().toISOString(), path: new URL(request.url()).pathname, failure: request.failure()?.errorText }; evidence.navigation.push(item); console.log(`[client-tasks-browser] Browser request failed ${JSON.stringify(item)}`); });
    page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) evidence.navigation.push({ time: new Date().toISOString(), path: new URL(frame.url()).pathname }); });
    await page.goto(`${appUrl}/login`);
    await page.locator('input[name="email"]').fill(person.email);
    await page.locator('input[name="password"]').fill(person.password);
    await page.getByRole("button", { name: "Iniciar Sessão", exact: true }).click();
    const terminalPath = destination.startsWith("/account/") ? "/account" : "/dashboard";
    await page.waitForURL((url) => url.pathname === terminalPath);
    await page.locator(destination.startsWith("/account/") ? 'a[href="/account/projetos"]' : `a[href="${staffProjectsPath}"]`).first().waitFor({ state: "visible" });
    await page.goto(`${appUrl}${destination}`);
    return page;
  };
  const persistedTask = async () => (await rest(`/rest/v1/project_tasks?id=eq.${task.id}&select=id,task_kind,status,milestone_id,client_publication,client_workflow,client_revision,client_generation,client_submission_sequence`)).data[0];
  const closeSheet = async (page) => {
    // A mutation temporarily unmounts the sheet while rereading its resource.
    // Wait for that real readiness boundary before asking to dismiss it.
    await expect(page.getByRole("dialog").getByRole("button", { name: "Editar configuração", exact: true })).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  };
  const openStaffTask = async () => {
    await staffPage.bringToFront();
    await staffPage.goto(`${appUrl}${staffPath}`);
    // The full board also retains accepted tasks and their submission history.
    await staffPage.getByRole("link", { name: /^Ver todas as tarefas/ }).click();
    await staffPage.getByRole("button").filter({ has: staffPage.getByText(title, { exact: true }) }).click();
    await expect(staffPage.getByRole("dialog")).toBeVisible();
    return staffPage.getByRole("dialog");
  };
  const refreshClient = async () => {
    console.log("[client-tasks-browser] Refreshing current client view");
    await clientPage.bringToFront();
    await expect(clientPage.getByRole("button", { name: "Atualizar tarefas", exact: true })).toBeEnabled();
    await clientPage.getByRole("button", { name: "Atualizar tarefas", exact: true }).click();
    await expect(clientPage.getByTestId("client-project-tasks").getByRole("status")).toHaveCount(0);
  };
  try {
    const password = "Synthetic-task-browser-only-2026!";
    const customer = await backend.createUser({ email: `task-customer-${fixtureSuffix}@example.invalid`, password, role: "client" });
    const otherCustomer = await backend.createUser({ email: `task-other-org-${fixtureSuffix}@example.invalid`, password, role: "client" });
    const contributor = await backend.createUser({ email: `task-contributor-${fixtureSuffix}@example.invalid`, password, role: "staff" });
    const observer = await backend.createUser({ email: `task-observer-${fixtureSuffix}@example.invalid`, password, role: "staff" });
    const adminToken = await tokenFor(user), customerToken = await tokenFor(customer), otherToken = await tokenFor(otherCustomer);
    const otherOrganizationId = randomUUID(); milestoneId = randomUUID();
    await stage("prepare current synthetic organization, project audience and staff memberships", async () => {
      await rest(`/rest/v1/profiles?id=eq.${customer.profileId}`, { method: "PATCH", body: { first_name: "Cliente", last_name: "de prova" } });
      await rest("/rest/v1/organization_members", { method: "POST", body: { organization_id: project.organizationId, profile_id: customer.profileId, role: "member" } });
      await rest("/rest/v1/organizations", { method: "POST", body: { id: otherOrganizationId, name: "Organização B de prova" } });
      await rest("/rest/v1/organization_members", { method: "POST", body: { organization_id: otherOrganizationId, profile_id: otherCustomer.profileId, role: "member" } });
      await rest("/rest/v1/project_organizations", { method: "POST", token: adminToken, body: { project_id: project.projectId, organization_id: otherOrganizationId } });
      await rest("/rest/v1/rpc/set_project_client_access", { method: "POST", token: adminToken, body: { target_project_id: project.projectId, target_mode: "all_org_clients", target_organization_ids: [project.organizationId, otherOrganizationId], target_profile_grants: [] } });
      await rest("/rest/v1/rpc/sync_project_members_exact", { method: "POST", token: adminToken, body: { p_project_id: project.projectId, p_owner_profile_id: user.profileId, p_members: [{ profile_id: user.profileId, role: "owner" }, { profile_id: contributor.profileId, role: "contributor" }, { profile_id: observer.profileId, role: "observer" }] } });
      await rest("/rest/v1/project_milestones", { method: "POST", token: adminToken, body: { id: milestoneId, project_id: project.projectId, title: "Meta partilhada de prova", visibility: "client", status: "pending" } });
    });
    staffContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    clientContext = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    await configureContext(staffContext); await configureContext(clientContext);
    staffPage = await login(staffContext, contributor, staffPath);
    staffNoErrors = observeBrowserErrors(staffPage, { appUrl, additionalOrigins: [backend.url] });
    clientPage = await login(clientContext, customer, accountPath);
    clientNoErrors = observeBrowserErrors(clientPage, { appUrl, additionalOrigins: [backend.url], expectedResponse: (response) => allowRevocationDenial && response.status() === 403 && new URL(response.url()).pathname.startsWith(`${clientCollectionPath}/`) && response.request().method() === "POST" });

    await stage("contributor creates internal work without project, milestone or member management", async () => {
      await staffPage.bringToFront();
      await expect(staffPage.getByRole("button", { name: "Nova tarefa", exact: true })).toBeVisible();
      for (const name of ["Editar projeto", "Adicionar meta", "Gerir acesso", "Gerir equipa"]) await expect(staffPage.getByRole("button", { name, exact: true })).toHaveCount(0);
      for (const [method, endpoint, data] of [["PATCH", `/api/projects/${project.projectId}`, { name: "Denied contributor project edit" }], ["POST", `/api/projects/${project.projectId}/milestones`, { title: "Denied contributor milestone" }], ["PUT", `/api/projects/${project.projectId}/members`, { members: [] }]]) {
        const response = await staffContext.request.fetch(`${appUrl}${endpoint}`, { method, data });
        assert.equal(response.status(), 403, `Contributor cannot ${method} ${endpoint.split("/").at(-1)}`);
      }
      await screen(staffPage, "01-contributor-task-controls");
      await staffPage.getByRole("button", { name: "Nova tarefa", exact: true }).click();
      const sheet = staffPage.getByRole("dialog");
      await expect(sheet.getByRole("radio", { name: "Equipa interna", exact: true })).toBeChecked();
      await sheet.getByLabel("Título", { exact: true }).fill("Tarefa interna criada pelo colaborador");
      const pending = staffPage.waitForResponse((response) => new URL(response.url()).pathname === `/api/projects/${project.projectId}/tasks` && response.request().method() === "POST");
      await sheet.getByRole("button", { name: "Criar tarefa", exact: true }).click();
      assert.equal((await pending).status(), 201);
      await expect(sheet).toBeHidden();
      const internal = await rest(`/rest/v1/project_tasks?project_id=eq.${project.projectId}&title=eq.${encodeURIComponent("Tarefa interna criada pelo colaborador")}&select=id,task_kind`);
      assert.equal(internal.data.length, 1); assert.equal(internal.data[0].task_kind, "internal");
    });
    await stage("contributor saves deliberately authored selected-audience client draft", async () => {
      await staffPage.getByRole("button", { name: "Nova tarefa", exact: true }).click();
      const sheet = staffPage.getByRole("dialog");
      await sheet.getByRole("radio", { name: "Membros da organização", exact: true }).check();
      await sheet.getByLabel("Título", { exact: true }).fill(title);
      await sheet.getByLabel("Instruções para o membro", { exact: true }).fill(instructions);
      await sheet.getByLabel("Organização destinatária", { exact: true }).click();
      await staffPage.getByRole("option", { name: "Consumer regression organization", exact: true }).click();
      await sheet.getByLabel("Quem pode ver e responder", { exact: true }).click();
      await staffPage.getByRole("option", { name: "Pessoas selecionadas", exact: true }).click();
      await sheet.getByRole("checkbox", { name: "Cliente de prova", exact: true }).check();
      await sheet.getByLabel("Responsável (opcional)", { exact: true }).click();
      await staffPage.getByRole("option", { name: "Cliente de prova", exact: true }).click();
      await sheet.getByLabel("Meta partilhada (opcional)", { exact: true }).click();
      await staffPage.getByRole("option", { name: "Meta partilhada de prova", exact: true }).click();
      await screen(staffPage, "02-deliberate-client-draft");
      ({ task } = await uiMutation(staffPage, collectionPath, "create", () => sheet.getByRole("button", { name: "Guardar rascunho", exact: true }).click(), 201));
      assert.equal(task.publication, "draft"); assert.equal(task.audienceMode, "selected");
      assert.deepEqual(task.selectedProfileIds, [customer.profileId]);
      await expect(sheet).toBeHidden();
      evidence.persisted.draft = await persistedTask();
      await refreshClient();
      await expect(clientPage.getByText("Ainda não existem tarefas partilhadas consigo.", { exact: true })).toBeVisible();
      await expect(clientPage.getByText(title, { exact: true })).toHaveCount(0);
      await screen(clientPage, "03-client-cannot-see-draft");
    });
    staffNoErrors(); await staffContext.close();
    staffContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await configureContext(staffContext);
    staffPage = await login(staffContext, user, staffPath);
    staffNoErrors = observeBrowserErrors(staffPage, { appUrl, additionalOrigins: [backend.url] });
    await stage("staff explicitly publishes; selected client reads safe fields only", async () => {
      const sheet = await openStaffTask();
      ({ task } = await uiMutation(staffPage, `${collectionPath}/${task.id}`, "publish", () => sheet.getByRole("button", { name: "Publicar para o membro", exact: true }).click()));
      assert.equal(task.publication, "published");
      await expect(sheet.getByRole("button", { name: "Retirar do membro", exact: true })).toBeVisible();
      await screen(staffPage, "04-staff-published");
      await closeSheet(staffPage);
      await refreshClient();
      await expect(clientPage.getByRole("heading", { name: title, exact: true })).toBeVisible();
      const list = await clientContext.request.get(`${appUrl}${clientCollectionPath}`);
      assert.equal(list.status(), 200);
      const safe = (await list.json()).data;
      assert.equal(safe.length, 1); assert.deepEqual(Object.keys(safe[0]).sort(), safeTaskKeys);
      assert.equal(safe[0].clientInstructions, instructions);
      assert(!JSON.stringify(safe).includes("Tarefa interna criada pelo colaborador"));
      evidence.persisted.published = await persistedTask();
      await screen(clientPage, "05-client-published-safe-fields");
    });
    await stage("other organization can read shared project but not this task; raw and protected client surfaces deny", async () => {
      const shared = await rest("/rest/v1/rpc/get_current_client_project", { method: "POST", token: otherToken, body: { target_project_id: project.projectId } });
      assert(shared.data && JSON.stringify(shared.data).includes(project.projectId), "Other organization has the shared project as positive control");
      const otherTasks = await rest("/rest/v1/rpc/list_current_client_project_tasks", { method: "POST", token: otherToken, body: { p_project_id: project.projectId } });
      assert.deepEqual(otherTasks.data, []);
      await rest("/rest/v1/rpc/act_on_current_client_project_task", { method: "POST", token: otherToken, statuses: [403], body: { p_project_id: project.projectId, p_task_id: task.id, p_request_id: randomUUID(), p_expected_revision: task.revision, p_action: "start", p_input: {} } });
      const raw = await rest(`/rest/v1/project_tasks?project_id=eq.${project.projectId}&select=id,title,description,client_title`, { token: customerToken });
      assert.deepEqual(raw.data, []);
      const rawWrite = await rest(`/rest/v1/project_tasks?id=eq.${task.id}`, { token: customerToken, method: "PATCH", body: { status: "done", client_workflow: "accepted" }, statuses: [200, 403] });
      if (rawWrite.status === 200) assert.deepEqual(rawWrite.data, []);
      await rest("/rest/v1/task_bindings?select=*", { token: customerToken, headers: { "Accept-Profile": "bw_projects_private" }, statuses: [401, 403, 404, 406] });
      await rest("/rest/v1/rpc/manage_project_client_task", { token: customerToken, method: "POST", statuses: [403], body: { p_project_id: project.projectId, p_task_id: task.id, p_request_id: randomUUID(), p_expected_revision: task.revision, p_action: "withdraw", p_input: {} } });
      const staffApi = await clientContext.request.patch(`${appUrl}${collectionPath}/${task.id}`, { data: { requestId: randomUUID(), expectedRevision: task.revision, action: "accept", input: { submissionSequence: 1, feedback: "" } } });
      assert.equal(staffApi.status(), 403);
      const protectedInput = await clientContext.request.post(`${appUrl}${clientCollectionPath}/${task.id}`, { data: { requestId: randomUUID(), expectedRevision: task.revision, action: "submit", input: { response: "Attempt", clientPublication: "published" } } });
      assert.equal(protectedInput.status(), 400);
      const oldApi = await clientContext.request.patch(`${appUrl}/api/projects/${project.projectId}/tasks/${task.id}`, { data: { status: "done" } });
      assert.equal(oldApi.status(), 403);
      assert.equal((await persistedTask()).client_workflow, "open");
    });
    await stage("client starts and submits; staff returns this exact immutable submission", async () => {
      await clientPage.bringToFront();
      const row = clientPage.locator(`[data-client-task-id="${task.id}"]`);
      ({ task } = await uiMutation(clientPage, `${clientCollectionPath}/${task.id}`, "start", () => row.getByRole("button", { name: "Iniciar tarefa", exact: true }).click()));
      await expect(row.getByText("Em curso", { exact: true })).toBeVisible();
      await row.getByLabel("Resposta", { exact: true }).fill(firstResponse);
      ({ task, request: submitRequest } = await uiMutation(clientPage, `${clientCollectionPath}/${task.id}`, "submit", () => row.getByRole("button", { name: "Enviar para revisão", exact: true }).click()));
      submittedFirst = task;
      assert.equal(task.workflow, "submitted"); assert.equal(task.submissionSequence, 1);
      await expect(row.getByText("Em revisão", { exact: true })).toBeVisible();
      await expect(row.getByLabel("Resposta", { exact: true })).toHaveCount(0);
      await screen(clientPage, "06-client-first-submission-readonly");
      const sheet = await openStaffTask();
      await expect(sheet.getByTestId("client-task-review").getByRole("heading")).toContainText("versão 1");
      await sheet.getByLabel("Feedback para o membro (obrigatório para devolver)", { exact: true }).fill(feedback);
      ({ task } = await uiMutation(staffPage, `${collectionPath}/${task.id}`, "return", () => sheet.getByRole("button", { name: "Devolver para correção", exact: true }).click()));
      assert.equal(task.workflow, "returned");
      evidence.persisted.returned = await persistedTask();
      await screen(staffPage, "07-staff-returned-exact-version");
      await closeSheet(staffPage);
      await refreshClient();
      await expect(row.getByText(feedback, { exact: true })).toBeVisible();
      await expect(row.getByLabel("Resposta", { exact: true })).toHaveValue(firstResponse);
      await screen(clientPage, "08-client-returned-feedback");
    });
    await stage("client resubmits; stale staff review rejects; exact second version is accepted", async () => {
      const row = clientPage.locator(`[data-client-task-id="${task.id}"]`);
      await row.getByLabel("Resposta", { exact: true }).fill(secondResponse);
      ({ task, request: submitRequest } = await uiMutation(clientPage, `${clientCollectionPath}/${task.id}`, "submit", () => row.getByRole("button", { name: "Enviar para revisão", exact: true }).click()));
      submittedSecond = task;
      assert.equal(task.submissionSequence, 2);
      const stale = await staffContext.request.patch(`${appUrl}${collectionPath}/${task.id}`, { data: { requestId: randomUUID(), expectedRevision: submittedFirst.revision, action: "accept", input: { submissionSequence: submittedFirst.submissionSequence, feedback: "stale decision" } } });
      assert.equal(stale.status(), 409);
      assert.equal((await persistedTask()).client_workflow, "submitted");
      const sheet = await openStaffTask();
      await expect(sheet.getByTestId("client-task-review").getByRole("heading")).toContainText("versão 2");
      ({ task } = await uiMutation(staffPage, `${collectionPath}/${task.id}`, "accept", () => sheet.getByRole("button", { name: "Aceitar envio", exact: true }).click()));
      accepted = task;
      assert.equal(task.workflow, "accepted");
      evidence.persisted.accepted = await persistedTask();
      assert.equal(evidence.persisted.accepted.status, "done");
      assert.equal(task.submissions.length, 2);
      assert.equal(task.submissions.find((submission) => submission.sequence === 1)?.response, firstResponse);
      assert.equal(task.submissions.find((submission) => submission.sequence === 2)?.response, secondResponse);
      await screen(staffPage, "09-staff-accepted-history");
      await closeSheet(staffPage);
      await refreshClient();
      await expect(row.getByText("Aceite", { exact: true })).toBeVisible();
      await expect(row.getByText(secondResponse, { exact: true })).toBeVisible();
      await expect(row.getByLabel("Resposta", { exact: true })).toHaveCount(0);
      await clientPage.reload();
      await expect(clientPage.locator(`[data-client-task-id="${task.id}"]`).getByText("Aceite", { exact: true })).toBeVisible();
      await screen(clientPage, "10-client-accepted-after-reload");
      const milestone = (await rest(`/rest/v1/project_milestones?id=eq.${milestoneId}&select=status,completed_at`)).data[0];
      assert.deepEqual(milestone, { status: "pending", completed_at: null });
      evidence.persisted.milestoneAfterAcceptance = milestone;
    });
    await stage("withdrawal hides old response; republish starts a clean generation", async () => {
      let sheet = await openStaffTask();
      ({ task } = await uiMutation(staffPage, `${collectionPath}/${task.id}`, "withdraw", () => sheet.getByRole("button", { name: "Retirar do membro", exact: true }).click()));
      assert.equal(task.publication, "withdrawn");
      await closeSheet(staffPage);
      await refreshClient();
      await expect(clientPage.locator(`[data-client-task-id="${task.id}"]`)).toHaveCount(0);
      await expect(clientPage.getByText(secondResponse, { exact: true })).toHaveCount(0);
      await screen(clientPage, "11-withdrawn-content-cleared");
      sheet = await openStaffTask();
      ({ task } = await uiMutation(staffPage, `${collectionPath}/${task.id}`, "publish", () => sheet.getByRole("button", { name: "Publicar para o membro", exact: true }).click()));
      assert(task.publicationGeneration > accepted.publicationGeneration);
      assert.equal(task.workflow, "open"); assert.equal(task.response, null);
      await closeSheet(staffPage);
      await refreshClient();
      const row = clientPage.locator(`[data-client-task-id="${task.id}"]`);
      await expect(row.getByLabel("Resposta", { exact: true })).toHaveValue("");
      await expect(row.getByText(secondResponse, { exact: true })).toHaveCount(0);
      await screen(clientPage, "12-republished-clean-generation");
    });
    await stage("current organization revocation clears an already-open client session and denies receipt replay", async () => {
      const row = clientPage.locator(`[data-client-task-id="${task.id}"]`);
      await row.getByLabel("Resposta", { exact: true }).fill("Texto privado ainda não enviado antes da revogação.");
      await rest(`/rest/v1/organization_members?organization_id=eq.${project.organizationId}&profile_id=eq.${customer.profileId}`, { method: "DELETE" });
      allowRevocationDenial = true;
      await uiMutation(clientPage, `${clientCollectionPath}/${task.id}`, "submit", () => row.getByRole("button", { name: "Enviar para revisão", exact: true }).click(), 403);
      await expect(row).toHaveCount(0);
      await expect(clientPage.getByText(instructions, { exact: true })).toHaveCount(0);
      await expect(clientPage.locator("textarea")).toHaveCount(0);
      await expect(clientPage.getByText("As tarefas deste projeto já não estão disponíveis.", { exact: true })).toBeVisible();
      const replay = await clientContext.request.post(`${appUrl}${clientCollectionPath}/${task.id}`, { data: submitRequest });
      assert.equal(replay.status(), 403, "Existing authenticated session cannot replay a formerly authorized submission receipt");
      const denied = await replay.json(); assert(!JSON.stringify(denied).includes(secondResponse));
      evidence.persisted.afterRevocation = await persistedTask();
      assert.equal(evidence.persisted.afterRevocation.client_workflow, "open");
      assert.equal(evidence.persisted.afterRevocation.client_submission_sequence, submittedSecond.submissionSequence);
      await screen(clientPage, "13-revoked-session-content-cleared");
    });
    staffNoErrors(); clientNoErrors();
    for (const check of loginChecks) check();
    evidence.status = "pass";
    evidence.completedAt = new Date().toISOString();
    delete evidence.currentStage;
    await save();
    console.log(`[client-tasks-browser] PASS ${evidence.checks.length} stages; ${evidence.screenshots.length} screenshots; actual persisted task and milestone assertions`);
  } catch (error) {
    evidence.status = "fail";
    evidence.failure = String(error?.message ?? error).replace(/eyJ[A-Za-z0-9_.-]+/g, "[redacted token]").replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[redacted key]");
    for (const [name, page] of [["failure-staff", staffPage], ["failure-client", clientPage]]) if (page && !page.isClosed()) await screen(page, name).catch(() => {});
    await save();
    throw new Error(`Client task browser stage '${evidence.currentStage}' failed: ${evidence.failure}`);
  } finally {
    await browser.close();
  }
}
