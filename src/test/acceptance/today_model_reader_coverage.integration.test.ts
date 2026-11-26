// @vitest-environment node
// E-G2 native relation counters, without resetting shared statistics. Acceptance
// already runs one immutable worker at a time; no other local test runs alongside this probe.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {rebuildTodayModel} from '@/lib/server/todayProjection';
import {saveIntakeNoteAction,saveIntakeTaskAction,selectIntakeConcernAction,getIntakeTaskAction} from '@/app/actions/eingang.actions';
import {createQuoteAction,readQuoteDefaultsAction,changeQuoteLifecycleAction} from '@/app/actions/quotes.actions';
import {saveQuoteSettingsAction} from '@/app/actions/settings.actions';
import {reklamationAusfuehrenAction} from '@/app/actions/complaints.actions';
import {storeOrderPhoto} from '../../../e2e/ablauf/photoFixture';

const statistics=()=>sql`SELECT schemaname||'.'||relname AS name,(seq_scan+coalesce(idx_scan,0))::text AS reads FROM pg_stat_user_tables WHERE schemaname IN ('public','private') ORDER BY schemaname,relname`;
// PostgreSQL publishes idle-backend statistics asynchronously; this is not a
// business timeout, reset, retry of the rebuild or a replacement data source.
const published=()=>new Promise<void>(resolve=>setTimeout(resolve,1200));
async function settledStatistics(){
 let previous=new Map((await statistics()).map(row=>[row.name,BigInt(row.reads)]));
 for(let attempt=0;attempt<12;attempt++){
  await published();
  const current=new Map((await statistics()).map(row=>[row.name,BigInt(row.reads)]));
  if(current.size===previous.size&&[...current].every(([name,count])=>previous.get(name)===count))return current;
  previous=current;
 }
 throw Error('TEST_RELATION_STATISTICS_NOT_SETTLED');
}
const exceptions=new Map([
 ['private.today_source_v1','Derived model being rebuilt, never an independent business input'],
 ['private.today_tenant_v1','Derived lease and tenant epoch being rebuilt'],
 ['public.takt_job_runs','The Takt runner refreshes this one source after a completed receipt, covered by s38b_takt_outage.integration.test.ts'],
]);

