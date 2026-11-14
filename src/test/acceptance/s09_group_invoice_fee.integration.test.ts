// @vitest-environment node
// A09-2: real preparation, shared shipment writer, concurrent invoice originals.
import {createHash,randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {readyOrderForInvoice} from '../../../e2e/ablauf/orderFixture';
import {saveManualTrackingAction} from '@/app/actions/orders.actions';
import {issueInvoiceAction,getInvoiceReceiptAction} from '@/app/actions/invoices.actions';
import {readShippingSettingsAction,saveShippingSettingsAction} from '@/app/actions/settings.actions';

beforeAll(()=>{const url=process.env.DATABASE_URL;if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1')throw Error('TEST_S09_LOOPBACK_REQUIRED');});

it('A09-2 concurrent actual group invoices charge one fee and retain the original invoice reference on fresh retry',async()=>{
 const a=await readyOrderForInvoice('TEST S09 group invoice A','shipping'),b=await readyOrderForInvoice('TEST S09 group invoice B','shipping',a.customerId);
 const group=await withSession(full,()=>saveManualTrackingAction({orderId:a.orderId,shipmentId:randomUUID(),expectedUpdatedAt:null,trackingNumber:'72345678901234',allowFormatMismatch:false,reason:null,clientEventId:randomUUID(),withOrder:{orderId:b.orderId,shipmentId:null,expectedUpdatedAt:null}}));
 expect(group).toMatchObject({code:'OK'});if(group.code!=='OK'||!group.receipt.sendungId)throw Error('TEST_REAL_SHIPMENT_GROUP_REQUIRED');
 const requests=[a,b].map(order=>({orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()}));
 const results=await Promise.all(requests.map(request=>withSession(full,()=>issueInvoiceAction(request))));
 expect(results.map(result=>result.code)).toEqual(['OK','OK']);
 const rows=await sql<{id:string;order_id:string;invoice_number:string;snapshot:{lines:Array<{type:string;name:string;amountCents:number;shipmentGroupId?:string}>};pdf_content:Buffer;pdf_sha256:string}[]>`SELECT id::text,order_id,invoice_number,snapshot,pdf_content,pdf_sha256 FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id IN (${a.orderId},${b.orderId}) ORDER BY invoice_number`;
 expect(rows).toHaveLength(2);
 const originals=rows.map(row=>({...row,fees:row.snapshot.lines.filter((line:{type:string})=>line.type==='SHIPPING')}));
 expect(originals.flatMap(row=>row.fees).reduce((sum:number,line:{amountCents:number})=>sum+line.amountCents,0)).toBe(1000);
 const charged=originals.find(row=>row.fees.some((line:{amountCents:number})=>line.amountCents===1000));if(!charged)throw Error('TEST_ONE_ACTUAL_FEE_REQUIRED');
 const referenced=originals.find(row=>row.id!==charged.id)!;
 expect(referenced.fees).toEqual([expect.objectContaining({amountCents:0,name:'Versand in Rechnung '+charged.invoice_number,shipmentGroupId:'sendung:'+group.receipt.sendungId})]);
 for(const [index,request] of requests.entries()){
  const result=results[index];if(result.code!=='OK')throw Error('TEST_REAL_INVOICE_REQUIRED');
  expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(request))))).toEqual({...result,replayed:true});
  expect(await withSession(full,()=>getInvoiceReceiptAction({orderId:request.orderId,clientEventId:request.clientEventId}))).toMatchObject({code:'OK',data:{invoiceId:result.receipt.invoiceId}});
 }
 for(const row of originals)expect(createHash('sha256').update(row.pdf_content).digest('hex')).toBe(row.pdf_sha256);
 expect(await sql`SELECT id::text,pdf_sha256 FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id IN (${a.orderId},${b.orderId}) ORDER BY invoice_number`).toEqual(rows.map(row=>({id:row.id,pdf_sha256:row.pdf_sha256})));
});

