// @vitest-environment node

import {sql,full,withSession,withRequest,createFixture} from '../../../e2e/ablauf/replayHarness';
import {maskOrderPaymentCredit} from '@/lib/server/paymentSummaryRead';
import {maskTodayOrderCard} from '@/lib/server/orderCardRead';
import {readTodayOrderSources,type TodayOrderReadPorts} from '@/lib/server/todayOrderRead';
import {readInvoiceVat,readCustomerCreditInTransaction} from '@/modules/accounting/server-public';
import {readBetriebsruheInTransaction, readShippingSettingsInTransaction} from '@/modules/fundament/server-public';
import {readTodayReadSettings} from '@/modules/fundament/server-public';
import {readCustomerProfile,readCustomerProfiles} from '@/modules/customers/server-public';
import {readManualShippingBatch} from '@/modules/orders/server-public';
import {readShippingMergeAllocation} from '@/lib/server/commands/immutableInvoiceCommand';
import {DEFAULT_PAGE_READ_SETTINGS,pageReadQueryObservation,withPageReadBudget} from '@/db/readBudget';
import {randomUUID} from 'node:crypto';
// Actual TEST Actions/Auth/DB/Storage; derived-cache faults are restored whole.
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization,hasAnyAuthorizationArea} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readTodayModelInTransaction} from '@/lib/server/todayDashboard';
import {readTodayCalendar} from '@/lib/today/todayDashboardPolicy';
import {rebuildTodayModel,refreshTodayModel} from '@/lib/server/todayProjection';
import {changeOrderPromisedDueDateAction} from '@/app/actions/orders.actions';
import {withRestoredTestSource} from '../fixtures/restoredTestSource';
import {readOfficeHomeModelAction,readTodayHomeRevision,readTodayHomePart} from '@/app/actions/orders.actions';
import {readTodayDashboard,collectTodaySources,composeTodayDashboard} from '@/lib/server/todayDashboard';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';
import {saveIntakeNoteAction,saveIntakeTaskAction,selectIntakeConcernAction,getIntakeTaskAction} from '@/app/actions/eingang.actions';
import {createQuoteAction,readQuoteDefaultsAction,changeQuoteLifecycleAction} from '@/app/actions/quotes.actions';
import {saveQuoteSettingsAction} from '@/app/actions/settings.actions';
import {saveCompanySettingsAction} from '@/app/actions/settings.actions';
import {reklamationAusfuehrenAction} from '@/app/actions/complaints.actions';
import {storeOrderPhoto} from '../../../e2e/ablauf/photoFixture';
import {APP_ROLES,ACCESS_AREAS,normalizeAccessAreasForRole,type AccessArea} from '@/lib/auth/authorizationContract';
import {GET as getModelRoute} from '@/app/api/heute/modell/route';
import {GET as taktGET} from '@/app/api/takt/route';
import {GET as rebuildGET} from '@/app/api/heute/neuaufbau/route';
import {fuehreTaktAus,liesTaktAusfallZeilen,projiziereTaktAusfallZeilen} from '@/modules/takt/server-public';
import {liesAufgabenFuerTag,projiziereAufgabenFuerTag} from '@/modules/tasks/server-public';


// Public Action always resolves the actual request actor and its server clock.
// This adapter only checks/narrows the sanitized DTO, never injects an identity.
async function readModelForCurrentSession(deferLive=false){
 const model=await readOfficeHomeModelAction({deferLive});
 if(!('dashboard'in model)||!model.modelRead||!model.dashboard.calendar)throw Error('TEST_AUTHENTICATED_HOME_MODEL_REQUIRED');
 return {code:'OK' as const,dashboard:model.dashboard,pending:model.modelRead.pending,incomplete:model.modelRead.incomplete,model};
}
function withoutReadClock(dashboard:import('@/lib/server/todayDashboard').TodayDashboard){
 expect(dashboard.calendar).toBeTruthy();
 return {...dashboard,calendar:{...dashboard.calendar,readStartedAt:undefined}};
}
const liveTagQuellen={
 aufgaben:{live:liesAufgabenFuerTag,ausModell:projiziereAufgabenFuerTag},
 taktAusfall:{live:liesTaktAusfallZeilen,ausModell:projiziereTaktAusfallZeilen},
};

// This file's H18 classification is backed by an executable local-DB guard,
// in addition to the shared harness's stricter tenant and database guard.
const replayDatabase=process.env.DATABASE_URL;
if(!replayDatabase||replayDatabase!==process.env.H18_EXPECTED_DATABASE_URL||new URL(replayDatabase).hostname!=='127.0.0.1')throw Error('TODAY_MODEL_DEDICATED_REPLAY_REQUIRED');

const profiles=new Map<string,Awaited<ReturnType<typeof createFixture>>>();
const customProfiles:Array<{key:string;areas:AccessArea[]}>=[
 {key:'orders',areas:['auftraege']},{key:'orders-prices',areas:['auftraege','preise']},{key:'orders-payments',areas:['auftraege','zahlungen']},
 {key:'mails',areas:['mails']},{key:'mail-customer',areas:['mails','kunden']},{key:'mail-assignment',areas:['mails','kunden','eingang']},
 {key:'mail-money',areas:['mails','preise','zahlungen']},
];

it('persists the bounded Today lease through the real settings action and active model reader',async()=>{
 const company={companyName:'TEST Kreile',street:'Testweg 1',zip:'12345',city:'Berlin',country:'Deutschland',taxId:'DE123456789',iban:'DE0012345678',bic:'TESTDEFF',bankName:'Testbank',paymentTermDays:14,logoUrl:'/TEST-logo.png'};
 expect(await withSession(full,()=>saveCompanySettingsAction(company))).toMatchObject({code:'OK'});
 const read=async()=>{const [row]=await sql`SELECT to_jsonb(company) AS row FROM public.company_settings company WHERE tenant_id=${tenant}`;if(!row)throw Error('TEST_TODAY_LEASE_COMPANY_REQUIRED');return row.row;};
 await withRestoredTestSource({label:'TEST bounded Today lease settings',read,restore:async original=>{
  const columns=Object.keys(original);if(columns.some(column=>!/^[a-z_][a-z0-9_]*$/.test(column)))throw Error('TEST_TODAY_LEASE_COLUMN_INVALID');
  const names=columns.map(column=>'"'+column+'"').join(',');
  await sql`UPDATE public.company_settings SET (${sql.unsafe(names)})=(SELECT ${sql.unsafe(names)} FROM jsonb_populate_record(NULL::public.company_settings,${sql.json(original)}::jsonb)) WHERE tenant_id=${tenant} AND id=${String(original.id)}`;
 }},async()=>{
  expect(await withSession(full,()=>saveCompanySettingsAction({...company,todayRefreshLeaseSeconds:45}))).toMatchObject({code:'OK'});
  expect(await readTodayReadSettings({tenantId:tenant,fresh:true})).toMatchObject({todayRefreshLeaseSeconds:45});
  expect((await refreshTodayModel(tenant,undefined,{bounded:true})).code).toBe('OK');
  const [audit]=await sql`SELECT payload FROM public.ui_events WHERE tenant_id=${tenant} AND event_type='company_settings_updated' ORDER BY created_at DESC LIMIT 1`;
  expect(audit?.payload).toMatchObject({actorId:full.actorId,todayRefreshLeaseSeconds:45});
  expect(await withSession(full,()=>saveCompanySettingsAction({...company,todayRefreshLeaseSeconds:241}))).toMatchObject({code:'VALIDATION_ERROR'});
  expect(await readTodayReadSettings({tenantId:tenant,fresh:true})).toMatchObject({todayRefreshLeaseSeconds:45});
 });
});

