import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from './replayHarness';
import {customerFixture} from './orderFixture';
import {requestMailStep} from './requestMailStep';

it('a missing recipient writes no dispatch and saving the real customer permits the same pending request',async()=>{
 await requestMailStep('MAIL-recipient');
 const customerId=await customerFixture('MAIL-recipient');
 const {updateCustomerAction,getCustomerSummaryAction}=await import('@/app/actions/customers.actions');
 expect(await withSession(full,()=>updateCustomerAction({customerId,clientEventId:randomUUID(),email:null}))).toMatchObject({code:'OK'});
 const {sendCustomerMailAction}=await import('@/app/actions/communications.actions');
 const request={targetType:'CUSTOMER' as const,targetId:customerId,clientRequestId:randomUUID(),subject:'TEST fehlende Adresse',body:'TEST unveränderte Nachricht nach Kundenkorrektur'};
 expect(await withSession(full,()=>sendCustomerMailAction(request))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT count(*)::integer AS n FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+request.clientRequestId}`).toEqual([{n:0}]);
 const email='TEST-repaired-'+randomUUID()+'@example.invalid';
 expect(await withSession(full,()=>updateCustomerAction({customerId,clientEventId:randomUUID(),email}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{email}});
 const sent=await withSession(full,()=>sendCustomerMailAction(structuredClone(request)));
 expect(sent).toMatchObject({code:'OK'});if(sent.code!=='OK')throw Error('MAIL_RECIPIENT_RETRY:'+sent.code);
 expect(await sql`SELECT body FROM public.communication_messages WHERE tenant_id=${KREILE_TENANT_SLUG} AND thread_id=${sent.data.threadId}::uuid AND direction='outgoing'`).toEqual([{body:request.body}]);
 const sends=vi.mocked(globalThis.fetch).mock.calls.filter(([url,init])=>String(url).includes('graph.microsoft.com')&&init?.method==='POST');
 expect(sends).toHaveLength(1);
 expect(JSON.parse(String(sends[0][1]?.body)).message.toRecipients).toEqual([{emailAddress:{address:email.toLowerCase()}}]);
 expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(request))))).toMatchObject({code:'OK',data:{threadId:sent.data.threadId,replayed:true}});
 expect(await sql`SELECT user_id::text,event_type FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND correlation_id=${request.clientRequestId}::uuid`).toEqual([{user_id:full.actorId,event_type:'COMMUNICATION_MAIL_SENT_V1'}]);
});

it('a non-UUID mail request key cannot send before its audit rejects the identifier',async()=>{
 await requestMailStep('MAIL-invalid-key');
 const customerId=await customerFixture('MAIL-invalid-key');
 const {sendCustomerMailAction}=await import('@/app/actions/communications.actions');
 const request={targetType:'CUSTOMER' as const,targetId:customerId,clientRequestId:'-'.repeat(36),subject:'TEST ungültige Anfragekennung',body:'TEST darf nicht gesendet werden'};
 expect(await withSession(full,()=>sendCustomerMailAction(request))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT count(*)::integer AS n FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+request.clientRequestId}`).toEqual([{n:0}]);
 expect(vi.mocked(globalThis.fetch).mock.calls.filter(([url,init])=>String(url).includes('graph.microsoft.com')&&init?.method==='POST')).toHaveLength(0);
});

it('malformed actual mail submissions return a recoverable rejection without reserving or sending',async()=>{
 await requestMailStep('MAIL-invalid');
 const customerId=await customerFixture('MAIL-invalid');
 const {sendCustomerMailAction}=await import('@/app/actions/communications.actions');
 type Input=Parameters<typeof sendCustomerMailAction>[0];
 const before=await sql`SELECT count(*)::integer AS n FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND source LIKE 'MS_GRAPH_OUT:%'`;
 for(const input of [null,{targetType:'CUSTOMER',targetId:customerId,clientRequestId:randomUUID(),subject:123,body:'TEST fehlerhafte Eingabe'},{targetType:'CUSTOMER',targetId:customerId,clientRequestId:randomUUID(),subject:'TEST fehlender Inhalt',body:null}]){
  expect(await withSession(full,()=>sendCustomerMailAction(input as unknown as Input))).toMatchObject({code:'VALIDATION_ERROR'});
 }
 expect(await sql`SELECT count(*)::integer AS n FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND source LIKE 'MS_GRAPH_OUT:%'`).toEqual(before);
 expect(vi.mocked(globalThis.fetch).mock.calls.filter(([url,init])=>String(url).includes('graph.microsoft.com')&&init?.method==='POST')).toHaveLength(0);
});

