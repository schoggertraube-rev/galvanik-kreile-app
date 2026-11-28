// @vitest-environment node
// Explicit TEST Graph edge; actual intake, authentication, database and storage.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,nativeFetch} from '../../../e2e/ablauf/replayHarness';
import {createAdminClient} from '@/lib/supabase/admin';
import {getIntakeCaptureAction} from '@/app/actions/eingang.actions';
import {importOutlookMailAction} from '@/app/actions/communications.actions';

it('I1-a preserves the complete text and bytes of a long Outlook original on retry',async()=>{
 const id='TEST-I1-long-'+randomUUID();
 const first20k='T'.repeat(19_999)+'🧾';
 const text=first20k+'\r\nTEST unverändertes Ende';
 const message={
  id,internetMessageId:'<'+id+'@example.invalid>',subject:'TEST lange Mail',
  from:{emailAddress:{address:'TEST-i1@example.invalid'}},receivedDateTime:new Date().toISOString(),
  body:{contentType:'text',content:text},hasAttachments:false,
 };
 const original=new TextEncoder().encode('Message-ID: '+message.internetMessageId+'\r\nSubject: '+message.subject+'\r\n\r\n'+text);
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

 const imported=await withSession(full,()=>importOutlookMailAction(id,{deferDispatchReply:true}));
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
 expect(events).toEqual([{nachher:expect.objectContaining({textGekuerzt:true})}]);
});

it('secures a mail attachment before recognition and reads it only once on delivery retry', async () => {
 const {PDFDocument}=await import('pdf-lib');
 const document=await PDFDocument.create();
 document.addPage().drawText('TEST Mail-Anhang');
 const contents=Buffer.from(await document.save());
 const id='TEST-I1-attachment-'+randomUUID(),internetMessageId='<'+id+'@example.invalid>';
 const message={id,internetMessageId,subject:'TEST Anhang',from:{emailAddress:{address:'test-i1@example.invalid'}},
  receivedDateTime:new Date().toISOString(),body:{contentType:'text',content:'TEST Ablage'},hasAttachments:true};
 const original=new TextEncoder().encode('Message-ID: '+internetMessageId+'\r\nSubject: '+message.subject+'\r\n\r\nTEST Ablage');
 const attachment={id:'TEST-Anhang',name:'TEST-Dokument.pdf',contentType:'application/pdf',size:contents.length,
  contentBytes:contents.toString('base64'),isInline:false};
 const model='prebuilt-layout',host='https://i1-mail-ocr.example.invalid';
 const operation=host+'/documentintelligence/documentModels/'+model+'/analyzeResults/TEST-I1';
 let recognized=0;
 vi.stubEnv('AZURE_DOCINTEL_ENDPOINT',host);
 vi.stubEnv('AZURE_DOCINTEL_KEY','TEST-I1-OCR');
 const upstream=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-I1-provider-token'.repeat(3)});
  if(url.hostname==='graph.microsoft.com'){
   if(url.pathname.endsWith('/$value'))return new Response(original);
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
   expect(await importMail()).toMatchObject({code:'OK',itemId:result.itemId,replayed:true});
   expect(recognized).toBe(0);
   return result.itemId;
  },true);
  expect(await withSession(full,()=>getIntakeCaptureAction(itemId))).toMatchObject({code:'OK',capture:{files:expect.arrayContaining([
   expect.objectContaining({name:attachment.name,secured:true,status:'fertig',recognizedText:'TEST gelesen'}),
  ])}});
  expect(recognized).toBe(1);
 } finally {
  upstream.mockRestore();
  vi.unstubAllEnvs();
 }
});
