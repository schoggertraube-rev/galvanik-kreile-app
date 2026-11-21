// @vitest-environment node
// Fixed TEST worker for L1 qualified-source checks. Original case bodies and
// assertions stay unchanged; unrelated corrupt fixtures/settings live elsewhere.
import {customerFixture,intakeOrderFixture,readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {createFixture,full,sql,withSession} from '../../../e2e/ablauf/replayHarness';
import {withRestoredTestSource} from '../fixtures/restoredTestSource';
import {getComplaints} from '@/app/actions/complaints.actions';
import {changeOrderContentAction,getLiveOrderCardAction,getTodayOrderReadAction} from '@/app/actions/orders.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';
import {saveCompanySettingsAction} from '@/app/actions/settings.actions';
import {db} from '@/db';
import {DEFAULT_PAGE_READ_SETTINGS,withPageReadBudget} from '@/db/readBudget';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readEvidenceRecordsByTarget,readOrderEvidenceBatch} from '@/lib/server/evidenceRead';
import {loadOfficeHome} from '@/lib/server/officeHomeRead';
import {getOperationalOrders} from '@/lib/server/operationalOrders';
import {readTodayOrderCards} from '@/lib/server/orderCardRead';
import {readTodayDashboard} from '@/lib/server/todayDashboard';
import {SALES_STAGE_FEATURES} from '@/modules/fundament/public';
import {sql as drizzleSql} from 'drizzle-orm';
import {randomUUID} from 'node:crypto';
import {beforeAll,describe,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
describe('L1 fixed qualified-source worker',()=>{
const DATABASE_URL=process.env.DATABASE_URL,EXPECTED_DATABASE_URL=process.env.H18_EXPECTED_DATABASE_URL;
if(!DATABASE_URL||DATABASE_URL!==EXPECTED_DATABASE_URL||new URL(DATABASE_URL).hostname!=='127.0.0.1')throw Error('TEST_L1_LOOPBACK_REPLAY_REQUIRED');
const companyInput={companyName:'TEST L1 Firma',street:'TEST Weg 1',zip:'70176',city:'Stuttgart',country:'Deutschland',taxId:'DE123456789',iban:'DE02120300000000202051',bic:'BYLADEM1001',bankName:'TEST Bank',paymentTermDays:14,logoUrl:'https://example.invalid/TEST.png',pageReads:{queryTimeoutMs:2000,invoiceMailBatchLimit:3}};
beforeAll(async()=>{
 for(const feature of SALES_STAGE_FEATURES)await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES(${tenant},${feature.id},${feature.defaultEnabled})`;
 expect(await withSession(full,()=>saveCompanySettingsAction({...companyInput,pageReads:{queryTimeoutMs:DEFAULT_PAGE_READ_SETTINGS.queryTimeoutMs,invoiceMailBatchLimit:DEFAULT_PAGE_READ_SETTINGS.invoiceMailBatchLimit}}))).toMatchObject({code:'OK'});
});
it('batches actual Today facts once and keeps the same qualified full-card values, version and evidence for zero, one and several orders',async()=>{
 const customer=await customerFixture('TEST L1 batch customer');
 const first=await intakeOrderFixture('TEST L1 batch intake',customer);
 const ready=await readyInvoiceOrder('TEST L1 batch ready','pickup',false,customer);
 const ids=[first.receipt.orderId,ready.orderId];
 const authorization=await withSession(full,()=>resolveAuthorization());if(!authorization.ok)throw Error('TEST_L1_BATCH_AUTH');
 expect(await readTodayOrderCards(authorization.data,[])).toEqual(new Map());
 expect(await withSession(full,()=>getTodayOrderReadAction({orderIds:[]}))).toEqual({code:'OK',data:{rows:[]}});
 const options=db.$client.options,previous=options.debug;let batchQueries=0,transactions=0;
 options.debug=(_connection,statement)=>{if(statement.includes('WITH selected AS MATERIALIZED')&&statement.includes("'queue' AS kind"))batchQueries++;if(statement.trim().toLowerCase()==='begin')transactions++;};
 let cards:Awaited<ReturnType<typeof readTodayOrderCards>>;
 try{cards=await readTodayOrderCards(authorization.data,ids);expect(batchQueries).toBe(1);expect(transactions).toBe(2);}finally{options.debug=previous;}
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
  const start=Date.now();const home=await withSession(full,()=>loadOfficeHome(authorization.data));
  expect(Date.now()-start).toBeLessThan(3000);expect(home.kind).toBe('data');
  if(home.kind!=='data')throw Error('TEST_BETRIEB_PARTIAL_SOURCE');
  expect(home.dashboard.items.find(item=>item.key==='source-order:'+ids[0])).toMatchObject({orderId:ids[0],primaryActionLabel:'Auftrag öffnen'});

  expect(await withSession(full,()=>getLiveOrderCardAction({orderId:ids[0]}))).toMatchObject({code:'UNAVAILABLE'});
 });
 expect((await readTodayOrderCards(authorization.data,ids)).get(ids[0])?.code).toBe('OK');
});

it('B1 isolates a genuine unknown-unit SQL exception from two healthy Today orders',async()=>{
 expect(await withSession(full,()=>saveCompanySettingsAction({...companyInput,pageReads:{queryTimeoutMs:DEFAULT_PAGE_READ_SETTINGS.queryTimeoutMs,invoiceMailBatchLimit:DEFAULT_PAGE_READ_SETTINGS.invoiceMailBatchLimit}}))).toMatchObject({code:'OK'});
 const customer=await customerFixture('TEST B1 SQL damaged source');
 const fixtures=await Promise.all(['damaged','healthy one','healthy two'].map(name=>intakeOrderFixture('TEST B1 '+name,customer)));
 const sourceId=fixtures[0].receipt.orderId,bad=randomUUID(),newItem=randomUUID();
 const ids=[bad,...fixtures.slice(1).map(value=>value.receipt.orderId)];
 // An explicitly synthetic, append-only TEST original models the historical
 // bad value. Existing immutable originals, triggers and grants stay intact.
 const eventId=randomUUID(),requestId=randomUUID();
 await sql.begin(async seed=>{
  await seed`INSERT INTO public.orders SELECT (jsonb_populate_record(NULL::public.orders,to_jsonb(source.*)||jsonb_build_object('id',${bad}::text,'order_number',regexp_replace(source.order_number,'^A-[0-9]{4}-','A-1900-'),'print_symbol_slot',NULL,'print_symbol_generation',NULL,'print_symbol_active',false))).* FROM public.orders source WHERE tenant_id=${tenant} AND id=${sourceId}`;
  await seed`INSERT INTO public.items SELECT (jsonb_populate_record(NULL::public.items,to_jsonb(source.*)||jsonb_build_object('id',${newItem}::text,'order_id',${bad}::text))).* FROM public.items source WHERE tenant_id=${tenant} AND order_id=${sourceId}`;
  await seed`INSERT INTO public.events SELECT (jsonb_populate_record(NULL::public.events,replace(replace(to_jsonb(event)::text,${sourceId},${bad}),receipt.order_number,regexp_replace(receipt.order_number,'^A-[0-9]{4}-','A-1900-'))::jsonb||jsonb_build_object('id',${eventId}::text,'client_event_id',${requestId}::text,'correlation_id',${requestId}::text))).* FROM public.events event JOIN private.order_intake_receipts receipt ON receipt.event_id=event.id WHERE receipt.tenant_id=${tenant} AND receipt.order_id=${sourceId}`;
  await seed`INSERT INTO private.order_intake_receipts SELECT (jsonb_populate_record(NULL::private.order_intake_receipts,to_jsonb(receipt)||jsonb_build_object('id',${randomUUID()}::text,'order_id',${bad}::text,'order_number',regexp_replace(receipt.order_number,'^A-[0-9]{4}-','A-1900-'),'event_id',${eventId}::text,'client_event_id',${requestId}::text,'correlation_id',${requestId}::text,'items_snapshot',jsonb_set(jsonb_set(receipt.items_snapshot,'{0,id}',to_jsonb(${newItem}::text)),'{0,unit}','"TEST_unbekannte_Einheit"'::jsonb)))).* FROM private.order_intake_receipts receipt WHERE receipt.tenant_id=${tenant} AND receipt.order_id=${sourceId}`;
 });
 await expect(sql.begin(async probe=>{await probe`SELECT set_config('app.tenant_id',${tenant},true)`;return probe`SELECT integrity_ok FROM private.v_order_intake_receipts_v1 WHERE tenant_id=${tenant} AND order_id=${bad}`;})).rejects.toMatchObject({code:'22023'});
 const authorization=await withSession(full,()=>resolveAuthorization());if(!authorization.ok)throw Error('TEST_B1_AUTH');
 const cards=await readTodayOrderCards(authorization.data,ids);
 expect(cards.get(bad)?.code).toBe('UNAVAILABLE');
 for(const id of ids.slice(1))expect(cards.get(id)?.code).toBe('OK');
 // Real capacity pressure: reserve all but one existing data connection.
 // No pool setting, provider, SQL guard or authorization is replaced.
 const count=db.$client.options.max-1;let release=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
 const entered:Array<()=>void>=[],ready=Array.from({length:count},()=>new Promise<void>(resolve=>entered.push(resolve)));
 const held=Array.from({length:count},(_,index)=>db.transaction(async tx=>{await tx.execute(drizzleSql`SELECT 1`);entered[index]();await gate;}));
 try{
  await Promise.all(ready);
  const constrained=await withPageReadBudget(()=>readTodayOrderCards(authorization.data,ids),3000);
  expect(constrained.get(bad)?.code).toBe('UNAVAILABLE');
  for(const id of ids.slice(1))expect(constrained.get(id)?.code).toBe('OK');
 }finally{release();await Promise.all(held);}
 const started=Date.now(),home=await withSession(full,()=>loadOfficeHome(authorization.data));
 expect(Date.now()-started).toBeLessThan(3000);expect(home.kind).toBe('data');if(home.kind!=='data')throw Error('TEST_B1_HOME');
 expect(home.dashboard.items.filter(item=>item.key==='source-order:'+bad)).toHaveLength(1);
 expect(home.dashboard.items.find(item=>item.key==='source-order:'+bad)).toMatchObject({field:'action',kind:'order',orderId:bad,orderVersion:fixtures[0].receipt.orderVersion,primaryActionLabel:'Auftrag öffnen'});
 for(const id of ids.slice(1))expect(home.dashboard.orderActions?.rows.some(row=>row.orderId===id)).toBe(true);
});

it('M6 rolls back a real complaint SQL failure before splitting and preserves the other qualified card',async()=>{
 const customer=await customerFixture('TEST M6 complaint SQL isolation');
 const a=await intakeOrderFixture('TEST M6 complaint failure',customer),b=await intakeOrderFixture('TEST M6 healthy complaint source',customer);
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_M6_REAL_AUTH');
 const ids=[a.receipt.orderId,b.receipt.orderId],before=await readTodayOrderCards(auth.data,ids);
 expect([...before.values()].every(value=>value.code==='OK')).toBe(true);
 const release=await import('@/lib/server/orderReleaseRead'),original=release.readOpenOrderComplaintsBatch;
 const reads:string[][]=[];
 const fault=vi.spyOn(release,'readOpenOrderComplaintsBatch').mockImplementation(async(tx,tenantId,orderIds)=>{
  const result=await original(tx,tenantId,orderIds);reads.push([...orderIds]);
  // Explicit synthetic failure only: canonical source rows and native PostgreSQL remain real.
  if(orderIds.includes(a.receipt.orderId))await tx.execute(drizzleSql`SELECT 1 / 0 AS test_m6_complaint_failure`);
  return result;
 });
 try{
  const partial=await readTodayOrderCards(auth.data,ids);
  expect(partial.get(a.receipt.orderId)).toMatchObject({code:'UNAVAILABLE'});
  expect(partial.get(b.receipt.orderId)).toEqual(before.get(b.receipt.orderId));
  expect(reads).toEqual([ids,[ids[0]],[ids[1]]]);
 }finally{fault.mockRestore();}
 expect(await readTodayOrderCards(auth.data,JSON.parse(JSON.stringify(ids)))).toEqual(before);
});
});
