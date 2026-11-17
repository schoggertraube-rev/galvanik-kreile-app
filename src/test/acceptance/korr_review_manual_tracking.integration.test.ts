// @vitest-environment node
// KORR_REVIEW_11-16 K1: isolated TEST fixtures; tracking and goods-out use real writers.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder,readyOrderForInvoice,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {getManualShippingAction,saveManualTrackingAction} from '@/app/actions/orders.actions';
import {recordGoodsOutAction} from '@/app/actions/goodsOut.actions';
import {setPaymentModeAction} from '@/app/actions/payments.actions';
import {saveCustomerAgreementAction} from '@/app/actions/customers.actions';
const url=process.env.DATABASE_URL;
if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1')throw Error('TEST_KORR_TRACKING_LOOPBACK_REQUIRED');
async function tracking(orderId:string){
 await sql`UPDATE public.company_settings SET versand_dienst='TEST KORR Parcel',versand_nummer_format='',versand_nummer_hinweis='' WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const operator=await createFixture(['auftraege'],'werkstatt');
 const read=await withSession(operator,()=>getManualShippingAction({orderId}));
 expect(read).toMatchObject({code:'OK',data:{releaseAllowed:true}});
 if(read.code!=='OK')throw Error('TEST_KORR_TRACKING_READ');
 const input={orderId,shipmentId:randomUUID(),expectedUpdatedAt:null,trackingNumber:'TEST-'+randomUUID(),allowFormatMismatch:false,reason:null,clientEventId:randomUUID()};
 const saved=await withSession(operator,()=>saveManualTrackingAction(input));
 expect(saved).toMatchObject({code:'OK',replayed:false,receipt:{actorId:operator.actorId}});
 expect(await withSession(operator,()=>saveManualTrackingAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 const fresh=await withSession(operator,()=>getManualShippingAction({orderId}));
 expect(fresh).toMatchObject({code:'OK',data:{shipments:[{id:input.shipmentId,trackingNumber:input.trackingNumber,status:'created'}]}});
 expect(await sql`SELECT shipped_at,delivered_at FROM public.shipments WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.shipmentId}::uuid`).toEqual([{shipped_at:null,delivered_at:null}]);
 return {operator,input,version:read.data.orderVersion};
}
it('K1 overdue debt permits real tracking but only an authorized override permits physical handover',async()=>{
 const order=await readyInvoiceOrder('TEST K1 debt target','shipping');
 const old=await intakeOrderFixture('TEST K1 historical debt',order.customerId),debt=randomUUID();
 // Explicit synthetic historical debt, same isolated boundary as the existing H4/S10 cases.
 await sql`INSERT INTO public.invoices(id,tenant_id,order_id,customer_id,invoice_number,amount_total,status,due_date,gross_amount_cents,payment_contract_version,payment_mode,payment_status,payment_open_amount_cents,payment_paid_amount_cents,payment_currency,payment_version)
 VALUES(${debt}::uuid,${KREILE_TENANT_SLUG},${old.receipt.orderId},${order.customerId},'R-2025-0001',60,'issued',(statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1,6000,1,'rechnung','offen',6000,0,'EUR',0)`;
 const saved=await tracking(order.orderId);
 const output={orderId:order.orderId,mode:'versand' as const,expectedVersion:saved.version,clientEventId:randomUUID()};
 expect(await withSession(saved.operator,()=>recordGoodsOutAction(output))).toMatchObject({code:'CONFLICT'});
 const approver=await createFixture(['auftraege','entscheiden'],'meister');
 const allowed={...output,overdueReleaseReason:'TEST K1 ausdrueckliche Freigabe'};
 expect(await withSession(approver,()=>recordGoodsOutAction(allowed))).toMatchObject({code:'OK'});
 expect(await withSession(approver,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(allowed))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT status,shipped_at IS NOT NULL AS handed_over FROM public.shipments WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${saved.input.shipmentId}::uuid`).toEqual([{status:'shipped',handed_over:true}]);
});
it('K1 unpaid prepayment permits tracking while goods-out still requires the actual output agreement',async()=>{
 const order=await readyOrderForInvoice('TEST K1 unpaid prepayment','shipping');
 expect(await withSession(full,()=>setPaymentModeAction({orderId:order.orderId,paymentMode:'vorkasse',expectedVersion:0,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const saved=await tracking(order.orderId);
 const output={orderId:order.orderId,mode:'versand' as const,expectedVersion:saved.version,clientEventId:randomUUID()};
 expect(await withSession(saved.operator,()=>recordGoodsOutAction(output))).toMatchObject({code:'CONFLICT'});
 const result=await withSession(full,()=>saveCustomerAgreementAction({customerId:order.customerId,orderId:order.orderId,clientKey:randomUUID(),type:'ausgabe_ohne_zahlung',targetDays:null,reason:'TEST K1 reale Absprache'}));
 expect(result).toMatchObject({code:'OK'});if(result.code!=='OK')throw Error('TEST_K1_REAL_AGREEMENT');
 const input={...output,agreement:{id:result.agreement.id,version:result.agreement.version,type:'ausgabe_ohne_zahlung' as const}};
 const handed=await withSession(saved.operator,()=>recordGoodsOutAction(input));
 expect(handed,JSON.stringify(handed)).toMatchObject({code:'OK'});
 expect(await withSession(saved.operator,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
});
it('K1 an actual open complaint still blocks tracking without creating a shipment or tracking receipt',async()=>{
 const order=await readyInvoiceOrder('TEST K1 complaint','shipping'),complaintId=randomUUID();
 // Explicit synthetic initial open complaint, using the existing immutable complaint schema.
 await sql`INSERT INTO public.complaints(id,tenant_id,order_id,customer_id,item_id,reason,description,status,nummer,client_key,teile,mangel,fotos,ware_zurueck,stand,version,erstellt_von,erstellt_am)
 VALUES(${complaintId},${KREILE_TENANT_SLUG},${order.orderId},${order.customerId},${order.items[0].id},'TEST K1 Reklamation','TEST K1 offener Mangel','open',${'RK-TEST-'+complaintId.slice(0,8)},${randomUUID()}::uuid,${sql.json([{position_id:order.items[0].id,menge:1}])}::jsonb,'TEST K1 Mangel','[]'::jsonb,'ja','aufgenommen',1,${full.actorId}::uuid,statement_timestamp() AT TIME ZONE 'UTC')`;
 await sql`UPDATE public.company_settings SET versand_dienst='TEST KORR Parcel',versand_nummer_format='',versand_nummer_hinweis='' WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 expect(await withSession(full,()=>getManualShippingAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{releaseAllowed:false}});
 const input={orderId:order.orderId,shipmentId:randomUUID(),expectedUpdatedAt:null,trackingNumber:'TEST-'+randomUUID(),allowFormatMismatch:false,reason:null,clientEventId:randomUUID()};
 expect(await withSession(full,()=>saveManualTrackingAction(input))).toMatchObject({code:'CONFLICT',reason:'SHIPPING_RELEASE_BLOCKED'});
 expect(await sql`SELECT count(*)::int AS n FROM public.shipments WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.shipmentId}::uuid`).toEqual([{n:0}]);
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{n:0}]);
});
