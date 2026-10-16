import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as pollInterval } from 'node:timers/promises';

// Run after checkProjectsRelationships. All data and sessions belong to the
// fresh embedded cluster supplied by the shared runner; no URL is accepted.
export async function checkClientTasks({ db, connect, check, root }) {
  assert(root, 'The owning runner must supply its repository root');
  const ownedConnections = new Set();
  const open = connect;
  connect = async (...args) => {
    const client = await open(...args);
    ownedConnections.add(client);
    return client;
  };
  const denied = error => error?.code === '42501';
  const conflict = error => ['BW409', '40001'].includes(error?.code);
  const invalid = error => ['22023', '23514', '22001'].includes(error?.code);
  const safeKeys = ['id', 'project_id', 'client_title', 'client_instructions', 'publication_generation', 'workflow', 'revision', 'due_date', 'milestone', 'responsible_label', 'response', 'review_feedback', 'submission_sequence'].sort();
  const signatures = [
    'public.list_current_client_project_tasks(uuid)',
    'public.act_on_current_client_project_task(uuid,uuid,uuid,integer,text,jsonb)',
    'public.get_project_client_task_workbench(uuid)',
    'public.manage_project_client_task(uuid,uuid,uuid,integer,text,jsonb)',
  ];
  async function session(user) {
    const client = await connect('authenticated');
    await client.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false),set_config('request.jwt.claims',$2,false)", [user, JSON.stringify({ sub: user, role: 'authenticated', app_metadata: { role: 'admin' } })]);
    return client;
  }
  async function identity(role, organizations = []) {
    const user = randomUUID();
    await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())', [user, `${user}@example.invalid`]);
    const profile = (await db.query('SELECT id FROM profiles WHERE user_id=$1', [user])).rows[0].id;
    await db.query('INSERT INTO user_role_assignments(profile_id,role_code) VALUES($1,$2) ON CONFLICT(profile_id) DO UPDATE SET role_code=excluded.role_code', [profile, role]);
    for (const organization of organizations) await db.query("INSERT INTO organization_members(organization_id,profile_id,role) VALUES($1,$2,'member')", [organization, profile]);
    return { user, profile, client: await session(user) };
  }
  const admin = await identity('admin'), owner = await identity('staff'), contributor = await identity('staff'), observer = await identity('staff'), unrelated = await identity('staff');
  const anon = await connect('anon'), service = await connect('service_role');
  const persistentConnections = new Set(ownedConnections);
  const runCheck = check;
  check = (name, fn) => runCheck(name, async () => {
    try { await fn(); }
    finally {
      // The shared runner retains baseline sessions. Release this fixture's
      // sessions between checks rather than exhausting PostgreSQL connections.
      const disposable = [...ownedConnections].filter(client => !persistentConnections.has(client));
      await Promise.allSettled(disposable.map(client => client.end()));
      for (const client of disposable) ownedConnections.delete(client);
    }
  });
  const list = async (actor, project) => (await actor.client.query('SELECT public.list_current_client_project_tasks($1) AS value', [project])).rows[0].value;
  const workbench = async (actor, project) => (await actor.client.query('SELECT public.get_project_client_task_workbench($1) AS value', [project])).rows[0].value;
  const manage = async (actor, project, task, action, input = {}, requestId = randomUUID(), revision = task?.revision ?? null) => (await actor.client.query('SELECT public.manage_project_client_task($1,$2,$3,$4,$5,$6) AS value', [project, task?.id ?? null, requestId, revision, action, input])).rows[0].value;
  const act = async (actor, project, task, action, input = {}, requestId = randomUUID(), revision = task.revision) => (await actor.client.query('SELECT public.act_on_current_client_project_task($1,$2,$3,$4,$5,$6) AS value', [project, task.id, requestId, revision, action, input])).rows[0].value;
  const persisted = async task => (await db.query('SELECT * FROM public.project_tasks WHERE id=$1', [task.id])).rows[0];
  async function deniedWrite(promise) {
    const outcome = await promise.then(result => ({ result }), error => ({ error }));
    if (outcome.error) assert(denied(outcome.error), outcome.error.message);
    else assert.equal(outcome.result.rowCount, 0, 'RLS denial must affect no rows');
  }
  const safe = row => {
    assert.deepEqual(Object.keys(row).sort(), safeKeys);
    if (row.milestone !== null) assert.deepEqual(Object.keys(row.milestone).sort(), ['id', 'title']);
    assert.equal(typeof row.revision, 'number');
    assert.equal(typeof row.publication_generation, 'number');
    return row;
  };
  async function fixture() {
    const organization = randomUUID(), otherOrganization = randomUUID(), project = randomUUID();
    await db.query("INSERT INTO organizations(id,name) VALUES($1,'Task synthetic A'),($2,'Task synthetic B')", [organization, otherOrganization]);
    await admin.client.query("INSERT INTO projects(id,organization_id,name) VALUES($1,$2,'Task synthetic project')", [project, organization]);
    await admin.client.query('INSERT INTO project_organizations(project_id,organization_id) VALUES($1,$2)', [project, otherOrganization]);
    await admin.client.query('SELECT sync_project_members_exact($1,$2,$3)', [project, JSON.stringify([{ profile_id: owner.profile, role: 'owner' }, { profile_id: contributor.profile, role: 'contributor' }, { profile_id: observer.profile, role: 'observer' }]), owner.profile]);
    const customer = await identity('client', [organization]), peer = await identity('client', [organization]), other = await identity('client', [otherOrganization]), both = await identity('client', [organization, otherOrganization]);
    const access = (mode = 'all_org_clients', organizations = [organization, otherOrganization], grants = []) => admin.client.query('SELECT set_project_client_access($1,$2,$3,$4)', [project, mode, organizations, JSON.stringify(grants)]);
    await access();
    const config = (overrides = {}) => ({ clientTitle: 'Deliberately authored client work', clientInstructions: 'Provide the approved response.', organizationId: organization, audienceMode: 'all_eligible', selectedProfileIds: [], responsibleProfileId: null, dueDate: null, milestoneId: null, ...overrides });
    const create = async (overrides = {}, actor = owner) => manage(actor, project, null, 'create', config(overrides));
    const publish = async (overrides = {}, actor = owner) => manage(actor, project, await create(overrides, actor), 'publish');
    return { organization, otherOrganization, project, customer, peer, other, both, access, config, create, publish };
  }

  try {
    await check('client task RPCs have actual authenticated-only grants and a nonlogin non-bypass executor', async () => {
      for (const signature of signatures) {
        const row = (await db.query(`SELECT has_function_privilege('authenticated',$1,'EXECUTE') AS authenticated, has_function_privilege('anon',$1,'EXECUTE') AS anon, has_function_privilege('service_role',$1,'EXECUTE') AS service, p.prosecdef, p.proconfig, r.rolname AS owner FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid=$1::regprocedure`, [signature])).rows[0];
        assert.equal(row.authenticated, true, signature);
        assert.equal(row.anon, false, signature);
        assert.equal(row.service, false, signature);
        assert.equal(row.prosecdef, true, signature);
        assert(row.proconfig.some(value => /^search_path=(""|)$/.test(value)), signature);
        if (signature.includes('manage_') || signature.includes('act_on_')) assert.equal(row.owner, 'bw_projects_task_executor');
      }
      const role = (await db.query("SELECT rolcanlogin,rolsuper,rolbypassrls FROM pg_roles WHERE rolname='bw_projects_task_executor'")).rows[0];
      assert.deepEqual(role, { rolcanlogin: false, rolsuper: false, rolbypassrls: false });
      for (const roleName of ['anon', 'authenticated', 'service_role']) {
        assert.equal((await db.query("SELECT pg_has_role($1,'bw_projects_task_executor','MEMBER') AS member,has_schema_privilege($1,'bw_projects_private','USAGE') AS private_schema", [roleName])).rows[0].member, false);
        assert.equal((await db.query("SELECT has_schema_privilege($1,'bw_projects_private','USAGE') AS allowed", [roleName])).rows[0].allowed, false);
      }
      const privateTables = (await db.query("SELECT c.oid::text AS oid,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='bw_projects_private' AND c.relkind='r'")).rows;
      assert(privateTables.length >= 3);
      for (const table of privateTables) {
        assert.equal(table.relrowsecurity, true);
        for (const roleName of ['anon', 'authenticated']) assert.equal((await db.query("SELECT has_table_privilege($1,$2::oid,'SELECT,INSERT,UPDATE,DELETE') AS allowed", [roleName, table.oid])).rows[0].allowed, false);
      }
      const f = await fixture(), task = await f.publish();
      assert.equal((await list(f.customer, f.project)).length, 1);
      assert.equal((await workbench(owner, f.project)).tasks[0].id, task.id);
      for (const connection of [anon, service]) {
        await assert.rejects(connection.query('SELECT list_current_client_project_tasks($1)', [f.project]), denied);
        await assert.rejects(connection.query('SELECT get_project_client_task_workbench($1)', [f.project]), denied);
        await assert.rejects(connection.query("SELECT manage_project_client_task($1,$2,$3,$4,'withdraw','{}')", [f.project, task.id, randomUUID(), task.revision]), denied);
        await assert.rejects(connection.query("SELECT act_on_current_client_project_task($1,$2,$3,$4,'start','{}')", [f.project, task.id, randomUUID(), task.revision]), denied);
      }
    });
    await check('task capabilities require current staff roles and owner or contributor membership', async () => {
      const f = await fixture();
      for (const actor of [admin, owner, contributor]) {
        const board = await workbench(actor, f.project);
        assert.deepEqual(board.capabilities, { can_create_tasks: true, can_share_client_tasks: true, can_review_client_tasks: true });
        assert.equal((await f.create({}, actor)).publication, 'draft');
      }
      const board = await workbench(observer, f.project);
      assert.deepEqual(board.capabilities, { can_create_tasks: false, can_share_client_tasks: false, can_review_client_tasks: false });
      for (const actor of [observer, unrelated, f.customer]) await assert.rejects(f.create({}, actor), denied);
      for (const actor of [unrelated, f.customer]) await assert.rejects(workbench(actor, f.project), denied);
      await db.query("UPDATE project_members SET role='observer' WHERE project_id=$1 AND profile_id=$2", [f.project, contributor.profile]);
      await assert.rejects(f.create({}, contributor), denied);
      await db.query("UPDATE project_members SET role='contributor' WHERE project_id=$1 AND profile_id=$2", [f.project, contributor.profile]);
      assert.equal((await f.create({}, contributor)).publication, 'draft');
      await db.query('DELETE FROM project_members WHERE project_id=$1 AND profile_id=$2', [f.project, contributor.profile]);
      await assert.rejects(f.create({}, contributor), denied);
      // The actor is reused across synthetic projects. Preserve the existing
      // downgrade guard, then remove every remaining membership before changing
      // the current global role.
      await assert.rejects(db.query("UPDATE user_role_assignments SET role_code='client' WHERE profile_id=$1", [contributor.profile]), error => error.code === '23514');
      await db.query('DELETE FROM project_members WHERE profile_id=$1', [contributor.profile]);
      await db.query("UPDATE user_role_assignments SET role_code='client' WHERE profile_id=$1", [contributor.profile]);
      await assert.rejects(f.create({}, contributor), denied);
      await db.query("UPDATE user_role_assignments SET role_code='staff' WHERE profile_id=$1", [contributor.profile]);
    });
    await check('contributor may create internal tasks while legacy edit/delete restrictions and defaults persist', async () => {
      const f = await fixture(), task = randomUUID(), unassigned = randomUUID();
      await contributor.client.query("INSERT INTO project_tasks(id,project_id,title,description,assignee_profile_id) VALUES($1,$2,'Private internal title','Private internal instructions',$3),($4,$2,'Unassigned private task',null,null)", [task, f.project, contributor.profile, unassigned]);
      const stored = await persisted({ id: task });
      assert.equal(stored.task_kind, 'internal');
      assert.equal(stored.client_title, null);
      assert.equal(stored.client_instructions, null);
      await assert.rejects(owner.client.query("UPDATE project_tasks SET task_kind='client',client_title='Implicit conversion' WHERE id=$1", [task]), denied);
      await assert.rejects(admin.client.query("UPDATE project_tasks SET client_instructions='Client field on old internal row' WHERE id=$1", [task]), denied);
      assert.equal((await contributor.client.query("UPDATE project_tasks SET status='in_progress' WHERE id=$1", [task])).rowCount, 1);
      await assert.rejects(contributor.client.query("UPDATE project_tasks SET title='Forbidden edit' WHERE id=$1", [task]), denied);
      assert.equal((await contributor.client.query("UPDATE project_tasks SET status='done' WHERE id=$1", [unassigned])).rowCount, 0);
      assert.equal((await contributor.client.query('DELETE FROM project_tasks WHERE id=$1', [task])).rowCount, 0);
      assert.deepEqual(await list(f.customer, f.project), []);
      assert.deepEqual((await f.customer.client.query('SELECT id FROM project_tasks WHERE project_id=$1', [f.project])).rows, []);
    });
    await check('raw client task mutations deny browser admin and staff while dedicated RPCs succeed', async () => {
      const f = await fixture(), task = await f.publish();
      for (const actor of [admin, owner, contributor]) {
        const before = await persisted(task);
        for (const sql of ["UPDATE project_tasks SET status='done' WHERE id=$1", "UPDATE project_tasks SET client_title='Raw override' WHERE id=$1", "UPDATE project_tasks SET title='Internal bypass' WHERE id=$1", "UPDATE project_tasks SET task_kind='internal' WHERE id=$1", 'DELETE FROM project_tasks WHERE id=$1']) await deniedWrite(actor.client.query(sql, [task.id]));
        await assert.rejects(actor.client.query("INSERT INTO project_tasks(project_id,title,task_kind,client_title) VALUES($1,'Raw client','client','Raw title')", [f.project]), denied);
        assert.deepEqual(await persisted(task), before);
      }
      assert.equal((await manage(contributor, f.project, task, 'withdraw')).publication, 'withdrawn');
    });
    await check('draft, publication, organization intersection and strict safe projections preserve internal privacy', async () => {
      const f = await fixture(), draft = await f.create();
      assert.deepEqual(await list(f.customer, f.project), []);
      const legacy = randomUUID();
      await owner.client.query("INSERT INTO project_tasks(id,project_id,title,description,blocked_reason) VALUES($1,$2,'SECRET_INTERNAL_TITLE','SECRET_INTERNAL_DESCRIPTION','SECRET_BLOCK_REASON')", [legacy, f.project]);
      const published = await manage(owner, f.project, draft, 'publish');
      for (const actor of [f.customer, f.peer, f.both]) {
        const rows = await list(actor, f.project);
        assert.equal(rows.length, 1); safe(rows[0]);
        assert.equal(rows[0].id, published.id);
        for (const secret of ['SECRET_INTERNAL_TITLE', 'SECRET_INTERNAL_DESCRIPTION', 'SECRET_BLOCK_REASON', legacy, owner.profile, f.peer.profile]) assert.equal(JSON.stringify(rows).includes(secret), false, secret);
        assert.deepEqual((await actor.client.query('SELECT id FROM project_tasks WHERE project_id=$1', [f.project])).rows, []);
      }
      assert.deepEqual(await list(f.other, f.project), []);
      assert.deepEqual(await list(unrelated, f.project), []);
      assert.deepEqual(await list(f.customer, randomUUID()), []);
      const before = await persisted(published);
      await assert.rejects(f.customer.client.query("INSERT INTO project_tasks(project_id,title) VALUES($1,'Raw client insert')", [f.project]), denied);
      assert.equal((await f.customer.client.query("UPDATE project_tasks SET status='done' WHERE id=$1", [published.id])).rowCount, 0);
      assert.equal((await f.customer.client.query('DELETE FROM project_tasks WHERE id=$1', [published.id])).rowCount, 0);
      await assert.rejects(act(f.other, f.project, published, 'submit', { response: 'Forbidden' }), denied);
      assert.deepEqual(await persisted(published), before);
      const b = await f.publish({ organizationId: f.otherOrganization });
      assert.deepEqual((await list(f.other, f.project)).map(row => row.id), [b.id]);
      assert.equal((await list(f.both, f.project)).length, 2);
      const failure = promise => promise.then(() => assert.fail('Expected inaccessible action denial'), error => ({ code: error.code, message: error.message }));
      const missing = await failure(act(f.other, f.project, { ...published, id: randomUUID() }, 'start'));
      const inaccessible = await failure(act(f.other, f.project, published, 'start'));
      assert.deepEqual(inaccessible, missing, 'Missing and inaccessible task identifiers share the same denial');
    });
    await check('workflow stores immutable submissions and requires exact current revision and sequence for review', async () => {
      const f = await fixture(), milestone = randomUUID();
      await owner.client.query("INSERT INTO project_milestones(id,project_id,title,visibility,status) VALUES($1,$2,'Approved milestone','client','pending')", [milestone, f.project]);
      const task = await f.publish({ milestoneId: milestone });
      let current = safe((await list(f.customer, f.project))[0]);
      assert.deepEqual(current.milestone, { id: milestone, title: 'Approved milestone' });
      current = safe(await act(f.customer, f.project, current, 'start'));
      assert.equal(current.workflow, 'in_progress');
      current = safe(await act(f.customer, f.project, current, 'submit', { response: 'First immutable response' }));
      assert.equal(current.workflow, 'submitted'); assert.equal(current.submission_sequence, 1);
      assert.notEqual((await persisted(task)).status, 'done');
      const before = await persisted(task);
      await assert.rejects(act(f.customer, f.project, current, 'submit', { response: 'Second without review' }), conflict);
      await assert.rejects(manage(owner, f.project, current, 'accept', { submissionSequence: 2, feedback: '' }), conflict);
      await assert.rejects(manage(owner, f.project, current, 'accept', { submissionSequence: 1, feedback: '' }, randomUUID(), current.revision - 1), conflict);
      await assert.rejects(manage(owner, f.project, current, 'return', { submissionSequence: 1, feedback: ' ' }), invalid);
      assert.deepEqual(await persisted(task), before);
      let staff = await manage(contributor, f.project, current, 'return', { submissionSequence: 1, feedback: 'Please revise section two.' });
      assert.equal(staff.workflow, 'returned');
      current = safe((await list(f.peer, f.project))[0]);
      assert.equal(current.response, 'First immutable response'); assert.equal(current.review_feedback, 'Please revise section two.');
      current = safe(await act(f.peer, f.project, current, 'submit', { response: 'Second immutable response' }));
      assert.equal(current.submission_sequence, 2);
      await assert.rejects(manage(owner, f.project, current, 'accept', { submissionSequence: 1, feedback: '' }), conflict);
      staff = await manage(owner, f.project, current, 'accept', { submissionSequence: 2, feedback: '' });
      assert.equal(staff.workflow, 'accepted');
      assert.equal((await persisted(task)).status, 'done');
      await assert.rejects(act(f.customer, f.project, staff, 'start'), conflict);
      assert.deepEqual((await db.query('SELECT status FROM project_milestones WHERE id=$1', [milestone])).rows, [{ status: 'pending' }]);
      const history = (await workbench(owner, f.project)).tasks.find(row => row.id === task.id).submissions;
      assert.deepEqual(history.map(row => [row.sequence, row.response]).sort((a, b) => a[0] - b[0]), [[1, 'First immutable response'], [2, 'Second immutable response']]);
      assert.equal((await list(f.customer, f.project))[0].response, 'Second immutable response');
    });
    await check('idempotency is actor-scoped, rejects key collisions and reauthorizes retries', async () => {
      const f = await fixture(), createKey = randomUUID();
      const draft = await manage(owner, f.project, null, 'create', f.config(), createKey);
      assert.equal((await manage(owner, f.project, null, 'create', f.config(), createKey)).id, draft.id);
      await assert.rejects(manage(owner, f.project, null, 'create', f.config({ clientTitle: 'Changed' }), createKey), conflict);
      let task = await manage(owner, f.project, draft, 'publish');
      const key = randomUUID(), original = task;
      task = safe(await act(f.customer, f.project, original, 'submit', { response: 'Retry response' }, key));
      assert.deepEqual(await act(f.customer, f.project, original, 'submit', { response: 'Retry response' }, key), task);
      await assert.rejects(act(f.customer, f.project, original, 'submit', { response: 'Collision' }, key), conflict);
      await manage(owner, f.project, task, 'return', { submissionSequence: 1, feedback: 'Try again.' });
      assert.equal((await act(f.customer, f.project, original, 'submit', { response: 'Retry response' }, key)).workflow, 'returned');
      assert.equal((await workbench(owner, f.project)).tasks[0].submissions.length, 1);
      await db.query('DELETE FROM organization_members WHERE organization_id=$1 AND profile_id=$2', [f.organization, f.customer.profile]);
      await assert.rejects(act(f.customer, f.project, original, 'submit', { response: 'Retry response' }, key), denied);
      const anotherDraft = await manage(contributor, f.project, null, 'create', f.config(), createKey);
      assert.notEqual(anotherDraft.id, draft.id);
    });
    await check('withdrawal denies old authorized response retries and rollback leaves no submission', async () => {
      const f = await fixture(), task = await f.publish(), key = randomUUID();
      const before = await persisted(task);
      await f.customer.client.query('BEGIN');
      try {
        assert.equal((await act(f.customer, f.project, task, 'submit', { response: 'Rolled back response' }, key)).workflow, 'submitted');
      } finally { await f.customer.client.query('ROLLBACK'); }
      assert.deepEqual(await persisted(task), before);
      assert.deepEqual((await workbench(owner, f.project)).tasks[0].submissions, []);
      const submitted = await act(f.customer, f.project, task, 'submit', { response: 'Committed response' }, key);
      await manage(owner, f.project, submitted, 'withdraw');
      await assert.rejects(act(f.customer, f.project, task, 'submit', { response: 'Committed response' }, key), denied);
      assert.deepEqual(await list(f.customer, f.project), []);
    });
    await check('strict mutation payloads and stale requests fail atomically', async () => {
      const f = await fixture(), task = await f.publish();
      const before = await persisted(task);
      for (const input of [{ response: 'ok', actorProfileId: admin.profile }, { response: 'ok', status: 'done' }, { response: 'ok', client_publication: 'published' }]) await assert.rejects(act(f.customer, f.project, task, 'submit', input), invalid);
      for (const input of [{}, { response: '' }, { response: 'x'.repeat(20_001) }]) await assert.rejects(act(f.customer, f.project, task, 'submit', input), invalid);
      await assert.rejects(act(f.customer, f.project, task, 'accept', { submissionSequence: 1, feedback: '' }), invalid);
      await assert.rejects(manage(owner, f.project, task, 'configure', { ...f.config(), projectId: randomUUID() }), invalid);
      await assert.rejects(manage(owner, f.project, task, 'configure', { ...f.config(), title: 'Internal override' }), invalid);
      await assert.rejects(manage(owner, f.project, task, 'withdraw', {}, randomUUID(), task.revision - 1), conflict);
      assert.deepEqual(await persisted(task), before);
      assert.equal((await act(f.customer, f.project, task, 'submit', { response: 'Valid positive control' })).workflow, 'submitted');
    });
    await check('selected audience and responsibility are independent and new eligible members join only all mode', async () => {
      const f = await fixture();
      await assert.rejects(f.create({ audienceMode: 'selected', selectedProfileIds: [f.customer.profile], responsibleProfileId: f.peer.profile }), invalid);
      let task = await f.publish({ audienceMode: 'selected', selectedProfileIds: [f.customer.profile], responsibleProfileId: f.customer.profile });
      assert.equal((await list(f.customer, f.project)).length, 1);
      assert.deepEqual(await list(f.peer, f.project), []);
      const newcomer = await identity('client', [f.organization]);
      assert.deepEqual(await list(newcomer, f.project), []);
      task = await manage(owner, f.project, task, 'configure', f.config({ responsibleProfileId: f.customer.profile }));
      assert.equal(task.publication, 'withdrawn');
      task = await manage(owner, f.project, task, 'publish');
      assert.equal((await list(newcomer, f.project)).length, 1);
      await db.query('DELETE FROM organization_members WHERE organization_id=$1 AND profile_id=$2', [f.organization, f.customer.profile]);
      const row = safe((await list(f.peer, f.project))[0]);
      assert.equal(row.responsible_label, null);
      assert.deepEqual(await list(f.customer, f.project), []);
    });
    await check('new publication resets response and feedback while preserving private staff history', async () => {
      const f = await fixture();
      let task = await f.publish({ audienceMode: 'selected', selectedProfileIds: [f.customer.profile] });
      const publishedGeneration = task.publication_generation;
      task = await act(f.customer, f.project, task, 'submit', { response: 'FORMER_AUDIENCE_RESPONSE' });
      task = await manage(owner, f.project, task, 'return', { submissionSequence: 1, feedback: 'FORMER_AUDIENCE_FEEDBACK' });
      task = await manage(owner, f.project, task, 'configure', f.config({ audienceMode: 'selected', selectedProfileIds: [f.peer.profile], clientInstructions: 'New audience instructions' }));
      assert.equal(task.publication, 'withdrawn');
      assert.deepEqual(await list(f.customer, f.project), []);
      task = await manage(owner, f.project, task, 'publish');
      assert(task.publication_generation > publishedGeneration);
      const row = safe((await list(f.peer, f.project))[0]);
      assert.equal(row.workflow, 'open'); assert.equal(row.response, null); assert.equal(row.review_feedback, null); assert.equal(row.submission_sequence, null);
      assert.equal(JSON.stringify(row).includes('FORMER_AUDIENCE'), false);
      assert.equal((await workbench(owner, f.project)).tasks[0].submissions[0].response, 'FORMER_AUDIENCE_RESPONSE');
      await assert.rejects(act(f.customer, f.project, task, 'start'), denied);
    });

    // Reinsert the exact source row after each revocation. The task selection must
    // remain gone: a fresh session is deliberately not created for these checks.
    for (const source of ['membership delete', 'membership profile update', 'membership organization update', 'role update', 'role delete', 'project grant delete', 'project grant update', 'project organization delete', 'participant delete', 'profile login unlink']) {
      await check(`selected task grants remain revoked after ${source} and source restoration`, async () => {
        const f = await fixture();
        if (source === 'participant delete') await admin.client.query('UPDATE projects SET organization_id=$1 WHERE id=$2', [f.otherOrganization, f.project]);
        if (source.startsWith('project grant')) await f.access('selected_clients', [f.organization, f.otherOrganization], [{ organization_id: f.organization, profile_id: f.customer.profile }, { organization_id: f.organization, profile_id: f.peer.profile }, { organization_id: f.otherOrganization, profile_id: f.other.profile }]);
        const task = await f.publish({ audienceMode: 'selected', selectedProfileIds: [f.customer.profile], responsibleProfileId: f.customer.profile });
        assert.equal((await list(f.customer, f.project)).length, 1);
        const spare = await identity('client');
        let restore;
        if (source.startsWith('membership')) {
          const row = (await db.query('SELECT * FROM organization_members WHERE organization_id=$1 AND profile_id=$2', [f.organization, f.customer.profile])).rows[0];
          if (source === 'membership delete') await db.query('DELETE FROM organization_members WHERE id=$1', [row.id]);
          else if (source === 'membership profile update') await db.query('UPDATE organization_members SET profile_id=$1 WHERE id=$2', [spare.profile, row.id]);
          else await db.query('UPDATE organization_members SET organization_id=$1 WHERE id=$2', [f.otherOrganization, row.id]);
          restore = async () => {
            await db.query('DELETE FROM organization_members WHERE id=$1', [row.id]);
            await db.query('INSERT INTO organization_members(id,organization_id,profile_id,role) VALUES($1,$2,$3,$4)', [row.id, f.organization, f.customer.profile, row.role]);
          };
        } else if (source.startsWith('role')) {
          if (source === 'role update') await db.query("UPDATE user_role_assignments SET role_code='staff' WHERE profile_id=$1", [f.customer.profile]);
          else await db.query('DELETE FROM user_role_assignments WHERE profile_id=$1', [f.customer.profile]);
          restore = () => db.query("INSERT INTO user_role_assignments(profile_id,role_code) VALUES($1,'client') ON CONFLICT(profile_id) DO UPDATE SET role_code='client'", [f.customer.profile]);
        } else if (source.startsWith('project grant')) {
          if (source === 'project grant delete') await db.query('DELETE FROM project_client_profiles WHERE project_id=$1 AND profile_id=$2', [f.project, f.customer.profile]);
          else await db.query('UPDATE project_client_profiles SET profile_id=$1 WHERE project_id=$2 AND profile_id=$3', [f.both.profile, f.project, f.customer.profile]);
          restore = async () => {
            await db.query('DELETE FROM project_client_profiles WHERE project_id=$1 AND profile_id=$2', [f.project, f.both.profile]);
            await db.query('INSERT INTO project_client_profiles(project_id,organization_id,profile_id) VALUES($1,$2,$3)', [f.project, f.organization, f.customer.profile]);
          };
        } else if (source === 'project organization delete' || source === 'participant delete') {
          const table = source === 'participant delete' ? 'project_organizations' : 'project_client_organizations';
          await db.query(`DELETE FROM public.${table} WHERE project_id=$1 AND organization_id=$2`, [f.project, f.organization]);
          restore = async () => {
            if (source === 'participant delete') await db.query('INSERT INTO project_organizations(project_id,organization_id,is_primary) VALUES($1,$2,false)', [f.project, f.organization]);
            await db.query('INSERT INTO project_client_organizations(project_id,organization_id) VALUES($1,$2)', [f.project, f.organization]);
            await db.query('INSERT INTO project_client_profiles(project_id,organization_id,profile_id) VALUES($1,$2,$3)', [f.project, f.organization, f.customer.profile]);
          };
        } else {
          // The repaired profile identity contract only allows Auth-sourced link
          // changes. Deleting the synthetic Auth identity exercises that cascade.
          await db.query('DELETE FROM auth.users WHERE id=$1', [f.customer.user]);
          restore = async () => {
            await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())', [f.customer.user, `${f.customer.user}@example.invalid`]);
          };
        }
        assert.deepEqual(await list(f.customer, f.project), []);
        await assert.rejects(act(f.customer, f.project, task, 'start'), denied);
        await restore();
        assert.deepEqual(await list(f.customer, f.project), []);
        const state = (await workbench(owner, f.project)).tasks.find(row => row.id === task.id);
        assert.deepEqual(state.selected_profile_ids, []); assert.equal(state.responsible_profile_id, null);
        // Reauthorizing the selection is the positive reverse-state control.
        if (source !== 'profile login unlink') {
          const fresh = await manage(owner, f.project, state, 'configure', f.config({ audienceMode: 'selected', selectedProfileIds: [f.customer.profile] }));
          await manage(owner, f.project, fresh, 'publish');
          assert.equal((await list(f.customer, f.project)).length, 1);
        }
      });
    }
    await check('unchanged audience saves preserve selected task grants and mode transitions remove only lost eligibility', async () => {
      const f = await fixture();
      const grants = [{ organization_id: f.organization, profile_id: f.customer.profile }, { organization_id: f.otherOrganization, profile_id: f.other.profile }];
      await f.access('selected_clients', [f.organization, f.otherOrganization], grants);
      const task = await f.publish({ audienceMode: 'selected', selectedProfileIds: [f.customer.profile] });
      await f.access('selected_clients', [f.otherOrganization, f.organization], grants);
      assert.equal((await list(f.customer, f.project))[0].id, task.id);
      await f.access('all_org_clients');
      assert.equal((await list(f.customer, f.project))[0].id, task.id);
      await f.access('selected_clients', [f.organization, f.otherOrganization], grants);
      assert.equal((await list(f.customer, f.project))[0].id, task.id);
      await f.access('selected_clients', [f.organization, f.otherOrganization], [{ organization_id: f.organization, profile_id: f.peer.profile }, grants[1]]);
      assert.deepEqual(await list(f.customer, f.project), []);
      await f.access('all_org_clients');
      assert.deepEqual(await list(f.customer, f.project), []);
      assert.deepEqual((await workbench(owner, f.project)).tasks[0].selected_profile_ids, []);
    });
    await check('profile deletion clears selections and responsibility while preserving anonymous staff submission history', async () => {
      const f = await fixture();
      let task = await f.publish({ audienceMode: 'selected', selectedProfileIds: [f.customer.profile], responsibleProfileId: f.customer.profile });
      task = await act(f.customer, f.project, task, 'submit', { response: 'Retained synthetic historical response' });
      await db.query('DELETE FROM profiles WHERE id=$1', [f.customer.profile]);
      assert.deepEqual(await list(f.customer, f.project), []);
      await assert.rejects(act(f.customer, f.project, task, 'start'), denied);
      const staff = (await workbench(owner, f.project)).tasks[0];
      assert.deepEqual(staff.selected_profile_ids, []); assert.equal(staff.responsible_profile_id, null);
      assert.equal(staff.submissions[0].response, 'Retained synthetic historical response');
      assert.equal(staff.submissions[0].submitted_by_profile_id, null);
      assert.equal((await persisted(task)).project_id, f.project);
    });
    await check('task organization eligibility cannot be borrowed from a different organization on the same project', async () => {
      const f = await fixture();
      await f.access('selected_clients', [f.organization, f.otherOrganization], [{ organization_id: f.organization, profile_id: f.customer.profile }, { organization_id: f.otherOrganization, profile_id: f.both.profile }]);
      const task = await f.publish();
      assert.equal((await list(f.customer, f.project)).length, 1);
      assert.equal((await f.both.client.query('SELECT project_id FROM get_current_client_project($1)', [f.project])).rows.length, 1);
      assert.deepEqual(await list(f.both, f.project), []);
      await assert.rejects(act(f.both, f.project, task, 'submit', { response: 'Cross-organization bypass' }), denied);
    });
    await check('private milestone blocks publication and hiding or deletion withdraws linked work atomically', async () => {
      const f = await fixture(), milestone = randomUUID();
      await owner.client.query("INSERT INTO project_milestones(id,project_id,title,visibility) VALUES($1,$2,'Private parent','staff')", [milestone, f.project]);
      let task = await f.create({ milestoneId: milestone });
      await assert.rejects(manage(owner, f.project, task, 'publish'), invalid);
      await owner.client.query("UPDATE project_milestones SET visibility='client' WHERE id=$1", [milestone]);
      task = await manage(owner, f.project, task, 'publish');
      task = await act(f.customer, f.project, task, 'submit', { response: 'Submission before hide' });
      await owner.client.query("UPDATE project_milestones SET visibility='staff' WHERE id=$1", [milestone]);
      assert.deepEqual(await list(f.customer, f.project), []);
      assert.equal((await persisted(task)).client_publication, 'withdrawn');
      await assert.rejects(manage(owner, f.project, task, 'accept', { submissionSequence: 1, feedback: '' }), conflict);
      await owner.client.query("UPDATE project_milestones SET visibility='client' WHERE id=$1", [milestone]);
      task = (await workbench(owner, f.project)).tasks.find(row => row.id === task.id);
      task = await manage(owner, f.project, task, 'publish');
      assert.equal((await list(f.customer, f.project)).length, 1);
      await owner.client.query('DELETE FROM project_milestones WHERE id=$1', [milestone]);
      const stored = await persisted(task);
      assert.equal(stored.project_id, f.project); assert.equal(stored.milestone_id, null); assert.equal(stored.client_publication, 'withdrawn');
      assert.deepEqual(await list(f.customer, f.project), []);
      assert.equal((await db.query('SELECT count(*)::int n FROM projects WHERE id=$1', [f.project])).rows[0].n, 1);
      await admin.client.query('DELETE FROM projects WHERE id=$1', [f.project]);
      assert.equal(await persisted(task), undefined);
    });

    // Yielding between catalog observations is only polling. Each race starts
    // its second operation after the first has deterministically acquired locks.
    async function waitForLock(blocked, blocker) {
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const row = (await db.query(`SELECT $1::int=ANY(pg_blocking_pids($2::int)) AND EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$2 AND wait_event_type='Lock') AND EXISTS(SELECT 1 FROM pg_locks WHERE pid=$2 AND NOT granted) AS blocked`, [blocker, blocked])).rows[0];
        if (row.blocked) return;
        await pollInterval(10);
      }
      throw new Error('Expected client-task lock barrier was not observed');
    }
    for (const first of ['submit', 'membership removal']) {
      await check(`concurrent ${first} first serializes membership revocation against submission`, async () => {
        const f = await fixture(), task = await f.publish({ audienceMode: 'selected', selectedProfileIds: [f.customer.profile] });
        const actor = { ...f.customer, client: await session(f.customer.user) }, revoker = await connect();
        const actorPid = (await actor.client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid, revokerPid = (await revoker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        let pending;
        await actor.client.query('BEGIN'); await revoker.query('BEGIN');
        const remove = () => revoker.query('DELETE FROM organization_members WHERE organization_id=$1 AND profile_id=$2', [f.organization, f.customer.profile]);
        const submit = () => act(actor, f.project, task, 'submit', { response: 'Concurrent synthetic response' });
        try {
          if (first === 'submit') {
            await submit();
            pending = remove().then(value => ({ value }), error => ({ error }));
            await waitForLock(revokerPid, actorPid);
            await actor.client.query('COMMIT');
            assert.equal((await pending).error, undefined);
            await revoker.query('COMMIT');
            assert.equal((await persisted(task)).client_workflow, 'submitted');
          } else {
            await remove();
            pending = submit().then(value => ({ value }), error => ({ error }));
            await waitForLock(actorPid, revokerPid);
            await revoker.query('COMMIT');
            assert(denied((await pending).error));
            await actor.client.query('ROLLBACK');
            assert.equal((await persisted(task)).client_workflow, 'open');
          }
          assert.deepEqual(await list(f.customer, f.project), []);
        } finally {
          await Promise.allSettled([actor.client.query('ROLLBACK'), revoker.query('ROLLBACK')]);
          if (pending) await pending;
        }
      });
    }
    for (const first of ['review', 'withdraw']) {
      await check(`concurrent ${first} first permits one exact-revision review or withdrawal`, async () => {
        const f = await fixture();
        let task = await f.publish();
        task = await act(f.customer, f.project, task, 'submit', { response: 'Concurrent review response' });
        const a = { ...owner, client: await session(owner.user) }, b = { ...contributor, client: await session(contributor.user) };
        const aPid = (await a.client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid, bPid = (await b.client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await a.client.query('BEGIN'); await b.client.query('BEGIN');
        let pending;
        const review = actor => manage(actor, f.project, task, 'accept', { submissionSequence: task.submission_sequence, feedback: '' });
        const withdraw = actor => manage(actor, f.project, task, 'withdraw');
        try {
          await (first === 'review' ? review(a) : withdraw(a));
          pending = (first === 'review' ? withdraw(b) : review(b)).then(value => ({ value }), error => ({ error }));
          await waitForLock(bPid, aPid);
          await a.client.query('COMMIT');
          assert(conflict((await pending).error));
          await b.client.query('ROLLBACK');
          const stored = await persisted(task);
          assert.equal(stored.client_publication, first === 'review' ? 'published' : 'withdrawn');
          if (first === 'review') assert.equal(stored.client_workflow, 'accepted');
          else {
            assert.notEqual(stored.status, 'done');
            assert(stored.client_generation > task.publication_generation);
          }
        } finally {
          await Promise.allSettled([a.client.query('ROLLBACK'), b.client.query('ROLLBACK')]);
          if (pending) await pending;
        }
      });
    }
    for (const first of ['submit', 'withdraw']) {
      await check(`concurrent ${first} first serializes withdrawal against client submission`, async () => {
        const f = await fixture(), task = await f.publish();
        const customer = { ...f.customer, client: await session(f.customer.user) }, staff = { ...owner, client: await session(owner.user) };
        const customerPid = (await customer.client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid, staffPid = (await staff.client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await customer.client.query('BEGIN'); await staff.client.query('BEGIN');
        const submit = () => act(customer, f.project, task, 'submit', { response: 'Racing withdrawal' });
        const withdraw = () => manage(staff, f.project, task, 'withdraw');
        let pending;
        try {
          await (first === 'submit' ? submit() : withdraw());
          pending = (first === 'submit' ? withdraw() : submit()).then(value => ({ value }), error => ({ error }));
          await waitForLock(first === 'submit' ? staffPid : customerPid, first === 'submit' ? customerPid : staffPid);
          await (first === 'submit' ? customer.client : staff.client).query('COMMIT');
          const outcome = await pending;
          assert(outcome.error && (first === 'submit' ? conflict(outcome.error) : denied(outcome.error)));
          await (first === 'submit' ? staff.client : customer.client).query('ROLLBACK');
          const stored = await persisted(task);
          assert.equal(stored.client_publication, first === 'submit' ? 'published' : 'withdrawn');
          assert.equal((await workbench(owner, f.project)).tasks[0].submissions.length, first === 'submit' ? 1 : 0);
        } finally {
          await Promise.allSettled([customer.client.query('ROLLBACK'), staff.client.query('ROLLBACK')]);
          if (pending) await pending;
        }
      });
    }
    for (const first of ['publish', 'profile deletion']) {
      await check(`concurrent ${first} first avoids task/profile lock inversion for a former staff reporter`, async () => {
        const f = await fixture(), reporter = await identity('staff');
        await admin.client.query("INSERT INTO project_members(project_id,profile_id,role) VALUES($1,$2,'contributor')", [f.project, reporter.profile]);
        let task = await f.create({}, reporter);
        await db.query('DELETE FROM project_members WHERE project_id=$1 AND profile_id=$2', [f.project, reporter.profile]);
        await db.query("UPDATE user_role_assignments SET role_code='client' WHERE profile_id=$1", [reporter.profile]);
        await db.query("INSERT INTO organization_members(organization_id,profile_id,role) VALUES($1,$2,'member')", [f.organization, reporter.profile]);
        task = await manage(admin, f.project, task, 'configure', f.config({ audienceMode: 'selected', selectedProfileIds: [reporter.profile], responsibleProfileId: reporter.profile }));
        const publisher = { ...admin, client: await session(admin.user) }, remover = await connect();
        const publisherPid = (await publisher.client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid, removerPid = (await remover.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await publisher.client.query('BEGIN'); await remover.query('BEGIN');
        const publish = () => manage(publisher, f.project, task, 'publish');
        const remove = () => remover.query('DELETE FROM profiles WHERE id=$1', [reporter.profile]);
        let pending;
        try {
          if (first === 'publish') {
            await publish();
            pending = remove().then(value => ({ value }), error => ({ error }));
            await waitForLock(removerPid, publisherPid);
            await publisher.client.query('COMMIT');
            assert.equal((await pending).error, undefined);
            await remover.query('COMMIT');
          } else {
            // Hold only the source profile first. Publication must wait here
            // before taking the task lock needed by profile FK cleanup.
            await remover.query('SELECT id FROM profiles WHERE id=$1 FOR UPDATE', [reporter.profile]);
            pending = publish().then(value => ({ value }), error => ({ error }));
            await waitForLock(publisherPid, removerPid);
            assert.equal((await remove()).rowCount, 1, 'Profile deletion must progress while publication waits on eligibility');
            await remover.query('COMMIT');
            const outcome = await pending;
            assert(outcome.error && ['22023', '42501', '40001'].includes(outcome.error.code), outcome.error?.message);
            await publisher.client.query('ROLLBACK');
          }
          assert.equal((await db.query('SELECT count(*)::int n FROM profiles WHERE id=$1', [reporter.profile])).rows[0].n, 0);
          const stored = await persisted(task);
          assert.equal(stored.reporter_profile_id, null);
          assert.equal(stored.project_id, f.project);
          assert.deepEqual((await workbench(owner, f.project)).tasks[0].selected_profile_ids, []);
        } finally {
          await Promise.allSettled([publisher.client.query('ROLLBACK'), remover.query('ROLLBACK')]);
          if (pending) await pending;
        }
      });
    }
  } finally { await Promise.allSettled([...ownedConnections].map(client => client.end())); }
}
