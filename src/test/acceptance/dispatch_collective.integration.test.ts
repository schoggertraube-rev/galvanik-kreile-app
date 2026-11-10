// @vitest-environment node
import {vi,it,expect} from 'vitest';
import {randomUUID,createHash} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,nativeFetch,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {sendCustomerMailAction} from '@/app/actions/communications.actions';
import {getLiveOrderCardAction} from '@/app/actions/orders.actions';
const DATABASE_URL=process.env.DATABASE_URL,EXPECTED_DATABASE_URL=process.env.H18_EXPECTED_DATABASE_URL;
if(!DATABASE_URL||DATABASE_URL!==EXPECTED_DATABASE_URL||new URL(DATABASE_URL).hostname!=='127.0.0.1')throw Error('DISPATCH_COLLECTIVE_LOOPBACK_REQUIRED');

it('K10 saves a real Outlook reply before reaction checking; an unbound Outlook reference never becomes an app reaction or blocks E1/E2',async()=>{
 const order=await readyInvoiceOrder('K10-Outlook-Antwort');
 const [customer]=await sql`SELECT email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.customerId}`;
 let outage=true,sends=0;
 const graphId='TEST-K10-reply-'+randomUUID(),messageId='<'+graphId+'@example.invalid>',reference='<TEST-non-app-outlook@example.invalid>';
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-K10-provider-token'.repeat(3),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;return new Response(null,{status:202});}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages'))return outage?new Response(null,{status:503}):Response.json({value:[{id:'TEST-K10-non-app-original',internetMessageId:reference,from:{emailAddress:{address:'TEST-mailbox@example.invalid'}},toRecipients:[{emailAddress:{address:customer.email}}],isDraft:false,sentDateTime:new Date().toISOString(),internetMessageHeaders:[]}]});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/attachments'))return Response.json({value:[]});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/$value'))return new Response('Message-ID: '+messageId+'\r\nFrom: '+customer.email+'\r\nIn-Reply-To: '+reference+'\r\nSubject: TEST Outlook Antwort\r\n\r\nTEST Antwort auf eine andere Outlook-Mail.');
  if(url.hostname==='graph.microsoft.com')return Response.json({id:graphId,internetMessageId:messageId,subject:'TEST Outlook Antwort',from:{emailAddress:{name:'TEST Kunde',address:customer.email}},receivedDateTime:new Date(Date.now()+100).toISOString(),bodyPreview:'TEST Antwort',body:{contentType:'text',content:'TEST Antwort auf eine andere Outlook-Mail.'},hasAttachments:false});
  return nativeFetch(input,init);
 });
 expect(await withSession(full,()=>sendCustomerMailAction({targetType:'ORDER',targetId:order.orderId,subject:'TEST Fertig',body:'TEST Ware fertig',clientRequestId:randomUUID(),expectedInvoiceIds:[order.invoice.invoiceId],attachment:{kind:'INVOICE',documentId:order.invoice.invoiceId}}))).toMatchObject({code:'OK'});
 const {attachOutlookMailAction,listOutlookInboxAction}=await import('@/app/actions/communications.actions');
 const attachment={targetType:'CUSTOMER' as const,targetId:order.customerId,graphMessageId:graphId};
 expect(await withSession(full,()=>attachOutlookMailAction(attachment))).toMatchObject({code:'OK'});
 const attached=await withSession(full,()=>listOutlookInboxAction({targetType:'CUSTOMER',targetId:order.customerId}));
 expect(attached.code).toBe('OK');if(attached.code!=='OK')throw Error('K10_SAVED_READ');expect(attached.data.some(message=>message.id===graphId)).toBe(true);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='DISPATCH_REPLY_RETRY_REQUIRED_V1'`).toHaveLength(1);
 outage=false;
 const retryInput=JSON.parse(JSON.stringify(attachment));
 expect(await withSession(full,()=>attachOutlookMailAction(retryInput))).toMatchObject({code:'OK'});
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_CUSTOMER_REPLIED_V1'`).toHaveLength(0);
 const {readShippingSettingsAction,saveShippingSettingsAction}=await import('@/app/actions/settings.actions');
 const {emptyDispatchPolicy}=await import('@/modules/fundament/public');
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('K10_SETTINGS');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberPattern:settings.settings.numberPattern,numberHint:settings.settings.numberHint,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,dispatchPolicy:{...emptyDispatchPolicy(),reminderDays:0,secondReminderDays:0,callAfterDays:0,holdMinutes:0}}))).toMatchObject({code:'OK'});
 const {getOrdersDb}=await import('@/app/actions/orders.actions');
 for(const stage of ['E1','E2'] as const){
  const queue=await withSession(full,()=>getOrdersDb());if(!queue.ok)throw Error('K10_QUEUE');
  const reminder=queue.data.find(row=>row.id===order.orderId)?.finishedDispatch?.reminder;
  expect(reminder).toMatchObject({stage,state:'DUE'});if(!reminder?.due)throw Error('K10_DUE');
  const dueDate=reminder.due;
  expect(await withSession(full,()=>sendCustomerMailAction({targetType:'CUSTOMER',targetId:order.customerId,subject:'TEST Erinnerung',body:'TEST Abholung',clientRequestId:randomUUID(),collectionReminder:{stage,handover:'pickup',dueDate}}))).toMatchObject({code:'OK'});
 }
 expect(sends).toBe(3);
});

