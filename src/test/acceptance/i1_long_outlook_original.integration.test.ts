// @vitest-environment node
// Explicit TEST Graph edge; actual intake, authentication, database and storage.
import {beforeAll,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {enableOutlookTestFixture,sql,full,withSession,nativeFetch} from '../../../e2e/ablauf/replayHarness';
import {createAdminClient} from '@/lib/supabase/admin';
import {getIntakeCaptureAction,retryIntakeRecognitionAction} from '@/app/actions/eingang.actions';
import {importOutlookMailAction} from '@/app/actions/communications.actions';

beforeAll(enableOutlookTestFixture);

it('I1-b reads the complete text from secured Outlook MIME instead of the Graph body',async()=>{
 const id='TEST-I1-long-'+randomUUID();
 const first20k='T'.repeat(19_999)+'🧾';
 const text=first20k+'\r\nTEST unverändertes Ende\r\nE-Mail: test-ende@example.invalid';
 const message={
  id,internetMessageId:'<'+id+'@example.invalid>',subject:'TEST lange Mail',
  from:{emailAddress:{address:'TEST-i1@example.invalid'}},receivedDateTime:new Date().toISOString(),
  body:{contentType:'text',content:first20k+'\r\nE-Mail: test-graph-copy@example.invalid'},hasAttachments:false,
 };
 const original=new TextEncoder().encode([
  'Message-ID: '+message.internetMessageId,'Subject: '+message.subject,'Content-Type: multipart/mixed; boundary="TEST-I1"', '',
  '--TEST-I1','Content-Type: multipart/alternative; boundary="TEST-ALT"', '',
  '--TEST-ALT','Content-Type: text/plain; charset=utf-8','Content-Transfer-Encoding: base64','',Buffer.from(text).toString('base64'),
  '--TEST-ALT','Content-Type: text/html; charset=utf-8','','<p>TEST alternatives@example.invalid</p>',
  '--TEST-ALT--',
  '--TEST-I1','Content-Type: text/plain','Content-Disposition: attachment; filename="TEST.txt"','','E-Mail: test-attached@example.invalid',
  '--TEST-I1--','',
 ].join('\r\n'));
 let providerCalls=0;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname!=='login.microsoftonline.com'&&url.hostname!=='graph.microsoft.com')return nativeFetch(input,init);
  providerCalls++;
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-I1-provider-token'.repeat(3)});
  if(url.pathname.endsWith('/$value'))return new Response(original);
  if(url.pathname.endsWith('/attachments'))return Response.json({value:[]});
  return Response.json(message);
 });

 const imported=await withSession(full,async()=>{
  const result=await importOutlookMailAction(id,{deferDispatchReply:true});
  if(result.code!=='OK')return result;
  expect(await getIntakeCaptureAction(result.itemId)).toMatchObject({code:'OK',capture:{files:[
   expect.objectContaining({mime:'message/rfc822',secured:true,status:'wartet',recognizedText:null}),
  ]}});
  expect(await sql`SELECT id FROM public.intake_event WHERE tenant_id=${tenant} AND item_id=${result.itemId}::uuid AND art='erkannt'`).toEqual([]);
  return result;
 },true);
 expect(imported.code).toBe('OK');
 if(imported.code!=='OK')throw Error('TEST_I1_IMPORT_FAILED');
 const initialProviderCalls=providerCalls;
 expect(initialProviderCalls).toBeGreaterThan(0);
 expect(await withSession(full,()=>importOutlookMailAction(id,{deferDispatchReply:true})))
  .toMatchObject({code:'OK',itemId:imported.itemId,replayed:true});
 expect(providerCalls).toBe(initialProviderCalls);

 const [file]=await sql`SELECT item.text,file.erkannter_text,file.speicherpfad
  FROM public.intake_file file JOIN public.intake_item item ON item.tenant_id=file.tenant_id AND item.id=file.item_id
  WHERE item.tenant_id=${tenant} AND item.id=${imported.itemId}::uuid AND file.mime='message/rfc822'`;
 expect(file).toMatchObject({text:first20k,erkannter_text:text});
 expect(await withSession(full,()=>getIntakeCaptureAction(imported.itemId)))
  .toMatchObject({code:'OK',capture:{text:first20k,recognition:{text}}});
 const stored=await createAdminClient().storage.from('scans').download(file.speicherpfad);
 expect(stored.error).toBeNull();
 expect(new Uint8Array(await stored.data!.arrayBuffer())).toEqual(original);
 const events=await sql`SELECT nachher FROM public.intake_event WHERE tenant_id=${tenant} AND item_id=${imported.itemId}::uuid AND art='erkannt'`;
 expect(events).toEqual([{nachher:expect.objectContaining({textGekuerzt:true,code:'OK',modelle:[]})}]);
 expect(await sql`SELECT wert FROM public.intake_suggestion WHERE tenant_id=${tenant} AND item_id=${imported.itemId}::uuid
  AND feld='mail.text' AND status='offen'`).toEqual([{wert:expect.objectContaining({fields:expect.arrayContaining([
    expect.objectContaining({field:'email',value:'test-ende@example.invalid'}),
  ])})}]);
});

