import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export async function checkWorkflowTransactions({ db, service, connect, check, root }) {
  const folder = path.join(root, 'packages/create-bw-app/template/supabase/modules/marketing/migrations');
  for (const file of (await readdir(folder)).filter(file => file.endsWith('.sql')).sort()) {
    await db.query(await readFile(path.join(folder, file), 'utf8'));
  }
  async function fixture() {
    const id = randomUUID();
    await db.query("INSERT INTO marketing_workflows(id,name,trigger_type) VALUES($1,'Synthetic workflow','form_submitted')", [id]);
    const nodes = [];
    for (let position = 0; position < 3; position++) {
      const nodeId = randomUUID();
      await db.query("INSERT INTO marketing_workflow_nodes(id,workflow_id,position,node_type,config) VALUES($1,$2,$3,'wait','{\"durationMinutes\":1}')", [nodeId, id, position]);
      nodes.push({ id: nodeId, node_type: 'wait', config: { durationMinutes: 1 } });
    }
    return { id, nodes };
  }
  const replace = (client, id, nodes) => client.query('SELECT * FROM public.replace_marketing_workflow_nodes($1,$2)', [id, JSON.stringify(nodes)]);
  const status = (client, id, value) => client.query('SELECT public.set_marketing_workflow_status($1,$2) AS result', [id, value]);
  const deleteNode = (client, id, nodeId) => client.query('SELECT * FROM public.delete_marketing_workflow_node($1,$2)', [id, nodeId]);
  const rows = async id => (await db.query('SELECT id,position,node_type,config FROM marketing_workflow_nodes WHERE workflow_id=$1 ORDER BY position', [id])).rows;
  async function waitForLock(client) {
    for (let i = 0; i < 1000; i++) {
      const result = await db.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [client.processID]);
      if (result.rows[0]?.wait_event_type === 'Lock') return;
    }
    assert.fail('operation must reach a PostgreSQL lock wait');
  }
  await check('workflow node reorder retains IDs and step history', async () => {
    const f = await fixture(), runId = randomUUID(), stepId = randomUUID();
    await db.query('INSERT INTO marketing_workflow_runs(id,workflow_id) VALUES($1,$2)', [runId, f.id]);
    await db.query("INSERT INTO marketing_workflow_step_runs(id,run_id,node_id,status) VALUES($1,$2,$3,'done')", [stepId, runId, f.nodes[0].id]);
    const result = await replace(service, f.id, [f.nodes[1], f.nodes[0], f.nodes[2]]);
    assert.deepEqual(result.rows.map(row => row.id), [f.nodes[1].id, f.nodes[0].id, f.nodes[2].id]);
    assert.deepEqual(result.rows.map(row => row.position), [0, 1, 2]);
    assert.equal((await db.query('SELECT node_id FROM marketing_workflow_step_runs WHERE id=$1', [stepId])).rows[0].node_id, f.nodes[0].id);
  });
  await check('workflow deletion and reorder commit together', async () => {
    const f = await fixture();
    await replace(service, f.id, [f.nodes[1], f.nodes[0]]);
    assert.deepEqual((await rows(f.id)).map(row => [row.id, row.position]), [[f.nodes[1].id, 0], [f.nodes[0].id, 1]]);
  });
  await check('workflow failed replacement restores deleted nodes and retained content', async () => {
    const f = await fixture(), before = await rows(f.id);
    await db.query(`CREATE FUNCTION public.reject_workflow_edit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${f.nodes[1].id}'::uuid THEN RAISE EXCEPTION 'synthetic node write failure'; END IF; RETURN NEW; END; $$;
      CREATE TRIGGER reject_workflow_edit BEFORE UPDATE ON public.marketing_workflow_nodes FOR EACH ROW EXECUTE FUNCTION public.reject_workflow_edit();`);
    try {
      await assert.rejects(replace(service, f.id, [f.nodes[1], { ...f.nodes[0], config: { durationMinutes: 10 } }]), /synthetic node write failure/);
      assert.deepEqual(await rows(f.id), before);
    } finally {
      await db.query('DROP TRIGGER reject_workflow_edit ON public.marketing_workflow_nodes; DROP FUNCTION public.reject_workflow_edit();');
    }
  });
  await check('workflow rejects foreign duplicate stale and invalid nodes before mutation', async () => {
    const f = await fixture(), other = await fixture(), before = await rows(f.id), otherBefore = await rows(other.id);
    for (const nodes of [[other.nodes[0]], [f.nodes[0], f.nodes[0]], [{ ...f.nodes[0], id: randomUUID() }], [{ node_type: 'invalid' }], [{ node_type: 'wait', config: [] }]]) {
      await assert.rejects(replace(service, f.id, nodes));
      assert.deepEqual(await rows(f.id), before);
      assert.deepEqual(await rows(other.id), otherBefore);
    }
    await assert.rejects(replace(service, randomUUID(), []), /not found/);
  });
  await check('workflow returns generated IDs for safe retry and supports empty replacement', async () => {
    const f = await fixture();
    const result = await replace(service, f.id, [{ node_type: 'wait', config: { durationMinutes: 2 } }]);
    assert.equal(result.rows.length, 1);
    const saved = result.rows[0];
    const retried = await replace(service, f.id, [{ id: saved.id, node_type: saved.node_type, config: saved.config }]);
    assert.equal(retried.rows[0].id, saved.id);
    await replace(service, f.id, []);
    assert.deepEqual(await rows(f.id), []);
    await assert.rejects(status(service, f.id, 'active'), /at least one node/);
  });
  for (const role of ['anon', 'authenticated']) await check(`workflow mutation RPCs deny ${role}`, async () => {
    const f = await fixture(), client = await connect(role), before = await rows(f.id);
    await assert.rejects(replace(client, f.id, []), error => error.code === '42501');
    await assert.rejects(status(client, f.id, 'active'), error => error.code === '42501');
    await assert.rejects(deleteNode(client, f.id, f.nodes[0].id), error => error.code === '42501');
    assert.deepEqual(await rows(f.id), before);
  });
  await check('workflow activation and pause enforce editable state', async () => {
    const f = await fixture();
    assert.equal((await status(service, f.id, 'active')).rows[0].result.status, 'active');
    await assert.rejects(replace(service, f.id, []), /Pause/);
    await assert.rejects(deleteNode(service, f.id, f.nodes[0].id), /Pause/);
    await status(service, f.id, 'paused');
    await replace(service, f.id, []);
    await assert.rejects(status(service, f.id, 'draft'), /Invalid workflow status/);
  });
  await check('single-node deletion preserves concurrent appends and edits', async () => {
    const f = await fixture(), first = await connect('service_role'), second = await connect('service_role');
    await first.query('BEGIN');
    const saved = await replace(first, f.id, [f.nodes[0], { ...f.nodes[1], config: { durationMinutes: 99 } }, f.nodes[2], { node_type: 'wait', config: { durationMinutes: 7 } }]);
    const appended = saved.rows[3].id;
    const pending = deleteNode(second, f.id, f.nodes[0].id);
    await waitForLock(second);
    await first.query('COMMIT');
    const remaining = (await pending).rows;
    assert.deepEqual(remaining.map(row => row.id), [f.nodes[1].id, f.nodes[2].id, appended]);
    assert.deepEqual(remaining.map(row => row.position), [0, 1, 2]);
    assert.equal(remaining[0].config.durationMinutes, 99);
    await deleteNode(service, f.id, f.nodes[0].id);
    assert.deepEqual((await rows(f.id)).map(row => row.id), remaining.map(row => row.id));
  });
  for (const activateFirst of [true, false]) await check(`workflow activation and clearing serialize with ${activateFirst ? 'activation' : 'edit'} first`, async () => {
    const f = await fixture(), first = await connect('service_role'), second = await connect('service_role');
    await first.query('BEGIN');
    if (activateFirst) await status(first, f.id, 'active'); else await replace(first, f.id, []);
    const pending = (activateFirst ? replace(second, f.id, []) : status(second, f.id, 'active')).then(() => null, error => error);
    await waitForLock(second);
    await first.query('COMMIT');
    assert.match((await pending).message, activateFirst ? /Pause/ : /at least one node/);
    assert.equal((await rows(f.id)).length, activateFirst ? 3 : 0);
  });
}
