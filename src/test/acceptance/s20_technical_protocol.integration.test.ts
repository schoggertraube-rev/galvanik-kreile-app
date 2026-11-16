// @vitest-environment node
// Synthetic TEST fixtures only; actual Actions/Auth/DB/Storage and unchanged business commands.
import {createHash,randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,withRequest,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {confirmPaymentAction,setPaymentModeAction} from '@/app/actions/payments.actions';
import {getProtocolLogAction} from '@/app/actions/logging.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import * as authorizationModule from '@/lib/server/authorization';
import {logTechnical,observeAction} from '@/modules/logging/server-public';
import {readLoggingSettings} from '@/modules/fundament/server-public';
import type {TechnicalEvent} from '@/modules/logging/public';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1'||!KREILE_TENANT_SLUG.startsWith('TEST-ablauf-'))throw Error('S20_DEDICATED_TEST_REPLAY_REQUIRED');
beforeAll(async()=>{
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) VALUES(${randomUUID()},${KREILE_TENANT_SLUG},'TEST S20 protocol')`;
});
async function auth(){const result=await withSession(full,()=>resolveAuthorization());if(!result.ok)throw Error('TEST_REAL_AUTH_REQUIRED');return result.data;}
async function reader(){return createFixture(['protokoll']);}

it('L1 actual denied payment creates one safe actor/source entry; no session creates no row and keeps UNAUTHENTICATED',async()=>{
 const customer=await customerFixture('S20 permission'),order=await intakeOrderFixture('S20 permission',customer);
 const operator=await createFixture(['auftraege']);
 const input={invoiceId:randomUUID(),amount:100,method:'bar' as const,expectedVersion:0,clientEventId:randomUUID()};
 const before=await sql`SELECT id,payment_mode,payment_mode_version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.receipt.orderId}`;
 const realResolver=vi.spyOn(authorizationModule,'resolveAuthorization');
 expect(await withSession(operator,()=>confirmPaymentAction(input))).toMatchObject({code:'FORBIDDEN'});
 expect(realResolver).toHaveBeenCalledTimes(1);realResolver.mockRestore();
 const rows=await sql`SELECT event_type,user_id::text,subject_id,reason FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND subject_id=${input.invoiceId}`;
 expect(rows).toEqual([{event_type:'rejected',user_id:operator.actorId,subject_id:input.invoiceId,reason:'FORBIDDEN'}]);
 expect(await sql`SELECT id,payment_mode,payment_mode_version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.receipt.orderId}`).toEqual(before);
 const absent={...input,invoiceId:randomUUID(),clientEventId:randomUUID()};
 expect(await withRequest('',()=>confirmPaymentAction(absent))).toMatchObject({code:'UNAUTHENTICATED'});
 expect(await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND subject_id=${absent.invoiceId}`).toHaveLength(0);
});

it('one observation per command keeps concurrent real logins separate and never persists a malformed input as an object reference',async()=>{
 const left=await createFixture(['auftraege']),right=await createFixture(['auftraege']);
 const inputs=[left,right].map(()=>({invoiceId:randomUUID(),amount:100,method:'bar' as const,expectedVersion:0,clientEventId:randomUUID()}));
 expect(await Promise.all([withSession(left,()=>confirmPaymentAction(inputs[0])),withSession(right,()=>confirmPaymentAction(inputs[1]))])).toMatchObject([{code:'FORBIDDEN'},{code:'FORBIDDEN'}]);
 const rows=await sql`SELECT user_id::text,subject_id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND subject_id IN (${inputs[0].invoiceId},${inputs[1].invoiceId}) ORDER BY subject_id`;
 expect(rows).toHaveLength(2);
 expect(rows.find(row=>row.subject_id===inputs[0].invoiceId)?.user_id).toBe(left.actorId);
 expect(rows.find(row=>row.subject_id===inputs[1].invoiceId)?.user_id).toBe(right.actorId);
 expect(await withSession(left,()=>confirmPaymentAction({...inputs[0],invoiceId:'Bearer PRIVATE_INPUT_1234'}))).toMatchObject({code:'VALIDATION_ERROR'});
 const invalid=await sql`SELECT subject_type,subject_id,reason FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND user_id=${left.actorId}::uuid AND reason='VALIDATION'`;
 expect(invalid).toEqual([{subject_type:'action',subject_id:'confirmPayment',reason:'VALIDATION'}]);
});

it('L6 allowlisted technical source persists references/hash only; L9 actual protocol right is required',async()=>{
 const authorization=await auth(),reference=randomUUID();
 const secrets={pin:'1234',password:'TEST-PASSWORD-NOT-FOR-LOG',token:'Bearer x',mail:'PRIVATE_MAIL_'.repeat(200),file:Buffer.from('PRIVATE_FILE_BYTES')};
 const event:TechnicalEvent&typeof secrets={type:'external',command:'sendCustomerMail',subject:{type:'mail',id:reference},dienst:'microsoft365',ergebnis:'ok',original:{ref:reference,sha256:createHash('sha256').update('TEST secured original').digest('hex')},...secrets};
 expect(await logTechnical(authorization,event)).toBe(true);
 const [stored]=await sql`SELECT * FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND subject_id=${reference}`;
 expect(stored.original_sha256).toBe(event.original?.sha256);
 const serialized=JSON.stringify(stored);
 for(const value of [secrets.pin,secrets.password,secrets.token,'PRIVATE_MAIL_','PRIVATE_FILE_BYTES'])expect(serialized).not.toContain(value);
 expect(await withSession(full,()=>getProtocolLogAction({subjectId:reference}))).toEqual({code:'FORBIDDEN'});
 const allowed=await reader(),read=await withSession(allowed,()=>getProtocolLogAction({subjectId:reference}));
 expect(read).toMatchObject({code:'OK',technical:[{subjectId:reference,userId:full.actorId,dienst:'microsoft365',ergebnis:'ok'}]});
});

