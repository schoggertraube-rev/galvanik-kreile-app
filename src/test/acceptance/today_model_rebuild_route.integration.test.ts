// @vitest-environment node
// Real route, native request/session authorization and TEST DB; only the
// external Cron credential is an explicit synthetic TEST boundary.
import {afterEach,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,createFixture,withSession,withRequest} from '../../../e2e/ablauf/replayHarness';
import {GET} from '@/app/api/heute/neuaufbau/route';

const request=(headers:Record<string,string>={})=>new Request('http://127.0.0.1/api/heute/neuaufbau',{headers});
afterEach(()=>vi.unstubAllEnvs());

it('rejects anonymous/header claims and a real non-diagnostic login without computing a model',async()=>{
 vi.stubEnv('CRON_SECRET','');
 const before=await sql`SELECT to_jsonb(source) AS row FROM private.today_source_v1 source WHERE tenant_id=${tenant} ORDER BY kind,source_id`;
 const anonymous=await withRequest('',()=>GET(request({'user-agent':'vercel-cron/1.0','x-vercel-cron':'1'})));
 expect(anonymous.status).toBe(401);expect(await anonymous.text()).toBe('');
 const reader=await createFixture(['auftraege']);
 const denied=await withSession(reader,()=>GET(request()));
 expect(denied.status).toBe(403);expect(await denied.text()).toBe('');
 expect(await sql`SELECT to_jsonb(source) AS row FROM private.today_source_v1 source WHERE tenant_id=${tenant} ORDER BY kind,source_id`).toEqual(before);
});

it('requires the exact runtime bearer proof even for a diagnostic session and never returns the credential',async()=>{
 vi.stubEnv('CRON_SECRET','TEST-today-cron-provider-boundary');
 const operator=await createFixture(['wartung'],'developer');
 const rejectedHeaders:Record<string,string>[]=[{},{authorization:'Bearer TEST-wrong-boundary'}];
 for(const headers of rejectedHeaders){
  const denied=await withSession(operator,()=>GET(request(headers)));
  expect(denied.status).toBe(401);expect(await denied.text()).toBe('');
 }
 const accepted=await withRequest('',()=>GET(request({authorization:'Bearer TEST-today-cron-provider-boundary'})));
 expect(accepted.status).toBe(200);expect(accepted.headers.get('Cache-Control')).toBe('private, no-store');
 expect(await accepted.json()).toMatchObject({code:'OK',built:8,stale:0});
 expect(await sql`SELECT count(*)::integer AS count FROM private.today_source_v1 WHERE tenant_id=${tenant}`).toEqual([{count:8}]);
});

it('uses only the real existing diagnostic permission when no Cron credential is configured',async()=>{
 vi.stubEnv('CRON_SECRET','');
 const operator=await createFixture(['wartung'],'developer');
 const accepted=await withSession(operator,()=>GET(request()));
 expect(accepted.status).toBe(200);expect(await accepted.json()).toMatchObject({code:'OK',built:8,stale:0});
 expect(await sql`SELECT refresh_lease_until FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{refresh_lease_until:null}]);
});
