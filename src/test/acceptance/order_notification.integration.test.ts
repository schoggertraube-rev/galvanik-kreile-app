// @vitest-environment node
import {vi,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,nativeFetch,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {getLiveOrderCardAction,markOrderInformedByPhoneAction} from '@/app/actions/orders.actions';
import {sendCustomerMailAction} from '@/app/actions/communications.actions';
const DATABASE_URL=process.env.DATABASE_URL,EXPECTED_DATABASE_URL=process.env.H18_EXPECTED_DATABASE_URL;
if(!DATABASE_URL||DATABASE_URL!==EXPECTED_DATABASE_URL||new URL(DATABASE_URL).hostname!=='127.0.0.1')throw Error('ORDER_NOTIFICATION_LOOPBACK_REQUIRED');

it('S1 actual phone notice changes the one informed reader; new request data replays the actor receipt without mail or order mutation',async()=>{
 const order=await readyInvoiceOrder('S1-Telefon');
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{customerInformed:{code:'OK',informed:null,ampel:'rot'}}});
 const operator=await createFixture(['auftraege'],'werkstatt');
 const input={orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()};
 const result=await withSession(operator,()=>markOrderInformedByPhoneAction(input));
 expect(result).toMatchObject({code:'OK',receipt:{actorId:operator.actorId,channel:'telefon',threadId:null},replayed:false});
 if(result.code!=='OK')throw Error('PHONE_NOTICE:'+result.code);
 expect(await sql`SELECT user_id::text,payload->'receipt'->>'channel' AS channel FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${result.receipt.eventId}`).toEqual([{user_id:operator.actorId,channel:'telefon'}]);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{version:order.version},customerInformed:{code:'OK',ampel:'gruen',informed:{eventId:result.receipt.eventId}}}});
 expect(await withSession(operator,()=>markOrderInformedByPhoneAction(structuredClone(input)))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:result.receipt.eventId}});
 expect(await sql`SELECT count(*)::integer AS n FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}`).toEqual([{n:0}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{n:1}]);
 const forbidden=await createFixture(['kunden']);
 expect(await withSession(forbidden,()=>markOrderInformedByPhoneAction({...input,clientEventId:randomUUID()}))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(full,()=>markOrderInformedByPhoneAction(structuredClone(input)))).toMatchObject({code:'CONFLICT'});
 const {setPaymentModeAction,confirmPaymentAction}=await import('@/app/actions/payments.actions');
 expect(await withSession(full,()=>setPaymentModeAction({orderId:order.orderId,paymentMode:'abholung',expectedVersion:0,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{customerInformed:{ampel:'gelb',informed:{eventId:result.receipt.eventId}}}});
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:order.invoice.invoiceId,amount:order.invoice.grossAmountCents,method:'bar',expectedVersion:0,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));
 expect(card).toMatchObject({code:'OK',data:{customerInformed:{ampel:'gruen'}}});if(card.code!=='OK')throw Error('NOTICE_CARD_READ');
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const released=await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:card.data.card.version,clientEventId:randomUUID()}));
 expect(released).toMatchObject({code:'OK'});if(released.code!=='OK')throw Error('NOTICE_RELEASE');
 const late={...input,expectedVersion:released.receipt.orderVersion,clientEventId:randomUUID()};
 expect(await withSession(operator,()=>markOrderInformedByPhoneAction(late))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${late.clientEventId}::uuid`).toEqual([{n:0}]);
});

it('S1 existing real mail pipeline counts only a confirmed invoice notice, not ordinary or failed mail; fresh retry never resends',async()=>{
 const order=await readyInvoiceOrder('S1-Mail');let sends=0,fail=false;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-S1-provider-token'.repeat(3),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;return new Response(null,{status:fail?503:202});}
  return nativeFetch(input,init);
 });
 const base={targetType:'ORDER' as const,targetId:order.orderId,subject:'TEST Fertigmeldung',body:'TEST Deine Ware ist fertig.',clientRequestId:randomUUID()};
 expect(await withSession(full,()=>sendCustomerMailAction(base))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{customerInformed:{informed:null,ampel:'rot'}}});
 fail=true;
 const failed={...base,clientRequestId:randomUUID(),attachment:{kind:'INVOICE' as const,documentId:order.invoice.invoiceId}};
 const rejected=await withSession(full,()=>sendCustomerMailAction(failed));expect(rejected.code).not.toBe('OK');
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} AND event_type='ORDER_CUSTOMER_INFORMED_V1'`).toEqual([{n:0}]);
 fail=false;
 const input={...failed,clientRequestId:randomUUID()};
 const sent=await withSession(full,()=>sendCustomerMailAction(input));expect(sent).toMatchObject({code:'OK'});
 if(sent.code!=='OK')throw Error('INVOICE_NOTICE:'+sent.code);
 expect(await sql`SELECT user_id::text,payload->'receipt'->>'channel' AS channel,payload->'receipt'->>'threadId' AS thread FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} AND event_type='ORDER_CUSTOMER_INFORMED_V1'`).toEqual([{user_id:full.actorId,channel:'mail',thread:sent.data.threadId}]);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{customerInformed:{ampel:'gruen',informed:{actorId:full.actorId,channel:'mail'}}}});
 const before=sends;
 expect(await withSession(full,()=>sendCustomerMailAction(structuredClone(input)))).toMatchObject({code:'OK',data:{threadId:sent.data.threadId,replayed:true}});
 expect(sends).toBe(before);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} AND event_type='ORDER_CUSTOMER_INFORMED_V1'`).toEqual([{n:1}]);
});

it('Fertig existing operational consumer reads one notification/release projection, separates pickup/shipping and ranks releasable rows first without prices',async()=>{
 const red=await readyInvoiceOrder('Fertig-Rot','pickup'),green=await readyInvoiceOrder('Fertig-Gruen','shipping');
 const operator=await createFixture(['auftraege'],'werkstatt');
 expect(await withSession(operator,()=>markOrderInformedByPhoneAction({orderId:green.orderId,expectedVersion:green.version,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const {getOrdersDb}=await import('@/app/actions/orders.actions');
 const read=await withSession(operator,()=>getOrdersDb());
 expect(read).toMatchObject({ok:true});if(!read.ok)throw Error('FINISHED_QUEUE_READ');
 const rows=read.data;
 const pickup=rows.find(row=>row.id===red.orderId)?.finishedDispatch,shipping=rows.find(row=>row.id===green.orderId)?.finishedDispatch;
 expect(pickup).toMatchObject({state:'available',handover:'pickup',color:'rot',workingDays:null,gaps:['BUSINESS_CALENDAR_SETTINGS_MISSING']});
 expect(shipping).toMatchObject({state:'available',handover:'shipping',color:'gruen',channel:'telefon',releaseAllowed:true});
 expect(shipping!.rank!).toBeLessThan(pickup!.rank!);
 expect(JSON.stringify([pickup,shipping])).not.toMatch(/Cents|Amount|invoiceNumber/);
 const {readShippingSettingsAction,saveShippingSettingsAction}=await import('@/app/actions/settings.actions');
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('DISPATCH_SETTINGS_READ');
 const {emptyDispatchPolicy}=await import('@/modules/fundament/public');
 const policy={...emptyDispatchPolicy(),holidays:['2026-12-24']};
 const input={service:settings.settings.service,numberPattern:settings.settings.numberPattern,numberHint:settings.settings.numberHint,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,dispatchPolicy:policy};
 expect(await withSession(full,()=>saveShippingSettingsAction(input))).toMatchObject({code:'OK',replayed:false,settings:{dispatchPolicy:policy}});
 expect(await sql`SELECT ausgang_regeln FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual([{ausgang_regeln:policy}]);
 const configured=await withSession(operator,()=>getOrdersDb());if(!configured.ok)throw Error('FINISHED_CONFIGURED_READ');
 expect(configured.data.find(row=>row.id===green.orderId)?.finishedDispatch).toMatchObject({state:'available',workingDays:0,gaps:[]});
 expect(await withSession(full,()=>saveShippingSettingsAction(structuredClone(input)))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT payload->>'actorId' AS actor FROM public.ui_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='shipping_settings_updated' ORDER BY created_at DESC LIMIT 1`).toEqual([{actor:full.actorId}]);
 expect(await withSession(full,()=>saveShippingSettingsAction({...input,dispatchPolicy:{...policy,holidays:['2026-02-30']}}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await withSession(full,()=>saveShippingSettingsAction({...input,dispatchPolicy:{...policy,reminderDays:5}}))).toMatchObject({code:'CONFLICT'});
});

it('a damaged newest TEST notice is unavailable instead of silently falling back to an older green receipt',async()=>{
 const order=await readyInvoiceOrder('S1-Beleg-Defekt');
 const saved=await withSession(full,()=>markOrderInformedByPhoneAction({orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()}));
 if(saved.code!=='OK')throw Error('NOTICE_CORRUPTION_SETUP');
 const id=randomUUID(),key=randomUUID();
 // Isolated synthetic damaged history; never an alternate product writer or changed original event.
 const [original]=await sql`SELECT payload->>'intent' AS intent FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${saved.receipt.eventId}`;
 const payload={intent:original.intent,receipt:{...saved.receipt,eventId:id,actorId:randomUUID()}};
 await sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,payload,status,user_id,client_event_id,correlation_id,event_schema_version,created_at)
 VALUES(${id},${KREILE_TENANT_SLUG},${order.orderId},'ORDER_CUSTOMER_INFORMED_V1','TEST damaged receipt',${sql.json(payload)}::jsonb,'success',${full.actorId}::uuid,${key}::uuid,${key}::uuid,1,statement_timestamp())`;
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{customerInformed:{code:'UNAVAILABLE'}}});
 expect(await withSession(full,()=>markOrderInformedByPhoneAction({orderId:order.orderId,expectedVersion:order.version,clientEventId:key}))).toMatchObject({code:'UNAVAILABLE'});
});
