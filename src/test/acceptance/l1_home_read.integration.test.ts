// @vitest-environment node
// Only initial TEST actors/company data are synthetic; Actions/Auth/SQL are real.
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture,readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {saveCompanySettingsAction,readSettingsAction,readPageReadSettingsAction} from '@/app/actions/settings.actions';
import {readPageReadSettings} from '@/modules/fundament/server-public';
import {resolveAuthorization} from '@/lib/server/authorization';
import {loadOfficeHome} from '@/lib/server/officeHomeRead';
import {db} from '@/db';
import {pageReadSettingsFromCompany,DEFAULT_PAGE_READ_SETTINGS} from '@/lib/domain/pageReadSettings';
import {withRestoredTestSource} from '../fixtures/restoredTestSource';
import {SALES_STAGE_FEATURES} from '@/modules/fundament/public';
import {getLiveOrderCardAction,changeOrderContentAction,getTodayOrderReadAction} from '@/app/actions/orders.actions';
import {randomUUID} from 'node:crypto';
import {readTodayDashboard} from '@/lib/server/todayDashboard';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';
import {getOperationalOrders} from '@/lib/server/operationalOrders';
import {readTodayOrderCards} from '@/lib/server/orderCardRead';
import {readOrderEvidenceBatch,readEvidenceRecordsByTarget} from '@/lib/server/evidenceRead';

const DATABASE_URL=process.env.DATABASE_URL,EXPECTED_DATABASE_URL=process.env.H18_EXPECTED_DATABASE_URL;
if(!DATABASE_URL||DATABASE_URL!==EXPECTED_DATABASE_URL||new URL(DATABASE_URL).hostname!=='127.0.0.1')throw Error('TEST_L1_LOOPBACK_REPLAY_REQUIRED');

beforeAll(async()=>{
 // Explicit initial TEST tenant configuration uses the existing canonical defaults.
 for(const feature of SALES_STAGE_FEATURES)await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES(${tenant},${feature.id},${feature.defaultEnabled})`;
});

const companyInput={companyName:'TEST L1 Firma',street:'TEST Weg 1',zip:'70176',city:'Stuttgart',country:'Deutschland',taxId:'DE123456789',iban:'DE02120300000000202051',bic:'BYLADEM1001',bankName:'TEST Bank',paymentTermDays:14,logoUrl:'https://example.invalid/TEST.png',pageReads:{queryTimeoutMs:2000,invoiceMailBatchLimit:3}};

it('persists the configured query/batch limits through the existing command, receipt, rights and fresh read',async()=>{
 const input=companyInput;
 expect(await withSession(full,()=>saveCompanySettingsAction(input))).toMatchObject({code:'OK'});
 expect(await readPageReadSettings({tenantId:tenant})).toEqual(input.pageReads);
 expect(await withSession(full,()=>readPageReadSettingsAction())).toEqual({code:'OK',settings:input.pageReads});
 expect(await withSession(full,()=>readSettingsAction())).toMatchObject({code:'OK',snapshot:{company:{pageReads:input.pageReads}}});
 expect(await withSession(full,()=>saveCompanySettingsAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK'});
 const denied=await createFixture(['auftraege'],'werkstatt');
 expect(await withSession(denied,()=>saveCompanySettingsAction({...input,pageReads:{queryTimeoutMs:1,invoiceMailBatchLimit:1}}))).toMatchObject({code:'FORBIDDEN'});
 expect(await readPageReadSettings({tenantId:tenant})).toEqual(input.pageReads);
 expect(await withSession(full,()=>saveCompanySettingsAction({...input,pageReads:{queryTimeoutMs:0,invoiceMailBatchLimit:3}}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT payload->'pageReads' AS limits,payload->>'actorId' AS actor FROM public.ui_events WHERE tenant_id=${tenant} AND event_type='company_settings_updated' ORDER BY created_at,id`).toEqual(expect.arrayContaining([expect.objectContaining({limits:input.pageReads,actor:full.actorId})]));
});

