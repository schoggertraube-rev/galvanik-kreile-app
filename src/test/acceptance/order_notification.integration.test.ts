// @vitest-environment node
import {vi,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,nativeFetch,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {getLiveOrderCardAction,markOrderInformedByPhoneAction,getOrdersDb} from '@/app/actions/orders.actions';
import {readShippingSettingsAction,saveShippingSettingsAction} from '@/app/actions/settings.actions';
import {updateCustomerAction} from '@/app/actions/customers.actions';
import {emptyDispatchPolicy} from '@/modules/fundament/public';
import {createDispatchCallTaskAction,getIntakeTaskAction,completeIntakeTaskAction} from '@/app/actions/eingang.actions';
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

it('an omitted phone receipt never reports success or informs the card; a fresh same-key retry recovers',async()=>{
 const order=await readyInvoiceOrder('S1-Quittung-fehlt'),input={orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()},name='test_notice_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id = '${KREILE_TENANT_SLUG}' AND NEW.client_event_id = '${input.clientEventId}'::uuid AND NEW.event_type = 'ORDER_CUSTOMER_INFORMED_V1' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 try{
  await sql.unsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${name}()`);
  expect(await withSession(full,()=>markOrderInformedByPhoneAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toHaveLength(0);
  expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{customerInformed:{code:'OK',informed:null,ampel:'rot'}}});
 }finally{
  await sql.unsafe(`DROP TRIGGER IF EXISTS ${name} ON public.events`);
  await sql.unsafe(`DROP FUNCTION private.${name}()`);
 }
 const saved=await withSession(full,()=>markOrderInformedByPhoneAction(JSON.parse(JSON.stringify(input))));expect(saved).toMatchObject({code:'OK',replayed:false});if(saved.code!=='OK')throw Error('PHONE_RECOVERY');
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{customerInformed:{code:'OK',informed:{eventId:saved.receipt.eventId,actorId:full.actorId,channel:'telefon'}}}});
 expect(await withSession(full,()=>markOrderInformedByPhoneAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:saved.receipt.eventId}});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{n:1}]);
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

it.each(['created','result'] as const)('an omitted call %s receipt rolls back its whole task effect and supports a fresh recovery',async(fault)=>{
 const order=await readyInvoiceOrder('Anruf-Quittung-'+fault);
 expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),email:''}))).toMatchObject({code:'OK'});
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('CALL_FAULT_SETTINGS');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberPattern:settings.settings.numberPattern,numberHint:settings.settings.numberHint,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,dispatchPolicy:emptyDispatchPolicy()}))).toMatchObject({code:'OK'});
 async function plan(){const queue=await withSession(full,()=>getOrdersDb());if(!queue.ok)throw Error('CALL_FAULT_QUEUE');return queue.data.find(row=>row.id===order.orderId)!.finishedDispatch!.reminder!;}
 const initial=await plan(),request={customerId:order.customerId,handover:'pickup' as const,dueDate:initial.due!,clientKey:initial.clientKey!};
 let taskId:string|null=null,version=0;
 if(fault==='result'){const created=await withSession(full,()=>createDispatchCallTaskAction(request));if(created.code!=='OK')throw Error('CALL_FAULT_PREPARE');taskId=created.taskId;const read=await withSession(full,()=>getIntakeTaskAction({taskId:created.taskId}));if(read.code!=='OK'||!read.task)throw Error('CALL_FAULT_TASK');version=read.task.version;}
 const completion={taskId:taskId!,version,note:'TEST Kunde erreicht',callResult:'reached' as const},name='test_call_receipt_'+randomUUID().replaceAll('-','');
 const eventType=fault==='created'?'ORDER_COLLECTION_CALL_CREATED_V1':'ORDER_COLLECTION_CALL_RESULT_V1';
 await sql.unsafe(`CREATE FUNCTION private.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id = '${KREILE_TENANT_SLUG}' AND NEW.event_type = '${eventType}' AND NEW.payload->'meta'->>'customerId' = '${order.customerId}' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 try{
  await sql.unsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${name}()`);
  const result=fault==='created'?await withSession(full,()=>createDispatchCallTaskAction(request)):await withSession(full,()=>completeIntakeTaskAction(completion));expect(result).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type=${eventType} AND payload->'meta'->>'customerId'=${order.customerId}`).toHaveLength(0);
  if(fault==='created')expect(await sql`SELECT id FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${request.clientKey}::uuid`).toHaveLength(0);
  else{
   expect(await sql`SELECT status,version,erledigt_am FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${taskId}::uuid`).toEqual([{status:'offen',version,erledigt_am:null}]);
   expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} AND event_type='ORDER_CUSTOMER_INFORMED_V1'`).toHaveLength(0);
  }
  expect(await plan()).toMatchObject({state:fault==='created'?'DUE':'CALL_PENDING'});
 }finally{
  await sql.unsafe(`DROP TRIGGER IF EXISTS ${name} ON public.events`);
  await sql.unsafe(`DROP FUNCTION private.${name}()`);
 }
 if(fault==='created'){
  const recovered=await withSession(full,()=>createDispatchCallTaskAction(JSON.parse(JSON.stringify(request))));if(recovered.code!=='OK')throw Error('CALL_CREATED_RECOVERY');
  expect(await withSession(full,()=>createDispatchCallTaskAction(JSON.parse(JSON.stringify(request))))).toMatchObject({code:'OK',taskId:recovered.taskId,replayed:true});
  expect(await plan()).toMatchObject({state:'CALL_PENDING',callTaskId:recovered.taskId});
 }else{
  expect(await withSession(full,()=>completeIntakeTaskAction(JSON.parse(JSON.stringify(completion))))).toMatchObject({code:'OK',replayed:false});
  expect(await withSession(full,()=>completeIntakeTaskAction(JSON.parse(JSON.stringify(completion))))).toMatchObject({code:'OK',replayed:true});
  expect(await plan()).toMatchObject({state:'STOPPED',callTaskId:taskId});
 }
});

it('K7 informed complained ware is red while ordinary unpaid pickup remains yellow',async()=>{
 const order=await readyInvoiceOrder('TEST K7 Ampel');
 expect(await withSession(full,()=>markOrderInformedByPhoneAction({orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const {setPaymentModeAction}=await import('@/app/actions/payments.actions');
 expect(await withSession(full,()=>setPaymentModeAction({orderId:order.orderId,paymentMode:'abholung',expectedVersion:0,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{customerInformed:{ampel:'gelb',blockReason:'payment'}}});
 const {seedSyntheticComplaintPhoto}=await import('@/test/fixtures/complaintPhoto');
 const {reklamationAusfuehrenAction}=await import('@/app/actions/complaints.actions');
 const photos=await seedSyntheticComplaintPhoto(sql,{tenantId:KREILE_TENANT_SLUG,actorId:full.actorId,customerId:order.customerId,orderId:order.orderId});
 expect(await withSession(full,()=>reklamationAusfuehrenAction({action:'aufnehmen',clientKey:randomUUID(),orderId:order.orderId,intakeItemId:null,intakeVersion:null,parts:[{position_id:order.items[0].id,menge:1}],defect:'Blasen',description:'TEST K7 reklamierte Ware',photoIds:photos,goodsReturn:'offen'}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{customerInformed:{ampel:'rot',blockReason:'open_complaint'}}});
});
