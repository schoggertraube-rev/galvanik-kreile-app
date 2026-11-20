// @vitest-environment node
// PL20.11.13:00: actual Intake/Auth/DB/read path, isolated TEST tenant.
import {expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {getLiveOrderCardAction,transitionWareneingangToGalvanikAction} from '@/app/actions/orders.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readTodayDashboard} from '@/lib/server/todayDashboard';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';

it('PL13:42 proves an actual unfinished Intake order is not applicable without an error, warning or invented zero',async()=>{
 // Explicit synthetic initial company settings in this isolated TEST tenant,
 // matching Dev's existing setting; the order itself comes from its real Action.
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,street,zip,city,country,iban,bic,bank_name,tax_id,invoice_vat_rate_basis_points,invoice_payment_term_days,versand_pauschale_netto_cents)
 VALUES(${randomUUID()},${tenant},'TEST Live Quellenfirma','TEST Weg 1','70176','Stuttgart','Deutschland','DE02120300000000202051','BYLADEM1001','TEST Bank','DE123456789',1900,14,1000)`;
 const customerId=await customerFixture('TEST Live Quellenhinweis');
 const created=await intakeOrderFixture('TEST Live vor Rechnungsfreigabe',customerId);
 const orderId=created.receipt.orderId;
 const errors=vi.spyOn(console,'error');
 try{
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId}));
 expect(card.code).toBe('OK');if(card.code!=='OK')throw Error('TEST_LIVE_CARD');
 expect(card.data.handoverConsequences).toEqual({code:'NOT_APPLICABLE',orderId,orderVersion:card.data.card.version});
 const read=(actor:typeof full)=>withSession(actor,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_LIVE_AUTH');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);});
 const first=await read(full),notice=first.items.find(item=>item.key==='source-shipping:'+orderId);
 expect(notice).toBeUndefined();
 expect(card.data.handoverConsequences).not.toHaveProperty('feeCents');
 expect(card.data.handoverConsequences).not.toHaveProperty('shippingCostMissing');
 expect(first.orderActions?.rows.some(row=>row.orderId===orderId)).toBe(true);
 expect((await read(full)).items.find(item=>item.key==='source-shipping:'+orderId)).toEqual(notice);
 const orderOnly=await createFixture(['auftraege'],'werkstatt');
 expect((await read(orderOnly)).items.some(item=>item.key==='source-shipping:'+orderId)).toBe(false);
 expect(await withSession(orderOnly,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{id:orderId}}});
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:card.data.card.version,clientEventId:randomUUID()}));
 expect(moved.code).toBe('OK');if(moved.code!=='OK')throw Error('TEST_LIVE_STATION');
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{handoverConsequences:{code:'NOT_APPLICABLE',orderId,orderVersion:moved.receipt.aggregateVersion}}});
 expect(errors).not.toHaveBeenCalledWith('[INVOICE_SHIPPING_PROPOSAL_FAILED]',expect.anything());
 }finally{errors.mockRestore();}
});

it('retains a concrete warning for an explicitly synthetic orphan freeze receipt on a real TEST order',async()=>{
 const customerId=await customerFixture('TEST Live beschädigter Fertigbeleg');
 const created=await intakeOrderFixture('TEST Live beschädigter Fertigbeleg',customerId),orderId=created.receipt.orderId;
 // Explicit invalid historical fixture in the isolated TEST tenant. No guard
 // is disabled; no healthy product receipt or Dev row is modified.
 await sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,payload,status,client_event_id,event_schema_version,aggregate_version,correlation_id,from_station,station,created_at)
 VALUES(${randomUUID()},${tenant},${orderId},'ORDER_FROZEN_V1','TEST synthetic orphan historical freeze',${full.actorId}::uuid,${sql.json({freezeId:randomUUID(),rateId:randomUUID(),hourlyRateCents:14000,totalAmountCents:10000,lineCount:1})},'success',${randomUUID()}::uuid,1,${created.receipt.orderVersion},${randomUUID()}::uuid,'galvanik','fertig',statement_timestamp())`;
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId}));
 expect(card).toMatchObject({code:'OK',data:{handoverConsequences:{code:'SOURCE_INCOMPLETE',orderId}}});
 const today=await withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_LIVE_AUTH');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);});
 const notice=today.items.find(item=>item.key==='source-shipping:'+orderId);
 expect(notice).toMatchObject({orderId,orderVersion:created.receipt.orderVersion,field:'action',urgency:'warning',primaryActionLabel:'Auftrag öffnen'});
 expect(notice?.title).toContain('Quelle nicht lesbar.');
 expect(notice?.title.length).toBeLessThanOrEqual(90);
 expect((await withSession(full,()=>getLiveOrderCardAction({orderId}))).code).toBe('OK');
});
