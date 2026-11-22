// @vitest-environment node
// Actual PIN, Auth, cookies, rate-limit and last-seen DB effects in an isolated
// TEST tenant. Only console diagnostics are captured; no login/provider double.
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {saveManagedUserAction} from '@/app/actions/settings.actions';
import {loginWithPin} from '@/app/actions/auth.actions';
import {createPinLoginHandle} from '@/lib/server/pinLoginHandle';
import {readAppSession} from '@/lib/server/appSession';

it('E0 measures the existing real login phases while retaining wrong-PIN counting, cookie and one last-seen receipt',async()=>{
 const manager=await createFixture(['einstellungen','logins']),actor=await createFixture(['auftraege']);
 expect(await withSession(manager,()=>saveManagedUserAction({userId:actor.actorId,fullName:'TEST E0 PIN',shortCode:'E0',designation:'TEST E0',active:true,pin:'7654'}))).toMatchObject({code:'OK'});
 const handle=createPinLoginHandle(actor.actorId);
 const output=vi.spyOn(console,'info').mockImplementation(()=>{});
 const phases=()=>output.mock.calls.filter(call=>call[0]==='[PAGE_READ_PHASE]').map(call=>JSON.parse(String(call[1])) as {phase:string;durationMs:number});
 try{
  expect(await withSession(actor,()=>loginWithPin(handle,'1111'))).toMatchObject({ok:false,message:'Code falsch · bitte neu eingeben'});
  expect(await sql`SELECT failed_attempts FROM public.pin_rate_limits WHERE tenant_id=${tenant} AND operator_id=${actor.actorId}::uuid`).toEqual([{failed_attempts:1}]);
  expect(phases().filter(row=>row.phase.startsWith('auth.')).map(row=>row.phase).sort()).toEqual(['auth.bcrypt','auth.candidates','auth.tx']);
  output.mockClear();
  await withSession(actor,async()=>{
   expect(await loginWithPin(handle,'7654')).toMatchObject({ok:true});
   const session=await readAppSession();expect(session.ok).toBe(true);
   if(!session.ok)throw Error('TEST_E0_ACTUAL_SESSION_REQUIRED');
   expect(session.session.userId).toBe(actor.actorId);
  });
  const actual=phases().filter(row=>row.phase.startsWith('auth.'));
  expect(actual.map(row=>row.phase).sort()).toEqual(['auth.bcrypt','auth.candidates','auth.last_seen','auth.tx']);
  expect(actual.every(row=>Number.isSafeInteger(row.durationMs)&&row.durationMs>=0)).toBe(true);
  const serialized=JSON.stringify(output.mock.calls);
  for(const secret of ['7654','1111',handle,actor.actorId])expect(serialized).not.toContain(secret);
  expect(await sql`SELECT count(*)::int AS count FROM public.events WHERE tenant_id=${tenant} AND user_id=${actor.actorId}::uuid AND event_type='USER_LAST_SEEN_RECORDED_V1'`).toEqual([{count:1}]);
  expect(await sql`SELECT failed_attempts FROM public.pin_rate_limits WHERE tenant_id=${tenant} AND operator_id=${actor.actorId}::uuid`).toEqual([]);
 }finally{output.mockRestore();}
});
