import assert from "node:assert/strict";
import test from "node:test";
import { getProjectAccess, listProjectTasks } from "../packages/module-projects/src/server.ts";

function accessClient(memberRole: string | null, owner = false) {
  return {
    from(table: string) {
      const query = {
        select() { return query; },
        eq() { return query; },
        async maybeSingle() {
          return { error: null, data: table === "projects"
            ? { id: "project", owner_profile_id: owner ? "actor" : null }
            : memberRole ? { role: memberRole } : null };
        },
      };
      return query;
    },
  };
}

test("task creation/sharing/review require a current global internal role and project responsibility", async () => {
  for (const [globalRole, memberRole, allowed] of [
    ["admin", null, true], ["staff", "owner", true], ["staff", "contributor", true],
    ["staff", "observer", false], ["staff", null, false], ["client", "owner", false],
    [null, "contributor", false],
  ] as const) {
    const access = await getProjectAccess(accessClient(memberRole) as never, "project", "actor", globalRole);
    assert.equal(access.permissions.canCreateTasks, allowed, `${globalRole}/${memberRole}`);
    assert.equal(access.permissions.canShareClientTasks, allowed);
    assert.equal(access.permissions.canReviewClientTasks, allowed);
    if (memberRole === "contributor" && globalRole === "staff") {
      assert.equal(access.permissions.canEditProjectItems, false);
      assert.equal(access.permissions.canManageMembers, false);
      assert.equal(access.permissions.canManageClientContent, false);
      assert.equal(access.permissions.canOpenEditProject, false);
      assert.equal(access.permissions.canManageProjectLinks, false);
    }
  }
});

test("combined staff tasks retain legacy defaults and display the authored current client title", async () => {
  const rows = [
    { id: "old", project_id: "project", title: "Private legacy title", description: "Private notes", status: "todo", priority: "medium" },
    { id: "new", project_id: "project", title: "Original internal label", client_title: "Updated client instructions title", task_kind: "client",
      client_publication: "published", client_workflow: "submitted", client_revision: 4, status: "in_progress", priority: "medium" },
  ];
  const query = { select() { return query; }, eq() { return query; }, order() { return query; },
    async range() { return { data: rows, error: null, count: rows.length }; } };
  const tasks = await listProjectTasks({ from: () => query } as never, "project");
  assert.equal(tasks[0].kind, "internal");
  assert.equal(tasks[0].title, "Private legacy title");
  assert.equal(tasks[0].description, "Private notes");
  assert.equal(tasks[1].kind, "client");
  assert.equal(tasks[1].title, "Updated client instructions title");
  assert.equal(tasks[1].clientWorkflow, "submitted");
  assert.equal(tasks[1].clientRevision, 4);
});
