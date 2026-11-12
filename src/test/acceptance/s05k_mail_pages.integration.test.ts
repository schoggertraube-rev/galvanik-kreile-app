// @vitest-environment node
// Explicit TEST Graph pages only; actual intake/Auth/DB/Storage and original receipts.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,nativeFetch,createFixture} from '../../../e2e/ablauf/replayHarness';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readIntakeMailboxWatermark} from '@/modules/eingang/server-public';
import {getOpenIntakeMailsAction,getIntakeTaskAction} from '@/app/actions/eingang.actions';

it('S05K A1 imports 45 originals across three Graph pages and rereads without duplicates',async()=>{
 const run=randomUUID(),text='TEST Bitte senden Sie einen Kostenvoranschlag für vier Trompeten.';
 const messages=Array.from({length:45},(_,index)=>({id:'TEST-A1-'+run+'-'+index,internetMessageId:'<TEST-A1-'+run+'-'+index+'@example.invalid>',subject:'TEST A1 Anfrage '+index,from:{emailAddress:{name:'TEST A1 Kunde',address:'TEST-A1-'+run+'@example.invalid'}},receivedDateTime:new Date(Date.parse('2026-11-12T12:00:00Z')+index*1000).toISOString(),bodyPreview:text,body:{contentType:'text',content:text},hasAttachments:false}));
 const listRequests:URL[]=[];
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) VALUES(${randomUUID()},${tenant},'TEST A1 Firma')`;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-A1-provider-token'.repeat(3)});
  if(url.hostname!=='graph.microsoft.com')return nativeFetch(input,init);
  if(url.pathname.includes('/mailFolders/inbox/messages')){
   listRequests.push(url);
   const page=Number(url.searchParams.get('$skiptoken')?.replace('TEST_PAGE_','')??0);
   return Response.json({value:messages.slice(page*15,(page+1)*15),'@odata.count':45,...(page<2?{'@odata.nextLink':'https://graph.microsoft.com/v1.0/users/TEST-mailbox%40example.invalid/mailFolders/inbox/messages?$skiptoken=TEST_PAGE_'+(page+1)+'&$top=50'}:{})});
  }
  const part=url.pathname.split('/messages/')[1],id=decodeURIComponent(part?.split('/')[0]??'');
  const message=messages.find(row=>row.id===id);
  if(!message)throw Error('TEST_A1_UNEXPECTED_GRAPH_REQUEST');
  if(url.pathname.endsWith('/$value'))return new Response('From: '+message.from.emailAddress.address+'\r\nMessage-ID: '+message.internetMessageId+'\r\nSubject: '+message.subject+'\r\n\r\n'+text);
  if(url.pathname.endsWith('/attachments'))return Response.json({value:[]});
  return Response.json(message);
 });
 const first=await withSession(full,()=>getOpenIntakeMailsAction());
 expect(first).toMatchObject({code:'OK'});
 const rows=await sql`SELECT id,graph_message_id FROM public.intake_item WHERE tenant_id=${tenant} AND kanal='mail'`;
 expect(rows).toHaveLength(45);
 expect(new Set(rows.map(row=>row.graph_message_id)).size).toBe(45);
 const watermark=()=>withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_A1_AUTH');return readIntakeMailboxWatermark(auth.data,'test-mailbox@example.invalid');});
 expect(await watermark()).toEqual({code:'OK',watermark:messages[44].receivedDateTime});
 expect(await withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_A1_AUTH');return readIntakeMailboxWatermark(auth.data,'other@example.invalid');})).toEqual({code:'OK',watermark:null});
 expect(listRequests).toHaveLength(3);
 expect(listRequests[0].searchParams.get('$orderby')).toBe('receivedDateTime asc');
 const [originals]=await sql`SELECT count(*)::integer AS n FROM public.intake_file file JOIN public.intake_item source ON source.tenant_id=file.tenant_id AND source.id=file.item_id WHERE file.tenant_id=${tenant} AND file.mime='message/rfc822' AND EXISTS(SELECT 1 FROM public.intake_event event WHERE event.tenant_id=source.tenant_id AND event.item_id=source.id AND event.art='einsatz' AND event.nachher->>'action'='mail_import_complete')`;
 expect(originals.n).toBe(45);
 expect(await withSession(full,()=>getOpenIntakeMailsAction())).toMatchObject({code:'OK'});
 const [after]=await sql`SELECT count(*)::integer AS n FROM public.intake_item WHERE tenant_id=${tenant} AND kanal='mail'`;
 expect(after.n).toBe(45);
 const [observed]=await sql`SELECT count(*)::integer AS n FROM public.intake_event WHERE tenant_id=${tenant} AND art='einsatz' AND nachher->>'action'='mailbox_observed'`;expect(observed.n).toBe(45);
 expect(await watermark()).toEqual({code:'OK',watermark:messages[44].receivedDateTime});
});


it('S05K A1 persists the real continuation, resumes it, and expires a25h cursor without touching another mailbox',async()=>{
 const run=randomUUID(),text='TEST Bitte senden Sie einen Kostenvoranschlag.';
 const messages=Array.from({length:3},(_,i)=>({id:'TEST-A1-cursor-'+run+'-'+i,internetMessageId:'<TEST-A1-cursor-'+run+'-'+i+'@example.invalid>',subject:'TEST A1 Folge '+i,from:{emailAddress:{address:'TEST-'+run+'@example.invalid'}},receivedDateTime:new Date(Date.parse('2026-11-12T12:10:00Z')+i*1000).toISOString(),body:{contentType:'text',content:text},hasAttachments:false}));
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) SELECT ${randomUUID()},${tenant},'TEST A1 Firma' WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${tenant})`;
 const mailbox='test-mailbox@example.invalid',other={url:'https://graph.microsoft.com/v1.0/users/other%40example.invalid/mailFolders/inbox/messages',at:new Date().toISOString(),remaining:1};
 // Explicit TEST progress fixtures; no mail or original is fabricated in the database.
 await sql`UPDATE public.company_settings SET mailbox_fetch_state=${sql.json({'other@example.invalid':other})}::jsonb WHERE tenant_id=${tenant}`;
 let expiredProbe=false;
 const urls:URL[]=[];
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-A1-cursor-token'.repeat(3)});
  if(url.hostname!=='graph.microsoft.com')return nativeFetch(input,init);
  if(url.pathname.includes('/mailFolders/inbox/messages')){
   urls.push(url);
   if(expiredProbe){if(url.searchParams.has('page'))throw Error('TEST_EXPIRED_CURSOR_USED');return Response.json({value:[],'@odata.count':0});}
   const page=Number(url.searchParams.get('page')??0);
   if(page<500)return Response.json({value:[],'@odata.count':3,'@odata.nextLink':'https://graph.microsoft.com/v1.0/users/TEST-mailbox%40example.invalid/mailFolders/inbox/messages?page='+(page+1)});
   return Response.json({value:messages,'@odata.count':3});
  }
  const id=decodeURIComponent(url.pathname.split('/messages/')[1]?.split('/')[0]??''),message=messages.find(row=>row.id===id);
  if(!message)throw Error('TEST_A1_CURSOR_GRAPH_REQUEST');
  if(url.pathname.endsWith('/$value'))return new Response('Message-ID: '+message.internetMessageId+'\r\nSubject: '+message.subject+'\r\n\r\n'+text);
  if(url.pathname.endsWith('/attachments'))return Response.json({value:[]});
  return Response.json(message);
 });
 const pending=await withSession(full,()=>getOpenIntakeMailsAction());
 expect(pending).toMatchObject({code:'OK',notice:'Mailabruf: noch 3 Mails offen, der nächste Abruf holt sie'});
 const [saved]=await sql`SELECT mailbox_fetch_state AS state FROM public.company_settings WHERE tenant_id=${tenant}`;
 expect(saved.state[mailbox]).toMatchObject({url:expect.stringContaining('page=500'),remaining:3});expect(saved.state['other@example.invalid']).toEqual(other);
 const requestsBefore=urls.length;
 expect(await withSession(full,()=>getOpenIntakeMailsAction())).toMatchObject({code:'OK'});
 expect(urls[requestsBefore].href).toBe(saved.state[mailbox].url);
 const [captured]=await sql`SELECT count(*)::integer AS n FROM public.intake_item WHERE tenant_id=${tenant} AND graph_message_id LIKE ${'TEST-A1-cursor-'+run+'-%'}`;
 expect(captured.n).toBe(3);
 const [cleared]=await sql`SELECT mailbox_fetch_state AS state FROM public.company_settings WHERE tenant_id=${tenant}`;
 expect(cleared.state[mailbox]).toBeNull();expect(cleared.state['other@example.invalid']).toEqual(other);
 const stale={url:'https://graph.microsoft.com/v1.0/users/TEST-mailbox%40example.invalid/mailFolders/inbox/messages?page=EXPIRED',at:new Date(Date.now()-25*3600000).toISOString(),remaining:3};
 await sql`UPDATE public.company_settings SET mailbox_fetch_state=jsonb_set(mailbox_fetch_state,ARRAY[${mailbox}],${sql.json(stale)}::jsonb) WHERE tenant_id=${tenant}`;
 expiredProbe=true;const beforeExpiry=urls.length;
 expect(await withSession(full,()=>getOpenIntakeMailsAction())).toMatchObject({code:'OK'});
 expect(urls[beforeExpiry].searchParams.get('$filter')).toBe('receivedDateTime ge 2026-11-12T12:05:02.000Z');
 const [after]=await sql`SELECT mailbox_fetch_state AS state FROM public.company_settings WHERE tenant_id=${tenant}`;
 expect(after.state[mailbox]).toBeNull();expect(after.state['other@example.invalid']).toEqual(other);
});