it('qualifies the actual source snapshot and never returns an old payload after a command, version mismatch or code change',async()=>{
 const order=await readyInvoiceOrder('TEST qualified model source');
 const resolved=await withSession(full,()=>resolveAuthorization());if(!resolved.ok)throw Error('TEST_REAL_MODEL_AUTH_REQUIRED');
 const auth=resolved.data,today=readTodayCalendar(new Date()).today;
 const read=()=>withPrivilegedTenantTransaction(auth,tx=>readTodayModelInTransaction(tx,auth,today));
 const initial=await read();expect(initial.code).toBe('EMPTY');
 expect((await rebuildTodayModel(tenant)).code).toBe('OK');
 const warm=await read();expect(warm.code).toBe('OK');expect(warm.rows).toHaveLength(10);
 expect(warm.rows.every(row=>row.fresh===true&&row.payload!==null)).toBe(true);
 const input={orderId:order.orderId,expectedVersion:order.version,dueDate:'2027-08-04',reason:'TEST qualified model after actual command',clientEventId:globalThis.crypto.randomUUID()};
 const changed=await withSession(full,()=>changeOrderPromisedDueDateAction(input));expect(changed.code).toBe('OK');
 expect(await withSession(full,()=>changeOrderPromisedDueDateAction(JSON.parse(JSON.stringify(input))))).toEqual({...changed,replayed:true});
 const invalidated=await read();
 expect(invalidated.needsRebuild).toBe(true);
 const stale=invalidated.rows.find(row=>row.kind==='quelle:orders.auftrag'&&row.sourceId===order.orderId);
 expect(stale).toMatchObject({fresh:false,payload:null,needsRebuild:true,sourceVersion:order.version,currentVersion:order.version+1});
 const saved=async()=>{const [source]=await sql`SELECT to_jsonb(source) AS row FROM private.today_source_v1 source WHERE tenant_id=${tenant} AND kind='quelle:orders.auftrag' AND source_id=${order.orderId}`;if(!source)throw Error('TEST_CACHE_SOURCE_REQUIRED');return source.row;};
 const restore=async(original:Awaited<ReturnType<typeof saved>>)=>{
  const columns=Object.keys(original);if(columns.some(column=>!/^[a-z_][a-z0-9_]*$/.test(column)))throw Error('TEST_MODEL_COLUMN_INVALID');
  const names=columns.map(column=>'"'+column+'"').join(',');
  await sql`UPDATE private.today_source_v1 SET (${sql.unsafe(names)})=(SELECT ${sql.unsafe(names)} FROM jsonb_populate_record(NULL::private.today_source_v1,${sql.json(original)}::jsonb)) WHERE tenant_id=${tenant} AND kind='quelle:orders.auftrag' AND source_id=${order.orderId}`;
 };
 await withRestoredTestSource({label:'TEST complete derived version source',read:saved,restore},async()=>{
  // Isolate the physical-order version join from the sequence guard. This is
  // explicitly a cache corruption probe, never a fabricated command receipt.
  await sql`UPDATE private.today_source_v1 SET built_seq=source_seq WHERE tenant_id=${tenant} AND kind='quelle:orders.auftrag' AND source_id=${order.orderId}`;
  expect((await read()).rows.find(row=>row.kind==='quelle:orders.auftrag'&&row.sourceId===order.orderId)).toMatchObject({fresh:false,payload:null});
 });
 expect((await refreshTodayModel(tenant)).code).toBe('OK');
 expect((await read()).rows.find(row=>row.kind==='quelle:orders.auftrag'&&row.sourceId===order.orderId)).toMatchObject({fresh:true,sourceVersion:order.version+1,currentVersion:order.version+1});
 await withRestoredTestSource({label:'TEST targeted invalidation of the incomplete orders list',read:async()=>{
  const [row]=await sql`SELECT to_jsonb(source) AS row FROM private.today_source_v1 source
    WHERE tenant_id=${tenant} AND kind='quelle:orders.liste' AND source_id='*'`;
  if(!row)throw Error('TEST_ORDERS_LIST_SOURCE_REQUIRED');return row.row;
 },restore:async original=>{
  const columns=Object.keys(original);if(columns.some(column=>!/^[a-z_][a-z0-9_]*$/.test(column)))throw Error('TEST_LIST_COLUMN_INVALID');
  const names=columns.map(column=>'"'+column+'"').join(',');
  await sql`UPDATE private.today_source_v1 SET (${sql.unsafe(names)})=(SELECT ${sql.unsafe(names)} FROM jsonb_populate_record(NULL::private.today_source_v1,${sql.json(original)}::jsonb))
    WHERE tenant_id=${tenant} AND kind='quelle:orders.liste' AND source_id='*'`;
 }},async()=>{
  const list = (result:Awaited<ReturnType<typeof read>>)=>result.rows.find(row=>row.kind==='quelle:orders.liste'&&row.sourceId==='*');
  await sql`UPDATE private.today_source_v1 SET status='SOURCE_INCOMPLETE',error_code='TEST_DERIVED_SOURCE_FAILURE'
    WHERE tenant_id=${tenant} AND kind='quelle:orders.liste' AND source_id='*'`;
  expect(list(await read())).toMatchObject({needsRebuild:false,fresh:false});
  await sql`UPDATE private.today_source_v1 SET source_seq=source_seq+1 WHERE tenant_id=${tenant} AND kind='quelle:orders.liste' AND source_id='*'`;
  const invalidatedList=await read();
  expect(invalidatedList.needsRebuild).toBe(true);
  expect(list(invalidatedList)).toMatchObject({needsRebuild:true,fresh:false,payload:null});
  expect(await refreshTodayModel(tenant)).toMatchObject({code:'OK',built:1});
  expect(list(await read())).toMatchObject({needsRebuild:false,fresh:true,builtSeq:list(invalidatedList)?.sourceSeq});
 });
 await withRestoredTestSource({label:'TEST complete derived projector source',read:saved,restore},async()=>{
  await sql`UPDATE private.today_source_v1 SET projector_version=projector_version+1 WHERE tenant_id=${tenant} AND kind='quelle:orders.auftrag' AND source_id=${order.orderId}`;
  const wrongCode=await read();expect(wrongCode.needsRebuild).toBe(true);
  expect(wrongCode.rows.find(row=>row.kind==='quelle:orders.auftrag'&&row.sourceId===order.orderId)).toMatchObject({fresh:false,payload:null});
 });
 const tomorrow=new Date(today+'T12:00:00Z');tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
 const wrongDay=await withPrivilegedTenantTransaction(auth,tx=>readTodayModelInTransaction(tx,auth,tomorrow.toISOString().slice(0,10)));
 expect(wrongDay.needsRebuild).toBe(true);expect(wrongDay.rows.every(row=>row.fresh!==true&&row.payload===null)).toBe(true);
 // Explicit low-level tenant-isolation boundary, not a replacement identity.
 const other=await withPrivilegedTenantTransaction(auth,tx=>readTodayModelInTransaction(tx,{tenantId:tenant+'-TEST-other'},today));
 expect(other).toEqual({code:'EMPTY',rows:[],needsRebuild:true});
});

