// @vitest-environment node
// PL19:24-2 / R1: a version-only command cannot silently replace a printed source proof.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {confirmPaymentAction,getOrderPaymentStateAction} from '@/app/actions/payments.actions';
import {updateCustomerAction} from '@/app/actions/customers.actions';
import {generateDeliveryNote} from '@/app/actions/pdf.actions';
it('KORR19:24 a fresh version-only request cannot silently accept changed printed facts; actual source projection permits an explicit retry',async()=>{
 const order=await readyInvoiceOrder('TEST S10 missing printed source proof');
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:order.invoice.invoiceId,amount:order.invoice.grossAmountCents,expectedVersion:0,expectedOpenAmountCents:order.invoice.grossAmountCents,method:'bar',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const stale={orderIds:[order.orderId],expectedVersions:{[order.orderId]:order.version},clientEventId:randomUUID()};
 expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),street:'TEST verified changed print source'}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>generateDeliveryNote(stale as unknown as import('@/lib/domain/deliveryNoteContract').DeliveryNoteInput))).toMatchObject({code:'VALIDATION_ERROR'});
 const {replayOfflineWorkshopAction}=await import('@/app/actions/offlineWorkshop.actions'),{offlinePartition}=await import('@/lib/server/offlinePartition');
 expect(await withSession(full,()=>replayOfflineWorkshopAction(offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId}),{kind:'workshop',command:'document.deliveryNote',id:stale.clientEventId,itemId:order.orderId,input:stale as unknown as import('@/lib/domain/deliveryNoteContract').DeliveryNoteInput,deviceCapturedAt:new Date().toISOString()}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} AND event_type IN ('DELIVERY_NOTE_ORIGINAL_V1','DELIVERY_NOTE_REQUESTED_V1')`).toEqual([{n:0}]);
 const source=await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId,includeDeliveryNoteSource:true}));
 if(source.code!=='OK'||source.deliveryNoteSource?.code!=='OK')throw Error('TEST_S10_PRINT_SOURCE_REQUIRED');
 const retry={...source.deliveryNoteSource.source,clientEventId:stale.clientEventId};
 expect(await withSession(full,()=>generateDeliveryNote(retry))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>generateDeliveryNote(JSON.parse(JSON.stringify(retry)) as typeof retry))).toMatchObject({code:'OK',replayed:true});
});

it('KORR S10-2 an unsupported SVG logo is omitted once and a real queued PDF succeeds without repeating the failed logo',async()=>{
 const order=await readyInvoiceOrder('TEST S10 unsupported SVG logo');
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:order.invoice.invoiceId,amount:order.invoice.grossAmountCents,expectedVersion:0,method:'bar',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const [before]=await sql`SELECT logo_url FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const warning=vi.spyOn(console,'warn');
 try{
  await sql`UPDATE public.company_settings SET logo_url=${'data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>').toString('base64')} WHERE tenant_id=${KREILE_TENANT_SLUG}`;
  const read=await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId,includeDeliveryNoteSource:true}));if(read.code!=='OK'||read.deliveryNoteSource?.code!=='OK')throw Error('TEST_S10_SVG_SOURCE');
  const input={...read.deliveryNoteSource.source,clientEventId:randomUUID()};
  const {replayOfflineWorkshopAction}=await import('@/app/actions/offlineWorkshop.actions'),{offlinePartition}=await import('@/lib/server/offlinePartition');
  const scope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId}),entry={kind:'workshop' as const,command:'document.deliveryNote' as const,id:input.clientEventId,itemId:order.orderId,input,deviceCapturedAt:new Date().toISOString()};
  const result=await withSession(full,()=>replayOfflineWorkshopAction(scope,entry));expect(result).toMatchObject({code:'OK',documentCommand:'document.deliveryNote'});if(result.code!=='OK'||!('pdfBase64'in result))throw Error('TEST_S10_SVG_ORIGINAL');
  expect(Buffer.from(result.pdfBase64 as string,'base64').toString('latin1')).not.toContain('/Subtype /Image');
  const count=()=>warning.mock.calls.filter(args=>args[0]==='[DELIVERY_NOTE_LOGO_SKIPPED]').length;expect(count()).toBe(1);
  expect(await withSession(full,()=>replayOfflineWorkshopAction(scope,JSON.parse(JSON.stringify(entry))))).toMatchObject({code:'OK',replayed:true,pdfBase64:result.pdfBase64});expect(count()).toBe(1);
 }finally{warning.mockRestore();await sql`UPDATE public.company_settings SET logo_url=${before.logo_url} WHERE tenant_id=${KREILE_TENANT_SLUG}`;}
});
