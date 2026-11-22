// @vitest-environment node
// Isolated TEST tenant: real task/note writers, sessions and database reads.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {saveIntakeNoteAction,saveIntakeTaskAction,selectIntakeConcernAction} from '@/app/actions/eingang.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import {authorizationReadContext} from '@/lib/server/authorizationReadContext';
import {canReadTaskArea} from '@/lib/auth/authorizationContract';
import {readTask,readTaskForAuthorization,type TaskReadContext} from '@/modules/tasks/server-public';

it('retains actual task facts, the existing calendar and real personal authority for 0/1/multiple tasks',async()=>{
 const empty=await withSession(full,()=>readTask({calendar:true}));
 expect(empty).toEqual({code:'OK',rows:[],missingTaskIds:[]});
 const ids:string[]=[];
 for(const index of [0,1]){
  const itemId=randomUUID(),note=await withSession(full,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST vorhandener Aufgaben-Lesekern '+index}));
  expect(note.code).toBe('OK');if(note.code!=='OK')throw Error('TEST_TASK_NOTE_SOURCE_REQUIRED');
  const selected=await withSession(full,()=>selectIntakeConcernAction({itemId,version:note.capture.version,clientEventId:randomUUID(),concern:'aufgabe'}));
  expect(selected.code).toBe('OK');if(selected.code!=='OK')throw Error('TEST_TASK_CONCERN_SOURCE_REQUIRED');
  const input={clientKey:randomUUID(),version:0,kind:'aufgabe' as const,title:'TEST Aufgabe lesen '+index,dueDate:'2027-05-15',time:null,forLogin:full.actorId,forArea:null,reference:{type:'eingang' as const,id:itemId},note:'TEST echter Aufgabenbeleg',itemId,itemVersion:selected.capture.version};
  const saved=await withSession(full,()=>saveIntakeTaskAction(input));expect(saved.code).toBe('OK');if(saved.code!=='OK')throw Error('TEST_TASK_WRITER_REQUIRED');ids.push(saved.task.id);
  expect(await withSession(full,()=>saveIntakeTaskAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,task:{id:saved.task.id}});
  const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_TASK_AUTH_REQUIRED');
  const context:TaskReadContext={...authorizationReadContext(auth.data),canReadTaskArea:area=>canReadTaskArea(auth.data,area)};
  const source=await readTaskForAuthorization(context,{taskId:saved.task.id});
  expect(source).toMatchObject({code:'OK',task:saved.task,canceledForEdit:{code:'KNOWN',value:false},pricingSource:'KNOWN'});
  expect(source).not.toHaveProperty('currentLogin');expect(source).not.toHaveProperty('canEdit');expect(source).not.toHaveProperty('canComplete');
  const personal=await readTaskForAuthorization(auth.data,{taskId:saved.task.id});
  expect(personal).toEqual(await withSession(full,()=>readTask({taskId:saved.task.id})));
  expect(personal).toMatchObject({code:'OK',task:saved.task,currentLogin:full.actorId,canEdit:true,canComplete:true,canOpenReference:true});
  const calendar=await readTaskForAuthorization(auth.data,{calendar:true});
  expect(calendar).toEqual(await withSession(full,()=>readTask({calendar:true})));
  if(!('rows'in calendar))throw Error('TEST_TASK_CALENDAR_REQUIRED');expect(calendar.rows).toHaveLength(index+1);
  const rawCalendar=await readTaskForAuthorization(context,{calendar:true});
  if(!('rows'in rawCalendar))throw Error('TEST_TASK_CALENDAR_FACTS_REQUIRED');
  expect(rawCalendar.missingTaskIds).toEqual([]);expect(rawCalendar.rows.map(row=>row.task?.id)).toEqual(calendar.rows.map(row=>row.id));
  for(const row of rawCalendar.rows){expect(row).not.toHaveProperty('currentLogin');expect(row).not.toHaveProperty('canComplete');}
 }
 for(const permissions of [['mails'],['eingang'],['auftraege'],['preise']] as const){
  const other=await createFixture([...permissions]),auth=await withSession(other,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_TASK_OTHER_AUTH_REQUIRED');
  const areas=new Set(auth.data.areas),context:TaskReadContext={...authorizationReadContext(auth.data),canReadTaskArea:area=>canReadTaskArea(auth.data,area)};
  const projected={...context,canReadArea:(area:Parameters<typeof context.canReadArea>[0])=>areas.has(area)};
  for(const id of ids){
   const source=await readTaskForAuthorization(context,{taskId:id});
   expect(await readTaskForAuthorization(projected,{taskId:id})).toEqual(source);
   const personal=await readTaskForAuthorization(auth.data,{taskId:id});
   expect(personal).toEqual(await withSession(other,()=>readTask({taskId:id})));
   expect(personal).toMatchObject({code:'OK',currentLogin:other.actorId,canEdit:false,canComplete:false});
   if(source.code!=='OK'||personal.code!=='OK')throw Error('TEST_TASK_SOURCE_READ_REQUIRED');
   expect(source.task).toEqual(personal.task);expect(source.reference).toEqual(personal.reference);
   expect(personal.canOpenReference).toBe(permissions.includes('mails' as never)||permissions.includes('eingang' as never));
  }
  if(!areas.has('mails'))expect(await readTaskForAuthorization(context,{calendar:true})).toMatchObject({code:'FORBIDDEN'});
 }
});

it('keeps financial recipients, validation and missing task errors at the original gates',async()=>{
 const saved=await withSession(full,()=>saveIntakeTaskAction({clientKey:randomUUID(),version:0,kind:'aufgabe',title:'TEST geschützter Geldbezug',dueDate:'2027-05-15',time:null,forLogin:null,forArea:'preise',reference:{type:'allgemein',id:null},note:'TEST keine Geld-Offenlegung'}));
 expect(saved.code).toBe('OK');if(saved.code!=='OK')throw Error('TEST_FINANCIAL_TASK_REQUIRED');
 for(const permissions of [['auftraege'],['mails'],['preise']] as const){
  const restricted=await createFixture([...permissions]),auth=await withSession(restricted,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_RESTRICTED_TASK_AUTH_REQUIRED');
  const context:TaskReadContext={...authorizationReadContext(auth.data),canReadTaskArea:area=>canReadTaskArea(auth.data,area)};
  const source=await readTaskForAuthorization(context,{taskId:saved.task.id});
  const personal=await withSession(restricted,()=>readTask({taskId:saved.task.id}));
  expect(await readTaskForAuthorization(auth.data,{taskId:saved.task.id})).toEqual(personal);
  if(permissions.includes('preise' as never)){expect(source).toMatchObject({code:'OK',task:saved.task});expect(personal).toMatchObject({code:'OK',canComplete:true});}
  else{expect(source).toEqual(personal);expect(source).toMatchObject({code:'FORBIDDEN'});}
 }
 expect(await readTask({calendar:false} as never)).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await withSession(full,()=>readTask({taskId:randomUUID()}))).toMatchObject({code:'NOT_FOUND'});
});
