import assert from "node:assert/strict";
import test from "node:test";
import {
  createProjectsTasksDeleteHandler,
  createProjectsTasksPatchHandler,
  createProjectsTasksPostHandler,
} from "../packages/module-projects/src/http.ts";
import { getClientProject, listClientProjects } from "../packages/module-projects/src/client-access.ts";

for (const [method, factory] of [
  ["POST", createProjectsTasksPostHandler],
  ["PATCH", createProjectsTasksPatchHandler],
  ["DELETE", createProjectsTasksDeleteHandler],
] as const) {
  test(`client task ${method} stays denied before project reads or mutations`, async () => {
    const internalCall = () => { throw new Error("Client reached internal Projects dependency"); };
    const handler = factory({
      getAccess: async () => ({ ok: true, supabase: {}, profileId: "client", role: "client" }),
      getProjectAccess: internalCall,
      getProjectTaskAssignment: internalCall,
      createTask: internalCall,
      updateTask: internalCall,
      deleteTask: internalCall,
      getDashboard: internalCall,
    } as never);
    const response = await handler(new Request("https://example.invalid/api/projects/project/tasks/task", {
      method,
      ...(method === "DELETE" ? {} : {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Client cannot edit", milestoneId: "private-milestone" }),
      }),
    }), { params: Promise.resolve({ id: "project", itemId: "task" }) });
    assert.equal(response.status, 403);
  });
}

test("client project projections discard internal task and nested milestone/document fields", async () => {
  const row = {
    project_id: "project", name: "Client project", progress_percent: 50,
    tasks: [{ id: "internal-task", description: "Internal instructions" }],
    task_count: 99, activity: [{ summary: "Private activity" }],
    meta_preview: [{ id: "visible", title: "Visible", status: "pending", description: "Private notes", tasks: ["internal"] }],
    metas: [{ id: "visible", title: "Visible", status: "pending", description: "Private notes", tasks: ["internal"] }],
    documents: [{ id: "document", label: "Approved", url: "https://example.invalid/approved", kind: "doc", internal_notes: "Secret" }],
  };
  const calls: string[] = [];
  const client = { rpc: async (name: string) => { calls.push(name); return { data: [row], error: null }; } } as never;
  const items = await listClientProjects(client);
  const detail = await getClientProject(client, "project");
  assert.deepEqual(calls, ["list_current_client_projects", "get_current_client_project"]);
  assert.equal(items[0]?.progress.percent, 50);
  assert.equal(detail?.metas[0]?.id, "visible");
  assert.equal(detail?.documents[0]?.label, "Approved");
  const result = JSON.stringify({ items, detail });
  for (const forbidden of ["internal-task", "Internal instructions", "Private activity", "Private notes", "internal_notes", "task_count", '"tasks"']) {
    assert.equal(result.includes(forbidden), false, forbidden);
  }
});
