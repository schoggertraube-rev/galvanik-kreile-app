// @vitest-environment node
// S09 setting slice only: synthetic TEST company, actual Settings Actions/Auth/DB/audit.
// This does not claim an invoice shipping position or a full N1/N2 path.
import {randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readShippingSettingsAction,saveShippingSettingsAction} from '@/app/actions/settings.actions';
beforeAll(async()=>{
 const url=process.env.DATABASE_URL;if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1')throw Error('TEST_S09_LOOPBACK_REQUIRED');
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) VALUES(${randomUUID()}::uuid,${KREILE_TENANT_SLUG},'TEST S09 Versandpauschale')`;
});
async function settings(){const read=await withSession(full,()=>readShippingSettingsAction());if(read.code!=='OK')throw Error('TEST_REAL_SHIPPING_SETTINGS_REQUIRED');return read.settings;}
const request=(row:Awaited<ReturnType<typeof settings>>)=>({service:row.service,numberPattern:row.numberPattern,numberHint:row.numberHint,trackingUrl:row.trackingUrl,expectedUpdatedAt:row.updatedAt});

it('A09 setting defaults once to owner1000 and the same writer persists amount, actor audit and fresh retry',async()=>{
 const before=await settings();expect(before.shippingFeeCents).toBe(1000);
 const input={...request(before),shippingFeeCents:2500};
 expect(await withSession(full,()=>saveShippingSettingsAction(input))).toMatchObject({code:'OK',replayed:false,settings:{shippingFeeCents:2500}});
 expect(await withSession(full,()=>saveShippingSettingsAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,settings:{shippingFeeCents:2500}});
 expect((await settings()).shippingFeeCents).toBe(2500);
 const audit=await sql`SELECT payload FROM public.ui_events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='shipping_settings_updated'`;
 expect(audit).toHaveLength(1);expect(audit[0].payload).toMatchObject({actorId:full.actorId,before:{shippingFeeCents:1000},after:{shippingFeeCents:2500}});
});

it('A09-4 preserves explicit null and zero; an older operational settings request never restores a default',async()=>{
 for(const value of [null,0]){
  const current=await settings();expect(await withSession(full,()=>saveShippingSettingsAction({...request(current),shippingFeeCents:value}))).toMatchObject({code:'OK',settings:{shippingFeeCents:value}});
  const next=await settings();expect(await withSession(full,()=>saveShippingSettingsAction({...request(next),numberHint:'TEST preserved '+String(value)}))).toMatchObject({code:'OK',settings:{shippingFeeCents:value}});
  expect((await settings()).shippingFeeCents).toBe(value);
 }
});

it('A09 financial setting is hidden and cannot be changed without money, while existing operational settings remain usable',async()=>{
 const operator=await createFixture(['einstellungen','auftraege'],'buero');
 const hidden=await withSession(operator,()=>readShippingSettingsAction());if(hidden.code!=='OK')throw Error('TEST_OPERATIONAL_SETTINGS_REQUIRED');
 expect('shippingFeeCents'in hidden.settings).toBe(false);
 expect(await withSession(operator,()=>saveShippingSettingsAction({...request(hidden.settings),shippingFeeCents:8000}))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(operator,()=>saveShippingSettingsAction({...request(hidden.settings),numberHint:'TEST operational without money'}))).toMatchObject({code:'OK'});
 expect((await settings()).shippingFeeCents).toBe(0);
});

it('A09 rejects stale parallel fee changes with the current fee and no second audit effect',async()=>{
 const before=await settings();const input={...request(before),shippingFeeCents:1200};
 const results=await Promise.all([withSession(full,()=>saveShippingSettingsAction(input)),withSession(full,()=>saveShippingSettingsAction({...input,shippingFeeCents:1800}))]);
 expect(results.filter(row=>row.code==='OK')).toHaveLength(1);
 expect(results.find(row=>row.code!=='OK')).toMatchObject({code:'CONFLICT'});
 expect([1200,1800]).toContain((await settings()).shippingFeeCents);
});

it('A09 a missing actual settings audit rolls fee change back and the same retained input can retry',async()=>{
 const before=await settings(),input={...request(before),shippingFeeCents:3300},fault='test_s09_fee_'+randomUUID().replaceAll('-','');
 if(!/^[A-Za-z0-9-]+$/.test(KREILE_TENANT_SLUG))throw Error('TEST_TENANT_LITERAL_INVALID');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='shipping_settings_updated' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.ui_events FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{
  expect(await withSession(full,()=>saveShippingSettingsAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect((await settings()).shippingFeeCents).toBe(before.shippingFeeCents);
  expect((await settings()).updatedAt).toBe(before.updatedAt);
 }finally{await sql.unsafe(`DROP TRIGGER ${fault} ON public.ui_events`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);}
 expect(await withSession(full,()=>saveShippingSettingsAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',settings:{shippingFeeCents:3300}});
 expect(await withSession(full,()=>saveShippingSettingsAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
});