it('retains current partial list evidence without calling it fresh or discarding unrelated known cards',async()=>{
 const resolved=await withSession(full,()=>resolveAuthorization());if(!resolved.ok)throw Error('TEST_PARTIAL_MODEL_AUTH_REQUIRED');
 const read=async()=>{const [source]=await sql`SELECT to_jsonb(company) AS row FROM public.company_settings company WHERE tenant_id=${tenant}`;if(!source)throw Error('TEST_PARTIAL_MODEL_SETTINGS_REQUIRED');return source.row;};
 await withRestoredTestSource({label:'TEST complete partial-model company source',read,restore:async original=>{
  const columns=Object.keys(original);if(columns.some(column=>!/^[a-z_][a-z0-9_]*$/.test(column)))throw Error('TEST_PARTIAL_MODEL_COLUMN_INVALID');
  const names=columns.map(column=>'"'+column+'"').join(',');
  await sql`UPDATE public.company_settings SET (${sql.unsafe(names)})=(SELECT ${sql.unsafe(names)} FROM jsonb_populate_record(NULL::public.company_settings,${sql.json(original)}::jsonb)) WHERE tenant_id=${tenant} AND id=${String(original.id)}`;
 }},async()=>{
  await sql`UPDATE public.company_settings SET street='' WHERE tenant_id=${tenant}`;
  expect((await rebuildTodayModel(tenant)).code).toBe('OK');
  const result=await withPrivilegedTenantTransaction(resolved.data,tx=>readTodayModelInTransaction(tx,resolved.data,readTodayCalendar(new Date()).today));
  expect(result.rows.find(row=>row.kind==='quelle:fundament.firma')).toMatchObject({status:'SOURCE_INCOMPLETE',current:true,fresh:false,payload:{code:'VALIDATION_ERROR',missingFields:['street']}});
  expect(result.rows.filter(row=>row.kind==='quelle:orders.auftrag').every(row=>row.fresh===true&&row.payload!==null)).toBe(true);
 });
});

it('E-G1 first full real profile composes the same dashboard from qualified model and live sources',async()=>{
 const resolved=await withSession(full,()=>resolveAuthorization());if(!resolved.ok)throw Error('TEST_MODEL_COMPOSITION_AUTH_REQUIRED');
 expect((await rebuildTodayModel(tenant)).code).toBe('OK');
 const modeled=await withSession(full,()=>readModelForCurrentSession());
 expect(modeled.code).toBe('OK');if(modeled.code!=='OK')throw Error('TEST_MODEL_COMPOSITION_REQUIRED');
 const live=await withSession(full,()=>readTodayDashboard(resolved.data,getComplaints,getQuoteFollowupsForTodayAction,readBetriebsruheInTransaction,new Date(modeled.dashboard.calendar!.readStartedAt),undefined,liveTagQuellen));
 expect({...modeled.dashboard,datenluecken:[...(modeled.dashboard.datenluecken??[])].sort()}).toEqual({...live,datenluecken:[...(live.datenluecken??[])].sort()});
 expect(modeled.pending).toBe(false);expect(modeled.incomplete).toBe(false);
});

it('E-G1 fills all nine productive list source kinds and creates the real canonical role/rights profiles',async()=>{
 const order=await readyInvoiceOrder('TEST E-G1 pickup cohort');
 await readyInvoiceOrder('TEST E-G1 shipping cohort','shipping');
 expect(await withSession(full,()=>saveIntakeNoteAction({itemId:globalThis.crypto.randomUUID(),textstand:globalThis.crypto.randomUUID(),text:'TEST E-G1 open secured original'}))).toMatchObject({code:'OK'});
 const itemId=globalThis.crypto.randomUUID(),note=await withSession(full,()=>saveIntakeNoteAction({itemId,textstand:globalThis.crypto.randomUUID(),text:'TEST E-G1 actual task original'}));
 if(note.code!=='OK')throw Error('TEST_G1_NOTE_REQUIRED');
 const concern=await withSession(full,()=>selectIntakeConcernAction({itemId,version:note.capture.version,clientEventId:globalThis.crypto.randomUUID(),concern:'aufgabe'}));
 if(concern.code!=='OK')throw Error('TEST_G1_CONCERN_REQUIRED');
 expect(await withSession(full,()=>saveIntakeTaskAction({clientKey:globalThis.crypto.randomUUID(),version:0,kind:'aufgabe',title:'TEST G1 Quellenaufgabe',dueDate:'2027-05-15',time:null,forLogin:full.actorId,forArea:null,reference:{type:'eingang',id:itemId},note:'TEST G1 original task',itemId,itemVersion:concern.capture.version}))).toMatchObject({code:'OK'});
 const settings=await withSession(full,()=>readQuoteDefaultsAction());if(settings.code!=='OK')throw Error('TEST_G1_QUOTE_SETTINGS_REQUIRED');
 expect(await withSession(full,()=>saveQuoteSettingsAction({clientEventId:globalThis.crypto.randomUUID(),expectedUpdatedAt:settings.settings.updatedAt,setupCents:settings.settings.setupCents,materialCents:settings.settings.materialCents,followupDays:1,validityDays:14}))).toMatchObject({code:'OK'});
 const quote=await withSession(full,()=>createQuoteAction({clientEventId:globalThis.crypto.randomUUID(),customerId:order.customerId,dueDate:'2027-05-15',note:'TEST G1 quote source',positions:[{name:'TEST G1 part',quantity:1,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:10000,lineTotalCents:10000}]}));
 if(quote.code!=='OK')throw Error('TEST_G1_QUOTE_REQUIRED');
 expect(await withSession(full,()=>changeQuoteLifecycleAction({quoteId:quote.quote.quoteId,expectedVersion:quote.quote.version,edition:1,action:'sent',channel:'druck',evidence:'TEST documented G1 handover',clientEventId:globalThis.crypto.randomUUID()}))).toMatchObject({code:'OK'});
 const [followup]=await sql`SELECT id::text FROM public.tasks WHERE tenant_id=${tenant} AND bezug_typ='kv' AND bezug_id=${quote.quote.quoteId}`;
 const current=await withSession(full,()=>getIntakeTaskAction({taskId:followup.id}));if(current.code!=='OK'||!current.task)throw Error('TEST_G1_FOLLOWUP_REQUIRED');
 const task=current.task,[clock]=await sql`SELECT ((statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1)::text AS yesterday`;
 expect(await withSession(full,()=>saveIntakeTaskAction({clientKey:task.client_key,taskId:task.id,version:task.version,kind:task.art,title:task.titel,dueDate:clock.yesterday,time:task.uhrzeit,forLogin:task.fuer_login,forArea:task.fuer_bereich,reference:{type:task.bezug_typ,id:task.bezug_id},note:task.notiz}))).toMatchObject({code:'OK'});
 const photo=await storeOrderPhoto(order.orderId);
 expect(await withSession(full,()=>reklamationAusfuehrenAction({action:'aufnehmen',clientKey:globalThis.crypto.randomUUID(),orderId:order.orderId,intakeItemId:null,intakeVersion:null,parts:[{position_id:order.items[0].id,menge:1}],defect:'Abplatzung',description:'TEST G1 complaint',photoIds:[photo],goodsReturn:'ja'}))).toMatchObject({code:'OK'});
 for(const role of APP_ROLES){
  profiles.set('role-'+role,await createFixture(normalizeAccessAreasForRole(role,[]),role));
  profiles.set('role-granted-'+role,await createFixture(normalizeAccessAreasForRole(role,[...ACCESS_AREAS]),role));
 }
 for(const profile of customProfiles)profiles.set(profile.key,await createFixture(profile.areas,'buero'));
 expect((await rebuildTodayModel(tenant)).code).toBe('OK');
 const sources=await sql`SELECT kind,status,payload FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind<>'quelle:orders.auftrag' ORDER BY kind`;
 expect(sources).toHaveLength(9);expect(sources.every(row=>row.status==='OK')).toBe(true);
 for(const row of sources)expect(row.payload).not.toBeNull();
});

