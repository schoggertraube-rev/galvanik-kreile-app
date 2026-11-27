// @vitest-environment node
// Real Actions/Auth/DB/PDF. No mail provider is called by a paper handover.
import { readBetriebsruheInTransaction } from "@/modules/fundament/server-public";
import {expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {confirmInvoiceHandoverAction,sendCustomerMailAction} from '@/app/actions/communications.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readUnsentInvoiceOriginals,readUnsentInvoiceMailGroups,readInvoiceMailCohort,readInvoiceMailOpenRemainder,readInvoiceMailUnacknowledged} from '@/lib/server/communicationDocumentPort';
import {readTodayDashboard} from '@/lib/server/todayDashboard';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';
import {historicalCollection} from '../../../e2e/ablauf/invoiceCollectionFixture';
import {issueCollectionInvoiceAction} from '@/app/actions/invoices.actions';
const replayUrl=process.env.DATABASE_URL;
if(!replayUrl||replayUrl!==process.env.H18_EXPECTED_DATABASE_URL||new URL(replayUrl).hostname!=='127.0.0.1')throw Error('TEST_HANDOVER_DEDICATED_REPLAY_REQUIRED');

it('H4 persists the actual actor/original/time once, removes only that invoice from every delivery reader and never invents a mail ACK',async()=>{
 const customerId=await customerFixture('TEST H4 real paper receipt');
 const first=await readyInvoiceOrder('TEST H4 paper','pickup',false,customerId);
 const second=await readyInvoiceOrder('TEST H4 still open','pickup',false,customerId);
 const prices=await createFixture(['preise']),denied=await createFixture(['mails']);
 const input={invoiceId:first.invoice.invoiceId,clientRequestId:randomUUID()};
 expect(await withSession(denied,()=>confirmInvoiceHandoverAction(input))).toMatchObject({code:'FORBIDDEN'});
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${tenant} AND event_type='COMMUNICATION_INVOICE_HANDED_OVER_V1'`).toHaveLength(0);
 const result=await withSession(prices,()=>confirmInvoiceHandoverAction(input));
 expect(result).toMatchObject({code:'OK',replayed:false,receipt:{invoiceId:input.invoiceId,customerId,actorId:prices.actorId,source:'manual_handover'}});
 if(result.code!=='OK')throw Error('TEST_REAL_HANDOVER_REQUIRED');
 const [original]=await sql`SELECT pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${input.invoiceId}::uuid`;
 expect(result.receipt.originalSha256).toBe(original.pdf_sha256);expect(result.receipt.handedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
 expect(await withSession(prices,()=>confirmInvoiceHandoverAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:result.receipt});
 const parallel=await Promise.all([1,2].map(()=>withSession(prices,()=>confirmInvoiceHandoverAction({...input,clientRequestId:randomUUID()}))));
 expect(parallel.every(value=>value.code==='OK'&&value.replayed)).toBe(true);
 const other=await createFixture(['preise']);
 expect(await withSession(other,()=>confirmInvoiceHandoverAction(input))).toMatchObject({code:'CONFLICT'});
 const auth=await withSession(prices,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_HANDOVER_AUTH');
 await withPrivilegedTenantTransaction(auth.data,async tx=>{
  expect((await readUnsentInvoiceOriginals(tx,tenant,customerId)).map(row=>row.id)).toEqual([second.invoice.invoiceId]);
  expect((await readUnsentInvoiceMailGroups(tx,tenant)).groups.filter(row=>row.customerId===customerId).map(row=>row.id)).toEqual([second.invoice.invoiceId]);
  expect((await readInvoiceMailCohort(tx,tenant,customerId,'pickup')).map(row=>row.id)).toEqual([second.invoice.invoiceId]);
  expect(await readInvoiceMailOpenRemainder(tx,tenant,customerId,[input.invoiceId])).toEqual([]);
  expect(await readInvoiceMailUnacknowledged(tx,tenant,customerId,[input.invoiceId])).toEqual([input.invoiceId]);
 });
 const today=await withSession(prices,()=>readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction, readBetriebsruheInTransaction));
 expect(today.items.filter(row=>row.invoiceMail?.customerId===customerId).map(row=>row.invoiceId)).toEqual([second.invoice.invoiceId]);
 const send=await withSession(prices,()=>sendCustomerMailAction({targetType:'CUSTOMER',targetId:customerId,clientRequestId:randomUUID(),subject:'TEST stale paper original',body:'TEST do not send',attachment:{kind:'INVOICE',documentId:input.invoiceId},expectedInvoiceIds:[input.invoiceId],singleInvoice:true}));
 expect(send).toMatchObject({code:'CONFLICT',message:expect.stringContaining('übergeben')});
 expect('message'in send&&send.message).not.toMatch(/gesendet/);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${tenant} AND event_type='COMMUNICATION_INVOICE_HANDED_OVER_V1'`).toHaveLength(1);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${tenant} AND event_type IN('COMMUNICATION_MAIL_PREPARED_V1','COMMUNICATION_DOCUMENT_SENT_V1')`).toHaveLength(0);
 await expect(sql`UPDATE public.events SET description='TEST forbidden rewrite' WHERE tenant_id=${tenant} AND event_type='COMMUNICATION_INVOICE_HANDED_OVER_V1'`).rejects.toThrow();
 await expect(sql`DELETE FROM public.events WHERE tenant_id=${tenant} AND event_type='COMMUNICATION_INVOICE_HANDED_OVER_V1'`).rejects.toThrow();
});

it('H4 requires a persisted receipt: suppressed insert gives no success and the same request recovers after the fault is removed',async()=>{
 const order=await readyInvoiceOrder('TEST H4 missing receipt');
 const input={invoiceId:order.invoice.invoiceId,clientRequestId:randomUUID()};
 const fault='test_h4_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' AND NEW.event_type='COMMUNICATION_INVOICE_HANDED_OVER_V1' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{
  expect(await withSession(full,()=>confirmInvoiceHandoverAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${tenant} AND client_event_id=${input.clientRequestId}::uuid`).toHaveLength(0);
 }finally{
  await sql.unsafe(`DROP TRIGGER ${fault} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);
 }
 expect(await withSession(full,()=>confirmInvoiceHandoverAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:false});
 expect(await withSession(full,()=>confirmInvoiceHandoverAction(input))).toMatchObject({code:'OK',replayed:true});
});

it('H4 also qualifies a real native invoice original and the database rejects a substituted PDF hash',async()=>{
 // Initial old goods records are explicitly synthetic TEST fixtures; invoice and receipt actions are real.
 const source=await historicalCollection([1900,1900,1900]);
 const issued=await withSession(full,()=>issueCollectionInvoiceAction({collectionId:source.collectionId,expectedVersion:1,clientEventId:randomUUID()}));
 expect(issued.code).toBe('OK');if(issued.code!=='OK')throw Error('TEST_NATIVE_HANDOVER_ISSUE');
 const invoiceId=issued.receipt.invoiceId,key=randomUUID();
 await expect(sql.begin(async tx=>{
  await tx`SELECT set_config('app.tenant_id',${tenant},true)`;
  await tx`INSERT INTO public.events(id,tenant_id,event_type,description,payload,status,user_id,client_event_id,correlation_id,event_schema_version,created_at)
   VALUES(${randomUUID()},${tenant},'COMMUNICATION_INVOICE_HANDED_OVER_V1','TEST wrong PDF',
    jsonb_build_object('invoiceId',${invoiceId}::text,'customerId',${source.customerId}::text,'originalSha256',${'0'.repeat(64)}::text,'actorId',${full.actorId}::text,'handedAt',to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'source','manual_handover'),
    'success',${full.actorId}::uuid,${key}::uuid,${key}::uuid,1,statement_timestamp() AT TIME ZONE 'UTC')`;
 })).rejects.toThrow('INVOICE_MANUAL_HANDOVER_SOURCE_INVALID');
 const saved=await withSession(full,()=>confirmInvoiceHandoverAction({invoiceId,clientRequestId:key}));
 expect(saved).toMatchObject({code:'OK',replayed:false,receipt:{invoiceId,customerId:source.customerId,source:'manual_handover'}});
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_NATIVE_HANDOVER_AUTH');
 await withPrivilegedTenantTransaction(auth.data,async tx=>{
  expect(await readUnsentInvoiceOriginals(tx,tenant,source.customerId)).toEqual([]);
  expect((await readUnsentInvoiceMailGroups(tx,tenant)).groups.filter(row=>row.customerId===source.customerId)).toEqual([]);
  expect(await readInvoiceMailCohort(tx,tenant,source.customerId,null,undefined,true)).toEqual([]);
  expect(await readInvoiceMailOpenRemainder(tx,tenant,source.customerId,[invoiceId])).toEqual([]);
 });
});
