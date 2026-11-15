// @vitest-environment node
// R3 / PL19:24: real paid originals for one customer's multiple selected orders.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {getOrderPaymentStateAction,confirmPaymentAction} from '@/app/actions/payments.actions';
import {generateDeliveryNote} from '@/app/actions/pdf.actions';
it('S10 R3 zero selection is rejected; two paid orders of the same customer produce one PDF with both actual payment originals and no new booking',async()=>{
 expect(await withSession(full,()=>generateDeliveryNote({orderIds:[],expectedVersions:{},expectedSources:{},clientEventId:randomUUID()}))).toMatchObject({code:'VALIDATION_ERROR'});
 const a=await readyInvoiceOrder('TEST S10 same customer A'),b=await readyInvoiceOrder('TEST S10 same customer B','pickup',false,a.customerId);
 const input:{orderIds:string[];expectedVersions:Record<string,number>;expectedSources:Record<string,{paymentHash:string;contentHash:string}>;clientEventId:string}={orderIds:[b.orderId,a.orderId],expectedVersions:{},expectedSources:{},clientEventId:randomUUID()};
 for(const order of [a,b]){
  expect(await withSession(full,()=>confirmPaymentAction({invoiceId:order.invoice.invoiceId,amount:order.invoice.grossAmountCents,expectedVersion:0,expectedOpenAmountCents:order.invoice.grossAmountCents,method:'bar',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  const read=await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId,includeDeliveryNoteSource:true}));
  if(read.code!=='OK'||read.deliveryNoteSource?.code!=='OK'||!read.deliveryNoteSource.source.expectedSources)throw Error('TEST_S10_MANY_SOURCE');
  Object.assign(input.expectedVersions,read.deliveryNoteSource.source.expectedVersions);Object.assign(input.expectedSources,read.deliveryNoteSource.source.expectedSources);
 }
 const before=await sql`SELECT id,status,payment_version,payment_paid_amount_cents FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} ORDER BY id`;
 const results=await Promise.all([withSession(full,()=>generateDeliveryNote(input)),withSession(full,()=>generateDeliveryNote(JSON.parse(JSON.stringify(input)) as typeof input))]);
 expect(results.every(result=>result.code==='OK')).toBe(true);const result=results[0];if(result.code!=='OK')throw Error('TEST_S10_MANY_DOCUMENT');
 expect(results[1]).toMatchObject({code:'OK',pdfBase64:result.pdfBase64,receipt:{originalEventId:result.receipt.originalEventId}});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='DELIVERY_NOTE_ORIGINAL_V1'`).toEqual([{n:1}]);
 expect(await sql`SELECT id,status,payment_version,payment_paid_amount_cents FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} ORDER BY id`).toEqual(before);
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='PAYMENT_CONFIRMED_V1'`).toEqual([{n:2}]);
 const task=getDocument({data:new Uint8Array(Buffer.from(result.pdfBase64,'base64')),useSystemFonts:true});
 try{const pdf=await task.promise,texts:string[]=[];for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent();texts.push(content.items.map(item=>'str'in item?item.str:'').join(' '));}const text=texts.join(' ');for(const order of [a,b])expect(text).toContain(order.invoice.invoiceNumber);}finally{await task.destroy();}
 expect(await withSession(full,()=>generateDeliveryNote(JSON.parse(JSON.stringify(input)) as typeof input))).toMatchObject({code:'OK',replayed:true,pdfBase64:result.pdfBase64});
});
