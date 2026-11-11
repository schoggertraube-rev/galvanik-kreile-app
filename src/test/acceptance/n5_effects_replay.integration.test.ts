// @vitest-environment node
// S02 preparation: existing commands only, no new application behaviour.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,nativeFetch,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder,customerFixture} from '../../../e2e/ablauf/orderFixture';
import {getLiveOrderCardAction,getManualShippingAction,saveManualTrackingAction} from '@/app/actions/orders.actions';
import {confirmPaymentAction,getOrderPaymentStateAction} from '@/app/actions/payments.actions';
import {recordGoodsOutAction} from '@/app/actions/goodsOut.actions';
import {sendCustomerMailAction} from '@/app/actions/communications.actions';
import {readShippingSettingsAction,saveShippingSettingsAction} from '@/app/actions/settings.actions';

const fresh=<T>(input:T):T=>JSON.parse(JSON.stringify(input));

it.each([false,true])('S02 A2 cancellation preserves mail and one money task (longName=%s)',async(longName)=>{
 const customerId=await customerFixture(longName?'Langer Kunde '.repeat(9):'A');
 const a=await readyInvoiceOrder('N5 A2','pickup',false,customerId);
 const [customer]=await sql`SELECT name,email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${a.customerId}`;
 const input={targetType:'ORDER' as const,targetId:a.orderId,subject:'TEST N5 A2',body:'TEST echtes Original',clientRequestId:randomUUID(),attachment:{kind:'INVOICE' as const,documentId:a.invoice.invoiceId},expectedInvoiceIds:[a.invoice.invoiceId]};
 let sends=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-N5-A2-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;throw Error('TEST A2 accepted, response lost');}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages'))return Response.json({value:[{id:'TEST-A2-Sent',internetMessageId:'<TEST-A2@example.invalid>',from:{emailAddress:{address:process.env.MS_GRAPH_MAILBOX}},toRecipients:[{emailAddress:{address:customer.email}}],isDraft:false,sentDateTime:new Date().toISOString(),internetMessageHeaders:[{name:'x-kreile-request-id',value:input.clientRequestId}]}]});
  return nativeFetch(request,init);
 });
 expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'UNAVAILABLE'});
 const {cancelInvoiceAction}=await import('@/app/actions/invoices.actions');
 const [invoice]=await sql`SELECT aggregate_version FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${a.invoice.invoiceId}::uuid`;
 expect(await withSession(full,()=>cancelInvoiceAction({invoiceId:a.invoice.invoiceId,expectedVersion:invoice.aggregate_version,reason:'TEST Storno vor Abgleich',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const recovered=await withSession(full,()=>sendCustomerMailAction(fresh(input)));
 expect(recovered).toMatchObject({code:'OK',data:{replayed:true}});
 expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'OK',data:{replayed:true}});
 expect(sends).toBe(1);
 expect(await sql`SELECT status FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${a.invoice.invoiceId}::uuid`).toEqual([{status:'cancelled'}]);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type IN('COMMUNICATION_DOCUMENT_SENT_V1','ORDER_CUSTOMER_INFORMED_V1') AND order_id=${a.orderId}`).toHaveLength(0);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_MAIL_SENT_V1' AND correlation_id=${input.clientRequestId}::uuid`).toHaveLength(1);
 const tasks=await sql`SELECT task.id::text,task.titel,task.fuer_bereich,task.notiz FROM public.tasks task JOIN public.events source ON source.tenant_id=task.tenant_id AND source.payload->>'taskId'=task.id::text AND source.event_type='COMMUNICATION_INVOICE_TASK_CREATED_V1' WHERE task.tenant_id=${KREILE_TENANT_SLUG} AND source.payload->>'invoiceId'=${a.invoice.invoiceId}`;
 expect(tasks).toEqual([{id:expect.any(String),titel:expect.stringMatching(/^Storno an .+ senden – Rechnung .+ kam trotz Storno an$/),fuer_bereich:'geld',notiz:expect.stringContaining('Kunde: '+customer.name+'\nRechnung: '+a.invoice.invoiceNumber+'\nSendezeit: ')}]);
 expect(Array.from(tasks[0].titel).length).toBeLessThanOrEqual(120);expect(tasks[0].titel).toContain(a.invoice.invoiceNumber);expect(tasks[0].notiz).not.toContain('nicht belegt');
},120000);

it('S02 A2 missing task source receipt keeps the physical mail and repairs the task atomically',async()=>{
 const a=await readyInvoiceOrder('A');
 const [customer]=await sql`SELECT name,email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${a.customerId}`;
 const input={targetType:'ORDER' as const,targetId:a.orderId,subject:'TEST N5 A2',body:'TEST echtes Original',clientRequestId:randomUUID(),attachment:{kind:'INVOICE' as const,documentId:a.invoice.invoiceId},expectedInvoiceIds:[a.invoice.invoiceId]};
 let sends=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-N5-A2-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;throw Error('TEST A2 accepted, response lost');}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages'))return Response.json({value:[{id:'TEST-A2-Sent',internetMessageId:'<TEST-A2@example.invalid>',from:{emailAddress:{address:process.env.MS_GRAPH_MAILBOX}},toRecipients:[{emailAddress:{address:customer.email}}],isDraft:false,sentDateTime:new Date().toISOString(),internetMessageHeaders:[{name:'x-kreile-request-id',value:input.clientRequestId}]}]});
  return nativeFetch(request,init);
 });
 expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'UNAVAILABLE'});
 const {cancelInvoiceAction}=await import('@/app/actions/invoices.actions');
 const [invoice]=await sql`SELECT aggregate_version FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${a.invoice.invoiceId}::uuid`;
 expect(await withSession(full,()=>cancelInvoiceAction({invoiceId:a.invoice.invoiceId,expectedVersion:invoice.aggregate_version,reason:'TEST Storno vor Abgleich',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const guard='test_invoice_task_receipt_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${guard}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='COMMUNICATION_INVOICE_TASK_CREATED_V1' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${guard} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${guard}()`);
 try{
  expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'OK',data:{replayed:true}});
  expect(await sql`SELECT id FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_id=${a.orderId}`).toHaveLength(0);
  expect(await sql`SELECT status FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+input.clientRequestId}`).toEqual([{status:'sent'}]);
 }finally{await sql.unsafe(`DROP TRIGGER ${guard} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${guard}()`);}
 const recovered=await withSession(full,()=>sendCustomerMailAction(fresh(input)));
 expect(recovered).toMatchObject({code:'OK',data:{replayed:true}});
 expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'OK',data:{replayed:true}});
 expect(sends).toBe(1);
 expect(await sql`SELECT status FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${a.invoice.invoiceId}::uuid`).toEqual([{status:'cancelled'}]);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type IN('COMMUNICATION_DOCUMENT_SENT_V1','ORDER_CUSTOMER_INFORMED_V1') AND order_id=${a.orderId}`).toHaveLength(0);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_MAIL_SENT_V1' AND correlation_id=${input.clientRequestId}::uuid`).toHaveLength(1);
 const tasks=await sql`SELECT task.id::text,task.titel,task.fuer_bereich,task.notiz FROM public.tasks task JOIN public.events source ON source.tenant_id=task.tenant_id AND source.payload->>'taskId'=task.id::text AND source.event_type='COMMUNICATION_INVOICE_TASK_CREATED_V1' WHERE task.tenant_id=${KREILE_TENANT_SLUG} AND source.payload->>'invoiceId'=${a.invoice.invoiceId}`;
 expect(tasks).toEqual([{id:expect.any(String),titel:expect.stringMatching(/^Storno an .+ senden – Rechnung .+ kam trotz Storno an$/),fuer_bereich:'geld',notiz:expect.stringContaining('Kunde: '+customer.name+'\nRechnung: '+a.invoice.invoiceNumber+'\nSendezeit: ')}]);
 expect(Array.from(tasks[0].titel).length).toBeLessThanOrEqual(120);expect(tasks[0].titel).toContain(a.invoice.invoiceNumber);expect(tasks[0].notiz).not.toContain('nicht belegt');
 const {getIntakeTaskAction,completeIntakeTaskAction}=await import('@/app/actions/eingang.actions');
 const read=await withSession(full,()=>getIntakeTaskAction({taskId:tasks[0].id}));
 expect(read).toMatchObject({code:'OK',canEdit:false,canComplete:false});
 if(read.code!=='OK'||!read.task)throw Error('N5_TASK_READ');
 expect(await withSession(full,()=>completeIntakeTaskAction({taskId:tasks[0].id,version:read.task!.version,note:'TEST kein simulierter Stornoversand'}))).toMatchObject({code:'FORBIDDEN'});
},120000);

