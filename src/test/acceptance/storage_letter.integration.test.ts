// @vitest-environment node
import {vi,it,expect} from 'vitest';
import {randomUUID,createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,nativeFetch,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {sendCustomerMailAction} from '@/app/actions/communications.actions';
import {getOrdersDb} from '@/app/actions/orders.actions';
import {createDispatchCallTaskAction,createStorageFinalTaskAction,getIntakeTaskAction,completeIntakeTaskAction,saveIntakeTaskAction,saveIntakeNoteAction,getIntakeCaptureAction} from '@/app/actions/eingang.actions';
import {previewStorageLetterAction,prepareStoragePostalLetterAction} from '@/app/actions/pdf.actions';
import {updateCustomerAction} from '@/app/actions/customers.actions';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import {recordGoodsOutAction} from '@/app/actions/goodsOut.actions';
import {markOrderInformedByPhoneAction,setOrderPickupAppointmentAction} from '@/app/actions/orders.actions';
import {readShippingSettingsAction,saveShippingSettingsAction} from '@/app/actions/settings.actions';
import {emptyDispatchPolicy} from '@/modules/fundament/public';
import {COLLECTION_REMINDER_COPY} from '@/ui/situationCatalog';
import {pickupStorageDue} from '@/lib/server/pickupAppointmentPort';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('STORAGE_LETTER_LOOPBACK_REQUIRED');

async function prepareLetter(label:string,endCall=true,shared=false){
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-storage-letter-token'.repeat(4),expires_in:3600});if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail'))return new Response(null,{status:202});return nativeFetch(input,init);});
 const order=await readyInvoiceOrder(label);
 expect(await withSession(full,()=>sendCustomerMailAction({targetType:'ORDER',targetId:order.orderId,clientRequestId:randomUUID(),subject:'TEST Ware fertig',body:'TEST Ware fertig',attachment:{kind:'INVOICE',documentId:order.invoice.invoiceId}}))).toMatchObject({code:'OK'});
 const second=shared?await readyInvoiceOrder(label+' zweite Ware','pickup',false,order.customerId):undefined;
 if(second)expect(await withSession(full,()=>sendCustomerMailAction({targetType:'ORDER',targetId:second.orderId,clientRequestId:randomUUID(),subject:'TEST weitere Ware fertig',body:'TEST weitere Ware fertig',attachment:{kind:'INVOICE',documentId:second.invoice.invoiceId}}))).toMatchObject({code:'OK'});
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('LETTER_SETTINGS');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberPattern:settings.settings.numberPattern,numberHint:settings.settings.numberHint,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,dispatchPolicy:{...emptyDispatchPolicy(),reminderDays:0,secondReminderDays:0,callAfterDays:0,storageAfterDays:0,finalStageAfterLetterDays:4,holdMinutes:0}}))).toMatchObject({code:'OK'});
 async function plan(){const queue=await withSession(full,()=>getOrdersDb());if(!queue.ok)throw Error('LETTER_QUEUE');return queue.data.find(row=>row.id===order.orderId)?.finishedDispatch;}
 for(const stage of ['E1','E2'] as const){const p=await plan();expect(await withSession(full,()=>sendCustomerMailAction({targetType:'CUSTOMER',targetId:order.customerId,clientRequestId:randomUUID(),subject:'TEST '+stage,body:'TEST Bitte abholen',collectionReminder:{stage,handover:'pickup',dueDate:p!.reminder!.due!}}))).toMatchObject({code:'OK'});}
 const initial=await plan(),call=await withSession(full,()=>createDispatchCallTaskAction({customerId:order.customerId,handover:'pickup',dueDate:initial!.reminder!.due!,clientKey:initial!.reminder!.clientKey!}));if(call.code!=='OK')throw Error('LETTER_CALL');
 const task=await withSession(full,()=>getIntakeTaskAction({taskId:call.taskId}));if(task.code!=='OK'||!task.task)throw Error('LETTER_CALL_TASK');
 if(endCall)expect(await withSession(full,()=>completeIntakeTaskAction({taskId:call.taskId,version:task.task!.version,note:'TEST nicht erreicht',callResult:'notReached'}))).toMatchObject({code:'OK'});
 const due=await plan(),request={customerId:order.customerId,handover:'pickup' as const,clientKey:endCall?due!.storage!.letter!.clientKey:due!.reminder!.clientKey!};
 return {order,request,plan,callTaskId:call.taskId,second};
}
async function prepareWithoutMail(label:string){
 const order=await readyInvoiceOrder(label);
 expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),email:''}))).toMatchObject({code:'OK'});
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('NO_MAIL_SETTINGS');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberPattern:settings.settings.numberPattern,numberHint:settings.settings.numberHint,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,dispatchPolicy:{...emptyDispatchPolicy(),storageAfterDays:0,finalStageAfterLetterDays:0,finalStageRecipientId:full.actorId}}))).toMatchObject({code:'OK'});
 async function plan(){const queue=await withSession(full,()=>getOrdersDb());if(!queue.ok)throw Error('NO_MAIL_QUEUE');return queue.data.find(row=>row.id===order.orderId);}
 const row=await plan(),initial=row?.finishedDispatch?.reminder;expect(initial).toMatchObject({stage:'E3',state:'DUE'});if(!initial?.due||!initial.clientKey)throw Error('NO_MAIL_INITIAL');
 const call=await withSession(full,()=>createDispatchCallTaskAction({customerId:order.customerId,handover:'pickup',dueDate:initial.due!,clientKey:initial.clientKey!}));if(call.code!=='OK')throw Error('NO_MAIL_CALL');
 const task=await withSession(full,()=>getIntakeTaskAction({taskId:call.taskId}));if(task.code!=='OK'||!task.task)throw Error('NO_MAIL_TASK');
 expect(await withSession(full,()=>completeIntakeTaskAction({taskId:call.taskId,version:task.task!.version,note:'TEST nicht erreicht',callResult:'notReached'}))).toMatchObject({code:'OK'});
 const due=await plan();expect(due?.finishedDispatch?.storage).toMatchObject({state:'DUE'});
 const request={customerId:order.customerId,handover:'pickup' as const,clientKey:due!.finishedDispatch!.storage!.letter!.clientKey};return {order,request,plan};
}
async function attachReplyToOriginalNotice(order:{orderId:string;customerId:string},identity:string){
 const [notice]=await sql`SELECT thread.source,customer.email FROM public.events event JOIN public.communication_threads thread ON thread.tenant_id=event.tenant_id AND thread.id::text=event.payload->'receipt'->>'threadId' JOIN public.customers customer ON customer.tenant_id=event.tenant_id AND customer.id=${order.customerId} WHERE event.tenant_id=${KREILE_TENANT_SLUG} AND event.order_id=${order.orderId} AND event.event_type='ORDER_CUSTOMER_INFORMED_V1' LIMIT 1`;
 const reference='<TEST-sent-'+order.orderId+'@example.invalid>';
 const notices=await sql`SELECT thread.source,event.order_id FROM public.events event JOIN public.communication_threads thread ON thread.tenant_id=event.tenant_id AND thread.id::text=event.payload->'receipt'->>'threadId' WHERE event.tenant_id=${KREILE_TENANT_SLUG} AND event.event_type='ORDER_CUSTOMER_INFORMED_V1' AND thread.customer_id=${order.customerId}`;
 vi.mocked(globalThis.fetch).mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-source-reply-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'){
   if(url.pathname.includes('/mailFolders/sentitems/messages')){const selected=notices.find(item=>(url.searchParams.get('$filter')??'').includes('<TEST-sent-'+item.order_id+'@example.invalid>'));return Response.json({value:[{id:'TEST-sent-'+(selected?.order_id??order.orderId),internetMessageId:selected?'<TEST-sent-'+selected.order_id+'@example.invalid>':reference,from:{emailAddress:{address:'TEST-mailbox@example.invalid'}},toRecipients:[{emailAddress:{address:notice.email}}],isDraft:false,sentDateTime:new Date().toISOString(),internetMessageHeaders:[{name:'x-kreile-request-id',value:(selected?.source??notice.source).replace('MS_GRAPH_OUT:','')}]}]});}
   if(url.pathname.endsWith('/attachments'))return Response.json({value:[]});
   if(url.pathname.endsWith('/$value'))return new Response('Message-ID: <'+identity+'@example.invalid>\r\nFrom: '+notice.email+'\r\nIn-Reply-To: '+reference+'\r\nSubject: TEST Antwort\r\n\r\nTEST ich melde mich.');
   return Response.json({id:identity,internetMessageId:'<'+identity+'@example.invalid>',subject:'TEST Antwort',from:{emailAddress:{name:'TEST Kunde',address:notice.email}},receivedDateTime:new Date(Date.now()+100).toISOString(),bodyPreview:'TEST Antwort',body:{contentType:'text',content:'TEST ich melde mich.'},hasAttachments:false});
  }return nativeFetch(input,init);
 });
 const {attachOutlookMailAction}=await import('@/app/actions/communications.actions');
 expect(await withSession(full,()=>attachOutlookMailAction({targetType:'CUSTOMER',targetId:order.customerId,graphMessageId:identity}))).toMatchObject({code:'OK'});
}
it.each(['reply','goodsOut'] as const)('a reply to A narrows the shared E5 task to B, preserves the posted original and finishes through %s',async(ending)=>{
 const {order,second,request,plan}=await prepareLetter('Teilantwort finale Aufgabe',true,true);
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('PARTIAL_FINAL_SETTINGS');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberPattern:settings.settings.numberPattern,numberHint:settings.settings.numberHint,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,dispatchPolicy:{...settings.settings.dispatchPolicy!,finalStageAfterLetterDays:0,finalStageRecipientId:full.actorId}}))).toMatchObject({code:'OK'});
 const [customer]=await sql`SELECT email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.customerId}`;
 expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),email:''}))).toMatchObject({code:'OK'});
 const original=await withSession(full,()=>prepareStoragePostalLetterAction(request));if(original.code!=='OK')throw Error('PARTIAL_FINAL_ORIGINAL:'+original.code);
 const task=await withSession(full,()=>getIntakeTaskAction({taskId:original.taskId}));if(task.code!=='OK'||!task.task)throw Error('PARTIAL_FINAL_POST_TASK');
 expect(await withSession(full,()=>completeIntakeTaskAction({taskId:original.taskId,version:task.task!.version,note:'TEST versandt',postalResult:{kind:'posted',postedOn:berlinCalendarDay(),documentSha256:original.document.sha256}}))).toMatchObject({code:'OK'});
 const final=await withSession(full,()=>createStorageFinalTaskAction(request));if(final.code!=='OK')throw Error('PARTIAL_FINAL_TASK:'+final.code);
 expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),email:customer.email}))).toMatchObject({code:'OK'});
 await attachReplyToOriginalNotice(order,'TEST-partial-final-'+order.orderId);
 const operator=await createFixture(['auftraege','mails'],'werkstatt');
 const queue=await withSession(operator,()=>getOrdersDb());if(!queue.ok)throw Error('PARTIAL_FINAL_QUEUE');
 expect(queue.data.find(row=>row.id===order.orderId)?.finishedDispatch?.reminder).toMatchObject({responseState:'REPLIED'});
 expect(await sql`SELECT payload->'meta'->'orders'->0->>'id' AS id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_STORAGE_FINAL_TASK_UPDATED_V1' AND payload->>'taskId'=${final.taskId}`).toEqual([{id:second!.orderId}]);
 expect(await withSession(operator,()=>getIntakeTaskAction({taskId:final.taskId}))).toMatchObject({code:'OK',task:{status:'offen'},reference:{type:'auftrag',id:second!.orderId}});
 expect(await withSession(full,()=>getIntakeTaskAction({taskId:original.taskId}))).toMatchObject({code:'OK',postalLetter:{state:'POSTED',document:{sha256:original.document.sha256}}});
 await plan();expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_STORAGE_FINAL_TASK_UPDATED_V1' AND payload->>'taskId'=${final.taskId}`).toEqual([{n:1}]);
 if(ending==='reply'){
  await attachReplyToOriginalNotice(second!,'TEST-partial-final-B-'+second!.orderId);
  const afterB=await withSession(operator,()=>getOrdersDb());if(!afterB.ok)throw Error('PARTIAL_FINAL_B_QUEUE');
 }else{
  const current=queue.data.find(row=>row.id===second!.orderId)!;
  expect(await withSession(full,()=>recordGoodsOutAction({orderId:second!.orderId,mode:'abholung',expectedVersion:current.version,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  expect(await sql`SELECT station FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{station:'fertig'}]);
 }
 expect(await sql`SELECT status,erledigt_von::text AS actor FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${final.taskId}::uuid`).toEqual([{status:'erledigt',actor:ending==='reply'?operator.actorId:full.actorId}]);
 expect(await withSession(operator,()=>getIntakeTaskAction({taskId:final.taskId}))).toMatchObject({code:'OK',task:{status:'erledigt'}});
});
it('a reply to A atomically replaces the unposted A+B PDF with B, preserving originals and rolling back a missing replacement receipt',async()=>{
 const {order,second,request,plan}=await prepareLetter('Teilantwort unversandter Brief',true,true);
 const [customer]=await sql`SELECT email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.customerId}`;
 expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),email:''}))).toMatchObject({code:'OK'});
 const original=await withSession(full,()=>prepareStoragePostalLetterAction(request));if(original.code!=='OK')throw Error('PARTIAL_POST_ORIGINAL:'+original.code);
 expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),email:customer.email}))).toMatchObject({code:'OK'});
 await attachReplyToOriginalNotice(order,'TEST-partial-post-'+order.orderId);
 const guard='test_reply_replace_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${guard}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND NEW.payload->'meta'->'replacesForReply'->>'documentId'='${original.document.id}' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 try{
  await sql.unsafe(`CREATE TRIGGER ${guard} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${guard}()`);
  expect(await plan()).toMatchObject({unavailable:true});
  expect(await sql`SELECT status FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${original.taskId}::uuid`).toEqual([{status:'offen'}]);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REPLY_RECORDED_V1' AND payload->'receipt'->>'customerId'=${order.customerId}`).toHaveLength(0);
  expect(await sql`SELECT count(*)::integer AS n FROM public.tasks task WHERE tenant_id=${KREILE_TENANT_SLUG} AND art='aufgabe' AND bezug_id IN (${order.orderId},${second!.orderId})`).toEqual([{n:1}]);
 }finally{await sql.unsafe(`DROP TRIGGER IF EXISTS ${guard} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${guard}()`);}
 const operator=await createFixture(['auftraege','mails'],'werkstatt');
 const read=await withSession(operator,()=>getOrdersDb());if(!read.ok)throw Error('PARTIAL_POST_QUEUE');
 expect(read.data.find(row=>row.id===order.orderId)?.finishedDispatch?.reminder).toMatchObject({responseState:'REPLIED'});
 const letter=read.data.find(row=>row.id===second!.orderId)?.finishedDispatch?.storage?.letter;expect(letter).toMatchObject({state:'WAIT_FOR_POST',orderIds:[second!.orderId]});if(!letter?.postalTaskId||!letter.postalDocumentId)throw Error('PARTIAL_POST_REPLACEMENT');
 expect(await withSession(operator,()=>getIntakeTaskAction({taskId:original.taskId}))).toMatchObject({code:'OK',task:{status:'erledigt'},postalLetter:{state:'ENDED_BY_REPLY',document:{sha256:original.document.sha256}}});
 const replacement=await withSession(operator,()=>getIntakeTaskAction({taskId:letter.postalTaskId!}));expect(replacement).toMatchObject({code:'OK',task:{status:'offen'},postalLetter:{state:'WAIT_FOR_POST'}});
 expect(await sql`SELECT payload->'meta'->'orders'->0->>'id' AS id,(payload->'document'->>'sha256')<>${original.document.sha256} AS changed FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${letter.postalDocumentId}`).toEqual([{id:second!.orderId,changed:true}]);
 await plan();expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND payload->'meta'->'replacesForReply'->>'documentId'=${original.document.id}`).toEqual([{n:1}]);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND payload->>'channel'='post' AND payload->'meta'->>'customerId'=${order.customerId}`).toHaveLength(0);
 if(replacement.code!=='OK'||!replacement.task)throw Error('PARTIAL_POST_REPLACEMENT_TASK');
 const [{sha}]=await sql`SELECT payload->'document'->>'sha256' AS sha FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${letter.postalDocumentId}`;
 expect(await withSession(operator,()=>completeIntakeTaskAction({taskId:letter.postalTaskId!,version:replacement.task!.version,note:'TEST nur B versandt',postalResult:{kind:'posted',postedOn:berlinCalendarDay(),documentSha256:sha}}))).toMatchObject({code:'OK'});
 expect(await withSession(operator,()=>getIntakeTaskAction({taskId:letter.postalTaskId!}))).toMatchObject({code:'OK',postalLetter:{state:'POSTED'}});
});

