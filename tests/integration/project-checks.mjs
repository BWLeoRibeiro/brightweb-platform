import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

// Real role/JWT sessions exercise the shipped SQL, rather than recognizing SQL text.
export async function checkProjects({ db, connect, check, root }) {
  const folder = path.join(root, 'packages/create-bw-app/template/supabase/modules/projects/migrations');
  const files = (await readdir(folder)).filter(file => file.endsWith('.sql')).sort();
  const apply = async file => {
    try { await db.query(await readFile(path.join(folder, file), 'utf8')); }
    catch (error) { throw new Error(`Projects migration ${file}: ${error.message}`, { cause: error }); }
  };
  await apply(files[0]);
  const organization = randomUUID(), otherOrganization = randomUUID(), legacyProject = randomUUID();
  await db.query("INSERT INTO organizations(id,name) VALUES($1,'Upgrade fixture'),($2,'Other tenant')", [organization, otherOrganization]);
  await db.query("INSERT INTO projects(id,organization_id,name,summary) VALUES($1,$2,'Existing project','Preserve customer data')", [legacyProject, organization]);
  for (const file of files.slice(1)) await apply(file);
  await check('Projects migration history preserves existing project identity and customer fields', async () => {
    assert.deepEqual((await db.query('SELECT id,organization_id,name,summary FROM projects WHERE id=$1', [legacyProject])).rows, [{ id: legacyProject, organization_id: organization, name: 'Existing project', summary: 'Preserve customer data' }]);
    assert.equal((await db.query('SELECT organization_id FROM project_organizations WHERE project_id=$1 AND is_primary', [legacyProject])).rows[0].organization_id, organization);
  });
  async function identity(role, org) {
    const user = randomUUID();
    await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())', [user, `${user}@example.invalid`]);
    const profile = (await db.query('SELECT id FROM profiles WHERE user_id=$1', [user])).rows[0].id;
    await db.query('INSERT INTO user_role_assignments(profile_id,role_code) VALUES($1,$2) ON CONFLICT(profile_id) DO UPDATE SET role_code=excluded.role_code', [profile, role]);
    if (org) await db.query("INSERT INTO organization_members(organization_id,profile_id,role) VALUES($1,$2,'member')", [org, profile]);
    const client = await connect('authenticated');
    await client.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false),set_config('request.jwt.claims',$2,false)", [user, JSON.stringify({ sub: user, role: 'authenticated' })]);
    return { profile, client };
  }
  const admin = await identity('admin'), staff = await identity('staff'), unrelatedStaff = await identity('staff');
  const customer = await identity('client', organization), outsider = await identity('client', otherOrganization);
  const payload = { name: 'Permission fixture', primary_organization_id: organization };
  const create = (client, request = randomUUID(), project = payload) => client.query('SELECT * FROM create_project_with_client_access($1,$2,$3,$4,$5)', [request, project, [organization], JSON.stringify([{ profile_id: staff.profile, role: 'owner' }]), JSON.stringify({ mode: 'all_org_clients', organization_ids: [organization] })]);
  let project;
  await check('administrator project creation commits and retries exactly once', async () => {
    const request = randomUUID();
    project = (await create(admin.client, request)).rows[0].project_id;
    assert.deepEqual((await create(admin.client, request)).rows, [{ project_id: project, created: false }]);
    await assert.rejects(create(admin.client, request, { ...payload, name: 'Changed request' }), error => error.code === '22023');
    assert.equal((await db.query('SELECT count(*)::int n FROM projects WHERE id=$1', [project])).rows[0].n, 1);
  });
  for (const [label, client] of [['staff', staff.client], ['client', customer.client], ['anonymous', await connect('anon')]]) {
    await check(`project creation denies ${label} without partial writes`, async () => {
      const before = (await db.query('SELECT count(*)::int n FROM projects')).rows[0].n;
      await assert.rejects(create(client), error => error.code === '42501');
      assert.equal((await db.query('SELECT count(*)::int n FROM projects')).rows[0].n, before);
    });
  }
  await check('client project listing and detail isolate organization audiences', async () => {
    assert.deepEqual((await customer.client.query('SELECT project_id FROM list_current_client_projects()')).rows, [{ project_id: project }]);
    assert.equal((await customer.client.query('SELECT project_id FROM get_current_client_project($1)', [project])).rows[0].project_id, project);
    assert.deepEqual((await outsider.client.query('SELECT project_id FROM list_current_client_projects()')).rows, []);
    assert.deepEqual((await outsider.client.query('SELECT project_id FROM get_current_client_project($1)', [project])).rows, []);
    await assert.rejects(outsider.client.query('SELECT set_project_client_access($1,$2,$3,$4)', [project, 'all_org_clients', [otherOrganization], '[]']), error => error.code === '42501');
  });
  await check('project table RLS hides internal rows from customers and unrelated staff', async () => {
    assert.equal((await admin.client.query('SELECT id FROM projects WHERE id=$1', [project])).rows[0].id, project);
    for (const client of [customer.client, outsider.client, unrelatedStaff.client]) {
      assert.deepEqual((await client.query('SELECT id FROM projects WHERE id=$1', [project])).rows, []);
      assert.equal((await client.query("UPDATE projects SET name='Unauthorized' WHERE id=$1", [project])).rowCount, 0);
    }
    assert.equal((await db.query('SELECT name FROM projects WHERE id=$1', [project])).rows[0].name, payload.name);
  });
  await check('assigned staff may advance task state but cannot edit task identity or other assignments', async () => {
    await admin.client.query('SELECT sync_project_members_exact($1,$2,$3)', [project, JSON.stringify([{ profile_id: staff.profile, role: 'contributor' }]), null]);
    const task = randomUUID(), unassigned = randomUUID();
    await admin.client.query("INSERT INTO project_tasks(id,project_id,title,assignee_profile_id) VALUES($1,$2,'Assigned task',$3),($4,$2,'Other task',null)", [task, project, staff.profile, unassigned]);
    assert.equal((await staff.client.query("UPDATE project_tasks SET status='in_progress' WHERE id=$1 RETURNING status", [task])).rows[0].status, 'in_progress');
    await assert.rejects(staff.client.query("UPDATE project_tasks SET title='Changed' WHERE id=$1", [task]), error => error.code === '42501');
    assert.equal((await staff.client.query("UPDATE project_tasks SET status='done' WHERE id=$1", [unassigned])).rowCount, 0);
    assert.deepEqual((await db.query('SELECT title,status FROM project_tasks WHERE id=$1', [task])).rows, [{ title: 'Assigned task', status: 'in_progress' }]);
  });
  await check('revoking project audience takes effect for an existing client session', async () => {
    await admin.client.query('SELECT set_project_client_access($1,$2,$3,$4)', [project, 'hidden', [], '[]']);
    assert.deepEqual((await customer.client.query('SELECT project_id FROM list_current_client_projects()')).rows, []);
    await admin.client.query('SELECT set_project_client_access($1,$2,$3,$4)', [project, 'all_org_clients', [organization], '[]']);
    assert.equal((await customer.client.query('SELECT project_id FROM list_current_client_projects()')).rows[0].project_id, project);
  });
}