it.each([...APP_ROLES.map(role=>'role-'+role),...APP_ROLES.map(role=>'role-granted-'+role),...customProfiles.map(profile=>profile.key)])('E-G1 keeps the same Home access or full dashboard for actual profile %s',async key=>{
 const fixture=profiles.get(key);if(!fixture)throw Error('TEST_G1_PROFILE_NOT_CREATED_'+key);
 await withSession(fixture,async()=>{
  const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_G1_ACTUAL_PROFILE_AUTH');
  // A role without actual granted areas has the same established empty-access
  // Home and denied GET as before E-C; never manufacture grants to fill a card.
  if(!hasAnyAuthorizationArea(auth.data)){
   expect(await readOfficeHomeModelAction()).toEqual({kind:'no_areas'});
   expect((await getModelRoute(new Request('http://127.0.0.1/api/heute/modell?nur=veraltet'))).status).toBe(403);
   return;
  }
  const modeled=await readModelForCurrentSession();
  expect(modeled.code).toBe('OK');if(modeled.code!=='OK')throw Error('TEST_G1_MODEL_REQUIRED');
  const live=await readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction,readBetriebsruheInTransaction,new Date(modeled.dashboard.calendar!.readStartedAt),undefined,liveTagQuellen);
  expect({...modeled.dashboard,datenluecken:[...(modeled.dashboard.datenluecken??[])].sort()}).toEqual({...live,datenluecken:[...(live.datenluecken??[])].sort()});
 });
});

// Existing own E-C snapshot case retained byte-for-byte in the same TEST cohort.
it('composes one captured real source snapshot without SQL, preserves it after a real command and retains known rows on a missing version source',async()=>{
 const order=await readyInvoiceOrder('TEST shared Today composition');
 const now=new Date();
 const {auth,sources}=await withSession(full,async()=>{
  const resolved=await resolveAuthorization();if(!resolved.ok)throw Error('TEST_ACTUAL_COMPOSITION_AUTH');
  return {auth:resolved.data,sources:await collectTodaySources(resolved.data,getComplaints,getQuoteFollowupsForTodayAction, readBetriebsruheInTransaction,now)};
 });
 const responsibilities=sources.responsibilitySource.code==='OK'?[...sources.responsibilitySource.data]:null;
 const compose=()=>withPageReadBudget(async()=>{
  const queries=pageReadQueryObservation(),before=queries.total;
  const result=composeTodayDashboard(auth,sources,sources.calendar);
  expect(queries.total).toBe(before);
  return result;
 },DEFAULT_PAGE_READ_SETTINGS.queryTimeoutMs);
 const before=await compose();
 const oldVersion=before.orderActions?.rows.find(row=>row.orderId===order.orderId)?.version;
 expect(oldVersion).toBe(order.version);
 const current=await withSession(full,()=>readTodayDashboard(auth,getComplaints,getQuoteFollowupsForTodayAction, readBetriebsruheInTransaction,now));
 expect(current).toEqual(before);
 const command={orderId:order.orderId,expectedVersion:order.version,dueDate:'2027-07-21',reason:'TEST captured source remains unchanged',clientEventId:randomUUID()};
 const changed=await withSession(full,()=>changeOrderPromisedDueDateAction(command));
 expect(changed.code).toBe('OK');
 expect(await withSession(full,()=>changeOrderPromisedDueDateAction(JSON.parse(JSON.stringify(command))))).toEqual({...changed,replayed:true});
 expect(await compose()).toEqual(before);
 const after=await withSession(full,()=>readTodayDashboard(auth,getComplaints,getQuoteFollowupsForTodayAction, readBetriebsruheInTransaction,now));
 expect(after.orderActions?.rows.find(row=>row.orderId===order.orderId)?.version).toBeGreaterThan(order.version);
 if(sources.responsibilitySource.code==='OK')expect([...sources.responsibilitySource.data]).toEqual(responsibilities);
 // Explicit missing-DTO boundary, not a claimed SQL/provider failure.
 const missing=composeTodayDashboard(auth,{...sources,versions:null},sources.calendar);
 expect(missing.orderActions?.missingOrderIds).toContain(order.orderId);
 expect(missing.datenluecken).toContain('ORDER_ACTION_SOURCE');
 expect(missing.items.some(row=>row.orderId===order.orderId)).toBe(true);
});