it('S02 A2 mixed original bundle records only the still valid invoice effects',async()=>{
 const customerId=await customerFixture('A');
 const a=await readyInvoiceOrder('N5 mixed A','pickup',false,customerId),b=await readyInvoiceOrder('N5 mixed B','pickup',false,customerId);
 const [customer]=await sql`SELECT name,email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${a.customerId}`;
 const input={targetType:'ORDER' as const,targetId:a.orderId,subject:'TEST N5 A2',body:'TEST echtes Original',clientRequestId:randomUUID(),attachment:{kind:'INVOICE' as const,documentId:a.invoice.invoiceId},expectedInvoiceIds:[a.invoice.invoiceId,b.invoice.invoiceId]};
 let sends=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-N5-A2-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;throw Error('TEST A2 accepted, response lost');}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages'))return Response.json({value:[{id:'TEST-A2-Sent',internetMessageId:'<TEST-A2@example.invalid>',from:{emailAddress:{address:process.env.MS_GRAPH_MAILBOX}},toRecipients:[{emailAddress:{address:customer.email}}],isDraft:false,sentDateTime:new Date().toISOString(),internetMessageHeaders:[{name:'x-kreile-request-id',value:input.clientRequestId}]}]});
  return nativeFetch(request,init);
 });
 expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'UNAVAILABLE'});
 const {cancelInvoiceAction}=await import('@/app/actions/invoices.actions');
 const [invoice]=await sql`SELECT aggregate_version FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${a.invoice.invoiceId}::uuid`;
 expect(await withSession(full,()=>cancelInvoiceAction({invoiceId:a.invoice.invoiceId,expectedVersion:invoice.aggregate_version,reason:'TEST Storno vor Abgleich',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const recovered=await withSession(full,()=>sendCustomerMailAction(fresh(input)));
 expect(recovered).toMatchObject({code:'OK',data:{replayed:true}});
 expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'OK',data:{replayed:true}});
 expect(sends).toBe(1);
 expect(await sql`SELECT status FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${a.invoice.invoiceId}::uuid`).toEqual([{status:'cancelled'}]);
 expect(await sql`SELECT order_id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_CUSTOMER_INFORMED_V1' AND order_id IN(${a.orderId},${b.orderId})`).toEqual([{order_id:b.orderId}]);
 expect(await sql`SELECT payload->'document'->>'id' AS id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND correlation_id=${input.clientRequestId}::uuid`).toEqual([{id:b.invoice.invoiceId}]);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_MAIL_SENT_V1' AND correlation_id=${input.clientRequestId}::uuid`).toHaveLength(1);
 const tasks=await sql`SELECT task.id::text,task.titel,task.fuer_bereich,task.notiz FROM public.tasks task JOIN public.events source ON source.tenant_id=task.tenant_id AND source.payload->>'taskId'=task.id::text AND source.event_type='COMMUNICATION_INVOICE_TASK_CREATED_V1' WHERE task.tenant_id=${KREILE_TENANT_SLUG} AND source.payload->>'invoiceId'=${a.invoice.invoiceId}`;
 expect(tasks).toEqual([{id:expect.any(String),titel:expect.stringMatching(/^Storno an .+ senden – Rechnung .+ kam trotz Storno an$/),fuer_bereich:'geld',notiz:expect.stringContaining('Kunde: '+customer.name+'\nRechnung: '+a.invoice.invoiceNumber+'\nSendezeit: ')}]);
 expect(Array.from(tasks[0].titel).length).toBeLessThanOrEqual(120);expect(tasks[0].titel).toContain(a.invoice.invoiceNumber);expect(tasks[0].notiz).not.toContain('nicht belegt');
},120000);

