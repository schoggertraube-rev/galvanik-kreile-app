// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture} from '../../../e2e/ablauf/orderFixture';
import {saveIntakeNoteAction,getIntakeMessagesAction} from '@/app/actions/eingang.actions';

it('reads the stored send state and actor for U2 without inferring an unclear dispatch from message text',async()=>{
 const customerId=await customerFixture('V45 Nachrichten'),itemId=randomUUID();
 expect(await withSession(full,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST normale Nachricht, kein Status aus Text',concerns:[],context:{customerId}}))).toMatchObject({code:'OK'});
 // Explicitly synthetic projection fixture, not a physical-mail/write proof.
 // Dispatch/reconciliation itself is covered by the existing N5 real round trips.
 await sql`UPDATE public.intake_item SET kanal='mail',richtung='raus',sendestatus='unklar',einsatz='offen' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`;
 const read=await withSession(full,()=>getIntakeMessagesAction('alle'));if(read.code!=='OK')throw Error('TEST_MESSAGE_READ');
 expect(read.messages.find(row=>row.id===itemId)).toMatchObject({fallbackPriority:{code:'OK',rank:1,source:{kind:'intake',id:itemId}},sendState:'unklar',direction:'raus',createdBy:full.actorId,text:'TEST normale Nachricht, kein Status aus Text'});
 expect(await withSession(full,()=>getIntakeMessagesAction('alle'))).toEqual(read);
 await sql`UPDATE public.intake_item SET sendestatus='gesendet' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`;
 const after=await withSession(full,()=>getIntakeMessagesAction('alle'));if(after.code!=='OK')throw Error('TEST_MESSAGE_REREAD');
 expect(after.messages.find(row=>row.id===itemId)).toMatchObject({fallbackPriority:{code:'SOURCE_INCOMPLETE',missing:['QUESTION_REPLY_HISTORY']},nextActionRule:{code:'OK',hauptaktion:null,datenluecken:['QUESTION_REPLY_HISTORY']},sendState:'gesendet',createdBy:full.actorId});
 const restricted=await createFixture(['eingang'],'werkstatt');expect(await withSession(restricted,()=>getIntakeMessagesAction('alle'))).toMatchObject({code:'FORBIDDEN'});
});

it('reuses the actual assignment writer gate for U2 instead of assuming mails grants entry assignment',async()=>{
 const {canAssignIntakeCustomer}=await import('@/modules/eingang/server-public');
 const {resolveAuthorization}=await import('@/lib/server/authorization');
 const {assignIntakeCustomerAction,getIntakeAssignmentAction}=await import('@/app/actions/eingang.actions');
 const customerId=await customerFixture('TEST U2 Assignment'),itemId=randomUUID();
 const saved=await withSession(full,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST Quelle ohne Kundenbezug'}));if(saved.code!=='OK')throw Error('TEST_ASSIGNMENT_SOURCE');
 const noEntry=await createFixture(['mails','kunden']),noEntryAuth=await withSession(noEntry,()=>resolveAuthorization());if(!noEntryAuth.ok)throw Error('TEST_NO_ENTRY_AUTH');
 expect(canAssignIntakeCustomer(noEntryAuth.data)).toBe(false);
 const input={itemId,version:saved.capture.version,clientEventId:randomUUID(),customerId,mode:'manual' as const};
 expect(await withSession(noEntry,()=>assignIntakeCustomerAction(input))).toMatchObject({code:'FORBIDDEN'});
 const permitted=await createFixture(['eingang','kunden']),allowed=await withSession(permitted,()=>resolveAuthorization());if(!allowed.ok)throw Error('TEST_ENTRY_AUTH');
 expect(canAssignIntakeCustomer(allowed.data)).toBe(true);
 expect(await withSession(permitted,()=>assignIntakeCustomerAction(input))).toMatchObject({code:'OK',replayed:false});
 expect(await withSession(permitted,()=>assignIntakeCustomerAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(permitted,()=>getIntakeAssignmentAction({itemId,mode:'normal'}))).toMatchObject({code:'OK',view:{customer:{id:customerId}}});
 expect(await sql`SELECT von::text FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND befehl_id=${input.clientEventId}::uuid`).toEqual([{von:permitted.actorId}]);
});

it('R13 imports a real original and reads the assignment main action with the actual writer gate',async()=>{
 const {installMailProvider}=await import('../../../e2e/ablauf/mailProvider');
 const {importOutlookMailAction}=await import('@/app/actions/communications.actions');
 const {getIntakeAssignmentAction,assignIntakeCustomerAction}=await import('@/app/actions/eingang.actions');
 const graphId='TEST-U2-R13-'+randomUUID(),sender='TEST-'+randomUUID()+'@example.invalid';
 installMailProvider(graphId,'TEST allgemeine Nachricht ohne Fachanliegen',sender,'TEST U2 R13 Original');
 try{
  const imported=await withSession(full,()=>importOutlookMailAction(graphId));if(imported.code!=='OK')throw Error('TEST_U2_IMPORT:'+imported.code);
  const read=await withSession(full,()=>getIntakeMessagesAction('alle'));if(read.code!=='OK')throw Error('TEST_U2_MESSAGES');
  const message=read.messages.find(row=>row.id===imported.itemId);expect(message).toBeDefined();
  expect(message).toMatchObject({fallbackPriority:{code:'OK',rank:6},nextActionRule:{code:'OK',zustand:'orange',farbe:'warn',prioritaet:6,hauptaktion:{elementId:'message.assign',textKey:'messages.assign',befehl:{funktion:'getIntakeAssignmentAction',argumente:{itemId:imported.itemId,mode:'normal'}}}}});
  const rule=message?.nextActionRule;if(rule?.code!=='OK'||!rule.hauptaktion)throw Error('TEST_U2_ASSIGN_PRIMARY');
  expect(rule.erstblick.length).toBeLessThanOrEqual(5);
  const noEntry=await createFixture(['mails','kunden']);
  const denied=await withSession(noEntry,()=>getIntakeMessagesAction('alle'));if(denied.code!=='OK')throw Error('TEST_U2_RESTRICTED');
  expect(denied.messages.find(row=>row.id===imported.itemId)).toMatchObject({nextActionRule:{code:'OK',hauptaktion:null,gesperrt:[{elementId:'message.assign',grundKey:'error.permission'}]}});
  const opened=await withSession(full,()=>getIntakeAssignmentAction(rule.hauptaktion!.befehl.argumente));if(opened.code!=='OK')throw Error('TEST_U2_OPEN_ASSIGNMENT');
  const customerId=await customerFixture('TEST R13 Zuordnung'),input={itemId:imported.itemId,version:opened.view.version,clientEventId:randomUUID(),customerId,mode:'manual' as const};
  expect(await withSession(full,()=>assignIntakeCustomerAction(input))).toMatchObject({code:'OK'});
  expect(await withSession(full,()=>assignIntakeCustomerAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
  const after=await withSession(full,()=>getIntakeMessagesAction('alle'));if(after.code!=='OK')throw Error('TEST_U2_REREAD');
  expect(after.messages.find(row=>row.id===imported.itemId)).toMatchObject({customerId,nextActionRule:{code:'OK',hauptaktion:null,prioritaet:8}});
  expect(await sql`SELECT id FROM public.intake_file WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${imported.itemId}::uuid AND mime='message/rfc822'`).toHaveLength(1);
 }finally{vi.restoreAllMocks();}
});

it('binds a real quote reply to the existing original target reader with 0/1/many customer choices and no price grant',async()=>{
 const {selectIntakeConcernAction}=await import('@/app/actions/eingang.actions');
 const {createQuoteAction,readQuoteReplyTargetsAction}=await import('@/app/actions/quotes.actions');
 const customerId=await customerFixture('TEST U2 KV Antwort'),foreignCustomerId=await customerFixture('TEST fremder KV'),itemId=randomUUID();
 const saved=await withSession(full,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST Bitte bearbeiten: Original zur KV-Antwort',context:{customerId}}));if(saved.code!=='OK')throw Error('TEST_REPLY_SOURCE');
 expect(await withSession(full,()=>selectIntakeConcernAction({itemId,version:saved.capture.version,clientEventId:randomUUID(),concern:'kv_annahme'}))).toMatchObject({code:'OK'});
 const actor=await createFixture(['mails'],'werkstatt');
 const read=await withSession(actor,()=>getIntakeMessagesAction('alle'));if(read.code!=='OK')throw Error('TEST_REPLY_U2');
 const rule=read.messages.find(row=>row.id===itemId)?.nextActionRule;
 expect(rule).toMatchObject({code:'OK',prioritaet:2,hauptaktion:{elementId:'concern.act',textKey:'concern.act',befehl:{funktion:'readQuoteReplyTargetsAction',argumente:{sourceItemId:itemId}}}});
 if(rule?.code!=='OK'||!rule.hauptaktion)throw Error('TEST_REPLY_COMMAND');
 const command=JSON.parse(JSON.stringify(rule.hauptaktion.befehl.argumente));
 const before=await sql`SELECT count(*)::int AS n FROM public.intake_event WHERE tenant_id=${tenant} AND item_id=${itemId}::uuid`;
 expect(await withSession(actor,()=>readQuoteReplyTargetsAction(command))).toMatchObject({code:'OK',targets:[]});
 const make=async(customer:string)=>{const result=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId:customer,dueDate:'2027-06-01',note:'TEST U2 Reply',positions:[{name:'TEST U2 Halter',quantity:1,material:null,surfaceRequested:'verchromen',unitPriceCents:654321}]}));if(result.code!=='OK')throw Error('TEST_REPLY_QUOTE');return result.quote.quoteId;};
 const one=await make(customerId);expect(await withSession(actor,()=>readQuoteReplyTargetsAction(command))).toMatchObject({code:'OK',targets:[{id:one}]});
 const two=await make(customerId),foreign=await make(foreignCustomerId);
 const choices=await withSession(actor,()=>readQuoteReplyTargetsAction(command));if(choices.code!=='OK')throw Error('TEST_REPLY_CHOICES');
 expect(choices.targets.map(row=>row.id).sort()).toEqual([one,two].sort());expect(choices.targets.some(row=>row.id===foreign)).toBe(false);
 expect(JSON.stringify(choices)).not.toMatch(/654321|unitPriceCents|totalNetCents|calculation/);
 expect(await withSession(actor,()=>readQuoteReplyTargetsAction(JSON.parse(JSON.stringify(command))))).toEqual(choices);
 expect(await sql`SELECT count(*)::int AS n FROM public.intake_event WHERE tenant_id=${tenant} AND item_id=${itemId}::uuid`).toEqual(before);
});

it('uses secured original image evidence for complaint routing and never treats the MIME original as a photo',async()=>{
 const {nativeFetch}=await import('../../../e2e/ablauf/replayHarness');
 const {importOutlookMailAction}=await import('@/app/actions/communications.actions');
 const {assignIntakeCustomerAction,getIntakeAssignmentAction,selectIntakeConcernAction}=await import('@/app/actions/eingang.actions');
 const {getComplaintOrderChoicesAction}=await import('@/app/actions/complaints.actions');
 const customerId=await customerFixture('TEST U2 Foto Reklamation'),photo=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jlpEAAAAASUVORK5CYII=','base64');
 let graphId='TEST-U2-photo-'+randomUUID(),hasPhoto=true;
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-provider-token'.repeat(3)});
  if(url.hostname==='graph.microsoft.com'){
   if(url.pathname.endsWith('/$value'))return new Response('Message-ID: <'+graphId+'@example.invalid>\r\nFrom: test-'+graphId+'@example.invalid\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=TEST\r\n\r\n--TEST\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nTEST Bitte anrufen. Reklamation\r\n'+(hasPhoto?'--TEST\r\nContent-Type: image/png\r\nContent-Transfer-Encoding: base64\r\n\r\n'+photo.toString('base64')+'\r\n':'')+'--TEST--\r\n');
   if(url.pathname.endsWith('/attachments'))return Response.json({value:hasPhoto?[{id:'TEST-image',name:'TEST-Mangel.png',contentType:'image/png',size:photo.length,contentBytes:photo.toString('base64'),isInline:false}]:[]});
   return Response.json({id:graphId,internetMessageId:'<'+graphId+'@example.invalid>',subject:'TEST Reklamation',from:{emailAddress:{name:'TEST Kunde',address:'test-'+graphId+'@example.invalid'}},receivedDateTime:'2026-11-11T12:00:00Z',bodyPreview:'TEST Bitte anrufen. Reklamation',body:{contentType:'text',content:'TEST Bitte anrufen. Reklamation'},hasAttachments:hasPhoto});
  }
  return nativeFetch(input,init);
 });
 try{
  const open=async()=>{const imported=await withSession(full,()=>importOutlookMailAction(graphId));if(imported.code!=='OK')throw Error('TEST_PHOTO_IMPORT:'+imported.code);
   const view=await withSession(full,()=>getIntakeAssignmentAction({itemId:imported.itemId,mode:'normal'}));if(view.code!=='OK')throw Error('TEST_PHOTO_ASSIGN_VIEW');
   const assigned=await withSession(full,()=>assignIntakeCustomerAction({itemId:imported.itemId,version:view.view.version,clientEventId:randomUUID(),customerId,mode:'manual'}));if(assigned.code!=='OK')throw Error('TEST_PHOTO_ASSIGN');
   const current=await withSession(full,()=>getIntakeMessagesAction('alle'));if(current.code!=='OK')throw Error('TEST_PHOTO_VERSION');const row=current.messages.find(row=>row.id===imported.itemId);if(!row)throw Error('TEST_PHOTO_ROW');
   expect(await withSession(full,()=>selectIntakeConcernAction({itemId:row.id,version:row.version,clientEventId:randomUUID(),concern:'reklamation'}))).toMatchObject({code:'OK'});return row.id;};
  const itemId=await open();
  const read=await withSession(full,()=>getIntakeMessagesAction('alle'));if(read.code!=='OK')throw Error('TEST_PHOTO_U2');const rule=read.messages.find(row=>row.id===itemId)?.nextActionRule;
  expect(rule).toMatchObject({code:'OK',prioritaet:3,hauptaktion:{elementId:'complaint.message',befehl:{funktion:'getComplaintOrderChoicesAction',argumente:{customerId}}}});
  if(rule?.code!=='OK'||!rule.hauptaktion)throw Error('TEST_PHOTO_COMMAND');
  const args=JSON.parse(JSON.stringify(rule.hauptaktion.befehl.argumente));expect(await withSession(full,()=>getComplaintOrderChoicesAction(args.customerId))).toMatchObject({code:'OK',orders:[]});
  const noOrders=await createFixture(['mails']);const denied=await withSession(noOrders,()=>getIntakeMessagesAction('alle'));if(denied.code!=='OK')throw Error('TEST_PHOTO_RIGHT');
  expect(denied.messages.find(row=>row.id===itemId)?.nextActionRule).toMatchObject({code:'OK',hauptaktion:null,gesperrt:[{elementId:'complaint.message',grundKey:'error.permission'}]});
  expect(await withSession(noOrders,()=>getComplaintOrderChoicesAction(customerId))).toMatchObject({code:'FORBIDDEN'});
  hasPhoto=false;graphId='TEST-U2-only-mime-'+randomUUID();const mimeOnly=await open();
  const after=await withSession(full,()=>getIntakeMessagesAction('alle'));if(after.code!=='OK')throw Error('TEST_MIME_U2');
  expect(after.messages.find(row=>row.id===mimeOnly)?.nextActionRule).toMatchObject({code:'OK',hauptaktion:null,prioritaet:3,datenluecken:['COMPLAINT_PHOTO_ACTION_BINDING']});
  expect(await withSession(full,()=>getIntakeMessagesAction('alle'))).toEqual(after);
 }finally{vi.restoreAllMocks();}
});

it('PL23:08 keeps first-look facts and explicit gaps when a specialist command is deferred',async()=>{
 const {selectIntakeConcernAction}=await import('@/app/actions/eingang.actions');
 const customerId=await customerFixture('TEST U2 Abschluss');
 for(const [concern,rank] of [['abholung',4],['ware',5]] as const){
  const itemId=randomUUID(),saved=await withSession(full,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST Bitte bearbeiten: Fachweg',context:{customerId}}));if(saved.code!=='OK')throw Error('TEST_DEFERRED_SOURCE');
  expect(await withSession(full,()=>selectIntakeConcernAction({itemId,version:saved.capture.version,clientEventId:randomUUID(),concern}))).toMatchObject({code:'OK'});
  const read=await withSession(full,()=>getIntakeMessagesAction('alle'));if(read.code!=='OK')throw Error('TEST_DEFERRED_READ');const row=read.messages.find(row=>row.id===itemId);
  expect(row?.nextActionRule).toMatchObject({code:'OK',prioritaet:rank,hauptaktion:null,datenluecken:['MESSAGE_SPECIALIST_ACTION_BINDING'],source:{id:itemId,version:2}});
  if(row?.nextActionRule?.code!=='OK')throw Error('TEST_DEFERRED_FIRST_LOOK');expect(row.nextActionRule.erstblick).toHaveLength(3);
  expect(row.nextActionRule.erstblick.find(field=>field.key==='nachrichten.inhalt')?.werte).toMatchObject({text:row.text});
  expect(await withSession(full,()=>getIntakeMessagesAction('alle'))).toEqual(read);
 }
});