it('E4 preview renders a real customer/sender PDF without invoice-only settings, writes nothing and rejects missing address or rights',async()=>{
 const {order,request,plan}=await prepareLetter('Lagerfrist-Vorschau');
 const [originalSettings]=await sql`SELECT tax_id,iban,bic,bank_name,invoice_payment_term_days,logo_url FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 try {
 // TEST configuration: postal letters do not require banking, tax identifiers or an invoice logo.
 await sql`UPDATE public.company_settings SET tax_id=NULL,iban=NULL,bic=NULL,bank_name=NULL,invoice_payment_term_days=NULL,logo_url=NULL WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const before=await sql`SELECT (SELECT count(*) FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG})::int AS events,(SELECT count(*) FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG})::int AS tasks`;
 const result=await withSession(full,()=>previewStorageLetterAction(request));expect(result).toMatchObject({code:'OK',data:{sent:false,clientKey:request.clientKey,channel:'mail'}});if(result.code!=='OK')throw Error('LETTER_PREVIEW:'+result.code);
 const [customer]=await sql`SELECT name,zip_code,city FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.customerId}`;
 expect(result.data.snapshot.recipient).toMatchObject({name:customer.name,zip:customer.zip_code,city:customer.city});expect(result.data.snapshot.body).toContain('4 Arbeitstage');
 const bytes=Buffer.from(result.data.pdfBase64,'base64');expect(bytes.subarray(0,5).toString()).toBe('%PDF-');expect(createHash('sha256').update(bytes).digest('hex')).toBe(result.data.pdfSha256);
 if(process.env.KREILE_STORAGE_LETTER_PROOF_PATH){const target=path.resolve(process.env.KREILE_STORAGE_LETTER_PROOF_PATH);if(target.toLowerCase().startsWith(process.cwd().toLowerCase()))throw Error('LETTER_PROOF_MUST_BE_OUTSIDE_REPO');writeFileSync(target,bytes);}
 expect(await sql`SELECT (SELECT count(*) FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG})::int AS events,(SELECT count(*) FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG})::int AS tasks`).toEqual(before);
 expect((await plan())?.storage?.letter).toMatchObject({state:'DUE',sentAt:null,finalStage:{due:null}});
 expect(await withSession(full,()=>previewStorageLetterAction(structuredClone(request)))).toMatchObject({code:'OK',data:{snapshot:result.data.snapshot,sent:false}});
 const denied=await createFixture(['auftraege'],'werkstatt');expect(await withSession(denied,()=>previewStorageLetterAction(request))).toMatchObject({code:'FORBIDDEN'});
 await sql`UPDATE public.customers SET zip_code=NULL WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.customerId}`;
 expect(await withSession(full,()=>previewStorageLetterAction(request))).toMatchObject({code:'VALIDATION_ERROR'});
 } finally {
  await sql`UPDATE public.company_settings SET tax_id=${originalSettings.tax_id},iban=${originalSettings.iban},bic=${originalSettings.bic},bank_name=${originalSettings.bank_name},invoice_payment_term_days=${originalSettings.invoice_payment_term_days},logo_url=${originalSettings.logo_url} WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 }
});
it.each([false,true])('an original reply ends or narrows the actual callback without inventing a call result (shared=%s)',async(shared)=>{
 const {order,callTaskId,plan,second}=await prepareLetter('Antwort beendet Anruf',false,shared);
 const {confirmPaymentAction}=await import('@/app/actions/payments.actions');
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:order.invoice.invoiceId,amount:order.invoice.grossAmountCents,method:'bar',expectedVersion:0,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect((await plan())?.reminder).toMatchObject({state:'CALL_PENDING',callTaskId});
 expect(await sql`SELECT status FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${callTaskId}::uuid`).toEqual([{status:'offen'}]);
 const [notice]=await sql`SELECT thread.source,customer.email FROM public.events event JOIN public.communication_threads thread ON thread.tenant_id=event.tenant_id AND thread.id::text=event.payload->'receipt'->>'threadId' JOIN public.customers customer ON customer.tenant_id=event.tenant_id AND customer.id=${order.customerId} WHERE event.tenant_id=${KREILE_TENANT_SLUG} AND event.order_id=${order.orderId} AND event.event_type='ORDER_CUSTOMER_INFORMED_V1' LIMIT 1`;
 const reference='<TEST-call-sent-'+order.orderId+'@example.invalid>',incomingId='TEST-call-reply-'+order.orderId;
 vi.mocked(globalThis.fetch).mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-call-reply-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'){
   if(url.pathname.includes('/mailFolders/sentitems/messages'))return Response.json({value:[{id:'TEST-call-original-sent',internetMessageId:reference,from:{emailAddress:{address:'TEST-mailbox@example.invalid'}},toRecipients:[{emailAddress:{address:notice.email}}],isDraft:false,sentDateTime:new Date().toISOString(),internetMessageHeaders:[{name:'x-kreile-request-id',value:notice.source.replace('MS_GRAPH_OUT:','')}]}]});
   if(url.pathname.endsWith('/attachments'))return Response.json({value:[]});
   if(url.pathname.endsWith('/$value'))return new Response('Message-ID: <'+incomingId+'@example.invalid>\r\nFrom: '+notice.email+'\r\nIn-Reply-To: '+reference+'\r\nSubject: TEST Antwort\r\n\r\nTEST ich melde mich.');
   return Response.json({id:incomingId,internetMessageId:'<'+incomingId+'@example.invalid>',subject:'TEST Antwort',from:{emailAddress:{name:'TEST Kunde',address:notice.email}},receivedDateTime:new Date(Date.now()+100).toISOString(),bodyPreview:'TEST Antwort',body:{contentType:'text',content:'TEST ich melde mich.'},hasAttachments:false});
  }return nativeFetch(input,init);
 });
 const {attachOutlookMailAction}=await import('@/app/actions/communications.actions');
 expect(await withSession(full,()=>attachOutlookMailAction({targetType:'CUSTOMER',targetId:order.customerId,graphMessageId:incomingId}))).toMatchObject({code:'OK'});
 expect((await plan())?.reminder).toMatchObject({responseState:'REPLIED'});
 expect(await withSession(full,()=>getIntakeTaskAction({taskId:callTaskId}))).toMatchObject({code:'OK',task:{status:shared?'offen':'erledigt'}});
 if(shared){
  expect(await sql`SELECT payload->'meta'->'orderIds' AS ids FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_CALL_UPDATED_V1' AND payload->>'taskId'=${callTaskId}`).toEqual([{ids:[second!.orderId]}]);
  const queue=await withSession(full,()=>getOrdersDb());if(!queue.ok)throw Error('REPLY_PARTIAL_CALLBACK_QUEUE');
  expect(queue.data.find(row=>row.id===second!.orderId)?.finishedDispatch?.reminder).toMatchObject({state:'CALL_PENDING',callTaskId});
  const [remainingOrder]=await sql`SELECT order_number FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${second!.orderId}`;
  expect(await sql`SELECT notiz FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${callTaskId}::uuid`).toEqual([{notiz:expect.stringContaining(remainingOrder.order_number)}]);
  const opened=await withSession(full,()=>getIntakeTaskAction({taskId:callTaskId}));expect(opened).toMatchObject({code:'OK',reference:{type:'auftrag',id:second!.orderId}});if(opened.code!=='OK'||!opened.task)throw Error('PARTIAL_CALLBACK_OPEN');
  const before=opened.task,input={taskId:before.id,clientKey:before.client_key,version:before.version,kind:before.art,title:before.titel,dueDate:before.faellig_am,time:before.uhrzeit,forLogin:before.fuer_login,forArea:before.fuer_bereich,reference:{type:opened.reference.type,id:opened.reference.id},note:before.notiz};
  expect(await withSession(full,()=>saveIntakeTaskAction(input))).toMatchObject({code:'OK'});
  expect(await withSession(full,()=>saveIntakeTaskAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
  expect(await sql`SELECT bezug_id FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${callTaskId}::uuid`).toEqual([{bezug_id:before.bezug_id}]);
  expect(await withSession(full,()=>getIntakeTaskAction({taskId:callTaskId}))).toMatchObject({code:'OK',reference:{id:second!.orderId}});
  expect(await withSession(full,()=>saveIntakeTaskAction({...input,version:before.version+1,reference:{type:'auftrag',id:randomUUID()}}))).toMatchObject({code:'CONFLICT'});
 }else expect(await sql`SELECT user_id::text AS actor,payload->>'taskId' AS task FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_TASK_ENDED_FOR_REPLY_V1' AND payload->>'taskId'=${callTaskId}`).toEqual([{actor:full.actorId,task:callTaskId}]);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_CALL_RESULT_V1' AND payload->>'taskId'=${callTaskId}`).toHaveLength(0);
 expect((await plan())?.reminder).toMatchObject({responseState:'REPLIED'});
});
it('an original customer reply ends the exact open postal task without inventing post dispatch and replays without Outlook',async()=>{
 const {order,request,plan}=await prepareLetter('Antwort beendet Brief');
 const [originalCustomer]=await sql`SELECT email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.customerId}`;
 expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),email:''}))).toMatchObject({code:'OK'});
 const prepared=await withSession(full,()=>prepareStoragePostalLetterAction(request));if(prepared.code!=='OK')throw Error('REPLY_POST_PREPARE:'+prepared.code);
 expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),email:originalCustomer.email}))).toMatchObject({code:'OK'});
 const [notice]=await sql`SELECT thread.source,customer.email FROM public.events event JOIN public.communication_threads thread ON thread.tenant_id=event.tenant_id AND thread.id::text=event.payload->'receipt'->>'threadId' JOIN public.customers customer ON customer.tenant_id=event.tenant_id AND customer.id=${order.customerId} WHERE event.tenant_id=${KREILE_TENANT_SLUG} AND event.order_id=${order.orderId} AND event.event_type='ORDER_CUSTOMER_INFORMED_V1' LIMIT 1`;
 const requestId=notice.source.replace('MS_GRAPH_OUT:',''),reference='<TEST-reply-post@example.invalid>';
 let graphCalls=0;
 vi.mocked(globalThis.fetch).mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-reply-post-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'){
   graphCalls++;
   if(url.pathname.includes('/mailFolders/sentitems/messages'))return Response.json({value:[{id:'TEST-post-original-sent',internetMessageId:reference,from:{emailAddress:{address:'TEST-mailbox@example.invalid'}},toRecipients:[{emailAddress:{address:notice.email}}],isDraft:false,sentDateTime:new Date().toISOString(),internetMessageHeaders:[{name:'x-kreile-request-id',value:requestId}]}]});
   if(url.pathname.endsWith('/attachments'))return Response.json({value:[]});
   if(url.pathname.endsWith('/$value'))return new Response('Message-ID: <TEST-post-reply@example.invalid>\r\nFrom: '+notice.email+'\r\nIn-Reply-To: '+reference+'\r\nSubject: TEST Antwort\r\n\r\nTEST ich melde mich.');
   return Response.json({id:'TEST-post-reply',internetMessageId:'<TEST-post-reply@example.invalid>',subject:'TEST Antwort',from:{emailAddress:{name:'TEST Kunde',address:notice.email}},receivedDateTime:new Date(Date.now()+100).toISOString(),bodyPreview:'TEST Antwort',body:{contentType:'text',content:'TEST ich melde mich.'},hasAttachments:false});
  }
  return nativeFetch(input,init);
 });
 const {attachOutlookMailAction}=await import('@/app/actions/communications.actions');
 expect(await withSession(full,()=>attachOutlookMailAction({targetType:'CUSTOMER',targetId:order.customerId,graphMessageId:'TEST-post-reply'}))).toMatchObject({code:'OK'});
 const guard='test_reply_end_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${guard}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='ORDER_COLLECTION_TASK_ENDED_FOR_REPLY_V1' AND NEW.payload->>'taskId'='${prepared.taskId}' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 try{
  await sql.unsafe(`CREATE TRIGGER ${guard} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${guard}()`);
  expect(await plan()).toMatchObject({unavailable:true,gaps:expect.arrayContaining(['COLLECTION_PROOF_UNAVAILABLE'])});
  expect(await sql`SELECT status,erledigt_am FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${prepared.taskId}::uuid`).toEqual([{status:'offen',erledigt_am:null}]);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REPLY_RECORDED_V1' AND payload->'receipt'->>'customerId'=${order.customerId}`).toHaveLength(0);
 }finally{
  await sql.unsafe(`DROP TRIGGER IF EXISTS ${guard} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${guard}()`);
 }
 expect((await plan())?.reminder).toMatchObject({responseState:'REPLIED'});
 const task=await withSession(full,()=>getIntakeTaskAction({taskId:prepared.taskId}));
 expect(task).toMatchObject({code:'OK',task:{status:'erledigt'},postalLetter:{state:'ENDED_BY_REPLY',document:{sha256:prepared.document.sha256}}});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND payload->>'documentId'=${prepared.document.id}`).toEqual([{n:0}]);
 const before=graphCalls;vi.mocked(globalThis.fetch).mockImplementation(async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname==='graph.microsoft.com'){graphCalls++;throw Error('TEST_OUTLOOK_OFFLINE');}return nativeFetch(input,init);});
 expect((await plan())?.reminder).toMatchObject({responseState:'REPLIED'});expect(graphCalls).toBe(before);
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('REPLY_RESTART_SETTINGS');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberPattern:settings.settings.numberPattern,numberHint:settings.settings.numberHint,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,dispatchPolicy:{...settings.settings.dispatchPolicy!,storageAfterDays:0,finalStageAfterLetterDays:0,finalStageRecipientId:full.actorId}}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),email:''}))).toMatchObject({code:'OK'});
 const future=Date.now()+7*24*60*60*1000;vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(future);
 try{
  const next=await plan(),letter=next?.storage?.letter;expect(next?.storage).toMatchObject({state:'DUE',replyEventId:expect.any(String)});if(!letter)throw Error('REPLY_RESTART_LETTER');
  expect(letter).not.toHaveProperty('callTaskId');expect(letter).not.toHaveProperty('appointmentEventId');
  const nextRequest={...request,clientKey:letter.clientKey};
  const original=await withSession(full,()=>prepareStoragePostalLetterAction(nextRequest));expect(original.code).toBe('OK');if(original.code!=='OK')throw Error('REPLY_RESTART_POST');
  expect(await sql`SELECT payload->'meta'->'storageOrigin' AS origin FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${original.document.id}`).toEqual([{origin:{replyEventId:letter.replyEventId,freezes:letter.freezes}}]);
  const read=await withSession(full,()=>getIntakeTaskAction({taskId:original.taskId}));if(read.code!=='OK'||!read.task)throw Error('REPLY_RESTART_TASK');
  const posting={taskId:original.taskId,version:read.task.version,note:'TEST neuer Brief nach Antwort versandt',postalResult:{kind:'posted' as const,postedOn:berlinCalendarDay(),documentSha256:original.document.sha256}};
  expect(await withSession(full,()=>completeIntakeTaskAction(posting))).toMatchObject({code:'OK'});
  const final=await withSession(full,()=>createStorageFinalTaskAction(nextRequest));expect(final.code).toBe('OK');if(final.code!=='OK')throw Error('REPLY_RESTART_FINAL');
  expect(await withSession(full,()=>createStorageFinalTaskAction(JSON.parse(JSON.stringify(nextRequest))))).toMatchObject({code:'OK',replayed:true,taskId:final.taskId});
  expect((await plan())?.storage?.letter?.finalStage).toMatchObject({state:'TASK_PENDING',taskId:final.taskId});
  expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),email:originalCustomer.email}))).toMatchObject({code:'OK'});
  vi.mocked(globalThis.fetch).mockImplementation(async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
   if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-reply-post-token'.repeat(4),expires_in:3600});
   if(url.hostname==='graph.microsoft.com'){
    if(url.pathname.includes('/mailFolders/sentitems/messages'))return Response.json({value:[{id:'TEST-post-original-sent',internetMessageId:reference,from:{emailAddress:{address:'TEST-mailbox@example.invalid'}},toRecipients:[{emailAddress:{address:notice.email}}],isDraft:false,sentDateTime:new Date().toISOString(),internetMessageHeaders:[{name:'x-kreile-request-id',value:requestId}]}]});
    if(url.pathname.endsWith('/attachments'))return Response.json({value:[]});
    if(url.pathname.endsWith('/$value'))return new Response('Message-ID: <TEST-final-reply@example.invalid>\r\nFrom: '+notice.email+'\r\nIn-Reply-To: '+reference+'\r\nSubject: TEST neue Antwort\r\n\r\nTEST ich hole die Ware.');
    return Response.json({id:'TEST-final-reply',internetMessageId:'<TEST-final-reply@example.invalid>',subject:'TEST neue Antwort',from:{emailAddress:{name:'TEST Kunde',address:notice.email}},receivedDateTime:new Date(Date.now()+100).toISOString(),bodyPreview:'TEST Antwort',body:{contentType:'text',content:'TEST ich hole die Ware.'},hasAttachments:false});
   }
   return nativeFetch(input,init);
  });
  const operational=await createFixture(['auftraege','mails'],'werkstatt');
  expect(await withSession(full,()=>attachOutlookMailAction({targetType:'CUSTOMER',targetId:order.customerId,graphMessageId:'TEST-final-reply'}))).toMatchObject({code:'OK'});
  const reacted=await withSession(operational,()=>getOrdersDb());if(!reacted.ok)throw Error('REPLY_FINAL_READ');
  expect(reacted.data.find(row=>row.id===order.orderId)?.finishedDispatch?.reminder).toMatchObject({responseState:'REPLIED'});
  expect(await sql`SELECT status,erledigt_von::text AS actor FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${final.taskId}::uuid`).toEqual([{status:'erledigt',actor:operational.actorId}]);
  expect(await withSession(operational,()=>getIntakeTaskAction({taskId:final.taskId}))).toMatchObject({code:'OK',task:{status:'erledigt'}});
  vi.setSystemTime(future+7*24*60*60*1000);
  const nextMail=(await plan())?.storage?.letter;if(!nextMail)throw Error('REPLY_NEXT_MAIL_PROPOSAL');
  const previousFetch=vi.mocked(globalThis.fetch).getMockImplementation()!;
  vi.mocked(globalThis.fetch).mockImplementation(async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail'))return new Response(null,{status:202});return previousFetch(input,init);});
  const mail={targetType:'CUSTOMER' as const,targetId:order.customerId,clientRequestId:randomUUID(),subject:'TEST Lagerfrist nach Antwort',body:'TEST Bitte melde Dich zur Übergabe.',collectionReminder:{stage:'E4' as const,handover:'pickup' as const,dueDate:nextMail.due,clientKey:nextMail.clientKey}};
  const sent=await withSession(full,()=>sendCustomerMailAction(mail));expect(sent.code).toBe('OK');if(sent.code!=='OK')throw Error('REPLY_NEXT_MAIL_SEND');
  expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(mail))))).toMatchObject({code:'OK',data:{replayed:true}});
  const mailFinal=await withSession(full,()=>createStorageFinalTaskAction({...request,clientKey:nextMail.clientKey}));expect(mailFinal.code).toBe('OK');
  expect(await sql`SELECT payload->'meta'->'storageOrigin'->>'replyEventId' AS reply FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND payload->>'threadId'=${sent.data.threadId}`).toEqual([{reply:nextMail.replyEventId}]);
 }finally{vi.useRealTimers();}
});
it('postal E4 secures one original and one task; only the explicit posting date advances E5, with fresh retry and no mail send',async()=>{
 const {order,request,plan}=await prepareLetter('Lagerfrist-Post');
 expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),email:''}))).toMatchObject({code:'OK'});
 const graphCalls=()=>vi.mocked(globalThis.fetch).mock.calls.filter(([input])=>String(typeof input==='string'?input:input instanceof URL?input.href:input.url).includes('graph.microsoft.com')&&String(typeof input==='string'?input:input instanceof URL?input.href:input.url).endsWith('/sendMail')).length;
 const before=graphCalls();
 const attempts=await Promise.all([withSession(full,()=>prepareStoragePostalLetterAction(request)),withSession(full,()=>prepareStoragePostalLetterAction(structuredClone(request)))]);
 for(const result of attempts)expect(result).toMatchObject({code:'OK'});const prepared=attempts[0];if(prepared.code!=='OK')throw Error('POSTAL_PREPARE:'+prepared.code);
 expect(attempts[1]).toMatchObject({taskId:prepared.taskId,document:{sha256:prepared.document.sha256}});
 expect(await sql`SELECT art,status,fuer_bereich FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${prepared.taskId}::uuid`).toEqual([{art:'aufgabe',status:'offen',fuer_bereich:'auftraege'}]);
 expect(await sql`SELECT user_id::text,payload->>'channel' AS channel FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${prepared.document.id}`).toEqual([{user_id:full.actorId,channel:'post'}]);
 expect((await plan())?.storage?.letter).toMatchObject({state:'WAIT_FOR_POST',sentAt:null,postalTaskId:prepared.taskId,finalStage:{due:null}});
 const read=await withSession(full,()=>getIntakeTaskAction({taskId:prepared.taskId}));expect(read).toMatchObject({code:'OK',postalLetter:{state:'WAIT_FOR_POST',document:{sha256:prepared.document.sha256}}});if(read.code!=='OK'||!read.task)throw Error('POSTAL_TASK');
 expect(await withSession(full,()=>completeIntakeTaskAction({taskId:prepared.taskId,version:read.task!.version,note:null}))).toMatchObject({code:'VALIDATION_ERROR'});
 const input={taskId:prepared.taskId,version:read.task.version,note:'TEST heute zur Post gegeben',postalResult:{kind:'posted' as const,postedOn:berlinCalendarDay(),documentSha256:prepared.document.sha256}};
 expect(await withSession(full,()=>completeIntakeTaskAction({...input,postalResult:{...input.postalResult,documentSha256:'0'.repeat(64)}}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>completeIntakeTaskAction({...input,postalResult:{...input.postalResult,postedOn:'2099-01-01'}}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await withSession(full,()=>completeIntakeTaskAction(input))).toMatchObject({code:'OK'});
 expect((await plan())?.storage?.letter).toMatchObject({state:'SENT',threadId:null,postalDocumentId:prepared.document.id,sentAt:input.postalResult.postedOn,finalStage:{state:'NEEDS_SETTING',missingSettings:['finalStageRecipientId']}});
 expect(await withSession(full,()=>completeIntakeTaskAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(full,()=>prepareStoragePostalLetterAction(structuredClone(request)))).toMatchObject({code:'OK',taskId:prepared.taskId,document:{sha256:prepared.document.sha256},replayed:true});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND payload->>'documentId'=${prepared.document.id}`).toEqual([{n:1}]);
 expect(graphCalls()).toBe(before);
 await sql`UPDATE public.events SET payload=jsonb_set(payload,'{document,sha256}',to_jsonb(${'0'.repeat(64)}::text)) WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${prepared.document.id}`;
 expect(await withSession(full,()=>getIntakeTaskAction({taskId:prepared.taskId}))).toMatchObject({code:'UNAVAILABLE'});
 expect(await withSession(full,()=>prepareStoragePostalLetterAction(structuredClone(request)))).toMatchObject({code:'UNAVAILABLE'});
});
it('PL09:01 without an initial mail proceeds from failed call to original PDF, explicit post date and one E5 task',async()=>{
 const {order,request,plan}=await prepareWithoutMail('Post-ohne-erste-Mail');
 const prepared=await withSession(full,()=>prepareStoragePostalLetterAction(request));expect(prepared).toMatchObject({code:'OK'});if(prepared.code!=='OK')throw Error('NO_MAIL_PREPARE');
 const task=await withSession(full,()=>getIntakeTaskAction({taskId:prepared.taskId}));if(task.code!=='OK'||!task.task)throw Error('NO_MAIL_POST_TASK');
 expect((await plan())?.finishedDispatch?.storage?.letter).toMatchObject({state:'WAIT_FOR_POST',sentAt:null,finalStage:{due:null}});
 const input={taskId:prepared.taskId,version:task.task!.version,note:'TEST Brief versendet',postalResult:{kind:'posted' as const,postedOn:berlinCalendarDay(),documentSha256:prepared.document.sha256}};
 expect(await withSession(full,()=>completeIntakeTaskAction(input))).toMatchObject({code:'OK'});
 expect((await plan())?.finishedDispatch?.storage?.letter).toMatchObject({state:'SENT',threadId:null,finalStage:{state:'DUE'}});
 const final=await withSession(full,()=>createStorageFinalTaskAction(request));expect(final).toMatchObject({code:'OK'});if(final.code!=='OK')throw Error('POSTAL_E5');
 expect(await withSession(full,()=>createStorageFinalTaskAction(structuredClone(request)))).toMatchObject({code:'OK',taskId:final.taskId,replayed:true});
 const current=await plan();expect(await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:current!.version,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await sql`SELECT status FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${final.taskId}::uuid`).toEqual([{status:'erledigt'}]);
 expect(await sql`SELECT count(*)::int AS n FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${order.customerId}`).toEqual([{n:0}]);
});
it('discard preserves the old original and creates a new generation; physical handover closes an unposted letter without inventing post',async()=>{
 const {order,request,plan}=await prepareWithoutMail('Post-Verwerfen-Ausgabe');
 const first=await withSession(full,()=>prepareStoragePostalLetterAction(request));if(first.code!=='OK')throw Error('POSTAL_DISCARD_PREPARE');
 const task=await withSession(full,()=>getIntakeTaskAction({taskId:first.taskId}));if(task.code!=='OK'||!task.task)throw Error('POSTAL_DISCARD_TASK');
 const input={taskId:first.taskId,version:task.task!.version,note:'TEST Adresse korrigieren',postalResult:{kind:'discarded' as const,reason:'TEST Adresse korrigiert',documentSha256:first.document.sha256}};
 expect(await withSession(full,()=>completeIntakeTaskAction(input))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>completeIntakeTaskAction(structuredClone(input)))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(full,()=>prepareStoragePostalLetterAction(structuredClone(request)))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),street:'TEST Neuer Weg',houseNumber:'7'}))).toMatchObject({code:'OK'});
 const next=(await plan())!.finishedDispatch!.storage!.letter!;expect(next.state).toBe('DUE');expect(next.clientKey).not.toBe(request.clientKey);
 const replacement=await withSession(full,()=>prepareStoragePostalLetterAction({...request,clientKey:next.clientKey}));if(replacement.code!=='OK')throw Error('POSTAL_REPLACEMENT:'+replacement.code);
 expect(replacement.document.snapshot.recipient.street).toBe('TEST Neuer Weg 7');expect(replacement.document.sha256).not.toBe(first.document.sha256);
 expect(await withSession(full,()=>getIntakeTaskAction({taskId:first.taskId}))).toMatchObject({code:'OK',postalLetter:{state:'VOIDED',document:{sha256:first.document.sha256}}});
 const operator=await createFixture(['auftraege','geld'],'buero'),current=await plan();
 expect(await withSession(operator,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:current!.version,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await sql`SELECT status,erledigt_von::text FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${replacement.taskId}::uuid`).toEqual([{status:'erledigt',erledigt_von:operator.actorId}]);
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND payload->>'documentId'=${replacement.document.id}`).toEqual([{n:0}]);
 expect(await withSession(full,()=>getIntakeTaskAction({taskId:replacement.taskId}))).toMatchObject({code:'OK',postalLetter:{state:'VOIDED'}});
});
it('competing postal completion and discard preserve exactly one outcome, actor and original across fresh retries',async()=>{
 const {request,plan}=await prepareWithoutMail('Post-Abschluss-Rennen');
 const prepared=await withSession(full,()=>prepareStoragePostalLetterAction(request));if(prepared.code!=='OK')throw Error('POSTAL_RACE_PREPARE');
 const read=await withSession(full,()=>getIntakeTaskAction({taskId:prepared.taskId}));if(read.code!=='OK'||!read.task)throw Error('POSTAL_RACE_TASK');
 const base={taskId:prepared.taskId,version:read.task.version,note:'TEST konkurrierender Abschluss'};
 const posted={...base,postalResult:{kind:'posted' as const,postedOn:berlinCalendarDay(),documentSha256:prepared.document.sha256}};
 const discarded={...base,postalResult:{kind:'discarded' as const,reason:'TEST Brief wird verworfen',documentSha256:prepared.document.sha256}};
 const denied=await createFixture(['auftraege'],'werkstatt');
 expect(await withSession(denied,()=>completeIntakeTaskAction(structuredClone(posted)))).toMatchObject({code:'FORBIDDEN'});
 expect(await sql`SELECT status,version FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${prepared.taskId}::uuid`).toEqual([{status:'offen',version:base.version}]);
 const results=await Promise.all([withSession(full,()=>completeIntakeTaskAction(structuredClone(posted))),withSession(full,()=>completeIntakeTaskAction(structuredClone(discarded)))]);
 expect(results.map(result=>result.code).sort()).toEqual(['CONFLICT','OK']);
 const postedWon=results[0].code==='OK',winner=postedWon?posted:discarded,loser=postedWon?discarded:posted;
 const outcomes=await sql`SELECT event_type,user_id::text,payload FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type IN ('ORDER_COLLECTION_REMINDER_SENT_V1','ORDER_STORAGE_LETTER_VOIDED_V1') AND payload->>'documentId'=${prepared.document.id}`;
 expect(outcomes).toHaveLength(1);expect(outcomes[0]).toMatchObject({event_type:postedWon?'ORDER_COLLECTION_REMINDER_SENT_V1':'ORDER_STORAGE_LETTER_VOIDED_V1',user_id:full.actorId,payload:{taskId:prepared.taskId,taskVersion:base.version+1,documentSha256:prepared.document.sha256}});
 expect(await withSession(full,()=>getIntakeTaskAction({taskId:prepared.taskId}))).toMatchObject({code:'OK',task:{status:'erledigt',version:base.version+1},postalLetter:{state:postedWon?'POSTED':'VOIDED',document:{sha256:prepared.document.sha256}}});
 expect(await withSession(full,()=>completeIntakeTaskAction(JSON.parse(JSON.stringify(winner))))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(full,()=>completeIntakeTaskAction(JSON.parse(JSON.stringify(loser))))).toMatchObject({code:'CONFLICT'});
 const other=await createFixture(['auftraege','mails']);
 expect(await withSession(other,()=>completeIntakeTaskAction(JSON.parse(JSON.stringify(winner))))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type IN ('ORDER_COLLECTION_REMINDER_SENT_V1','ORDER_STORAGE_LETTER_VOIDED_V1') AND payload->>'documentId'=${prepared.document.id}`).toEqual([{n:1}]);
 const state=(await plan())!.finishedDispatch!.storage!.letter!;
 expect(state).toMatchObject(postedWon?{state:'SENT',postalDocumentId:prepared.document.id,finalStage:{state:'DUE'}}:{state:'DUE',sentAt:null,finalStage:{due:null}});
});
it.each(['task history','dispatch receipt'] as const)('a rejected postal %s rolls back the dispatch receipt and completion, then the same request can recover',async(rejected)=>{
 const {request,plan}=await prepareWithoutMail('Post-Historie-Rollback');
 const prepared=await withSession(full,()=>prepareStoragePostalLetterAction(request));if(prepared.code!=='OK')throw Error('POSTAL_ROLLBACK_PREPARE');
 const read=await withSession(full,()=>getIntakeTaskAction({taskId:prepared.taskId}));if(read.code!=='OK'||!read.task)throw Error('POSTAL_ROLLBACK_TASK');
 const input={taskId:prepared.taskId,version:read.task.version,note:'TEST Versand mit Historie',postalResult:{kind:'posted' as const,postedOn:berlinCalendarDay(),documentSha256:prepared.document.sha256}};
 const name='test_postal_'+randomUUID().replaceAll('-','');
 // Real DB failure, restricted to this synthetic task; neither action nor persistence is mocked.
 const table=rejected==='task history'?'intake_event':'events';
 const matches=rejected==='task history'?`NEW.nachher->>'taskId' = '${prepared.taskId}' AND NEW.nachher->>'action' = 'aufgabe.erledigt'`:`NEW.event_type = 'ORDER_COLLECTION_REMINDER_SENT_V1' AND NEW.payload->>'documentId' = '${prepared.document.id}'`;
 await sql.unsafe(`CREATE FUNCTION private.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id = '${KREILE_TENANT_SLUG}' AND ${matches} THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 try{
  await sql.unsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON public.${table} FOR EACH ROW EXECUTE FUNCTION private.${name}()`);
  expect(await withSession(full,()=>completeIntakeTaskAction(structuredClone(input)))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT status,version,erledigt_am FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${prepared.taskId}::uuid`).toEqual([{status:'offen',version:input.version,erledigt_am:null}]);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND payload->>'documentId'=${prepared.document.id}`).toHaveLength(0);
  expect((await plan())!.finishedDispatch!.storage!.letter).toMatchObject({state:'WAIT_FOR_POST',sentAt:null,finalStage:{due:null}});
  expect(await withSession(full,()=>getIntakeTaskAction({taskId:prepared.taskId}))).toMatchObject({code:'OK',postalLetter:{state:'WAIT_FOR_POST',document:{sha256:prepared.document.sha256}}});
 }finally{
  await sql.unsafe(`DROP TRIGGER IF EXISTS ${name} ON public.${table}`);
  await sql.unsafe(`DROP FUNCTION private.${name}()`);
 }
 expect(await withSession(full,()=>completeIntakeTaskAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:false});
 expect((await plan())!.finishedDispatch!.storage!.letter).toMatchObject({state:'SENT',postalDocumentId:prepared.document.id,finalStage:{state:'DUE'}});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND payload->>'documentId'=${prepared.document.id}`).toEqual([{n:1}]);
 expect(await sql`SELECT count(*)::int AS n FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND nachher->>'taskId'=${prepared.taskId} AND nachher->>'action'='aufgabe.erledigt'`).toEqual([{n:1}]);
});
it('a missing source-task history keeps the concern open and rolls back the task before a fresh recovery',async()=>{
 const itemId=randomUUID(),capture=await withSession(full,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST bitte Aufgabe mit belegtem Ursprung erledigen',concerns:['aufgabe']}));
 if(capture.code!=='OK')throw Error('SOURCE_HISTORY_CAPTURE');
 const input={clientKey:randomUUID(),version:0,kind:'aufgabe' as const,title:'TEST ursprüngliches Anliegen erledigen',dueDate:berlinCalendarDay(),time:null,forLogin:full.actorId,forArea:null,reference:{type:'eingang' as const,id:itemId},note:null,itemId,itemVersion:capture.capture.version};
 const name='test_task_source_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id = '${KREILE_TENANT_SLUG}' AND NEW.item_id = '${itemId}'::uuid AND NEW.nachher->>'action' = 'aufgabe.angelegt' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 try{
  await sql.unsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON public.intake_event FOR EACH ROW EXECUTE FUNCTION private.${name}()`);
  expect(await withSession(full,()=>saveIntakeTaskAction(structuredClone(input)))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT id FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${input.clientKey}::uuid`).toHaveLength(0);
  expect(await sql`SELECT version,einsatz,anliegen_offen FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`).toEqual([{version:capture.capture.version,einsatz:'offen',anliegen_offen:['aufgabe']}]);
  expect(await withSession(full,()=>getIntakeCaptureAction(itemId))).toMatchObject({code:'OK',capture:{usage:'offen',openConcerns:['aufgabe'],version:capture.capture.version}});
 }finally{
  await sql.unsafe(`DROP TRIGGER IF EXISTS ${name} ON public.intake_event`);
  await sql.unsafe(`DROP FUNCTION private.${name}()`);
 }
 const saved=await withSession(full,()=>saveIntakeTaskAction(JSON.parse(JSON.stringify(input))));if(saved.code!=='OK')throw Error('SOURCE_HISTORY_RECOVERY:'+saved.code);
 expect(await withSession(full,()=>getIntakeCaptureAction(itemId))).toMatchObject({code:'OK',capture:{usage:'erledigt',openConcerns:[]}});
 expect(await withSession(full,()=>getIntakeTaskAction({taskId:saved.task.id}))).toMatchObject({code:'OK',task:{status:'offen',titel:input.title}});
 expect(await withSession(full,()=>saveIntakeTaskAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',task:{id:saved.task.id},replayed:true});
 expect(await sql`SELECT count(*)::int AS n FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND nachher->>'action'='aufgabe.angelegt'`).toEqual([{n:1}]);
});
it('an omitted postal original receipt rolls back its task and history, preserving a usable same-key retry',async()=>{
 const {request,plan}=await prepareWithoutMail('Post-Original-Rollback');
 const before=await sql`SELECT (SELECT count(*) FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG})::int AS tasks,(SELECT count(*) FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG})::int AS history`;
 const name='test_postal_original_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id = '${KREILE_TENANT_SLUG}' AND NEW.client_event_id = '${request.clientKey}'::uuid AND NEW.event_type = 'ORDER_COLLECTION_REMINDER_PREPARED_V1' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 try{
  await sql.unsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${name}()`);
  expect(await withSession(full,()=>prepareStoragePostalLetterAction(structuredClone(request)))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT (SELECT count(*) FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG})::int AS tasks,(SELECT count(*) FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG})::int AS history`).toEqual(before);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${request.clientKey}::uuid`).toHaveLength(0);
  expect((await plan())!.finishedDispatch!.storage!.letter).toMatchObject({state:'DUE',sentAt:null,clientKey:request.clientKey,finalStage:{due:null}});
 }finally{
  await sql.unsafe(`DROP TRIGGER IF EXISTS ${name} ON public.events`);
  await sql.unsafe(`DROP FUNCTION private.${name}()`);
 }
 const recovered=await withSession(full,()=>prepareStoragePostalLetterAction(JSON.parse(JSON.stringify(request))));if(recovered.code!=='OK')throw Error('POSTAL_ORIGINAL_RECOVERY:'+recovered.code);
 expect(await withSession(full,()=>getIntakeTaskAction({taskId:recovered.taskId}))).toMatchObject({code:'OK',postalLetter:{state:'WAIT_FOR_POST',document:{sha256:recovered.document.sha256}}});
 expect(await withSession(full,()=>prepareStoragePostalLetterAction(JSON.parse(JSON.stringify(request))))).toMatchObject({code:'OK',taskId:recovered.taskId,replayed:true});
 expect(await sql`SELECT count(*)::int AS n FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${request.clientKey}::uuid`).toEqual([{n:1}]);
});
it('a matching ordinary task cannot be adopted as a qualified E5 task',async()=>{
 const {order,request,plan}=await prepareWithoutMail('Post-E5-Zweckbindung');
 const prepared=await withSession(full,()=>prepareStoragePostalLetterAction(request));if(prepared.code!=='OK')throw Error('PURPOSE_POSTAL');
 const read=await withSession(full,()=>getIntakeTaskAction({taskId:prepared.taskId}));if(read.code!=='OK'||!read.task)throw Error('PURPOSE_TASK');
 expect(await withSession(full,()=>completeIntakeTaskAction({taskId:prepared.taskId,version:read.task!.version,note:null,postalResult:{kind:'posted',postedOn:berlinCalendarDay(),documentSha256:prepared.document.sha256}}))).toMatchObject({code:'OK'});
 const h=createHash('sha256').update('storage-final:'+request.clientKey).digest('hex'),key=h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32),row=await plan();
 const ordinary=await withSession(full,()=>saveIntakeTaskAction({clientKey:key,version:0,kind:'aufgabe',title:COLLECTION_REMINDER_COPY.finalTaskTitle,dueDate:berlinCalendarDay(),time:null,forLogin:full.actorId,forArea:null,reference:{type:'auftrag',id:order.orderId},note:COLLECTION_REMINDER_COPY.finalTaskNote([row!.orderNumber])}));if(ordinary.code!=='OK')throw Error('PURPOSE_ORDINARY');
 expect(await withSession(full,()=>createStorageFinalTaskAction(request))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_STORAGE_FINAL_TASK_CREATED_V1' AND correlation_id=${request.clientKey}::uuid`).toEqual([{n:0}]);
 expect(await sql`SELECT status FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${ordinary.task.id}::uuid`).toEqual([{status:'offen'}]);
});