it('S05K A1 keeps a secured original and creates one normal retry task when progress SQL fails',async()=>{
 const run=randomUUID(),fault='test_a1_cursor_'+run.replaceAll('-',''),history=fault+'_history',id='TEST-A1-fault-'+run;
 const message={id,internetMessageId:'<'+id+'@example.invalid>',subject:'TEST A1 SQL failure',from:{emailAddress:{address:'TEST-'+run+'@example.invalid'}},receivedDateTime:'2026-11-12T12:20:00.000Z',body:{contentType:'text',content:'TEST Bitte senden Sie einen Kostenvoranschlag.'},hasAttachments:false};
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) SELECT ${randomUUID()},${tenant},'TEST A1 Firma' WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${tenant})`;
 await sql`UPDATE public.company_settings SET mailbox_fetch_state=NULL WHERE tenant_id=${tenant}`;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-A1-fault-token'.repeat(3)});
  if(url.hostname!=='graph.microsoft.com')return nativeFetch(input,init);
  if(url.pathname.includes('/mailFolders/inbox/messages'))return Response.json({value:[message],'@odata.count':1});
  if(url.pathname.endsWith('/$value'))return new Response('Message-ID: '+message.internetMessageId+'\r\nSubject: '+message.subject+'\r\n\r\n'+message.body.content);
  if(url.pathname.endsWith('/attachments'))return Response.json({value:[]});
  return Response.json(message);
 });
 // Native SQL fault is limited to this isolated TEST tenant and completion only.
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' AND NEW.mailbox_fetch_state->'test-mailbox@example.invalid'='null'::jsonb THEN RAISE EXCEPTION 'TEST_REAL_MAILBOX_PROGRESS_FAILURE'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{
  const [before]=await sql`SELECT count(*)::integer AS n FROM public.tasks WHERE tenant_id=${tenant}`;
  await sql.unsafe(`CREATE FUNCTION private.${history}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' AND NEW.nachher->>'action'='aufgabe.angelegt' THEN RAISE EXCEPTION 'TEST_REAL_MAILBOX_TASK_RECEIPT_FAILURE'; END IF; RETURN NEW; END $$`);
  await sql.unsafe(`CREATE TRIGGER ${history} BEFORE INSERT ON public.intake_event FOR EACH ROW EXECUTE FUNCTION private.${history}()`);
  expect(await withSession(full,()=>getOpenIntakeMailsAction())).toMatchObject({code:'OK',notice:expect.any(String)});
  const [rolled]=await sql`SELECT count(*)::integer AS n FROM public.tasks WHERE tenant_id=${tenant}`;expect(rolled.n).toBe(before.n);
  const [rolledMarker]=await sql`SELECT mailbox_fetch_state AS state FROM public.company_settings WHERE tenant_id=${tenant}`;
  expect(rolledMarker.state['test-mailbox@example.invalid'].retryRequired).toBe(false);
  await sql.unsafe(`DROP TRIGGER ${history} ON public.intake_event`);
  expect(await withSession(full,()=>getOpenIntakeMailsAction())).toMatchObject({code:'OK',notice:expect.any(String)});
  const [captured]=await sql`SELECT count(*)::integer AS n FROM public.intake_item source WHERE source.tenant_id=${tenant} AND source.graph_message_id=${id} AND EXISTS(SELECT 1 FROM public.intake_event receipt WHERE receipt.tenant_id=source.tenant_id AND receipt.item_id=source.id AND receipt.nachher->>'action'='mail_import_complete')`;
  expect(captured.n).toBe(1);
  const [pending]=await sql`SELECT mailbox_fetch_state AS state FROM public.company_settings WHERE tenant_id=${tenant}`;
  expect(pending.state['test-mailbox@example.invalid'].url).toEqual(expect.any(String));
  const [tasks]=await sql`SELECT count(*)::integer AS n FROM public.tasks WHERE tenant_id=${tenant}`;
  expect(tasks.n-before.n).toBe(1);
  expect(pending.state['test-mailbox@example.invalid'].retryRequired).toBe(true);
  const [storedTask]=await sql`SELECT id::text AS id FROM public.tasks WHERE tenant_id=${tenant} AND client_key=${pending.state['test-mailbox@example.invalid'].retryKey}::uuid`;
  const taskRead=await withSession(full,()=>getIntakeTaskAction(JSON.parse(JSON.stringify({taskId:storedTask.id}))));
  expect(taskRead).toMatchObject({code:'OK',canComplete:true,task:{id:storedTask.id,erstellt_von:full.actorId,titel:'Mailabruf fortsetzen – Fortschritt konnte nicht gesichert werden'}});
  const other=await createFixture(['eingang','mails']);
  expect(await withSession(other,()=>getOpenIntakeMailsAction())).toMatchObject({code:'OK',notice:expect.any(String)});
  const [retried]=await sql`SELECT count(*)::integer AS n FROM public.tasks WHERE tenant_id=${tenant}`;expect(retried.n).toBe(tasks.n);
  await sql.unsafe(`DROP TRIGGER ${fault} ON public.company_settings`);
  expect(await withSession(other,()=>getOpenIntakeMailsAction())).toMatchObject({code:'OK'});
  const [repaired]=await sql`SELECT mailbox_fetch_state AS state FROM public.company_settings WHERE tenant_id=${tenant}`;expect(repaired.state['test-mailbox@example.invalid']).toBeNull();
  const [originals]=await sql`SELECT count(*)::integer AS n FROM public.intake_item WHERE tenant_id=${tenant} AND graph_message_id=${id}`;expect(originals.n).toBe(1);
 }finally{
  await sql.unsafe(`DROP TRIGGER IF EXISTS ${history} ON public.intake_event`);
  await sql.unsafe(`DROP FUNCTION IF EXISTS private.${history}()`);
  await sql.unsafe(`DROP TRIGGER IF EXISTS ${fault} ON public.company_settings`);
  await sql.unsafe(`DROP FUNCTION IF EXISTS private.${fault}()`);
 }
});
