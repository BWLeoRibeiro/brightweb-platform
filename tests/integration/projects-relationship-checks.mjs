import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as pollInterval } from 'node:timers/promises';

export const projectsRelationshipMigration = '20261015135430_enforce_task_milestone_project.sql';

// Run after checkProjects has applied the distributable Projects history.
// Every record here is synthetic; no external connection/URL is accepted.
export async function checkProjectsRelationships({ db, connect, check, root }) {
  const sql = await readFile(path.join(root, 'packages/create-bw-app/template/supabase/modules/projects/migrations', projectsRelationshipMigration), 'utf8');
  const organization = randomUUID(), project = randomUUID(), otherProject = randomUUID();
  await db.query("INSERT INTO organizations(id,name) VALUES($1,'Relationship fixture')", [organization]);
  await db.query("INSERT INTO projects(id,organization_id,name) VALUES($1,$3,'Relationship A'),($2,$3,'Relationship B')", [project, otherProject, organization]);
  async function identity(role, member = false) {
    const user = randomUUID();
    await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())', [user, `${user}@example.invalid`]);
    const profile = (await db.query('SELECT id FROM profiles WHERE user_id=$1', [user])).rows[0].id;
    await db.query('INSERT INTO user_role_assignments(profile_id,role_code) VALUES($1,$2) ON CONFLICT(profile_id) DO UPDATE SET role_code=excluded.role_code', [profile, role]);
    if (member) await db.query("INSERT INTO organization_members(organization_id,profile_id,role) VALUES($1,$2,'member')", [organization, profile]);
    const client = await connect('authenticated');
    await client.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false),set_config('request.jwt.claims',$2,false)", [user, JSON.stringify({ sub: user, role: 'authenticated' })]);
    return { client, profile };
  }
  const admin = await identity('admin'), owner = await identity('staff');
  const customer = await identity('client', true), unselected = await identity('client', true);
  await admin.client.query('SELECT sync_project_members_exact($1,$2,$3)', [project, JSON.stringify([{ profile_id: owner.profile, role: 'owner' }]), owner.profile]);
  const service = await connect('service_role');
  const milestone = randomUUID(), foreignMilestone = randomUUID(), task = randomUUID(), unlinked = randomUUID();
  await admin.client.query("INSERT INTO project_milestones(id,project_id,title) VALUES($1,$3,'Private milestone'),($2,$4,'Foreign milestone')", [milestone, foreignMilestone, project, otherProject]);
  const taskState = async () => (await db.query('SELECT * FROM project_tasks WHERE project_id=ANY($1::uuid[]) ORDER BY id', [[project, otherProject]])).rows;
  const eventState = async () => (await db.query("SELECT * FROM app_activity_events WHERE payload->>'project_id'=ANY($1::text[]) ORDER BY id", [[project, otherProject]])).rows;
  const mismatch = error => error.code === '23503' && error.constraint === 'project_tasks_milestone_id_fkey';

  await check('relationship allows same-project and no-milestone tasks through authenticated and service writes', async () => {
    await owner.client.query("INSERT INTO project_tasks(id,project_id,milestone_id,title,assignee_profile_id) VALUES($1,$2,$3,'Owned task',$4)", [task, project, milestone, owner.profile]);
    await service.query("INSERT INTO project_tasks(id,project_id,title) VALUES($1,$2,'No milestone')", [unlinked, project]);
    assert.deepEqual((await db.query('SELECT project_id,milestone_id FROM project_tasks WHERE id=$1', [task])).rows, [{ project_id: project, milestone_id: milestone }]);
    assert.equal((await db.query('SELECT milestone_id FROM project_tasks WHERE id=$1', [unlinked])).rows[0].milestone_id, null);
    await owner.client.query('UPDATE project_tasks SET milestone_id=$1 WHERE id=$2', [milestone, unlinked]);
    await owner.client.query('UPDATE project_tasks SET milestone_id=null WHERE id=$1', [unlinked]);
    assert.equal((await db.query('SELECT milestone_id FROM project_tasks WHERE id=$1', [unlinked])).rows[0].milestone_id, null);
  });
  for (const [label, client] of [['authenticated admin', admin.client], ['service', service]]) {
    await check(`relationship rejects cross-project task insert/update atomically for ${label}`, async () => {
      const before = await taskState(), events = await eventState();
      await assert.rejects(client.query("INSERT INTO project_tasks(project_id,milestone_id,title) VALUES($1,$2,'Rejected')", [project, foreignMilestone]), mismatch);
      await assert.rejects(client.query("UPDATE project_tasks SET milestone_id=$1,title='Rejected edit' WHERE id=$2", [foreignMilestone, task]), mismatch);
      assert.deepEqual(await taskState(), before);
      assert.deepEqual(await eventState(), events);
      // Use an unassigned linked row so the assignee guard cannot mask the FK.
      await client.query('UPDATE project_tasks SET milestone_id=$1 WHERE id=$2', [milestone, unlinked]);
      const linkedState = await taskState(), linkedEvents = await eventState();
      await assert.rejects(client.query('UPDATE project_tasks SET project_id=$1 WHERE id=$2', [otherProject, unlinked]), mismatch);
      assert.deepEqual(await taskState(), linkedState);
      assert.deepEqual(await eventState(), linkedEvents);
      await client.query('UPDATE project_tasks SET milestone_id=null WHERE id=$1', [unlinked]);
    });
  }
  await check('relationship rejects required-project removal, missing milestones and partial bulk inserts', async () => {
    const before = await taskState(), events = await eventState();
    await assert.rejects(service.query("INSERT INTO project_tasks(project_id,title) VALUES(null,'Project required')"), error => error.code === '23502');
    await assert.rejects(service.query('UPDATE project_tasks SET project_id=null WHERE id=$1', [unlinked]), error => error.code === '23502');
    await assert.rejects(service.query("INSERT INTO project_tasks(project_id,milestone_id,title) VALUES($1,$2,'Missing milestone')", [project, randomUUID()]), mismatch);
    await assert.rejects(service.query("INSERT INTO project_tasks(project_id,milestone_id,title) VALUES($1,$2,'Valid first'),($1,$3,'Invalid second')", [project, milestone, foreignMilestone]), mismatch);
    assert.deepEqual(await taskState(), before);
    assert.deepEqual(await eventState(), events);
  });
  await check('relationship failure rolls back earlier writes and their activity in an explicit transaction', async () => {
    const before = await taskState(), events = await eventState();
    await service.query('BEGIN');
    try {
      await service.query("INSERT INTO project_tasks(project_id,title) VALUES($1,'Earlier write')", [project]);
      await assert.rejects(service.query('UPDATE project_tasks SET milestone_id=$1 WHERE id=$2', [foreignMilestone, task]), mismatch);
    } finally { await service.query('ROLLBACK'); }
    assert.deepEqual(await taskState(), before);
    assert.deepEqual(await eventState(), events);
  });
  await check('relationship rejects referenced parent reassignment and permits an unreferenced parent move', async () => {
    await assert.rejects(service.query('UPDATE project_milestones SET project_id=$1 WHERE id=$2', [otherProject, milestone]), mismatch);
    assert.equal((await db.query('SELECT project_id FROM project_milestones WHERE id=$1', [milestone])).rows[0].project_id, project);
    await service.query('UPDATE project_milestones SET project_id=$1 WHERE id=$2', [project, foreignMilestone]);
    assert.equal((await db.query('SELECT project_id FROM project_milestones WHERE id=$1', [foreignMilestone])).rows[0].project_id, project);
    await service.query('UPDATE project_milestones SET project_id=$1 WHERE id=$2', [otherProject, foreignMilestone]);
    // Moving an unassigned task together with its matching milestone remains valid.
    await service.query('UPDATE project_tasks SET project_id=$1,milestone_id=$2 WHERE id=$3', [otherProject, foreignMilestone, unlinked]);
    assert.deepEqual((await db.query('SELECT project_id,milestone_id FROM project_tasks WHERE id=$1', [unlinked])).rows, [{ project_id: otherProject, milestone_id: foreignMilestone }]);
    await service.query('UPDATE project_tasks SET project_id=$1,milestone_id=null WHERE id=$2', [project, unlinked]);
  });
  for (const [label, client] of [['owner', owner.client], ['admin', admin.client], ['service', service]]) {
    await check(`milestone deletion by ${label} preserves assigned tasks and required project`, async () => {
      const parent = randomUUID(), child = randomUUID();
      await admin.client.query("INSERT INTO project_milestones(id,project_id,title) VALUES($1,$2,'Deletable')", [parent, project]);
      await admin.client.query("INSERT INTO project_tasks(id,project_id,milestone_id,title,assignee_profile_id) VALUES($1,$2,$3,'Preserved task',$4)", [child, project, parent, owner.profile]);
      const before = (await db.query('SELECT * FROM project_tasks WHERE id=$1', [child])).rows[0];
      assert.equal((await client.query('DELETE FROM project_milestones WHERE id=$1', [parent])).rowCount, 1);
      const after = (await db.query('SELECT * FROM project_tasks WHERE id=$1', [child])).rows[0];
      assert.deepEqual({ ...after, updated_at: before.updated_at }, { ...before, milestone_id: null });
    });
  }
  await check('project deletion still cascades tasks and milestones', async () => {
    const parent = randomUUID(), meta = randomUUID(), child = randomUUID();
    await admin.client.query("INSERT INTO projects(id,organization_id,name) VALUES($1,$2,'Cascade fixture')", [parent, organization]);
    await admin.client.query("INSERT INTO project_milestones(id,project_id,title) VALUES($1,$2,'Cascade milestone')", [meta, parent]);
    await admin.client.query("INSERT INTO project_tasks(id,project_id,milestone_id,title) VALUES($1,$2,$3,'Cascade task')", [child, parent, meta]);
    await admin.client.query('DELETE FROM projects WHERE id=$1', [parent]);
    assert.deepEqual((await db.query('SELECT id FROM project_tasks WHERE id=$1', [child])).rows, []);
    assert.deepEqual((await db.query('SELECT id FROM project_milestones WHERE id=$1', [meta])).rows, []);
  });
  await check('legacy invalid-data preflight refuses atomically and leaves rows and old protection intact', async () => {
    await db.query('BEGIN');
    try {
      await db.query(`ALTER TABLE project_tasks DROP CONSTRAINT project_tasks_milestone_id_fkey,
        ADD CONSTRAINT project_tasks_milestone_id_fkey FOREIGN KEY(milestone_id) REFERENCES project_milestones(id) ON DELETE SET NULL;
        ALTER TABLE project_milestones DROP CONSTRAINT project_milestones_id_project_id_key;
        DROP INDEX idx_project_tasks_milestone_project;`);
      await db.query("INSERT INTO project_tasks(project_id,milestone_id,title) VALUES($1,$2,'Invalid legacy relationship')", [project, foreignMilestone]);
      const before = await taskState(), events = await eventState();
      const constraints = async () => (await db.query("SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid IN ('project_tasks'::regclass,'project_milestones'::regclass) ORDER BY conname")).rows;
      const oldConstraints = await constraints();
      await db.query('SAVEPOINT migration_attempt');
      await assert.rejects(db.query(sql), error => error.code === '23514' && error.detail === 'invalid_task_milestone_relationships=1' && /read-only aggregate preflight/.test(error.hint));
      await db.query('ROLLBACK TO SAVEPOINT migration_attempt');
      assert.deepEqual(await taskState(), before);
      assert.deepEqual(await eventState(), events);
      assert.deepEqual(await constraints(), oldConstraints);
      assert.equal((await db.query("SELECT to_regclass('idx_project_tasks_milestone_project') AS name")).rows[0].name, null);
    } finally { await db.query('ROLLBACK'); }
  });
  await check('legacy valid-data preflight installs a validated relationship without changing rows or activity', async () => {
    const before = await taskState(), events = await eventState();
    await db.query('BEGIN');
    try {
      await db.query(`ALTER TABLE project_tasks DROP CONSTRAINT project_tasks_milestone_id_fkey,
        ADD CONSTRAINT project_tasks_milestone_id_fkey FOREIGN KEY(milestone_id) REFERENCES project_milestones(id) ON DELETE SET NULL;
        ALTER TABLE project_milestones DROP CONSTRAINT project_milestones_id_project_id_key;
        DROP INDEX idx_project_tasks_milestone_project;`);
      await db.query(sql);
      assert.deepEqual(await taskState(), before);
      assert.deepEqual(await eventState(), events);
      assert.deepEqual((await db.query("SELECT convalidated,array_length(conkey,1) AS columns FROM pg_constraint WHERE conrelid='project_tasks'::regclass AND conname='project_tasks_milestone_id_fkey'")).rows, [{ convalidated: true, columns: 2 }]);
    } finally { await db.query('ROLLBACK'); }
  });

  // The polling interval only yields between catalog observations. Progress is
  // gated by an actual blocker, never by an assumed amount of elapsed time.
  async function waitForLock(blocked, blocker) {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if ((await db.query('SELECT $1::int=ANY(pg_blocking_pids($2::int)) AS blocked', [blocker, blocked])).rows[0].blocked) return;
      await pollInterval(10);
    }
    throw new Error('Expected relationship row lock was not observed');
  }
  for (const first of ['task link', 'parent move']) {
    await check(`concurrent ${first} first cannot commit a cross-project relationship`, async () => {
      const parent = randomUUID(), child = randomUUID();
      await service.query("INSERT INTO project_milestones(id,project_id,title) VALUES($1,$2,'Concurrent parent')", [parent, project]);
      const a = await connect('service_role'), b = await connect('service_role');
      const aPid = (await a.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const bPid = (await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await a.query('BEGIN'); await b.query('BEGIN');
      let pending;
      const link = client => client.query("INSERT INTO project_tasks(id,project_id,milestone_id,title) VALUES($1,$2,$3,'Concurrent task')", [child, project, parent]);
      const move = client => client.query('UPDATE project_milestones SET project_id=$1 WHERE id=$2', [otherProject, parent]);
      try {
        await (first === 'task link' ? link(a) : move(a));
        pending = (first === 'task link' ? move(b) : link(b)).then(result => ({ result }), error => ({ error }));
        await waitForLock(bPid, aPid);
        await a.query('COMMIT');
        const outcome = await pending;
        assert(outcome.error && mismatch(outcome.error), `Expected composite FK rejection: ${outcome.error?.message}`);
        await b.query('ROLLBACK');
        assert.equal((await db.query('SELECT count(*)::int n FROM project_tasks task JOIN project_milestones milestone ON milestone.id=task.milestone_id WHERE task.project_id<>milestone.project_id')).rows[0].n, 0);
        assert.equal((await db.query('SELECT project_id FROM project_milestones WHERE id=$1', [parent])).rows[0].project_id, first === 'task link' ? project : otherProject);
        assert.equal((await db.query('SELECT count(*)::int n FROM project_tasks WHERE id=$1', [child])).rows[0].n, first === 'task link' ? 1 : 0);
      } finally {
        await a.query('ROLLBACK'); await b.query('ROLLBACK');
        if (pending) await pending;
      }
    });
  }

  const visiblePending = randomUUID(), visibleDone = randomUUID(), privateMeta = randomUUID();
  const visibleLink = randomUUID(), privateLink = randomUUID();
  await admin.client.query("INSERT INTO project_milestones(id,project_id,title,visibility,status) VALUES($1,$4,'Approved pending','client','pending'),($2,$4,'Approved achieved','client','achieved'),($3,$4,'Private milestone content','staff','in_progress')", [visiblePending, visibleDone, privateMeta, project]);
  await admin.client.query("INSERT INTO project_links(id,project_id,label,url,visibility) VALUES($1,$3,'Approved document','https://example.invalid/approved','client'),($2,$3,'Private document','https://example.invalid/private','staff')", [visibleLink, privateLink, project]);
  await admin.client.query("INSERT INTO project_tasks(project_id,milestone_id,title,description) VALUES($1,$2,'Private task content','Private task instructions')", [project, visiblePending]);
  const setAudience = (mode, grants = []) => admin.client.query('SELECT set_project_client_access($1,$2,$3,$4)', [project, mode, mode === 'hidden' ? [] : [organization], JSON.stringify(grants)]);
  const detail = client => client.query('SELECT * FROM get_current_client_project($1)', [project]);
  const listed = async client => (await client.query('SELECT * FROM list_current_client_projects() WHERE project_id=$1', [project])).rows;
  await setAudience('all_org_clients');
  await check('client SQL reads preserve private milestones, previews, progress, links and internal task denial', async () => {
    const list = (await listed(customer.client))[0], row = (await detail(customer.client)).rows[0];
    assert(row && list);
    assert.deepEqual(row.metas.map(meta => meta.id).sort(), [visiblePending, visibleDone].sort());
    assert.deepEqual(list.meta_preview.map(meta => meta.id), [visiblePending]);
    assert.equal(row.progress_percent, 50);
    assert.equal(list.progress_percent, 50);
    assert.deepEqual(row.documents.map(document => document.id), [visibleLink]);
    assert.equal('tasks' in row, false);
    const serialized = JSON.stringify({ list, row });
    for (const hidden of [privateMeta, privateLink, milestone, 'Private milestone content', 'Private document', 'Private task content', 'Private task instructions']) assert.equal(serialized.includes(hidden), false, hidden);
    assert.deepEqual((await customer.client.query('SELECT id FROM project_milestones WHERE project_id=$1 ORDER BY id', [project])).rows.map(meta => meta.id).sort(), [visiblePending, visibleDone].sort());
    assert.deepEqual((await customer.client.query('SELECT id FROM project_tasks WHERE project_id=$1', [project])).rows, []);
    assert.equal((await admin.client.query('SELECT id FROM project_tasks WHERE project_id=$1', [project])).rows.length > 0, true);
    await assert.rejects(customer.client.query("INSERT INTO project_tasks(project_id,title) VALUES($1,'Forbidden client task')", [project]), error => error.code === '42501');
    const before = await taskState();
    assert.equal((await customer.client.query("UPDATE project_tasks SET title='Forbidden client edit' WHERE project_id=$1", [project])).rowCount, 0);
    assert.equal((await customer.client.query('DELETE FROM project_tasks WHERE project_id=$1', [project])).rowCount, 0);
    assert.deepEqual(await taskState(), before);
  });
  await check('selected audience, hidden state, membership and role revocation apply to existing client sessions', async () => {
    await setAudience('selected_clients', [{ organization_id: organization, profile_id: customer.profile }]);
    assert.equal((await detail(customer.client)).rows.length, 1);
    assert.deepEqual((await detail(unselected.client)).rows, []);
    assert.deepEqual(await listed(unselected.client), []);
    await setAudience('hidden');
    assert.deepEqual((await detail(customer.client)).rows, []);
    assert.deepEqual(await listed(customer.client), []);
    await setAudience('selected_clients', [{ organization_id: organization, profile_id: customer.profile }]);
    await db.query('DELETE FROM organization_members WHERE organization_id=$1 AND profile_id=$2', [organization, customer.profile]);
    assert.deepEqual((await detail(customer.client)).rows, []);
    await db.query("INSERT INTO organization_members(organization_id,profile_id,role) VALUES($1,$2,'member')", [organization, customer.profile]);
    assert.deepEqual((await detail(customer.client)).rows, [], 'Rejoining must not restore a removed selected grant');
    await setAudience('all_org_clients');
    assert.equal((await detail(customer.client)).rows.length, 1);
    await db.query("UPDATE user_role_assignments SET role_code='staff' WHERE profile_id=$1", [customer.profile]);
    assert.deepEqual((await detail(customer.client)).rows, []);
    assert.deepEqual(await listed(customer.client), []);
    await db.query("UPDATE user_role_assignments SET role_code='client' WHERE profile_id=$1", [customer.profile]);
  });
}
