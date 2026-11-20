// @vitest-environment node
// Only initial TEST actors/company data are synthetic; Actions/Auth/SQL are real.
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {saveCompanySettingsAction,readSettingsAction,readPageReadSettingsAction} from '@/app/actions/settings.actions';
import {readPageReadSettings} from '@/modules/fundament/server-public';
import {resolveAuthorization} from '@/lib/server/authorization';
import {loadOfficeHome} from '@/lib/server/officeHomeRead';
import {db} from '@/db';
import {withRestoredTestSource} from '../fixtures/restoredTestSource';
import {SALES_STAGE_FEATURES} from '@/modules/fundament/public';
import {getLiveOrderCardAction} from '@/app/actions/orders.actions';

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
 options.debug=(_connection,statement)=>{if(statement.includes('queue.*')&&statement.includes('v_operational_station_queue_v1'))listReads++;};
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
