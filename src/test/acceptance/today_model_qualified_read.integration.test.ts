import {DEFAULT_PAGE_READ_SETTINGS,pageReadQueryObservation,withPageReadBudget} from '@/db/readBudget';
import {randomUUID} from 'node:crypto';
// @vitest-environment node
// Actual TEST Actions/Auth/DB/Storage; derived-cache faults are restored whole.
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,withRequest,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readTodayModelInTransaction} from '@/lib/server/todayDashboard';
import {readTodayCalendar} from '@/lib/today/todayDashboardPolicy';
import {rebuildTodayModel,refreshTodayModel} from '@/lib/server/todayProjection';
import {changeOrderPromisedDueDateAction} from '@/app/actions/orders.actions';
import {withRestoredTestSource} from '../fixtures/restoredTestSource';
import {readModelTodayHome} from '@/app/actions/todayModel.actions';
import {readTodayDashboard,collectTodaySources,composeTodayDashboard} from '@/lib/server/todayDashboard';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';
import {saveIntakeNoteAction,saveIntakeTaskAction,selectIntakeConcernAction,getIntakeTaskAction} from '@/app/actions/eingang.actions';
import {createQuoteAction,readQuoteDefaultsAction,changeQuoteLifecycleAction} from '@/app/actions/quotes.actions';
import {saveQuoteSettingsAction} from '@/app/actions/settings.actions';
import {reklamationAusfuehrenAction} from '@/app/actions/complaints.actions';
import {storeOrderPhoto} from '../../../e2e/ablauf/photoFixture';
import {APP_ROLES,normalizeAccessAreasForRole,type AccessArea} from '@/lib/auth/authorizationContract';
import {GET as getModelRoute} from '@/app/api/heute/modell/route';

const profiles=new Map<string,Awaited<ReturnType<typeof createFixture>>>();
const customProfiles:Array<{key:string;areas:AccessArea[]}>=[
 {key:'orders',areas:['auftraege']},{key:'orders-prices',areas:['auftraege','preise']},{key:'orders-payments',areas:['auftraege','zahlungen']},
 {key:'mails',areas:['mails']},{key:'mail-customer',areas:['mails','kunden']},{key:'mail-assignment',areas:['mails','kunden','eingang']},
 {key:'mail-money',areas:['mails','preise','zahlungen']},
];

it('qualifies the actual source snapshot and never returns an old payload after a command, version mismatch or code change',async()=>{
 const order=await readyInvoiceOrder('TEST qualified model source');
 const resolved=await withSession(full,()=>resolveAuthorization());if(!resolved.ok)throw Error('TEST_REAL_MODEL_AUTH_REQUIRED');
 const auth=resolved.data,today=readTodayCalendar(new Date()).today;
 const read=()=>withPrivilegedTenantTransaction(auth,tx=>readTodayModelInTransaction(tx,auth,today));
 const initial=await read();expect(initial.code).toBe('EMPTY');
 expect((await rebuildTodayModel(tenant)).code).toBe('OK');
 const warm=await read();expect(warm.code).toBe('OK');expect(warm.rows).toHaveLength(9);
 expect(warm.rows.every(row=>row.fresh===true&&row.payload!==null)).toBe(true);
 const input={orderId:order.orderId,expectedVersion:order.version,dueDate:'2027-08-04',reason:'TEST qualified model after actual command',clientEventId:globalThis.crypto.randomUUID()};
 const changed=await withSession(full,()=>changeOrderPromisedDueDateAction(input));expect(changed.code).toBe('OK');
 expect(await withSession(full,()=>changeOrderPromisedDueDateAction(JSON.parse(JSON.stringify(input))))).toEqual({...changed,replayed:true});
 const stale=(await read()).rows.find(row=>row.kind==='order'&&row.sourceId===order.orderId);
 expect(stale).toMatchObject({fresh:false,payload:null,sourceVersion:order.version,currentVersion:order.version+1});
 const saved=async()=>{const [source]=await sql`SELECT to_jsonb(source) AS row FROM private.today_source_v1 source WHERE tenant_id=${tenant} AND kind='order' AND source_id=${order.orderId}`;if(!source)throw Error('TEST_CACHE_SOURCE_REQUIRED');return source.row;};
 const restore=async(original:Awaited<ReturnType<typeof saved>>)=>{
  const columns=Object.keys(original);if(columns.some(column=>!/^[a-z_][a-z0-9_]*$/.test(column)))throw Error('TEST_MODEL_COLUMN_INVALID');
  const names=columns.map(column=>'"'+column+'"').join(',');
  await sql`UPDATE private.today_source_v1 SET (${sql.unsafe(names)})=(SELECT ${sql.unsafe(names)} FROM jsonb_populate_record(NULL::private.today_source_v1,${sql.json(original)}::jsonb)) WHERE tenant_id=${tenant} AND kind='order' AND source_id=${order.orderId}`;
 };
 await withRestoredTestSource({label:'TEST complete derived version source',read:saved,restore},async()=>{
  // Isolate the physical-order version join from the sequence guard. This is
  // explicitly a cache corruption probe, never a fabricated command receipt.
  await sql`UPDATE private.today_source_v1 SET built_seq=source_seq WHERE tenant_id=${tenant} AND kind='order' AND source_id=${order.orderId}`;
  expect((await read()).rows.find(row=>row.kind==='order'&&row.sourceId===order.orderId)).toMatchObject({fresh:false,payload:null});
 });
 expect((await refreshTodayModel(tenant)).code).toBe('OK');
 expect((await read()).rows.find(row=>row.kind==='order'&&row.sourceId===order.orderId)).toMatchObject({fresh:true,sourceVersion:order.version+1,currentVersion:order.version+1});
 await withRestoredTestSource({label:'TEST complete derived projector source',read:saved,restore},async()=>{
  await sql`UPDATE private.today_source_v1 SET projector_version=projector_version+1 WHERE tenant_id=${tenant} AND kind='order' AND source_id=${order.orderId}`;
  const wrongCode=await read();expect(wrongCode.needsRebuild).toBe(true);
  expect(wrongCode.rows.find(row=>row.kind==='order'&&row.sourceId===order.orderId)).toMatchObject({fresh:false,payload:null});
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
  expect(result.rows.find(row=>row.kind==='company')).toMatchObject({status:'SOURCE_INCOMPLETE',current:true,fresh:false,payload:{code:'VALIDATION_ERROR',missingFields:['street']}});
  expect(result.rows.filter(row=>row.kind==='order').every(row=>row.fresh===true&&row.payload!==null)).toBe(true);
 });
});

