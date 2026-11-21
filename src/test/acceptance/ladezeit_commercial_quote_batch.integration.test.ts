// @vitest-environment node
// Real KV/goods/order Actions/Auth/DB/Storage; only the labelled ambiguous event is synthetic TEST damage.
import {expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {full,sql,withSession} from '../../../e2e/ablauf/replayHarness';
import {runQuoteQuantityCase} from '../../../e2e/ablauf/quoteQuantityCase';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readOrderCommercialQuote,readOrderCommercialQuotes,type OrderCommercialQuote} from '@/lib/server/orderQuoteReadPort';
import {getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {readTodayOrderCards} from '@/lib/server/orderCardRead';
import {db} from '@/db';
import {customerFixture,intakeOrderFixture,readyOrderForInvoice,manualTrackingFixture} from '../../../e2e/ablauf/orderFixture';
import {getTodayOrderReadAction} from '@/app/actions/orders.actions';
import * as shippingPorts from '@/modules/orders/server-public';
import {sql as nativeSql} from 'drizzle-orm';

const url=process.env.DATABASE_URL;
const testPort=process.env.GITHUB_ACTIONS==='true'?'54322':'54342';
if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1'||new URL(url).port!==testPort)throw Error('TEST_OWN_LOOPBACK_REQUIRED');

it('reads zero/one/many immutable full and partial awards in two SQL statements, with per-order ambiguous VAT isolation',async()=>{
 const sources:Array<{orderId:string;quoteId:string;quote:OrderCommercialQuote}>=[];
 for(const spec of [
  {name:'TEST Ladezeit full award',quantity:10,received:10,total:4000,expected:4000,hours:null},
  {name:'TEST Ladezeit partial award',quantity:10,received:5,total:6000,expected:3000,hours:null},
 ])await runQuoteQuantityCase({...spec,operational:true,fixed:0,inspect:async source=>{
  const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_QUOTE_AUTH');
  const quote=await withPrivilegedTenantTransaction(auth.data,tx=>readOrderCommercialQuote(tx,tenant,source.orderId));
  sources.push({orderId:source.orderId,quoteId:source.quoteId,quote});
 }});
 expect(sources).toHaveLength(2);
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_QUOTE_AUTH');
 const read=(ids:string[])=>withPrivilegedTenantTransaction(auth.data,tx=>readOrderCommercialQuotes(tx,tenant,ids));
 const options=db.$client.options,previous=options.debug;let quoteQueries=0,vatQueries=0;
 options.debug=(connection,text,parameters,types)=>{
  if(typeof previous==='function')previous(connection,text,parameters,types);
  if(text.includes('private.quote_conversion_receipts'))quoteQueries++;
  if(text.includes("event_type='QUOTE_VAT_FROM_COMPANY_V1'"))vatQueries++;
 };
 try{
  expect(await read([])).toEqual(new Map());expect([quoteQueries,vatQueries]).toEqual([0,0]);
  const batch=await read([sources[0].orderId,sources[1].orderId,sources[0].orderId]);
  expect([quoteQueries,vatQueries]).toEqual([1,1]);
  expect(batch).toEqual(new Map(sources.map(source=>[source.orderId,source.quote])));
  expect(batch.get(sources[0].orderId)).toMatchObject({totalNetCents:4000,vatRateBasisPoints:1900,positions:[{quantity:10,lineTotalCents:4000}]});
  expect(batch.get(sources[1].orderId)).toMatchObject({totalNetCents:3000,vatRateBasisPoints:1900,positions:[{quantity:5,lineTotalCents:3000}]});
 }finally{options.debug=previous;}
 expect(await read([sources[0].orderId])).toEqual(new Map([[sources[0].orderId,sources[0].quote]]));
 // No original is rewritten: append conflicting, explicitly synthetic TEST evidence only.
 for(const rate of [700,1900])await sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,payload,status,client_event_id,event_schema_version,created_at)
  VALUES(${randomUUID()},${tenant},${sources[0].orderId},'QUOTE_VAT_FROM_COMPANY_V1','TEST synthetic ambiguous VAT source',${full.actorId}::uuid,${sql.json({quoteId:sources[0].quoteId,edition:2,vatRateBasisPoints:rate})},'success',${randomUUID()}::uuid,1,statement_timestamp())`;
 const before=await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${tenant}`;
 const damaged=await read(sources.map(source=>source.orderId));
 expect(damaged.get(sources[0].orderId)).toMatchObject({message:'QUOTE_VAT_SOURCE_AMBIGUOUS'});
 expect(damaged.get(sources[0].orderId)).toBeInstanceOf(Error);
 expect(damaged.get(sources[1].orderId)).toEqual(sources[1].quote);
 const affected=await withSession(full,()=>getLiveOrderCardAction({orderId:sources[0].orderId}));
 expect(affected).toMatchObject({code:'OK',data:{card:{operationalFacts:{pricesMissing:null}}}});
 const healthy=await withSession(full,()=>getLiveOrderCardAction({orderId:sources[1].orderId}));
 expect(healthy).toMatchObject({code:'OK',data:{card:{commercialQuote:sources[1].quote,operationalFacts:{pricesMissing:false}}}});
 const cards=await readTodayOrderCards(auth.data,sources.map(source=>source.orderId));
 expect(cards.get(sources[0].orderId)).toMatchObject({code:'OK',data:{operationalFacts:{pricesMissing:null}}});
 expect(cards.get(sources[1].orderId)).toMatchObject({code:'OK',data:{operationalFacts:{pricesMissing:false}}});
 expect((await read(JSON.parse(JSON.stringify(sources.map(source=>source.orderId))))).get(sources[1].orderId)).toEqual(sources[1].quote);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${tenant}`).toEqual(before);
});

it('C9 keeps thirteen of fifteen real Today orders unchanged beside an ambiguous KV and a native shipping SQL fault',async()=>{
 const quotes:Array<{orderId:string;quoteId:string}>=[];
 await runQuoteQuantityCase({name:'TEST C9 damaged KV',quantity:1,received:1,total:1000,expected:1000,hours:null,fixed:0,operational:true,inspect:async source=>{quotes.push({orderId:source.orderId,quoteId:source.quoteId});}});
 const customerId=await customerFixture('TEST C9 unaffected orders');
 const healthy:string[]=[];
 for(let index=0;index<13;index++)healthy.push((await intakeOrderFixture('TEST C9 healthy '+index,customerId)).receipt.orderId);
 const shipping=await readyOrderForInvoice('TEST C9 shipping SQL','shipping');
 await manualTrackingFixture(shipping.orderId);
 const bad=quotes[0];if(!bad)throw Error('TEST_C9_REAL_QUOTE_REQUIRED');
 const ids=[bad.orderId,shipping.orderId,...healthy];expect(ids).toHaveLength(15);
 const baseline=await withSession(full,()=>getTodayOrderReadAction({orderIds:ids}));
 expect(baseline).toMatchObject({code:'OK'});if(baseline.code!=='OK')throw Error('TEST_C9_BASELINE_REQUIRED');
 expect(baseline.data.rows.every(row=>row.result.code==='OK')).toBe(true);
 // Explicit append-only synthetic ambiguity in this file's isolated TEST tenant.
 for(const rate of [700,1900])await sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,payload,status,client_event_id,event_schema_version,created_at)
  VALUES(${randomUUID()},${tenant},${bad.orderId},'QUOTE_VAT_FROM_COMPANY_V1','TEST C9 ambiguous KV',${full.actorId}::uuid,${sql.json({quoteId:bad.quoteId,edition:2,vatRateBasisPoints:rate})},'success',${randomUUID()}::uuid,1,statement_timestamp())`;
 const before=await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${tenant}`;
 const original=shippingPorts.readManualShippingBatch;
 const fault=vi.spyOn(shippingPorts,'readManualShippingBatch').mockImplementation((auth,orderIds,ports)=>original(auth,orderIds,{...ports,readCustomers:async(tx,tenantId,customerIds)=>{
  const result=await ports.readCustomers(tx,tenantId,customerIds);
  if(orderIds.includes(shipping.orderId))await tx.execute(nativeSql`SELECT 1/0 AS test_c9_shipping_source_failure`);
  return result;
 }}));
 try{
  const partial=await withSession(full,()=>getTodayOrderReadAction(JSON.parse(JSON.stringify({orderIds:ids}))));
  expect(partial).toMatchObject({code:'OK'});if(partial.code!=='OK')throw Error('TEST_C9_PARTIAL_REQUIRED');
  for(const id of healthy)expect(partial.data.rows.find(row=>row.orderId===id)).toEqual(baseline.data.rows.find(row=>row.orderId===id));
  expect(partial.data.rows.find(row=>row.orderId===bad.orderId)).toMatchObject({result:{code:'OK',data:{card:{operationalFacts:{pricesMissing:null}}}}});
  const shippingRow=partial.data.rows.find(row=>row.orderId===shipping.orderId);
  expect(shippingRow?.result).toMatchObject({code:'OK'});if(shippingRow?.result.code!=='OK')throw Error('TEST_C9_SHIPPING_CARD_RETAINED');
  expect(shippingRow.result.data.nextActionRule.datenluecken).toContain('labelReady');
 }finally{fault.mockRestore();}
 const recovered=await withSession(full,()=>getTodayOrderReadAction({orderIds:ids}));
 expect(recovered).toMatchObject({code:'OK'});if(recovered.code!=='OK')throw Error('TEST_C9_RECOVERED_REQUIRED');
 expect(recovered.data.rows.find(row=>row.orderId===shipping.orderId)).toEqual(baseline.data.rows.find(row=>row.orderId===shipping.orderId));
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${tenant}`).toEqual(before);
});
