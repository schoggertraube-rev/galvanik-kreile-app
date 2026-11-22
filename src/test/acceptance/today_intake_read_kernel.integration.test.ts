// @vitest-environment node
// Isolated TEST tenant; actual import/assignment/Storage/Auth/DB. Only Graph's
// external HTTP boundary is doubled. No invented projector actor or role.
import {randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture,nativeFetch} from '../../../e2e/ablauf/replayHarness';
import {customerFixture} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization,authorizationReadContext,type AuthorizedReadContext} from '@/lib/server/authorization';
import {ACCESS_AREAS} from '@/lib/auth/authorizationContract';
import {readIntakeMessagesForAuthorization} from '@/modules/eingang/server-public';
import {importOutlookMailAction} from '@/app/actions/communications.actions';
import {getIntakeMessagesAction,getIntakeAssignmentAction,assignIntakeCustomerAction,selectIntakeConcernAction,saveIntakeNoteAction,createIntakeContinuationAction,getIntakeCaptureAction} from '@/app/actions/eingang.actions';
let photoItemId:string,mimeOnlyItemId:string,customerId:string;
const since=new Date(Date.now()-60_000).toISOString();
beforeAll(async()=>{
 customerId=await customerFixture('TEST shared intake read kernel');
 const photo=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jlpEAAAAASUVORK5CYII=','base64');
 let graphId='',hasPhoto=false;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-provider-token'.repeat(3)});
  if(url.hostname==='graph.microsoft.com'){
   if(url.pathname.endsWith('/$value'))return new Response('Message-ID: <'+graphId+'@example.invalid>\r\nFrom: test-'+graphId+'@example.invalid\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=TEST\r\n\r\n--TEST\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nTEST Reklamation\r\n'+(hasPhoto?'--TEST\r\nContent-Type: image/png\r\nContent-Transfer-Encoding: base64\r\n\r\n'+photo.toString('base64')+'\r\n':'')+'--TEST--\r\n');
   if(url.pathname.endsWith('/attachments'))return Response.json({value:hasPhoto?[{id:'TEST-image',name:'TEST-Mangel.png',contentType:'image/png',size:photo.length,contentBytes:photo.toString('base64'),isInline:false}]:[]});
   return Response.json({id:graphId,internetMessageId:'<'+graphId+'@example.invalid>',subject:'TEST Reklamation',from:{emailAddress:{name:'TEST Kunde',address:'test-'+graphId+'@example.invalid'}},receivedDateTime:'2026-11-11T12:00:00Z',bodyPreview:'TEST Reklamation',body:{contentType:'text',content:'TEST Reklamation'},hasAttachments:hasPhoto});
  }
  return nativeFetch(input,init);
 });
 try{
  const open=async(image:boolean)=>{
   graphId='TEST-reader-'+randomUUID();hasPhoto=image;
   const imported=await withSession(full,()=>importOutlookMailAction(graphId));if(imported.code!=='OK')throw Error('TEST_KERNEL_MAIL_IMPORT:'+imported.code);
   expect(await withSession(full,()=>importOutlookMailAction(graphId))).toMatchObject({code:'OK',itemId:imported.itemId});
   const view=await withSession(full,()=>getIntakeAssignmentAction({itemId:imported.itemId,mode:'normal'}));if(view.code!=='OK')throw Error('TEST_KERNEL_ASSIGN_VIEW');
   const input={itemId:imported.itemId,version:view.view.version,clientEventId:randomUUID(),customerId,mode:'manual' as const};
   expect(await withSession(full,()=>assignIntakeCustomerAction(input))).toMatchObject({code:'OK'});
   expect(await withSession(full,()=>assignIntakeCustomerAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
   const list=await withSession(full,()=>getIntakeMessagesAction('alle'));if(list.code!=='OK')throw Error('TEST_KERNEL_MESSAGE_SOURCE');
   const row=list.messages.find(row=>row.id===imported.itemId);if(!row)throw Error('TEST_KERNEL_MAIL_MISSING');
   expect(await withSession(full,()=>selectIntakeConcernAction({itemId:row.id,version:row.version,clientEventId:randomUUID(),concern:'reklamation'}))).toMatchObject({code:'OK'});
   return imported.itemId;
  };
  photoItemId=await open(true);mimeOnlyItemId=await open(false);
 }finally{vi.restoreAllMocks();}
});
it('retains actual continuation ownership for a non-mail login and denies an unrelated real login',async()=>{
 const owner=await createFixture(['eingang'],'werkstatt'),other=await createFixture(['eingang'],'werkstatt');
 const parentId=randomUUID(),childId=randomUUID(),draftId=randomUUID(),text='TEST own original without mail rights';
 const parent=await withSession(owner,()=>saveIntakeNoteAction({itemId:parentId,textstand:randomUUID(),text,concerns:[]}));expect(parent).toMatchObject({code:'OK'});if(parent.code!=='OK')throw Error('TEST_CONTINUATION_PARENT');
 const input={parentId,parentVersion:parent.capture.version,textSourceId:parentId,childId,draftId,clientEventId:randomUUID(),fileId:null,payload:{clientKey:childId,text,documents:[childId],items:[{key:randomUUID(),name:'TEST original part',quantity:'1'}]}};
 expect(await withSession(other,()=>createIntakeContinuationAction(input))).toMatchObject({code:'FORBIDDEN'});
 expect(await sql`SELECT id FROM public.intake_item WHERE tenant_id=${tenant} AND id=${childId}::uuid`).toHaveLength(0);
 expect(await withSession(owner,()=>createIntakeContinuationAction(input))).toMatchObject({code:'OK',childId,draftId,replayed:false});
 expect(await withSession(owner,()=>createIntakeContinuationAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',childId,draftId,replayed:true});
 expect(await withSession(owner,()=>getIntakeCaptureAction(childId))).toMatchObject({code:'OK',capture:{id:childId,text,continuation:{sourceId:parentId},actorTrace:{createdBy:{userId:owner.actorId}}}});
 expect(await withSession(other,()=>getIntakeCaptureAction(childId))).toMatchObject({code:'FORBIDDEN'});
 expect(await sql`SELECT fortsetzung_von::text,text FROM public.intake_item WHERE tenant_id=${tenant} AND id=${childId}::uuid`).toEqual([{fortsetzung_von:parentId,text:null}]);
 const auth=await withSession(owner,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_CONTINUATION_AUTH');
 expect(await readIntakeMessagesForAuthorization(authorizationReadContext(auth.data),'alle',childId)).toMatchObject({code:'FORBIDDEN'});
});
const profiles:Array<{name:string;rights:string[]|null;role:'meister'|'werkstatt'}>=[
 {name:'full real session',rights:null,role:'meister'},
 {name:'mail only',rights:['mails'],role:'meister'},
 {name:'mail and orders',rights:['mails','auftraege'],role:'meister'},
 {name:'orders without mail',rights:['auftraege'],role:'werkstatt'},
 {name:'prices without mail',rights:['preise'],role:'meister'}
];
for(const profile of profiles)it('keeps shared original-message facts and live personal metadata separate: '+profile.name,async()=>{
 const fixture=profile.rights===null?full:await createFixture(profile.rights,profile.role);
 const auth=await withSession(fixture,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_KERNEL_MAIL_AUTH');
 const areas=auth.data.areas;if(!Array.isArray(areas))throw Error('TEST_KERNEL_MAIL_AREAS');
 const session=authorizationReadContext(auth.data),projection:AuthorizedReadContext={tenantId:auth.data.tenantId,permissions:auth.data.permissions,canReadArea:area=>areas.includes(area)};
 const before=await sql`SELECT id::text,nachher FROM public.intake_event WHERE tenant_id=${tenant} ORDER BY id`;
 for(const [filter,itemId,changedSince] of [['alle',undefined,undefined],['alle',photoItemId,undefined],['aussortiert',undefined,undefined],['alle',undefined,since]] as const){
  const actual=await readIntakeMessagesForAuthorization(projection,filter,itemId,changedSince);
  expect(await readIntakeMessagesForAuthorization(session,filter,itemId,changedSince)).toEqual(actual);
  const legacy=await readIntakeMessagesForAuthorization(auth.data,filter,itemId,changedSince);
  if(actual.code!=='OK'){expect(actual).toEqual(legacy);expect(actual.code).toBe('FORBIDDEN');continue;}
  if(legacy.code!=='OK')throw Error('TEST_KERNEL_FULL_MESSAGE_RESULT');
  expect(legacy.currentLogin).toBe(fixture.actorId);expect(legacy.areas).toEqual(ACCESS_AREAS.filter(area=>areas.includes(area)));
  expect(actual).not.toHaveProperty('currentLogin');expect(actual).not.toHaveProperty('areas');
  expect(actual.messages).toEqual(legacy.messages.map(row=>{const value={...row};delete value.nextActionRule;return value;}));
  if(filter==='aussortiert'){expect(actual.messages).toEqual([]);expect(actual.captures).toEqual([]);}
  else{
   // The independent ownership case also creates a real parent/continuation.
   // All rows still match the full legacy result above; count these two
   // imported originals explicitly instead of hiding the additional notes.
   expect(actual.messages.filter(row=>row.id===photoItemId||row.id===mimeOnlyItemId)).toHaveLength(itemId?1:2);
   const photo=actual.captures.find(row=>row.itemId===photoItemId);expect(photo).toMatchObject({value:{code:'OK',capture:{id:photoItemId,customerId,files:expect.arrayContaining([expect.objectContaining({secured:true,mime:'image/png'})]),actorTrace:{createdBy:{userId:full.actorId}}}}});
   if(!itemId)expect(actual.captures.find(row=>row.itemId===mimeOnlyItemId)).toMatchObject({value:{code:'OK',capture:{files:[expect.objectContaining({mime:'message/rfc822',secured:true})]}}});
  }
 }
 const publicRead=await withSession(fixture,()=>getIntakeMessagesAction('alle'));
 if(publicRead.code==='OK'){const {serverReadAt,cacheLoginScope,...value}=publicRead;expect(Number.isFinite(Date.parse(serverReadAt))).toBe(true);expect(cacheLoginScope).toMatch(/^[a-f0-9]{64}$/);expect(value).toEqual(await readIntakeMessagesForAuthorization(auth.data,'alle'));}
 else expect(publicRead).toEqual(await readIntakeMessagesForAuthorization(projection,'alle'));
 expect(await readIntakeMessagesForAuthorization(projection,'invalid')).toEqual(await readIntakeMessagesForAuthorization(auth.data,'invalid'));
 expect(await sql`SELECT id::text,nachher FROM public.intake_event WHERE tenant_id=${tenant} ORDER BY id`).toEqual(before);
});
