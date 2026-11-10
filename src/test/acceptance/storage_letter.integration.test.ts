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
import {createDispatchCallTaskAction,getIntakeTaskAction,completeIntakeTaskAction} from '@/app/actions/eingang.actions';
import {previewStorageLetterAction} from '@/app/actions/pdf.actions';
import {readShippingSettingsAction,saveShippingSettingsAction} from '@/app/actions/settings.actions';
import {emptyDispatchPolicy} from '@/modules/fundament/public';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('STORAGE_LETTER_LOOPBACK_REQUIRED');

it('E4 preview renders a real customer/sender PDF without invoice-only settings, writes nothing and rejects missing address or rights',async()=>{
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-storage-letter-token'.repeat(4),expires_in:3600});if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail'))return new Response(null,{status:202});return nativeFetch(input,init);});
 const order=await readyInvoiceOrder('Lagerfrist-Vorschau');
 expect(await withSession(full,()=>sendCustomerMailAction({targetType:'ORDER',targetId:order.orderId,clientRequestId:randomUUID(),subject:'TEST Ware fertig',body:'TEST Ware fertig',attachment:{kind:'INVOICE',documentId:order.invoice.invoiceId}}))).toMatchObject({code:'OK'});
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('LETTER_SETTINGS');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberPattern:settings.settings.numberPattern,numberHint:settings.settings.numberHint,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,dispatchPolicy:{...emptyDispatchPolicy(),reminderDays:0,secondReminderDays:0,callAfterDays:0,storageAfterDays:0,finalStageAfterLetterDays:4,holdMinutes:0}}))).toMatchObject({code:'OK'});
 async function plan(){const queue=await withSession(full,()=>getOrdersDb());if(!queue.ok)throw Error('LETTER_QUEUE');return queue.data.find(row=>row.id===order.orderId)?.finishedDispatch;}
 for(const stage of ['E1','E2'] as const){const p=await plan();expect(await withSession(full,()=>sendCustomerMailAction({targetType:'CUSTOMER',targetId:order.customerId,clientRequestId:randomUUID(),subject:'TEST '+stage,body:'TEST Bitte abholen',collectionReminder:{stage,handover:'pickup',dueDate:p!.reminder!.due!}}))).toMatchObject({code:'OK'});}
 const initial=await plan(),call=await withSession(full,()=>createDispatchCallTaskAction({customerId:order.customerId,handover:'pickup',dueDate:initial!.reminder!.due!,clientKey:initial!.reminder!.clientKey!}));if(call.code!=='OK')throw Error('LETTER_CALL');
 const task=await withSession(full,()=>getIntakeTaskAction({taskId:call.taskId}));if(task.code!=='OK'||!task.task)throw Error('LETTER_CALL_TASK');
 expect(await withSession(full,()=>completeIntakeTaskAction({taskId:call.taskId,version:task.task!.version,note:'TEST nicht erreicht',callResult:'notReached'}))).toMatchObject({code:'OK'});
 const due=await plan(),request={customerId:order.customerId,handover:'pickup' as const,clientKey:due!.storage!.letter!.clientKey};
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
