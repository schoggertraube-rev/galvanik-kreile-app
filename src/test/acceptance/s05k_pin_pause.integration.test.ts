// @vitest-environment node
// TEST actors and explicit stored clock-boundary fixtures; actual Auth/actions/DB.
import {it,expect,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {saveManagedUserAction,changeOwnPinAction} from '@/app/actions/settings.actions';
import {loginWithPin} from '@/app/actions/auth.actions';
import {createPinLoginHandle} from '@/lib/server/pinLoginHandle';

it('S05K A6 pauses by ten, expires, doubles, caps and resets through the existing PIN writers',async()=>{
 const manager=await createFixture(['einstellungen','logins']),actor=await createFixture(['auftraege']);
 const profile={userId:actor.actorId,fullName:'TEST A6 PIN',shortCode:'P6',designation:'TEST A6',active:true,pin:'7654'};
 expect(await withSession(manager,()=>saveManagedUserAction(profile))).toMatchObject({code:'OK'});
 actor.actorIssuedAt=Date.now();
 const handle=createPinLoginHandle(actor.actorId);
 async function boundary(count:number,minutesAgo:number){
  await sql`INSERT INTO public.pin_rate_limits(operator_id,tenant_id,failed_attempts,last_failed_at) VALUES(${actor.actorId}::uuid,${tenant},${count},statement_timestamp()-${minutesAgo}*interval '1 minute') ON CONFLICT(operator_id) DO UPDATE SET failed_attempts=excluded.failed_attempts,last_failed_at=excluded.last_failed_at`;
 }
 async function count(){const [row]=await sql`SELECT failed_attempts FROM public.pin_rate_limits WHERE tenant_id=${tenant} AND operator_id=${actor.actorId}::uuid`;return row?.failed_attempts??null;}
 await boundary(9,0);
 expect(await withSession(actor,()=>loginWithPin(handle,'1111'))).toMatchObject({ok:false,message:expect.stringMatching(/^Zu viele Versuche\. Versuch es um \d{2}:\d{2} wieder\.$/)});
 expect(await count()).toBe(10);
 expect(await withSession(actor,()=>loginWithPin(handle,'7654'))).toMatchObject({ok:false});
 expect(await count()).toBe(10);
 await boundary(10,16);
 expect(await withSession(actor,()=>loginWithPin(handle,'1111'))).toMatchObject({ok:false,message:'Code falsch · bitte neu eingeben'});
 expect(await count()).toBe(11);
 await boundary(20,29);
 expect(await withSession(actor,()=>loginWithPin(handle,'7654'))).toMatchObject({ok:false,message:expect.stringContaining('Zu viele Versuche.')});
 await boundary(20,31);
 expect(await withSession(actor,()=>loginWithPin(handle,'7654'))).toMatchObject({ok:true});
 expect(await count()).toBeNull();
 await boundary(100,1439);
 expect(await withSession(actor,()=>loginWithPin(handle,'7654'))).toMatchObject({ok:false});
 await boundary(100,1441);
 expect(await withSession(actor,()=>loginWithPin(handle,'7654'))).toMatchObject({ok:true});
 await boundary(100,0);
 expect(await withSession(actor,()=>changeOwnPinAction({pin:'8765'}))).toMatchObject({code:'OK'});
 expect(await count()).toBeNull();
 actor.actorIssuedAt=Date.now();
 expect(await withSession(actor,()=>loginWithPin(handle,'8765'))).toMatchObject({ok:true});
 await boundary(100,0);
 expect(await withSession(manager,()=>saveManagedUserAction({...profile,pin:'9876'}))).toMatchObject({code:'OK'});
 expect(await count()).toBeNull();
 actor.actorIssuedAt=Date.now();
 expect(await withSession(actor,()=>loginWithPin(handle,'9876'))).toMatchObject({ok:true});
});
