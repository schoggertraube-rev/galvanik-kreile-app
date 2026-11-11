// @vitest-environment node
import {vi,it,expect} from 'vitest';
import {createHash,randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,nativeFetch} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {sendCustomerMailAction,importOutlookMailAction,attachOutlookMailAction} from '@/app/actions/communications.actions';
import {getOrdersDb,getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {createDispatchCallTaskAction} from '@/app/actions/eingang.actions';
import {updateCustomerAction} from '@/app/actions/customers.actions';
import {readShippingSettingsAction,saveShippingSettingsAction} from '@/app/actions/settings.actions';
import {emptyDispatchPolicy} from '@/modules/fundament/public';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('BOUNCE_LOOPBACK_REQUIRED');
function mime(messageId:string,recipient:string,action='failed',status='5.1.1'){
 return 'Message-ID: <TEST-report@example.invalid>\r\nFrom: postmaster@example.invalid\r\nContent-Type: multipart/report; report-type=delivery-status; boundary="TEST-report"\r\n\r\n--TEST-report\r\nContent-Type: text/plain\r\n\r\nTEST untrusted human body\r\n--TEST-report\r\nContent-Type: message/delivery-status\r\n\r\nReporting-MTA: dns; TEST.example.invalid\r\n\r\nFinal-Recipient: rfc822; '+recipient+'\r\nAction: '+action+'\r\nStatus: '+status+'\r\n\r\n--TEST-report\r\nContent-Type: text/rfc822-headers\r\n\r\nMessage-ID: '+messageId+'\r\nFrom: TEST-mailbox@example.invalid\r\nTo: '+recipient+'\r\n--TEST-report--\r\n';
}
function provider(){
 const state={graphId:'TEST-dsn-'+randomUUID(),requestId:randomUUID(),originalId:'<TEST-original-'+randomUUID()+'@example.invalid>',recipient:'',mime:'',blocked:false,lookups:0,sends:0,fetches:0,mails:[] as Array<{to:string[];hashes:string[]}>};
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='graph.microsoft.com'||url.hostname==='login.microsoftonline.com'){state.fetches++;if(state.blocked)throw Error('TEST_GRAPH_OFFLINE_AFTER_IMPORT');}
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-bounce-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){const message=JSON.parse(String(init?.body)).message;state.mails.push({to:message.toRecipients.map((row:{emailAddress:{address:string}})=>row.emailAddress.address),hashes:(message.attachments??[]).map((row:{contentBytes:string})=>createHash('sha256').update(Buffer.from(row.contentBytes,'base64')).digest('hex'))});state.sends++;return new Response(null,{status:202});}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages')){state.lookups++;return Response.json({value:[{id:'TEST-actual-sent',internetMessageId:state.originalId,from:{emailAddress:{address:'TEST-mailbox@example.invalid'}},toRecipients:[{emailAddress:{address:state.recipient}}],isDraft:false,sentDateTime:new Date().toISOString(),internetMessageHeaders:[{name:'x-kreile-request-id',value:state.requestId}]}]});}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/attachments'))return Response.json({value:[]});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/$value'))return new Response(state.mime);
  if(url.hostname==='graph.microsoft.com')return Response.json({id:state.graphId,internetMessageId:'<'+state.graphId+'@example.invalid>',subject:'TEST Unzustellbar',from:{emailAddress:{name:'TEST postmaster',address:'postmaster@example.invalid'}},receivedDateTime:new Date().toISOString(),bodyPreview:'TEST Unzustellbar',body:{contentType:'text',content:'TEST Nicht aus diesem Text entscheiden'},hasAttachments:false});
  return nativeFetch(input,init);
 });return state;
}
async function configure(){const read=await withSession(full,()=>readShippingSettingsAction());if(read.code!=='OK')throw Error('BOUNCE_SETTINGS');expect(await withSession(full,()=>saveShippingSettingsAction({service:read.settings.service,numberPattern:read.settings.numberPattern,numberHint:read.settings.numberHint,trackingUrl:read.settings.trackingUrl,expectedUpdatedAt:read.settings.updatedAt,dispatchPolicy:{...emptyDispatchPolicy(),reminderDays:99}}))).toMatchObject({code:'OK'});}