it('actual model GET rejects anonymous, no-area and malformed requests without reading or refreshing model sources',async()=>{
 const request=(suffix='?nur=veraltet')=>new Request('http://127.0.0.1/api/heute/modell'+suffix);
 const anonymous=await withRequest('',()=>getModelRoute(request()));expect(anonymous.status).toBe(401);expect(await anonymous.text()).toBe('');
 const noArea=await createFixture([],'readonly');
 const denied=await withSession(noArea,()=>getModelRoute(request()));expect(denied.status).toBe(403);
 const invalid=await withSession(full,()=>getModelRoute(request('?nur=veraltet&nur=veraltet')));expect(invalid.status).toBe(400);
});

it('actual GET returns a command-stale model promptly while the scheduled projector catches up without another business effect',async()=>{
 const order=await readyInvoiceOrder('TEST native model GET');
 expect((await rebuildTodayModel(tenant)).code).toBe('OK');
 const input={orderId:order.orderId,expectedVersion:order.version,dueDate:'2027-08-05',reason:'TEST actual GET after source command',clientEventId:randomUUID()};
 const saved=await withSession(full,()=>changeOrderPromisedDueDateAction(input),true);expect(saved.code).toBe('OK');
 const laufBelege=()=>sql`SELECT status FROM public.takt_job_runs WHERE tenant_id=${tenant} AND job_schluessel='takt.nachholen'`;
 expect(await laufBelege()).toHaveLength(0);
 const response=await withSession(full,()=>getModelRoute(new Request('http://127.0.0.1/api/heute/modell?nur=veraltet')),true);
 expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('private, no-store');
 const result=await response.json();expect(result.code).toBe('OK');
 expect(result.model.modelRead).toMatchObject({source:'modell',pending:true});
 expect(result.model.kind).not.toBe('partial');
 expect(result.model.dashboard.orderActions.rows.find((row:{orderId:string})=>row.orderId===order.orderId)).toMatchObject({version:order.version+1});
 expect(await laufBelege()).toEqual([{status:'ok'}]);
 const settled=await withSession(full,()=>getModelRoute(new Request('http://127.0.0.1/api/heute/modell?nur=veraltet')),true);
 const nachgelesen=await settled.json();
 expect(nachgelesen.model.modelRead).toMatchObject({source:'modell',pending:false});
 expect(nachgelesen.model.dashboard.orderActions.rows.find((row:{orderId:string})=>row.orderId===order.orderId)?.version).toBe(order.version+1);
 expect(await withSession(full,()=>changeOrderPromisedDueDateAction(JSON.parse(JSON.stringify(input))))).toEqual({...saved,replayed:true});
 expect(await sql`SELECT count(*)::integer AS count FROM public.events WHERE tenant_id=${tenant} AND client_event_id=${input.clientEventId} AND event_type='ORDER_PROMISED_DUE_DATE_CHANGED_V1'`).toEqual([{count:1}]);
});

it('actual GET keeps the explicit live escape independent of model reads and projector runs',async()=>{
 const read=async()=>{const [row]=await sql`SELECT to_jsonb(company) AS row FROM public.company_settings company WHERE tenant_id=${tenant}`;if(!row)throw Error('TEST_LIVE_ESCAPE_SETTINGS');return row.row;};
 await withRestoredTestSource({label:'TEST complete explicit live escape settings',read,restore:async original=>{
  const columns=Object.keys(original);if(columns.some(column=>!/^[a-z_][a-z0-9_]*$/.test(column)))throw Error('TEST_LIVE_ESCAPE_COLUMN_INVALID');
  const names=columns.map(column=>'"'+column+'"').join(',');
  await sql`UPDATE public.company_settings SET (${sql.unsafe(names)})=(SELECT ${sql.unsafe(names)} FROM jsonb_populate_record(NULL::public.company_settings,${sql.json(original)}::jsonb)) WHERE tenant_id=${tenant} AND id=${String(original.id)}`;
 }},async()=>{
  await sql`UPDATE public.company_settings SET today_read_source='live' WHERE tenant_id=${tenant}`;
  const output=vi.spyOn(console,'info');
  try{
   const response=await withSession(full,()=>getModelRoute(new Request('http://127.0.0.1/api/heute/modell?nur=veraltet')));
   expect(response.status).toBe(200);const result=await response.json();
   expect(result.model.modelRead).toMatchObject({source:'live',pending:false});
   expect(result.model.dashboard.orderActions.rows.length).toBeGreaterThan(0);
   const resolved=await withSession(full,()=>resolveAuthorization());if(!resolved.ok)throw Error('TEST_LIVE_EQUALITY_AUTH');
   const original=await withSession(full,()=>readTodayDashboard(resolved.data,getComplaints,getQuoteFollowupsForTodayAction,readBetriebsruheInTransaction,new Date(result.model.dashboard.calendar.readStartedAt),undefined,liveTagQuellen));
   expect(JSON.stringify(result.model.dashboard)).toBe(JSON.stringify(original));
   const phases=output.mock.calls.filter(call=>call[0]==='[PAGE_READ_PHASE]').map(call=>JSON.parse(String(call[1])).phase);
   expect(phases).toContain('today.orders');expect(phases).not.toContain('today.model.read');expect(phases).not.toContain('today.refresh');
  }finally{output.mockRestore();}
 });
});

