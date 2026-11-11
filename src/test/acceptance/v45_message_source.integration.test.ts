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
