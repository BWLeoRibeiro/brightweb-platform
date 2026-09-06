import assert from "node:assert/strict";
import test from "node:test";
import { activateWorkflow, pauseWorkflow, upsertWorkflowNodes, deleteWorkflowNode } from "../packages/module-marketing/src/workflows";

test("workflow replacement uses one atomic call and returns authoritative IDs in saved order", async () => {
  const calls: unknown[] = [];
  const client = {
    from() { throw new Error("No nontransactional table requests expected"); },
    async rpc(name: string, args: unknown) {
      calls.push([name, args]);
      return { data: [{ id: "saved-id", workflow_id: "workflow", position: 0, node_type: "wait", config: { durationMinutes: 1 }, created_at: "now", updated_at: "now" }], error: null };
    },
  };
  const nodes = await upsertWorkflowNodes(client, "workflow", [
    { id: "old-id", position: 9, nodeType: "wait", config: { durationMinutes: 2 } },
    { position: 2, nodeType: "wait", config: { durationMinutes: 1 } },
  ]);
  assert.deepEqual(calls, [["replace_marketing_workflow_nodes", { p_workflow_id: "workflow", p_nodes: [
    { node_type: "wait", config: { durationMinutes: 1 } },
    { id: "old-id", node_type: "wait", config: { durationMinutes: 2 } },
  ] }]]);
  assert.equal(nodes[0].id, "saved-id");
  assert.equal(nodes[0].position, 0);
});

test("failed or unavailable workflow transaction never falls back to destructive client writes", async () => {
  const client = {
    from() { throw new Error("No compensating writes expected"); },
    async rpc() { return { data: null, error: { message: "transaction unavailable" } }; },
  };
  await assert.rejects(upsertWorkflowNodes(client, "workflow", []), /transaction unavailable/);
  await assert.rejects(upsertWorkflowNodes({ ...client, rpc: async () => ({ data: null, error: null }) }, "workflow", []), /could not be confirmed/);
});

test("workflow activation and pause use the status transaction instead of a stale node snapshot", async () => {
  const calls: unknown[] = [];
  const client = {
    from() { throw new Error("No unlocked status or node reads expected"); },
    async rpc(name: string, args: { p_workflow_id: string; p_status: string }) {
      calls.push([name, args]);
      return { data: { id: args.p_workflow_id, status: args.p_status }, error: null };
    },
  };
  assert.equal((await activateWorkflow(client, "workflow")).status, "active");
  assert.equal((await pauseWorkflow(client, "workflow")).status, "paused");
  assert.deepEqual(calls, [
    ["set_marketing_workflow_status", { p_workflow_id: "workflow", p_status: "active" }],
    ["set_marketing_workflow_status", { p_workflow_id: "workflow", p_status: "paused" }],
  ]);
});


test("single-node deletion never replaces an unlocked snapshot of unrelated nodes", async () => {
  const calls: unknown[] = [];
  const client = {
    from() { throw new Error("No stale workflow snapshot expected"); },
    async rpc(name: string, args: unknown) { calls.push([name, args]); return { data: [], error: null }; },
  };
  assert.deepEqual(await deleteWorkflowNode(client, "workflow", "node"), []);
  assert.deepEqual(calls, [["delete_marketing_workflow_node", { p_workflow_id: "workflow", p_node_id: "node" }]]);
});
