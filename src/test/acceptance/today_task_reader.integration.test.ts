// @vitest-environment node
// E-B read-kernel extraction: isolated TEST data, real writer/Auth/DB reads.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {saveIntakeNoteAction,saveIntakeTaskAction,selectIntakeConcernAction} from '@/app/actions/eingang.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readTask,readTaskForAuthorization} from '@/modules/tasks/server-public';

it('reads the same actual task and calendar through the existing wrapper and shared authorized kernel',async()=>{
 const itemId=randomUUID(),note=await withSession(full,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST vorhandener Aufgaben-Lesekern'}));
 expect(note.code).toBe('OK');if(note.code!=='OK')throw Error('TEST_TASK_NOTE_SOURCE_REQUIRED');
 const selected=await withSession(full,()=>selectIntakeConcernAction({itemId,version:note.capture.version,clientEventId:randomUUID(),concern:'aufgabe'}));
 expect(selected.code).toBe('OK');if(selected.code!=='OK')throw Error('TEST_TASK_CONCERN_SOURCE_REQUIRED');
 const input={clientKey:randomUUID(),version:0,kind:'aufgabe' as const,title:'TEST Aufgabe lesen',dueDate:'2027-05-15',time:null,forLogin:null,forArea:'mails' as const,reference:{type:'eingang' as const,id:itemId},note:'TEST echter Aufgabenbeleg',itemId,itemVersion:selected.capture.version};
 const saved=await withSession(full,()=>saveIntakeTaskAction(input));expect(saved.code).toBe('OK');if(saved.code!=='OK')throw Error('TEST_TASK_WRITER_REQUIRED');
 expect(await withSession(full,()=>saveIntakeTaskAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,task:{id:saved.task.id}});
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_TASK_AUTH_REQUIRED');
 const direct=await readTaskForAuthorization(auth.data,{taskId:saved.task.id});
 expect(direct).toEqual(await withSession(full,()=>readTask({taskId:saved.task.id})));
 expect(direct).toMatchObject({code:'OK',task:{id:saved.task.id,item_id:itemId,notiz:input.note},currentLogin:full.actorId});
 const calendar=await readTaskForAuthorization(auth.data,{calendar:true});
 expect(calendar).toEqual(await withSession(full,()=>readTask({calendar:true})));
 expect(calendar).toMatchObject({code:'OK',rows:expect.arrayContaining([expect.objectContaining({id:saved.task.id,itemId})])});
});

it('preserves the existing financial and calendar gates instead of granting rights through the new read entry',async()=>{
 const saved=await withSession(full,()=>saveIntakeTaskAction({clientKey:randomUUID(),version:0,kind:'aufgabe',title:'TEST geschützter Geldbezug',dueDate:'2027-05-15',time:null,forLogin:null,forArea:'preise',reference:{type:'allgemein',id:null},note:'TEST keine Geld-Offenlegung'}));
 expect(saved.code).toBe('OK');if(saved.code!=='OK')throw Error('TEST_FINANCIAL_TASK_REQUIRED');
 const restricted=await createFixture(['auftraege']),auth=await withSession(restricted,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_RESTRICTED_TASK_AUTH_REQUIRED');
 expect(await readTaskForAuthorization(auth.data,{taskId:saved.task.id})).toEqual(await withSession(restricted,()=>readTask({taskId:saved.task.id})));
 expect(await readTaskForAuthorization(auth.data,{taskId:saved.task.id})).toMatchObject({code:'FORBIDDEN'});
 expect(await readTaskForAuthorization(auth.data,{calendar:true})).toMatchObject({code:'FORBIDDEN'});
 expect(await readTask({calendar:false} as never)).toMatchObject({code:'VALIDATION_ERROR'});
});
