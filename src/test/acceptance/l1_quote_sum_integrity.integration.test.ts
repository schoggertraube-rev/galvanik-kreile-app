// @vitest-environment node
// R24: deliberately damaged source belongs exclusively to this isolated TEST tenant.
// Real quote/goods/order Actions, Auth, DB and Storage; no guard or trigger bypass.
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {runQuoteQuantityCase} from '../../../e2e/ablauf/quoteQuantityCase';
import {getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readOrderCommercialQuote} from '@/lib/server/orderQuoteReadPort';
import {readTodayDashboard} from '@/lib/server/todayDashboard';
import {loadOfficeHome} from '@/lib/server/officeHomeRead';

it('N7 rejects an actual position/grand-total mismatch without losing the order or its Today exit',async()=>{
 await runQuoteQuantityCase({name:'TEST L1 N7 exact sum mismatch',quantity:10,received:10,total:4000,expected:4000,hours:'0.5000',operational:true,fixed:0,inspect:async({orderId,quoteId,actor})=>{
  await sql`UPDATE private.quotes SET total_net_cents=total_net_cents+1 WHERE tenant_id=${tenant} AND id=${quoteId}::uuid`;
  expect(await sql`SELECT total_net_cents::int AS total,(SELECT sum(coalesce(p.zeilen_gesamt_cents,p.line_total_cents))::int FROM private.quote_positions p WHERE p.tenant_id=q.tenant_id AND p.quote_id=q.id AND p.revision=q.version) AS positions FROM private.quotes q WHERE q.tenant_id=${tenant} AND q.id=${quoteId}::uuid`).toEqual([{total:4001,positions:4000}]);
  await expect(withSession(full,async()=>{
   const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_N7_AUTH');
   return withPrivilegedTenantTransaction(auth.data,tx=>readOrderCommercialQuote(tx,tenant,orderId));
  })).rejects.toThrow('ORDER_CARD_QUOTE_PRICE_INVALID');
  const card=await withSession(actor,()=>getLiveOrderCardAction({orderId}));
  expect(card).toMatchObject({code:'OK',data:{card:{id:orderId,operationalFacts:{pricesMissing:null},items:[{unitPriceCents:null,vatRateBasisPoints:null}]}}});
  if(card.code!=='OK')throw Error('TEST_N7_OPERATIONAL_CARD_LOST');
  expect(card.data.card.commercialQuote).toBeUndefined();
  expect(await withSession(actor,()=>getLiveOrderCardAction(JSON.parse(JSON.stringify({orderId}))))).toMatchObject({code:'OK',data:{card:{version:card.data.card.version}}});
  const today=await withSession(full,async()=>{
   const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_N7_AUTH');
   return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);
  });
  expect(today.items.find(row=>row.key==='source-quote:'+orderId)).toMatchObject({orderId,orderVersion:card.data.card.version,title:'Preisbeleg zu Auftrag '+card.data.card.orderNumber+' ist nicht lesbar.',primaryActionLabel:'Auftrag öffnen'});
  const started=performance.now();
  const home=await withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_N7_AUTH');return loadOfficeHome(auth.data);});
  expect(home.kind).toBe('data');expect(performance.now()-started).toBeLessThan(3000);
 }});
});