// Isolated derived-cache faults, not fabricated business source receipts.
it.each(['incomplete','tenant-epoch'] as const)('PL13:43 loads exactly the %s source live while qualified rows remain cached',async fault=>{
 const resolved=await withSession(full,()=>resolveAuthorization());if(!resolved.ok)throw Error('TEST_TARGETED_LIVE_AUTH');
 expect((await rebuildTodayModel(tenant)).code).toBe('OK');
 const now=new Date();
 const baseline=await withSession(full,()=>readModelForCurrentSession());
 expect(baseline.code).toBe('OK');if(baseline.code!=='OK')throw Error('TEST_TARGETED_MODEL_REQUIRED');
 const read=async()=>{const [source]=await sql`SELECT to_jsonb(source) AS row FROM private.today_source_v1 source WHERE tenant_id=${tenant} AND kind='quelle:eingang.nachrichten' AND source_id='*'`;if(!source)throw Error('TEST_TARGETED_MODEL_SOURCE');return source.row;};
 await withRestoredTestSource({label:'TEST complete targeted model source '+fault,read,restore:async original=>{
  const columns=Object.keys(original);if(columns.some(column=>!/^[a-z_][a-z0-9_]*$/.test(column)))throw Error('TEST_TARGETED_COLUMN');
  const names=columns.map(column=> '"'+column+'"').join(',');
  await sql`UPDATE private.today_source_v1 SET (${sql.unsafe(names)})=(SELECT ${sql.unsafe(names)} FROM jsonb_populate_record(NULL::private.today_source_v1,${sql.json(original)}::jsonb)) WHERE tenant_id=${tenant} AND kind='quelle:eingang.nachrichten' AND source_id='*'`;
 }},async()=>{
  if(fault==='incomplete')await sql`UPDATE private.today_source_v1 SET status='SOURCE_INCOMPLETE',payload=NULL,error_code='TEST_DERIVED_SOURCE_FAILURE' WHERE tenant_id=${tenant} AND kind='quelle:eingang.nachrichten' AND source_id='*'`;
  else await sql`UPDATE private.today_source_v1 SET built_tenant_seq=built_tenant_seq-1 WHERE tenant_id=${tenant} AND kind='quelle:eingang.nachrichten' AND source_id='*'`;
  const qualification=await withPrivilegedTenantTransaction(resolved.data,tx=>readTodayModelInTransaction(tx,resolved.data,readTodayCalendar(now).today));
  expect(qualification.rows.find(row=>row.kind==='quelle:eingang.nachrichten')).toMatchObject({fresh:false});
  const output=vi.spyOn(console,'info');
  try{
   const first=await withSession(full,()=>withPageReadBudget(()=>readModelForCurrentSession(true),DEFAULT_PAGE_READ_SETTINGS.queryTimeoutMs));
   expect(first.code).toBe('OK');if(first.code!=='OK')throw Error('TEST_FIRST_MODEL_REQUIRED');
   expect(first.pending).toBe(true);expect(first.dashboard.messageActions).toEqual(baseline.dashboard.messageActions);
   expect(output.mock.calls.filter(call=>call[0]==='[PAGE_READ_PHASE]').map(call=>JSON.parse(String(call[1])).phase)).toContain('today.graph');
   output.mockClear();
   const current=await withSession(full,()=>withPageReadBudget(()=>readModelForCurrentSession(),DEFAULT_PAGE_READ_SETTINGS.queryTimeoutMs));
   expect(current.code).toBe('OK');if(current.code!=='OK')throw Error('TEST_TARGETED_LIVE_RESULT');
   expect(withoutReadClock(current.dashboard)).toEqual(withoutReadClock(baseline.dashboard));
   expect(Date.parse(current.dashboard.calendar!.readStartedAt)).toBeGreaterThanOrEqual(Date.parse(baseline.dashboard.calendar!.readStartedAt));
   const phases=output.mock.calls.filter(call=>call[0]==='[PAGE_READ_PHASE]').map(call=>JSON.parse(String(call[1])).phase);
   expect(phases.filter(phase=>['today.orders','today.graph','today.support','today.complaints','today.followups','today.tasks','today.quotes','today.company','today.batch'].includes(phase))).toEqual(['today.graph']);
   expect(current.dashboard.orderActions).toEqual(baseline.dashboard.orderActions);
  }finally{output.mockRestore();}
 });
});

it('conditional real GET skips unchanged composition and reloads after an actual command sequence',async()=>{
 const order=await readyInvoiceOrder('TEST conditional source revision');
 expect((await rebuildTodayModel(tenant)).code).toBe('OK');
 await withSession(full,async()=>{
  const initial=await getModelRoute(new Request('http://127.0.0.1/api/heute/modell?nur=veraltet'));
  expect(initial.status).toBe(200);const value=await initial.json(),etag=initial.headers.get('etag');
  expect(etag).toMatch(/^"[a-f0-9]{64}"$/);expect(value.model.cacheLoginScope).toBeTruthy();
  const request=()=>new Request('http://127.0.0.1/api/heute/modell?nur=veraltet',{headers:{'If-None-Match':etag!,'X-Kreile-Login-Scope':value.model.cacheLoginScope}});
  const output=vi.spyOn(console,'info');
  try{
   const unchanged=await getModelRoute(request());expect(unchanged.status).toBe(304);expect(await unchanged.text()).toBe('');
   const phases=output.mock.calls.filter(call=>call[0]==='[PAGE_READ_PHASE]').map(call=>JSON.parse(String(call[1])).phase);
   expect(phases).toContain('today.model.read');expect(phases).not.toContain('today.model.compose');expect(phases).not.toContain('today.source');
  }finally{output.mockRestore();}
  const command={orderId:order.orderId,expectedVersion:order.version,dueDate:'2027-09-05',reason:'TEST conditional model actual source sequence',clientEventId:randomUUID()};
  expect((await changeOrderPromisedDueDateAction(command)).code).toBe('OK');
  const changed=await getModelRoute(request());expect(changed.status).toBe(200);expect(changed.headers.get('etag')).not.toBe(etag);
  const current=await changed.json();expect(current.model.modelRead.pending).toBe(true);
  const unchangedPending=await getModelRoute(new Request('http://127.0.0.1/api/heute/modell?nur=veraltet',{headers:{'If-None-Match':changed.headers.get('etag')!,'X-Kreile-Login-Scope':value.model.cacheLoginScope}}));
  expect(unchangedPending.status).toBe(304);expect(await unchangedPending.text()).toBe('');
  expect((await refreshTodayModel(tenant)).code).toBe('OK');
  const settled=await getModelRoute(request());expect(settled.status).toBe(200);
  expect((await settled.json()).model.dashboard.orderActions.rows.find((row:{orderId:string})=>row.orderId===order.orderId)).toMatchObject({version:order.version+1});
  expect(await changeOrderPromisedDueDateAction(JSON.parse(JSON.stringify(command)))).toMatchObject({code:'OK',replayed:true});
 });
});

// Own unmerged kernel cases consolidated, original bodies byte-identical.
const ports:TodayOrderReadPorts={
 readVat:readInvoiceVat,readSettings:readShippingSettingsInTransaction,
 readCredit:(tx,tenantId,customerId)=>readCustomerCreditInTransaction(tx,tenantId,customerId,readCustomerProfile),
 readShipments:(auth,ids,readSettings)=>readManualShippingBatch(auth,ids,{readSettings,readCustomer:readCustomerProfile,readCustomers:readCustomerProfiles,readAllocation:(tx,tenantId,customerId,input)=>readShippingMergeAllocation(tx,tenantId,customerId,input,readInvoiceVat)}),
};

it('applies the same price mask to captured real card facts and the current restricted reader without mutating the original',async()=>{
 const order=await readyInvoiceOrder('TEST shared price mask');
 const fullAuth=await withSession(full,()=>resolveAuthorization());if(!fullAuth.ok)throw Error('TEST_PRICE_MASK_FULL_AUTH');
 const [source]=await readTodayOrderSources(fullAuth.data,[order.orderId],ports);
 if(source.result.code!=='OK')throw Error('TEST_PRICE_MASK_SOURCE');
 const card=source.result.data.card,original=JSON.stringify(card);
 expect(card.items.some(item=>item.unitPriceCents!==null)).toBe(true);
 const reader=await createFixture(['auftraege'],'werkstatt');
 const actual=await withSession(reader,()=>resolveAuthorization());if(!actual.ok)throw Error('TEST_PRICE_MASK_READER_AUTH');
 const masked=maskTodayOrderCard(actual.data,card);
 expect(masked.items.every(item=>item.unitPriceCents===null&&item.vatRateBasisPoints===null&&item.extraWork.every(line=>line.hourlyRateCents===null&&line.amountCents===null))).toBe(true);
 if(masked.freeze)expect(masked.freeze).toMatchObject({hourlyRateCents:null,totalAmountCents:null});
 const [live]=await readTodayOrderSources(actual.data,[order.orderId],ports);
 if(live.result.code!=='OK')throw Error('TEST_PRICE_MASK_LIVE');
 expect(masked).toEqual(live.result.data.card);
 expect(maskTodayOrderCard(fullAuth.data,card)).toEqual(card);
 expect(JSON.stringify(card)).toBe(original);
});

