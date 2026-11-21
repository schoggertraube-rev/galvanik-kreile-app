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
import {db} from '@/db';

const url=process.env.DATABASE_URL;
if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1'||new URL(url).port!=='54342')throw Error('TEST_OWN_LOOPBACK_REQUIRED');

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
 expect((await read(JSON.parse(JSON.stringify(sources.map(source=>source.orderId))))).get(sources[1].orderId)).toEqual(sources[1].quote);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${tenant}`).toEqual(before);
});
