// @vitest-environment node
import {vi,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,nativeFetch,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {sendCustomerMailAction} from '@/app/actions/communications.actions';
import {getOrdersDb} from '@/app/actions/orders.actions';
import {readShippingSettingsAction,saveShippingSettingsAction} from '@/app/actions/settings.actions';
import {emptyDispatchPolicy} from '@/modules/fundament/public';
const DATABASE_URL=process.env.DATABASE_URL,EXPECTED_DATABASE_URL=process.env.H18_EXPECTED_DATABASE_URL;
if(!DATABASE_URL||DATABASE_URL!==EXPECTED_DATABASE_URL||new URL(DATABASE_URL).hostname!=='127.0.0.1')throw Error('COLLECTION_REMINDER_LOOPBACK_REQUIRED');

async function configure(second:number|null=0,holdMinutes=0){
 const read=await withSession(full,()=>readShippingSettingsAction());if(read.code!=='OK')throw Error('COLLECTION_SETTINGS');
 return withSession(full,()=>saveShippingSettingsAction({service:read.settings.service,numberPattern:read.settings.numberPattern,numberHint:read.settings.numberHint,trackingUrl:read.settings.trackingUrl,expectedUpdatedAt:read.settings.updatedAt,dispatchPolicy:{...emptyDispatchPolicy(),reminderDays:0,secondReminderDays:second,callAfterDays:0,holdMinutes}}));
}
async function proposal(orderId:string){const read=await withSession(full,()=>getOrdersDb());if(!read.ok)throw Error('COLLECTION_QUEUE');const result=read.data.find(row=>row.id===orderId)?.finishedDispatch?.reminder;if(!result)throw Error('COLLECTION_PROPOSAL');return result;}

it('E1/E2 actual approval uses the single sender, one group proof and original retries; the projection advances only after confirmed sends',async()=>{
 const bodies:string[]=[];
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-collection-token'.repeat(3),expires_in:3600});if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){bodies.push(JSON.parse(String(init?.body)).message.body.content);return new Response(null,{status:202});}return nativeFetch(input,init);});
 const first=await readyInvoiceOrder('E1-Erster'),second=await readyInvoiceOrder('E1-Zweiter','pickup',false,first.customerId);
 expect(await withSession(full,()=>sendCustomerMailAction({targetType:'ORDER',targetId:first.orderId,clientRequestId:randomUUID(),subject:'TEST Fertig',body:'TEST Fertigmeldung',expectedInvoiceIds:[first.invoice.invoiceId,second.invoice.invoiceId],attachment:{kind:'INVOICE',documentId:first.invoice.invoiceId}}))).toMatchObject({code:'OK'});
 expect(await configure()).toMatchObject({code:'OK'});
 const planned=await proposal(first.orderId);expect(planned).toMatchObject({stage:'E1',state:'DUE',requiresResponseCheck:false});if(!planned.due)throw Error('COLLECTION_DUE');
 const operator=await createFixture(['mails','auftraege','geld'],'buero');
 const input={targetType:'CUSTOMER' as const,targetId:first.customerId,clientRequestId:randomUUID(),subject:'TEST Erinnerung',body:'TEST Bitte hole Deine fertige Ware ab.',collectionReminder:{stage:'E1' as const,handover:'pickup' as const,dueDate:planned.due}};
 const sent=await withSession(operator,()=>sendCustomerMailAction(input));expect(sent).toMatchObject({code:'OK'});if(sent.code!=='OK')throw Error('COLLECTION_E1:'+sent.code);
 expect(bodies).toHaveLength(2);
 const numbers=await sql`SELECT order_number FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id IN (${first.orderId},${second.orderId})`;for(const row of numbers)expect(bodies[1]).toContain(row.order_number);
 expect(await sql`SELECT user_id::text,payload->>'threadId' AS thread FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND correlation_id=${input.clientRequestId}::uuid`).toEqual([{user_id:operator.actorId,thread:sent.data.threadId}]);
 expect(await proposal(first.orderId)).toMatchObject({stage:'E2',state:'DUE'});
 expect(await withSession(operator,()=>sendCustomerMailAction(structuredClone(input)))).toMatchObject({code:'OK',data:{threadId:sent.data.threadId,replayed:true}});
 expect(await withSession(operator,()=>sendCustomerMailAction({...input,body:'TEST anderer Inhalt'}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(operator,()=>sendCustomerMailAction({...input,clientRequestId:randomUUID()}))).toMatchObject({code:'CONFLICT'});expect(bodies).toHaveLength(2);
 const next=await proposal(second.orderId);if(!next.due)throw Error('COLLECTION_SECOND_DUE');
 const secondInput={...input,clientRequestId:randomUUID(),collectionReminder:{...input.collectionReminder,stage:'E2' as const,dueDate:next.due}};
 const contenders=[secondInput,{...secondInput,clientRequestId:randomUUID()}];
 const concurrent=await Promise.all(contenders.map(request=>withSession(operator,()=>sendCustomerMailAction(request))));
 expect(concurrent.filter(result=>result.code==='OK')).toHaveLength(1);expect(concurrent.filter(result=>result.code==='CONFLICT')).toHaveLength(1);
 expect(await proposal(first.orderId)).toMatchObject({stage:'E3',state:'DUE'});expect(bodies).toHaveLength(3);
 const winner=contenders[concurrent.findIndex(result=>result.code==='OK')];
 expect(await withSession(operator,()=>sendCustomerMailAction(structuredClone(winner)))).toMatchObject({code:'OK',data:{replayed:true}});expect(bodies).toHaveLength(3);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_CUSTOMER_INFORMED_V1' AND order_id IN (${first.orderId},${second.orderId})`).toEqual([{n:2}]);
});

it('an existing generic mail cannot become a qualified reminder just by reusing its key and identical body',async()=>{
 let sends=0;vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-purpose-token'.repeat(3),expires_in:3600});if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;void init;return new Response(null,{status:202});}return nativeFetch(input,init);});
 const order=await readyInvoiceOrder('E1-Zweckbindung');
 expect(await withSession(full,()=>sendCustomerMailAction({targetType:'ORDER',targetId:order.orderId,clientRequestId:randomUUID(),subject:'TEST Fertig',body:'TEST Fertig',expectedInvoiceIds:[order.invoice.invoiceId],attachment:{kind:'INVOICE',documentId:order.invoice.invoiceId}}))).toMatchObject({code:'OK'});
 expect(await configure()).toMatchObject({code:'OK'});const planned=await proposal(order.orderId);if(!planned.due)throw Error('PURPOSE_DUE');
 const clientRequestId=randomUUID(),body='TEST Bitte abholen.',subject='TEST Erinnerung';
 const [row]=await sql`SELECT order_number FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`;
 const generic={targetType:'CUSTOMER' as const,targetId:order.customerId,clientRequestId,subject,body:'Deine fertigen Aufträge: '+row.order_number+'\n\n'+body};
 expect(await withSession(full,()=>sendCustomerMailAction(generic))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>sendCustomerMailAction({...generic,body,collectionReminder:{stage:'E1',handover:'pickup',dueDate:planned.due!}}))).toMatchObject({code:'CONFLICT'});
 expect(sends).toBe(2);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND correlation_id=${clientRequestId}::uuid`).toEqual([{n:0}]);
 const denied=await createFixture(['auftraege'],'werkstatt');
 expect(await withSession(denied,()=>sendCustomerMailAction({...generic,clientRequestId:randomUUID(),body,collectionReminder:{stage:'E1',handover:'pickup',dueDate:planned.due!}}))).toMatchObject({code:'FORBIDDEN'});expect(sends).toBe(2);
});

it('failed E1 does not advance and a second key cannot duplicate an uncertain outgoing mail; a configured hold is never bypassed',async()=>{
 let attempts=0,fail=false;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-collection-failure-token'.repeat(3),expires_in:3600});if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){attempts++;void init;return new Response(null,{status:fail?503:202});}return nativeFetch(input,init);});
 const order=await readyInvoiceOrder('E1-Fehler');
 expect(await withSession(full,()=>sendCustomerMailAction({targetType:'ORDER',targetId:order.orderId,clientRequestId:randomUUID(),subject:'TEST Fertig',body:'TEST Fertig',expectedInvoiceIds:[order.invoice.invoiceId],attachment:{kind:'INVOICE',documentId:order.invoice.invoiceId}}))).toMatchObject({code:'OK'});
 expect(await configure(0,5)).toMatchObject({code:'OK'});
 const due=(await proposal(order.orderId)).due;if(!due)throw Error('COLLECTION_FAILURE_DUE');
 const input={targetType:'CUSTOMER' as const,targetId:order.customerId,clientRequestId:randomUUID(),subject:'TEST Erinnerung',body:'TEST Erinnerung ohne Gebühren.',collectionReminder:{stage:'E1' as const,handover:'pickup' as const,dueDate:due}};
 expect(await withSession(full,()=>sendCustomerMailAction(input))).toMatchObject({code:'IN_KLAERUNG'});expect(attempts).toBe(1);
 expect(await configure()).toMatchObject({code:'OK'});fail=true;
 expect((await withSession(full,()=>sendCustomerMailAction(input))).code).not.toBe('OK');
 expect(await proposal(order.orderId)).toMatchObject({stage:'E1',state:'RECONCILE_MAIL'});
 expect(await withSession(full,()=>sendCustomerMailAction(structuredClone(input)))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>sendCustomerMailAction({...input,clientRequestId:randomUUID()}))).toMatchObject({code:'CONFLICT'});expect(attempts).toBe(2);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND payload->'meta'->>'customerId'=${order.customerId}`).toEqual([{n:0}]);
});

it.each([false,true])('S02 reminder reconciles its original from Sent Items without a second send (followFailure=%s)',async(followFailure)=>{
 const order=await readyInvoiceOrder('N5-Erinnerung');
 const [customer]=await sql`SELECT email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.customerId}`;
 let sends=0,lose=false,requestId='';
 vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-reminder-N5-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;if(lose)throw Error('TEST reminder accepted, response lost');return new Response(null,{status:202});}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages'))return Response.json({value:[{id:'TEST-reminder-original',internetMessageId:'<TEST-reminder-original@example.invalid>',from:{emailAddress:{address:process.env.MS_GRAPH_MAILBOX}},toRecipients:[{emailAddress:{address:customer.email}}],isDraft:false,sentDateTime:new Date().toISOString(),internetMessageHeaders:[{name:'x-kreile-request-id',value:requestId}]}]});
  return nativeFetch(request,init);
 });
 expect(await withSession(full,()=>sendCustomerMailAction({targetType:'ORDER',targetId:order.orderId,clientRequestId:randomUUID(),subject:'TEST Fertig',body:'TEST Original',expectedInvoiceIds:[order.invoice.invoiceId],attachment:{kind:'INVOICE',documentId:order.invoice.invoiceId}}))).toMatchObject({code:'OK'});
 expect(await configure()).toMatchObject({code:'OK'});
 const plan=await proposal(order.orderId);if(!plan.due)throw Error('N5_REMINDER_DUE');
 requestId=randomUUID();
 const input={targetType:'CUSTOMER' as const,targetId:order.customerId,clientRequestId:requestId,subject:'TEST Erinnerung',body:'TEST gleicher Freigabe-Intent',collectionReminder:{stage:'E1' as const,handover:'pickup' as const,dueDate:plan.due}};
 lose=true;
 expect(await withSession(full,()=>sendCustomerMailAction(structuredClone(input)))).toMatchObject({code:'UNAVAILABLE'});
 const failure='test_reminder_follow_'+randomUUID().replaceAll('-','');
 if(followFailure){
  await sql.unsafe(`CREATE FUNCTION private.${failure}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='ORDER_COLLECTION_REMINDER_SENT_V1' THEN RAISE EXCEPTION 'TEST reminder bookkeeping unavailable'; END IF; RETURN NEW; END $$`);
  await sql.unsafe(`CREATE TRIGGER ${failure} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${failure}()`);
 }
 try{
  expect(await withSession(full,()=>sendCustomerMailAction({...structuredClone(input),clientRequestId:randomUUID()}))).toMatchObject({code:'OK',data:{replayed:true}});
  if(followFailure){
   expect(await sql`SELECT status FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+requestId}`).toEqual([{status:'sent'}]);
   expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_COLLECTION_EFFECT_RETRY_REQUIRED_V1' AND correlation_id=${requestId}::uuid`).toHaveLength(1);
  }
 }finally{if(followFailure){await sql.unsafe(`DROP TRIGGER ${failure} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${failure}()`);}}
 expect(await withSession(full,()=>sendCustomerMailAction(structuredClone(input)))).toMatchObject({code:'OK',data:{replayed:true}});
 expect(sends).toBe(2);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND correlation_id=${requestId}::uuid`).toHaveLength(1);
 expect(await proposal(order.orderId)).toMatchObject({stage:'E2',state:'DUE'});
},120000);
