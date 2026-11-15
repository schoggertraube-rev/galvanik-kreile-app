// @vitest-environment node
import {it,expect,vi,afterAll} from 'vitest';
const scope=vi.hoisted(()=>{
 const database=process.env.DATABASE_URL,expected=process.env.H18_EXPECTED_DATABASE_URL;
 if(!database||database!==expected||new URL(database).hostname!=='127.0.0.1'||new URL(database).pathname!=='/postgres')throw Error('OWN_LOOPBACK_REQUIRED');
 const clock=new URL(database);clock.searchParams.set('TimeZone','Europe/Berlin');
 process.env.DATABASE_URL=clock.toString();process.env.H18_EXPECTED_DATABASE_URL=clock.toString();
 return {tenant:'TEST-ablauf-'+globalThis.crypto.randomUUID(),database,expected};
});
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:scope.tenant}));
import {sql,full,createFixture,withSession} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {storeOrderPhoto} from '../../../e2e/ablauf/photoFixture';
import {randomUUID} from 'node:crypto';
// The harness restores its provider environment first; restore the original
// connection URL last, so this file cannot leak the connection-local timezone.
vi.setConfig({sequence:{hooks:'list'}});
afterAll(()=>{process.env.DATABASE_URL=scope.database;process.env.H18_EXPECTED_DATABASE_URL=scope.expected;});

it('K13K-6 real rework stores instants without a UTC cast in a Berlin database session',async()=>{
 const [clock]=await sql`SELECT current_setting('TimeZone') AS zone`;
 expect(clock.zone).toBe('Europe/Berlin');
 const order=await readyInvoiceOrder('K13K clock source');
 const photo=await storeOrderPhoto(order.orderId);
 const {reklamationAusfuehrenAction,nacharbeitAnlegenAction}=await import('@/app/actions/complaints.actions');
 const complaint=await withSession(full,()=>reklamationAusfuehrenAction({action:'aufnehmen',clientKey:randomUUID(),orderId:order.orderId,intakeItemId:null,intakeVersion:null,parts:[{position_id:order.items[0].id,menge:1}],defect:'Abplatzung',description:'TEST K13K Zeitquelle',photoIds:[photo],goodsReturn:'ja'}));
 expect(complaint.code).toBe('OK');if(complaint.code!=='OK')throw Error('TEST_COMPLAINT_REQUIRED');
 const decider=await createFixture(['auftraege','entscheiden']);
 const request={reklamationId:complaint.receipt.complaintId,version:1,bewertung:'berechtigt' as const,massnahme:'nacharbeit' as const,liefertermin:'2027-05-18'};
 const [before]=await sql`SELECT statement_timestamp() AS clock`;
 const result=await withSession(decider,()=>nacharbeitAnlegenAction(request));
 expect(result.code).toBe('OK');if(result.code!=='OK')throw Error('TEST_REWORK_REQUIRED');
 const read=()=>sql`SELECT ware_seit,terminstatus_seit,
  ware_seit BETWEEN ${before.clock}::timestamptz AND statement_timestamp() AS goods_clock,
  terminstatus_seit BETWEEN ${before.clock}::timestamptz AND statement_timestamp() AS term_clock
  FROM public.orders WHERE tenant_id=${scope.tenant} AND id=${result.receipt.orderId}`;
 const rows=await read();expect(rows[0]).toMatchObject({goods_clock:true,term_clock:true});
 expect(await withSession(decider,()=>nacharbeitAnlegenAction(JSON.parse(JSON.stringify(request))))).toMatchObject({code:'OK',replayed:true,receipt:{orderId:result.receipt.orderId}});
 expect(await read()).toEqual(rows);
});