it('S02 A4 no Sent Items fund after ten minutes and cancellation offers no resend',async()=>{
 const a=await readyInvoiceOrder('N5 A2 storniert');
 const input={targetType:'ORDER' as const,targetId:a.orderId,subject:'TEST N5 A2',body:'TEST echtes Original',clientRequestId:randomUUID(),attachment:{kind:'INVOICE' as const,documentId:a.invoice.invoiceId},expectedInvoiceIds:[a.invoice.invoiceId]};
 let sends=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-N5-A2-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;throw Error('TEST A2 accepted, response lost');}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages'))return Response.json({value:[]});
  return nativeFetch(request,init);
 });
 const clock='test_a4_clock_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${clock}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='COMMUNICATION_MAIL_PREPARED_V1' AND NEW.correlation_id='${input.clientRequestId}'::uuid THEN NEW.created_at=statement_timestamp()-interval '11 minutes'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${clock} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${clock}()`);
 try{expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'UNAVAILABLE'});}
 finally{await sql.unsafe(`DROP TRIGGER ${clock} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${clock}()`);}
 const {cancelInvoiceAction}=await import('@/app/actions/invoices.actions');
 const [invoice]=await sql`SELECT aggregate_version FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${a.invoice.invoiceId}::uuid`;
 expect(await withSession(full,()=>cancelInvoiceAction({invoiceId:a.invoice.invoiceId,expectedVersion:invoice.aggregate_version,reason:'TEST Storno vor Abgleich',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 for(const confirmedResend of [false,true]){
  const result=await withSession(full,()=>sendCustomerMailAction({...fresh(input),confirmedResend:confirmedResend||undefined}));
  expect(result).toMatchObject({code:'CONFLICT',message:'Rechnung '+a.invoice.invoiceNumber+' ist storniert – Versand nicht mehr nötig'});
  expect(result).not.toHaveProperty('resend');
 }
 expect(sends).toBe(1);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type IN('COMMUNICATION_MAIL_RESEND_CONFIRMED_V1','COMMUNICATION_DOCUMENT_SENT_V1') AND correlation_id=${input.clientRequestId}::uuid`).toHaveLength(0);
},120000);

it('S02 A5 invoice resend requires current money permission and stays singular',async()=>{
 const a=await readyInvoiceOrder('N5 A2 storniert');
 const [customer]=await sql`SELECT name,email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${a.customerId}`;
 const sender=await createFixture(['auftraege','mails','geld'],'buero');
 const input={targetType:'ORDER' as const,targetId:a.orderId,subject:'TEST N5 A2',body:'TEST echtes Original',clientRequestId:randomUUID(),attachment:{kind:'INVOICE' as const,documentId:a.invoice.invoiceId},expectedInvoiceIds:[a.invoice.invoiceId]};
 let sends=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-N5-A2-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;if(sends===1)throw Error('TEST A5 accepted, response lost');return new Response(null,{status:202});}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages'))return Response.json({value:[]});
  return nativeFetch(request,init);
 });
 const clock='test_a4_clock_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${clock}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='COMMUNICATION_MAIL_PREPARED_V1' AND NEW.correlation_id='${input.clientRequestId}'::uuid THEN NEW.created_at=statement_timestamp()-interval '11 minutes'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${clock} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${clock}()`);
 try{expect(await withSession(sender,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'UNAVAILABLE'});}
 finally{await sql.unsafe(`DROP TRIGGER ${clock} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${clock}()`);}
 await sql`DELETE FROM public.app_user_rights WHERE tenant_id=${KREILE_TENANT_SLUG} AND user_id=${sender.actorId}::uuid AND bereich='geld'`;
 const denied=await withSession(sender,()=>sendCustomerMailAction(fresh(input)));
 expect(denied).toMatchObject({code:'CONFLICT'});expect(denied).not.toHaveProperty('resend');
 expect(await withSession(sender,()=>sendCustomerMailAction({...fresh(input),confirmedResend:true}))).toMatchObject({code:'CONFLICT'});expect(sends).toBe(1);
 await sql`INSERT INTO public.app_user_rights(tenant_id,user_id,bereich,granted_by) VALUES(${KREILE_TENANT_SLUG},${sender.actorId}::uuid,'geld',${full.actorId}::uuid)`;
 expect(await withSession(sender,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'CONFLICT',resend:{requestId:input.clientRequestId,label:'Mail an '+customer.name+' erneut senden – nicht im Postausgang gefunden'}});
 const contenders=await Promise.all([withSession(sender,()=>sendCustomerMailAction({...fresh(input),confirmedResend:true})),withSession(sender,()=>sendCustomerMailAction({...fresh(input),confirmedResend:true}))]);
 expect(contenders.filter(row=>row.code==='OK')).toHaveLength(1);expect(sends).toBe(2);
 expect(await withSession(sender,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'OK',data:{replayed:true}});expect(sends).toBe(2);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_MAIL_RESEND_CONFIRMED_V1' AND correlation_id=${input.clientRequestId}::uuid`).toHaveLength(1);
},120000);

it('S02 recovered mail survives a real SQL follow-up failure and repairs once on retry',async()=>{
 const a=await readyInvoiceOrder('N5 A2 storniert');
 const [customer]=await sql`SELECT name,email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${a.customerId}`;
 const input={targetType:'ORDER' as const,targetId:a.orderId,subject:'TEST N5 A2',body:'TEST echtes Original',clientRequestId:randomUUID(),attachment:{kind:'INVOICE' as const,documentId:a.invoice.invoiceId},expectedInvoiceIds:[a.invoice.invoiceId]};
 let sends=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-N5-A2-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;throw Error('TEST A2 accepted, response lost');}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages'))return Response.json({value:[{id:'TEST-A2-Sent',internetMessageId:'<TEST-A2@example.invalid>',from:{emailAddress:{address:process.env.MS_GRAPH_MAILBOX}},toRecipients:[{emailAddress:{address:customer.email}}],isDraft:false,sentDateTime:new Date().toISOString(),internetMessageHeaders:[{name:'x-kreile-request-id',value:input.clientRequestId}]}]});
  return nativeFetch(request,init);
 });
 expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'UNAVAILABLE'});
 const failure='test_reconcile_follow_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${failure}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='COMMUNICATION_DOCUMENT_EFFECTS_APPLIED_V1' THEN RAISE EXCEPTION 'TEST follow-up SQL failure'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${failure} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${failure}()`);
 try{
  expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'OK',data:{replayed:true}});
  expect(await sql`SELECT status FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+input.clientRequestId}`).toEqual([{status:'sent'}]);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND correlation_id=${input.clientRequestId}::uuid`).toHaveLength(0);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_DOCUMENT_EFFECT_RETRY_REQUIRED_V1' AND correlation_id=${input.clientRequestId}::uuid`).toHaveLength(1);
 }finally{await sql.unsafe(`DROP TRIGGER ${failure} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${failure}()`);}
 const recovered=await withSession(full,()=>sendCustomerMailAction(fresh(input)));
 expect(recovered).toMatchObject({code:'OK',data:{replayed:true}});
 expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'OK',data:{replayed:true}});
 expect(sends).toBe(1);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND correlation_id=${input.clientRequestId}::uuid`).toHaveLength(1);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_CUSTOMER_INFORMED_V1' AND order_id=${a.orderId}`).toHaveLength(1);
},120000);