it('concurrent actual mail requests dispatch once and a fresh retry reads the same message and audit',async()=>{
 await requestMailStep('MAIL-concurrent');
 const customerId=await customerFixture('MAIL-concurrent');
 const {sendCustomerMailAction}=await import('@/app/actions/communications.actions');
 const request={targetType:'CUSTOMER' as const,targetId:customerId,clientRequestId:randomUUID(),subject:'TEST concurrent '+randomUUID(),body:'TEST einmalige Nachricht'};
 const results=await Promise.all([withSession(full,()=>sendCustomerMailAction(structuredClone(request))),withSession(full,()=>sendCustomerMailAction(structuredClone(request)))]);
 expect(results.some(result=>result.code==='OK')).toBe(true);
 expect(results.every(result=>result.code==='OK'||result.code==='CONFLICT')).toBe(true);
 const threads=await sql`SELECT id::text,status,created_by FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+request.clientRequestId}`;
 expect(threads).toHaveLength(1);
 expect(threads[0]).toMatchObject({status:'sent',created_by:full.actorId});
 const messages=await sql`SELECT id::text,body,created_by FROM public.communication_messages WHERE tenant_id=${KREILE_TENANT_SLUG} AND thread_id=${threads[0].id}::uuid AND direction='outgoing'`;
 expect(messages).toHaveLength(1);
 expect(messages[0]).toMatchObject({body:request.body,created_by:full.actorId});
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 expect(await withSession(full,()=>searchTenantAction(request.subject))).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'MAIL',id:threads[0].id})])});
 expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(request))))).toMatchObject({code:'OK',data:{threadId:threads[0].id,messageId:messages[0].id,replayed:true}});
 expect(await sql`SELECT user_id::text,event_type FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND correlation_id=${request.clientRequestId}::uuid`).toEqual([{user_id:full.actorId,event_type:'COMMUNICATION_MAIL_SENT_V1'}]);
 expect(vi.mocked(globalThis.fetch).mock.calls.filter(([url,init])=>String(url).includes('graph.microsoft.com')&&init?.method==='POST')).toHaveLength(1);
});