it('L7 a suppressed logging receipt never rolls back an actual payment-mode change; next successful log carries the missing count',async()=>{
 const customer=await customerFixture('S20 sink'),created=await intakeOrderFixture('S20 sink',customer),orderId=created.receipt.orderId;
 const [{payment_mode_version:version}]=await sql`SELECT payment_mode_version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderId}`;
 const input={orderId,paymentMode:'abholung' as const,expectedVersion:version,clientEventId:randomUUID()};
 const fault='test_s20_'+randomUUID().replaceAll('-','');
 if(!/^TEST-[A-Za-z0-9-]+$/.test(KREILE_TENANT_SLUG))throw Error('TEST_TENANT_REQUIRED');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.technical_protocol FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 await sql`UPDATE public.company_settings SET protokoll_langsam_ms=1 WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 try{
  const changed=await withSession(full,()=>setPaymentModeAction(input));
  expect(changed).toMatchObject({code:'OK',receipt:{paymentMode:'abholung'}});
  expect(await sql`SELECT payment_mode FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderId}`).toEqual([{payment_mode:'abholung'}]);
 }finally{await sql.unsafe(`DROP TRIGGER ${fault} ON public.technical_protocol`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);await sql`UPDATE public.company_settings SET protokoll_langsam_ms=1000 WHERE tenant_id=${KREILE_TENANT_SLUG}`;}
 const replay=await withSession(full,()=>setPaymentModeAction(JSON.parse(JSON.stringify(input))));expect(replay).toMatchObject({code:'OK',replayed:true});
 expect(await logTechnical(await auth(),{type:'server_error',command:'setPaymentMode',subject:{type:'order',id:orderId},reason:'SERVER_ERROR'})).toBe(true);
 const rows=await sql`SELECT verpasst FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND subject_id=${orderId}`;
 expect(rows).toHaveLength(1);expect(rows[0].verpasst).toBeGreaterThanOrEqual(1);
});

it('L2 observer preserves an actual SQL failure and records a sanitized error, with the retained input available for retry',async()=>{
 const reference=randomUUID(),authorization=await auth();
 await expect(withSession(full,()=>observeAction('testS20Sql',{type:'order',id:reference},async()=>{
  await resolveAuthorization();
  await sql`SELECT 1/0`;return {code:'OK' as const};
 },readLoggingSettings))).rejects.toMatchObject({code:'22012'});
 const rows=await sql`SELECT event_type,reason FROM public.technical_protocol WHERE tenant_id=${authorization.tenantId} AND subject_id=${reference}`;
 expect(rows).toEqual([{event_type:'server_error',reason:'SERVER_ERROR'}]);
});

it('L3/L4 real SQL response duration obeys the current configured threshold, without mocking clocks or inventing a duration',async()=>{
 const slow=randomUUID(),fast=randomUUID(),changed=randomUUID();
 for(const [reference,seconds] of [[slow,1.2],[fast,0.8]] as const){
  expect(await withSession(full,()=>observeAction('testS20Duration',{type:'order',id:reference},async()=>{
   await resolveAuthorization();
   await sql`SELECT pg_sleep(${seconds})`;return {code:'OK' as const};
  },readLoggingSettings))).toEqual({code:'OK'});
 }
 const recorded=await sql`SELECT subject_id,duration_ms FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND subject_id IN (${slow},${fast})`;
 expect(recorded).toHaveLength(1);expect(recorded[0].subject_id).toBe(slow);expect(recorded[0].duration_ms).toBeGreaterThan(1000);
 await sql`UPDATE public.company_settings SET protokoll_langsam_ms=2000 WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 try{
  expect(await withSession(full,()=>observeAction('testS20Duration',{type:'order',id:changed},async()=>{
   await resolveAuthorization();
   await sql`SELECT pg_sleep(1.2)`;return {code:'OK' as const};
  },readLoggingSettings))).toEqual({code:'OK'});
  expect(await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND subject_id=${changed}`).toHaveLength(0);
 }finally{await sql`UPDATE public.company_settings SET protokoll_langsam_ms=1000 WHERE tenant_id=${KREILE_TENANT_SLUG}`;}
});

it('L10 authorized read deletes only old protocol rows when configured; null retention keeps them and never touches business events',async()=>{
 const reference=randomUUID(),authorization=await auth();
 for(const days of [31,29])await sql`INSERT INTO public.technical_protocol(tenant_id,user_id,occurred_at,recorded_at,event_type,command,subject_type,subject_id,reason)
 VALUES(${KREILE_TENANT_SLUG},${authorization.userId}::uuid,statement_timestamp()-(${days}*interval '1 day'),statement_timestamp()-(${days}*interval '1 day'),'rejected','testS20Retention','order',${reference},'FORBIDDEN')`;
 const allowed=await reader();
 const before=await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const retained=await withSession(allowed,()=>getProtocolLogAction({subjectId:reference}));expect(retained).toMatchObject({code:'OK'});
 if(retained.code!=='OK')throw Error('TEST_READ_REQUIRED');expect(retained.technical).toHaveLength(2);
 await sql`UPDATE public.company_settings SET protokoll_aufbewahrung_tage=30 WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const after=await withSession(allowed,()=>getProtocolLogAction({subjectId:reference}));expect(after).toMatchObject({code:'OK'});
 if(after.code!=='OK')throw Error('TEST_READ_REQUIRED');expect(after.technical).toHaveLength(1);
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual(before);
 await sql`UPDATE public.company_settings SET protokoll_aufbewahrung_tage=NULL WHERE tenant_id=${KREILE_TENANT_SLUG}`;
});
