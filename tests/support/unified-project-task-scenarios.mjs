import assert from "node:assert/strict";
import React from "react";
import { act, create } from "react-test-renderer";
import { ProjectsUiProvider } from "../../packages/module-projects/src/ui/context.tsx";
import { ProjectDetailDataProvider } from "../../packages/module-projects/src/ui/project-detail-data-provider.tsx";
import { ProjectClientTasksProvider, openClientTaskPanel } from "../../packages/module-projects/src/ui/client-tasks/staff-client-tasks.tsx";
import { ProjectTaskCreateSheet } from "../../packages/module-projects/src/ui/project-detail-create-sheets/project-task-create-sheet.tsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const handlers = new Map();
globalThis.window = { addEventListener(name, fn) { const list = handlers.get(name) ?? new Set(); list.add(fn); handlers.set(name, list); }, removeEventListener(name, fn) { handlers.get(name)?.delete(fn); }, dispatchEvent(event) { handlers.get(event.type)?.forEach(fn => fn(event)); } };
globalThis.document = { addEventListener() {}, removeEventListener() {}, visibilityState: "visible" };
const projectId = "project";
const members = [{ profileId: "staff", label: "Staff", role: "owner" }, { profileId: "observer", label: "Observer", role: "observer" }];
const milestones = [{ id: "private", title: "Internal milestone", visibility: "staff" }, { id: "shared", title: "Shared milestone", visibility: "client" }];
const organization = { id: "org", name: "Organization", eligibleClients: [{ profileId: "member-a", label: "Member A" }, { profileId: "member-b", label: "Member B" }] };
const capabilities = { canCreateTasks: true, canShareClientTasks: true, canReviewClientTasks: true };
const data = { project: { id: projectId }, members, milestones, tasks: [], links: [], activity: [] };
const event = { preventDefault() {} };

async function mount({ serverCapabilities = capabilities, deny = false, uncertain = false, tasks = [], suppliedCapabilities = capabilities } = {}) {
  const requests = [], internal = [];
  let failures = uncertain ? 1 : 0;
  const client = {
    createTask: async (id, input) => { internal.push({ id, input }); return {}; },
    requestRaw: async (path, init = {}) => {
      if (!init.method || init.method === "GET") return Response.json({ data: { tasks, organizations: [organization], capabilities: serverCapabilities } });
      const body = JSON.parse(init.body); requests.push({ path, body });
      if (failures-- > 0) throw new Error("network outcome unknown");
      return Response.json(deny ? {} : { data: {} }, { status: deny ? 403 : 200 });
    },
  };
  let tree;
  await act(async () => { tree = create(React.createElement(ProjectsUiProvider, { client }, React.createElement(ProjectDetailDataProvider, { initialData: data }, React.createElement(ProjectClientTasksProvider, { projectId, capabilities: suppliedCapabilities }, React.createElement(ProjectTaskCreateSheet, { projectId, members, milestones, initialOpen: true }))))); });
  const field = id => tree.root.findAll(n => n.props.id === id && typeof n.props.onChange === "function")[0];
  const change = async (id, value) => act(async () => field(id).props.onChange({ target: { value } }));
  const recipient = kind => tree.root.findAll(n => n.type === "input" && n.props.type === "radio" && n.props.value === kind)[0];
  const choose = async kind => act(async () => recipient(kind).props.onChange());
  const submit = async () => act(async () => tree.root.findAllByType("form")[0].props.onSubmit(event));
  const close = async () => act(async () => tree.unmount());
  return { tree, requests, internal, field, change, recipient, choose, submit, close };
}

{
  const ui = await mount();
  await ui.change("task-create-title", "Shared title"); await ui.change("task-create-desc", "Shared instructions");
  await ui.change("task-create-assignee", "staff"); await ui.change("task-create-milestone", "private");
  await ui.choose("client");
  assert.equal(ui.field("task-create-title").props.value, "Shared title");
  assert.equal(ui.field("task-create-milestone").props.value, "", "private milestones cannot carry into member tasks");
  assert.equal(ui.field("task-create-member-assignee").props.value, "");
  assert.deepEqual(ui.field("task-create-member-assignee").findAllByType("option").map(n => n.props.value), ["", "member-a", "member-b"]);
  await ui.change("task-create-member-assignee", "member-a"); await ui.choose("internal");
  assert.equal(ui.field("task-create-assignee").props.value, "", "member responsibility cannot carry back to staff");
  assert.deepEqual(ui.field("task-create-assignee").findAllByType("option").map(n => n.props.value), ["", "staff"]);
  await ui.change("task-create-assignee", "staff"); await ui.submit();
  assert.equal(ui.internal.length, 1); assert.equal(ui.requests.length, 0);
  assert.equal(ui.internal[0].input.assigneeProfileId, "staff");
  assert.equal(ui.internal[0].input.status, "todo"); assert.equal(ui.internal[0].input.priority, "medium");
  assert.equal("action" in ui.internal[0].input, false); await ui.close();
}