it('E-G1 first full real profile composes the same dashboard from qualified model and live sources',async()=>{
 const resolved=await withSession(full,()=>resolveAuthorization());if(!resolved.ok)throw Error('TEST_MODEL_COMPOSITION_AUTH_REQUIRED');
 const now=new Date();expect((await rebuildTodayModel(tenant)).code).toBe('OK');
 const modeled=await withSession(full,()=>readModelTodayHome(resolved.data,now));
 expect(modeled.code).toBe('OK');if(modeled.code!=='OK')throw Error('TEST_MODEL_COMPOSITION_REQUIRED');
 const live=await withSession(full,()=>readTodayDashboard(resolved.data,getComplaints,getQuoteFollowupsForTodayAction,now));
 expect({...modeled.dashboard,datenluecken:[...(modeled.dashboard.datenluecken??[])].sort()}).toEqual({...live,datenluecken:[...(live.datenluecken??[])].sort()});
 expect(modeled.pending).toBe(false);expect(modeled.incomplete).toBe(false);
});

it('E-G1 fills all eight productive source kinds and creates the real canonical role/rights profiles',async()=>{
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
 for(const role of APP_ROLES)profiles.set('role-'+role,await createFixture(normalizeAccessAreasForRole(role,[]),role));
 for(const profile of customProfiles)profiles.set(profile.key,await createFixture(profile.areas,'buero'));
 expect((await rebuildTodayModel(tenant)).code).toBe('OK');
 const sources=await sql`SELECT kind,status,payload FROM private.today_source_v1 WHERE tenant_id=${tenant} AND kind<>'order' ORDER BY kind`;
 expect(sources).toHaveLength(8);expect(sources.every(row=>row.status==='OK')).toBe(true);
 for(const row of sources)expect(row.payload).not.toBeNull();
});

it.each([...APP_ROLES.map(role=>'role-'+role),...customProfiles.map(profile=>profile.key)])('E-G1 keeps the full dashboard equal for actual profile %s',async key=>{
 const fixture=profiles.get(key);if(!fixture)throw Error('TEST_G1_PROFILE_NOT_CREATED_'+key);
 await withSession(fixture,async()=>{
  const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_G1_ACTUAL_PROFILE_AUTH');
  const now=new Date(),modeled=await readModelTodayHome(auth.data,now);
  expect(modeled.code).toBe('OK');if(modeled.code!=='OK')throw Error('TEST_G1_MODEL_REQUIRED');
  const live=await readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction,now);
  expect({...modeled.dashboard,datenluecken:[...(modeled.dashboard.datenluecken??[])].sort()}).toEqual({...live,datenluecken:[...(live.datenluecken??[])].sort()});
 });
});

