// @vitest-environment node
// Explicit TEST Graph failure only; intake originals/Auth/DB/Storage are real.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,nativeFetch,createFixture} from '../../../e2e/ablauf/replayHarness';
import {listOutlookInboxAction} from '@/app/actions/communications.actions';
import {customerFixture} from '../../../e2e/ablauf/orderFixture';
import {getOpenIntakeMailsAction,getIntakeMessagesAction,getIntakeCaptureAction,getIntakeTaskAction,assignIntakeCustomerAction,saveIntakeTaskAction} from '@/app/actions/eingang.actions';

it('S05K A2 parks one failed Graph mail while securing the other two originals',async()=>{
 const run=randomUUID(),text='TEST Bitte senden Sie einen Kostenvoranschlag.';
 const messages=Array.from({length:3},(_,i)=>({id:'TEST-A2-'+run+'-'+i,internetMessageId:'<TEST-A2-'+run+'-'+i+'@example.invalid>',subject:'TEST A2 Anfrage '+i,from:{emailAddress:{name:'TEST Kunde',address:'TEST-'+run+'@example.invalid'}},receivedDateTime:new Date(Date.parse('2026-11-12T14:00:00Z')+i*1000).toISOString(),body:{contentType:'text',content:text},hasAttachments:false}));
 messages[0].receivedDateTime='2026-01-01T14:00:00.000Z';
 let broken=true;
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) VALUES(${randomUUID()},${tenant},'TEST A2 Firma')`;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-A2-provider-token'.repeat(3)});
  if(url.hostname!=='graph.microsoft.com')return nativeFetch(input,init);
  if(url.pathname.includes('/mailFolders/inbox/messages')){const filter=url.searchParams.get('$filter'),lower=filter?.replace('receivedDateTime ge ','');const visible=lower?messages.filter(row=>Date.parse(row.receivedDateTime)>=Date.parse(lower)):messages;return Response.json({value:visible,'@odata.count':visible.length});}
  const id=decodeURIComponent(url.pathname.split('/messages/')[1]?.split('/')[0]??''),message=messages.find(row=>row.id===id);
  if(!message)throw Error('TEST_A2_GRAPH_REQUEST');
  if(broken&&id===messages[0].id)return Response.json({error:{code:'TEST_MAIL_UNAVAILABLE'}},{status:503});
  if(url.pathname.endsWith('/$value'))return new Response('Message-ID: '+message.internetMessageId+'\r\nSubject: '+message.subject+'\r\n\r\n'+text);
  if(url.pathname.endsWith('/attachments'))return Response.json({value:[]});
  return Response.json(message);
 });
 const initial=await withSession(full,()=>getOpenIntakeMailsAction());expect(initial).toMatchObject({code:'OK'});
 if(initial.code!=='OK')throw Error('TEST_A2_LIST');
 const failedRow=initial.mails.find(row=>row.importFailure?.graphMessageId===messages[0].id);
 expect(failedRow?.fileCount).toBeNull();
 expect(failedRow?.importFailure).toMatchObject({state:'FAILED',label:'Import fehlgeschlagen',graphMessageId:messages[0].id,attempts:1,taskId:null});
 const messageRead=await withSession(full,()=>getIntakeMessagesAction('alle'));expect(messageRead.code).toBe('OK');
 if(messageRead.code!=='OK')throw Error('TEST_A2_MESSAGE_READ');expect(messageRead.messages.find(row=>row.id===failedRow?.id)?.importFailure).toMatchObject({state:'FAILED',attempts:1});
 const blocked=await withSession(full,()=>getIntakeCaptureAction(failedRow!.id));expect(blocked).toMatchObject({code:'UNAVAILABLE',message:expect.stringContaining(messages[0].id)});
 const noMail=await createFixture(['eingang']),beforeCalls=vi.mocked(globalThis.fetch).mock.calls.length;
 expect(await withSession(noMail,()=>getOpenIntakeMailsAction())).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(noMail,()=>getIntakeCaptureAction(failedRow!.id))).toMatchObject({code:'FORBIDDEN'});
 expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(beforeCalls);
 const [secured]=await sql`SELECT count(*)::integer AS n FROM public.intake_item source WHERE source.tenant_id=${tenant} AND EXISTS(SELECT 1 FROM public.intake_event receipt WHERE receipt.tenant_id=source.tenant_id AND receipt.item_id=source.id AND receipt.nachher->>'action'='mail_import_complete')`;
 expect(secured.n).toBe(2);
 const parked=await sql`SELECT graph_message_id,kennzeichen FROM public.intake_item WHERE tenant_id=${tenant} AND graph_message_id=${messages[0].id}`;
 expect(parked).toHaveLength(1);expect(parked[0].kennzeichen).toContain('Import fehlgeschlagen');
 // The failed source is older than watermark minus5min. Retry must therefore
 // read its persisted Graph identity, not rely on the next inbox listing.
 const countTasks=async()=>{const [row]=await sql`SELECT count(*)::integer AS n FROM public.tasks WHERE tenant_id=${tenant} AND fuer_bereich='eingang'`;return row.n;};
 expect(await countTasks()).toBe(0);
 expect(await withSession(full,()=>getOpenIntakeMailsAction())).toMatchObject({code:'OK'});
 expect(await countTasks()).toBe(0);
 expect(await withSession(full,()=>getOpenIntakeMailsAction())).toMatchObject({code:'OK'});
 expect(await countTasks()).toBe(1);
 expect(await withSession(full,()=>getOpenIntakeMailsAction())).toMatchObject({code:'OK'});
 expect(await countTasks()).toBe(1);
 const chosenCustomer=await customerFixture('S05K A2 chosen customer');
 const [beforeRecovery]=await sql`SELECT version FROM public.intake_item WHERE tenant_id=${tenant} AND id=${failedRow!.id}::uuid`;
 expect(await withSession(full,()=>assignIntakeCustomerAction({itemId:failedRow!.id,version:beforeRecovery.version,customerId:chosenCustomer,clientEventId:randomUUID(),mode:'manual'}))).toMatchObject({code:'OK'});
 broken=false;
 expect(await withSession(full,()=>getOpenIntakeMailsAction())).toMatchObject({code:'OK'});
 const [recovered]=await sql`SELECT count(*)::integer AS n FROM public.intake_item source WHERE source.tenant_id=${tenant} AND EXISTS(SELECT 1 FROM public.intake_event receipt WHERE receipt.tenant_id=source.tenant_id AND receipt.item_id=source.id AND receipt.nachher->>'action'='mail_import_complete')`;
 expect(recovered.n).toBe(3);
 const [source]=await sql`SELECT kennzeichen,kunde_id,vorgang_id,version FROM public.intake_item WHERE tenant_id=${tenant} AND graph_message_id=${messages[0].id}`;
 expect(source.kennzeichen).not.toContain('Import fehlgeschlagen');expect(source.kunde_id).toBe(chosenCustomer);expect(source.vorgang_id).toBeNull();expect(source.version).toBeGreaterThan(beforeRecovery.version+1);
 expect(await countTasks()).toBe(1);
});


it('S05K A2 keeps the third real failure when the normal task receipt fails, then creates one task on another-login retry',async()=>{
 const run=randomUUID(),id='TEST-A2-task-'+run,fault='test_a2_task_'+run.replaceAll('-','');
 const message={id,internetMessageId:'<'+id+'@example.invalid>',subject:'TEST A2 Task',from:{emailAddress:{address:'TEST-'+run+'@example.invalid'}},receivedDateTime:'2026-11-13T12:00:00.000Z',body:{contentType:'text',content:'TEST Anfrage'},hasAttachments:false};
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) SELECT ${randomUUID()},${tenant},'TEST A2 Firma' WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${tenant})`;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-A2-task-token'.repeat(3)});
  if(url.hostname!=='graph.microsoft.com')return nativeFetch(input,init);
  if(url.pathname.includes('/mailFolders/inbox/messages'))return Response.json({value:[{id:message.id}],'@odata.count':1});
  return Response.json({error:{code:'TEST_MAIL_STILL_UNAVAILABLE'}},{status:503});
 });
 await withSession(full,()=>getOpenIntakeMailsAction());await withSession(full,()=>getOpenIntakeMailsAction());
 const [source]=await sql`SELECT id::text AS id,version FROM public.intake_item WHERE tenant_id=${tenant} AND graph_message_id=${id}`;
 // Explicit TEST supplier master; association itself uses the real assignment writer.
 const supplierId=await customerFixture('S05K A2 supplier');await sql`UPDATE public.customers SET type='lieferant',payment_preference=NULL,vat_id=NULL,billing_email=NULL,handover_preference=NULL WHERE tenant_id=${tenant} AND id=${supplierId}`;
 expect(await withSession(full,()=>assignIntakeCustomerAction({itemId:source.id,version:source.version,customerId:supplierId,clientEventId:randomUUID(),mode:'manual'}))).toMatchObject({code:'OK'});
 const linked=await withSession(full,()=>listOutlookInboxAction({targetType:'CUSTOMER',targetId:supplierId}));expect(linked.code).toBe('OK');if(linked.code!=='OK')throw Error('TEST_A2_LINKED');expect(linked.data.find(row=>row.id===id)).toMatchObject({receivedAt:null,hasAttachments:null,importFailure:{state:'FAILED',attempts:2,graphMessageId:id}});
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' AND NEW.nachher->>'action'='mail_import_failure_task' THEN RAISE EXCEPTION 'TEST_REAL_A2_TASK_RECEIPT_FAILURE'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.intake_event FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{
  const third=await withSession(full,()=>getOpenIntakeMailsAction());expect(third.code).toBe('OK');
  if(third.code!=='OK')throw Error('TEST_A2_THIRD');expect(third.mails.find(row=>row.id===source.id)?.importFailure).toMatchObject({attempts:3,taskId:null,state:'FAILED'});
  const [attempts]=await sql`SELECT count(*)::integer AS n FROM public.intake_event WHERE tenant_id=${tenant} AND item_id=${source.id}::uuid AND nachher->>'action'='mail_import_failed'`;expect(attempts.n).toBe(3);
  const tasks=()=>sql`SELECT id::text AS id,erstellt_von::text AS actor,fuer_bereich AS area FROM public.tasks WHERE tenant_id=${tenant} AND bezug_typ='eingang' AND bezug_id=${source.id}`;
  expect(await tasks()).toHaveLength(0);
  const [files]=await sql`SELECT count(*)::integer AS n FROM public.intake_file WHERE tenant_id=${tenant} AND item_id=${source.id}::uuid`;expect(files.n).toBe(0);
  await sql.unsafe(`DROP TRIGGER ${fault} ON public.intake_event`);
  const other=await createFixture(['eingang','mails']);
  const retry=await withSession(other,()=>getOpenIntakeMailsAction());expect(retry.code).toBe('OK');
  const saved=await tasks();expect(saved).toHaveLength(1);expect(saved[0]).toMatchObject({actor:other.actorId,area:'eingang'});
  expect(await withSession(other,()=>getIntakeTaskAction({taskId:saved[0].id}))).toMatchObject({code:'OK',canComplete:true,canOpenReference:false,reference:{customerId:null}});
  expect(await withSession(other,()=>saveIntakeTaskAction({clientKey:randomUUID(),version:0,kind:'aufgabe',title:'TEST arbitrary supplier task',dueDate:'2027-01-01',time:null,forLogin:null,forArea:'eingang',reference:{type:'eingang',id:source.id},note:'TEST'}))).toMatchObject({code:'FORBIDDEN'});
  if(retry.code!=='OK')throw Error('TEST_A2_RETRY');expect(retry.mails.find(row=>row.id===source.id)?.importFailure).toMatchObject({attempts:4,taskId:saved[0].id});
  await withSession(full,()=>getOpenIntakeMailsAction());expect(await tasks()).toEqual(saved);
 }finally{await sql.unsafe(`DROP TRIGGER IF EXISTS ${fault} ON public.intake_event`);await sql.unsafe(`DROP FUNCTION IF EXISTS private.${fault}()`);}
});