it('S02 directly accepted invoice mail survives SQL follow-up failure and repairs without sending',async()=>{
 const a=await readyInvoiceOrder('N5 A2 storniert');
 const [customer]=await sql`SELECT name,email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${a.customerId}`;
 const input={targetType:'ORDER' as const,targetId:a.orderId,subject:'TEST N5 A2',body:'TEST echtes Original',clientRequestId:randomUUID(),attachment:{kind:'INVOICE' as const,documentId:a.invoice.invoiceId},expectedInvoiceIds:[a.invoice.invoiceId]};
 let sends=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-N5-A2-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;return new Response(null,{status:202});}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages'))return Response.json({value:[{id:'TEST-A2-Sent',internetMessageId:'<TEST-A2@example.invalid>',from:{emailAddress:{address:process.env.MS_GRAPH_MAILBOX}},toRecipients:[{emailAddress:{address:customer.email}}],isDraft:false,sentDateTime:new Date().toISOString(),internetMessageHeaders:[{name:'x-kreile-request-id',value:input.clientRequestId}]}]});
  return nativeFetch(request,init);
 });
 const failure='test_reconcile_follow_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${failure}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='COMMUNICATION_DOCUMENT_EFFECTS_APPLIED_V1' THEN RAISE EXCEPTION 'TEST follow-up SQL failure'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${failure} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${failure}()`);
 try{
  expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'OK',data:{replayed:false}});
  expect(await sql`SELECT status FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+input.clientRequestId}`).toEqual([{status:'sent'}]);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND correlation_id=${input.clientRequestId}::uuid`).toHaveLength(0);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_DOCUMENT_EFFECT_RETRY_REQUIRED_V1' AND correlation_id=${input.clientRequestId}::uuid`).toHaveLength(1);
 }finally{await sql.unsafe(`DROP TRIGGER ${failure} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${failure}()`);}
 const recovered=await withSession(full,()=>sendCustomerMailAction(fresh(input)));
 expect(recovered).toMatchObject({code:'OK',data:{replayed:true}});
 expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'OK',data:{replayed:true}});
 expect(sends).toBe(1);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND correlation_id=${input.clientRequestId}::uuid`).toHaveLength(1);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_CUSTOMER_INFORMED_V1' AND order_id=${a.orderId}`).toHaveLength(1);
},120000);

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
  if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages'))return Response.json({value:[]});
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

it.each([false,true])('S02 A1/A3 recovers an original bundle with PREPARE authority (geldRemoved=%s)',async(geldRemoved)=>{
 const a=await readyInvoiceOrder('N5 A1 Original A'),b=await readyInvoiceOrder('N5 A1 Original B','pickup',false,a.customerId);
 const [customer]=await sql`SELECT email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${a.customerId}`;
 const input={targetType:'ORDER' as const,targetId:a.orderId,subject:'TEST N5 A1',body:'TEST gleiche Originalgruppe',clientRequestId:randomUUID(),attachment:{kind:'INVOICE' as const,documentId:a.invoice.invoiceId},expectedInvoiceIds:[a.invoice.invoiceId,b.invoice.invoiceId]};
 const sender=await createFixture(['auftraege','mails','geld'],'buero');
 let sends=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-N5-A1-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;throw Error('TEST A1 original accepted, response lost');}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages'))return Response.json({value:[{id:'TEST-A1-Sent',internetMessageId:'<TEST-A1@example.invalid>',from:{emailAddress:{address:process.env.MS_GRAPH_MAILBOX}},toRecipients:[{emailAddress:{address:customer.email}}],isDraft:false,sentDateTime:new Date().toISOString(),internetMessageHeaders:[{name:'x-kreile-request-id',value:input.clientRequestId}]}]});
  return nativeFetch(request,init);
 });
 expect(await withSession(sender,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'UNAVAILABLE'});
 if(geldRemoved){
  await sql`DELETE FROM public.app_user_rights WHERE tenant_id=${KREILE_TENANT_SLUG} AND user_id=${sender.actorId}::uuid AND bereich='geld'`;
  const {getOrderPaymentStateAction}=await import('@/app/actions/payments.actions');
  expect(await withSession(sender,()=>getOrderPaymentStateAction({orderId:a.orderId}))).toMatchObject({code:'FORBIDDEN'});
 }
 const retry={...fresh(input),clientRequestId:randomUUID()};
 expect(await withSession(sender,()=>sendCustomerMailAction(retry))).toMatchObject({code:'OK',data:{replayed:true}});expect(sends).toBe(1);
 expect(await withSession(sender,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'OK',data:{replayed:true}});expect(sends).toBe(1);
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND correlation_id=${input.clientRequestId}::uuid`).toEqual([{n:1}]);
 expect(await sql`SELECT user_id::text AS actor FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND correlation_id=${input.clientRequestId}::uuid`).toEqual([{actor:sender.actorId}]);
 expect(await sql`SELECT order_id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_CUSTOMER_INFORMED_V1' AND order_id IN(${a.orderId},${b.orderId}) ORDER BY order_id`).toEqual([a.orderId,b.orderId].sort().map(order_id=>({order_id})));
},120000);

it('S02 an address correction cannot replace the recipient of the original reconciliation',async()=>{
 const a=await readyInvoiceOrder('N5 A1 Original A'),b=await readyInvoiceOrder('N5 A1 Original B','pickup',false,a.customerId);
 const [customer]=await sql`SELECT email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${a.customerId}`;
 const input={targetType:'ORDER' as const,targetId:a.orderId,subject:'TEST N5 A1',body:'TEST gleiche Originalgruppe',clientRequestId:randomUUID(),attachment:{kind:'INVOICE' as const,documentId:a.invoice.invoiceId},expectedInvoiceIds:[a.invoice.invoiceId,b.invoice.invoiceId]};
 const sender=await createFixture(['auftraege','mails','geld'],'buero');
 let sends=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-N5-A1-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;throw Error('TEST A1 original accepted, response lost');}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages'))return Response.json({value:[{id:'TEST-A1-Sent',internetMessageId:'<TEST-A1@example.invalid>',from:{emailAddress:{address:process.env.MS_GRAPH_MAILBOX}},toRecipients:[{emailAddress:{address:customer.email}}],isDraft:false,sentDateTime:new Date().toISOString(),internetMessageHeaders:[{name:'x-kreile-request-id',value:input.clientRequestId}]}]});
  return nativeFetch(request,init);
 });
 expect(await withSession(sender,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'UNAVAILABLE'});
 const {updateCustomerAction}=await import('@/app/actions/customers.actions');
 expect(await withSession(full,()=>updateCustomerAction({customerId:a.customerId,clientEventId:randomUUID(),email:'TEST-after-prepare@example.invalid'}))).toMatchObject({code:'OK'});
 const retry={...fresh(input),clientRequestId:randomUUID()};
 expect(await withSession(sender,()=>sendCustomerMailAction(retry))).toMatchObject({code:'OK',data:{replayed:true}});expect(sends).toBe(1);
 expect(await withSession(sender,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'OK',data:{replayed:true}});expect(sends).toBe(1);
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND correlation_id=${input.clientRequestId}::uuid`).toEqual([{n:1}]);
 expect(await sql`SELECT user_id::text AS actor FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND correlation_id=${input.clientRequestId}::uuid`).toEqual([{actor:sender.actorId}]);
 expect(await sql`SELECT order_id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_CUSTOMER_INFORMED_V1' AND order_id IN(${a.orderId},${b.orderId}) ORDER BY order_id`).toEqual([a.orderId,b.orderId].sort().map(order_id=>({order_id})));
},120000);