it('E06 one actual invoice mail includes the ready cohort and original PDFs, preserves the oldest per-order notice and replays its original cohort',async()=>{
 const requests:Array<{body:{content:string};attachments:Array<{name:string;contentBytes:string}>;internetMessageHeaders?:Array<{name:string;value:string}>}>=[];
 let replySender='',replyTo='',replyKey='',lookups=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-collective-token'.repeat(3),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){requests.push(JSON.parse(String(init?.body)).message);return new Response(null,{status:202});}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages')){lookups++;return Response.json({value:[{id:'TEST-collective-sent',internetMessageId:replyTo,from:{emailAddress:{address:'TEST-mailbox@example.invalid'}},toRecipients:[{emailAddress:{address:replySender}}],isDraft:false,sentDateTime:new Date().toISOString(),internetMessageHeaders:[{name:'x-kreile-request-id',value:replyKey}]}]});}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/attachments'))return Response.json({value:[]});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/$value'))return new Response('Message-ID: <TEST-customer-reply@example.invalid>\r\nFrom: '+replySender+'\r\nIn-Reply-To: '+replyTo+'\r\nReferences: '+replyTo+'\r\nSubject: TEST Antwort\r\n\r\nTEST Danke, ich hole die Ware.');
  if(url.hostname==='graph.microsoft.com')return Response.json({id:'TEST-collective-reply',internetMessageId:'<TEST-customer-reply@example.invalid>',subject:'TEST Antwort',from:{emailAddress:{name:'TEST Kunde',address:replySender}},receivedDateTime:new Date(Date.now()+100).toISOString(),bodyPreview:'TEST Danke',body:{contentType:'text',content:'TEST Danke, ich hole die Ware.'},hasAttachments:false});
  return nativeFetch(input,init);
 });
 const first=await readyInvoiceOrder('Sammel-Erster');
 const initial={targetType:'ORDER' as const,targetId:first.orderId,subject:'TEST Fertig',body:'TEST Deine Ware ist fertig.',expectedInvoiceIds:[first.invoice.invoiceId],attachment:{kind:'INVOICE' as const,documentId:first.invoice.invoiceId},clientRequestId:randomUUID()};
 expect(await withSession(full,()=>sendCustomerMailAction(initial))).toMatchObject({code:'OK'});
 const old=await withSession(full,()=>getLiveOrderCardAction({orderId:first.orderId}));
 if(old.code!=='OK'||old.data.customerInformed?.code!=='OK'||!old.data.customerInformed.firstInformed)throw Error('COLLECTIVE_INITIAL_PROOF');
 const original=old.data.customerInformed.firstInformed;
 const second=await readyInvoiceOrder('Sammel-Zweiter','pickup',false,first.customerId);
 const companion=await readyInvoiceOrder('Sammel-Neue-Begleitware','pickup',false,first.customerId);
 const shipping=await readyInvoiceOrder('Sammel-Andere-Uebergabe','shipping',false,first.customerId);
 const foreign=await readyInvoiceOrder('Sammel-Anderer-Kunde');
 const input={...initial,targetId:second.orderId,expectedInvoiceIds:[second.invoice.invoiceId,companion.invoice.invoiceId],attachment:{kind:'INVOICE' as const,documentId:second.invoice.invoiceId},clientRequestId:randomUUID()};
 const sent=await withSession(full,()=>sendCustomerMailAction(input));
 expect(sent).toMatchObject({code:'OK'});if(sent.code!=='OK')throw Error('COLLECTIVE_SEND:'+sent.code);
 expect(requests).toHaveLength(2);expect(requests[1].attachments).toHaveLength(2);
 const numbers=await sql`SELECT id,order_number FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id IN (${second.orderId},${companion.orderId})`;
 for(const order of numbers)expect(requests[1].body.content).toContain(order.order_number);
 const stored=await sql`SELECT pdf_sha256 FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id IN (${second.invoice.invoiceId}::uuid,${companion.invoice.invoiceId}::uuid)`;
 expect(requests[1].attachments.map(file=>createHash('sha256').update(Buffer.from(file.contentBytes,'base64')).digest('hex')).sort()).toEqual(stored.map(row=>row.pdf_sha256).sort());
 for(const order of [second,companion])expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{customerInformed:{code:'OK',ampel:'gruen',informed:{threadId:sent.data.threadId,channel:'mail',actorId:full.actorId}}}});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:first.orderId}))).toMatchObject({code:'OK',data:{customerInformed:{firstInformed:{eventId:original.eventId,recordedAt:original.recordedAt}}}});
 for(const order of [shipping,foreign])expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{customerInformed:{informed:null}}});
 const third=await readyInvoiceOrder('Sammel-Spaeter','pickup',false,first.customerId);
 expect(await withSession(full,()=>sendCustomerMailAction(structuredClone(input)))).toMatchObject({code:'OK',data:{threadId:sent.data.threadId,replayed:true}});
 expect(requests).toHaveLength(2);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:third.orderId}))).toMatchObject({code:'OK',data:{customerInformed:{informed:null}}});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_CUSTOMER_INFORMED_V1' AND payload->'receipt'->>'threadId'=${sent.data.threadId}`).toEqual([{n:2}]);
 const {readShippingSettingsAction,saveShippingSettingsAction}=await import('@/app/actions/settings.actions');
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('COHORT_SETTINGS');
 const {emptyDispatchPolicy}=await import('@/modules/fundament/public');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberPattern:settings.settings.numberPattern,numberHint:settings.settings.numberHint,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,dispatchPolicy:{...emptyDispatchPolicy(),reminderDays:0}}))).toMatchObject({code:'OK'});
 const {getOrdersDb}=await import('@/app/actions/orders.actions');
 const queue=await withSession(full,()=>getOrdersDb());if(!queue.ok)throw Error('COHORT_QUEUE');
 const group=queue.data.find(row=>row.id===first.orderId)?.finishedDispatch?.reminder;
 expect(group).toMatchObject({state:'DUE',oldestNoticeAt:original.recordedAt,automaticSend:false,requiresResponseCheck:false,responseState:'NONE',needsNotice:[third.orderId]});
 expect(group!.orderIds.slice().sort()).toEqual([first.orderId,second.orderId,companion.orderId,third.orderId].sort());
 expect(queue.data.find(row=>row.id===second.orderId)?.finishedDispatch?.reminder?.clientKey).toBe(group!.clientKey);
 expect(requests[1].internetMessageHeaders).toEqual([{name:'x-kreile-request-id',value:input.clientRequestId}]);
 const [customer]=await sql`SELECT email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${first.customerId}`;
 replySender=customer.email;replyTo='<TEST-sent-'+input.clientRequestId+'@example.invalid>';replyKey=input.clientRequestId;
 const {attachOutlookMailAction}=await import('@/app/actions/communications.actions');
 expect(await withSession(full,()=>attachOutlookMailAction({targetType:'CUSTOMER',targetId:first.customerId,graphMessageId:'TEST-collective-reply'}))).toMatchObject({code:'OK'});
 const {resolveAuthorization}=await import('@/lib/server/authorization');
 const {readDispatchResponses}=await import('@/lib/server/dispatchResponsePort');
 const {readLinkedIntakeMails}=await import('@/modules/eingang/server-public');
 const response=await withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('REPLY_SCOPE_AUTH');return readDispatchResponses(auth.data,{customerId:first.customerId,noticeThreadIds:[sent.data.threadId],oldestNoticeAt:original.recordedAt},{readLinked:readLinkedIntakeMails});});
 expect(response.state).toBe('REPLIED');
 const originalFreezes=await sql`SELECT order_id AS "orderId",id::text AS "freezeId" FROM private.order_freezes WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id IN (${second.orderId},${companion.orderId}) ORDER BY order_id`;
 expect(response.proofs).toHaveLength(1);
 expect(response.proofs[0].freezes.slice().sort((a,b)=>a.orderId.localeCompare(b.orderId))).toEqual([...originalFreezes]);
 const replyEvents=await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REPLY_RECORDED_V1'`;
 expect(replyEvents).toEqual([{user_id:full.actorId}]);
 const [beforeRead]=await sql`SELECT count(*)::int AS count FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const beforeReadGraph=lookups;
 const reacted=await withSession(full,()=>getOrdersDb());if(!reacted.ok)throw Error('COHORT_REACTION_READ');
 expect(await sql`SELECT count(*)::int AS count FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual([beforeRead]);
 expect(lookups).toBe(beforeReadGraph);
 expect(reacted.data.find(row=>row.id===second.orderId)?.finishedDispatch?.reminder).toMatchObject({state:'STOPPED',responseState:'REPLIED',automaticSend:false});
 expect(await sql`SELECT station FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${first.orderId}`).toEqual([{station:'fertig'}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND graph_message_id='TEST-collective-reply' AND kunde_id=${first.customerId}`).toEqual([{n:1}]);
 const afterReply=await readyInvoiceOrder('Sammel-Nach-Antwort','pickup',false,first.customerId);
 expect(await withSession(full,()=>sendCustomerMailAction({...initial,targetId:afterReply.orderId,expectedInvoiceIds:[third.invoice.invoiceId,afterReply.invoice.invoiceId],attachment:{kind:'INVOICE',documentId:afterReply.invoice.invoiceId},clientRequestId:randomUUID()}))).toMatchObject({code:'OK'});
 const laterQueue=await withSession(full,()=>getOrdersDb());if(!laterQueue.ok)throw Error('REPLY_SCOPE_QUEUE');
 for(const id of [second.orderId,companion.orderId])expect(laterQueue.data.find(row=>row.id===id)?.finishedDispatch?.reminder).toMatchObject({state:'STOPPED',responseState:'REPLIED'});
 for(const id of [third.orderId,afterReply.orderId])expect(laterQueue.data.find(row=>row.id===id)?.finishedDispatch?.reminder).toMatchObject({stage:'E1',state:'DUE'});
 expect(laterQueue.data.find(row=>row.id===third.orderId)?.finishedDispatch?.reminder?.orderIds.slice().sort()).toEqual([first.orderId,third.orderId,afterReply.orderId].sort());
 replyKey=randomUUID(); // A proved different outgoing request is not a reaction to this notice.
 const unrelated=await withSession(full,()=>getOrdersDb());if(!unrelated.ok)throw Error('COHORT_UNRELATED_READ');
 expect(unrelated.data.find(row=>row.id===second.orderId)?.finishedDispatch?.reminder).toMatchObject({state:'STOPPED',responseState:'REPLIED'});
 expect(unrelated.data.find(row=>row.id===third.orderId)?.finishedDispatch?.reminder).toMatchObject({state:'DUE',responseState:'NONE'});
 replyKey='TEST-invalid-header';
 const uncertain=await withSession(full,()=>getOrdersDb());if(!uncertain.ok)throw Error('COHORT_UNCERTAIN_READ');
 expect(uncertain.data.find(row=>row.id===second.orderId)?.finishedDispatch?.reminder).toMatchObject({state:'STOPPED',responseState:'REPLIED'});
 expect(uncertain.data.find(row=>row.id===third.orderId)?.finishedDispatch?.reminder).toMatchObject({state:'DUE',responseState:'NONE',requiresResponseCheck:false});
 const operational=await createFixture(['auftraege'],'werkstatt'),beforeLookup=lookups;
 const limited=await withSession(operational,()=>getOrdersDb());if(!limited.ok)throw Error('COHORT_LIMITED_READ');
 expect(limited.data.find(row=>row.id===second.orderId)?.finishedDispatch?.reminder).toMatchObject({responseState:'REPLIED',requiresResponseCheck:false});
 expect(limited.data.find(row=>row.id===third.orderId)?.finishedDispatch?.reminder).toMatchObject({responseState:'NONE',requiresResponseCheck:false});
 expect(lookups).toBe(beforeLookup);expect(requests).toHaveLength(3);
 // The recorded reaction is idempotent and remains conditional on its actual immutable receipt.
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REPLY_RECORDED_V1'`).toEqual([{n:1}]);
 const [{id:replyEventId}]=await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REPLY_RECORDED_V1'`;
 const {withPrivilegedTenantTransaction}=await import('@/lib/server/privilegedDb');
 const {storageOriginIsCurrent,qualifyStorageOrigin}=await import('@/lib/server/pickupAppointmentPort');
 const {berlinCalendarDay}=await import('@/lib/domain/workingDays');
 await withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('REPLY_ORIGIN_AUTH');await withPrivilegedTenantTransaction(auth.data,async tx=>{
  const origin={replyEventId,freezes:response.proofs[0].freezes};
  expect(await storageOriginIsCurrent(tx,auth.data,origin,berlinCalendarDay())).toBe(true);
  await expect(qualifyStorageOrigin(tx,auth.data,{...origin,callTaskId:randomUUID()})).rejects.toThrow('STORAGE_ORIGIN_NOT_UNIQUE');
  await expect(qualifyStorageOrigin(tx,auth.data,{...origin,freezes:[{orderId:first.orderId,freezeId:randomUUID()}]})).rejects.toThrow('STORAGE_REPLY_FREEZE_INVALID');
 });});
 await sql`UPDATE public.events SET payload=jsonb_set(payload,'{receipt,actorId}',to_jsonb(${randomUUID()}::text)) WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REPLY_RECORDED_V1'`;
 const corrupted=await withSession(operational,()=>getOrdersDb());if(!corrupted.ok)throw Error('COHORT_CORRUPTED_RECEIPT_READ');
 expect(corrupted.data.find(row=>row.id===first.orderId)?.finishedDispatch).toMatchObject({unavailable:true,gaps:expect.arrayContaining(['COLLECTION_PROOF_UNAVAILABLE'])});
 expect(lookups).toBe(beforeLookup);
});