it('PL10:03 an actual S1 phone notice without mail waits for callAfterDays; reached E3 stops only that group',async()=>{
 const order=await readyInvoiceOrder('S1-Telefon-ohne-Mail');
 expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),email:''}))).toMatchObject({code:'OK'});
 const phone={orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()};
 expect(await withSession(full,()=>markOrderInformedByPhoneAction(phone))).toMatchObject({code:'OK'});
 async function setting(days:number|null){const current=await withSession(full,()=>readShippingSettingsAction());if(current.code!=='OK')throw Error('PHONE_SETTINGS');expect(await withSession(full,()=>saveShippingSettingsAction({service:current.settings.service,numberPattern:current.settings.numberPattern,numberHint:current.settings.numberHint,trackingUrl:current.settings.trackingUrl,expectedUpdatedAt:current.settings.updatedAt,dispatchPolicy:{...emptyDispatchPolicy(),callAfterDays:days}}))).toMatchObject({code:'OK'});}
 async function plan(){const queue=await withSession(full,()=>getOrdersDb());if(!queue.ok)throw Error('PHONE_QUEUE');return queue.data.find(row=>row.id===order.orderId)!.finishedDispatch!.reminder!;}
 await setting(1);const waiting=await plan();expect(waiting).toMatchObject({stage:'E3',state:'WAIT',needsNotice:[],responseState:'NONE'});
 expect(await withSession(full,()=>createDispatchCallTaskAction({customerId:order.customerId,handover:'pickup',dueDate:waiting.due!,clientKey:waiting.clientKey!}))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_CALL_CREATED_V1' AND payload->'meta'->>'customerId'=${order.customerId}`).toHaveLength(0);
 await setting(null);expect(await plan()).toMatchObject({stage:'E3',state:'NEEDS_SETTING',due:null,clientKey:null});
 await setting(0);const due=await plan();expect(due).toMatchObject({stage:'E3',state:'DUE'});
 const request={customerId:order.customerId,handover:'pickup' as const,dueDate:due.due!,clientKey:due.clientKey!},created=await withSession(full,()=>createDispatchCallTaskAction(request));if(created.code!=='OK')throw Error('PHONE_E3:'+created.code);
 const task=await withSession(full,()=>getIntakeTaskAction({taskId:created.taskId}));if(task.code!=='OK'||!task.task)throw Error('PHONE_E3_TASK');
 const result={taskId:created.taskId,version:task.task!.version,note:'TEST telefonisch erreicht',callResult:'reached' as const};
 expect(await withSession(full,()=>completeIntakeTaskAction(result))).toMatchObject({code:'OK'});
 expect(await plan()).toMatchObject({stage:'E3',state:'STOPPED',callTaskId:created.taskId});
 expect(await withSession(full,()=>completeIntakeTaskAction(JSON.parse(JSON.stringify(result))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT count(*)::int AS n FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${order.customerId}`).toEqual([{n:0}]);
});

it('PL10:03 storage weekly rate is explicit, protected and preserved by operational edits; E5 proposes but never books it',async()=>{
 const {order,request,plan}=await prepareWithoutMail('Lagergeld-Vorschlag');
 const prepared=await withSession(full,()=>prepareStoragePostalLetterAction(request));if(prepared.code!=='OK')throw Error('STORAGE_RATE_LETTER');
 const read=await withSession(full,()=>getIntakeTaskAction({taskId:prepared.taskId}));if(read.code!=='OK'||!read.task)throw Error('STORAGE_RATE_POST_TASK');
 expect(await withSession(full,()=>completeIntakeTaskAction({taskId:prepared.taskId,version:read.task!.version,note:'TEST versendet',postalResult:{kind:'posted',postedOn:berlinCalendarDay(),documentSha256:prepared.document.sha256}}))).toMatchObject({code:'OK'});
 async function settings(){const result=await withSession(full,()=>readShippingSettingsAction());if(result.code!=='OK')throw Error('STORAGE_RATE_SETTINGS');return result.settings;}
 function input(current:Awaited<ReturnType<typeof settings>>,policy=current.dispatchPolicy){return {service:current.service,numberPattern:current.numberPattern,numberHint:current.numberHint,trackingUrl:current.trackingUrl,expectedUpdatedAt:current.updatedAt,dispatchPolicy:policy};}
 const original=await settings();
 for(const storageWeeklyCents of [-1,12.5])expect(await withSession(full,()=>saveShippingSettingsAction(input(original,{...original.dispatchPolicy!,storageWeeklyCents})))).toMatchObject({code:'VALIDATION_ERROR'});
 expect((await settings()).updatedAt).toBe(original.updatedAt);
 expect(await withSession(full,()=>saveShippingSettingsAction(input(original,{...original.dispatchPolicy!,storageWeeklyCents:1250})))).toMatchObject({code:'OK'});
 expect((await settings()).dispatchPolicy?.storageWeeklyCents).toBe(1250);
 expect((await plan())!.finishedDispatch!.storage!.letter!.finalStage.positionProposal).toEqual({name:'Lagergeld',unit:'Woche',unitPriceCents:1250,quantity:null,automatic:false});
 const operator=await createFixture(['auftraege','einstellungen'],'buero'),visible=await withSession(operator,()=>readShippingSettingsAction());if(visible.code!=='OK')throw Error('STORAGE_RATE_OPERATIONAL');
 expect(visible.settings.dispatchPolicy).not.toHaveProperty('storageWeeklyCents');
 const edited=await withSession(operator,()=>saveShippingSettingsAction({...input(visible.settings),numberHint:'TEST anderer Versandhinweis'}));expect(edited).toMatchObject({code:'OK'});if(edited.code!=='OK')throw Error('STORAGE_RATE_EDIT');
 expect(edited.settings?.dispatchPolicy).not.toHaveProperty('storageWeeklyCents');expect((await settings()).dispatchPolicy?.storageWeeklyCents).toBe(1250);
 const forbiddenInput=input(await settings(),{...original.dispatchPolicy!,storageWeeklyCents:0});
 const denied=await withSession(operator,()=>saveShippingSettingsAction(forbiddenInput));expect(denied).toMatchObject({code:'FORBIDDEN'});
 const hiddenRateClear={...forbiddenInput,dispatchPolicy:null};expect(await withSession(operator,()=>saveShippingSettingsAction(hiddenRateClear))).toMatchObject({code:'FORBIDDEN'});
 const stale=await withSession(operator,()=>saveShippingSettingsAction({...input(visible.settings),numberHint:'TEST veralteter Stand'}));expect(stale).toMatchObject({code:'CONFLICT'});if(stale.code==='CONFLICT')expect(stale.current?.dispatchPolicy).not.toHaveProperty('storageWeeklyCents');
 const queue=await withSession(operator,()=>getOrdersDb());if(!queue.ok)throw Error('STORAGE_RATE_NO_MONEY_QUEUE');expect(queue.data.find(row=>row.id===order.orderId)!.finishedDispatch!.storage!.letter!.finalStage).not.toHaveProperty('positionProposal');
 const before=await sql`SELECT (SELECT count(*) FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId})::int AS items,(SELECT count(*) FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId})::int AS invoices`;
 const current=await settings();expect(await withSession(full,()=>saveShippingSettingsAction(input(current,{...current.dispatchPolicy!,storageWeeklyCents:null})))).toMatchObject({code:'OK'});
 expect((await plan())!.finishedDispatch!.storage!.letter!.finalStage).toMatchObject({state:'DUE',positionProposal:null});
 expect(await withSession(full,()=>createStorageFinalTaskAction(request))).toMatchObject({code:'OK'});
 expect(await sql`SELECT (SELECT count(*) FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId})::int AS items,(SELECT count(*) FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId})::int AS invoices`).toEqual(before);
});

it.each(['unposted','posted'] as const)('an actual pickup agreement pauses the %s collection route until its configured next working day without losing the original',async(stage)=>{
 const {order,request,plan}=await prepareWithoutMail('Abholtermin-'+stage);
 const prepared=await withSession(full,()=>prepareStoragePostalLetterAction(request));if(prepared.code!=='OK')throw Error('APPOINTMENT_LETTER');
 const task=await withSession(full,()=>getIntakeTaskAction({taskId:prepared.taskId}));if(task.code!=='OK'||!task.task)throw Error('APPOINTMENT_POST_TASK');
 const post={taskId:prepared.taskId,version:task.task!.version,note:'TEST Brief zur Post',postalResult:{kind:'posted' as const,postedOn:berlinCalendarDay(),documentSha256:prepared.document.sha256}};
 let finalTaskId:string|null=null;
 if(stage==='posted'){expect(await withSession(full,()=>completeIntakeTaskAction(post))).toMatchObject({code:'OK'});const final=await withSession(full,()=>createStorageFinalTaskAction(request));if(final.code!=='OK')throw Error('APPOINTMENT_FINAL_TASK');finalTaskId=final.taskId;}
 const friday=new Date(berlinCalendarDay()+'T12:00:00Z');friday.setUTCDate(friday.getUTCDate()+14);while(friday.getUTCDay()!==5)friday.setUTCDate(friday.getUTCDate()+1);
 const day=(offset:number)=>{const date=new Date(friday);date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);};
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('APPOINTMENT_CALENDAR');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberPattern:settings.settings.numberPattern,numberHint:settings.settings.numberHint,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,dispatchPolicy:{...settings.settings.dispatchPolicy!,holidays:[day(3)]}}))).toMatchObject({code:'OK'});
 const current=await plan(),input={orderId:order.orderId,expectedVersion:current!.version,previousEventId:null,date:day(0),channel:'telefon' as const,clientEventId:randomUUID()};
 const actor=await createFixture(['auftraege'],'werkstatt');
 const ordinary=await withSession(full,()=>saveIntakeTaskAction({clientKey:randomUUID(),version:0,kind:'aufgabe',title:'TEST normale Aufgabe bleibt offen',dueDate:berlinCalendarDay(),time:null,forLogin:full.actorId,forArea:null,reference:{type:'auftrag',id:order.orderId},note:null}));if(ordinary.code!=='OK')throw Error('APPOINTMENT_ORDINARY_TASK');
 const original=await sql`SELECT payload->'document' AS document FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${prepared.document.id}`;
 const endedTask=finalTaskId??prepared.taskId,name='test_post_appointment_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='ORDER_COLLECTION_TASK_ENDED_FOR_APPOINTMENT_V1' AND NEW.payload->>'taskId'='${endedTask}' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${name}()`);
 try{
  expect(await withSession(actor,()=>setOrderPickupAppointmentAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT status FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${endedTask}::uuid`).toEqual([{status:'offen'}]);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toHaveLength(0);
 }finally{await sql.unsafe(`DROP TRIGGER ${name} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${name}()`);}
 const agreement=await withSession(actor,()=>setOrderPickupAppointmentAction(JSON.parse(JSON.stringify(input))));if(agreement.code!=='OK')throw Error('APPOINTMENT_SET');
 expect(await sql`SELECT status,erledigt_von::text AS actor FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${endedTask}::uuid`).toEqual([{status:'erledigt',actor:actor.actorId}]);
 expect(await sql`SELECT payload->'document' AS document FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${prepared.document.id}`).toEqual(original);
 expect(await withSession(full,()=>getIntakeTaskAction({taskId:ordinary.task.id}))).toMatchObject({code:'OK',task:{status:'offen'}});
 expect(await withSession(actor,()=>setOrderPickupAppointmentAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 const paused=await plan();expect(paused!.finishedDispatch).toMatchObject({pickupAppointment:{eventId:agreement.receipt.eventId,date:day(0),resumeOn:day(4),paused:true},reminder:{state:'PAUSED',due:day(4),clientKey:null},storage:{state:'WAIT'}});
 if(stage==='posted'){
  expect(paused!.finishedDispatch!.storage!.letter!.finalStage).toMatchObject({state:'COMPLETED',taskId:finalTaskId,due:post.postalResult.postedOn});
  expect(await withSession(full,()=>createStorageFinalTaskAction(request))).toMatchObject({code:'OK',taskId:finalTaskId,replayed:true});
 }else expect(await withSession(full,()=>createStorageFinalTaskAction(request))).toMatchObject({code:'CONFLICT'});
 if(stage==='unposted'){
  expect(await withSession(full,()=>completeIntakeTaskAction(post))).toMatchObject({code:'CONFLICT'});
  expect(await sql`SELECT status,version FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${prepared.taskId}::uuid`).toEqual([{status:'erledigt',version:post.version+1}]);
 }
 expect(await withSession(full,()=>getIntakeTaskAction({taskId:prepared.taskId}))).toMatchObject({code:'OK',postalLetter:{state:stage==='posted'?'POSTED':'ENDED_BY_APPOINTMENT',document:{sha256:prepared.document.sha256}}});
 if(stage==='unposted'){
  expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),email:'TEST-anderer-eingang@example.invalid'}))).toMatchObject({code:'OK'});
  const extra=await readyInvoiceOrder('Andere-Ware-ohne-Termin','pickup',false,order.customerId);
  expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),email:''}))).toMatchObject({code:'OK'});
  const queue=await withSession(full,()=>getOrdersDb());if(!queue.ok)throw Error('APPOINTMENT_OTHER_QUEUE');
  const next=queue.data.find(row=>row.id===extra.orderId)!.finishedDispatch!.reminder!;expect(next.state).toBe('DUE');
  const call=await withSession(full,()=>createDispatchCallTaskAction({customerId:order.customerId,handover:'pickup',dueDate:next.due!,clientKey:next.clientKey!}));if(call.code!=='OK')throw Error('APPOINTMENT_OTHER_CALL');
  const read=await withSession(full,()=>getIntakeTaskAction({taskId:call.taskId}));if(read.code!=='OK'||!read.task)throw Error('APPOINTMENT_OTHER_TASK');
  expect(await withSession(full,()=>completeIntakeTaskAction({taskId:call.taskId,version:read.task!.version,note:'TEST andere Ware nicht erreicht',callResult:'notReached'}))).toMatchObject({code:'OK'});
  expect((await plan())!.finishedDispatch!.reminder).toMatchObject({state:'PAUSED',due:day(4)});
 }
});

it('the configured storage rate and its actual audit receipt commit together or roll back for a recoverable retry',async()=>{
 await readyInvoiceOrder('Lagergeld-Audit');
 const before=await withSession(full,()=>readShippingSettingsAction());if(before.code!=='OK')throw Error('STORAGE_AUDIT_SETTINGS');
 const input={service:before.settings.service,numberPattern:before.settings.numberPattern,numberHint:before.settings.numberHint,trackingUrl:before.settings.trackingUrl,expectedUpdatedAt:before.settings.updatedAt,dispatchPolicy:{...emptyDispatchPolicy(),storageWeeklyCents:700}},name='test_storage_audit_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id = '${KREILE_TENANT_SLUG}' AND NEW.event_type = 'shipping_settings_updated' AND NEW.payload->'after'->'dispatchPolicy'->>'storageWeeklyCents' = '700' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 try{
  await sql.unsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON public.ui_events FOR EACH ROW EXECUTE FUNCTION private.${name}()`);
  expect(await withSession(full,()=>saveShippingSettingsAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(await withSession(full,()=>readShippingSettingsAction())).toEqual(before);
  expect(await sql`SELECT id FROM public.ui_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='shipping_settings_updated' AND payload->'after'->'dispatchPolicy'->>'storageWeeklyCents'='700'`).toHaveLength(0);
 }finally{
  await sql.unsafe(`DROP TRIGGER IF EXISTS ${name} ON public.ui_events`);
  await sql.unsafe(`DROP FUNCTION private.${name}()`);
 }
 expect(await withSession(full,()=>saveShippingSettingsAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:false,settings:{dispatchPolicy:{storageWeeklyCents:700}}});
 expect(await withSession(full,()=>saveShippingSettingsAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT payload->>'actorId' AS actor FROM public.ui_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='shipping_settings_updated' AND payload->'after'->'dispatchPolicy'->>'storageWeeklyCents'='700'`).toEqual([{actor:full.actorId}]);
});
it('PL12:06 freezes the promised postal deadline in the original despite later interval and calendar changes',async()=>{
 const {order,request,plan}=await prepareWithoutMail('Frist-im-Original');
 const prepared=await withSession(full,()=>prepareStoragePostalLetterAction(request));if(prepared.code!=='OK')throw Error('FROZEN_DEADLINE_PREPARE');
 const [original]=await sql`SELECT payload->'document'->'snapshot' AS snapshot FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${prepared.document.id}`;
 expect(original.snapshot.deadline).toEqual({date:berlinCalendarDay(),due:berlinCalendarDay()});
 expect(original.snapshot.body).toContain(berlinCalendarDay().split('-').reverse().join('.'));
 const task=await withSession(full,()=>getIntakeTaskAction({taskId:prepared.taskId}));if(task.code!=='OK'||!task.task)throw Error('FROZEN_DEADLINE_TASK');
 const taskVersion=task.task.version;
 expect(await withSession(full,()=>completeIntakeTaskAction({taskId:prepared.taskId,version:taskVersion,note:'TEST Original zur Post',postalResult:{kind:'posted',postedOn:berlinCalendarDay(),documentSha256:prepared.document.sha256}}))).toMatchObject({code:'OK'});
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('FROZEN_DEADLINE_SETTINGS');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberPattern:settings.settings.numberPattern,numberHint:settings.settings.numberHint,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,dispatchPolicy:{...settings.settings.dispatchPolicy!,finalStageAfterLetterDays:20,holidays:[berlinCalendarDay()]}}))).toMatchObject({code:'OK'});
 expect((await plan())?.finishedDispatch?.storage?.letter?.finalStage).toMatchObject({state:'DUE',due:original.snapshot.deadline.due});
 const final=await withSession(full,()=>createStorageFinalTaskAction(request));expect(final.code).toBe('OK');if(final.code!=='OK')throw Error('FROZEN_DEADLINE_FINAL');
 expect(await withSession(full,()=>createStorageFinalTaskAction(JSON.parse(JSON.stringify(request))))).toMatchObject({code:'OK',taskId:final.taskId,replayed:true});
 expect(await sql`SELECT payload->'document'->'snapshot' AS snapshot FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${prepared.document.id}`).toEqual([original]);
 expect((await plan())?.finishedDispatch?.storage?.letter?.finalStage).toMatchObject({state:'TASK_PENDING',due:original.snapshot.deadline.due,taskId:final.taskId});
 expect(await sql`SELECT count(*)::int AS n FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_id=${order.orderId} AND status='offen'`).toEqual([{n:1}]);
});
it('PL12:06 freezes the actual mail original deadline and preserves its fresh retry after settings shorten the interval',async()=>{
 const {order,request,plan}=await prepareLetter('Mailfrist-Original');
 const input={targetType:'CUSTOMER' as const,targetId:order.customerId,clientRequestId:randomUUID(),subject:'TEST Lagerfrist',body:'TEST Bitte melde Dich zur Übergabe.',collectionReminder:{stage:'E4' as const,handover:'pickup' as const,dueDate:(await plan())?.storage?.letter?.due??'',clientKey:request.clientKey}};
 const sent=await withSession(full,()=>sendCustomerMailAction(input));expect(sent.code).toBe('OK');
 const [proof]=await sql`SELECT payload->'meta'->'storageDeadline' AS deadline FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REMINDER_PREPARED_V1' AND correlation_id=${input.clientRequestId}::uuid`;
 expect(proof.deadline.date).toBe(berlinCalendarDay());expect(proof.deadline.due>berlinCalendarDay()).toBe(true);
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('MAIL_DEADLINE_SETTINGS');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberPattern:settings.settings.numberPattern,numberHint:settings.settings.numberHint,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,dispatchPolicy:{...settings.settings.dispatchPolicy!,finalStageAfterLetterDays:0,finalStageRecipientId:full.actorId}}))).toMatchObject({code:'OK'});
 const queue=await withSession(full,()=>getOrdersDb());if(!queue.ok)throw Error('MAIL_DEADLINE_QUEUE');
 expect(queue.data.find(row=>row.id===order.orderId)?.finishedDispatch?.storage?.letter?.finalStage).toMatchObject({state:'WAIT',due:proof.deadline.due});
 expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',data:{replayed:true}});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND correlation_id=${input.clientRequestId}::uuid`).toEqual([{n:1}]);
});
it('PL12:06 a missed actual pickup agreement starts E4 through postal original and E5 without inventing a call',async()=>{
 const order=await readyInvoiceOrder('Verpasster-Termin');
 expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),email:''}))).toMatchObject({code:'OK'});
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('MISSED_SETTINGS');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberPattern:settings.settings.numberPattern,numberHint:settings.settings.numberHint,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,dispatchPolicy:{...emptyDispatchPolicy(),holidays:[],storageAfterDays:0,finalStageAfterLetterDays:0,finalStageRecipientId:full.actorId}}))).toMatchObject({code:'OK'});
 const past=new Date(berlinCalendarDay()+'T12:00:00Z');past.setUTCDate(past.getUTCDate()-7);
 const agreement=await withSession(full,()=>setOrderPickupAppointmentAction({orderId:order.orderId,expectedVersion:order.version,previousEventId:null,date:past.toISOString().slice(0,10),channel:'telefon',clientEventId:randomUUID()}));if(agreement.code!=='OK')throw Error('MISSED_AGREEMENT');
 async function current(){const queue=await withSession(full,()=>getOrdersDb());if(!queue.ok)throw Error('MISSED_QUEUE');return queue.data.find(row=>row.id===order.orderId)!;}
 const row=await current(),letter=row.finishedDispatch?.storage?.letter;
 expect(row.finishedDispatch?.storage).toMatchObject({state:'DUE',appointmentEventId:agreement.receipt.eventId});
 expect(letter).toMatchObject({state:'DUE',appointmentEventId:agreement.receipt.eventId});expect(letter).not.toHaveProperty('callTaskId');if(!letter)throw Error('MISSED_LETTER');
 let request={customerId:order.customerId,handover:'pickup' as const,clientKey:letter.clientKey};
 let prepared=await withSession(full,()=>prepareStoragePostalLetterAction(request));expect(prepared.code).toBe('OK');if(prepared.code!=='OK')throw Error('MISSED_ORIGINAL');
 const first=prepared,firstTask=await withSession(full,()=>getIntakeTaskAction({taskId:first.taskId}));if(firstTask.code!=='OK'||!firstTask.task)throw Error('MISSED_FIRST_TASK');const firstVersion=firstTask.task.version;
 expect(await withSession(full,()=>completeIntakeTaskAction({taskId:first.taskId,version:firstVersion,note:'TEST Adresse korrigieren',postalResult:{kind:'discarded',documentSha256:first.document.sha256,reason:'TEST Adresse korrigieren'}}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),street:'TEST Neuer Weg'}))).toMatchObject({code:'OK'});
 const replacement=(await current()).finishedDispatch?.storage?.letter;expect(replacement?.state).toBe('DUE');expect(replacement?.clientKey).not.toBe(request.clientKey);if(!replacement)throw Error('MISSED_REPLACEMENT');
 request={...request,clientKey:replacement.clientKey};prepared=await withSession(full,()=>prepareStoragePostalLetterAction(request));if(prepared.code!=='OK')throw Error('MISSED_REPLACEMENT_ORIGINAL');
 expect(await withSession(full,()=>getIntakeTaskAction({taskId:first.taskId}))).toMatchObject({code:'OK',postalLetter:{state:'VOIDED',document:{sha256:first.document.sha256}}});
 expect(await sql`SELECT payload->'meta'->'storageOrigin' AS origin FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${prepared.document.id}`).toEqual([{origin:{appointmentEventId:agreement.receipt.eventId,freezes:letter.freezes}}]);
 const task=await withSession(full,()=>getIntakeTaskAction({taskId:prepared.taskId}));if(task.code!=='OK'||!task.task)throw Error('MISSED_POST_TASK');const version=task.task.version;
 const post={taskId:prepared.taskId,version,note:'TEST echter Postversand',postalResult:{kind:'posted' as const,postedOn:berlinCalendarDay(),documentSha256:prepared.document.sha256}};
 expect(await withSession(full,()=>completeIntakeTaskAction(post))).toMatchObject({code:'OK'});
 expect((await current()).finishedDispatch?.storage?.letter?.finalStage).toMatchObject({state:'DUE'});
 const final=await withSession(full,()=>createStorageFinalTaskAction(request));expect(final.code).toBe('OK');if(final.code!=='OK')throw Error('MISSED_FINAL');
 expect(await withSession(full,()=>createStorageFinalTaskAction(JSON.parse(JSON.stringify(request))))).toMatchObject({code:'OK',replayed:true,taskId:final.taskId});
 expect((await current()).finishedDispatch?.storage?.letter?.finalStage).toMatchObject({state:'TASK_PENDING',taskId:final.taskId});
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type IN ('ORDER_COLLECTION_CALL_CREATED_V1','ORDER_COLLECTION_CALL_RESULT_V1') AND payload->'meta'->'orderIds' @> ${sql.json([order.orderId])}`).toHaveLength(0);
});
it('PL12:06 missed-appointment eligibility observes both working-day boundaries without defaults',()=>{
 const policy={...emptyDispatchPolicy(),holidays:['2026-11-09'],storageAfterDays:0};
 expect(pickupStorageDue('2026-11-06',policy)).toBe('2026-11-10');
 expect(pickupStorageDue('2026-11-06',{...policy,storageAfterDays:3})).toBe('2026-11-12');
 expect(pickupStorageDue('2026-11-06',{...policy,storageAfterDays:null})).toBeNull();
 expect(pickupStorageDue('2026-11-06',null)).toBeNull();
});
it('PL12:06 a missed pickup uses the existing mail sender and final task, while a newer agreement invalidates the old proposal',async()=>{
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-missed-appointment-token'.repeat(4),expires_in:3600});if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail'))return new Response(null,{status:202});return nativeFetch(input,init);});
 const order=await readyInvoiceOrder('Verpasster-Termin-Mail'),settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('MISSED_MAIL_SETTINGS');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberPattern:settings.settings.numberPattern,numberHint:settings.settings.numberHint,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,dispatchPolicy:{...emptyDispatchPolicy(),holidays:[],storageAfterDays:0,finalStageAfterLetterDays:0,finalStageRecipientId:full.actorId,holdMinutes:0}}))).toMatchObject({code:'OK'});
 const past=new Date(berlinCalendarDay()+'T12:00:00Z');past.setUTCDate(past.getUTCDate()-7);
 const agreement=await withSession(full,()=>setOrderPickupAppointmentAction({orderId:order.orderId,expectedVersion:order.version,previousEventId:null,date:past.toISOString().slice(0,10),channel:'persoenlich',clientEventId:randomUUID()}));if(agreement.code!=='OK')throw Error('MISSED_MAIL_AGREEMENT');
 const queue=await withSession(full,()=>getOrdersDb());if(!queue.ok)throw Error('MISSED_MAIL_QUEUE');const letter=queue.data.find(row=>row.id===order.orderId)?.finishedDispatch?.storage?.letter;if(!letter)throw Error('MISSED_MAIL_LETTER');
 const request={targetType:'CUSTOMER' as const,targetId:order.customerId,clientRequestId:randomUUID(),subject:'TEST Lagerfrist nach vereinbartem Termin',body:'TEST Bitte melde Dich zur Übergabe.',collectionReminder:{stage:'E4' as const,handover:'pickup' as const,dueDate:letter.due,clientKey:letter.clientKey}};
 expect(await withSession(full,()=>sendCustomerMailAction(request))).toMatchObject({code:'OK'});
 expect(await sql`SELECT payload->'meta'->'storageOrigin' AS origin FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND correlation_id=${request.clientRequestId}::uuid`).toEqual([{origin:{appointmentEventId:agreement.receipt.eventId,freezes:letter.freezes}}]);
 const final=await withSession(full,()=>createStorageFinalTaskAction({customerId:order.customerId,handover:'pickup',clientKey:letter.clientKey}));expect(final.code).toBe('OK');if(final.code!=='OK')throw Error('MISSED_MAIL_FINAL');
 expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(request))))).toMatchObject({code:'OK',data:{replayed:true}});
 const future=new Date();future.setUTCDate(future.getUTCDate()+14);
 expect(await withSession(full,()=>setOrderPickupAppointmentAction({orderId:order.orderId,expectedVersion:order.version,previousEventId:agreement.receipt.eventId,date:future.toISOString().slice(0,10),channel:'telefon',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>sendCustomerMailAction({...request,clientRequestId:randomUUID()}))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT status FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${final.taskId}::uuid`).toEqual([{status:'erledigt'}]);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type IN ('ORDER_COLLECTION_CALL_CREATED_V1','ORDER_COLLECTION_CALL_RESULT_V1') AND payload->'meta'->'orderIds' @> ${sql.json([order.orderId])}`).toHaveLength(0);
});