it('keeps real payment and release evidence while masking credit for a price-only actor through the same reader gate',async()=>{
 const order=await readyInvoiceOrder('TEST shared payment credit mask');
 const fullAuth=await withSession(full,()=>resolveAuthorization());if(!fullAuth.ok)throw Error('TEST_CREDIT_MASK_FULL_AUTH');
 const [source]=await readTodayOrderSources(fullAuth.data,[order.orderId],ports);
 if(source.result.code!=='OK'||source.result.data.payment?.code!=='OK')throw Error('TEST_CREDIT_MASK_SOURCE');
 const payment=source.result.data.payment,original=JSON.stringify(payment);
 expect(payment.data.creditApplication).toBeDefined();
 const reader=await createFixture(['auftraege','preise']);
 const actual=await withSession(reader,()=>resolveAuthorization());if(!actual.ok)throw Error('TEST_CREDIT_MASK_READER_AUTH');
 const masked=maskOrderPaymentCredit(actual.data,payment);
 if(masked.code!=='OK')throw Error('TEST_CREDIT_MASK_RESULT');
 expect(masked.data).not.toHaveProperty('creditApplication');
 expect(masked.data.payment).toEqual(payment.data.payment);
 expect(masked.data.complaintHold).toEqual(payment.data.complaintHold);
 expect(masked.data.customerDeliveryBlock).toEqual(payment.data.customerDeliveryBlock);
 const [live]=await readTodayOrderSources(actual.data,[order.orderId],ports);
 if(live.result.code!=='OK')throw Error('TEST_CREDIT_MASK_LIVE');
 expect(masked).toEqual(live.result.data.payment);
 expect(maskOrderPaymentCredit(fullAuth.data,payment)).toEqual(payment);
 expect(JSON.stringify(payment)).toBe(original);
});

it.each([
 {label:'mails only',areas:['mails']},
 {label:'mails, prices and payments',areas:['mails','preise','zahlungen']},
])('week reads the actual aggregate without accounting rights and rejects the absent stock route ($label)',async({areas})=>{
 const actor=await createFixture(areas,'buero');
 await withSession(actor,async()=>{
  const {getProductionWeekAction}=await import('@/app/actions/orders.actions');
  const original=await getProductionWeekAction();if(original.code!=='OK')throw Error('TEST_PRODUCTION_WEEK_UNAVAILABLE');
  const week=await getModelRoute(new Request('http://127.0.0.1/api/heute/modell?nur=veraltet&bereich=week'));
  expect(week.status).toBe(200);const result=await week.json();
  expect(result.result).toEqual({code:'OK',part:'week',data:original.data});
  expect(Object.keys(result.result.data).sort()).toEqual(['currentlyUnpricedItemCount','netCents','weekEndExclusive','weekStart']);
  const stock=await getModelRoute(new Request('http://127.0.0.1/api/heute/modell?nur=veraltet&bereich=stock'));
  expect(stock.status).toBe(400);
 });
});

it('public model Action keeps the real session actor and never serializes private model sources',async()=>{
 const anonymous=await withRequest('',()=>readOfficeHomeModelAction());expect(anonymous).toMatchObject({kind:'denied'});expect(anonymous).not.toHaveProperty('dashboard');
 await withSession(full,async()=>{
  const rejected=await readOfficeHomeModelAction({deferLive:false,authorization:{tenantId:'TEST-forged',role:'admin'}} as unknown as {deferLive:boolean});
  expect(rejected).toMatchObject({kind:'error'});expect(rejected).not.toHaveProperty('dashboard');
  const actual=await readOfficeHomeModelAction();expect('dashboard'in actual).toBe(true);
  const revision=await readTodayHomeRevision();expect(revision?.revision).toMatch(/^[a-f0-9]{64}$/);
  const week=await readTodayHomePart('week');expect(week).toMatchObject({code:'OK',part:'week'});
  for(const key of ['sources','operationalSource','settings','authorization'])expect(actual).not.toHaveProperty(key);
 });
});


it('retains the known Today dashboard when a TEST cached order cannot form a complete Home projection',async()=>{
 await readyInvoiceOrder('TEST incomplete Home projection');
 expect((await rebuildTodayModel(tenant)).code).toBe('OK');
 const baseline=await withSession(full,()=>readOfficeHomeModelAction());
 if(!('dashboard'in baseline))throw Error('TEST_KNOWN_HOME_REQUIRED');
 const read=async()=>{const [row]=await sql`SELECT to_jsonb(source) AS row FROM private.today_source_v1 source WHERE tenant_id=${tenant} AND kind='quelle:orders.liste' AND source_id='*'`;if(!row||!Array.isArray(row.row.payload)||!row.row.payload.length)throw Error('TEST_FULL_ORDER_SOURCE_REQUIRED');return row.row;};
 await withRestoredTestSource({label:'TEST explicit malformed derived Home order, whole-row restoration',read,restore:async original=>{
  const columns=Object.keys(original);if(columns.some(column=>!/^[a-z_][a-z0-9_]*$/.test(column)))throw Error('TEST_MODEL_COLUMN_INVALID');
  const names=columns.map(column=>'"'+column+'"').join(',');
  await sql`UPDATE private.today_source_v1 SET (${sql.unsafe(names)})=(SELECT ${sql.unsafe(names)} FROM jsonb_populate_record(NULL::private.today_source_v1,${sql.json(original)}::jsonb)) WHERE tenant_id=${tenant} AND kind='quelle:orders.liste' AND source_id='*'`;
 }},async()=>{
  await sql`UPDATE private.today_source_v1 SET payload=jsonb_set(payload,'{0,dueDate}',to_jsonb(''::text)) WHERE tenant_id=${tenant} AND kind='quelle:orders.liste' AND source_id='*'`;
  const actual=await withSession(full,()=>readOfficeHomeModelAction());
  expect(actual.kind).toBe('partial');
  if(!('dashboard'in actual))throw Error('TEST_EXISTING_DASHBOARD_MUST_SURVIVE');
  expect(actual.projection).toBeNull();
  expect(actual.dashboard.items.map(item=>item.key)).toEqual(baseline.dashboard.items.map(item=>item.key));
  expect(actual.dashboard.datenluecken).toContain('ORDERS_HOME_PROJECTION_SOURCE');
 });
});

