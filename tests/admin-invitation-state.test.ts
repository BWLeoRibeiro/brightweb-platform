import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdminUserInvitation, revokeAdminUserInvitation, listAdminUserInvitations, ADMIN_USER_INVITE_STATE_CHANGED_ERROR, ADMIN_USER_INVITE_EMAIL_DELIVERY_ERROR, ADMIN_USER_INVITE_SCHEMA_MISSING_ERROR } from '../packages/module-admin/src/invitations.ts';

function fixture(status = 'pending', error: {message: string; code: string} | null = null) {
  const row = { id: 'invitation', invited_email: 'fixture@example.invalid', role_code: 'staff', status, created_at: '2026-01-01', expires_at: '2099-01-01' };
  const state = { rows: [row], events: 0 };
  const client = { auth: {admin: {listUsers: async () => ({data:{users:[]},error:null})}}, rpc: async () => {state.events++;return {data:null,error:null};}, from() {
    let action = 'read', patch = {}; const filters: [string,unknown][]=[];
    const query: any = {};
    for (const method of ['select','order','limit','lte']) query[method]=()=>query;
    query.eq=(key:string,value:unknown)=>{filters.push([key,value]);return query;};
    query.update=(value:unknown)=>{action='update';patch=value as {};return query;};
    query.insert=()=>{action='insert';return query;};
    query.delete=()=>{action='delete';return query;};
    const result=()=>{
      if(error)return {data:null,error};
      const matching=state.rows.filter(row=>filters.every(([key,value])=>(row as any)[key]===value));
      // Expiry query is not due in this fixture.
      if(action==='update' && (patch as any).status !== 'expired')for(const row of matching)Object.assign(row,patch);
      if(action==='delete')state.rows=state.rows.filter(row=>!matching.includes(row));
      return {data:action==='insert'?row:matching,error:null};
    };
    query.single=async()=>result();query.then=(resolve:any)=>Promise.resolve(result()).then(resolve);return query;
  }};
  return {client:client as never,state,row};
}
for(const status of ['accepted','revoked','expired','missing']) test(`admin revoke rejects ${status} without a false audit event`, async()=>{
  const {client,state}=fixture(status);if(status==='missing')state.rows=[];
  await assert.rejects(revokeAdminUserInvitation(client,'invitation'),/INVITATION_NOT_PENDING/);
  assert.equal(state.events,0);
});
test('admin revoke changes exactly the pending invitation and emits one event',async()=>{
  const {client,state,row}=fixture();await revokeAdminUserInvitation(client,'invitation');
  assert.equal(row.status,'revoked');assert.equal(state.events,1);
});
for(const concurrentlyAccepted of [false,true]) test(`failed delivery ${concurrentlyAccepted?'preserves concurrently accepted invitation':'removes pending invitation'}`,async()=>{
  const {client,state,row}=fixture();
  await assert.rejects(createAdminUserInvitation(client,{email:row.invited_email,role:'staff',invitedByProfileId:'actor'},{sendInviteEmail:async()=>{if(concurrentlyAccepted)row.status='accepted';return false;}}),{message:concurrentlyAccepted?ADMIN_USER_INVITE_STATE_CHANGED_ERROR:ADMIN_USER_INVITE_EMAIL_DELIVERY_ERROR});
  assert.equal(state.rows.length,concurrentlyAccepted?1:0);assert.equal(state.events,0);
});
test('table permission failures are not mislabeled as missing migrations',async()=>{
  await assert.rejects(listAdminUserInvitations(fixture('pending',{code:'42501',message:'permission denied for table admin_user_invitations'}).client),/permission denied/);
  await assert.rejects(listAdminUserInvitations(fixture('pending',{code:'42P01',message:'relation admin_user_invitations does not exist'}).client),{message:ADMIN_USER_INVITE_SCHEMA_MISSING_ERROR});
});

test('admin HTTP reports a stale revoke as conflict',async()=>{
  const { createAdminUserInvitationDeleteHandler }=await import('../packages/module-admin/src/http.ts');
  const {client}=fixture('accepted');
  const handler=createAdminUserInvitationDeleteHandler({getAccess:async()=>({ok:true,profileId:'actor'}),getServiceClient:()=>client,revokeInvitation:revokeAdminUserInvitation} as never);
  const response=await handler(new Request('https://example.invalid/invitation',{method:'DELETE'}),{params:Promise.resolve({invitationId:'invitation'})});
  assert.equal(response.status,409);assert.equal((await response.json()).error.code,'INVITATION_NOT_PENDING');
});