it.each([false,true])('S02 an in-flight invoice bundle stays excluded after another click (responseLost=%s)',async(responseLost)=>{
 const a=await readyInvoiceOrder('N5 Beleggruppe A'),b=await readyInvoiceOrder('N5 Beleggruppe B','pickup',false,a.customerId);
 let sends=0,unblock!:()=>void,entered!:()=>void;
 const waiting=new Promise<void>(resolve=>{unblock=resolve;}),sent=new Promise<void>(resolve=>{entered=resolve;});
 const attachments:string[][]=[];
 vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-N5-bundle-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){
   sends++;attachments.push(JSON.parse(String(init?.body)).message.attachments.map((file:{name:string})=>file.name));
   if(sends===1){entered();await waiting;if(responseLost)throw Error('TEST accepted bundle, response lost');}
   return new Response(null,{status:202});
  }
  if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages'))return Response.json({value:[]});
  return nativeFetch(request,init);
 });
 const input={targetType:'ORDER' as const,targetId:a.orderId,subject:'TEST Gruppe',body:'TEST Originale',clientRequestId:randomUUID(),attachment:{kind:'INVOICE' as const,documentId:a.invoice.invoiceId},expectedInvoiceIds:[a.invoice.invoiceId,b.invoice.invoiceId]};
 const first=withSession(full,()=>sendCustomerMailAction(fresh(input)));await sent;
 try{
  expect(await withSession(full,()=>sendCustomerMailAction({...fresh(input),targetId:b.orderId,clientRequestId:randomUUID(),attachment:{kind:'INVOICE',documentId:b.invoice.invoiceId}}))).toMatchObject({code:'CONFLICT'});
  expect(sends).toBe(1);
 }finally{unblock();}
 expect(await first).toMatchObject({code:responseLost?'UNAVAILABLE':'OK'});
 const c=await readyInvoiceOrder('N5 Beleggruppe C','pickup',false,a.customerId);
 expect(await withSession(full,()=>sendCustomerMailAction({...fresh(input),targetId:c.orderId,clientRequestId:randomUUID(),attachment:{kind:'INVOICE',documentId:c.invoice.invoiceId},expectedInvoiceIds:[c.invoice.invoiceId]}))).toMatchObject({code:'OK'});
 expect(attachments).toEqual([[a.invoice.invoiceNumber+'.pdf',b.invoice.invoiceNumber+'.pdf'],[c.invoice.invoiceNumber+'.pdf']]);
 expect(await withSession(full,()=>sendCustomerMailAction({...fresh(input),clientRequestId:randomUUID(),expectedInvoiceIds:[a.invoice.invoiceId]}))).toMatchObject({code:'CONFLICT'});expect(sends).toBe(2);
},120000);

it.each([false,true])('S02 confirmed resend requires ten minutes and reserves one actor-bound effect (aged=%s)',async(aged)=>{
 const order=await readyInvoiceOrder('N5 Bestaetigtes-Neusenden');
 const [customer]=await sql`SELECT name FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.customerId}`;
 const input={targetType:'CUSTOMER' as const,targetId:order.customerId,subject:'TEST N5 Freigabe',body:'TEST unveraenderter Originalinhalt',clientRequestId:randomUUID()};
 let sends=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-N5-resend-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;if(sends===1)throw Error('TEST unknown original effect');return new Response(null,{status:202});}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages'))return Response.json({value:[]});
  return nativeFetch(request,init);
 });
 const clock='test_resend_clock_'+randomUUID().replaceAll('-','');
 if(aged){
  // Isolated TEST age boundary at insertion; immutable receipts are never edited.
  await sql.unsafe(`CREATE FUNCTION private.${clock}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='COMMUNICATION_MAIL_PREPARED_V1' AND NEW.correlation_id='${input.clientRequestId}'::uuid THEN NEW.created_at=statement_timestamp()-interval '11 minutes'; END IF; RETURN NEW; END $$`);
  await sql.unsafe(`CREATE TRIGGER ${clock} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${clock}()`);
 }
 try{expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'UNAVAILABLE'});}
 finally{if(aged){await sql.unsafe(`DROP TRIGGER ${clock} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${clock}()`);}}
 const checked=await withSession(full,()=>sendCustomerMailAction(fresh(input)));expect(checked.code).toBe('CONFLICT');
 if(!aged){
  expect(checked).not.toHaveProperty('resend');
  expect(await withSession(full,()=>sendCustomerMailAction({...fresh(input),confirmedResend:true}))).toMatchObject({code:'CONFLICT'});expect(sends).toBe(1);return;
 }
 expect(checked).toMatchObject({resend:{requestId:input.clientRequestId,label:'Mail an '+customer.name+' erneut senden – nicht im Postausgang gefunden'}});
 const other=await createFixture(['mails'],'buero');
 expect(await withSession(other,()=>sendCustomerMailAction({...fresh(input),confirmedResend:true}))).toMatchObject({code:'CONFLICT'});expect(sends).toBe(1);
 const guard='test_resend_confirmation_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${guard}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='COMMUNICATION_MAIL_RESEND_CONFIRMED_V1' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${guard} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${guard}()`);
 try{
  expect(await withSession(full,()=>sendCustomerMailAction({...fresh(input),confirmedResend:true}))).toMatchObject({code:'UNAVAILABLE'});expect(sends).toBe(1);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_MAIL_RESEND_CONFIRMED_V1' AND correlation_id=${input.clientRequestId}::uuid`).toHaveLength(0);
 }finally{await sql.unsafe(`DROP TRIGGER ${guard} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${guard}()`);}
 const result=await Promise.all([withSession(full,()=>sendCustomerMailAction({...fresh(input),confirmedResend:true})),withSession(full,()=>sendCustomerMailAction({...fresh(input),confirmedResend:true}))]);
 expect(result.filter(row=>row.code==='OK')).toHaveLength(1);expect(sends).toBe(2);
 expect(await withSession(full,()=>sendCustomerMailAction({...fresh(input),confirmedResend:true}))).toMatchObject({code:'OK',data:{replayed:true}});expect(sends).toBe(2);
 const proof=await sql`SELECT id,user_id::text AS actor,payload->>'reason' AS reason FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_MAIL_RESEND_CONFIRMED_V1' AND correlation_id=${input.clientRequestId}::uuid`;
 expect(proof).toEqual([{id:expect.any(String),actor:full.actorId,reason:'nicht_im_postausgang_gefunden'}]);
 await expect(sql`UPDATE public.events SET payload=payload||'{"reason":"TEST changed"}'::jsonb WHERE id=${proof[0].id}`).rejects.toThrow(/append-only/);
 await expect(sql`DELETE FROM public.events WHERE id=${proof[0].id}`).rejects.toThrow(/append-only/);
},120000);