it('E-G2 gives every relation actually read by a full productive rebuild all three invalidation triggers',async()=>{
 const order=await readyInvoiceOrder('TEST read dependency pickup');
 await readyInvoiceOrder('TEST read dependency shipping','shipping');
 const openNote=await withSession(full,()=>saveIntakeNoteAction({itemId:randomUUID(),textstand:randomUUID(),text:'TEST open original for full source coverage'}));
 expect(openNote.code).toBe('OK');
 const itemId=randomUUID(),note=await withSession(full,()=>saveIntakeNoteAction({itemId,textstand:randomUUID(),text:'TEST task original for full source coverage'}));
 if(note.code!=='OK')throw Error('TEST_DEPENDENCY_TASK_NOTE');
 const concern=await withSession(full,()=>selectIntakeConcernAction({itemId,version:note.capture.version,clientEventId:randomUUID(),concern:'aufgabe'}));
 if(concern.code!=='OK')throw Error('TEST_DEPENDENCY_TASK_CONCERN');
 const saved=await withSession(full,()=>saveIntakeTaskAction({clientKey:randomUUID(),version:0,kind:'aufgabe',title:'TEST Quellenaufgabe',dueDate:'2027-05-15',time:null,forLogin:full.actorId,forArea:null,reference:{type:'eingang',id:itemId},note:'TEST actual source coverage',itemId,itemVersion:concern.capture.version}));
 expect(saved.code).toBe('OK');
 const settings=await withSession(full,()=>readQuoteDefaultsAction());if(settings.code!=='OK')throw Error('TEST_DEPENDENCY_QUOTE_SETTINGS');
 expect(await withSession(full,()=>saveQuoteSettingsAction({clientEventId:randomUUID(),expectedUpdatedAt:settings.settings.updatedAt,setupCents:settings.settings.setupCents,materialCents:settings.settings.materialCents,followupDays:1,validityDays:14}))).toMatchObject({code:'OK'});
 const quote=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId:order.customerId,dueDate:'2027-05-15',note:'TEST actual quote dependency',positions:[{name:'TEST source part',quantity:1,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:10000,lineTotalCents:10000}]}));
 if(quote.code!=='OK')throw Error('TEST_DEPENDENCY_QUOTE');
 // Actual documented manual lifecycle evidence, not a physical printing claim.
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId:quote.quote.quoteId,expectedVersion:quote.quote.version,edition:1,action:'sent',channel:'druck',evidence:'TEST documented source coverage handover',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const [followup]=await sql`SELECT id::text FROM public.tasks WHERE tenant_id=${tenant} AND bezug_typ='kv' AND bezug_id=${quote.quote.quoteId}`;
 if(!followup)throw Error('TEST_DEPENDENCY_FOLLOWUP');
 const current=await withSession(full,()=>getIntakeTaskAction({taskId:followup.id}));if(current.code!=='OK'||!current.task)throw Error('TEST_DEPENDENCY_FOLLOWUP_READ');
 const task=current.task;
 const [clock]=await sql`SELECT ((statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1)::text AS yesterday`;
 expect(await withSession(full,()=>saveIntakeTaskAction({clientKey:task.client_key,taskId:task.id,version:task.version,kind:task.art,title:task.titel,dueDate:clock.yesterday,time:task.uhrzeit,forLogin:task.fuer_login,forArea:task.fuer_bereich,reference:{type:task.bezug_typ,id:task.bezug_id},note:task.notiz}))).toMatchObject({code:'OK'});
 const photo=await storeOrderPhoto(order.orderId);
 expect(await withSession(full,()=>reklamationAusfuehrenAction({action:'aufnehmen',clientKey:randomUUID(),orderId:order.orderId,intakeItemId:null,intakeVersion:null,parts:[{position_id:order.items[0].id,menge:1}],defect:'Abplatzung',description:'TEST actual complaint dependency',photoIds:[photo],goodsReturn:'ja'}))).toMatchObject({code:'OK'});
 const before=await settledStatistics();
 expect((await rebuildTodayModel(tenant)).code).toBe('OK');
 const sources=await sql`SELECT kind,status,payload FROM private.today_source_v1 WHERE tenant_id=${tenant} ORDER BY kind,source_id`;
 for(const source of sources)expect(source.status,source.kind).toBe('OK');
 const lists=new Map(sources.filter(source=>source.kind!=='quelle:orders.auftrag').map(source=>[source.kind,source.payload]));
 expect(lists.size).toBe(9);
 expect(lists.get('quelle:orders.liste')).toHaveLength(2);
 expect(lists.get('quelle:eingang.nachrichten').messages.length).toBeGreaterThan(0);
 expect(lists.get('quelle:accounting.geld').invoiceSource.data).toHaveLength(2);
 expect(lists.get('quelle:complaints.liste').complaints).toHaveLength(1);
 expect(lists.get('quelle:quotes.nachfassen')).toHaveLength(1);
 expect(lists.get('quelle:quotes.liste').list.quotes).toHaveLength(1);
 expect(lists.get('quelle:tasks.aufgabe')).toMatchObject({
  aufgaben:expect.arrayContaining([expect.objectContaining({id:task.id,titel:task.titel})]),
  kalender:{rows:[expect.objectContaining({task:expect.objectContaining({titel:'TEST Quellenaufgabe'})})]},
 });
 expect(lists.get('quelle:takt.ausfall')).toMatchObject({code:'OK',ausfaelle:expect.any(Array)});
 expect(lists.get('quelle:fundament.firma')).toMatchObject({code:'OK'});
 const after=await settledStatistics();
 const reads=[...after].filter(([name,count])=>count>(before.get(name)??BigInt(0))).map(([name])=>name);
 const triggers=await sql`SELECT n.nspname||'.'||c.relname AS name,count(*)::integer AS operations FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND t.tgname IN ('today_mark_insert_v1','today_mark_update_v1','today_mark_delete_v1') GROUP BY n.nspname,c.relname`;
 const covered=new Set(triggers.filter(row=>row.operations===3).map(row=>row.name));
 expect(reads).toEqual(expect.arrayContaining(['public.orders','public.items','public.events','public.app_users','public.app_user_rights']));
 expect(reads.filter(name=>!covered.has(name)&&!exceptions.has(name)),'read relation without INSERT/UPDATE/DELETE invalidation').toEqual([]);
});
