// @vitest-environment node
// PL23:05: real writers/Auth/Storage; explicit synthetic invalid VAT source tests a real SQL read failure.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {runQuoteQuantityCase} from '../../../e2e/ablauf/quoteQuantityCase';
import {getLiveOrderCardAction} from '@/app/actions/orders.actions';

it('CB23:05 stored damaged goods keep one physical receipt and the catalog exit on fresh retry',async()=>{
 await runQuoteQuantityCase({name:'CB23:05 blocked goods',quantity:10,received:10,total:4000,expected:4000,hours:'0.5000',operational:true,fixed:0,blocked:true});
});

it('CB23:05 actual commercial-quote SQL failure preserves the operational card without money',async()=>{
 await runQuoteQuantityCase({name:'CB23:05 quote source unavailable',quantity:10,received:10,total:4000,expected:4000,hours:'0.5000',operational:true,fixed:0,inspect:async({orderId,quoteId,actor})=>{
  // Deliberately corrupt only this isolated TEST source, never a product fixture or guard.
  await sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,payload,status,client_event_id,event_schema_version,created_at)
   VALUES(${randomUUID()},${KREILE_TENANT_SLUG},${orderId},'QUOTE_VAT_FROM_COMPANY_V1','TEST synthetic unreadable optional VAT source',${full.actorId}::uuid,${sql.json({quoteId,edition:2,vatRateBasisPoints:'TEST-invalid-number'})},'success',${randomUUID()}::uuid,1,statement_timestamp())`;
  const log=vi.spyOn(console,'error');
  try{
   const result=await withSession(actor,()=>getLiveOrderCardAction({orderId}));
   expect(result).toMatchObject({code:'OK',data:{card:{id:orderId,operationalFacts:{rework:false,pricesMissing:null},items:[{unitPriceCents:null,vatRateBasisPoints:null}]}}});
   if(result.code!=='OK')throw Error('TEST_CB2305_CARD_LOST');
   expect(result.data.card.commercialQuote).toBeUndefined();
   expect(log).toHaveBeenCalledWith('[ORDER_CARD_COMMERCIAL_QUOTE_FAILED]',expect.objectContaining({orderId}));
   expect(await withSession(actor,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{id:orderId,version:result.data.card.version}}});
  }finally{log.mockRestore();}
 }});
});