it('S02 Sent Items closes an uncertain ordinary send without another external effect',async()=>{
 const order=await readyInvoiceOrder('N5 Sent-Items-Abgleich');
 const [customer]=await sql`SELECT email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.customerId}`;
 const input={targetType:'CUSTOMER' as const,targetId:order.customerId,subject:'TEST N5 Abgleich',body:'TEST Original bleibt gleich',clientRequestId:randomUUID()};
 let sends=0,scans=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-N5-proof-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;throw Error('TEST accepted, response lost');}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages')){
   scans++;
   if(!url.searchParams.has('$skiptoken')&&!url.searchParams.get('$filter')?.startsWith('internetMessageId')){const next=new URL(url);next.searchParams.set('$skiptoken','TEST');return Response.json({value:[],'@odata.nextLink':next.href});}
   return Response.json({value:[{id:'TEST-original-sent',internetMessageId:'<TEST-N5-original@example.invalid>',from:{emailAddress:{address:process.env.MS_GRAPH_MAILBOX}},toRecipients:[{emailAddress:{address:customer.email}}],isDraft:false,sentDateTime:new Date().toISOString(),internetMessageHeaders:[{name:'x-kreile-request-id',value:input.clientRequestId}]}]});
  }
  return nativeFetch(request,init);
 });
 expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'UNAVAILABLE'});
 const failure='test_n5_sent_receipt_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${failure}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='COMMUNICATION_MAIL_SENT_V1' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${failure} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${failure}()`);
 try{
  expect(await withSession(full,()=>sendCustomerMailAction({...fresh(input),clientRequestId:randomUUID()}))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT status FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+input.clientRequestId}`).toEqual([{status:'failed'}]);
  expect(await sql`SELECT message.id FROM public.communication_messages message JOIN public.communication_threads thread ON thread.id=message.thread_id AND thread.tenant_id=message.tenant_id WHERE thread.tenant_id=${KREILE_TENANT_SLUG} AND thread.source=${'MS_GRAPH_OUT:'+input.clientRequestId}`).toHaveLength(0);
 }finally{await sql.unsafe(`DROP TRIGGER ${failure} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${failure}()`);}
 const recovered=await withSession(full,()=>sendCustomerMailAction({...fresh(input),clientRequestId:randomUUID()}));expect(recovered).toMatchObject({code:'OK',data:{replayed:true}});
 expect(sends).toBe(1);expect(scans).toBe(6);
 expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'OK',data:{replayed:true}});expect(sends).toBe(1);expect(scans).toBe(6);
 const rows=await sql`SELECT thread.status,count(message.id)::int AS n FROM public.communication_threads thread LEFT JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.thread_id=thread.id WHERE thread.tenant_id=${KREILE_TENANT_SLUG} AND thread.source=${'MS_GRAPH_OUT:'+input.clientRequestId} GROUP BY thread.status`;
 expect(rows).toEqual([{status:'sent',n:1}]);
 expect(await sql`SELECT payload->'sentItemsEvidence'->>'internetMessageId' AS original FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_MAIL_SENT_V1' AND correlation_id=${input.clientRequestId}::uuid`).toEqual([{original:'<TEST-N5-original@example.invalid>'}]);
},120000);

it('S02 H15 a fresh click key cannot resend the same unresolved external mail after reload',async()=>{
 const order=await readyInvoiceOrder('N5-Unklar-Neuladen');let sends=0,lost=true;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-N5-external-provider-token'.repeat(3),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;if(lost)throw Error('TEST external effect accepted but response lost');return new Response(null,{status:202});}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages'))return Response.json({value:[]});
  return nativeFetch(input,init);
 });
 const input={targetType:'CUSTOMER' as const,targetId:order.customerId,subject:'TEST N5 original',body:'TEST identical external intent after reload.',clientRequestId:randomUUID()};
 const guard='test_mail_prepare_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${guard}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='COMMUNICATION_MAIL_PREPARED_V1' AND NEW.correlation_id='${input.clientRequestId}'::uuid THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${guard} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${guard}()`);
 try{
  expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'UNAVAILABLE'});
  expect(sends).toBe(0);
  expect(await sql`SELECT id FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+input.clientRequestId}`).toHaveLength(0);
 }finally{await sql.unsafe(`DROP TRIGGER ${guard} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${guard}()`);}
 expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'UNAVAILABLE'});
 const stored=await sql`SELECT id::text,status FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+input.clientRequestId}`;
 expect(stored).toHaveLength(1);expect(stored[0].status).toBe('failed');
 const reservation=await sql`SELECT id,payload,user_id::text AS actor FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_MAIL_PREPARED_V1' AND correlation_id=${input.clientRequestId}::uuid`;
 expect(reservation).toHaveLength(1);expect(reservation[0].actor).toBe(full.actorId);
 expect(reservation[0].payload).toMatchObject({threadId:stored[0].id,targetId:order.customerId,intentHash:expect.stringMatching(/^[0-9a-f]{64}$/),documents:[]});
 expect(JSON.stringify(reservation[0].payload)).not.toContain(input.body);
 await expect(sql`UPDATE public.events SET payload=payload||jsonb_build_object('intentHash',repeat('a',64)) WHERE id=${reservation[0].id}`).rejects.toThrow(/append-only/);
 await expect(sql`DELETE FROM public.events WHERE id=${reservation[0].id}`).rejects.toThrow(/append-only/);
 expect(await sql`SELECT payload FROM public.events WHERE id=${reservation[0].id}`).toEqual([{payload:reservation[0].payload}]);
 expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'CONFLICT'});expect(sends).toBe(1);
 // A reload/new composer loses the in-memory request ref. It must not turn
 // uncertainty into an additional external effect with a different UUID.
 lost=false;
 const afterReload=await withSession(full,()=>sendCustomerMailAction({...fresh(input),clientRequestId:randomUUID()}));
 expect({code:afterReload.code,sends}).toEqual({code:'CONFLICT',sends:1});
 expect(await sql`SELECT id FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${order.customerId}`).toHaveLength(1);
},120000);

