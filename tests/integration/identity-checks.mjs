import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

async function browserFor(connect, userId) {
  const browser = await connect('authenticated');
  await browser.query("SELECT set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claim.role','authenticated',false)", [userId]);
  return browser;
}

export async function checkProfileIdentity({db,service,connect,check,identity}) {
  await check('first-admin setup requires confirmed identity and serializes concurrent setup', async () => {
    const unconfirmed = await identity();
    await db.query('UPDATE auth.users SET email_confirmed_at=null WHERE id=$1', [unconfirmed.userId]);
    await assert.rejects(service.query('SELECT * FROM public.bootstrap_first_admin($1,$2)', [unconfirmed.userId, unconfirmed.email]), error => error.code === '22023');
    assert.equal((await db.query("SELECT count(*)::int n FROM user_role_assignments WHERE role_code='admin'")).rows[0].n, 0);
    await db.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1', [unconfirmed.userId]);
    const other = await identity(), first = await connect('service_role'), second = await connect('service_role');
    await first.query('BEGIN');
    await first.query('SELECT * FROM public.bootstrap_first_admin($1,$2)', [unconfirmed.userId, unconfirmed.email]);
    const pending = second.query('SELECT * FROM public.bootstrap_first_admin($1,$2)', [other.userId, other.email]).then(() => null, error => error);
    for (let attempt = 0; ; attempt++) {
      const result = await db.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [second.processID]);
      if (result.rows[0]?.wait_event_type === 'Lock') break;
      assert(attempt < 1000, 'second bootstrap reaches its advisory lock wait');
    }
    await first.query('COMMIT');
    assert.equal((await pending).code, '42501');
    assert.equal((await db.query("SELECT count(*)::int n FROM user_role_assignments WHERE role_code='admin'")).rows[0].n, 1);
    await assert.rejects(service.query('SELECT * FROM public.bootstrap_first_admin($1,$2)', [unconfirmed.userId, unconfirmed.email]), error => error.code === '42501');
    await db.query("UPDATE user_role_assignments SET role_code='client' WHERE profile_id=$1", [unconfirmed.profileId]);
  });
  await check('first-admin setup rejects an ambiguous normalized Auth email', async () => {
    const f = await identity();
    await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())', [randomUUID(), ` ${f.email.toUpperCase()} `]);
    await assert.rejects(service.query('SELECT * FROM public.bootstrap_first_admin($1,$2)', [f.userId, f.email]), error => error.code === '21000');
    assert.equal((await db.query("SELECT count(*)::int n FROM user_role_assignments WHERE role_code='admin'")).rows[0].n, 0);
  });
  await check('first-admin bootstrap locks Auth before profile and denies stale identity',async()=>{
    const f=await identity(),writer=await connect(),caller=await connect('service_role');
    await writer.query('BEGIN');
    await writer.query('UPDATE auth.users SET email=$2 WHERE id=$1',[f.userId,`${f.userId}-new@example.invalid`]);
    const pending=caller.query('SELECT public.bootstrap_first_admin($1,$2)',[f.userId,f.email]).then(()=>null,error=>error);
    for(let i=0;i<1000;i++) {
      const {rows}=await db.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[caller.processID]);
      if(rows[0]?.wait_event_type==='Lock')break;
      if(i===999)assert.fail('bootstrap must wait for Auth');
    }
    await writer.query('COMMIT');
    assert.equal((await pending).code,'22023');
    assert.equal((await db.query('SELECT email FROM profiles WHERE id=$1',[f.profileId])).rows[0].email,`${f.userId}-new@example.invalid`);
    await service.query('SELECT public.bootstrap_first_admin($1,$2)',[f.userId,`${f.userId}-new@example.invalid`]);
    assert.equal((await db.query('SELECT role_code FROM user_role_assignments WHERE profile_id=$1',[f.profileId])).rows[0].role_code,'admin');
    await db.query("UPDATE user_role_assignments SET role_code='client' WHERE profile_id=$1",[f.profileId]);
    const missing=await identity();
    await db.query('DELETE FROM profiles WHERE id=$1',[missing.profileId]);
    const created=(await service.query('SELECT * FROM public.bootstrap_first_admin($1,$2)',[missing.userId,missing.email])).rows[0];
    assert.equal((await db.query('SELECT user_id FROM profiles WHERE id=$1',[created.profile_id])).rows[0].user_id,missing.userId);
    await assert.rejects(service.query('SELECT * FROM public.bootstrap_first_admin($1,$2)',[missing.userId,missing.email]),e=>e.code==='42501');
    await db.query("UPDATE user_role_assignments SET role_code='client' WHERE profile_id=$1",[created.profile_id]);

  });
  for (const role of ['client', 'unassigned', 'staff', 'admin']) await check(`browser ${role} profile identity denial and valid account writes`, async () => {
    const f = await identity(), other = await identity();
    if (role === 'unassigned') await db.query('DELETE FROM user_role_assignments WHERE profile_id=$1',[f.profileId]);
    else await db.query('UPDATE user_role_assignments SET role_code=$2 WHERE profile_id=$1',[f.profileId,role]);
    const browser = await browserFor(connect,f.userId);
    const before=(await db.query('SELECT * FROM profiles WHERE id=$1',[f.profileId])).rows[0];
    for (const [column,value] of [['email',other.email],['user_id',other.userId],['created_at','2000-01-01']]) {
      await assert.rejects(browser.query(`UPDATE profiles SET ${column}=$2 WHERE id=$1`,[f.profileId,value]),e=>e.code==='42501');
    }
    for (const [userId,email,createdAt] of [[f.userId,other.email,null],[other.userId,other.email,null],[f.userId,f.email,'2000-01-01']]) {
      await assert.rejects(browser.query('INSERT INTO profiles(user_id,email,created_at) VALUES($1,$2,coalesce($3::timestamptz,now())) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,created_at=excluded.created_at', [userId,email,createdAt]),e=>e.code==='42501');
    }
    await browser.query("INSERT INTO profiles(user_id,email,first_name) VALUES($1,$2,'Edited') ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,first_name=excluded.first_name,created_at=excluded.created_at",[f.userId,f.email]);
    await browser.query("INSERT INTO user_preferences(profile_id,preferred_language) VALUES($1,'en') ON CONFLICT(profile_id) DO UPDATE SET preferred_language=excluded.preferred_language",[f.profileId]);
    let after=(await db.query('SELECT * FROM profiles WHERE id=$1',[f.profileId])).rows[0];
    assert.equal(after.first_name,'Edited');
    assert.equal(after.email,before.email);
    assert.equal(after.user_id,before.user_id);
    assert.deepEqual(after.created_at,before.created_at);
    // Auth operates as its own privileged DB role while the original browser
    // claims remain present. This used to hit the staff-only profile guard.
    await browser.query('RESET ROLE');
    await browser.query("UPDATE auth.users SET email=$2,raw_user_meta_data='{\"last_name\":\"Synced\"}' WHERE id=$1",[f.userId,`${f.userId}-changed@example.invalid`]);
    await browser.query('SET ROLE authenticated');
    after=(await db.query('SELECT * FROM profiles WHERE id=$1',[f.profileId])).rows[0];
    assert.equal(after.email,`${f.userId}-changed@example.invalid`);
    assert.equal(after.last_name,'Synced');
    await assert.rejects(browser.query('INSERT INTO profiles(user_id,email) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email',[f.userId,f.email]),e=>e.code==='42501');
  });
  await check('browser missing-profile creation derives Auth identity and database timestamp',async()=>{
    const f=await identity(), browser=await browserFor(connect,f.userId);
    await db.query('DELETE FROM profiles WHERE id=$1',[f.profileId]);
    await assert.rejects(browser.query('INSERT INTO profiles(user_id,email,created_at) VALUES($1,$2,\'2000-01-01\')',[f.userId,f.email]),e=>e.code==='42501');
    await browser.query('INSERT INTO profiles(user_id,email,first_name) VALUES($1,$2,\'Signup\')',[f.userId,` ${f.email.toUpperCase()} `]);
    assert.equal((await db.query('SELECT email FROM profiles WHERE user_id=$1',[f.userId])).rows[0].email,f.email);
  });
  for (const authFirst of [true,false]) await check(`account upsert and Auth email change serialize with ${authFirst?'Auth':'upsert'} first`,async()=>{
    const f=await identity(),browser=await browserFor(connect,f.userId),writer=await connect();
    const next=`${f.userId}-new@example.invalid`;
    const upsert=()=>browser.query("INSERT INTO profiles(user_id,email,first_name) VALUES($1,$2,'Concurrent') ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,first_name=excluded.first_name",[f.userId,f.email]);
    const first=authFirst?writer:browser;
    const second=authFirst?browser:writer;
    await first.query('BEGIN');
    if(authFirst) await writer.query('UPDATE auth.users SET email=$2 WHERE id=$1',[f.userId,next]); else await upsert();
    const pending=(authFirst?upsert():writer.query('UPDATE auth.users SET email=$2 WHERE id=$1',[f.userId,next])).then(value=>({value}),error=>({error}));
    for(let i=0;i<1000;i++) {
      const {rows}=await db.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[second.processID]);
      if(rows[0]?.wait_event_type==='Lock')break;
      if(i===999)assert.fail('second identity writer must wait');
    }
    await first.query('COMMIT');
    const result=await pending;
    if(authFirst)assert.equal(result.error?.code,'42501');else assert.equal(result.error,undefined);
    assert.equal((await db.query('SELECT email FROM profiles WHERE id=$1',[f.profileId])).rows[0].email,next);
  });
  await check('privileged identity boundaries deny browsers and Auth table access',async()=>{
    const f=await identity();
    for(const role of ['anon','authenticated']) {
      const caller=await connect(role);
      for(const [sql,args] of [
        ['SELECT public.resolve_auth_identity($1)',[f.email]],
        ['SELECT public.lock_confirmed_profile_auth_identity($1,$2)',[f.profileId,f.email]],
        ['SELECT public.sync_profile_from_auth_identity($1,$2,\'{}\')',[f.userId,f.email]],
        ['SELECT email FROM auth.users',[]],
        ['SELECT public.bootstrap_first_admin($1,$2)',[f.userId,f.email]],
        ['SELECT public.assert_profile_auth_identity_v1()',[]],
        ['SELECT public.assert_admin_auth_identity_v1()',[]],
        ['SELECT public.assert_orgs_auth_identity_v1()',[]],
      ]) await assert.rejects(caller.query(sql,args),e=>e.code==='42501');
    }
  });
  await check('trusted sync ignores stale email and does not relink legacy profiles',async()=>{
    const f=await identity();
    await db.query('UPDATE auth.users SET email=$2 WHERE id=$1',[f.userId,`${f.userId}-new@example.invalid`]);
    await service.query('SELECT public.sync_profile_from_auth_identity($1,$2,\'{}\')',[f.userId,f.email]);
    assert.equal((await db.query('SELECT email FROM profiles WHERE id=$1',[f.profileId])).rows[0].email,`${f.userId}-new@example.invalid`);
    const legacyEmail=`${randomUUID()}@example.invalid`,id=randomUUID();
    await db.query('INSERT INTO profiles(email) VALUES($1)',[legacyEmail]);
    await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[id,legacyEmail]);
    await assert.rejects(service.query('SELECT public.sync_profile_from_auth_identity($1,$2,\'{}\')',[id,legacyEmail]),e=>e.code==='23505');
    assert.equal((await db.query('SELECT user_id FROM profiles WHERE email=$1',[legacyEmail])).rows[0].user_id,null);
    await assert.rejects(service.query('SELECT public.resolve_auth_identity($1)',[legacyEmail]), error => error.code === 'BW002');
  });
  await check('resolution uses current confirmed email, ignores pending changes and rejects ambiguity',async()=>{
    const f=await identity(), pending=`${randomUUID()}@example.invalid`;
    await db.query('UPDATE auth.users SET email_change=$2,raw_user_meta_data=$3 WHERE id=$1',[f.userId,pending,JSON.stringify({email:pending,email_confirmed_at:'2000-01-01'})]);
    const resolve=async email=>(await service.query('SELECT public.resolve_auth_identity($1) result',[email])).rows[0].result;
    assert.equal((await resolve(` ${f.email.toUpperCase()} `)).profileId,f.profileId);
    assert.equal(await resolve(pending),null);
    assert.equal(await resolve('missing@example.invalid'),null);
    await db.query('UPDATE auth.users SET email_confirmed_at=null WHERE id=$1',[f.userId]);
    assert.equal((await resolve(f.email)).confirmed,false);
    assert.equal((await resolve(f.email)).profileId,null);
    const duplicate=randomUUID();
    await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[duplicate,` ${f.email.toUpperCase()} `]);
    await assert.rejects(resolve(f.email),e=>e.code==='21000');
  });
  await check('resolution distinguishes missing profiles from conflicting existing identities', async () => {
    const f = await identity();
    await db.query('DELETE FROM profiles WHERE id=$1', [f.profileId]);
    const missing = (await service.query('SELECT public.resolve_auth_identity($1) result', [f.email])).rows[0].result;
    assert.equal(missing.confirmed, true);
    assert.equal(missing.profileId, null);
    await db.query('INSERT INTO profiles(user_id,email) VALUES($1,$2)', [f.userId, f.email]);
    await db.query('UPDATE profiles SET email=$2 WHERE user_id=$1', [f.userId, `${f.userId}-legacy@example.invalid`]);
    await assert.rejects(service.query('SELECT public.resolve_auth_identity($1)', [f.email]), error => error.code === 'BW002');
    const legacy = `${randomUUID()}@example.invalid`;
    await db.query('INSERT INTO profiles(email) VALUES($1)', [legacy]);
    await assert.rejects(service.query('SELECT public.resolve_auth_identity($1)', [legacy]), error => error.code === 'BW002');
  });
  await check('browser UPDATE denial avoids Auth lock while Auth waits for profile',async()=>{
    const f=await identity(), browser=await browserFor(connect,f.userId), writer=await connect();
    await browser.query('BEGIN');
    await browser.query("UPDATE profiles SET first_name='Editing' WHERE id=$1",[f.profileId]);
    const pending=writer.query('UPDATE auth.users SET email=$2 WHERE id=$1',[f.userId,`${f.userId}-new@example.invalid`]);
    for(let i=0;i<1000;i++) { const {rows}=await db.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[writer.processID]); if(rows[0]?.wait_event_type==='Lock')break; if(i===999)assert.fail('Auth must wait for profile'); }
    await browser.query('SAVEPOINT forged');
    await assert.rejects(browser.query("UPDATE profiles SET email='forged@example.invalid' WHERE id=$1",[f.profileId]),e=>e.code==='42501');
    await browser.query('ROLLBACK TO forged');
    await browser.query('COMMIT');
    await pending;
    assert.equal((await db.query('SELECT email FROM profiles WHERE id=$1',[f.profileId])).rows[0].email,`${f.userId}-new@example.invalid`);
  });
}