it('K1 a later invoice mail excludes an already sent original and a fresh retry sends nothing twice',async()=>{
 const requests:Array<{attachments:Array<{name:string}>}>=[];
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-K1-token'.repeat(10),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){requests.push(JSON.parse(String(init?.body)).message);return new Response(null,{status:202});}
  return nativeFetch(input,init);
 });
 const first=await readyInvoiceOrder('K1 erster Originalbeleg');
 const initial={targetType:'ORDER' as const,targetId:first.orderId,subject:'TEST K1 Fertig',body:'TEST K1 Ware fertig',expectedInvoiceIds:[first.invoice.invoiceId],attachment:{kind:'INVOICE' as const,documentId:first.invoice.invoiceId},clientRequestId:randomUUID()};
 expect(await withSession(full,()=>sendCustomerMailAction(initial))).toMatchObject({code:'OK'});
 const second=await readyInvoiceOrder('K1 spaeterer Originalbeleg','pickup',false,first.customerId);
 const input={...initial,targetId:second.orderId,expectedInvoiceIds:[second.invoice.invoiceId],attachment:{kind:'INVOICE' as const,documentId:second.invoice.invoiceId},clientRequestId:randomUUID()};
 const sent=await withSession(full,()=>sendCustomerMailAction(input));expect(sent).toMatchObject({code:'OK'});
 expect(requests).toHaveLength(2);expect(requests[1].attachments).toHaveLength(1);
 expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',data:{replayed:true}});
 expect(await withSession(full,()=>sendCustomerMailAction({...input,clientRequestId:randomUUID()}))).toMatchObject({code:'CONFLICT',message:expect.stringContaining('wurde schon am')});
 expect(requests).toHaveLength(2);
 const next=await readyInvoiceOrder('K1 sichtbare Liste','pickup',false,first.customerId);
 const added=await readyInvoiceOrder('K1 nach Anzeige hinzugekommen','pickup',false,first.customerId);
 const stale={...initial,targetId:next.orderId,expectedInvoiceIds:[next.invoice.invoiceId],attachment:{kind:'INVOICE' as const,documentId:next.invoice.invoiceId},clientRequestId:randomUUID()};
 expect(await withSession(full,()=>sendCustomerMailAction(stale))).toMatchObject({code:'VALIDATION_ERROR',message:expect.stringContaining('dazugekommen')});
 expect(requests).toHaveLength(2);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND correlation_id=${stale.clientRequestId}::uuid`).toHaveLength(0);
 const current={...stale,expectedInvoiceIds:[next.invoice.invoiceId,added.invoice.invoiceId]};
 expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(current))))).toMatchObject({code:'OK'});
 expect(requests).toHaveLength(3);expect(requests[2].attachments).toHaveLength(2);
 expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(current))))).toMatchObject({code:'OK',data:{replayed:true}});
 expect(requests).toHaveLength(3);
});
