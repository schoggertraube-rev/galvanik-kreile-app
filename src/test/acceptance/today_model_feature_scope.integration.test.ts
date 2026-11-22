// @vitest-environment node
// E1 schema boundary only: isolated TEST configuration and rollback-only
// global no-op probe. This is not an Action/permission or flag-change delivery claim.
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql} from '../../../e2e/ablauf/replayHarness';

it('uses the existing tenant_features.tenant key for insert/update/delete invalidation',async()=>{
 const [before]=await sql`SELECT tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`;
 await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES(${tenant},'E01',true)`;
 expect(await sql`SELECT tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{seq:before.seq+1}]);
 await sql`UPDATE public.tenant_features SET enabled=false WHERE tenant=${tenant} AND feature_id='E01'`;
 expect(await sql`SELECT tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{seq:before.seq+2}]);
 await sql`DELETE FROM public.tenant_features WHERE tenant=${tenant} AND feature_id='E01'`;
 expect(await sql`SELECT tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id=${tenant}`).toEqual([{seq:before.seq+3}]);
});

it('invalidates every already built tenant for the existing global feature_flags source and rolls all changes back',async()=>{
 const other=tenant+'-secondary';
 await sql`INSERT INTO private.today_tenant_v1(tenant_id) VALUES(${other})`;
 const before=await sql`SELECT tenant_id,tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id IN (${tenant},${other}) ORDER BY tenant_id`;
 const flags=await sql`SELECT to_jsonb(flag) AS row FROM public.feature_flags flag ORDER BY id`;
 expect(flags.length).toBeGreaterThan(0);
 const rollback=new Error('TEST_ROLLBACK_GLOBAL_FLAG_AND_ALL_MARKS');
 await expect(sql.begin(async tx=>{
  await tx`UPDATE public.feature_flags SET enabled=enabled WHERE id=(SELECT id FROM public.feature_flags ORDER BY id LIMIT 1)`;
  expect(await tx`SELECT tenant_id,tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id IN (${tenant},${other}) ORDER BY tenant_id`).toEqual(before.map(row=>({...row,seq:row.seq+1})));
  throw rollback;
 })).rejects.toBe(rollback);
 expect(await sql`SELECT to_jsonb(flag) AS row FROM public.feature_flags flag ORDER BY id`).toEqual(flags);
 expect(await sql`SELECT tenant_id,tenant_seq::integer AS seq FROM private.today_tenant_v1 WHERE tenant_id IN (${tenant},${other}) ORDER BY tenant_id`).toEqual(before);
});