it('W16 actual mail send preserves the open concern and rejects changed contents on the same request key',async()=>{
 const itemId=await requestMailStep('W16');
 const customerId=await customerFixture('W16');
 const {getIntakeCaptureAction,assignIntakeCustomerAction,finishIntakeUseAction}=await import('@/app/actions/eingang.actions');
 const initial=await withSession(full,()=>getIntakeCaptureAction(itemId));if(initial.code!=='OK')throw Error('W16_INITIAL');
 expect(await withSession(full,()=>assignIntakeCustomerAction({itemId,version:initial.capture.version,customerId,clientEventId:randomUUID(),mode:'manual'}))).toMatchObject({code:'OK'});
 const before=await sql`SELECT version,einsatz,anliegen_offen FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`;
 const {sendCustomerMailAction}=await import('@/app/actions/communications.actions');
 const needle='TEST-W16-'+randomUUID();
 const request={targetType:'CUSTOMER' as const,targetId:customerId,clientRequestId:randomUUID(),subject:needle,body:needle+' Bitte sende die fehlenden Angaben.'};
 const sent=await withSession(full,()=>sendCustomerMailAction(request));
 expect(sent,JSON.stringify(sent)).toMatchObject({code:'OK'});if(sent.code!=='OK')throw Error('W16_SEND:'+sent.code);
 expect(await sql`SELECT status,created_by FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${sent.data.threadId}::uuid`).toEqual([{status:'sent',created_by:full.actorId}]);
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 expect(await withSession(full,()=>searchTenantAction(needle))).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'MAIL',id:sent.data.threadId})])});
 expect(await withSession(full,()=>sendCustomerMailAction(structuredClone(request)))).toMatchObject({code:'OK',data:{replayed:true,threadId:sent.data.threadId}});
 expect(await withSession(full,()=>sendCustomerMailAction({...structuredClone(request),body:needle+' Geänderter Inhalt'}))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT body,created_by FROM public.communication_messages WHERE tenant_id=${KREILE_TENANT_SLUG} AND thread_id=${sent.data.threadId}::uuid AND direction='outgoing'`).toEqual([{body:request.body,created_by:full.actorId}]);
 expect(await sql`SELECT version,einsatz,anliegen_offen FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`).toEqual(before);
 expect(await withSession(full,()=>getIntakeCaptureAction(itemId))).toMatchObject({code:'OK',capture:{usage:'offen',openConcerns:['kv_anfrage']}});
 const doneKey=randomUUID();
 expect(await withSession(full,()=>finishIntakeUseAction({items:[{itemId,version:before[0].version}],clientEventId:doneKey,kind:'erledigt',note:'TEST Antwort ersetzt den KV nicht'}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT count(*)::integer AS n FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND befehl_id=${doneKey}::uuid`).toEqual([{n:0}]);
 expect(await sql`SELECT user_id::text,event_type FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND correlation_id=${request.clientRequestId}::uuid`).toEqual([{user_id:full.actorId,event_type:'COMMUNICATION_MAIL_SENT_V1'}]);
 const denied=await createFixture(['kunden']);
 expect(await withSession(denied,()=>sendCustomerMailAction({...request,clientRequestId:randomUUID()}))).toMatchObject({code:'FORBIDDEN'});
 const sends=vi.mocked(globalThis.fetch).mock.calls.filter(([url,init])=>String(url).includes('graph.microsoft.com')&&init?.method==='POST');
 expect(sends).toHaveLength(1);
});

it('mail provider failure retains a visible failed dispatch and prevents a second send on an unclear request',async()=>{
 await requestMailStep('MAIL-failure');
 const customerId=await customerFixture('MAIL-failure');
 const provider=vi.mocked(globalThis.fetch).getMockImplementation();if(!provider)throw Error('MAIL_FAILURE_PROVIDER_REQUIRED');
 let attempts=0;
 vi.mocked(globalThis.fetch).mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='graph.microsoft.com'&&init?.method==='POST'){attempts++;return Response.json({error:{code:'TEST_PROVIDER_UNAVAILABLE'}},{status:503});}
  return provider(input,init);
 });
 const {sendCustomerMailAction}=await import('@/app/actions/communications.actions');
 const needle='TEST-FAILED-'+randomUUID();
 const request={targetType:'CUSTOMER' as const,targetId:customerId,clientRequestId:randomUUID(),subject:needle,body:needle+' Erneut nur nach geklärtem Versand.'};
 expect(await withSession(full,()=>sendCustomerMailAction(request))).toMatchObject({code:'UNAVAILABLE'});
 const [dispatch]=await sql`SELECT id::text,status,created_by FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+request.clientRequestId}`;
 expect(dispatch).toMatchObject({status:'failed',created_by:full.actorId});
 expect(await sql`SELECT count(*)::integer AS n FROM public.communication_messages WHERE tenant_id=${KREILE_TENANT_SLUG} AND thread_id=${dispatch.id}::uuid AND direction='outgoing'`).toEqual([{n:0}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND correlation_id=${request.clientRequestId}::uuid`).toEqual([{n:0}]);
 const {searchTenantAction}=await import('@/app/actions/search.actions');
 expect(await withSession(full,()=>searchTenantAction(needle))).toMatchObject({code:'OK',hits:expect.arrayContaining([expect.objectContaining({type:'MAIL',id:dispatch.id,status:'failed'})])});
 expect(await withSession(full,()=>sendCustomerMailAction(structuredClone(request)))).toMatchObject({code:'CONFLICT'});
 expect(attempts).toBe(1);
 expect(await sql`SELECT count(*)::integer AS n FROM public.communication_threads WHERE tenant_id=${KREILE_TENANT_SLUG} AND source=${'MS_GRAPH_OUT:'+request.clientRequestId}`).toEqual([{n:1}]);
});
