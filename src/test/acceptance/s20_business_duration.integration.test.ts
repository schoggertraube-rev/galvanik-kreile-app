// @vitest-environment node
// Actual payment-mode and settings commands. Delay is a TEST-tenant SQL trigger,
// not a clock mock, simulated command, changed threshold or provider assertion.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {setPaymentModeAction} from '@/app/actions/payments.actions';
import {saveCompanySettingsAction} from '@/app/actions/settings.actions';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1'||!KREILE_TENANT_SLUG.startsWith('TEST-ablauf-'))throw Error('S20_DEDICATED_TEST_REPLAY_REQUIRED');

it('L3/L4 actual existing business command distinguishes1.2s/0.8s and the real changed2s threshold, retaining one effect on fresh retry',async()=>{
 const company={companyName:'TEST S20 actual business duration',street:'TEST Weg 1',zip:'70176',city:'Stuttgart',country:'Deutschland',taxId:'DE123456789',iban:'DE02120300000000202051',bic:'BYLADEM1001',bankName:'TEST Bank',paymentTermDays:14,logoUrl:'/TEST-logo.png'};
 expect(await withSession(full,()=>saveCompanySettingsAction({...company,protocol:{retentionDays:null,slowMs:1000,hangMs:3000}}))).toMatchObject({code:'OK'});
 const customer=await customerFixture('TEST S20 business duration');
 const sources=[];
 for(const seconds of [1.2,0.8,1.2]){
  const created=await intakeOrderFixture('TEST S20 actual delay',customer);
  const orderId=created.receipt.orderId;
  const [row]=await sql`SELECT payment_mode_version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${orderId}`;
  sources.push({orderId,seconds,input:{orderId,paymentMode:'abholung' as const,expectedVersion:row.payment_mode_version,clientEventId:randomUUID()}});
 }
 const trigger='test_s20_duration_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.payment_mode_version<>OLD.payment_mode_version THEN ${sources.map(source=>`IF NEW.id='${source.orderId}' THEN PERFORM pg_sleep(${source.seconds}); END IF;`).join(' ')} END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${trigger} BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION private.${trigger}()`);
 try{
  for(const [index,source] of sources.entries()){
   if(index===2)expect(await withSession(full,()=>saveCompanySettingsAction({...company,protocol:{retentionDays:null,slowMs:2000,hangMs:3000}}))).toMatchObject({code:'OK'});
   const result=await withSession(full,()=>setPaymentModeAction(source.input));expect(result).toMatchObject({code:'OK',receipt:{paymentMode:'abholung'}});
   const entries=await sql`SELECT command,duration_ms,user_id::text FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='slow' AND subject_id=${source.orderId}`;
   if(index===0){expect(entries).toHaveLength(1);expect(entries[0]).toMatchObject({command:'setPaymentMode',user_id:full.actorId});expect(entries[0].duration_ms).toBeGreaterThan(1000);}
   else expect(entries).toHaveLength(0);
   expect(await withSession(full,()=>setPaymentModeAction(JSON.parse(JSON.stringify(source.input))))).toMatchObject({code:'OK',replayed:true});
   expect(await sql`SELECT payment_mode,payment_mode_version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${source.orderId}`).toEqual([{payment_mode:'abholung',payment_mode_version:source.input.expectedVersion+1}]);
   expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${source.input.clientEventId}::uuid`).toHaveLength(1);
  }
 }finally{await sql.unsafe(`DROP TRIGGER ${trigger} ON public.orders`);await sql.unsafe(`DROP FUNCTION private.${trigger}()`);}
});
