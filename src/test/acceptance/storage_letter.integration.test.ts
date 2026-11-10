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
import {createDispatchCallTaskAction,createStorageFinalTaskAction,getIntakeTaskAction,completeIntakeTaskAction,saveIntakeTaskAction} from '@/app/actions/eingang.actions';
import {previewStorageLetterAction,prepareStoragePostalLetterAction} from '@/app/actions/pdf.actions';
import {updateCustomerAction} from '@/app/actions/customers.actions';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import {recordGoodsOutAction} from '@/app/actions/goodsOut.actions';
import {readShippingSettingsAction,saveShippingSettingsAction} from '@/app/actions/settings.actions';
import {emptyDispatchPolicy} from '@/modules/fundament/public';
import {COLLECTION_REMINDER_COPY} from '@/ui/situationCatalog';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('STORAGE_LETTER_LOOPBACK_REQUIRED');

async function prepareLetter(label:string){
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-storage-letter-token'.repeat(4),expires_in:3600});if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail'))return new Response(null,{status:202});return nativeFetch(input,init);});
 const order=await readyInvoiceOrder(label);
 expect(await withSession(full,()=>sendCustomerMailAction({targetType:'ORDER',targetId:order.orderId,clientRequestId:randomUUID(),subject:'TEST Ware fertig',body:'TEST Ware fertig',attachment:{kind:'INVOICE',documentId:order.invoice.invoiceId}}))).toMatchObject({code:'OK'});
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('LETTER_SETTINGS');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberPattern:settings.settings.numberPattern,numberHint:settings.settings.numberHint,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,dispatchPolicy:{...emptyDispatchPolicy(),reminderDays:0,secondReminderDays:0,callAfterDays:0,storageAfterDays:0,finalStageAfterLetterDays:4,holdMinutes:0}}))).toMatchObject({code:'OK'});
 async function plan(){const queue=await withSession(full,()=>getOrdersDb());if(!queue.ok)throw Error('LETTER_QUEUE');return queue.data.find(row=>row.id===order.orderId)?.finishedDispatch;}
 for(const stage of ['E1','E2'] as const){const p=await plan();expect(await withSession(full,()=>sendCustomerMailAction({targetType:'CUSTOMER',targetId:order.customerId,clientRequestId:randomUUID(),subject:'TEST '+stage,body:'TEST Bitte abholen',collectionReminder:{stage,handover:'pickup',dueDate:p!.reminder!.due!}}))).toMatchObject({code:'OK'});}
 const initial=await plan(),call=await withSession(full,()=>createDispatchCallTaskAction({customerId:order.customerId,handover:'pickup',dueDate:initial!.reminder!.due!,clientKey:initial!.reminder!.clientKey!}));if(call.code!=='OK')throw Error('LETTER_CALL');
 const task=await withSession(full,()=>getIntakeTaskAction({taskId:call.taskId}));if(task.code!=='OK'||!task.task)throw Error('LETTER_CALL_TASK');
 expect(await withSession(full,()=>completeIntakeTaskAction({taskId:call.taskId,version:task.task!.version,note:'TEST nicht erreicht',callResult:'notReached'}))).toMatchObject({code:'OK'});
 const due=await plan(),request={customerId:order.customerId,handover:'pickup' as const,clientKey:due!.storage!.letter!.clientKey};
 return {order,request,plan};
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

it('E4 preview renders a real customer/sender PDF without invoice-only settings, writes nothing and rejects missing address or rights',async()=>{
 const {order,request,plan}=await prepareLetter('Lagerfrist-Vorschau');
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
});
it('postal E4 secures one original and one task; only the explicit posting date advances E5, with fresh retry and no mail call',async()=>{
 const {order,request,plan}=await prepareLetter('Lagerfrist-Post');
 expect(await withSession(full,()=>updateCustomerAction({customerId:order.customerId,clientEventId:randomUUID(),email:''}))).toMatchObject({code:'OK'});
 const graphCalls=()=>vi.mocked(globalThis.fetch).mock.calls.filter(([input])=>String(typeof input==='string'?input:input instanceof URL?input.href:input.url).includes('graph.microsoft.com')).length;
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
 const input={taskId:prepared.taskId,version:task.task.version,note:'TEST Brief versendet',postalResult:{kind:'posted' as const,postedOn:berlinCalendarDay(),documentSha256:prepared.document.sha256}};
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
 const input={taskId:first.taskId,version:task.task.version,note:'TEST Adresse korrigieren',postalResult:{kind:'discarded' as const,reason:'TEST Adresse korrigiert',documentSha256:first.document.sha256}};
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
it('a rejected postal task history rolls back the dispatch receipt and completion, then the same request can recover',async()=>{
 const {request,plan}=await prepareWithoutMail('Post-Historie-Rollback');
 const prepared=await withSession(full,()=>prepareStoragePostalLetterAction(request));if(prepared.code!=='OK')throw Error('POSTAL_ROLLBACK_PREPARE');
 const read=await withSession(full,()=>getIntakeTaskAction({taskId:prepared.taskId}));if(read.code!=='OK'||!read.task)throw Error('POSTAL_ROLLBACK_TASK');
 const input={taskId:prepared.taskId,version:read.task.version,note:'TEST Versand mit Historie',postalResult:{kind:'posted' as const,postedOn:berlinCalendarDay(),documentSha256:prepared.document.sha256}};
 const name='test_postal_'+randomUUID().replaceAll('-','');
 // Real DB failure, restricted to this synthetic task; neither action nor persistence is mocked.
 await sql.unsafe(`CREATE FUNCTION private.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id = '${KREILE_TENANT_SLUG}' AND NEW.nachher->>'taskId' = '${prepared.taskId}' AND NEW.nachher->>'action' = 'aufgabe.erledigt' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 try{
  await sql.unsafe(`CREATE TRIGGER ${name} BEFORE INSERT ON public.intake_event FOR EACH ROW EXECUTE FUNCTION private.${name}()`);
  expect(await withSession(full,()=>completeIntakeTaskAction(structuredClone(input)))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT status,version,erledigt_am FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${prepared.taskId}::uuid`).toEqual([{status:'offen',version:input.version,erledigt_am:null}]);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND payload->>'documentId'=${prepared.document.id}`).toHaveLength(0);
  expect((await plan())!.finishedDispatch!.storage!.letter).toMatchObject({state:'WAIT_FOR_POST',sentAt:null,finalStage:{due:null}});
  expect(await withSession(full,()=>getIntakeTaskAction({taskId:prepared.taskId}))).toMatchObject({code:'OK',postalLetter:{state:'WAIT_FOR_POST',document:{sha256:prepared.document.sha256}}});
 }finally{
  await sql.unsafe(`DROP TRIGGER IF EXISTS ${name} ON public.intake_event`);
  await sql.unsafe(`DROP FUNCTION private.${name}()`);
 }
 expect(await withSession(full,()=>completeIntakeTaskAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:false});
 expect((await plan())!.finishedDispatch!.storage!.letter).toMatchObject({state:'SENT',postalDocumentId:prepared.document.id,finalStage:{state:'DUE'}});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND payload->>'documentId'=${prepared.document.id}`).toEqual([{n:1}]);
 expect(await sql`SELECT count(*)::int AS n FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND nachher->>'taskId'=${prepared.taskId} AND nachher->>'action'='aufgabe.erledigt'`).toEqual([{n:1}]);
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
