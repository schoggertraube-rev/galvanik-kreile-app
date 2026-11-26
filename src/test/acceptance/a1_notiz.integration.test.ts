// @vitest-environment node
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {createFixture,full,sql,withSession} from '../../../e2e/ablauf/replayHarness';
import {readTodayOwnNoteAction,saveTodayOwnNotesAction} from '@/app/actions/today.actions';
import {completeIntakeTaskAction,getIntakeTaskAction,saveIntakeTaskAction} from '@/app/actions/eingang.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import {liesAufgabenFuerTag} from '@/modules/tasks/server-public';
import {TODAY_OWN_NOTE_COPY} from '@/ui/allgemeinCopy';

const replayDb=process.env.DATABASE_URL;
if(!replayDb||replayDb!==process.env.H18_EXPECTED_DATABASE_URL||new URL(replayDb).hostname!=='127.0.0.1')
 throw Error('TEST_TODAY_NOTE_LOOPBACK_REPLAY_REQUIRED');

it('B-20 saves one own daily task and keeps the note out of other logins and the shared Today list',async()=>{
 const owner=await createFixture(['auftraege'],'werkstatt');
 const empty=await withSession(owner,()=>readTodayOwnNoteAction());
 if(empty.code!=='OK')throw Error('TEST_TODAY_NOTE_LOAD');
 const text='TEST private Tagesnotiz '+crypto.randomUUID();
 const input={text,day:empty.note.day,version:0};
 const saved=await withSession(owner,()=>saveTodayOwnNotesAction(input));
 expect(saved).toEqual({code:'OK',note:{...input,version:1,completed:false}});
 expect(await withSession(owner,()=>saveTodayOwnNotesAction(JSON.parse(JSON.stringify(input))))).toEqual(saved);
 const replacement=text+' ergänzt';
 const changed=await withSession(owner,()=>saveTodayOwnNotesAction({...input,text:replacement,version:1}));
 expect(changed).toEqual({code:'OK',note:{...input,text:replacement,version:2,completed:false}});
 expect(await withSession(owner,()=>readTodayOwnNoteAction())).toEqual(changed);
 expect(await withSession(full,()=>readTodayOwnNoteAction())).toMatchObject({code:'OK',note:{version:0,text:''}});
 const rows=await sql`SELECT id::text,client_key::text,art,bezug_typ,fuer_login::text,erstellt_von::text,notiz,version
  FROM public.tasks WHERE tenant_id=${tenant} AND erstellt_von=${owner.actorId}::uuid`;
 expect(rows).toHaveLength(1);
 const [task]=rows;
 expect(task).toMatchObject({art:'aufgabe',bezug_typ:'allgemein',fuer_login:owner.actorId,erstellt_von:owner.actorId,notiz:replacement,version:2});
 expect(await withSession(owner,()=>getIntakeTaskAction({taskId:task.id}))).toMatchObject({code:'OK',task:{id:task.id,notiz:replacement},canEdit:false,canComplete:true});
 expect(await withSession(full,()=>getIntakeTaskAction({taskId:task.id}))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(owner,()=>saveIntakeTaskAction({
  clientKey:task.client_key,taskId:task.id,version:2,kind:'aufgabe',title:TODAY_OWN_NOTE_COPY.title,
  dueDate:empty.note.day,time:null,forLogin:full.actorId,forArea:null,reference:{type:'allgemein',id:null},note:replacement,
 }))).toMatchObject({code:'FORBIDDEN'});
 for(const actor of [owner,full]){
  const auth=await withSession(actor,resolveAuthorization);
  if(!auth.ok)throw Error('TEST_NOTE_ACTOR');
  const shared=await liesAufgabenFuerTag(auth.data);
  expect(shared.code).toBe('OK');
  expect(JSON.stringify(shared)).not.toContain(task.id);
  expect(JSON.stringify(shared)).not.toContain(replacement);
 }
 expect(await withSession(full,()=>completeIntakeTaskAction({taskId:task.id,version:2,note:null}))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(owner,()=>completeIntakeTaskAction({taskId:task.id,version:2,note:null}))).toMatchObject({code:'OK',task:{status:'erledigt'}});
 expect(await withSession(owner,()=>readTodayOwnNoteAction())).toMatchObject({code:'OK',note:{version:3,text:'',completed:true}});
 const events=await sql`SELECT id FROM public.events WHERE tenant_id=${tenant} AND payload::text LIKE ${'%'+task.id+'%'}`;
 expect(events).toHaveLength(0);
});
