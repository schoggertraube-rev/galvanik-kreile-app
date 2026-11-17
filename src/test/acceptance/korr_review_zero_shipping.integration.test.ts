// @vitest-environment node
// K4: real settings/invoice/read ports and number sequence; isolated TEST tenant only.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {full,sql,withSession} from '../../../e2e/ablauf/replayHarness';
import {readyOrderForInvoice} from '../../../e2e/ablauf/orderFixture';
import {readShippingSettingsAction,saveShippingSettingsAction} from '@/app/actions/settings.actions';
import {issueInvoiceAction,getInvoiceReceiptAction} from '@/app/actions/invoices.actions';
import {getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {replayOfflineWorkshopAction} from '@/app/actions/offlineWorkshop.actions';
import {offlinePartition} from '@/lib/server/offlinePartition';
async function fee(shippingFeeCents:number|null){
 const current=await withSession(full,()=>readShippingSettingsAction());if(current.code!=='OK')throw Error('TEST_K4_SETTINGS_SOURCE');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:current.settings.service,numberPattern:current.settings.numberPattern,numberHint:current.settings.numberHint,trackingUrl:current.settings.trackingUrl,expectedUpdatedAt:current.settings.updatedAt,shippingFeeCents}))).toMatchObject({code:'OK'});
}
it('K4 zero standard fee offers no extra invoice; direct zero is rejected without using a number or changing the original',async()=>{
 const order=await readyOrderForInvoice('TEST K4 zero shipping','shipping');await fee(null);
 const issued=await withSession(full,()=>issueInvoiceAction({orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()}));
 expect(issued).toMatchObject({code:'OK'});if(issued.code!=='OK')throw Error('TEST_K4_REAL_INVOICE');
 const receiptInput={orderId:order.orderId,clientEventId:issued.receipt.clientEventId};
 const original=await withSession(full,()=>getInvoiceReceiptAction(receiptInput));
 expect(original).toMatchObject({code:'OK',data:{invoiceId:issued.receipt.invoiceId}});await fee(0);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{handoverConsequences:{code:'OK',feeCents:0,additionalInvoices:[]}}});
 const numbers=await sql`SELECT invoice_year,last_number FROM private.invoice_number_sequences WHERE tenant_id=${KREILE_TENANT_SLUG} ORDER BY invoice_year`;
 const input={orderId:order.orderId,expectedVersion:issued.receipt.orderVersion,clientEventId:randomUUID(),shippingCosts:{invoiceId:issued.receipt.invoiceId,expectedVersion:1,scope:'order:'+order.orderId,expectedFeeCents:0}};
 for(const value of [input,JSON.parse(JSON.stringify(input))])expect(await withSession(full,()=>issueInvoiceAction(value))).toMatchObject({code:'VALIDATION_ERROR',message:'Versandkosten sind 0 € – keine Zusatzrechnung nötig'});
 expect(await sql`SELECT invoice_year,last_number FROM private.invoice_number_sequences WHERE tenant_id=${KREILE_TENANT_SLUG} ORDER BY invoice_year`).toEqual(numbers);
 expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}`).toEqual([{n:1}]);
 expect(await withSession(full,()=>getInvoiceReceiptAction(receiptInput))).toEqual(original);
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{n:0}]);
 // Explicit historical queued-zero boundary: do not quarantine/drop its bytes.
 // The existing reconciliation preserves the real rejection and one normal task.
 const originalEntry={id:input.clientEventId,itemId:order.orderId,kind:'workshop' as const,command:'invoice.issue' as const,input,deviceCapturedAt:new Date().toISOString()};
 const scope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId});
 const preserved=await withSession(full,()=>replayOfflineWorkshopAction(scope,originalEntry));
 expect(preserved,JSON.stringify(preserved)).toMatchObject({code:'PRESERVED',replayed:false,rejectionReceipt:{actorId:full.actorId,clientEventId:input.clientEventId}});
 expect(await withSession(full,()=>replayOfflineWorkshopAction(scope,JSON.parse(JSON.stringify(originalEntry))))).toMatchObject({code:'PRESERVED',replayed:true});
 expect(await sql`SELECT invoice_year,last_number FROM private.invoice_number_sequences WHERE tenant_id=${KREILE_TENANT_SLUG} ORDER BY invoice_year`).toEqual(numbers);
 expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}`).toEqual([{n:1}]);
});
