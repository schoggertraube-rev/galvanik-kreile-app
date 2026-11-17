// @vitest-environment node
// Actual current customer/settings/credit Actions/Auth/DB. TEST fixtures only.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {transitionWareneingangToGalvanikAction} from '@/app/actions/orders.actions';
import {replayOfflineWorkshopAction} from '@/app/actions/offlineWorkshop.actions';
import {offlinePartition} from '@/lib/server/offlinePartition';
import {createCustomerAction,readCustomerCreateReceiptAction} from '@/app/actions/customers.actions';
import {saveCompanySettingsAction} from '@/app/actions/settings.actions';
import {payoutCustomerCreditAction} from '@/app/actions/invoices.actions';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1'||!KREILE_TENANT_SLUG.startsWith('TEST-ablauf-'))throw Error('S20_DEDICATED_TEST_REPLAY_REQUIRED');

it('current command wrappers preserve actual rights and results, one safe denial per request/actor, and actual customer create/read/fresh retry once',async()=>{
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) VALUES(${randomUUID()},${KREILE_TENANT_SLUG},'TEST S20 current commands')`;
 const operator=await createFixture(['auftraege']);
 const input={clientEventId:randomUUID(),customerType:'business' as const,companyName:'TEST S20 existing customer',salutation:'frau' as const,firstName:'TEST Nora',lastName:'TEST Neu',contactRole:'TEST Einkauf',phone:'+49 711 5550404',email:'TEST-'+randomUUID()+'@example.invalid',billingEmail:null,website:null,street:'Industriestrasse',houseNumber:'7',zipCode:'70176',city:'Stuttgart',country:'DE',paymentPreference:null,handoverPreference:'pickup' as const,vatId:null,iban:null,paymentTermDays:null,notes:'TEST PRIVATE_CUSTOMER_NOTE PIN 1234 Bearer x'};
 expect(await withSession(operator,()=>createCustomerAction(input))).toMatchObject({code:'FORBIDDEN'});
 expect(await sql`SELECT id FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND email=${input.email}`).toHaveLength(0);
 const customerId=await customerFixture('TEST S20 credit denial');
 expect(await withSession(operator,()=>payoutCustomerCreditAction({customerId,amount:100,expectedCreditVersion:0,clientEventId:randomUUID(),method:'bar',reference:null,note:null}))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(operator,()=>saveCompanySettingsAction({companyName:'TEST denied',street:'TEST Weg 1',zip:'70176',city:'Stuttgart',country:'Deutschland',taxId:'DE123456789',iban:'DE02120300000000202051',bic:'BYLADEM1001',bankName:'TEST Bank',paymentTermDays:14,logoUrl:'/TEST-logo.png'}))).toMatchObject({code:'FORBIDDEN'});
 const entries=await sql`SELECT command,user_id::text,subject_id,reason FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND user_id=${operator.actorId}::uuid AND event_type='rejected' ORDER BY command`;
 expect(entries).toEqual([
  {command:'createCustomerAction',user_id:operator.actorId,subject_id:input.clientEventId,reason:'FORBIDDEN'},
  {command:'payoutCustomerCreditAction',user_id:operator.actorId,subject_id:customerId,reason:'FORBIDDEN'},
  {command:'saveCompanySettingsAction',user_id:operator.actorId,subject_id:'saveCompanySettingsAction',reason:'FORBIDDEN'}
 ]);
 for(const secret of ['PRIVATE_CUSTOMER_NOTE','1234','Bearer x',input.email])expect(JSON.stringify(entries)).not.toContain(secret);
 const created=await withSession(full,()=>createCustomerAction(JSON.parse(JSON.stringify(input))));expect(created).toMatchObject({code:'OK'});if(created.code!=='OK')throw Error('TEST_REAL_CUSTOMER_REQUIRED');
 expect(await withSession(full,()=>readCustomerCreateReceiptAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',receipt:{customerId:created.receipt.customerId}});
 expect(await withSession(full,()=>createCustomerAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{customerId:created.receipt.customerId}});
 expect(await sql`SELECT id FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND email=${input.email}`).toHaveLength(1);
 expect(await sql`SELECT company_name FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual([{company_name:'TEST S20 current commands'}]);
});

it('an actual R2 pricing SQL error is logged after physical completion/marker/task committed, even when the main command succeeds; the same original later repairs',async()=>{
 const customer=await customerFixture('TEST S20 R2 diagnostics'),created=await intakeOrderFixture('TEST S20 R2 diagnostics',customer),orderId=created.receipt.orderId,itemId=created.receipt.items[0].id;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('TEST_REAL_MOVE_REQUIRED');
 const key=randomUUID(),capturedAt=new Date(Date.now()-8*86400000).toISOString();
 const original={kind:'workshop' as const,command:'item.finished' as const,id:key,itemId:orderId,deviceCapturedAt:capturedAt,input:{orderId,itemId,expectedVersion:moved.receipt.aggregateVersion,clientEventId:key,finished:true}};
 const scope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId});
 const fault='test_s20_r2_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.order_id='${orderId}' AND NEW.component='base' THEN RAISE EXCEPTION 'TEST PRIVATE_R2_SQL PIN 1234 Bearer x'; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON private.order_production_snapshots FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{
  expect(await withSession(full,()=>replayOfflineWorkshopAction(scope,original))).toMatchObject({code:'OK'});
  expect(await sql`SELECT current_station_id FROM public.items WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}`).toEqual([{current_station_id:'fertig'}]);
  const markers=await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND event_type='ORDER_PRODUCTION_PRICING_RETRY_REQUIRED_V1'`;
  expect(markers).toHaveLength(1);expect(await sql`SELECT id FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${markers[0].id}::uuid`).toHaveLength(1);
  const diagnostic=await sql`SELECT * FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND subject_id=${orderId} AND event_type='server_error'`;
  expect(diagnostic).toHaveLength(1);expect(diagnostic[0]).toMatchObject({command:'PRODUCTION_PRICING_RETRY_REQUIRED',user_id:full.actorId});
  for(const secret of ['PRIVATE_R2_SQL','1234','Bearer x'])expect(JSON.stringify(diagnostic)).not.toContain(secret);
 }finally{await sql.unsafe(`DROP TRIGGER ${fault} ON private.order_production_snapshots`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);}
 expect(await withSession(full,()=>replayOfflineWorkshopAction(scope,JSON.parse(JSON.stringify(original))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT event_id FROM private.order_production_snapshots WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId} AND component='base'`).toHaveLength(1);
 expect(await sql`SELECT id FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND bezug_id=${orderId}`).toHaveLength(1);
});
