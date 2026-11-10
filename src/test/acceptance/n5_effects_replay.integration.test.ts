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
