// @vitest-environment node
// A09-6 financial slice: real issued shipping invoice without a standard fee,
// then a real settings change. Manual handover binding is tested separately.
import {createHash,randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {readShippingSettingsAction,saveShippingSettingsAction} from '@/app/actions/settings.actions';
import {issueInvoiceAction,getInvoiceReceiptAction,cancelInvoiceAction} from '@/app/actions/invoices.actions';
import {getOrderPaymentStateAction,confirmPaymentAction,setPaymentModeAction} from '@/app/actions/payments.actions';
import {recordGoodsOutAction} from '@/app/actions/goodsOut.actions';
import {saveManualTrackingAction} from '@/app/actions/orders.actions';
beforeAll(async()=>{
 const u=process.env.DATABASE_URL;if(!u||u!==process.env.H18_EXPECTED_DATABASE_URL||new URL(u).hostname!=='127.0.0.1')throw Error('TEST_S09_LOOPBACK_REQUIRED');
 // Explicit synthetic issuer setup only; every invoice/setting below uses its real writer.
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,street,zip,city,country,iban,bic,bank_name,tax_id,invoice_vat_rate_basis_points,invoice_payment_term_days)
 VALUES(${randomUUID()}::uuid,${KREILE_TENANT_SLUG},'TEST S09 fee issuer','TEST Weg 1','70176','Stuttgart','Deutschland','DE02120300000000202051','BYLADEM1001','TEST Bank','DE123456789',1900,14)`;
});
async function fee(value:number|null){const current=await withSession(full,()=>readShippingSettingsAction());if(current.code!=='OK')throw Error('TEST_FEE_SETTINGS');expect(await withSession(full,()=>saveShippingSettingsAction({service:current.settings.service,numberPattern:current.settings.numberPattern,numberHint:current.settings.numberHint,trackingUrl:current.settings.trackingUrl,expectedUpdatedAt:current.settings.updatedAt,shippingFeeCents:value}))).toMatchObject({code:'OK'});}

it('A09-6/-8 the existing invoice writer issues one shipping-only document with its original reference, never changes the released original',async()=>{
 await fee(null);const main=await readyInvoiceOrder('TEST S09 additional shipping costs','shipping',false,undefined,10000);
 const [original]=await sql`SELECT snapshot,pdf_sha256,pdf_content,gross_amount_cents FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${main.invoice.invoiceId}::uuid`;
 expect(original.snapshot.lines.some((line:{type:string})=>line.type==='SHIPPING')).toBe(false);
 await fee(1000);
 expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${main.orderId}`).toEqual([{n:1}]);
 const request={orderId:main.orderId,expectedVersion:main.issueInput.expectedVersion,clientEventId:randomUUID(),shippingCosts:{invoiceId:main.invoice.invoiceId,expectedVersion:1,scope:'order:'+main.orderId,expectedFeeCents:1000}};
 const denied=await createFixture(['auftraege'],'werkstatt');expect(await withSession(denied,()=>issueInvoiceAction(request))).toMatchObject({code:'FORBIDDEN'});
 const issued=await withSession(full,()=>issueInvoiceAction(request));expect(issued).toMatchObject({code:'OK',replayed:false,receipt:{netAmountCents:1000,vatAmountCents:190,grossAmountCents:1190,belegart:'versandkosten',ursprungRechnungId:main.invoice.invoiceId}});if(issued.code!=='OK')throw Error('TEST_REAL_EXTRA_INVOICE_REQUIRED');
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(request))))).toEqual({...issued,replayed:true});
 const other=await createFixture(['geld'],'buero');expect(await withSession(other,()=>issueInvoiceAction(request))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>issueInvoiceAction({...request,shippingCosts:{...request.shippingCosts,expectedFeeCents:999}}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>issueInvoiceAction({...request,clientEventId:randomUUID()}))).toMatchObject({code:'CONFLICT'});
 const [stored]=await sql`SELECT belegart,ursprung_rechnung_id::text,snapshot,pdf_content,pdf_sha256 FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(stored).toMatchObject({belegart:'versandkosten',ursprung_rechnung_id:main.invoice.invoiceId});
 expect(stored.snapshot.lines).toEqual([expect.objectContaining({type:'SHIPPING',amountCents:1000,vat_rate_basis_points:1900})]);
 expect(createHash('sha256').update(stored.pdf_content).digest('hex')).toBe(stored.pdf_sha256);
 writeFileSync('.git/kreile-s09-additional-cost-original.pdf',stored.pdf_content);
 expect(await withSession(full,()=>getInvoiceReceiptAction({orderId:main.orderId,clientEventId:request.clientEventId}))).toMatchObject({code:'OK',data:{invoiceId:issued.receipt.invoiceId,grossAmountCents:1190,belegart:'versandkosten',ursprungRechnungId:main.invoice.invoiceId}});
 expect(await sql`SELECT snapshot,pdf_sha256,pdf_content,gross_amount_cents FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${main.invoice.invoiceId}::uuid`).toEqual([original]);
 expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${main.orderId} AND status='issued'`).toEqual([{n:2}]);
});