it('S02 PL02:01 quote resend uses the secured original despite a later quote change',async()=>{
 const order=await readyInvoiceOrder('N5 KV-Original');
 const {createQuoteAction,updateQuoteAction,readQuoteAction}=await import('@/app/actions/quotes.actions');
 const position={name:'TEST KV Original',quantity:1,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:2500,lineTotalCents:2500};
 const created=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId:order.customerId,dueDate:'2027-05-15',note:'TEST alte Fassung',positions:[position]}));if(created.code!=='OK')throw Error('N5_QUOTE_CREATE:'+created.code);
 const input={targetType:'CUSTOMER' as const,targetId:order.customerId,subject:'TEST KV Original',body:'TEST unveraendertes Versandoriginal',clientRequestId:randomUUID(),attachment:{kind:'QUOTE' as const,documentId:created.quote.quoteId}};
 const attachments:string[]=[];
 vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-KV-original-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){attachments.push(JSON.parse(String(init?.body)).message.attachments[0].contentBytes);if(attachments.length===1)throw Error('TEST original accepted, response lost');return new Response(null,{status:202});}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages'))return Response.json({value:[]});
  return nativeFetch(request,init);
 });
 const clock='test_quote_original_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${clock}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='COMMUNICATION_MAIL_PREPARED_V1' AND NEW.correlation_id='${input.clientRequestId}'::uuid THEN NEW.created_at=statement_timestamp()-interval '11 minutes'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${clock} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${clock}()`);
 try{expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'UNAVAILABLE'});}
 finally{await sql.unsafe(`DROP TRIGGER ${clock} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${clock}()`);}
 const original=await sql`SELECT payload->'document' AS document FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_DOCUMENT_PREPARED_V1' AND correlation_id=${input.clientRequestId}::uuid`;
 expect(original).toHaveLength(1);expect(original[0].document.original.path).toMatch(/^domain-attachments\/v1\//);
 const {createHash}=await import('node:crypto');const sha=createHash('sha256').update(Buffer.from(attachments[0],'base64')).digest('hex');expect(original[0].document.sha256).toBe(sha);
 expect(await withSession(full,()=>updateQuoteAction({quoteId:created.quote.quoteId,expectedVersion:created.quote.version,clientEventId:randomUUID(),dueDate:'2027-05-16',note:'TEST neue Fassung',positions:[{...position,unitPriceCents:5000,lineTotalCents:5000}]}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'CONFLICT',resend:{requestId:input.clientRequestId}});
 expect(await withSession(full,()=>sendCustomerMailAction({...fresh(input),confirmedResend:true}))).toMatchObject({code:'OK'});
 expect(attachments).toHaveLength(2);expect(attachments[1]).toBe(attachments[0]);
 expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'OK',data:{replayed:true}});expect(attachments).toHaveLength(2);
 expect(await withSession(full,()=>readQuoteAction({quoteId:created.quote.quoteId}))).toMatchObject({code:'OK',quote:{totalNetCents:5000,note:'TEST neue Fassung'}});
},120000);

it('S02 legacy quote without an original can reconcile Sent Items but never offer a resend',async()=>{
 const order=await readyInvoiceOrder('N5 KV-Original');
 const {createQuoteAction}=await import('@/app/actions/quotes.actions');
 const position={name:'TEST KV Original',quantity:1,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:2500,lineTotalCents:2500};
 const created=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId:order.customerId,dueDate:'2027-05-15',note:'TEST alte Fassung',positions:[position]}));if(created.code!=='OK')throw Error('N5_QUOTE_CREATE:'+created.code);
 const input={targetType:'CUSTOMER' as const,targetId:order.customerId,subject:'TEST KV Original',body:'TEST unveraendertes Versandoriginal',clientRequestId:randomUUID(),attachment:{kind:'QUOTE' as const,documentId:created.quote.quoteId}};
 let found=false;
 const [customer]=await sql`SELECT email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.customerId}`;
 const attachments:string[]=[];
 vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-KV-original-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){attachments.push(JSON.parse(String(init?.body)).message.attachments[0].contentBytes);if(attachments.length===1)throw Error('TEST original accepted, response lost');return new Response(null,{status:202});}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages'))return Response.json({value:found?[{id:'TEST-legacy-quote',internetMessageId:'<TEST-legacy-quote@example.invalid>',from:{emailAddress:{address:process.env.MS_GRAPH_MAILBOX}},toRecipients:[{emailAddress:{address:customer.email}}],isDraft:false,sentDateTime:new Date().toISOString(),internetMessageHeaders:[{name:'x-kreile-request-id',value:input.clientRequestId}]}]:[]});
  return nativeFetch(request,init);
 });
 const clock='test_quote_original_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${clock}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='COMMUNICATION_MAIL_PREPARED_V1' AND NEW.correlation_id='${input.clientRequestId}'::uuid THEN NEW.created_at=statement_timestamp()-interval '11 minutes'; END IF; IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='COMMUNICATION_DOCUMENT_PREPARED_V1' AND NEW.correlation_id='${input.clientRequestId}'::uuid THEN NEW.payload=jsonb_set(NEW.payload,'{document}',(NEW.payload->'document')-'original'); END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${clock} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${clock}()`);
 try{expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'UNAVAILABLE'});}
 finally{await sql.unsafe(`DROP TRIGGER ${clock} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${clock}()`);}

 const checked=await withSession(full,()=>sendCustomerMailAction(fresh(input)));expect(checked).toMatchObject({code:'CONFLICT'});expect(checked).not.toHaveProperty('resend');
 expect(await withSession(full,()=>sendCustomerMailAction({...fresh(input),confirmedResend:true}))).toMatchObject({code:'CONFLICT'});expect(attachments).toHaveLength(1);
 found=true;
 expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'OK',data:{replayed:true}});expect(attachments).toHaveLength(1);
 expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'OK',data:{replayed:true}});expect(attachments).toHaveLength(1);
},120000);

