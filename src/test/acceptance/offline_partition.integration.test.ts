// @vitest-environment node
import {it,expect,vi} from 'vitest';
const tenant=vi.hoisted(()=> 'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {getAuthorizationSnapshotAction} from '@/app/actions/auth.actions';
import {getIntakePendingScopeAction} from '@/app/actions/eingang.actions';
import {getAuthBootstrapState} from '@/lib/server/authBootstrap';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
it('one local offline partition follows the real active login without granting intake or exposing identity',async()=>{
 const workshop=await createFixture(['auftraege'],'werkstatt');
 const read=await withSession(workshop,()=>getAuthorizationSnapshotAction());
 expect(read).toMatchObject({ok:true,data:{offlineScope:expect.stringMatching(/^[a-f0-9]{64}$/)}});
 if(!read.ok)throw Error('TEST_OFFLINE_SCOPE');
 expect(JSON.stringify(read)).not.toContain(workshop.actorId);
 expect(await withSession(workshop,()=>getIntakePendingScopeAction())).toMatchObject({code:'FORBIDDEN'});
 const fresh=await withSession(workshop,()=>getAuthBootstrapState());
 expect(fresh).toMatchObject({status:'authenticated',user:{offlineScope:read.data.offlineScope}});
 const intake=await withSession(full,()=>getIntakePendingScopeAction());
 const current=await withSession(full,()=>getAuthorizationSnapshotAction());
 expect(intake.code==='OK'&&current.ok&&intake.scope===current.data.offlineScope).toBe(true);
 expect(current.ok&&current.data.offlineScope).not.toBe(read.data.offlineScope);
 await sql`UPDATE public.app_users SET active=false WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${workshop.actorId}::uuid`;
 expect(await withSession(workshop,()=>getAuthorizationSnapshotAction())).toMatchObject({ok:false});
});
