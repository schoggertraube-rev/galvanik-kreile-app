// @vitest-environment node
// PL19:24 bounded S10 correction tests: actual Auth/Actions/DB/Storage/PDF.
// Master-data gaps/ambiguity are explicit isolated TEST starting facts only.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {SALES_STAGE_FEATURES} from '@/modules/fundament/public';
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {getOrderPaymentStateAction,confirmPaymentAction} from '@/app/actions/payments.actions';
import {generateDeliveryNote} from '@/app/actions/pdf.actions';
import {replayOfflineWorkshopAction} from '@/app/actions/offlineWorkshop.actions';
import {offlinePartition} from '@/lib/server/offlinePartition';
async function paid(label:string){const order=await readyInvoiceOrder(label);expect(await withSession(full,()=>confirmPaymentAction({invoiceId:order.invoice.invoiceId,amount:order.invoice.grossAmountCents,expectedVersion:0,method:'bar',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});return order;}
const request=(order:{orderId:string;version:number})=>({orderIds:[order.orderId],clientEventId:randomUUID(),expectedVersions:{[order.orderId]:order.version}});
async function textOf(base64:string){const task=getDocument({data:new Uint8Array(Buffer.from(base64,'base64')),useSystemFonts:true});try{const pdf=await task.promise;const text=[];for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent();text.push(content.items.map(item=>'str'in item?item.str:'').join(' '));}return text.join(' ');}finally{await task.destroy();}}
it('KORR19:24-1 source-specific company, address and mixed-customer errors preserve the real settings/customer escape without document effects',async()=>{
 const order=await paid('TEST S10 review source causes'),input=request(order);
 // Isolated TEST tenant: seed the complete canonical settings feature set.
 for(const feature of SALES_STAGE_FEATURES)await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES(${KREILE_TENANT_SLUG},${feature.id},${feature.defaultEnabled}) ON CONFLICT(tenant,feature_id) DO NOTHING`;
 const [company]=await sql`SELECT street FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 await sql`UPDATE public.company_settings SET street=NULL WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 try{
  const result=await withSession(full,()=>generateDeliveryNote(input));
  expect(result).toMatchObject({code:'VALIDATION_ERROR',message:'Firmendaten fehlen. Trag sie in den Einstellungen ein.',remedy:{href:'/settings#company-street',field:'street',funktion:'readSettingsAction'}});
  const {readSettingsAction}=await import('@/app/actions/settings.actions');expect(await withSession(full,()=>readSettingsAction())).toMatchObject({code:'OK',snapshot:{company:{street:null}}});
 }finally{await sql`UPDATE public.company_settings SET street=${company.street} WHERE tenant_id=${KREILE_TENANT_SLUG}`;}
 await sql`UPDATE public.customers SET street=NULL WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.customerId}`;
 try{
  const result=await withSession(full,()=>generateDeliveryNote(input));
  expect(result).toMatchObject({code:'VALIDATION_ERROR',message:'Straße fehlt beim Kunden. Trag es in den Kundendaten ein.',remedy:{field:'street',funktion:'getCustomerSummaryAction',argumente:{customerId:order.customerId}}});
 }finally{await sql`UPDATE public.customers SET street='TEST Weg' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.customerId}`;}
 const other=await paid('TEST S10 other customer');
 const mixed={orderIds:[order.orderId,other.orderId],expectedVersions:{[order.orderId]:order.version,[other.orderId]:other.version},clientEventId:randomUUID()};
 expect(await withSession(full,()=>generateDeliveryNote(mixed))).toMatchObject({code:'VALIDATION_ERROR',message:'Ein Lieferschein gilt für einen Kunden. Wähle nur dessen Aufträge.'});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=ANY(${[input.clientEventId,mixed.clientEventId]}::uuid[])`).toEqual([{n:0}]);
 expect(await withSession(full,()=>generateDeliveryNote(JSON.parse(JSON.stringify(input)) as typeof input))).toMatchObject({code:'OK'});
});
it('KORR19:24-1 an unreadable real company source stays retryable and never creates a conflict task',async()=>{
 const order=await paid('TEST S10 ambiguous company'),input=request(order),duplicate=randomUUID();
 const original={kind:'workshop' as const,command:'document.deliveryNote' as const,id:input.clientEventId,itemId:order.orderId,input,deviceCapturedAt:new Date().toISOString()};
 const scope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId});
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,street,zip,city,country) VALUES(${duplicate}::uuid,${KREILE_TENANT_SLUG},'TEST S10 duplicate company','TEST Weg 2','70176','Stuttgart','Deutschland')`;
 try{
  expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId,includeDeliveryNoteSource:true}))).toMatchObject({code:'OK',data:expect.anything(),deliveryNoteSource:{code:'UNAVAILABLE'}});
  const result=await withSession(full,()=>replayOfflineWorkshopAction(scope,original));
  expect(result).toMatchObject({code:'UNAVAILABLE',message:expect.stringContaining('Lieferschein ist noch nicht abgeschlossen.')});
  expect(result).not.toHaveProperty('rejectionReceipt');
  expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} AND event_type IN ('DELIVERY_NOTE_REQUESTED_V1','OFFLINE_WORKSHOP_REJECTED_V1','OFFLINE_WORKSHOP_REJECTED_TASK_V1')`).toEqual([{n:0}]);
 }finally{await sql`DELETE FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${duplicate}`;}
 const result=await withSession(full,()=>replayOfflineWorkshopAction(scope,JSON.parse(JSON.stringify(original))));expect(result).toMatchObject({code:'OK',documentCommand:'document.deliveryNote'});
 expect(await withSession(full,()=>replayOfflineWorkshopAction(scope,JSON.parse(JSON.stringify(original))))).toMatchObject({code:'OK',replayed:true});
});
it('KORR19:24-3 actual PDFs retain both signature fields and configured logo/contact/VAT; absent optional identity omits only its line',async()=>{
 const order=await paid('TEST S10 company identity');
 const [before]=await sql`SELECT phone,tax_id,logo_url FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 try{
  await sql`UPDATE public.company_settings SET phone='TEST 0711 1234',tax_id='DE123456789',logo_url='/logo.png' WHERE tenant_id=${KREILE_TENANT_SLUG}`;
  const result=await withSession(full,()=>generateDeliveryNote(request(order)));expect(result).toMatchObject({code:'OK'});if(result.code!=='OK')throw Error('TEST_S10_RENDER');
  const text=await textOf(result.pdfBase64);expect(text).toContain('Übergabe (Firma)');expect(text).toContain('Übernahme (Kunde)');expect(text).toContain('TEST 0711 1234');expect(text).toContain('DE123456789');expect(Buffer.from(result.pdfBase64,'base64').toString('latin1')).toContain('/Subtype /Image');
  await sql`UPDATE public.company_settings SET phone=NULL,tax_id=NULL,logo_url=NULL WHERE tenant_id=${KREILE_TENANT_SLUG}`;
  const plain=await withSession(full,()=>generateDeliveryNote(request(order)));expect(plain).toMatchObject({code:'OK'});if(plain.code!=='OK')throw Error('TEST_S10_RENDER_OPTIONAL');
  const plainText=await textOf(plain.pdfBase64);expect(plainText).toContain('Übergabe (Firma)');expect(plainText).toContain('Übernahme (Kunde)');expect(plainText).not.toContain('TEST 0711 1234');expect(plainText).not.toContain('DE123456789');
  const {writeFileSync}=await import('node:fs');writeFileSync('.git/kreile-s10-delivery-note-review.pdf',Buffer.from(result.pdfBase64,'base64'));
 }finally{await sql`UPDATE public.company_settings SET phone=${before.phone},tax_id=${before.tax_id},logo_url=${before.logo_url} WHERE tenant_id=${KREILE_TENANT_SLUG}`;}
});

async function currentRequest(orderId:string){
 const read=await withSession(full,()=>getOrderPaymentStateAction({orderId,includeDeliveryNoteSource:true}));
 expect(read).toMatchObject({code:'OK',deliveryNoteSource:{code:'OK'}});
 if(read.code!=='OK'||read.deliveryNoteSource?.code!=='OK')throw Error('TEST_S10_CANONICAL_DOCUMENT_SOURCE');
 return {...read.deliveryNoteSource.source,clientEventId:randomUUID()};
}
it('KORR19:24-2 a real physical station/version change preserves the same printed original and financial source',async()=>{
 const order=await paid('TEST S10 station is not content'),input=await currentRequest(order.orderId);
 const original=await withSession(full,()=>generateDeliveryNote(input));expect(original).toMatchObject({code:'OK'});if(original.code!=='OK')throw Error('TEST_S10_FIRST_ORIGINAL');
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 expect(await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,expectedVersion:order.version,mode:'abholung',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const next={...input,clientEventId:randomUUID()};
 const result=await withSession(full,()=>generateDeliveryNote(next));expect(result).toMatchObject({code:'OK',receipt:{originalEventId:original.receipt.originalEventId},pdfBase64:original.pdfBase64});
 expect(await withSession(full,()=>generateDeliveryNote(JSON.parse(JSON.stringify(next))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} AND event_type='DELIVERY_NOTE_ORIGINAL_V1'`).toEqual([{n:1}]);
});
it('KORR19:24-2 a real customer-address edit rejects stale printed facts, fresh source retries, and old N5 retains exact original bytes',async()=>{
 const order=await paid('TEST S10 printed address change'),input=await currentRequest(order.orderId);
 const original=await withSession(full,()=>generateDeliveryNote(input));if(original.code!=='OK')throw Error('TEST_S10_BEFORE_ADDRESS');
 const {updateCustomerAction}=await import('@/app/actions/customers.actions');
 expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),street:'TEST Neuer Quellenweg'}))).toMatchObject({code:'OK'});
 const stale={...input,clientEventId:randomUUID()};
 expect(await withSession(full,()=>generateDeliveryNote(stale))).toMatchObject({code:'CONFLICT',message:'Der Auftrag hat sich geändert. Lade ihn neu und erzeuge den Lieferschein erneut.'});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${stale.clientEventId}::uuid`).toEqual([{n:0}]);
 const fresh={...await currentRequest(order.orderId),clientEventId:stale.clientEventId};
 expect(await withSession(full,()=>generateDeliveryNote(fresh))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>generateDeliveryNote(JSON.parse(JSON.stringify(fresh))))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(full,()=>generateDeliveryNote(input))).toMatchObject({code:'OK',replayed:true,pdfBase64:original.pdfBase64});
});
it('KORR19:24-2 actual paid-invoice cancellation rejects a changed payment/invoice source without a new original',async()=>{
 const order=await paid('TEST S10 changed invoice source'),input=await currentRequest(order.orderId);
 const original=await withSession(full,()=>generateDeliveryNote(input));if(original.code!=='OK')throw Error('TEST_S10_BEFORE_CANCELLATION');
 const {cancelInvoiceAction}=await import('@/app/actions/invoices.actions');
 expect(await withSession(full,()=>cancelInvoiceAction({invoiceId:order.invoice.invoiceId,expectedVersion:1,reason:'TEST S10 changed source',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const stale={...input,clientEventId:randomUUID()};expect(await withSession(full,()=>generateDeliveryNote(stale))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${stale.clientEventId}::uuid`).toEqual([{n:0}]);
 expect(await withSession(full,()=>generateDeliveryNote(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,pdfBase64:original.pdfBase64});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} AND event_type='DELIVERY_NOTE_ORIGINAL_V1'`).toEqual([{n:1}]);
});
