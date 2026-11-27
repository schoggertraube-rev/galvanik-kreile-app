// @vitest-environment node
// Explicit TEST Graph edge; actual intake, authentication, database and storage.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,nativeFetch} from '../../../e2e/ablauf/replayHarness';
import {createAdminClient} from '@/lib/supabase/admin';
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
 const stored=await createAdminClient().storage.from('scans').download(file.speicherpfad);
 expect(stored.error).toBeNull();
 expect(new Uint8Array(await stored.data!.arrayBuffer())).toEqual(original);
 const events=await sql`SELECT nachher FROM public.intake_event WHERE tenant_id=${tenant} AND item_id=${imported.itemId}::uuid AND art='erkannt'`;
 expect(events).toEqual([{nachher:expect.objectContaining({textGekuerzt:true})}]);
});
