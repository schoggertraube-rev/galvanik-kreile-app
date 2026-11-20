// @vitest-environment node
// PL20.11.13:00: actual Intake/Auth/DB/read path, isolated TEST tenant.
import {expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readTodayDashboard} from '@/lib/server/todayDashboard';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';

it('exposes the actual missing invoice source on Today without losing the real unfinished order or inventing an invoice',async()=>{
 // Explicit synthetic initial company settings in this isolated TEST tenant,
 // matching Dev's existing setting; the order itself comes from its real Action.
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,street,zip,city,country,iban,bic,bank_name,tax_id,invoice_vat_rate_basis_points,invoice_payment_term_days,versand_pauschale_netto_cents)
 VALUES(${randomUUID()},${tenant},'TEST Live Quellenfirma','TEST Weg 1','70176','Stuttgart','Deutschland','DE02120300000000202051','BYLADEM1001','TEST Bank','DE123456789',1900,14,1000)`;
 const customerId=await customerFixture('TEST Live Quellenhinweis');
 const created=await intakeOrderFixture('TEST Live vor Rechnungsfreigabe',customerId);
 const orderId=created.receipt.orderId;
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId}));
 expect(card.code).toBe('OK');if(card.code!=='OK')throw Error('TEST_LIVE_CARD');
 expect(card.data.handoverConsequences).toMatchObject({code:'SOURCE_INCOMPLETE',orderId});
 const read=(actor:typeof full)=>withSession(actor,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_LIVE_AUTH');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);});
 const first=await read(full),notice=first.items.find(item=>item.key==='source-shipping:'+orderId);
 expect(notice).toMatchObject({field:'action',kind:'order',orderId,orderVersion:card.data.card.version,urgency:'warning',primaryActionLabel:'Auftrag öffnen'});
 expect(notice?.title).toBe('Versandvorschlag für Auftrag '+card.data.card.orderNumber+' fehlt: Freigabebeleg fehlt.');
 expect(notice?.title.length).toBeLessThanOrEqual(90);
 expect(notice).not.toHaveProperty('invoiceId');
 expect(first.orderActions?.rows.some(row=>row.orderId===orderId)).toBe(true);
 expect((await read(full)).items.find(item=>item.key==='source-shipping:'+orderId)).toEqual(notice);
 const orderOnly=await createFixture(['auftraege'],'werkstatt');
 expect((await read(orderOnly)).items.some(item=>item.key==='source-shipping:'+orderId)).toBe(false);
 expect(await withSession(orderOnly,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{id:orderId}}});
});
