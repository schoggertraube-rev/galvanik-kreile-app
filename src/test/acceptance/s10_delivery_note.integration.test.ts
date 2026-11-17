// @vitest-environment node
// TEST only: existing Actions/Auth/DB/Storage/rendering are real. No carrier,
// invoice, payment or PDF substitute is used for these original round trips.
import {randomUUID,createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,withRequest,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder,deliveryNoteInputFixture} from '../../../e2e/ablauf/orderFixture';
import {generateDeliveryNote} from '@/app/actions/pdf.actions';
import {confirmPaymentAction} from '@/app/actions/payments.actions';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

it('A10-4/5 paid invoice produces one real immutable-byte delivery original, never a new payment or receivable',async()=>{
 const url=process.env.DATABASE_URL;if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1')throw Error('TEST_S10_LOOPBACK_REQUIRED');
 const order=await readyInvoiceOrder('TEST S10 bezahlter Lieferschein');
 const paid=await withSession(full,()=>confirmPaymentAction({invoiceId:order.invoice.invoiceId,amount:order.invoice.grossAmountCents,method:'bar',expectedVersion:0,expectedOpenAmountCents:order.invoice.grossAmountCents,clientEventId:randomUUID()}));
 expect(paid).toMatchObject({code:'OK'});if(paid.code!=='OK')throw Error('TEST_S10_REAL_PAYMENT');
 const invoiceBefore=await sql`SELECT id,status,gross_amount_cents,payment_paid_amount_cents,payment_version,pdf_sha256 FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const paymentsBefore=await sql`SELECT id,payload FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='PAYMENT_CONFIRMED_V1' ORDER BY id`;
 const input=await deliveryNoteInputFixture([order.orderId]);
 const [created,retry]=await Promise.all([withSession(full,()=>generateDeliveryNote(input)),withSession(full,()=>generateDeliveryNote(JSON.parse(JSON.stringify(input)) as typeof input))]);
 expect(created,JSON.stringify(created.code==='OK'?created.receipt:created)).toMatchObject({code:'OK'});
 expect(retry).toMatchObject({code:'OK'});if(created.code!=='OK'||retry.code!=='OK')throw Error('TEST_S10_REAL_DELIVERY_ORIGINAL');
 expect(retry.pdfBase64).toBe(created.pdfBase64);expect(retry.receipt.originalEventId).toBe(created.receipt.originalEventId);
 expect(createHash('sha256').update(Buffer.from(created.pdfBase64,'base64')).digest('hex')).toBe(created.receipt.pdfSha256);
 const read=await withSession(full,()=>generateDeliveryNote(order.orderId));expect(read).toBe(created.pdfBase64);
 expect(await withSession(full,()=>generateDeliveryNote({...input,clientEventId:randomUUID()}))).toMatchObject({code:'OK',receipt:{originalEventId:created.receipt.originalEventId}});
 expect(await withSession(full,()=>generateDeliveryNote({...input,expectedVersions:{[order.orderId]:order.version+1}}))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='DELIVERY_NOTE_ORIGINAL_V1'`).toEqual([{n:1}]);
 expect(await sql`SELECT id,status,gross_amount_cents,payment_paid_amount_cents,payment_version,pdf_sha256 FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual(invoiceBefore);
 expect(await sql`SELECT id,payload FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='PAYMENT_CONFIRMED_V1' ORDER BY id`).toEqual(paymentsBefore);
 const [original]=await sql`SELECT payload FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${created.receipt.originalEventId}`;
 expect(original.payload.snapshot.orders[0].payments).toMatchObject([{invoiceId:order.invoice.invoiceId,amountCents:order.invoice.grossAmountCents,paymentEventId:paid.receipt.eventId}]);
 const pdfTask=getDocument({data:new Uint8Array(Buffer.from(created.pdfBase64,'base64')),useSystemFonts:true});const pdf=await pdfTask.promise;
 const page=await pdf.getPage(1);const content=await page.getTextContent();
 const text=content.items.map(item=>'str'in item?item.str:'').join(' ');
 expect(text).toContain('Lieferschein');expect(text).toContain(order.invoice.invoiceNumber);expect(text).toContain('119,00');
 const day=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(original.payload.snapshot.orders[0].payments[0].paidAt));
 expect(text).toContain(day);await pdfTask.destroy();
 for(const id of [created.receipt.originalEventId,created.receipt.eventId]){
  await expect(sql`UPDATE public.events SET payload='{}'::jsonb WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${id}`).rejects.toMatchObject({code:'P0001',message:'GoBD: Audit-Log ist append-only. Änderungen/Löschungen sind nicht erlaubt.'});
  await expect(sql`DELETE FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${id}`).rejects.toMatchObject({code:'P0001',message:'GoBD: Audit-Log ist append-only. Änderungen/Löschungen sind nicht erlaubt.'});
  await expect(sql`UPDATE public.events SET event_type='TEST_S10_RETYPE' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${id}`).rejects.toMatchObject({code:'P0001',message:'GoBD: Audit-Log ist append-only. Änderungen/Löschungen sind nicht erlaubt.'});
 }
 writeFileSync('.git/kreile-s10-delivery-note-paid.pdf',Buffer.from(created.pdfBase64,'base64'));
 writeFileSync('.git/kreile-s10-delivery-note-paid-proof.json',JSON.stringify({at:new Date().toISOString(),tenant:KREILE_TENANT_SLUG,receipt:created.receipt,text,source:original.payload.snapshot},null,2));
});

it('N8 denies real missing rights/session and unpaid sources without writing a document',async()=>{
 const order=await readyInvoiceOrder('TEST S10 Lieferschein Rechte');
 // Explicit malformed envelope tests validation separately from the real unpaid source.
 const input={orderIds:[order.orderId],clientEventId:randomUUID(),expectedVersions:{[order.orderId]:order.version}} as unknown as import('@/lib/domain/deliveryNoteContract').DeliveryNoteInput;
 const moneyOnly=await createFixture(['preise','zahlungen','buchhaltung']),goodsOnly=await createFixture(['auftraege']);
 expect(await withSession(moneyOnly,()=>generateDeliveryNote(input))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(goodsOnly,()=>generateDeliveryNote(input))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await withRequest('',()=>generateDeliveryNote(input))).toMatchObject({code:'UNAUTHENTICATED'});
 expect(await withSession(full,()=>generateDeliveryNote(input))).toMatchObject({code:'VALIDATION_ERROR'});
 // Existing string adapter captures the real canonical unpaid source, with no fake hashes.
 await expect(withSession(goodsOnly,()=>generateDeliveryNote(order.orderId))).rejects.toThrow('Für diesen Auftrag ist noch keine Rechnung bezahlt.');
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} AND event_type IN ('DELIVERY_NOTE_ORIGINAL_V1','DELIVERY_NOTE_REQUESTED_V1')`).toEqual([{n:0}]);
 const {getOrderPaymentStateAction}=await import('@/app/actions/payments.actions');
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId,includeDeliveryNoteSource:true}))).toMatchObject({code:'OK',deliveryNoteSource:{code:'VALIDATION_ERROR'}});
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:order.invoice.invoiceId,amount:order.invoice.grossAmountCents,method:'bar',expectedVersion:0,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const own=await deliveryNoteInputFixture([order.orderId]);
 // Explicit synthetic source in a different TEST tenant, not a nonexistent ID.
 // A real signed login for this tenant must never obtain that source.
 const foreignTenant='TEST-ablauf-'+randomUUID(),foreignCustomer=randomUUID(),foreignOrder=randomUUID();
 await sql`INSERT INTO public.customers(id,tenant_id,name,type) VALUES(${foreignCustomer},${foreignTenant},'TEST S10 fremder Kunde','privat')`;
 await sql`INSERT INTO public.orders(id,tenant_id,customer_id,order_number,title,station,current_station,current_station_id,status) VALUES(${foreignOrder},${foreignTenant},${foreignCustomer},${'TEST-S10-'+foreignOrder},'TEST S10 fremder Auftrag','angenommen','angenommen','angenommen','angenommen')`;
 expect(await sql`SELECT tenant_id FROM public.orders WHERE id=${foreignOrder}`).toEqual([{tenant_id:foreignTenant}]);
 expect(await withSession(full,()=>generateDeliveryNote({orderIds:[foreignOrder],expectedVersions:{[foreignOrder]:1},expectedSources:{[foreignOrder]:own.expectedSources[order.orderId]},clientEventId:randomUUID()}))).toMatchObject({code:'NOT_FOUND'});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE order_id=${foreignOrder} AND event_type IN ('DELIVERY_NOTE_ORIGINAL_V1','DELIVERY_NOTE_REQUESTED_V1')`).toEqual([{n:0}]);
});

it('N8 a missing SQL receipt retains the secured original bytes and the same request retries without a second payment',async()=>{
 const order=await readyInvoiceOrder('TEST S10 fehlender SQL-Nachbeleg');
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:order.invoice.invoiceId,amount:order.invoice.grossAmountCents,method:'bar',expectedVersion:0,expectedOpenAmountCents:order.invoice.grossAmountCents,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const storage=await import('@/lib/server/domainAttachmentStorage');
 const observed=vi.spyOn(storage,'storeDomainAttachmentBytes'); // observes the real, unchanged implementation
 const input=await deliveryNoteInputFixture([order.orderId]);
 const suffix=randomUUID().replaceAll('-',''),fn='test_s10_request_'+suffix,trigger='test_s10_request_'+suffix;
 if(!/^TEST-ablauf-[a-f0-9-]+$/.test(KREILE_TENANT_SLUG))throw Error('TEST_S10_TENANT_REQUIRED');
 // TEST-only SQL fault, restricted to this exact original key. No protected
 // event is edited; the real command must notice the missing INSERT receipt.
 await sql.unsafe(`CREATE FUNCTION private.${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='DELIVERY_NOTE_REQUESTED_V1' AND NEW.client_event_id='${input.clientEventId}'::uuid THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${fn}()`);
 let secured:{path:string;pdfBase64:string;pdfSha256:string}|null=null;
 try{
  expect(await withSession(full,()=>generateDeliveryNote(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(observed).toHaveBeenCalledTimes(1);
  const [path,bytes]=observed.mock.calls[0],envelope=JSON.parse(Buffer.from(bytes).toString('utf8'));
  secured={path,pdfBase64:envelope.pdfBase64,pdfSha256:envelope.pdfSha256};
  const actual=await storage.readExistingDomainAttachment(path);expect(Buffer.from(actual.bytes)).toEqual(Buffer.from(bytes));
  expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} AND event_type IN ('DELIVERY_NOTE_ORIGINAL_V1','DELIVERY_NOTE_REQUESTED_V1')`).toEqual([{n:0}]);
 }finally{await sql.unsafe(`DROP TRIGGER IF EXISTS ${trigger} ON public.events`);await sql.unsafe(`DROP FUNCTION IF EXISTS private.${fn}()`);}
 if(!secured)throw Error('TEST_S10_SECURED_ORIGINAL_REQUIRED');
 const retried=await withSession(full,()=>generateDeliveryNote(JSON.parse(JSON.stringify(input)) as typeof input));
 expect(retried).toMatchObject({code:'OK',pdfBase64:secured.pdfBase64,receipt:{pdfSha256:secured.pdfSha256,storagePath:secured.path}});
 expect(observed).toHaveBeenCalledTimes(1);
 expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}`).toEqual([{n:1}]);
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} AND event_type='PAYMENT_CONFIRMED_V1'`).toEqual([{n:1}]);
});