it('meldet den echten Takt ohne Sitzung bei Teilausfall als fehlgeschlagen und führt den nächsten Mandanten aus', async () => {
  const testTenant = `TEST-ablauf-01-cron-${randomUUID()}`;
  const blockedTenant = `TEST-ablauf-00-cron-${randomUUID()}`;
  const actor = randomUUID();
  const cronSecret = randomUUID();
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = cronSecret;
  const url = 'http://127.0.0.1/api/takt';
  const runs = () => sql`SELECT job_schluessel,status,versuch,beendet_um IS NOT NULL AS abgeschlossen
    FROM public.takt_job_runs WHERE tenant_id=${testTenant} AND job_schluessel='heute_neuaufbau'`;
  try {
    // Isolated TEST profile for the existing projection reader. No Auth session.
    await sql`INSERT INTO public.app_users (id,tenant_id,email,full_name,role,active)
      VALUES (${actor}::uuid,${testTenant},${`test-cron-${actor}@local.invalid`},'TEST Cron','developer',true)`;
    await sql`INSERT INTO private.today_tenant_v1 (tenant_id) VALUES (${testTenant}) ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO private.today_tenant_v1 (tenant_id,refresh_lease_until)
      VALUES (${blockedTenant},statement_timestamp()+interval '1 minute')`;
    expect((await taktGET(new Request(url))).status).toBe(401);
    expect(await runs()).toEqual([]);

    const tageslauf = new Date(readTodayCalendar(new Date()).today+'T12:00:00Z');
    vi.useFakeTimers({toFake:['Date']});
    try {
      vi.setSystemTime(tageslauf);
      const response = await taktGET(new Request(url, {headers: {Authorization: `Bearer ${cronSecret}`}}));
      expect(response.status).toBe(503);
    } finally {
      vi.useRealTimers();
    }
    expect(await sql`SELECT status,fehlercode FROM public.takt_job_runs
      WHERE tenant_id=${blockedTenant} AND job_schluessel='heute_neuaufbau'`)
      .toEqual([{status:'fehler',fehlercode:'takt_heute_besetzt'}]);
    expect(await runs()).toEqual([{job_schluessel:'heute_neuaufbau',status:'ok',versuch:1,abgeschlossen:true}]);
    expect(await sql`SELECT source_id FROM private.today_source_v1
      WHERE tenant_id=${testTenant} AND kind='quelle:orders.liste' AND built_at IS NOT NULL`).toEqual([{source_id:'*'}]);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
    await sql.begin(async tx => {
      await tx`DELETE FROM public.app_users WHERE id=${actor}::uuid AND tenant_id=${testTenant}`;
      await tx`DELETE FROM private.today_source_v1 WHERE tenant_id IN (${testTenant},${blockedTenant})`;
      await tx`DELETE FROM private.today_tenant_v1 WHERE tenant_id IN (${testTenant},${blockedTenant})`;
      await tx`DELETE FROM public.takt_job_runs WHERE tenant_id IN (${testTenant},${blockedTenant})`;
    });
  }
}, 60_000);

it('baut nach dem Tageslauf erneut auf und sperrt Doppelklick und konkurrierende Automatik', async () => {
  const bediener = await createFixture(['wartung'],'developer');
  // Der vorherige Cron-Aufruf kann den aktuellen Tag für diesen Betrieb bereits abgeschlossen haben.
  const zeit = new Date(readTodayCalendar(new Date()).today+'T12:00:00Z');
  zeit.setUTCDate(zeit.getUTCDate()+1);
  const tag = readTodayCalendar(zeit).today;
  const vorhandene = await sql<{id:string}[]>`SELECT id::text FROM public.takt_job_runs
    WHERE tenant_id=${tenant} AND job_schluessel='heute_neuaufbau'`;
  const vorhandeneIds = vorhandene.map(lauf => lauf.id);
  const manuell = () => withSession(bediener, () => rebuildGET(new Request('http://127.0.0.1/api/heute/neuaufbau')));
  const laeufe = () => sql<{faellig_fuer:string;status:string}[]>`SELECT faellig_fuer,status FROM public.takt_job_runs
    WHERE tenant_id=${tenant} AND job_schluessel='heute_neuaufbau'
      AND NOT (id::text = ANY(${vorhandeneIds}::text[])) ORDER BY gestartet_um,id`;
  const modellStand = async () => {
    const [row] = await sql<{seq:string}[]>`SELECT built_seq::text AS seq FROM private.today_source_v1
      WHERE tenant_id=${tenant} AND kind='quelle:orders.liste' AND source_id='*'`;
    if(!row) throw Error('TEST_HEUTE_MODELL_FEHLT');
    return BigInt(row.seq);
  };
  let erster:Promise<Response>|undefined;
  try {
    // Der Handlauf beginnt nach dem Tageslauf dieses TEST-Falls.
    await sql`DELETE FROM public.takt_job_runs WHERE tenant_id=${tenant} AND job_schluessel='heute_neuaufbau'`;
    await fuehreTaktAus({tenantId:tenant,jetzt:zeit});
    expect(await laeufe()).toEqual([{faellig_fuer:tag,status:'ok'}]);
    const vorher = await modellStand();

    await sql.begin(async tx => {
      await tx`SELECT tenant_id FROM private.today_tenant_v1 WHERE tenant_id=${tenant} FOR UPDATE`;
      erster = manuell();
      const bis = Date.now()+5_000;
      while (!(await laeufe()).some(lauf=>lauf.status==='läuft') && Date.now()<bis) {
        await new Promise(resolve=>setTimeout(resolve,25));
      }
      expect(await laeufe()).toEqual([{faellig_fuer:tag,status:'ok'}, {faellig_fuer:expect.stringMatching(/^hand:/),status:'läuft'}]);
      expect((await manuell()).status).toBe(409);
      const naechsterTag = new Date(zeit.getTime()+86_400_000);
      await fuehreTaktAus({tenantId:tenant,jetzt:naechsterTag});
      expect(await laeufe()).toHaveLength(2);
    });
    expect((await erster)?.status).toBe(204);
    expect(await modellStand()).toBeGreaterThan(vorher);

    const gleicheMinute = (await laeufe())[1].faellig_fuer;
    const resultat = await fuehreTaktAus({tenantId:tenant,nurJob:'heute_neuaufbau',jetzt:new Date(gleicheMinute.slice(5))});
    expect(resultat).toMatchObject({laeufe:1,restOffen:false});
    expect(await laeufe()).toEqual([
      {faellig_fuer:tag,status:'ok'},
      {faellig_fuer:gleicheMinute,status:'ok'},
      {faellig_fuer:gleicheMinute,status:'ok'},
    ]);
  } finally {
    await erster?.catch(()=>undefined);
    await sql`DELETE FROM public.takt_job_runs WHERE tenant_id=${tenant} AND job_schluessel='heute_neuaufbau'
      AND NOT (id::text = ANY(${vorhandeneIds}::text[]))`;
  }
},60_000);