it('A09-8 a missing real additional-cost event rolls everything back; two fresh concurrent requests create one document with its own cancellation',async()=>{
 await fee(null);const main=await readyInvoiceOrder('TEST S09 shipping-cost rollback','shipping',false,undefined,10000);await fee(1000);
 const request={orderId:main.orderId,expectedVersion:main.issueInput.expectedVersion,clientEventId:randomUUID(),shippingCosts:{invoiceId:main.invoice.invoiceId,expectedVersion:1,scope:'order:'+main.orderId,expectedFeeCents:1000}};
 const fault='test_s09_cost_'+randomUUID().replaceAll('-','');if(!/^[A-Za-z0-9-]+$/.test(KREILE_TENANT_SLUG))throw Error('TEST_TENANT_LITERAL_INVALID');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.client_event_id='${request.clientEventId}'::uuid AND NEW.event_type='INVOICE_CREATED_V1' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{
  expect(await withSession(full,()=>issueInvoiceAction(request))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${main.orderId}`).toEqual([{n:1}]);
  expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${request.clientEventId}::uuid`).toEqual([{n:0}]);
 }finally{await sql.unsafe(`DROP TRIGGER ${fault} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);}
 const results=await Promise.all([request,{...request,clientEventId:randomUUID()}].map(input=>withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))));
 expect(results.map(result=>result.code).sort()).toEqual(['CONFLICT','OK']);
 const issued=results.find(result=>result.code==='OK');if(!issued||issued.code!=='OK')throw Error('TEST_COST_WINNER_REQUIRED');
 await expect(sql.begin(tx=>tx`UPDATE public.invoices SET ursprung_rechnung_id=NULL WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${issued.receipt.invoiceId}::uuid`)).rejects.toThrow();
 const cancel={invoiceId:issued.receipt.invoiceId,expectedVersion:1,reason:'TEST separate shipping-cost cancellation',clientEventId:randomUUID()};
 expect(await withSession(full,()=>cancelInvoiceAction(cancel))).toMatchObject({code:'OK',replayed:false,receipt:{invoiceId:issued.receipt.invoiceId}});
 expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(cancel))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT status FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${main.invoice.invoiceId}::uuid`).toEqual([{status:'issued'}]);
});

it('A09-6 each actual payment is visible and required: main paid alone blocks goods out, additional paid allows one physical output',async()=>{
 await fee(null);const main=await readyInvoiceOrder('TEST S09 actual two-invoice payment gate','shipping',false,undefined,10000);
 expect(await withSession(full,()=>setPaymentModeAction({orderId:main.orderId,paymentMode:'abholung',expectedVersion:0,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const before=await withSession(full,()=>getOrderPaymentStateAction({orderId:main.orderId}));if(before.code!=='OK')throw Error('TEST_COST_ACTUAL_ORDER_VERSION');await fee(1000);
 const request={orderId:main.orderId,expectedVersion:before.data.orderVersion,clientEventId:randomUUID(),shippingCosts:{invoiceId:main.invoice.invoiceId,expectedVersion:1,scope:'order:'+main.orderId,expectedFeeCents:1000}};
 const issued=await withSession(full,()=>issueInvoiceAction(request));expect(issued).toMatchObject({code:'OK'});if(issued.code!=='OK')throw Error('TEST_COST_PAYMENT_INVOICE');
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:main.orderId}))).toMatchObject({code:'OK',data:{payment:{invoiceId:main.invoice.invoiceId},additionalPayments:[{invoiceId:issued.receipt.invoiceId,openAmountCents:1190,belegart:'versandkosten',ursprungRechnungId:main.invoice.invoiceId,label:'Versandkosten zu Rechnung '+main.invoice.invoiceNumber}],goodsOutAllowed:false}});
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:main.invoice.invoiceId,amount:main.invoice.grossAmountCents,method:'bar',expectedVersion:0,expectedOpenAmountCents:main.invoice.grossAmountCents,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const output={orderId:main.orderId,expectedVersion:before.data.orderVersion,mode:'versand' as const,clientEventId:randomUUID()};
 expect(await withSession(full,()=>recordGoodsOutAction(output))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT station FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${main.orderId}`).toEqual([{station:'fertig'}]);
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:main.orderId}))).toMatchObject({code:'OK',data:{payment:{status:'bezahlt'},additionalPayments:[{status:'offen'}],goodsOutAllowed:false}});
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:issued.receipt.invoiceId,amount:1190,method:'ueberweisung',expectedVersion:0,expectedOpenAmountCents:1190,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:main.orderId}))).toMatchObject({code:'OK',data:{additionalPayments:[{status:'bezahlt'}],goodsOutAllowed:true}});
 const out=await withSession(full,()=>recordGoodsOutAction(output));expect(out).toMatchObject({code:'OK',replayed:false});
 expect(await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(output))))).toMatchObject({code:'OK',replayed:true});
});

it('A09-2/-6 two existing released originals in one real shipment group receive exactly one additional fee despite parallel clicks',async()=>{
 await fee(null);const a=await readyInvoiceOrder('TEST S09 group extra A','shipping',false,undefined,10000),b=await readyInvoiceOrder('TEST S09 group extra B','shipping',false,a.customerId,10000);
 const shipmentId=randomUUID();expect(await withSession(full,()=>saveManualTrackingAction({orderId:a.orderId,shipmentId,expectedUpdatedAt:null,trackingNumber:'99345678901234',allowFormatMismatch:false,reason:null,clientEventId:randomUUID(),withOrder:{orderId:b.orderId,shipmentId:null,expectedUpdatedAt:null}}))).toMatchObject({code:'OK'});
 const [group]=await sql`SELECT sendung_id::text FROM public.shipments WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${shipmentId}::uuid`;expect(group.sendung_id).toEqual(expect.any(String));await fee(1000);
 const requests=[a,b].map(order=>({orderId:order.orderId,expectedVersion:order.issueInput.expectedVersion,clientEventId:randomUUID(),shippingCosts:{invoiceId:order.invoice.invoiceId,expectedVersion:1,scope:'sendung:'+group.sendung_id,expectedFeeCents:1000}}));
 const issued=await Promise.all(requests.map(request=>withSession(full,()=>issueInvoiceAction(request))));expect(issued.map(result=>result.code).sort()).toEqual(['CONFLICT','OK']);
 expect(await sql`SELECT count(*)::int AS n,sum(net_amount_cents)::int AS total FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id IN (${a.orderId},${b.orderId}) AND belegart='versandkosten' AND status='issued'`).toEqual([{n:1,total:1000}]);
 const winner=issued.findIndex(result=>result.code==='OK');expect(winner).toBeGreaterThanOrEqual(0);
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(requests[winner]))))).toMatchObject({code:'OK',replayed:true});
});