export async function checkMembershipIdentity({db,service,connect,check,fixture,assign,accept,state,waitForLock}) {
  for (const kind of ['org', 'admin']) await check(`${kind} granting transaction rejects ambiguous normalized Auth identity`, async () => {
    const f = await fixture(kind), duplicate = randomUUID();
    await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())', [duplicate, ` ${f.email.toUpperCase()} `]);
    await assert.rejects(service.query('SELECT public.resolve_auth_identity($1)', [f.email]), error => error.code === '21000');
    if (kind === 'org') await assert.rejects(assign(service, f), error => error.code === '21000');
    await assert.rejects(accept(service, f), error => error.code === '21000');
    assert.deepEqual(await state(f), { status: 'pending', grants: 0 });
  });
  for(const kind of ['org','admin']) {
    const grant=(client,f)=>kind==='org'?assign(client,f):accept(client,f);
    for(const invalid of ['unconfirmed','stale-email','mismatched-profile-link','profile-email']) await check(`${kind} grants reject ${invalid} identity atomically`,async()=>{
      const f=await fixture(kind);
      if(invalid==='unconfirmed')await db.query('UPDATE auth.users SET email_confirmed_at=null WHERE id=$1',[f.userId]);
      if(invalid==='stale-email')await db.query('UPDATE auth.users SET email=$2 WHERE id=$1',[f.userId,`${f.userId}-new@example.invalid`]);
      if(invalid==='mismatched-profile-link') {const other=randomUUID();await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[other,`${other}@example.invalid`]);await db.query('DELETE FROM profiles WHERE user_id=$1',[other]);await db.query('UPDATE profiles SET user_id=$2 WHERE id=$1',[f.profileId,other]);}
      if(invalid==='profile-email')await db.query('UPDATE profiles SET email=$2 WHERE id=$1',[f.profileId,`${f.userId}-forged@example.invalid`]);
      await assert.rejects(grant(service,f),/corresponde|outro email/);
      assert.deepEqual(await state(f),{status:'pending',grants:0});
      // Acceptance must validate the same identity boundary as direct access.
      if(kind==='org')await assert.rejects(accept(service,f),/outro email/);
    });
    for(const emailFirst of [true,false]) await check(`${kind} email-change race with ${emailFirst?'Auth':'grant'} first`,async()=>{
      const f=await fixture(kind),first=await connect(),second=await connect(emailFirst?'service_role':undefined);
      const next=`${f.userId}-new@example.invalid`;
      await first.query('BEGIN');
      if(emailFirst)await first.query('UPDATE auth.users SET email=$2 WHERE id=$1',[f.userId,next]);else await grant(first,f);
      const pending=(emailFirst?grant(second,f):second.query('UPDATE auth.users SET email=$2 WHERE id=$1',[f.userId,next])).then(value=>({value}),error=>({error}));
      await waitForLock(second);await first.query('COMMIT');
      const result=await pending;
      if(emailFirst) {assert.match(result.error?.message??'',/outro email/);assert.deepEqual(await state(f),{status:'pending',grants:0});}
      else {assert.equal(result.error,undefined);assert.deepEqual(await state(f),{status:'accepted',grants:1});}
    });
  }
  for(const grantKind of ['assignment','org-acceptance','admin-acceptance']) await check(`${grantKind} locked grant completes before concurrent Auth email update`,async()=>{
    const f=await fixture(grantKind==='admin-acceptance'?'admin':'org'),first=await connect('service_role'),writer=await connect();
    await first.query('BEGIN');
    if(grantKind==='assignment')await assign(first,f);else await accept(first,f);
    const pending=writer.query('UPDATE auth.users SET email=$2 WHERE id=$1',[f.userId,`${f.userId}-new@example.invalid`]);
    await waitForLock(writer);await first.query('COMMIT');await pending;
    assert.deepEqual(await state(f),{status:'accepted',grants:1});
    await assert.rejects(grantKind==='assignment'?assign(service,f):accept(service,f),/outro email/);
  });
  await check('stale profile link after resolution is rechecked under profile lock',async()=>{
    const f=await fixture('org'),blocker=await connect(),caller=await connect('service_role'),other=randomUUID();
    await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[other,`${other}@example.invalid`]);
    await db.query('DELETE FROM profiles WHERE user_id=$1',[other]);
    await blocker.query('BEGIN');
    await blocker.query('UPDATE profiles SET user_id=$2 WHERE id=$1',[f.profileId,other]);
    const pending=assign(caller,f).then(()=>null,error=>error);
    await waitForLock(caller);await blocker.query('COMMIT');
    assert.match((await pending).message,/corresponde/);
    assert.deepEqual(await state(f),{status:'pending',grants:0});
  });
}

