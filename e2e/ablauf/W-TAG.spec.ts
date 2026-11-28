import { plusWorkingDays } from "@/lib/domain/workingDays";
import { readBetriebsruheInTransaction } from "@/modules/fundament/server-public";
import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {sql,full,withSession,createFixture} from './replayHarness';
import {customerFixture,intakeOrderFixture,invoiceCompanySettingsFixture} from './orderFixture';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readTodayDashboard} from '@/lib/server/todayDashboard';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';
import {getLiveOrderCardAction,transitionWareneingangToGalvanikAction} from '@/app/actions/orders.actions';

it('W-TAG T H14/H16 keeps zero, one and several actual order sources in U3 with the same versioned U2 action and no money without Geld',async()=>{
 const read=(actor:typeof full)=>withSession(actor,async()=>{
  const auth=await resolveAuthorization();if(!auth.ok)throw Error('S13_T_AUTH');
  return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction, readBetriebsruheInTransaction);
 });
 const empty=await read(full);
 expect(empty).toMatchObject({hauptaktion:null,hauptaktionsQuelle:null,orderActions:{code:'OK',rows:[]},invoiceMoney:{code:'OK',openCount:0,openCents:0},challenges:{groups:[]}});
 expect(empty.visibleFields.length).toBeLessThanOrEqual(5);
 expect(empty.items).toEqual([]);
 const customerId=await customerFixture('S13 T same live sources');
 const ids:string[]=[];
 for(let index=0;index<3;index++){
  const created=await intakeOrderFixture('S13 T order '+index,customerId);ids.push(created.receipt.orderId);
  const day=await read(full);
  expect(day.orderActions?.rows).toHaveLength(index+1);
  for(const id of ids){
   const card=await withSession(full,()=>getLiveOrderCardAction({orderId:id}));
   if(card.code!=='OK')throw Error('S13_T_CARD:'+card.code);
   expect(day.orderActions?.rows.find(row=>row.orderId===id)).toEqual({orderId:id,version:card.data.card.version,read:card.data.nextActionRule});
   expect(card.data.nextActionRule?.erstblick.length).toBeLessThanOrEqual(5);
  }
  expect((await read(full)).orderActions).toEqual(day.orderActions);
 }
 const before=await withSession(full,()=>getLiveOrderCardAction({orderId:ids[0]}));
 if(before.code!=='OK')throw Error('S13_T_START_CARD:'+before.code);
 const next=before.data.nextActionRule?.hauptaktion;
 expect(next).toMatchObject({elementId:'order.start',befehl:{funktion:'transitionWareneingangToGalvanikAction'}});
 if(!next)throw Error('S13_T_U2_START');
 const input={...JSON.parse(JSON.stringify(next.befehl.argumente)),clientEventId:randomUUID()};
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction(input));
 expect(moved).toMatchObject({code:'OK'});if(moved.code!=='OK')throw Error('S13_T_MOVED:'+moved.code);
 const fresh=await read(full),card=await withSession(full,()=>getLiveOrderCardAction({orderId:ids[0]}));
 if(card.code!=='OK')throw Error('S13_T_AFTER_CARD:'+card.code);
 expect(fresh.orderActions?.rows.find(row=>row.orderId===ids[0])).toEqual({orderId:ids[0],version:moved.receipt.aggregateVersion,read:card.data.nextActionRule});
 expect(fresh.hauptaktion).toEqual(card.data.nextActionRule?.hauptaktion);
 expect(fresh.hauptaktionsQuelle).toMatchObject({id:ids[0],version:moved.receipt.aggregateVersion});
 expect(await withSession(full,()=>transitionWareneingangToGalvanikAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect((await read(full)).orderActions).toEqual(fresh.orderActions);
 const workshop=await createFixture(['auftraege'],'werkstatt');
 const restricted=await read(workshop);
 expect(restricted.visibleFields.length).toBeLessThanOrEqual(5);
 expect(restricted.allowedFields).not.toContain('money');
 expect(restricted).not.toHaveProperty('invoiceMoney');
 expect(restricted).not.toHaveProperty('moneyMetric');
 expect(restricted).not.toHaveProperty('moneySources');
 expect(restricted.orderActions?.rows.map(row=>row.orderId).sort()).toEqual(ids.toSorted());
 const noOrders=await createFixture(['mails']);
 expect(await withSession(noOrders,()=>transitionWareneingangToGalvanikAction({...input,clientEventId:randomUUID()}))).toMatchObject({code:'FORBIDDEN'});
 expect(await read(noOrders)).not.toHaveProperty('orderActions');
});

it('W-TAG ranks the first five actual values by existing U3 urgency and deadline, across different real risks',async()=>{
 await invoiceCompanySettingsFixture();
 await sql`UPDATE public.company_settings SET betriebsruhe='[]'::jsonb,termin_knapp_arbeitstage=2
  WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const customerId=await customerFixture('S13 T concrete first-five rank');
 const [heute]=await sql`SELECT (statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date::text AS day`;
 // Deliberately not inserted in deadline/urgency order. The two next-workday orders
 // remain below the five overdue ones, independent of their earlier creation.
 const offsets=[1,-6,-8,1,-5,-9,-7],ids:string[]=[],dates:string[]=[];
 const {changeOrderPromisedDueDateAction}=await import('@/app/actions/orders.actions');
 for(const [index,offset]of offsets.entries()){
  const order=await intakeOrderFixture('S13 rank '+index,customerId);ids.push(order.receipt.orderId);
  const date=plusWorkingDays(heute.day,offset);
  if(!date)throw Error("TEST_ARBEITSTAG_FEHLT");
  dates.push(date);
  expect(await withSession(full,()=>changeOrderPromisedDueDateAction({orderId:order.receipt.orderId,expectedVersion:1,dueDate:date,reason:'TEST S13 eindeutige U3 Rangfolge',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 }
 const read=()=>withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('S13_T_RANK_AUTH');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction, readBetriebsruheInTransaction);});
 const operational=await withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('S13_T_RISK_AUTH');const {getOperationalOrders}=await import('@/lib/server/operationalOrders');return getOperationalOrders(auth.data, undefined, readBetriebsruheInTransaction);});
 expect([...new Set(operational.filter(row=>ids.includes(row.id)).map(row=>row.risk))].sort()).toEqual(['orange','red']);
 const day=await read();
 expect(day.items.filter(row=>row.orderId&&ids.includes(row.orderId))).toHaveLength(7);
 const expected=[5,2,6,1,4];
 expect(day.items.slice(0,5).map(row=>row.orderId)).toEqual(expected.map(index=>ids[index]));
 expect(day.items.slice(0,5).map(row=>row.dueDate?.slice(0,10))).toEqual(expected.map(index=>dates[index]));
 expect(day.items.slice(0,5).map(row=>row.urgency)).toEqual(Array(5).fill('conflict'));
 expect(day.items.slice(5).filter(row=>row.orderId&&ids.includes(row.orderId)).map(row=>row.urgency)).toEqual(['warning','warning']);
 expect((await read()).items.slice(0,5)).toEqual(day.items.slice(0,5));
 expect(await sql`SELECT count(*)::int AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=ANY(${ids}::text[])`).toEqual([{n:7}]);
});
