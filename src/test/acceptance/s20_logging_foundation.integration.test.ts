// @vitest-environment node
// S20 foundation slice: synthetic TEST actors/settings; real authorization and DB.
// This is not the technical writer, click transport or complete S20 acceptance.
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {getAuthorizationSnapshotAction} from '@/app/actions/auth.actions';
import {hasAuthorizationArea,getAuthorizationActionGrants} from '@/lib/server/authorization';
import {ROLE_ACCESS_AREA_TEMPLATES} from '@/lib/auth/authorizationContract';

it('S20 canonical protocol area is independent of money; developer fixed area and admin template retain the same boundary on reread',async()=>{
 const reader=await createFixture(['protokoll'],'buero');
 const before=await withSession(reader,()=>getAuthorizationSnapshotAction());
 expect(before).toMatchObject({ok:true,data:{areas:['protokoll'],actions:{confirmPayment:false}}});
 if(!before.ok)throw Error('TEST_REAL_AUTH_REQUIRED');
 expect(hasAuthorizationArea(before.data,'protokoll')).toBe(true);
 expect(hasAuthorizationArea(before.data,'geld')).toBe(false);
 expect(getAuthorizationActionGrants(before.data).confirmPayment).toBe(false);
 const next=await withSession(reader,()=>getAuthorizationSnapshotAction());
 expect(next).toMatchObject({ok:true,data:{areas:['protokoll'],actions:{confirmPayment:false}}});
 const developer=await createFixture([...ROLE_ACCESS_AREA_TEMPLATES.developer],'developer');
 const dev=await withSession(developer,()=>getAuthorizationSnapshotAction());
 expect(dev).toMatchObject({ok:true,data:{areas:expect.arrayContaining(['protokoll','wartung']),actions:{confirmPayment:false}}});
 expect(ROLE_ACCESS_AREA_TEMPLATES.admin).toContain('protokoll');
 const plain=await createFixture(['auftraege']);
 const hidden=await withSession(plain,()=>getAuthorizationSnapshotAction());
 expect(hidden).toMatchObject({ok:true});
 if(!hidden.ok)throw Error('TEST_REAL_AUTH_REQUIRED');
 expect(hasAuthorizationArea(hidden.data,'protokoll')).toBe(false);
});

it('S20 existing settings preserve null retention and approved defaults; nonpositive thresholds fail, click source is still server-only',async()=>{
 const id=randomUUID();
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) VALUES(${id},${KREILE_TENANT_SLUG},'TEST S20 settings')`;
 const rows=await sql`SELECT protokoll_aufbewahrung_tage,protokoll_langsam_ms,protokoll_haenger_ms FROM public.company_settings WHERE id=${id} AND tenant_id=${KREILE_TENANT_SLUG}`;
 expect(rows).toEqual([{protokoll_aufbewahrung_tage:null,protokoll_langsam_ms:1000,protokoll_haenger_ms:3000}]);
 await expect(sql`UPDATE public.company_settings SET protokoll_aufbewahrung_tage=0 WHERE id=${id} AND tenant_id=${KREILE_TENANT_SLUG}`).rejects.toMatchObject({code:'23514'});
 await expect(sql`UPDATE public.company_settings SET protokoll_langsam_ms=-1 WHERE id=${id} AND tenant_id=${KREILE_TENANT_SLUG}`).rejects.toMatchObject({code:'23514'});
 await expect(sql`UPDATE public.company_settings SET protokoll_haenger_ms=0 WHERE id=${id} AND tenant_id=${KREILE_TENANT_SLUG}`).rejects.toMatchObject({code:'23514'});
 const [security]=await sql`SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='public.app_usage_events'::regclass`;
 expect(security).toEqual({relrowsecurity:true,relforcerowsecurity:true});
 const grants=await sql`SELECT grantee,privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name='app_usage_events'`;
 expect(grants.filter(row=>['anon','authenticated'].includes(row.grantee))).toEqual([]);
 expect(grants).toEqual(expect.arrayContaining([{grantee:'service_role',privilege_type:'DELETE'}]));
});