it('applies the actual configured card-read deadline and rereads the same real card after restoring the setting',async()=>{
 const customerId=await customerFixture('TEST L1 Kartenfrist');
 const order=await intakeOrderFixture('TEST L1 Kartenquellen',customerId);
 const input={orderId:order.receipt.orderId};
 const before=await withSession(full,()=>getLiveOrderCardAction(input));
 expect(before.code).toBe('OK');
 const logger=vi.spyOn(console,'error');
 try{
  expect(await withSession(full,()=>saveCompanySettingsAction({...companyInput,pageReads:{...companyInput.pageReads,queryTimeoutMs:1}}))).toMatchObject({code:'OK'});
  const started=Date.now();
  expect(await withSession(full,()=>getLiveOrderCardAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'UNAVAILABLE'});
  expect(Date.now()-started).toBeLessThan(1000);
 }finally{
  logger.mockRestore();
  // A genuine second settings command restores this isolated TEST scenario;
  // no shared product row or immutable evidence is modified directly.
  expect(await withSession(full,()=>saveCompanySettingsAction(companyInput))).toMatchObject({code:'OK'});
 }
 expect(await withSession(full,()=>getLiveOrderCardAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',data:{card:{id:order.receipt.orderId,version:order.receipt.orderVersion}}});
});

it('uses one full-list SQL source for the actual home and Today while preserving source-bound actions on reread',async()=>{
 const customerId=await customerFixture('TEST L1 gemeinsame Quelle');
 const order=await intakeOrderFixture('TEST L1 ein Lesestand',customerId);
 const options=db.$client.options;
 const previous=options.debug;
 let listReads=0;
 options.debug=(_connection,statement)=>{if(statement.includes('AS due_date_text')&&statement.includes('FROM private.v_operational_station_queue_v1 queue'))listReads++;};
 try{
  const read=()=>withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_L1_AUTH');return loadOfficeHome(auth.data);});
  const first=await read();
  expect(first.kind).toBe('data');
  if(first.kind!=='data')throw Error('TEST_L1_HOME');
  expect(listReads).toBe(1);
  expect(first.projection.orders).toEqual(expect.arrayContaining([expect.objectContaining({id:order.receipt.orderId})]));
  expect(first.dashboard.orderActions?.rows).toEqual(expect.arrayContaining([expect.objectContaining({orderId:order.receipt.orderId,version:order.receipt.orderVersion})]));
  listReads=0;
  const again=await read();expect(again.kind).toBe('data');expect(listReads).toBe(1);
 }finally{options.debug=previous;}
});

it('projects the same canonical Today fields without claiming an unread release flag',async()=>{
 const sources=await withSession(full,async()=>{
  const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_L1_AUTH');
  return Promise.all([getOperationalOrders(auth.data),getOperationalOrders(auth.data,{purpose:'today'})]);
 });
 const display=(row:typeof sources[0][number])=>{const {ausgabeFrei,serverChangedAt,...fields}=row;void ausgabeFrei;void serverChangedAt;return fields;};
 expect(sources[1].map(display)).toEqual(sources[0].map(display));
 expect(sources[1].every(row=>!Object.hasOwn(row,'ausgabeFrei'))).toBe(true);
 expect(sources[0].every(row=>typeof row.ausgabeFrei==='boolean')).toBe(true);
});

it('retains known Today sources when an unreadable TEST order makes the full operational list unavailable',async()=>{
 const customerId=await customerFixture('TEST L1 Teilquelle');
 const order=await intakeOrderFixture('TEST L1 vorhandener Auftrag',customerId),id=order.receipt.orderId;
 const readRow=async()=>{const [row]=await sql`SELECT to_jsonb(orders) AS original FROM public.orders orders WHERE tenant_id=${tenant} AND id=${id}`;return row.original as Record<string,unknown>;};
 await withRestoredTestSource({label:'TEST L1 complete unreadable order row',read:readRow,restore:async original=>{
  const columns=Object.keys(original);if(columns.some(column=>!/^[a-z_][a-z0-9_]*$/.test(column)))throw Error('TEST_L1_COLUMNS');
  const names=sql.unsafe(columns.map(column=>'"'+column+'"').join(','));
  await sql`UPDATE public.orders SET (${names})=(SELECT ${names} FROM jsonb_populate_record(NULL::public.orders,${sql.json(original as never)}::jsonb)) WHERE tenant_id=${tenant} AND id=${id}`;
 }},async()=>{
  await sql`UPDATE public.orders SET title='' WHERE tenant_id=${tenant} AND id=${id}`;
  const result=await withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_L1_AUTH');return loadOfficeHome(auth.data);});
  expect(result.kind).toBe('partial');
  if(result.kind!=='partial')throw Error('TEST_L1_PARTIAL');
  expect(result.projection).toBeNull();
  expect(result.dashboard.datenluecken).toContain('ORDER_SOURCE');
  expect(result.dashboard.moneySources?.invoices).toMatchObject({code:'OK'});
 });
});


it('qualifies real company JSON before and after the additive schema, rejecting partial or invalid settings',async()=>{
 const [row]=await sql`SELECT to_jsonb(company) AS source FROM public.company_settings company WHERE tenant_id=${tenant}`;
 expect(row?.source).toBeDefined();
 const source=row.source as Record<string,unknown>;
 const project=(value:Record<string,unknown>)=>pageReadSettingsFromCompany({hasQueryTimeout:Object.hasOwn(value,'seiten_abfrage_ms'),hasInvoiceBatchLimit:Object.hasOwn(value,'rechnung_mail_grenze'),queryTimeoutMs:value.seiten_abfrage_ms,invoiceMailBatchLimit:value.rechnung_mail_grenze});
 expect(project(source)).toEqual({settings:companyInput.pageReads,schemaReady:true});
 // Only an explicitly labelled synthetic old-schema projection omits both
 // new keys; no live column, row, migration or evidence is changed.
 const oldSchemaProjection={...source};delete oldSchemaProjection.seiten_abfrage_ms;delete oldSchemaProjection.rechnung_mail_grenze;
 expect(project(oldSchemaProjection)).toEqual({settings:DEFAULT_PAGE_READ_SETTINGS,schemaReady:false});
 expect(project({...oldSchemaProjection,seiten_abfrage_ms:2000})).toBeNull();
 expect(project({...source,seiten_abfrage_ms:null})).toBeNull();
 expect(project({...source,rechnung_mail_grenze:0})).toBeNull();
 expect(await withSession(full,()=>readSettingsAction())).toMatchObject({code:'OK',snapshot:{company:{pageReadsSchemaReady:true,pageReads:companyInput.pageReads}}});
});


it('batches actual Today facts once and keeps the same qualified full-card values, version and evidence for zero, one and several orders',async()=>{
 const customer=await customerFixture('TEST L1 batch customer');
 const first=await intakeOrderFixture('TEST L1 batch intake',customer);
 const ready=await readyInvoiceOrder('TEST L1 batch ready','pickup',false,customer);
 const ids=[first.receipt.orderId,ready.orderId];
 const authorization=await withSession(full,()=>resolveAuthorization());if(!authorization.ok)throw Error('TEST_L1_BATCH_AUTH');
 expect(await readTodayOrderCards(authorization.data,[])).toEqual(new Map());
 expect(await withSession(full,()=>getTodayOrderReadAction({orderIds:[]}))).toEqual({code:'OK',data:{rows:[]}});
 const options=db.$client.options,previous=options.debug;let batchQueries=0;
 options.debug=(_connection,statement)=>{if(statement.includes('WITH selected AS MATERIALIZED')&&statement.includes("'queue' AS kind"))batchQueries++;};
 let cards:Awaited<ReturnType<typeof readTodayOrderCards>>;
 try{cards=await readTodayOrderCards(authorization.data,ids);expect(batchQueries).toBe(1);}finally{options.debug=previous;}
 const evidence=await readOrderEvidenceBatch(authorization.data,ids);
 for(const id of ids){
  const ordinary=await withSession(full,()=>getLiveOrderCardAction({orderId:id}));
  const actual=cards.get(id);expect(ordinary.code).toBe('OK');expect(actual?.code).toBe('OK');
  if(ordinary.code!=='OK'||actual?.code!=='OK')throw Error('TEST_L1_BATCH_SOURCE');
  const keys=['id','version','orderNumber','customerId','customerName','title','station','dueAt','handoverMode','items','freeze','operationalFacts'] as const;
  expect(Object.fromEntries(keys.map(key=>[key,actual.data[key]]))).toEqual(Object.fromEntries(keys.map(key=>[key,ordinary.data.card[key]])));
  expect(evidence.get(id)).toEqual(await readEvidenceRecordsByTarget(authorization.data,{targetType:'ORDER',targetId:id}));
 }
 expect(await readTodayOrderCards(authorization.data,[ids[0]])).toEqual(new Map([[ids[0],cards.get(ids[0])]]));
 const denied=await createFixture(['kunden'],'werkstatt');
 const noOrders=await withSession(denied,()=>resolveAuthorization());if(!noOrders.ok)throw Error('TEST_L1_BATCH_DENIED');
 expect([...await readTodayOrderCards(noOrders.data,ids)].every(([,result])=>result.code==='FORBIDDEN')).toBe(true);
 const fresh=await withSession(full,async()=>loadOfficeHome(authorization.data));
 expect(fresh.kind).toBe('data');
 if(fresh.kind!=='data')throw Error('TEST_L1_BATCH_HOME');
 for(const id of ids){const card=await withSession(full,()=>getLiveOrderCardAction({orderId:id}));if(card.code!=='OK')throw Error('TEST_L1_BATCH_CARD');expect(fresh.dashboard.orderActions?.rows.find(row=>row.orderId===id)?.read).toEqual(card.data.nextActionRule);}
 const oldList=await getOperationalOrders(authorization.data,{purpose:'today'});
 const changed=await withSession(full,()=>changeOrderContentAction({orderId:ids[0],expectedVersion:first.receipt.orderVersion,clientEventId:randomUUID(),note:'TEST L1 actual changed content',items:[{id:first.receipt.items[0].id,catalogServiceId:null,name:'TEST L1 updated item',quantity:1,material:'Messing',surface:'Verchromen',unit:'Stück',unitPriceCents:10000,vatRateBasisPoints:1900}]}));
 expect(changed).toMatchObject({code:'OK'});
 const stale=await withSession(full,()=>readTodayDashboard(authorization.data,getComplaints,getQuoteFollowupsForTodayAction,new Date(),Promise.resolve(oldList)));
 expect(stale.orderActions?.missingOrderIds).toContain(ids[0]);
 const readRow=async()=>{const [row]=await sql`SELECT to_jsonb(orders) AS original FROM public.orders orders WHERE tenant_id=${tenant} AND id=${ids[0]}`;return row.original as Record<string,unknown>;};
 await withRestoredTestSource({label:'TEST L1 qualified batch content row',read:readRow,restore:async original=>{
  const columns=Object.keys(original);if(columns.some(column=>!/^[a-z_][a-z0-9_]*$/.test(column)))throw Error('TEST_L1_BATCH_COLUMNS');
  const names=sql.unsafe(columns.map(column=>'"'+column+'"').join(','));
  await sql`UPDATE public.orders SET (${names})=(SELECT ${names} FROM jsonb_populate_record(NULL::public.orders,${sql.json(original as never)}::jsonb)) WHERE tenant_id=${tenant} AND id=${ids[0]}`;
 }},async()=>{
  await sql`UPDATE public.orders SET task='TEST L1 deliberately corrupted current note' WHERE tenant_id=${tenant} AND id=${ids[0]}`;
  const broken=await readTodayOrderCards(authorization.data,ids);
  expect(broken.get(ids[0])?.code).toBe('UNAVAILABLE');
  expect(broken.get(ids[1])?.code).toBe('OK');
  expect(await withSession(full,()=>getLiveOrderCardAction({orderId:ids[0]}))).toMatchObject({code:'UNAVAILABLE'});
 });
 expect((await readTodayOrderCards(authorization.data,ids)).get(ids[0])?.code).toBe('OK');
});