it('resumes secured waiting mail originals after a lost callback and reserves manual and automatic reading once', async () => {
 await sql`INSERT INTO public.tenant_features (tenant,feature_id,enabled) VALUES (${tenant},'E04',true)`;
 const {PDFDocument}=await import('pdf-lib');
 const document=await PDFDocument.create();
 document.addPage().drawText('TEST Mail-Anhang');
 const contents=Buffer.from(await document.save());
 const id='TEST-I1-attachment-'+randomUUID(),internetMessageId='<'+id+'@example.invalid>';
 const message={id,internetMessageId,subject:'TEST Anhang',from:{emailAddress:{address:'test-i1@example.invalid'}},
  receivedDateTime:new Date().toISOString(),body:{contentType:'text',content:'TEST Ablage'},hasAttachments:true};
 const original=new TextEncoder().encode([
  'Message-ID: '+internetMessageId,'Subject: '+message.subject,'Content-Type: text/html; charset=windows-1252',
  'Content-Transfer-Encoding: quoted-printable','','<p>TEST St=FCck &amp; Ablage</p>',
 ].join('\r\n'));
 const attachment={id:'TEST-Anhang',name:'TEST-Dokument.pdf',contentType:'application/pdf',size:contents.length,
  contentBytes:contents.toString('base64'),isInline:false};
 const model='prebuilt-layout',host='https://i1-mail-ocr.example.invalid';
 const operation=host+'/documentintelligence/documentModels/'+model+'/analyzeResults/TEST-I1';
 let recognized=0,graphDownloads=0;
 vi.stubEnv('AZURE_DOCINTEL_ENDPOINT',host);
 vi.stubEnv('AZURE_DOCINTEL_KEY','TEST-I1-OCR');
 const upstream=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-I1-provider-token'.repeat(3)});
  if(url.hostname==='graph.microsoft.com'){
   if(url.pathname.endsWith('/$value')){graphDownloads++;return new Response(original);}
   if(url.pathname.endsWith('/attachments'))return Response.json({value:[attachment]});
   return Response.json(message);
  }
  if(url.origin!==host)return nativeFetch(input,init);
  if(init?.method==='POST'){
   recognized++;
   expect(JSON.parse(String(init.body)).base64Source).toBe(contents.toString('base64'));
   return new Response(null,{status:202,headers:{'operation-location':operation}});
  }
  return Response.json({status:'succeeded',analyzeResult:{modelId:model,content:'TEST gelesen',pages:[{pageNumber:1}]}});
 });
 try {
  const importMail=()=>importOutlookMailAction(id,{deferDispatchReply:true});
  const itemId=await withSession(full,async()=>{
   const result=await importMail();
   if(result.code!=='OK')throw Error('TEST_I1_ATTACHMENT_IMPORT:'+result.code);
   expect(await getIntakeCaptureAction(result.itemId)).toMatchObject({code:'OK',capture:{files:expect.arrayContaining([
    expect.objectContaining({name:attachment.name,secured:true,status:'wartet'}),
   ])}});
   expect(recognized).toBe(0);
   return result.itemId;
  });
  const [mailFile]=await sql`SELECT id::text FROM public.intake_file WHERE tenant_id=${tenant} AND item_id=${itemId}::uuid AND mime='message/rfc822'`;
  const retry={fileId:mailFile.id,clientEventId:randomUUID()};
  await withSession(full,async()=>{
   const reads=await Promise.all([retryIntakeRecognitionAction(retry),retryIntakeRecognitionAction(retry)]);
   for(const read of reads)expect(read.code).toBe('OK');
   expect(await retryIntakeRecognitionAction({...retry})).toMatchObject({code:'OK',capture:{files:expect.arrayContaining([
    expect.objectContaining({id:retry.fileId,status:'fertig',recognizedText:'TEST Stück & Ablage\n'}),
   ])}});
   const imports=await Promise.all([importMail(),importMail()]);
   for(const imported of imports)expect(imported).toMatchObject({code:'OK',itemId,replayed:true});
   expect(recognized).toBe(0);
  },true);
  expect(await withSession(full,()=>getIntakeCaptureAction(itemId))).toMatchObject({code:'OK',capture:{files:expect.arrayContaining([
   expect.objectContaining({name:attachment.name,secured:true,status:'fertig',recognizedText:'TEST gelesen'}),
  ])}});
  expect(recognized).toBe(1);
  expect(graphDownloads).toBe(1);
  expect(await sql`SELECT count(*)::int AS readings FROM public.intake_event WHERE tenant_id=${tenant} AND item_id=${itemId}::uuid AND art='erkannt' GROUP BY nachher->>'fileId'`)
   .toEqual([{readings:1},{readings:1}]);
 } finally {
  upstream.mockRestore();
  vi.unstubAllEnvs();
 }
});