it('S02 PL02:01 Eingang-only intake confirmation uses the one prepared mail writer and never resends on reload',async()=>{
 const customerId=await customerFixture('N5 Eingang-Mail');
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) SELECT ${randomUUID()},${KREILE_TENANT_SLUG},'TEST Eingangsbestätigung' WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG})`;
 const {updateCustomerAction}=await import('@/app/actions/customers.actions');
 expect(await withSession(full,()=>updateCustomerAction({customerId,clientEventId:randomUUID(),autoInfo:true}))).toMatchObject({code:'OK'});
 const actor=await createFixture(['eingang'],'buero');
 const {resolveAuthorization}=await import('@/lib/server/authorization');
 const rights=await withSession(actor,()=>resolveAuthorization());expect(rights).toMatchObject({ok:true,data:{areas:['eingang']}});
 let sends=0,header:string|undefined;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-intake-source-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;header=JSON.parse(String(init?.body)).message.internetMessageHeaders.find((row:{name:string})=>row.name==='x-kreile-request-id')?.value;return new Response(null,{status:202});}
  return nativeFetch(request,init);
 });
 const {erfasseAuftragAusEingangAction}=await import('@/app/actions/eingang.actions');
 const input={clientKey:randomUUID(),geprueft:true,text:'TEST Eingang bestaetigen',customer:{mode:'EXISTING' as const,customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'pickup',items:[{catalogServiceId:null,name:'TEST Eingangsteil',quantity:1,material:'Messing',surfaceRequested:'Verchromen',executionRequested:'offen',unit:'Stück',unitPriceCents:null,vatRateBasisPoints:null}]};
 const first=await withSession(actor,()=>erfasseAuftragAusEingangAction(fresh(input)),true);expect(first).toMatchObject({code:'OK'});if(first.code!=='OK')throw Error('N5_INTAKE_ACTION');
 expect(sends).toBe(1);
 const outbox=await sql`SELECT id::text,status FROM public.outbox_mails WHERE tenant_id=${KREILE_TENANT_SLUG} AND objekt=${first.orderId}`;expect(outbox).toEqual([{id:header,status:'gesendet'}]);
 const prepared=await sql`SELECT user_id::text AS actor,payload->'intakeConfirmation'->>'sourceClientEventId' AS source FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_MAIL_PREPARED_V1' AND correlation_id=${header!}::uuid`;
 expect(prepared).toEqual([{actor:actor.actorId,source:input.clientKey}]);
 expect(await withSession(actor,()=>sendCustomerMailAction({targetType:'ORDER',targetId:first.orderId,clientRequestId:randomUUID(),subject:'TEST kein allgemeines Mailsrecht',body:'TEST gesperrt'}))).toMatchObject({code:'FORBIDDEN'});expect(sends).toBe(1);
 expect(await withSession(actor,()=>erfasseAuftragAusEingangAction(fresh(input)),true)).toMatchObject({code:'OK',orderId:first.orderId,replayed:true});expect(sends).toBe(1);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_MAIL_SENT_V1' AND correlation_id=${header!}::uuid`).toHaveLength(1);
},120000);

it('S02 legacy quote normal send reserves only one new PREPARE and fresh keys replay its actual mail',async()=>{
 const order=await readyInvoiceOrder('N5 KV-Original');
 const {createQuoteAction}=await import('@/app/actions/quotes.actions');
 const position={name:'TEST KV Original',quantity:1,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:2500,lineTotalCents:2500};
 const created=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId:order.customerId,dueDate:'2027-05-15',note:'TEST alte Fassung',positions:[position]}));if(created.code!=='OK')throw Error('N5_QUOTE_CREATE:'+created.code);
 const input={targetType:'CUSTOMER' as const,targetId:order.customerId,subject:'TEST KV Original',body:'TEST unveraendertes Versandoriginal',clientRequestId:randomUUID(),attachment:{kind:'QUOTE' as const,documentId:created.quote.quoteId}};
 const found=false;
 const [customer]=await sql`SELECT email FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.customerId}`;
 const attachments:string[]=[];
 vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-KV-original-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){attachments.push(JSON.parse(String(init?.body)).message.attachments[0].contentBytes);if(attachments.length===1)throw Error('TEST original accepted, response lost');return new Response(null,{status:202});}
  if(url.hostname==='graph.microsoft.com'&&url.pathname.includes('/mailFolders/sentitems/messages'))return Response.json({value:found?[{id:'TEST-legacy-quote',internetMessageId:'<TEST-legacy-quote@example.invalid>',from:{emailAddress:{address:process.env.MS_GRAPH_MAILBOX}},toRecipients:[{emailAddress:{address:customer.email}}],isDraft:false,sentDateTime:new Date().toISOString(),internetMessageHeaders:[{name:'x-kreile-request-id',value:input.clientRequestId}]}]:[]});
  return nativeFetch(request,init);
 });
 const clock='test_quote_original_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${clock}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='COMMUNICATION_MAIL_PREPARED_V1' AND NEW.correlation_id='${input.clientRequestId}'::uuid THEN NEW.created_at=statement_timestamp()-interval '11 minutes'; END IF; IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='COMMUNICATION_DOCUMENT_PREPARED_V1' AND NEW.correlation_id='${input.clientRequestId}'::uuid THEN NEW.payload=jsonb_set(NEW.payload,'{document}',(NEW.payload->'document')-'original'); END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${clock} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${clock}()`);
 try{expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'UNAVAILABLE'});}
 finally{await sql.unsafe(`DROP TRIGGER ${clock} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${clock}()`);}

 const checked=await withSession(full,()=>sendCustomerMailAction(fresh(input)));expect(checked).toMatchObject({code:'CONFLICT'});expect(checked).not.toHaveProperty('resend');
 expect(await withSession(full,()=>sendCustomerMailAction({...fresh(input),confirmedResend:true}))).toMatchObject({code:'CONFLICT'});expect(attachments).toHaveLength(1);

 if(checked.code!=='CONFLICT'||!('newPrepare'in checked)||!checked.newPrepare)throw Error('N5_LEGACY_NEW_PREPARE');
 const nextRequestId=checked.newPrepare.requestId;
 const attempts=await Promise.all([withSession(full,()=>sendCustomerMailAction({...fresh(input),clientRequestId:nextRequestId})),withSession(full,()=>sendCustomerMailAction({...fresh(input),clientRequestId:randomUUID()}))]);
 expect(attempts.some(row=>row.code==='OK')).toBe(true);expect(attachments).toHaveLength(2);
 const replacement=await sql`SELECT correlation_id::text AS request_id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='COMMUNICATION_MAIL_PREPARED_V1' AND payload->'legacyReplaces'->>'requestId'=${input.clientRequestId}`;
 expect(replacement).toHaveLength(1);expect(replacement[0].request_id).not.toBe(input.clientRequestId);
 expect(await withSession(full,()=>sendCustomerMailAction({...fresh(input),clientRequestId:randomUUID()}))).toMatchObject({code:'OK',data:{replayed:true}});
 expect(await withSession(full,()=>sendCustomerMailAction(fresh(input)))).toMatchObject({code:'OK',data:{replayed:true}});expect(attachments).toHaveLength(2);
},120000);