it('A09-2 a suppressed first invoice event rolls back its fee; the next real invoice becomes the original and retry references it',async()=>{
 const a=await readyOrderForInvoice('TEST S09 group rollback invoice A','shipping'),b=await readyOrderForInvoice('TEST S09 group rollback invoice B','shipping',a.customerId);
 expect(await withSession(full,()=>saveManualTrackingAction({orderId:a.orderId,shipmentId:randomUUID(),expectedUpdatedAt:null,trackingNumber:'82345678901234',allowFormatMismatch:false,reason:null,clientEventId:randomUUID(),withOrder:{orderId:b.orderId,shipmentId:null,expectedUpdatedAt:null}}))).toMatchObject({code:'OK'});
 const first={orderId:a.orderId,expectedVersion:a.version,clientEventId:randomUUID()},second={orderId:b.orderId,expectedVersion:b.version,clientEventId:randomUUID()};
 const fault='test_s09_invoice_'+randomUUID().replaceAll('-','');if(!/^[A-Za-z0-9-]+$/.test(KREILE_TENANT_SLUG))throw Error('TEST_TENANT_LITERAL_INVALID');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.client_event_id='${first.clientEventId}'::uuid AND NEW.event_type IN ('INVOICE_CREATED_V1','INVOICE_CREATED_V2') THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{
  expect(await withSession(full,()=>issueInvoiceAction(first))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${a.orderId}`).toEqual([{n:0}]);
 }finally{await sql.unsafe(`DROP TRIGGER ${fault} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);}
 const original=await withSession(full,()=>issueInvoiceAction(second));expect(original).toMatchObject({code:'OK'});if(original.code!=='OK')throw Error('TEST_FEE_ORIGINAL_REQUIRED');
 const retried=await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(first))));expect(retried).toMatchObject({code:'OK',replayed:false});if(retried.code!=='OK')throw Error('TEST_FEE_RETRY_REQUIRED');
 const rows=await sql`SELECT order_id,snapshot,pdf_sha256 FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id IN (${a.orderId},${b.orderId})`;
 expect(rows.flatMap(row=>row.snapshot.lines).filter((line:{type:string})=>line.type==='SHIPPING').reduce((sum:number,line:{amountCents:number})=>sum+line.amountCents,0)).toBe(1000);
 expect(rows.find(row=>row.order_id===a.orderId)!.snapshot.lines).toContainEqual(expect.objectContaining({type:'SHIPPING',amountCents:0,name:'Versand in Rechnung '+original.receipt.invoiceNumber}));
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(first))))).toEqual({...retried,replayed:true});
});

it('A09-1 multiple distinct real parcels remain distinct fee sources in one invoice',async()=>{
 const order=await readyOrderForInvoice('TEST S09 two distinct parcels','shipping');
 for(const trackingNumber of ['92345678901234','93345678901234'])expect(await withSession(full,()=>saveManualTrackingAction({orderId:order.orderId,shipmentId:randomUUID(),expectedUpdatedAt:null,trackingNumber,allowFormatMismatch:false,reason:null,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const request={orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()},issued=await withSession(full,()=>issueInvoiceAction(request));expect(issued).toMatchObject({code:'OK'});if(issued.code!=='OK')throw Error('TEST_MULTIPLE_PARCELS_INVOICE');
 const [original]=await sql`SELECT snapshot FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${issued.receipt.invoiceId}::uuid`;
 const lines=original.snapshot.lines.filter((line:{type:string})=>line.type==='SHIPPING');expect(lines).toHaveLength(2);expect(lines.map((line:{amountCents:number})=>line.amountCents)).toEqual([1000,1000]);expect(new Set(lines.map((line:{shipmentGroupId:string})=>line.shipmentGroupId)).size).toBe(2);
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(request))))).toEqual({...issued,replayed:true});
});

it('A09-2 later empty fee settings preserve the actual already issued group reference and original bytes',async()=>{
 const a=await readyOrderForInvoice('TEST S09 group setting A','shipping'),b=await readyOrderForInvoice('TEST S09 group setting B','shipping',a.customerId);
 expect(await withSession(full,()=>saveManualTrackingAction({orderId:a.orderId,shipmentId:randomUUID(),expectedUpdatedAt:null,trackingNumber:'94345678901234',allowFormatMismatch:false,reason:null,clientEventId:randomUUID(),withOrder:{orderId:b.orderId,shipmentId:null,expectedUpdatedAt:null}}))).toMatchObject({code:'OK'});
 const first=await withSession(full,()=>issueInvoiceAction({orderId:a.orderId,expectedVersion:a.version,clientEventId:randomUUID()}));expect(first).toMatchObject({code:'OK'});if(first.code!=='OK')throw Error('TEST_FEE_FIRST_ORIGINAL');
 const [original]=await sql`SELECT snapshot,pdf_sha256 FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${first.receipt.invoiceId}::uuid`;
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('TEST_FEE_CURRENT_SETTINGS');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberPattern:settings.settings.numberPattern,numberHint:settings.settings.numberHint,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,shippingFeeCents:null}))).toMatchObject({code:'OK'});
 const request={orderId:b.orderId,expectedVersion:b.version,clientEventId:randomUUID()},second=await withSession(full,()=>issueInvoiceAction(request));expect(second).toMatchObject({code:'OK'});if(second.code!=='OK')throw Error('TEST_FEE_SECOND_ORIGINAL');
 const [stored]=await sql`SELECT snapshot FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${second.receipt.invoiceId}::uuid`;
 expect(stored.snapshot.lines).toContainEqual(expect.objectContaining({type:'SHIPPING',amountCents:0,name:'Versand in Rechnung '+first.receipt.invoiceNumber}));
 expect(await sql`SELECT snapshot,pdf_sha256 FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${first.receipt.invoiceId}::uuid`).toEqual([original]);
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(request))))).toEqual({...second,replayed:true});
});