// Run after the shared Projects checks have applied their migration history.
export async function checkProjectInheritance({db,service,connect,check,identity,assign}) {
  await check('project visibility follows current org membership and explicit selected grants',async()=>{
    const f=await identity(),orgId=randomUUID(),browser=await browserFor(connect,f.userId),projects={};
    await db.query("INSERT INTO organizations(id,name) VALUES($1,'Synthetic project audience')",[orgId]);
    for(const mode of ['hidden','selected_clients','all_org_clients']) {
      const id=randomUUID();projects[mode]=id;
      await db.query('INSERT INTO projects(id,name,organization_id,client_access_mode) VALUES($1,$2,$3,$4)',[id,`Synthetic ${mode}`,orgId,mode]);
      await db.query('INSERT INTO project_client_organizations(project_id,organization_id) VALUES($1,$2)',[id,orgId]);
    }
    const visible=async()=>new Set((await browser.query('SELECT project_id FROM public.list_current_client_projects() WHERE project_id=ANY($1::uuid[])',[Object.values(projects)])).rows.map(row=>row.project_id));
    assert.deepEqual(await visible(),new Set());
    await assign(service,{...f,orgId});
    assert.deepEqual(await visible(),new Set([projects.all_org_clients]));
    assert.equal((await browser.query('SELECT * FROM public.get_current_client_project($1)',[projects.hidden])).rowCount,0);
    await db.query('INSERT INTO project_client_profiles(project_id,organization_id,profile_id) VALUES($1,$2,$3)',[projects.selected_clients,orgId,f.profileId]);
    assert.deepEqual(await visible(),new Set([projects.selected_clients,projects.all_org_clients]));
    await db.query('DELETE FROM project_client_profiles WHERE profile_id=$1',[f.profileId]);
    assert.deepEqual(await visible(),new Set([projects.all_org_clients]));
    await db.query('INSERT INTO project_client_profiles(project_id,organization_id,profile_id) VALUES($1,$2,$3)',[projects.selected_clients,orgId,f.profileId]);
    await db.query('DELETE FROM organization_members WHERE organization_id=$1 AND profile_id=$2',[orgId,f.profileId]);
    assert.deepEqual(await visible(),new Set());
    assert.equal((await db.query('SELECT count(*)::int n FROM project_client_profiles WHERE profile_id=$1',[f.profileId])).rows[0].n,0);
    await assign(service,{...f,orgId});
    assert.deepEqual(await visible(),new Set([projects.all_org_clients]));
    await db.query("UPDATE user_role_assignments SET role_code='staff' WHERE profile_id=$1",[f.profileId]);
    assert.equal((await browser.query('SELECT public.can_current_client_view_project($1) visible',[projects.all_org_clients])).rows[0].visible,false);
  });
}