it.each([false,true])('E03 imports one secured original, binds the actual failed outgoing mail and immediately proposes the one callback; retry works without Outlook (bundle=%s)',async(bundle)=>{
 const state=provider(),order=await readyInvoiceOrder('E03-Zurück');
 const second=bundle?await readyInvoiceOrder('E03 zweites Original','pickup',false,order.customerId):undefined,expectedInvoiceIds=[order.invoice.invoiceId,...(second?[second.invoice.invoiceId]:[])];
 const [customer]=await sql`SELECT email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.customerId}`;state.recipient=customer.email;
 const sent=await withSession(full,()=>sendCustomerMailAction({targetType:'ORDER',targetId:order.orderId,clientRequestId:state.requestId,subject:'TEST Fertig',body:'TEST Ware fertig',expectedInvoiceIds,attachment:{kind:'INVOICE',documentId:order.invoice.invoiceId}}));if(sent.code!=='OK')throw Error('BOUNCE_SEND');
 await configure();state.mime=mime(state.originalId,state.recipient);
 const imported=await withSession(full,()=>importOutlookMailAction(state.graphId));expect(imported).toMatchObject({code:'OK'});if(imported.code!=='OK')throw Error('BOUNCE_IMPORT:'+imported.code);
 expect(await sql`SELECT kunde_id,zuordnung FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${imported.itemId}::uuid`).toEqual([{kunde_id:order.customerId,zuordnung:'hand'}]);
 const originalHash=createHash('sha256').update(state.mime).digest('hex');
 expect(await sql`SELECT sha256 FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${imported.itemId}::uuid AND mime='message/rfc822'`).toEqual([{sha256:originalHash}]);
 expect(await sql`SELECT user_id::text,payload->>'threadId' AS thread,payload->>'originalSha256' AS sha FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_DELIVERY_FAILED_V1' AND payload->>'itemId'=${imported.itemId}`).toEqual([{user_id:full.actorId,thread:sent.data.threadId,sha:originalHash}]);
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));expect(card).toMatchObject({code:'OK',data:{customerInformed:{informed:null,ampel:'rot',failedDelivery:{threadId:sent.data.threadId}}}});
 const queue=await withSession(full,()=>getOrdersDb());if(!queue.ok)throw Error('BOUNCE_QUEUE');const plan=queue.data.find(row=>row.id===order.orderId)?.finishedDispatch?.reminder;
 expect(plan).toMatchObject({stage:'E3',state:'DUE',requiresResponseCheck:false,needsNotice:[]});if(!plan?.due)throw Error('BOUNCE_DUE');
 expect(await withSession(full,()=>createDispatchCallTaskAction({customerId:order.customerId,handover:'pickup',dueDate:plan.due!,clientKey:plan.clientKey!}))).toMatchObject({code:'OK'});
 state.blocked=true;const before=state.fetches;
 expect(await withSession(full,()=>importOutlookMailAction(state.graphId))).toMatchObject({code:'OK',itemId:imported.itemId,replayed:true});expect(state.fetches).toBe(before);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_DELIVERY_FAILED_V1' AND payload->>'itemId'=${imported.itemId}`).toEqual([{n:1}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.communication_messages WHERE tenant_id=${KREILE_TENANT_SLUG} AND direction='incoming' AND thread_id IN (SELECT id FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${order.customerId})`).toEqual([{n:0}]);
 state.blocked=false;const sendCount=state.sends;
 const retryInput={targetType:'ORDER' as const,targetId:order.orderId,clientRequestId:randomUUID(),subject:'TEST korrigierte Adresse',body:'TEST Ware fertig',expectedInvoiceIds,attachment:{kind:'INVOICE' as const,documentId:order.invoice.invoiceId}};
 expect(await withSession(full,()=>sendCustomerMailAction(retryInput))).toMatchObject({code:'CONFLICT'});expect(state.sends).toBe(sendCount);
 const correctionKey=randomUUID();expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:correctionKey,email:'TEST-corrected@example.invalid'}))).toMatchObject({code:'OK'});
 const corrected=await withSession(full,()=>sendCustomerMailAction(retryInput));if(corrected.code!=='OK')throw Error('BOUNCE_CORRECTED:'+JSON.stringify(corrected));
 expect(state.sends).toBe(sendCount+1);expect(state.mails.at(-1)?.to).toEqual(['test-corrected@example.invalid']);expect(state.mails.at(-1)?.hashes).toEqual(state.mails[0].hashes);expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(retryInput))))).toMatchObject({code:'OK',data:{replayed:true}});
 expect(await withSession(full,()=>sendCustomerMailAction({...retryInput,clientRequestId:randomUUID()}))).toMatchObject({code:'CONFLICT'});expect(state.sends).toBe(sendCount+1);
 const [resend]=await sql`SELECT payload->'document' AS document FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND payload->>'threadId'=${corrected.data.threadId}`;
 const [firstOriginal]=await sql`SELECT payload->'document'->>'sha256' AS sha,payload->'document' AS document FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND payload->>'threadId'=${sent.data.threadId}`;
 const [correction]=await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='CUSTOMER_UPDATED_V1' AND client_event_id=${correctionKey}::uuid`;
 expect(resend.document).toMatchObject({sha256:firstOriginal.sha,resend:{bounceItemId:imported.itemId,bouncedThreadId:sent.data.threadId,correctionEventId:correction.id,recipient:'test-corrected@example.invalid'}});expect(resend.document.resend.originals).toEqual([firstOriginal.document,...firstOriginal.document.bundle??[]].map((row:{id:string;sha256:string})=>({id:row.id,sha256:row.sha256})));
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{customerInformed:{informed:{threadId:corrected.data.threadId},failedDelivery:null}}});
 await sql`UPDATE public.intake_event SET nachher=jsonb_set(nachher,'{deliveryReport,originalSha256}',to_jsonb(repeat('0',64))) WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${imported.itemId}::uuid AND art='angelegt'`;
 const broken=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));expect(broken.code==='OK'&&broken.data.customerInformed?.code).toBe('UNAVAILABLE');
});

it('human subjects, delayed reports and the wrong failed recipient do not become a failed-delivery fact or a customer reply',async()=>{
 const state=provider(),order=await readyInvoiceOrder('E03-Grenzen');
 const [customer]=await sql`SELECT email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.customerId}`;state.recipient=customer.email;
 expect(await withSession(full,()=>sendCustomerMailAction({targetType:'ORDER',targetId:order.orderId,clientRequestId:state.requestId,subject:'TEST Fertig',body:'TEST Ware fertig',expectedInvoiceIds:[order.invoice.invoiceId],attachment:{kind:'INVOICE',documentId:order.invoice.invoiceId}}))).toMatchObject({code:'OK'});await configure();
 state.mime='Subject: TEST Unzustellbar\r\nMessage-ID: <TEST-human@example.invalid>\r\n\r\nTEST Action: failed';
 expect(await withSession(full,()=>importOutlookMailAction(state.graphId))).toMatchObject({code:'OK'});expect(state.lookups).toBe(0);
 state.graphId='TEST-delayed-'+randomUUID();state.mime=mime(state.originalId,state.recipient,'delayed','4.2.0');
 expect(await withSession(full,()=>attachOutlookMailAction({targetType:'CUSTOMER',targetId:order.customerId,graphMessageId:state.graphId}))).toMatchObject({code:'OK'});expect(state.lookups).toBe(0);
 state.graphId='TEST-wrong-'+randomUUID();state.mime=mime(state.originalId,'TEST-wrong@example.invalid');
 expect(await withSession(full,()=>importOutlookMailAction(state.graphId))).toMatchObject({code:'IN_KLAERUNG'});
 expect(await sql`SELECT kunde_id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND graph_message_id=${state.graphId}`).toEqual([{kunde_id:null}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_DELIVERY_FAILED_V1' AND payload->>'clientRequestId'=${state.requestId}`).toEqual([{n:0}]);
 const queue=await withSession(full,()=>getOrdersDb());expect(queue.ok&&queue.data.find(row=>row.id===order.orderId)?.finishedDispatch?.reminder).toMatchObject({stage:'E1',state:'WAIT'});
});