{
  const ui = await mount(); await ui.change("task-create-title", "Member task"); await ui.change("task-create-desc", "Instructions"); await ui.choose("client");
  await ui.change("task-create-member-audience", "selected"); await ui.submit(); assert.equal(ui.requests.length, 0);
  await act(async () => ui.tree.root.findAllByType("Checkbox")[1].props.onChange({ target: { checked: true } }));
  assert.deepEqual(ui.field("task-create-member-assignee").findAllByType("option").map(n => n.props.value), ["", "member-b"]);
  await ui.change("task-create-member-assignee", "member-b"); await ui.submit();
  assert.equal(ui.requests.length, 1); assert.equal(ui.internal.length, 0);
  const request = ui.requests[0]; assert.equal(request.path, "/api/projects/project/client-tasks");
  assert.equal(request.body.action, "create"); assert.equal(request.body.expectedRevision, null);
  assert.deepEqual(request.body.input, { clientTitle: "Member task", clientInstructions: "Instructions", organizationId: "org", audienceMode: "selected", selectedProfileIds: ["member-b"], responsibleProfileId: "member-b", milestoneId: null, dueDate: null });
  assert.equal(ui.tree.root.findAllByType("Sheet")[0].props.open, false); await ui.close();
}

for (const gate of ["server", "page"]) {
  const denied = { ...capabilities, canCreateTasks: false };
  const ui = await mount(gate === "server" ? { serverCapabilities: denied } : { suppliedCapabilities: denied });
  assert.equal(ui.recipient("client").props.disabled, true);
  await ui.choose("client"); assert.equal(ui.recipient("internal").props.checked, true);
  await ui.change("task-create-title", "Internal remains available"); await ui.submit();
  assert.equal(ui.internal.length, 1); assert.equal(ui.requests.length, 0); await ui.close();
}

for (const mode of ["deny", "uncertain"]) {
  const ui = await mount({ [mode]: true }); await ui.choose("client"); await ui.change("task-create-title", "Keep draft"); await ui.change("task-create-desc", "Keep instructions");
  await ui.submit(); assert.equal(ui.field("task-create-title").props.value, "Keep draft"); assert.equal(ui.tree.root.findAllByType("Sheet")[0].props.open, true); assert.equal(ui.internal.length, 0);
  if (mode === "uncertain") { await ui.submit(); assert.equal(ui.requests.length, 2); assert.equal(ui.requests[0].body.requestId, ui.requests[1].body.requestId); assert.equal(ui.requests[1].body.action, "create"); }
  else { assert.equal(ui.recipient("client").props.disabled, true); await ui.submit(); assert.equal(ui.requests.length, 1); }
  await ui.close();
}

{
  const task = { id: "member-task", clientTitle: "Published task", clientInstructions: "Shared only", organizationId: "org", audienceMode: "all_eligible", selectedProfileIds: [], responsibleProfileId: "member-a", publication: "published", workflow: "open", revision: 7, milestone: null, dueDate: null, submissions: [] };
  const ui = await mount({ tasks: [task] });
  await act(async () => openClientTaskPanel(projectId, task.id));
  const textButton = label => ui.tree.root.findAll(n => n.type === "Button" && n.props.children === label)[0];
  assert.equal(Boolean(textButton("Retirar do membro")), true);
  await act(async () => textButton("Editar configuração").props.onClick());
  const locked = ui.tree.root.findAll(n => n.type === "input" && n.props.type === "radio" && n.props.disabled);
  assert.equal(locked.length, 2, "editing a member task cannot convert it to internal");
  await act(async () => ui.tree.root.findAllByType("form")[1].props.onSubmit(event));
  assert.equal(ui.requests[0].body.action, "configure"); assert.equal(ui.requests[0].body.expectedRevision, 7);
  assert.equal(ui.requests.some(r => r.body.action === "publish"), false, "saving configuration never publishes"); await ui.close();
}
console.log("Unified task interactions passed: recipient isolation, internal defaults, separate create/configure actions, permission denial and retry safety.");