// Existing own E-C snapshot case retained byte-for-byte in the same TEST cohort.
it('composes one captured real source snapshot without SQL, preserves it after a real command and retains known rows on a missing version source',async()=>{
 const order=await readyInvoiceOrder('TEST shared Today composition');
 const now=new Date();
 const {auth,sources}=await withSession(full,async()=>{
  const resolved=await resolveAuthorization();if(!resolved.ok)throw Error('TEST_ACTUAL_COMPOSITION_AUTH');
  return {auth:resolved.data,sources:await collectTodaySources(resolved.data,getComplaints,getQuoteFollowupsForTodayAction,now)};
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
 const current=await withSession(full,()=>readTodayDashboard(auth,getComplaints,getQuoteFollowupsForTodayAction,now));
 expect(current).toEqual(before);
 const command={orderId:order.orderId,expectedVersion:order.version,dueDate:'2027-07-21',reason:'TEST captured source remains unchanged',clientEventId:randomUUID()};
 const changed=await withSession(full,()=>changeOrderPromisedDueDateAction(command));
 expect(changed.code).toBe('OK');
 expect(await withSession(full,()=>changeOrderPromisedDueDateAction(JSON.parse(JSON.stringify(command))))).toEqual({...changed,replayed:true});
 expect(await compose()).toEqual(before);
 const after=await withSession(full,()=>readTodayDashboard(auth,getComplaints,getQuoteFollowupsForTodayAction,now));
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

it('actual GET recomputes a command-stale model and returns the freshly qualified version without another business effect',async()=>{
 const order=await readyInvoiceOrder('TEST native model GET');
 expect((await rebuildTodayModel(tenant)).code).toBe('OK');
 const input={orderId:order.orderId,expectedVersion:order.version,dueDate:'2027-08-05',reason:'TEST actual GET after source command',clientEventId:randomUUID()};
 const saved=await withSession(full,()=>changeOrderPromisedDueDateAction(input));expect(saved.code).toBe('OK');
 const response=await withSession(full,()=>getModelRoute(new Request('http://127.0.0.1/api/heute/modell?nur=veraltet')),true);
 expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('private, no-store');
 const result=await response.json();expect(result.code).toBe('OK');
 expect(result.model.modelRead).toMatchObject({source:'modell',pending:false});
 expect(result.model.dashboard.orderActions.rows.find((row:{orderId:string})=>row.orderId===order.orderId)?.version).toBe(order.version+1);
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
   const original=await withSession(full,()=>readTodayDashboard(resolved.data,getComplaints,getQuoteFollowupsForTodayAction,new Date(result.model.dashboard.calendar.readStartedAt)));
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
 const baseline=await withSession(full,()=>readModelTodayHome(resolved.data,now));
 expect(baseline.code).toBe('OK');if(baseline.code!=='OK')throw Error('TEST_TARGETED_MODEL_REQUIRED');
 const read=async()=>{const [source]=await sql`SELECT to_jsonb(source) AS row FROM private.today_source_v1 source WHERE tenant_id=${tenant} AND kind='messages' AND source_id='*'`;if(!source)throw Error('TEST_TARGETED_MODEL_SOURCE');return source.row;};
 await withRestoredTestSource({label:'TEST complete targeted model source '+fault,read,restore:async original=>{
  const columns=Object.keys(original);if(columns.some(column=>!/^[a-z_][a-z0-9_]*$/.test(column)))throw Error('TEST_TARGETED_COLUMN');
  const names=columns.map(column=> '"'+column+'"').join(',');
  await sql`UPDATE private.today_source_v1 SET (${sql.unsafe(names)})=(SELECT ${sql.unsafe(names)} FROM jsonb_populate_record(NULL::private.today_source_v1,${sql.json(original)}::jsonb)) WHERE tenant_id=${tenant} AND kind='messages' AND source_id='*'`;
 }},async()=>{
  if(fault==='incomplete')await sql`UPDATE private.today_source_v1 SET status='SOURCE_INCOMPLETE',payload=NULL,error_code='TEST_DERIVED_SOURCE_FAILURE' WHERE tenant_id=${tenant} AND kind='messages' AND source_id='*'`;
  else await sql`UPDATE private.today_source_v1 SET built_tenant_seq=built_tenant_seq-1 WHERE tenant_id=${tenant} AND kind='messages' AND source_id='*'`;
  const qualification=await withPrivilegedTenantTransaction(resolved.data,tx=>readTodayModelInTransaction(tx,resolved.data,readTodayCalendar(now).today));
  expect(qualification.rows.find(row=>row.kind==='messages')).toMatchObject({fresh:false});
  const output=vi.spyOn(console,'info');
  try{
   const current=await withSession(full,()=>withPageReadBudget(()=>readModelTodayHome(resolved.data,now),DEFAULT_PAGE_READ_SETTINGS.queryTimeoutMs));
   expect(current.code).toBe('OK');if(current.code!=='OK')throw Error('TEST_TARGETED_LIVE_RESULT');
   expect(current.dashboard).toEqual(baseline.dashboard);
   const phases=output.mock.calls.filter(call=>call[0]==='[PAGE_READ_PHASE]').map(call=>JSON.parse(String(call[1])).phase);
   expect(phases.filter(phase=>['today.orders','today.graph','today.support','today.complaints','today.followups','today.tasks','today.quotes','today.company','today.batch'].includes(phase))).toEqual(['today.graph']);
   expect(current.sources.batch).toEqual(baseline.sources.batch);
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
  const current=await changed.json();expect(current.model.dashboard.orderActions.rows.find((row:{orderId:string})=>row.orderId===order.orderId)).toMatchObject({version:order.version+1});
  expect(await changeOrderPromisedDueDateAction(JSON.parse(JSON.stringify(command)))).toMatchObject({code:'OK',replayed:true});
 });
});
