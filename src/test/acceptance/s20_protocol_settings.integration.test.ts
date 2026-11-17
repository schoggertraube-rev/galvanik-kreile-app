// @vitest-environment node
// Synthetic TEST company/actors; existing Settings Action/Auth/DB/audit and protocol reader are real.
import {randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readSettingsAction,saveCompanySettingsAction} from '@/app/actions/settings.actions';
import {observeAction} from '@/modules/logging/server-public';
import {readLoggingSettings} from '@/modules/fundament/server-public';
import {resolveAuthorization} from '@/lib/server/authorization';
import type {CompanySettingsInput} from '@/modules/fundament/public';
import {SALES_STAGE_FEATURES} from '@/modules/fundament/public';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1'||!KREILE_TENANT_SLUG.startsWith('TEST-ablauf-'))throw Error('S20_DEDICATED_TEST_REPLAY_REQUIRED');
const company:CompanySettingsInput={companyName:'TEST Protocol Firma',street:'TEST Weg 1',zip:'70176',city:'Stuttgart',country:'Deutschland',taxId:'DE123456789',iban:'DE02120300000000202051',bic:'BYLADEM1001',bankName:'TEST Bank',paymentTermDays:14,logoUrl:'/TEST-logo.png'};
beforeAll(async()=>{
 // Tenant provisioning fixture only: canonical catalog, no fabricated feature/default source.
 for(const feature of SALES_STAGE_FEATURES)await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES(${KREILE_TENANT_SLUG},${feature.id},${feature.defaultEnabled})`;
 expect(await withSession(full,()=>saveCompanySettingsAction(company))).toEqual({code:'OK'});
});
async function settings(){const result=await withSession(full,()=>readSettingsAction());if(result.code!=='OK')throw Error('TEST_SETTINGS_READ_REQUIRED');return result.snapshot.company;}

it('existing company writer stores protocol settings with real actor audit, fresh retry and legacy request preservation',async()=>{
 expect((await settings()).protocol).toEqual({retentionDays:null,slowMs:1000,hangMs:3000});
 const input={...company,protocol:{retentionDays:30,slowMs:2000,hangMs:4000}};
 expect(await withSession(full,()=>saveCompanySettingsAction(input))).toEqual({code:'OK'});
 expect((await settings()).protocol).toEqual(input.protocol);
 const proof=await sql`SELECT payload FROM public.ui_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='company_settings_updated' AND payload?'protocol'`;
 expect(proof).toHaveLength(1);expect(proof[0].payload).toMatchObject({actorId:full.actorId,protocol:input.protocol});
 expect(await withSession(full,()=>saveCompanySettingsAction(JSON.parse(JSON.stringify(input))))).toEqual({code:'OK'});
 expect((await settings()).protocol).toEqual(input.protocol);
 expect(await withSession(full,()=>saveCompanySettingsAction({...company,companyName:'TEST Legacy request'}))).toEqual({code:'OK'});
 expect((await settings()).protocol).toEqual(input.protocol);
 const nullRetention={...company,protocol:{retentionDays:null,slowMs:2000,hangMs:4000}};
 expect(await withSession(full,()=>saveCompanySettingsAction(nullRetention))).toEqual({code:'OK'});
 expect((await settings()).protocol).toEqual(nullRetention.protocol);
});

it('protocol configuration keeps existing settings authority; invalid thresholds and a suppressed audit never change any company value',async()=>{
 const operator=await createFixture(['protokoll']);
 expect(await withSession(operator,()=>saveCompanySettingsAction({...company,protocol:{retentionDays:10,slowMs:900,hangMs:2000}}))).toMatchObject({code:'FORBIDDEN'});
 const before=await settings();
 for(const protocol of [{retentionDays:0,slowMs:1000,hangMs:3000},{retentionDays:null,slowMs:0,hangMs:3000},{retentionDays:null,slowMs:1000,hangMs:-1}]){
  expect(await withSession(full,()=>saveCompanySettingsAction({...company,protocol}))).toMatchObject({code:'VALIDATION_ERROR'});
 }
 expect(await settings()).toEqual(before);
 const fault='test_s20_settings_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='company_settings_updated' AND NEW.payload?'protocol' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.ui_events FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 const input={...company,companyName:'TEST Atomic settings',protocol:{retentionDays:14,slowMs:2100,hangMs:4200}};
 try{
  expect(await withSession(full,()=>saveCompanySettingsAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(await settings()).toEqual(before);
 }finally{await sql.unsafe(`DROP TRIGGER ${fault} ON public.ui_events`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);}
 expect(await withSession(full,()=>saveCompanySettingsAction(JSON.parse(JSON.stringify(input))))).toEqual({code:'OK'});
 expect((await settings()).protocol).toEqual(input.protocol);
});

it('L4 actual configured threshold2s governs the same observer after settings Action and reread',async()=>{
 const input={...company,protocol:{retentionDays:null,slowMs:2000,hangMs:3000}};
 expect(await withSession(full,()=>saveCompanySettingsAction(input))).toEqual({code:'OK'});
 expect((await settings()).protocol).toEqual(input.protocol);
 const reference=randomUUID();
 expect(await withSession(full,()=>observeAction('testS20ConfiguredDuration',{type:'order',id:reference},async()=>{
  await resolveAuthorization();await sql`SELECT pg_sleep(1.2)`;return {code:'OK' as const};
 },readLoggingSettings))).toEqual({code:'OK'});
 expect(await sql`SELECT id FROM public.technical_protocol WHERE tenant_id=${KREILE_TENANT_SLUG} AND subject_id=${reference}`).toHaveLength(0);
});
