// @vitest-environment node
// S02 preparation: existing commands only, no new application behaviour.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,nativeFetch,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {getLiveOrderCardAction,getManualShippingAction,saveManualTrackingAction} from '@/app/actions/orders.actions';
import {confirmPaymentAction,getOrderPaymentStateAction} from '@/app/actions/payments.actions';
import {recordGoodsOutAction} from '@/app/actions/goodsOut.actions';
import {sendCustomerMailAction} from '@/app/actions/communications.actions';
import {readShippingSettingsAction,saveShippingSettingsAction} from '@/app/actions/settings.actions';

const fresh=<T>(input:T):T=>JSON.parse(JSON.stringify(input));

it('S02 existing payment, pickup, shipping and sending retain exactly one effect across concurrent requests and fresh readers',async()=>{
 const pickup=await readyInvoiceOrder('N5-Abholung'),shipping=await readyInvoiceOrder('N5-Versand','shipping');
 const cardBefore=await withSession(full,()=>getOrderPaymentStateAction({orderId:pickup.orderId}));
 if(cardBefore.code!=='OK'||!cardBefore.data.payment)throw Error('N5_PAYMENT_READER');
 const original=cardBefore.data.payment;
 const payment={invoiceId:original.invoiceId,amount:original.openAmountCents,method:'bar' as const,expectedVersion:original.paymentVersion,expectedOpenAmountCents:original.openAmountCents,clientEventId:randomUUID()};
 const paid=await Promise.all([withSession(full,()=>confirmPaymentAction(fresh(payment))),withSession(full,()=>confirmPaymentAction(fresh(payment)))]);
 expect(paid.map(result=>result.code)).toEqual(['OK','OK']);
 if(paid[0].code!=='OK'||paid[1].code!=='OK')throw Error('N5_PAYMENT');
 expect(paid[0].receipt.eventId).toBe(paid[1].receipt.eventId);
 const afterPayment=await withSession(full,()=>getOrderPaymentStateAction({orderId:pickup.orderId}));
 expect(afterPayment).toMatchObject({code:'OK',data:{payment:{openAmountCents:0,eventId:paid[0].receipt.eventId}}});
 expect(await withSession(full,()=>confirmPaymentAction(fresh(payment)))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:paid[0].receipt.eventId,source:'manual'}});
 expect(await sql`SELECT payload->>'source' AS source,user_id::text AS actor FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${payment.clientEventId}::uuid AND event_type='PAYMENT_CONFIRMED_V1'`).toEqual([{source:'manual',actor:full.actorId}]);

 let sends=0,unclear=false;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-N5-external-provider-token'.repeat(3),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;if(unclear)throw Error('TEST external response lost after dispatch');return new Response(null,{status:202});}
  return nativeFetch(input,init);
 });
 const mail={targetType:'ORDER' as const,targetId:pickup.orderId,subject:'TEST N5 Nachricht',body:'TEST Genau ein Originalversand.',clientRequestId:randomUUID()};
 const mailed=await Promise.all([withSession(full,()=>sendCustomerMailAction(fresh(mail))),withSession(full,()=>sendCustomerMailAction(fresh(mail)))]);
 const sent=mailed.find(result=>result.code==='OK');if(!sent||sent.code!=='OK')throw Error('N5_MAIL');
 expect(sends).toBe(1);
 const thread=await sql`SELECT id::text,status FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+mail.clientRequestId}`;
 expect(thread).toEqual([{id:sent.data.threadId,status:'sent'}]);
 expect(await withSession(full,()=>sendCustomerMailAction(fresh(mail)))).toMatchObject({code:'OK',data:{threadId:thread[0].id,replayed:true}});
 expect(sends).toBe(1);
 expect(await sql`SELECT user_id::text AS actor FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_MAIL_SENT_V1' AND correlation_id=${mail.clientRequestId}::uuid`).toEqual([{actor:full.actorId}]);

 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('N5_SETTINGS');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:'TEST Parcel',numberPattern:'^TEST-[0-9]{4}$',numberHint:'TEST vier Ziffern',trackingUrl:'https://tracking.example.invalid/{nr}',expectedUpdatedAt:settings.settings.updatedAt}))).toMatchObject({code:'OK'});
 const tracking={orderId:shipping.orderId,shipmentId:randomUUID(),trackingNumber:'TEST-1001',expectedUpdatedAt:null,allowFormatMismatch:false,reason:null,clientEventId:randomUUID()};
 const registered=await Promise.all([withSession(full,()=>saveManualTrackingAction(fresh(tracking))),withSession(full,()=>saveManualTrackingAction(fresh(tracking)))]);
 expect(registered.map(result=>result.code)).toEqual(['OK','OK']);
 expect(await withSession(full,()=>getManualShippingAction({orderId:shipping.orderId}))).toMatchObject({code:'OK',data:{shipments:expect.arrayContaining([expect.objectContaining({id:tracking.shipmentId,trackingNumber:tracking.trackingNumber})])}});
 expect(await withSession(full,()=>saveManualTrackingAction(fresh(tracking)))).toMatchObject({code:'OK',replayed:true});

 for(const [order,mode]of [[pickup,'abholung'],[shipping,'versand']] as const){
  const live=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));if(live.code!=='OK')throw Error('N5_PHYSICAL_READER');
  const handover={orderId:order.orderId,mode,expectedVersion:live.data.card.version,clientEventId:randomUUID()};
  const results=await Promise.all([withSession(full,()=>recordGoodsOutAction(fresh(handover))),withSession(full,()=>recordGoodsOutAction(fresh(handover)))]);
  expect(results.map(result=>result.code)).toEqual(['OK','OK']);if(results[0].code!=='OK'||results[1].code!=='OK')throw Error('N5_HANDOVER');
  expect(results[0].receipt.eventId).toBe(results[1].receipt.eventId);
  expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'abgeholt'}}});
  expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{goodsOut:{eventId:results[0].receipt.eventId}}});
  expect(await withSession(full,()=>recordGoodsOutAction(fresh(handover)))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:results[0].receipt.eventId}});
  expect(await sql`SELECT id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${handover.clientEventId}::uuid`).toEqual([{id:results[0].receipt.eventId}]);
 }
 expect(await sql`SELECT status,shipped_at IS NOT NULL AS physically_handed_over FROM public.shipments WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${tracking.shipmentId}::uuid`).toEqual([{status:'shipped',physically_handed_over:true}]);
 const forbidden=await createFixture(['kunden']);
 expect(await withSession(forbidden,()=>confirmPaymentAction(fresh(payment)))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(forbidden,()=>saveManualTrackingAction(fresh(tracking)))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(forbidden,()=>recordGoodsOutAction({orderId:pickup.orderId,mode:'abholung',expectedVersion:pickup.version,clientEventId:randomUUID()}))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(forbidden,()=>sendCustomerMailAction(fresh(mail)))).toMatchObject({code:'FORBIDDEN'});
 expect(sends).toBe(1);
 unclear=true;
 const unknown={targetType:'CUSTOMER' as const,targetId:pickup.customerId,subject:'TEST N5 unklar',body:'TEST Kein Erfolg aus fehlender Antwort.',clientRequestId:randomUUID()};
 expect(await withSession(full,()=>sendCustomerMailAction(fresh(unknown)))).toMatchObject({code:'UNAVAILABLE'});
 expect(sends).toBe(2);
 expect(await sql`SELECT status,created_by::text AS actor FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+unknown.clientRequestId}`).toEqual([{status:'failed',actor:full.actorId}]);
 expect(await withSession(full,()=>sendCustomerMailAction(fresh(unknown)))).toMatchObject({code:'CONFLICT'});
 expect(sends).toBe(2);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_MAIL_SENT_V1' AND correlation_id=${unknown.clientRequestId}::uuid`).toHaveLength(0);
},120000);
